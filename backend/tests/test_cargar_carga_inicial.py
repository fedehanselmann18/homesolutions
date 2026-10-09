"""Parseo de las respuestas del form de carga inicial (scripts/cargar_carga_inicial.py).

Sólo la parte pura (CSV -> plan); la carga por API se probó a mano contra un
backend local, y usa los mismos endpoints que ya cubren los tests de cada ruta.
"""

from scripts.cargar_carga_inicial import armar_plan, diferencias_con_codigo, separar_opciones


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
