"""Parseo de las respuestas del form de carga inicial (scripts/cargar_carga_inicial.py).

La parte pura (CSV -> plan) y aplicar() contra una API falsa. La carga real
se probó a mano contra un backend local, y usa los mismos endpoints que ya
cubren los tests de cada ruta.
"""

from scripts.cargar_carga_inicial import (
    aplicar,
    armar_plan,
    datos_impuesto,
    diferencias_con_codigo,
    separar_opciones,
)


def _respuesta(**extra):
    base = {
        "Marca temporal": "8/10/2026 18:30:00",
        "Cuando cargás una compra, los impuestos pueden ser:": "IVA, Tasa municipal",
        "Cuando cargás un gasto, las categorías pueden ser:": "Flete, Peajes",
        "Cuando cargás un producto de tipo equipo, las categorías pueden ser:": "Heladeras, Electrodoméstico",
        "Cuando cargás un producto de tipo material, las categorías pueden ser:": "Caños de Cobre",
        "Cuando cargás mano de obra, las categorías pueden ser:": "Instalación Eléctrica, Electricista",
        "Observaciones sobre gastos": "  ",
    }
    base.update(extra)
    return base


def test_separar_opciones_limpia_espacios_y_repetidos():
    assert separar_opciones(" IVA,  Percepción  de IVA, iva ,, ") == ["IVA", "Percepción de IVA"]


def test_plan_basico_incluye_lo_agregado_con_otro():
    plan = armar_plan(_respuesta())
    assert plan["impuestos"] == ["IVA", "Tasa municipal"]
    assert plan["categorias_gasto"] == ["Flete", "Peajes"]
    assert ("Electrodoméstico", "equipo") in plan["categorias"]
    assert plan["observaciones"] == {}


def test_eleccion_saca_electrodomestico_y_oficios():
    plan = armar_plan(
        _respuesta(
            **{
                '¿"Electrodoméstico" te sirve como categoría general?': "No, sacala: uso siempre los específicos",
                "Hay tres pares que se pisan: ¿Cómo lo querés?": "Por rubro del trabajo y sacamos los oficios",
            }
        )
    )
    assert ("Electrodoméstico", "equipo") not in plan["categorias"]
    assert ("Electricista", "mano_obra") not in plan["categorias"]
    assert ("Instalación Eléctrica", "mano_obra") in plan["categorias"]


def test_mismo_nombre_en_dos_tipos_queda_como_conflicto():
    plan = armar_plan(
        _respuesta(**{"Cuando cargás un producto de tipo material, las categorías pueden ser:": "heladeras"})
    )
    assert [n for n, _ in plan["categorias"]].count("Heladeras") == 1
    assert plan["conflictos"] == [("heladeras", "equipo", "materiales")]


def test_diferencias_con_codigo():
    nuevos, destildados = diferencias_con_codigo(["Factura A", "Ticket"], ["Factura A", "Remito"])
    assert nuevos == ["Ticket"]
    assert destildados == ["Remito"]


def test_plan_incluye_tipos_de_comprobante():
    plan = armar_plan(
        _respuesta(**{"El tipo de comprobante puede ser:": "Factura A, Factura interna, Ticket"})
    )
    assert plan["tipos_factura"] == ["Factura A", "Factura interna", "Ticket"]


class _ApiFalsa:
    """Lo mínimo de Api para probar aplicar() sin red: guarda lo creado y lo
    devuelve al listar, así una segunda corrida ve lo de la primera."""

    def __init__(self, existentes=None):
        self.datos = {ruta: list(items) for ruta, items in (existentes or {}).items()}
        self.creados = []

    def listar(self, ruta):
        return self.datos.get(ruta, [])

    def crear(self, ruta, cuerpo):
        self.creados.append((ruta, cuerpo))
        self.datos.setdefault(ruta.replace("crear", ""), []).append(cuerpo)
        return 201, None


def test_aplicar_carga_tipos_de_comprobante_sin_duplicar():
    plan = armar_plan(
        _respuesta(**{"El tipo de comprobante puede ser:": "factura a, Factura interna, Ticket"})
    )
    api = _ApiFalsa({"/tipos-factura/": [{"nombre": "Factura A"}, {"nombre": "Factura interna"}]})

    assert aplicar(api, plan) == 0
    tipos_creados = [c["nombre"] for r, c in api.creados if r == "/tipos-factura/crear"]
    assert tipos_creados == ["Ticket"]

    # Segunda corrida: ya está todo, no crea nada.
    api.creados.clear()
    assert aplicar(api, plan) == 0
    assert api.creados == []


def test_separar_opciones_no_parte_la_coma_decimal():
    assert separar_opciones("IVA 21%, IVA 10,5%, Percepción IIBB 3,5") == [
        "IVA 21%",
        "IVA 10,5%",
        "Percepción IIBB 3,5",
    ]


def test_datos_impuesto_reconoce_las_alicuotas_de_iva():
    assert datos_impuesto("IVA 21%") == {"nombre": "IVA 21%", "alicuota": 21.0, "grupo": "IVA"}
    assert datos_impuesto("I.V.A. 10,5") == {"nombre": "I.V.A. 10,5", "alicuota": 10.5, "grupo": "IVA"}
    # Sin número o con otro nombre: se carga a mano.
    assert datos_impuesto("IVA") == {"nombre": "IVA"}
    assert datos_impuesto("Percepción de IVA 3%") == {"nombre": "Percepción de IVA 3%"}


def test_aplicar_crea_el_iva_con_alicuota_y_grupo():
    plan = armar_plan(
        _respuesta(**{"Cuando cargás una compra, los impuestos pueden ser:": "IVA 21%, IVA 10,5%"})
    )
    api = _ApiFalsa()

    assert aplicar(api, plan) == 0
    impuestos = [c for r, c in api.creados if r == "/impuestos/crear"]
    assert impuestos == [
        {"nombre": "IVA 21%", "alicuota": 21.0, "grupo": "IVA"},
        {"nombre": "IVA 10,5%", "alicuota": 10.5, "grupo": "IVA"},
    ]
