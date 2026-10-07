"""
Importa la obra REAL "Terravista" desde la planilla de control de Agus
(control_INGRESOS_Y_EGRESO_260930V02_TERRAVISTA.xlsx, corte al 30/09/2026).

No es una demo: los importes, fechas, proveedores y números de factura son
los de la planilla. Sirve para ver cómo se comporta la app con una obra de
verdad, que es más sucia que los datos inventados de `seed_demo`.

Cómo se mapeó la planilla (cada fila tiene una columna Categoría, Tipo,
Ingreso/Egreso en USD, tc y $ en pesos):

  - Las 3 filas "Ingreso" reales      -> Cobros del proyecto (en USD).
  - Las filas "Egreso" con proveedor  -> Compras (en pesos, con el tc de SU
    fila como cotización congelada).
  - Honorarios, fletes y varios       -> Gastos (no hay producto ni factura
    de proveedor detrás).
  - Las 2 filas "Ingreso" con importe NEGATIVO -> Notas de crédito sobre la
    compra que corrigen (ver NOTAS_CREDITO).
  - Las 8 categorías de la planilla   -> las 8 fases del proyecto.

Decisiones que la planilla NO define y hubo que tomar (acordadas con Fede):

  - PRECIO ACORDADO: la planilla no lo trae. Se usa US$ 87.300, que es el
    total cobrado -> la obra queda 100% cobrada y sin saldo por cobrar.
  - RETIROS: las 4 filas de GANANCIA / OTRAS OBRAS (retiros de Ale y Agus,
    plata a otras obras, Leandro) se cargan como gastos SIN fase, para que
    el total gastado cierre con el de la planilla. No son costo de Terravista:
    inflan el costo de la obra en US$ 10.700.
  - COTIZACIÓN de las filas sin tc (los 2 anticipos y los 4 retiros): se usa
    COTIZACIONES_SIN_TC, estimada a partir de los tc que sí trae la planilla
    para fechas cercanas.
  - ESTADO de compras: todas quedan pagadas y entregadas. La planilla es un
    registro de plata que YA salió, no tiene nada pendiente.
  - COMPROBANTES: no se generan archivos. El N° de factura va en la
    descripción. Por eso todo aparece como "sin comprobante" en Seguimiento,
    que es la situación real: los comprobantes todavía no están subidos.
    La única excepción son las notas de crédito, donde el modelo exige un
    archivo (archivo_path es NOT NULL): ahí se escribe un PDF placeholder.

Lo que NO se carga: 4 filas de la planilla tienen descripción y categoría
pero ningún importe (PLACAS CLIMAVER, CINTAS FASON, FLEIXIBLE, CINTAS S ASIL
NEGRAS). Son materiales previstos todavía sin cargar, y una compra sin
importe no es representable. Se listan al final de la corrida.

Idempotente: si el proyecto ya existe lo borra entero y lo vuelve a crear.
No toca ningún otro proyecto.

Uso: desde backend/, con el venv activado:
    python -m scripts.seed_terravista
"""

import uuid
from datetime import date, datetime, time, timezone
from decimal import Decimal

from sqlalchemy import update

from app.db.db import SessionLocal
from app.db import models
from app.files.storage import BASE_UPLOAD_DIR, eliminar_comprobante, ruta_absoluta
from app.tipo_cambio import a_ars, a_usd
# El PDF placeholder de las notas de crédito usa el mismo generador que el
# seed de demo, para no tener dos armadores de PDF en el repo.
from scripts.seed_demo import _pdf_comprobante

NOMBRE_PROYECTO = "Terravista"
DIRECCION = "Terravista"
FECHA_INICIO = date(2026, 3, 26)
PRECIO_ACORDADO_USD = Decimal("87300")
TIPO_CAMBIO = "blue"

# Para las filas que no traen tc (los 2 anticipos y los 4 retiros).
# Estimadas con los tc que la planilla sí trae alrededor de esas fechas.
COTIZACIONES_SIN_TC = {
    date(2026, 3, 26): Decimal("1370"),
    date(2026, 6, 2): Decimal("1410"),
    date(2026, 9, 30): Decimal("1540"),
}

# (nombre, descripción, estado) -- el orden es el de la obra.
FASES = [
    ("Planos", "Documentación y planos de obra", "auditada"),
    ("VRF - Equipos", "Equipos VRF, cable y cañería de los equipos", "en_curso"),
    ("Cañería VRF", "Cañería de cobre, codos y cuplas, y su mano de obra", "en_curso"),
    ("Placas VRF", "Placas y cajas del sistema VRF", "en_curso"),
    ("Conductos", "Conductos, fleje y mano de obra de conductos", "en_curso"),
    ("Calefacción", "Calderas y mano de obra de calefacción", "terminada"),
    ("Logística", "Fletes de equipos y placas", "en_curso"),
    ("Varios", "Planos, carpetas y gastos generales de obra", "en_curso"),
]

PROVEEDORES = ["NS", "PILISAR", "FACU", "POLYTEMP", "CARLOS", "DIEGO", "ANSAL", "PROVEE DIEGO"]

# Categorías de gasto que esta obra necesita y el catálogo base no trae.
CATEGORIAS_GASTO_EXTRA = ["Honorarios", "Retiro de socios"]

# (monto_usd, descripción, fecha, tipo_factura)
COBROS = [
    (Decimal("30000"), "Anticipo", date(2026, 3, 26), "otros"),
    (Decimal("42100"), "Anticipo", date(2026, 6, 2), "otros"),
    (Decimal("15200"), "Certificado de avance", date(2026, 9, 30), "factura_a"),
]

# (clave, fase, proveedor, descripción, fecha, monto_ars, tc, tipo_factura)
# `clave` es solo para que las notas de crédito puedan referenciar su compra.
COMPRAS = [
    ("ns-branc",   "VRF - Equipos", "NS",      "Equipos branc 3321 (3) 7121 (3) arcnn21 · FC 659935", date(2026, 4, 2),  Decimal("985788.06"),   Decimal("1395"), "factura_a"),
    ("ns-arnu09",  "VRF - Equipos", "NS",      "Equipos ARNU09JS + ARNU09GM · FC 659889",             date(2026, 4, 1),  Decimal("1394032.54"),  Decimal("1385"), "factura_a"),
    ("ns-14521",   "VRF - Equipos", "NS",      "Equipos 14521 (5) · FC 659858",                       date(2026, 4, 1),  Decimal("1311563.50"),  Decimal("1385"), "factura_a"),
    ("ns-arnu48",  "VRF - Equipos", "NS",      "Equipos ARNU48 (4) + PREMBT101 (10) · FC 660015",     date(2026, 4, 4),  Decimal("7576476.00"),  Decimal("1385"), "factura_a"),
    ("ns-arun221", "VRF - Equipos", "NS",      "Equipo ARUN221 · FC 661683",                          date(2026, 4, 16), Decimal("9400166.00"),  Decimal("1385"), "factura_a"),
    ("ns-arnu24",  "VRF - Equipos", "NS",      "Equipos ARNU24 (2) · FC 680001",                      date(2026, 8, 10), Decimal("1786555.19"),  Decimal("1505"), "factura_a"),
    ("pilisar",    "VRF - Equipos", "PILISAR", "Equipos ARUN181 + ARUN121 + ARNU15 + ARNU36 (2) · FC 256094", date(2026, 4, 4), Decimal("19045497.00"), Decimal("1385"), "factura_a"),
    ("facu-mo",    "Calefacción",   "FACU",    "Mano de obra calefacción · FC 1348",                  date(2026, 6, 1),  Decimal("11325664.38"), Decimal("1410"), "factura_a"),
    ("facu-eq",    "Calefacción",   "FACU",    "Equipos calderas · FC 1324",                          date(2026, 5, 7),  Decimal("7652000.00"),  Decimal("1380"), "factura_a"),
    ("facu-saldo", "Calefacción",   "FACU",    "Saldo FACU (pago en efectivo)",                       date(2026, 6, 11), Decimal("11230000.00"), Decimal("1430"), "recibo"),
    ("poly-cobre1","VRF - Equipos", "POLYTEMP","Cañería de cobre · FC 34298",                         date(2026, 6, 8),  Decimal("12792564.77"), Decimal("1505"), "factura_a"),
    ("carlos-ant", "Cañería VRF",   "CARLOS",  "Anticipo mano de obra Carlos",                        date(2026, 8, 31), Decimal("850000.00"),   Decimal("1540"), "recibo"),
    ("diego-ant",  "Conductos",     "DIEGO",   "Anticipo mano de obra Diego",                         date(2026, 8, 18), Decimal("262498.00"),   Decimal("1535"), "recibo"),
    ("diego-av1",  "Conductos",     "DIEGO",   "Avance Diego (transferencia)",                        date(2026, 9, 19), Decimal("300000.00"),   Decimal("1530"), "recibo"),
    ("poly-cobre2","Cañería VRF",   "POLYTEMP","Cañería de cobre · FC 36792",                         date(2026, 9, 3),  Decimal("2385963.41"),  Decimal("1520"), "factura_a"),
    ("poly-fleje", "Conductos",     "POLYTEMP","Fleje perforado · FC 37363",                          date(2026, 9, 21), Decimal("42270.00"),    Decimal("1520"), "factura_a"),
    ("poly-codos", "Cañería VRF",   "POLYTEMP","Codos y cuplas · FC 36866",                           date(2026, 9, 4),  Decimal("669937.00"),   Decimal("1520"), "factura_a"),
    ("ansal",      "VRF - Equipos", "ANSAL",   "Cable mallado + cañería 1 1/8",                       date(2026, 9, 8),  Decimal("1462940.94"),  Decimal("1525"), "factura_a"),
    ("diego-av2",  "Conductos",     "DIEGO",   "Avance Diego",                                        date(2026, 9, 25), Decimal("500000.00"),   Decimal("1535"), "recibo"),
    ("carlos-av1", "VRF - Equipos", "CARLOS",  "Avance Carlos",                                       date(2026, 9, 25), Decimal("500000.00"),   Decimal("1535"), "recibo"),
    ("diego-av3",  "Conductos",     "DIEGO",   "Avance Diego",                                        date(2026, 9, 30), Decimal("1540000.00"),  Decimal("1540"), "recibo"),
    ("carlos-av2", "VRF - Equipos", "CARLOS",  "Avance Carlos",                                       date(2026, 9, 30), Decimal("3850000.00"),  Decimal("1540"), "recibo"),
    ("caja-diego", "Placas VRF",    "PROVEE DIEGO", "Caja",                                           date(2026, 9, 30), Decimal("490000.00"),   Decimal("1540"), "recibo"),
]

# (clave_compra, descripción, fecha, monto_ars, tc, tipo_factura)
# Las 2 filas "Ingreso" con importe negativo de la planilla. A qué compra va
# cada una no lo dice la planilla; se dedujo así:
#   - "NC mal facturacion NS ARNU221" -> la compra del ARUN221 (la nombra).
#   - "PLACAS DE HAEDO" (POLYTEMP) -> la compra de POLYTEMP del MISMO día y
#     con el MISMO tc (08/06, 1505). Es la única candidata.
NOTAS_CREDITO = [
    ("ns-arun221",  "NC mal facturación NS ARNU221 · FC 661015", date(2026, 6, 14), Decimal("9538076.35"), Decimal("1440"), "factura_a"),
    ("poly-cobre1", "NC placas de Haedo",                         date(2026, 6, 8),  Decimal("1506122.02"), Decimal("1505"), "factura_a"),
]

# (fase | None, descripción, fecha, monto_ars, tc, tipo_factura, [categorías])
GASTOS = [
    ("Planos",    "Arq. Karina - anticipo 50%",        date(2026, 4, 16), Decimal("612000.00"),  Decimal("1330"), "recibo", ["Honorarios"]),
    ("Logística", "Fletes envío de equipos (SGA)",     date(2026, 7, 16), Decimal("280000.00"),  Decimal("1480"), "recibo", ["Flete"]),
    ("Logística", "Fletes envío de placas (Esteban)",  date(2026, 9, 15), Decimal("160000.00"),  Decimal("1535"), "recibo", ["Flete"]),
    ("Varios",    "Planos + carpetas",                 date(2026, 7, 1),  Decimal("80000.00"),   Decimal("1503"), "recibo", ["Otros"]),
    # Los 4 retiros: no son costo de la obra (ver docstring).
    (None, "Retiro Ale",                   date(2026, 9, 30), Decimal("3080000.00"), Decimal("1540"), "otros", ["Retiro de socios"]),
    (None, "Retiro Agus",                  date(2026, 9, 30), Decimal("3080000.00"), Decimal("1540"), "otros", ["Retiro de socios"]),
    (None, "Retiro $ para otras obras",    date(2026, 9, 30), Decimal("8778000.00"), Decimal("1540"), "otros", ["Otros"]),
    (None, "Leandro - otras obras",        date(2026, 9, 30), Decimal("1540000.00"), Decimal("1540"), "otros", ["Otros"]),
]

# Filas de la planilla sin importe: se informan, no se cargan.
SIN_IMPORTE = [
    "PLACAS CLIMAVER (Conductos)",
    "CINTAS FASON (Conductos)",
    "FLEIXIBLE (Conductos)",
    "CINTAS S ASIL NEGRAS (VRF)",
]

# Totales de la hoja "Resumen" de la planilla, para controlar la importación.
TOTAL_INGRESOS_PLANILLA = Decimal("87300")
TOTAL_EGRESOS_PLANILLA = Decimal("72036.97")

# La fila "CAJA" (PROVEE DIEGO, 30/09) se contradice a sí misma en la planilla:
# la columna USD dice 300 pero 490.000 pesos al tc 1540 de esa misma fila dan
# 318,18. Se importan los PESOS, que es la columna que la app toma como fuente
# (el USD lo calcula el backend). Por eso el total de egresos importado da
# US$ 18,18 más que el de la planilla.
DIFERENCIA_FILA_CAJA = Decimal("18.18")


def _buscar_o_crear_proveedor(db, nombre: str):
    proveedor = db.query(models.Proveedor).filter(models.Proveedor.nombre == nombre).first()
    if not proveedor:
        proveedor = models.Proveedor(nombre=nombre)
        db.add(proveedor)
        db.flush()
    return proveedor


def _buscar_o_crear_categoria_gasto(db, nombre: str):
    categoria = (
        db.query(models.CategoriaGasto).filter(models.CategoriaGasto.nombre == nombre).first()
    )
    if not categoria:
        categoria = models.CategoriaGasto(nombre=nombre)
        db.add(categoria)
        db.flush()
    return categoria


def _borrar_proyecto_existente(db) -> bool:
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.nombre == NOMBRE_PROYECTO).first()
    if not proyecto:
        return False

    paths = []
    for fase in proyecto.fases:
        for compra in fase.compras:
            paths += [c.archivo_path for c in compra.comprobantes]
            paths += [n.archivo_path for n in compra.notas]
    for gasto in proyecto.gastos:
        paths += [c.archivo_path for c in gasto.comprobantes]
    for cobro in proyecto.cobros:
        paths += [c.archivo_path for c in cobro.comprobantes]

    db.delete(proyecto)
    db.flush()
    for path in paths:
        try:
            eliminar_comprobante(path)
        except Exception:  # el archivo puede no estar; no frena el re-seed
            pass
    return True


def main():
    db = SessionLocal()
    try:
        usuario = db.query(models.Usuario).filter(models.Usuario.rol == "admin").first()
        if not usuario:
            raise SystemExit("No hay ningún usuario admin en la base: creá uno antes de importar.")

        recreado = _borrar_proyecto_existente(db)

        proveedores = {n: _buscar_o_crear_proveedor(db, n) for n in PROVEEDORES}
        for nombre in CATEGORIAS_GASTO_EXTRA:
            _buscar_o_crear_categoria_gasto(db, nombre)

        proyecto = models.Proyecto(
            nombre=NOMBRE_PROYECTO,
            direccion=DIRECCION,
            fecha_inicio=FECHA_INICIO,
            estado="en_curso",
            precio_acordado_usd=PRECIO_ACORDADO_USD,
            cotizacion_acordada=COTIZACIONES_SIN_TC[FECHA_INICIO],
            tipo_cambio_acordado=TIPO_CAMBIO,
        )
        db.add(proyecto)
        db.flush()

        fases = {}
        for orden, (nombre, descripcion, estado) in enumerate(FASES, start=1):
            fase = models.Fase(
                proyecto_id=proyecto.id,
                nombre=nombre,
                descripcion=descripcion,
                estado=estado,
                orden=orden,
            )
            db.add(fase)
            db.flush()
            fases[nombre] = fase

        cobrado_usd = Decimal("0")
        for monto_usd, descripcion, fecha, tipo_factura in COBROS:
            cotizacion = COTIZACIONES_SIN_TC[fecha]
            db.add(models.Cobro(
                proyecto_id=proyecto.id,
                usuario_id=usuario.id,
                monto_usd=monto_usd,
                monto_ars=a_ars(monto_usd, cotizacion),
                cotizacion_dolar=cotizacion,
                tipo_cambio=TIPO_CAMBIO,
                descripcion=descripcion,
                fecha=fecha,
                tipo_factura=tipo_factura,
            ))
            cobrado_usd += monto_usd

        ultima_actividad: dict[str, date] = {}
        compras_por_clave = {}
        egresado_usd = Decimal("0")

        for clave, fase_nombre, proveedor_nombre, descripcion, fecha, monto_ars, tc, tipo_factura in COMPRAS:
            compra = models.Compra(
                fase_id=fases[fase_nombre].id,
                proveedor_id=proveedores[proveedor_nombre].id,
                usuario_id=usuario.id,
                descripcion=descripcion,
                precio_neto_ars=monto_ars,
                precio_neto_usd=a_usd(monto_ars, tc),
                cotizacion_dolar=tc,
                tipo_cambio=TIPO_CAMBIO,
                tipo_factura=tipo_factura,
                fecha=fecha,
                condicion_pago="transferencia",
                # La planilla registra plata que YA salió (ver docstring).
                estado_pago="pagado",
                estado_envio="entregado",
            )
            db.add(compra)
            db.flush()
            compras_por_clave[clave] = compra
            egresado_usd += a_usd(monto_ars, tc)
            ultima_actividad[fase_nombre] = max(ultima_actividad.get(fase_nombre, fecha), fecha)

        for clave_compra, descripcion, fecha, monto_ars, tc, tipo_factura in NOTAS_CREDITO:
            compra = compras_por_clave[clave_compra]
            nota_id = uuid.uuid4()
            ruta = BASE_UPLOAD_DIR / "notas_compra" / str(nota_id) / f"{uuid.uuid4()}.pdf"
            destino = ruta_absoluta(ruta)
            destino.parent.mkdir(parents=True, exist_ok=True)
            destino.write_bytes(_pdf_comprobante([
                "Nota de credito - importada de la planilla de Terravista",
                descripcion,
                f"Fecha: {fecha}",
                f"Monto: $ {monto_ars:,.2f} (tc {tc})",
                "El comprobante real todavia no esta subido.",
            ]))
            db.add(models.NotaCompra(
                id=nota_id,
                compra_id=compra.id,
                proveedor_id=compra.proveedor_id,
                usuario_id=usuario.id,
                tipo="nota_credito",
                origen="otro",
                tipo_factura=tipo_factura,
                monto_ars=monto_ars,
                monto_usd=a_usd(monto_ars, tc),
                cotizacion_dolar=tc,
                tipo_cambio=TIPO_CAMBIO,
                descripcion=descripcion,
                fecha=fecha,
                archivo_path=str(ruta),
            ))
            egresado_usd -= a_usd(monto_ars, tc)

        for fase_nombre, descripcion, fecha, monto_ars, tc, tipo_factura, categorias in GASTOS:
            db.add(models.Gasto(
                proyecto_id=proyecto.id,
                fase_id=fases[fase_nombre].id if fase_nombre else None,
                usuario_id=usuario.id,
                monto_ars=monto_ars,
                monto_usd=a_usd(monto_ars, tc),
                cotizacion_dolar=tc,
                tipo_cambio=TIPO_CAMBIO,
                descripcion=descripcion,
                fecha=fecha,
                tipo_factura=tipo_factura,
                categorias=[_buscar_o_crear_categoria_gasto(db, c) for c in categorias],
            ))
            egresado_usd += a_usd(monto_ars, tc)
            if fase_nombre:
                ultima_actividad[fase_nombre] = max(ultima_actividad.get(fase_nombre, fecha), fecha)

        # Las fases nacen con el proyecto, no "hoy": si no, el Panel las ve
        # como recién tocadas. Mismo criterio que seed_demo.
        creacion = datetime.combine(FECHA_INICIO, time(9, 0), tzinfo=timezone.utc)
        for nombre, fase in fases.items():
            ultima = ultima_actividad.get(nombre)
            actualizacion = (
                datetime.combine(max(ultima, FECHA_INICIO), time(18, 0), tzinfo=timezone.utc)
                if ultima else creacion
            )
            db.execute(
                update(models.Fase)
                .where(models.Fase.id == fase.id)
                .values(fecha_creacion=creacion, fecha_actualizacion=actualizacion)
            )

        db.commit()

        print(f"{NOMBRE_PROYECTO}: {'recreado' if recreado else 'creado'}")
        print(f"  {len(FASES)} fases · {len(COBROS)} cobros · {len(COMPRAS)} compras "
              f"· {len(NOTAS_CREDITO)} notas de crédito · {len(GASTOS)} gastos")
        print()
        print("  Control contra la hoja Resumen de la planilla:")
        print(f"    ingresos  importados US$ {cobrado_usd:>10,.2f} · planilla US$ {TOTAL_INGRESOS_PLANILLA:>10,.2f}"
              f" · dif {cobrado_usd - TOTAL_INGRESOS_PLANILLA:>8,.2f}")
        print(f"    egresos   importados US$ {egresado_usd:>10,.2f} · planilla US$ {TOTAL_EGRESOS_PLANILLA:>10,.2f}"
              f" · dif {egresado_usd - TOTAL_EGRESOS_PLANILLA:>8,.2f}")
        print(f"    De esa diferencia, US$ {DIFERENCIA_FILA_CAJA} son la fila 'CAJA' del 30/09, que en la")
        print("    planilla tiene 300 en la columna USD pero 490.000 pesos al tc 1540 (= 318,18).")
        print("    Se importaron los pesos. El resto es redondeo al centavo de cada fila.")
        print()
        print("  Filas de la planilla SIN importe, no cargadas:")
        for fila in SIN_IMPORTE:
            print(f"    - {fila}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
