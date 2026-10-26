"""
Tests de /ia/extraer-comprobante.

No pega contra Gemini de verdad (costaría plata y sería flaky): se mockea
`extraer_comprobante` en el namespace de app.api.ai, así se prueba el
endpoint (auth, validación de archivo, manejo de errores) sin depender de la
API real. La lógica de _validar_y_limpiar (qué hace con lo que devuelve el
modelo) se prueba aparte, directo contra la función pura, sin mock.
"""

import io
import uuid

from app import schemas
from app.ai.extractor import AIExtractionError, _armar_prompt, _validar_y_limpiar
from app.db import models

ARCHIVO_PDF_FALSO = ("factura.pdf", io.BytesIO(b"%PDF-1.4 contenido falso"), "application/pdf")


def _mock_ok(**kwargs):
    return schemas.AIReceiptExtraction(
        monto=15000.0,
        fecha="2026-07-20",
        tipo_factura="factura_b",
        descripcion="Transportes ABC - flete",
        advertencias=[],
    )


def test_sin_login_da_401(client):
    resp = client.post(
        "/ia/extraer-comprobante",
        data={"tipo_entidad": "gasto", "contexto": "{}"},
        files={"archivo": ARCHIVO_PDF_FALSO},
    )
    assert resp.status_code == 401


def test_usuario_lectura_no_puede(client, headers_lectura):
    resp = client.post(
        "/ia/extraer-comprobante",
        data={"tipo_entidad": "gasto", "contexto": "{}"},
        files={"archivo": ARCHIVO_PDF_FALSO},
        headers=headers_lectura,
    )
    assert resp.status_code == 403


def test_tipo_entidad_invalido(client, headers_admin):
    resp = client.post(
        "/ia/extraer-comprobante",
        data={"tipo_entidad": "no_existe", "contexto": "{}"},
        files={"archivo": ARCHIVO_PDF_FALSO},
        headers=headers_admin,
    )
    assert resp.status_code == 400


def test_extension_no_permitida(client, headers_admin):
    archivo = ("factura.txt", io.BytesIO(b"hola"), "text/plain")
    resp = client.post(
        "/ia/extraer-comprobante",
        data={"tipo_entidad": "gasto", "contexto": "{}"},
        files={"archivo": archivo},
        headers=headers_admin,
    )
    assert resp.status_code == 400
    assert "Extensión" in resp.json()["detail"]


def test_archivo_supera_tamanio_maximo(client, headers_admin, monkeypatch):
    import app.api.ai as ruta_ia

    monkeypatch.setattr(
        ruta_ia, "TAMANIO_MAXIMO_BYTES", 10
    )  # bajamos el límite para no mandar 10MB de verdad
    archivo = ("factura.pdf", io.BytesIO(b"contenido mas largo que 10 bytes"), "application/pdf")
    resp = client.post(
        "/ia/extraer-comprobante",
        data={"tipo_entidad": "gasto", "contexto": "{}"},
        files={"archivo": archivo},
        headers=headers_admin,
    )
    assert resp.status_code == 400
    assert "10MB" in resp.json()["detail"]


def test_extraccion_ok_devuelve_lo_que_da_el_extractor(client, headers_admin, monkeypatch):
    import app.api.ai as ruta_ia

    monkeypatch.setattr(ruta_ia, "extraer_comprobante", lambda **kwargs: _mock_ok())

    resp = client.post(
        "/ia/extraer-comprobante",
        data={"tipo_entidad": "gasto", "contexto": "{}"},
        files={"archivo": ARCHIVO_PDF_FALSO},
        headers=headers_admin,
    )
    assert resp.status_code == 200
    cuerpo = resp.json()
    assert cuerpo["monto"] == 15000.0
    assert cuerpo["tipo_factura"] == "factura_b"
    assert cuerpo["proveedor_id"] is None  # gasto no pide proveedor


def test_extraccion_le_pasa_los_tipos_de_factura_de_la_base(client, headers_admin, db_session, monkeypatch):
    """Los tipos salen de la tabla (incluido uno que agregó Agus), no de una
    lista fija ni de lo que mande el front en el contexto."""
    import app.api.ai as ruta_ia

    db_session.add(models.InvoiceType(codigo="ticket", nombre="Ticket", orden=99))
    db_session.commit()
    recibido = {}

    def _mock(**kwargs):
        recibido.update(kwargs)
        return _mock_ok()

    monkeypatch.setattr(ruta_ia, "extraer_comprobante", _mock)

    resp = client.post(
        "/ia/extraer-comprobante",
        data={"tipo_entidad": "gasto", "contexto": '{"tipos_factura": [{"codigo": "trucho"}]}'},
        files={"archivo": ARCHIVO_PDF_FALSO},
        headers=headers_admin,
    )
    assert resp.status_code == 200
    codigos = [t["codigo"] for t in recibido["tipos_factura"]]
    assert "factura_interna" in codigos
    assert "ticket" in codigos
    assert "trucho" not in codigos
    assert codigos[-1] == "otros"


def test_extraccion_con_error_de_ia_da_502(client, headers_admin, monkeypatch):
    import app.api.ai as ruta_ia

    def _mock_error(**kwargs):
        raise AIExtractionError("Falta configurar GEMINI_API_KEY en el .env del backend.")

    monkeypatch.setattr(ruta_ia, "extraer_comprobante", _mock_error)

    resp = client.post(
        "/ia/extraer-comprobante",
        data={"tipo_entidad": "gasto", "contexto": "{}"},
        files={"archivo": ARCHIVO_PDF_FALSO},
        headers=headers_admin,
    )
    assert resp.status_code == 502
    assert "GEMINI_API_KEY" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# _validar_y_limpiar: la parte que decide qué confiarle a la IA, sin mock ni
# red -- es la parte más importante de auditar (evita que se guarde un id
# inventado).
# ---------------------------------------------------------------------------


def test_descarta_id_que_no_esta_en_el_catalogo():
    id_real = str(uuid.uuid4())
    contexto = {"categorias_gasto": [{"id": id_real, "nombre": "Flete"}]}
    # Los ids reales son UUID (vienen de la DB) -- acá simulamos que la IA
    # devolvió un UUID válido pero que no es ninguno de la lista.
    datos = {"categoria_gasto_id": str(uuid.uuid4()), "advertencias": []}

    resultado = _validar_y_limpiar(datos, "gasto", contexto)

    assert resultado.categoria_gasto_id is None
    assert any("categoría" in a for a in resultado.advertencias)


def test_acepta_id_que_si_esta_en_el_catalogo():
    id_real = str(uuid.uuid4())
    contexto = {"categorias_gasto": [{"id": id_real, "nombre": "Flete"}]}
    datos = {"categoria_gasto_id": id_real, "advertencias": []}

    resultado = _validar_y_limpiar(datos, "gasto", contexto)

    assert str(resultado.categoria_gasto_id) == id_real


def test_tipo_factura_invalido_se_descarta_con_aviso():
    datos = {"tipo_factura": "ticket_de_supermercado", "advertencias": []}

    resultado = _validar_y_limpiar(datos, "cobro", {})

    assert resultado.tipo_factura is None
    assert any("tipo de factura" in a for a in resultado.advertencias)


def test_compra_no_expone_monto_aunque_la_ia_lo_devuelva():
    """Compra no pide monto (precio_neto se calcula del detalle, ver
    extractor.py) -- si por lo que sea el JSON trae 'monto', se ignora."""
    datos = {"monto": 999, "descripcion": "algo", "advertencias": []}

    resultado = _validar_y_limpiar(datos, "compra", {})

    assert resultado.monto is None


# ---------------------------------------------------------------------------
# detalle de productos (Compra): solo se acepta si el producto pertenece al
# proveedor que la misma extracción resolvió.
# ---------------------------------------------------------------------------


def test_detalle_se_descarta_si_no_hay_proveedor_resuelto():
    id_proveedor = str(uuid.uuid4())
    id_producto = str(uuid.uuid4())
    contexto = {
        "proveedores": [{"id": id_proveedor, "nombre": "CobreSur Materiales"}],
        "productos": [
            {"id": id_producto, "marca": "CobreSur", "modelo": "Gas R410A", "proveedor_id": id_proveedor}
        ],
    }
    # proveedor_id NO viene en los datos -- la IA no lo pudo identificar.
    datos = {"detalle": [{"producto_id": id_producto, "cantidad": 3}], "advertencias": []}

    resultado = _validar_y_limpiar(datos, "compra", contexto)

    assert resultado.detalle == []
    assert any("proveedor" in a for a in resultado.advertencias)


def test_detalle_descarta_producto_de_otro_proveedor():
    id_proveedor_correcto = str(uuid.uuid4())
    id_proveedor_otro = str(uuid.uuid4())
    id_producto_de_otro = str(uuid.uuid4())
    contexto = {
        "proveedores": [{"id": id_proveedor_correcto, "nombre": "CobreSur Materiales"}],
        "productos": [
            {
                "id": id_producto_de_otro,
                "marca": "BGH",
                "modelo": "Split 4500W",
                "proveedor_id": id_proveedor_otro,
            },
        ],
    }
    datos = {
        "proveedor_id": id_proveedor_correcto,
        "detalle": [{"producto_id": id_producto_de_otro, "cantidad": 2}],
        "advertencias": [],
    }

    resultado = _validar_y_limpiar(datos, "compra", contexto)

    assert resultado.detalle == []
    assert any("otro proveedor" in a for a in resultado.advertencias)


def test_detalle_acepta_producto_del_proveedor_correcto():
    id_proveedor = str(uuid.uuid4())
    id_producto = str(uuid.uuid4())
    contexto = {
        "proveedores": [{"id": id_proveedor, "nombre": "CobreSur Materiales"}],
        "productos": [
            {
                "id": id_producto,
                "marca": "CobreSur",
                "modelo": 'Caño de Cobre 3/8" x 15m',
                "proveedor_id": id_proveedor,
            },
        ],
    }
    datos = {
        "proveedor_id": id_proveedor,
        "detalle": [{"producto_id": id_producto, "cantidad": 6}],
        "advertencias": [],
    }

    resultado = _validar_y_limpiar(datos, "compra", contexto)

    assert len(resultado.detalle) == 1
    assert str(resultado.detalle[0].producto_id) == id_producto
    assert resultado.detalle[0].cantidad == 6


def test_gasto_no_expone_detalle():
    """Gasto no tiene detalle de productos -- aunque el JSON lo traiga, se ignora."""
    datos = {"detalle": [{"producto_id": str(uuid.uuid4()), "cantidad": 1}], "advertencias": []}

    resultado = _validar_y_limpiar(datos, "gasto", {})

    assert resultado.detalle == []


TIPOS = [
    {"codigo": "factura_a", "nombre": "Factura A"},
    {"codigo": "factura_interna", "nombre": "Factura interna"},
    {"codigo": "otros", "nombre": "Otros"},
]


def test_tipo_factura_de_la_lista_se_acepta():
    datos = {"tipo_factura": "factura_interna", "advertencias": []}

    resultado = _validar_y_limpiar(datos, "cobro", {}, TIPOS)

    assert resultado.tipo_factura == "factura_interna"
    assert resultado.advertencias == []


def test_tipo_factura_fuera_de_la_lista_se_descarta_aunque_sea_de_fabrica():
    # "remito" existía en la lista fija vieja; si Agus lo borró, ya no vale.
    datos = {"tipo_factura": "remito", "advertencias": []}

    resultado = _validar_y_limpiar(datos, "cobro", {}, TIPOS)

    assert resultado.tipo_factura is None
    assert any("tipo de factura" in a for a in resultado.advertencias)


def test_prompt_lista_codigo_y_nombre_de_cada_tipo():
    prompt = _armar_prompt("cobro", {}, TIPOS)

    assert "factura_interna (Factura interna)" in prompt
    assert "'otros'" in prompt


def test_prompt_sin_otros_pide_null():
    prompt = _armar_prompt("cobro", {}, TIPOS[:2])

    assert "'otros'" not in prompt
    assert "null" in prompt
