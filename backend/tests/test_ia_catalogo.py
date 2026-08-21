"""
Tests de /ia/leer-catalogo.

Mismo patrón que test_ia.py: el endpoint se prueba mockeando `leer_catalogo`
en el namespace de app.routes.ia (sin pegarle a Gemini de verdad). La lógica
de _validar_y_limpiar (matcheo de proveedor, clasificación de productos,
descarte de filas inválidas) se prueba aparte, directo contra las funciones
puras de app.ia.catalogo, sin mock.
"""

import io
import uuid

from app.ia.catalogo import LecturaCatalogoError, _validar_y_limpiar

ARCHIVO_PDF_FALSO = ("catalogo.pdf", io.BytesIO(b"%PDF-1.4 contenido falso"), "application/pdf")


def test_sin_login_da_401(client):
    resp = client.post(
        "/ia/leer-catalogo",
        data={"contexto": "{}"},
        files={"archivo": ARCHIVO_PDF_FALSO},
    )
    assert resp.status_code == 401


def test_usuario_lectura_no_puede(client, headers_lectura):
    resp = client.post(
        "/ia/leer-catalogo",
        data={"contexto": "{}"},
        files={"archivo": ARCHIVO_PDF_FALSO},
        headers=headers_lectura,
    )
    assert resp.status_code == 403


def test_extension_no_permitida(client, headers_admin):
    archivo = ("catalogo.txt", io.BytesIO(b"hola"), "text/plain")
    resp = client.post(
        "/ia/leer-catalogo",
        data={"contexto": "{}"},
        files={"archivo": archivo},
        headers=headers_admin,
    )
    assert resp.status_code == 400
    assert "Extensión" in resp.json()["detail"]


def test_xlsx_es_una_extension_permitida(client, headers_admin, monkeypatch):
    import app.routes.ia as ruta_ia
    from app import schemas

    monkeypatch.setattr(
        ruta_ia,
        "leer_catalogo",
        lambda **kwargs: schemas.IALecturaCatalogo(),
    )
    # Firma real de .xlsx (es un .zip) -- si no, contenido_coincide_con_extension lo rechaza.
    archivo = ("catalogo.xlsx", io.BytesIO(b"PK\x03\x04 contenido falso"), "application/vnd.ms-excel")
    resp = client.post(
        "/ia/leer-catalogo",
        data={"contexto": "{}"},
        files={"archivo": archivo},
        headers=headers_admin,
    )
    assert resp.status_code == 200


def test_csv_no_necesita_firma_binaria(client, headers_admin, monkeypatch):
    import app.routes.ia as ruta_ia
    from app import schemas

    monkeypatch.setattr(
        ruta_ia,
        "leer_catalogo",
        lambda **kwargs: schemas.IALecturaCatalogo(),
    )
    archivo = ("catalogo.csv", io.BytesIO(b"marca,modelo,precio\nBGH,Split,100000"), "text/csv")
    resp = client.post(
        "/ia/leer-catalogo",
        data={"contexto": "{}"},
        files={"archivo": archivo},
        headers=headers_admin,
    )
    assert resp.status_code == 200


def test_archivo_supera_tamanio_maximo(client, headers_admin, monkeypatch):
    import app.routes.ia as ruta_ia

    monkeypatch.setattr(ruta_ia, "TAMANIO_MAXIMO_BYTES", 10)
    archivo = ("catalogo.pdf", io.BytesIO(b"contenido mas largo que 10 bytes"), "application/pdf")
    resp = client.post(
        "/ia/leer-catalogo",
        data={"contexto": "{}"},
        files={"archivo": archivo},
        headers=headers_admin,
    )
    assert resp.status_code == 400
    assert "10MB" in resp.json()["detail"]


def test_lectura_con_error_de_ia_da_502(client, headers_admin, monkeypatch):
    import app.routes.ia as ruta_ia

    def _mock_error(**kwargs):
        raise LecturaCatalogoError("Falta configurar GEMINI_API_KEY en el .env del backend.")

    monkeypatch.setattr(ruta_ia, "leer_catalogo", _mock_error)

    resp = client.post(
        "/ia/leer-catalogo",
        data={"contexto": "{}"},
        files={"archivo": ARCHIVO_PDF_FALSO},
        headers=headers_admin,
    )
    assert resp.status_code == 502
    assert "GEMINI_API_KEY" in resp.json()["detail"]


def test_proveedor_id_evita_resolver_proveedor(client, headers_admin, monkeypatch):
    import app.routes.ia as ruta_ia

    capturado = {}

    def _mock(**kwargs):
        capturado.update(kwargs)
        from app import schemas

        return schemas.IALecturaCatalogo()

    monkeypatch.setattr(ruta_ia, "leer_catalogo", _mock)

    proveedor_id = str(uuid.uuid4())
    resp = client.post(
        "/ia/leer-catalogo",
        data={"proveedor_id": proveedor_id, "contexto": "{}"},
        files={"archivo": ARCHIVO_PDF_FALSO},
        headers=headers_admin,
    )
    assert resp.status_code == 200
    assert capturado["proveedor_id"] == proveedor_id


# ---------------------------------------------------------------------------
# _validar_y_limpiar: matcheo de proveedor + clasificación de productos, sin
# mock ni red -- la parte más importante de auditar (evita que se cree un
# proveedor o producto a partir de basura inventada).
# ---------------------------------------------------------------------------


def test_proveedor_matchea_por_nombre_normalizado():
    id_proveedor = str(uuid.uuid4())
    contexto = {"proveedores": [{"id": id_proveedor, "nombre": "Griferias S.A.", "cuit": "20111111112"}]}
    datos = {"proveedor": {"nombre": "  griferias sa  "}, "productos": [], "advertencias": []}

    resultado = _validar_y_limpiar(datos, None, contexto)

    assert resultado.proveedor_sugerido.tipo == "existente"
    assert str(resultado.proveedor_sugerido.id) == id_proveedor


def test_proveedor_matchea_por_cuit():
    id_proveedor = str(uuid.uuid4())
    contexto = {"proveedores": [{"id": id_proveedor, "nombre": "Griferías S.A.", "cuit": "20-11111111-2"}]}
    datos = {
        "proveedor": {"nombre": "otro nombre", "cuit": "20111111112"},
        "productos": [],
        "advertencias": [],
    }

    resultado = _validar_y_limpiar(datos, None, contexto)

    assert resultado.proveedor_sugerido.tipo == "existente"
    assert str(resultado.proveedor_sugerido.id) == id_proveedor


def test_proveedor_sin_match_se_ofrece_como_nuevo():
    contexto = {"proveedores": [{"id": str(uuid.uuid4()), "nombre": "Otro Proveedor", "cuit": "1"}]}
    datos = {
        "proveedor": {
            "nombre": "Proveedor Nuevo SRL",
            "cuit": "30555555553",
            "telefono": None,
            "email": None,
        },
        "productos": [],
        "advertencias": [],
    }

    resultado = _validar_y_limpiar(datos, None, contexto)

    assert resultado.proveedor_sugerido.tipo == "nuevo"
    assert resultado.proveedor_sugerido.nombre == "Proveedor Nuevo SRL"
    assert resultado.proveedor_sugerido.id is None


def test_proveedor_id_fijo_no_devuelve_proveedor_sugerido():
    datos = {"proveedor": {"nombre": "Lo que sea"}, "productos": [], "advertencias": []}

    resultado = _validar_y_limpiar(datos, str(uuid.uuid4()), {})

    assert resultado.proveedor_sugerido is None


def test_producto_sin_match_es_nuevo():
    datos = {
        "productos": [{"marca": "BGH", "modelo": "Split 3000W", "tipo": "equipo", "precio": 500000}],
        "advertencias": [],
    }

    resultado = _validar_y_limpiar(datos, str(uuid.uuid4()), {"productos": []})

    assert len(resultado.productos) == 1
    producto = resultado.productos[0]
    assert producto.estado == "nuevo"
    assert producto.producto_id is None
    assert producto.precio == 500000


def test_producto_matchea_y_precio_distinto_es_actualizacion():
    id_producto = str(uuid.uuid4())
    contexto = {
        "productos": [
            {"id": id_producto, "marca": "BGH", "modelo": "Split 3000W", "tipo": "equipo", "precio": 450000}
        ]
    }
    datos = {
        "productos": [{"marca": "bgh", "modelo": "split 3000w", "tipo": "equipo", "precio": 500000}],
        "advertencias": [],
    }

    resultado = _validar_y_limpiar(datos, str(uuid.uuid4()), contexto)

    producto = resultado.productos[0]
    assert producto.estado == "actualiza_precio"
    assert str(producto.producto_id) == id_producto
    assert producto.precio_actual == 450000
    assert producto.precio == 500000


def test_producto_matchea_y_precio_igual_es_sin_cambios():
    id_producto = str(uuid.uuid4())
    contexto = {
        "productos": [
            {"id": id_producto, "marca": "BGH", "modelo": "Split 3000W", "tipo": "equipo", "precio": 450000}
        ]
    }
    datos = {
        "productos": [{"marca": "BGH", "modelo": "Split 3000W", "tipo": "equipo", "precio": 450000}],
        "advertencias": [],
    }

    resultado = _validar_y_limpiar(datos, str(uuid.uuid4()), contexto)

    producto = resultado.productos[0]
    assert producto.estado == "sin_cambios"
    assert str(producto.producto_id) == id_producto


def test_producto_con_tipo_invalido_queda_none_con_aviso():
    datos = {
        "productos": [{"marca": "BGH", "modelo": "Split 3000W", "tipo": "electrodomestico", "precio": 500}],
        "advertencias": [],
    }

    resultado = _validar_y_limpiar(datos, str(uuid.uuid4()), {})

    assert resultado.productos[0].tipo is None
    assert any("tipo" in a for a in resultado.advertencias)


def test_producto_con_precio_no_numerico_se_descarta():
    datos = {
        "productos": [{"marca": "BGH", "modelo": "Split 3000W", "tipo": "equipo", "precio": "consultar"}],
        "advertencias": [],
    }

    resultado = _validar_y_limpiar(datos, str(uuid.uuid4()), {})

    assert resultado.productos == []
    assert any("precio" in a for a in resultado.advertencias)


def test_producto_con_precio_cero_o_negativo_se_descarta():
    datos = {
        "productos": [{"marca": "BGH", "modelo": "Split 3000W", "tipo": "equipo", "precio": 0}],
        "advertencias": [],
    }

    resultado = _validar_y_limpiar(datos, str(uuid.uuid4()), {})

    assert resultado.productos == []


def test_producto_sin_marca_o_modelo_se_descarta():
    datos = {
        "productos": [
            {"marca": "", "modelo": "Split 3000W", "tipo": "equipo", "precio": 500},
            {"marca": "BGH", "modelo": None, "tipo": "equipo", "precio": 500},
        ],
        "advertencias": [],
    }

    resultado = _validar_y_limpiar(datos, str(uuid.uuid4()), {})

    assert resultado.productos == []


# ---------------------------------------------------------------------------
# categoria_ids: solo se sugiere para productos "nuevo", y solo se acepta si
# la categoría existe en el catálogo Y su tipo coincide con el tipo resuelto
# de esa línea -- mismo criterio de "nunca inventar" que el resto del archivo.
# ---------------------------------------------------------------------------


def test_categoria_sugerida_del_mismo_tipo_se_conserva():
    id_categoria = str(uuid.uuid4())
    contexto = {"categorias": [{"id": id_categoria, "nombre": "Aire acondicionado", "tipo": "equipo"}]}
    datos = {
        "productos": [
            {
                "marca": "BGH",
                "modelo": "Split 3000W",
                "tipo": "equipo",
                "precio": 500000,
                "categoria_ids": [id_categoria],
            }
        ],
        "advertencias": [],
    }

    resultado = _validar_y_limpiar(datos, str(uuid.uuid4()), contexto)

    assert [str(c) for c in resultado.productos[0].categoria_ids] == [id_categoria]


def test_categoria_de_otro_tipo_se_descarta_con_aviso():
    id_categoria = str(uuid.uuid4())
    contexto = {"categorias": [{"id": id_categoria, "nombre": "Cables", "tipo": "materiales"}]}
    datos = {
        "productos": [
            {
                "marca": "BGH",
                "modelo": "Split 3000W",
                "tipo": "equipo",
                "precio": 500000,
                "categoria_ids": [id_categoria],
            }
        ],
        "advertencias": [],
    }

    resultado = _validar_y_limpiar(datos, str(uuid.uuid4()), contexto)

    assert resultado.productos[0].categoria_ids == []
    assert any("categoría" in a for a in resultado.advertencias)


def test_categoria_con_id_inexistente_se_descarta_con_aviso():
    contexto = {"categorias": [{"id": str(uuid.uuid4()), "nombre": "Aire acondicionado", "tipo": "equipo"}]}
    datos = {
        "productos": [
            {
                "marca": "BGH",
                "modelo": "Split 3000W",
                "tipo": "equipo",
                "precio": 500000,
                "categoria_ids": [str(uuid.uuid4())],
            }
        ],
        "advertencias": [],
    }

    resultado = _validar_y_limpiar(datos, str(uuid.uuid4()), contexto)

    assert resultado.productos[0].categoria_ids == []
    assert any("categoría" in a for a in resultado.advertencias)


def test_producto_sin_tipo_resuelto_nunca_lleva_categoria_ids():
    id_categoria = str(uuid.uuid4())
    contexto = {"categorias": [{"id": id_categoria, "nombre": "Aire acondicionado", "tipo": "equipo"}]}
    datos = {
        "productos": [
            {
                "marca": "BGH",
                "modelo": "Split 3000W",
                "tipo": "electrodomestico",
                "precio": 500000,
                "categoria_ids": [id_categoria],
            }
        ],
        "advertencias": [],
    }

    resultado = _validar_y_limpiar(datos, str(uuid.uuid4()), contexto)

    assert resultado.productos[0].tipo is None
    assert resultado.productos[0].categoria_ids == []


def test_categoria_no_se_sugiere_para_producto_que_ya_existe():
    """actualiza_precio/sin_cambios ya tienen categoría de antes -- no se
    toca desde acá aunque la IA haya sugerido algo."""
    id_producto = str(uuid.uuid4())
    id_categoria = str(uuid.uuid4())
    contexto = {
        "productos": [
            {"id": id_producto, "marca": "BGH", "modelo": "Split 3000W", "tipo": "equipo", "precio": 500000}
        ],
        "categorias": [{"id": id_categoria, "nombre": "Aire acondicionado", "tipo": "equipo"}],
    }
    datos = {
        "productos": [
            {
                "marca": "BGH",
                "modelo": "Split 3000W",
                "tipo": "equipo",
                "precio": 500000,
                "categoria_ids": [id_categoria],
            }
        ],
        "advertencias": [],
    }

    resultado = _validar_y_limpiar(datos, str(uuid.uuid4()), contexto)

    assert resultado.productos[0].estado == "sin_cambios"
    assert resultado.productos[0].categoria_ids == []
