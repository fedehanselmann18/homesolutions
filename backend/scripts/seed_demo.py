"""
Seed de datos de DEMO: proyectos completos (fases, cobros, gastos y compras
con detalle, impuestos y comprobantes) para mostrar el sistema funcionando
de punta a punta -- sobre todo la pestaña "Análisis General".

Los 4 proyectos son distintos a propósito, para que se vea cómo reacciona
el análisis en cada escenario:
    - Edificio Olleros ......... en curso y sano (queda plata disponible)
    - Torre Libertador ......... en curso y en rojo (gastó más de lo que cobró)
    - Casa Vicente López ....... terminado y rentable (cobrado al 100%)
    - Salón de eventos Martínez  recién arrancando (solo anticipo)

Requiere el catálogo ya cargado (`python -m scripts.seed_catalogo`): los
productos, proveedores, impuestos y categorías se referencian por nombre,
no se crean acá.

Idempotente por proyecto: si ya existe un proyecto de demo con el mismo
nombre lo borra entero (fases, movimientos y archivos de comprobantes) y lo
vuelve a crear, así se puede correr las veces que haga falta sin duplicar ni
dejar archivos huérfanos. No toca proyectos que no estén en este archivo.

Uso: desde backend/, con el venv activado:
    python -m scripts.seed_demo
"""

import uuid
from datetime import date, datetime, time, timezone
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import update

from app.db.db import SessionLocal
from app.db import models
from app.files.storage import BASE_UPLOAD_DIR, eliminar_comprobante, ruta_absoluta

# Porcentajes de impuesto sobre el neto de la compra. El monto real se guarda
# en compra_impuesto.monto (la tabla guarda plata, no alícuotas).
IVA = ("IVA", 0.21)
PERCEPCION_IVA = ("Percepción de IVA", 0.03)
INGRESOS_BRUTOS = ("Ingresos Brutos", 0.035)
RETENCION_GANANCIAS = ("Retención de Ganancias", 0.02)
SUS = ("SUS", 0.01)


PROYECTOS = [
    # -----------------------------------------------------------------------
    # 1) En curso y sano: cobró más de lo que gastó, le queda margen.
    # -----------------------------------------------------------------------
    {
        "nombre": "Edificio Olleros",
        "direccion": "Olleros 1925, CABA",
        "fecha_inicio": date(2026, 3, 10),
        "estado": "en_curso",
        "precio_acordado_usd": 18_000_000,
        "fases": [
            ("Relevamiento y proyecto", "Visita al edificio, cómputo de equipos y planos de montaje", "auditada"),
            ("Provisión de equipos", "Compra de los splits y su logística hasta la obra", "terminada"),
            ("Instalación pisos 1 a 4", "Montaje de equipos, caños e interconexión", "en_curso"),
            ("Cableado y tablero", "Tendido eléctrico y tablero seccional del sistema", "en_curso"),
            ("Pruebas y entrega", "Puesta en marcha, mediciones y entrega al consorcio", "por_empezar"),
        ],
        "cobros": [
            (6_000_000, "Anticipo de obra 33%", date(2026, 3, 12), "factura_a", True),
            (5_500_000, "Certificado de avance N°1", date(2026, 5, 8), "factura_a", True),
        ],
        "gastos": [
            (180_000, "Flete de los splits desde depósito BGH", date(2026, 4, 3), "factura_b", "Provisión de equipos", ["Flete"], True),
            (65_000, "Almuerzo de arranque con el administrador", date(2026, 3, 11), "recibo", "Relevamiento y proyecto", ["Reunión con cliente"], False),
            (42_500, "Comisión bancaria por transferencias a proveedores", date(2026, 4, 30), "otros", None, ["Gasto bancario"], True),
            (95_000, "Flete de caños y aislación a obra", date(2026, 5, 14), "factura_b", "Instalación pisos 1 a 4", ["Flete"], True),
            (28_000, "Peajes y estacionamiento del equipo de montaje", date(2026, 6, 2), "recibo", "Instalación pisos 1 a 4", ["Otros"], False),
            (54_000, "Reunión de avance con el consorcio", date(2026, 6, 20), "recibo", "Cableado y tablero", ["Reunión con cliente", "Otros"], True),
        ],
        "compras": [
            {
                "fase": "Provisión de equipos",
                "proveedor": "BGH",
                "descripcion": "Splits para unidades funcionales pisos 1 a 4",
                "fecha": date(2026, 4, 2),
                "tipo_factura": "factura_a",
                "condicion_pago": "transferencia",
                "estado_pago": "pagado",
                "estado_envio": "entregado",
                "detalle": [
                    ("BGH", "Aire Acondicionado Split Frío/Calor 4500W", 6),
                    ("BGH", "Aire Acondicionado Split Frío/Calor 3000W", 2),
                ],
                "impuestos": [IVA, PERCEPCION_IVA],
                "comprobante": True,
            },
            {
                "fase": "Instalación pisos 1 a 4",
                "proveedor": "CobreSur Materiales",
                "descripcion": "Caños, gas refrigerante, soportes y aislación",
                "fecha": date(2026, 5, 12),
                "tipo_factura": "factura_a",
                "condicion_pago": "cuenta_corriente",
                "estado_pago": "pagado",
                "estado_envio": "entregado",
                "detalle": [
                    ("CobreSur", 'Caño de Cobre 1/4" x 15m', 8),
                    ("CobreSur", 'Caño de Cobre 3/8" x 15m', 4),
                    ("CobreSur", "Gas Refrigerante R410A 11.3kg", 2),
                    ("CobreSur", "Soporte para Split Pared", 8),
                    ("CobreSur", 'Aislación Térmica Armaflex 3/8"', 10),
                ],
                "impuestos": [IVA],
                "comprobante": True,
            },
            {
                "fase": "Instalación pisos 1 a 4",
                "proveedor": "ClimaTotal Instalaciones",
                "descripcion": "Mano de obra de montaje de 8 equipos",
                "fecha": date(2026, 5, 25),
                "tipo_factura": "factura_a",
                "condicion_pago": "transferencia",
                "estado_pago": "pagado",
                "estado_envio": "entregado",
                "detalle": [
                    ("Servicio", "Instalación de Aire Acondicionado Split", 8),
                ],
                "impuestos": [IVA, INGRESOS_BRUTOS],
                "comprobante": True,
            },
            {
                "fase": "Cableado y tablero",
                "proveedor": "Prysmian Cables",
                "descripcion": "Cables y cintas para el tendido del tablero",
                "fecha": date(2026, 6, 18),
                "tipo_factura": "factura_b",
                "condicion_pago": "contado",
                "estado_pago": "pagado",
                "estado_envio": "entregado",
                "detalle": [
                    ("Prysmian", "Cable Unipolar 2.5mm x 100m", 6),
                    ("Prysmian", "Cable Unipolar 4mm x 100m", 3),
                    ("Prysmian", "Cinta Aislante Eléctrica 3M", 4),
                ],
                "impuestos": [IVA],
                "comprobante": False,
            },
        ],
    },

    # -----------------------------------------------------------------------
    # 2) En rojo: compró todo el equipamiento y todavía cobró solo el anticipo.
    # -----------------------------------------------------------------------
    {
        "nombre": "Torre Libertador - Climatización",
        "direccion": "Av. del Libertador 6420, CABA",
        "fecha_inicio": date(2026, 5, 4),
        "estado": "en_curso",
        "precio_acordado_usd": 12_000_000,
        "fases": [
            ("Ingeniería y cómputo", "Cálculo de cargas térmicas y selección de equipos", "auditada"),
            ("Compra de equipos", "Adquisición de splits inverter y ventilación", "terminada"),
            ("Montaje", "Instalación de equipos en oficinas 3° a 6°", "en_curso"),
            ("Puesta en marcha", "Carga de gas, pruebas y capacitación al cliente", "por_empezar"),
        ],
        "cobros": [
            (3_000_000, "Anticipo de obra 25%", date(2026, 5, 6), "factura_a", True),
        ],
        "gastos": [
            (220_000, "Flete de equipos Surrey a obra", date(2026, 5, 20), "factura_b", "Compra de equipos", ["Flete"], True),
            (18_500, "Gastos bancarios del mes", date(2026, 5, 31), "otros", None, ["Gasto bancario"], True),
            (45_000, "Reunión de coordinación con el estudio", date(2026, 6, 5), "recibo", "Montaje", ["Reunión con cliente"], False),
            (72_000, "Alquiler de andamio para fachada", date(2026, 6, 22), "factura_b", "Montaje", ["Otros"], False),
            (39_000, "Segundo flete de materiales", date(2026, 7, 6), "factura_b", "Montaje", ["Flete"], True),
        ],
        "compras": [
            {
                "fase": "Compra de equipos",
                "proveedor": "Surrey",
                "descripcion": "Splits inverter y ventilación para oficinas",
                "fecha": date(2026, 5, 18),
                "tipo_factura": "factura_a",
                "condicion_pago": "cheque",
                "estado_pago": "pagado",
                "estado_envio": "entregado",
                "detalle": [
                    ("Surrey", "Aire Acondicionado Split Inverter 2250W", 8),
                    ("Surrey", "Ventilador de Techo Industrial", 4),
                ],
                "impuestos": [IVA, PERCEPCION_IVA, RETENCION_GANANCIAS],
                "comprobante": True,
            },
            {
                "fase": "Montaje",
                "proveedor": "CobreSur Materiales",
                "descripcion": "Materiales de interconexión para 8 equipos",
                "fecha": date(2026, 6, 10),
                "tipo_factura": "factura_a",
                "condicion_pago": "cuenta_corriente",
                "estado_pago": "pendiente",
                "estado_envio": "entregado",
                "detalle": [
                    ("CobreSur", 'Caño de Cobre 3/8" x 15m', 6),
                    ("CobreSur", "Gas Refrigerante R410A 11.3kg", 3),
                    ("CobreSur", "Cable Cinta Plana Multipar", 2),
                    ("CobreSur", "Cinta Teflón para Gasista", 10),
                ],
                "impuestos": [IVA],
                "comprobante": True,
            },
            {
                "fase": "Montaje",
                "proveedor": "ClimaTotal Instalaciones",
                "descripcion": "Montaje y tendido eléctrico de los 8 equipos",
                "fecha": date(2026, 7, 2),
                "tipo_factura": "factura_a",
                "condicion_pago": "transferencia",
                "estado_pago": "pendiente",
                "estado_envio": "pedido",
                "detalle": [
                    ("Servicio", "Instalación de Aire Acondicionado Split", 8),
                    ("Servicio", "Tendido de Cableado Eléctrico", 6),
                ],
                "impuestos": [IVA, INGRESOS_BRUTOS],
                "comprobante": False,
            },
        ],
    },

    # -----------------------------------------------------------------------
    # 3) Terminado y rentable: sirve para mirar el cierre de un proyecto.
    # -----------------------------------------------------------------------
    {
        "nombre": "Casa Vicente López - Reforma integral",
        "direccion": "Malaver 2504, Vicente López",
        "fecha_inicio": date(2026, 1, 15),
        "estado": "terminado",
        "precio_acordado_usd": 9_000_000,
        "fases": [
            ("Demolición y retiro", "Retiro de revestimientos viejos y contenedor", "auditada"),
            ("Instalación sanitaria y eléctrica", "Recambio de cañerías y tablero", "auditada"),
            ("Pisos y revestimientos", "Colocación de porcelanato en toda la planta baja", "terminada"),
            ("Equipamiento y entrega", "Colocación de electrodomésticos y entrega final", "terminada"),
        ],
        "cobros": [
            (3_000_000, "Anticipo de obra", date(2026, 1, 16), "factura_a", True),
            (3_500_000, "Certificado de avance N°1", date(2026, 3, 2), "factura_a", True),
            (2_500_000, "Certificado final de obra", date(2026, 4, 28), "factura_a", True),
        ],
        "gastos": [
            (140_000, "Contenedor para escombros", date(2026, 1, 22), "factura_b", "Demolición y retiro", ["Flete"], True),
            (85_000, "Flete de porcelanato", date(2026, 2, 25), "factura_b", "Pisos y revestimientos", ["Flete"], True),
            (32_000, "Comisiones bancarias del proyecto", date(2026, 3, 31), "otros", None, ["Gasto bancario"], True),
            (48_000, "Reunión de cierre con los dueños", date(2026, 4, 27), "recibo", "Equipamiento y entrega", ["Reunión con cliente"], True),
            (26_500, "Insumos de limpieza final", date(2026, 4, 28), "recibo", "Equipamiento y entrega", ["Otros"], False),
        ],
        "compras": [
            {
                "fase": "Instalación sanitaria y eléctrica",
                "proveedor": "FV",
                "descripcion": "Mano de obra sanitaria y eléctrica",
                "fecha": date(2026, 2, 5),
                "tipo_factura": "factura_a",
                "condicion_pago": "transferencia",
                "estado_pago": "pagado",
                "estado_envio": "entregado",
                "detalle": [
                    ("Servicio", "Instalación Sanitaria", 8),
                    ("Servicio", "Instalación Eléctrica", 8),
                    ("FV", "Cinta Aisladora Doble Faz", 6),
                ],
                "impuestos": [IVA, SUS],
                "comprobante": True,
            },
            {
                "fase": "Pisos y revestimientos",
                "proveedor": "Weber Saint-Gobain",
                "descripcion": "Colocación de porcelanato y cerámicos",
                "fecha": date(2026, 3, 4),
                "tipo_factura": "factura_a",
                "condicion_pago": "cuenta_corriente",
                "estado_pago": "pagado",
                "estado_envio": "entregado",
                "detalle": [
                    ("Servicio", "Colocación de Porcelanato", 30),
                    ("Servicio", "Instalación de Cerámicos", 12),
                ],
                "impuestos": [IVA, INGRESOS_BRUTOS],
                "comprobante": True,
            },
            {
                "fase": "Equipamiento y entrega",
                "proveedor": "Ferrum",
                "descripcion": "Electrodomésticos de cocina y lavadero",
                "fecha": date(2026, 4, 15),
                "tipo_factura": "factura_a",
                "condicion_pago": "contado",
                "estado_pago": "pagado",
                "estado_envio": "entregado",
                "detalle": [
                    ("Samsung", "Heladera RT38", 1),
                    ("LG", "Lavarropas WM85", 1),
                    ("Ferrum", "Microondas Digital 25L", 1),
                    ("Ferrum", "Aire Acondicionado Portátil 2200 Frigorías", 1),
                ],
                "impuestos": [IVA],
                "comprobante": True,
            },
        ],
    },

    # -----------------------------------------------------------------------
    # 4) Recién arrancando: casi sin movimientos, para ver el estado inicial.
    # -----------------------------------------------------------------------
    {
        "nombre": "Salón de eventos - Martínez",
        "direccion": "Av. Fleming 1840, Martínez",
        "fecha_inicio": date(2026, 7, 20),
        "estado": "a_iniciar",
        "precio_acordado_usd": 22_000_000,
        "fases": [
            ("Relevamiento del salón", "Medición y propuesta técnica de climatización", "en_curso"),
            ("Provisión de equipos", "Compra de equipos de gran porte", "por_empezar"),
            ("Montaje", "Instalación en salón principal y hall", "por_empezar"),
            ("Entrega", "Pruebas con el salón en funcionamiento", "por_empezar"),
        ],
        "cobros": [
            (2_200_000, "Anticipo de contrato 10%", date(2026, 7, 22), "factura_a", True),
        ],
        "gastos": [
            (58_000, "Reunión de presentación con el cliente", date(2026, 7, 21), "recibo", "Relevamiento del salón", ["Reunión con cliente"], False),
            (34_000, "Flete de herramientas para el relevamiento", date(2026, 7, 24), "factura_b", "Relevamiento del salón", ["Flete"], True),
        ],
        "compras": [
            {
                "fase": "Relevamiento del salón",
                "proveedor": "Sika Argentina",
                "descripcion": "Herramientas para el relevamiento",
                "fecha": date(2026, 7, 23),
                "tipo_factura": "factura_b",
                "condicion_pago": "contado",
                "estado_pago": "pagado",
                "estado_envio": "pedido",
                "detalle": [
                    ("Bosch", "Taladro Percutor GSB 13 RE", 1),
                    ("Sika Argentina", "Cinta Aisladora 3M Profesional", 4),
                ],
                "impuestos": [IVA],
                "comprobante": True,
            },
        ],
    },
]


def _redondear(valor) -> Decimal:
    return Decimal(str(valor)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _pdf_comprobante(lineas: list[str]) -> bytes:
    """
    Arma un PDF mínimo pero válido (con su tabla xref) para que los
    comprobantes de la demo se puedan abrir de verdad desde la app.
    """
    texto = "".join(
        f"BT /F1 11 Tf 40 {200 - i * 20} Td ({linea}) Tj ET\n" for i, linea in enumerate(lineas)
    ).encode("latin-1", "replace")

    objetos = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 260] "
        b"/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        b"<< /Length " + str(len(texto)).encode() + b" >>\nstream\n" + texto + b"endstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]

    salida = bytearray(b"%PDF-1.4\n")
    offsets = []
    for numero, cuerpo in enumerate(objetos, start=1):
        offsets.append(len(salida))
        salida += f"{numero} 0 obj\n".encode() + cuerpo + b"\nendobj\n"

    inicio_xref = len(salida)
    salida += f"xref\n0 {len(objetos) + 1}\n".encode()
    salida += b"0000000000 65535 f \n"
    for offset in offsets:
        salida += f"{offset:010d} 00000 n \n".encode()
    salida += (
        f"trailer\n<< /Size {len(objetos) + 1} /Root 1 0 R >>\nstartxref\n{inicio_xref}\n%%EOF\n".encode()
    )
    return bytes(salida)


def _guardar_comprobante(carpeta: str, entidad_id, lineas: list[str]) -> str:
    """Escribe el PDF en disco con la misma convención que storage.subir_comprobante."""
    ruta_relativa = BASE_UPLOAD_DIR / carpeta / str(entidad_id) / f"{uuid.uuid4()}.pdf"
    destino = ruta_absoluta(ruta_relativa)
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(_pdf_comprobante(lineas))
    return str(ruta_relativa)


def _borrar_proyecto_existente(db, nombre: str) -> bool:
    """
    Borra el proyecto de demo y sus archivos de comprobantes. El resto del
    árbol (fases, movimientos, detalle) se va solo por el CASCADE de la DB.
    """
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.nombre == nombre).first()
    if not proyecto:
        return False

    paths = []
    for fase in proyecto.fases:
        for compra in fase.compras:
            paths += [c.archivo_path for c in compra.comprobantes]
    for gasto in proyecto.gastos:
        paths += [c.archivo_path for c in gasto.comprobantes]
    for cobro in proyecto.cobros:
        paths += [c.archivo_path for c in cobro.comprobantes]

    for path in paths:
        eliminar_comprobante(path)  # borra el archivo y la carpeta de la entidad si queda vacía

    db.delete(proyecto)
    db.flush()
    return True


def _buscar_producto(db, marca: str, modelo: str) -> models.Producto:
    producto = db.query(models.Producto).filter(
        models.Producto.marca == marca, models.Producto.modelo == modelo
    ).first()
    if not producto:
        raise SystemExit(
            f"No existe el producto {marca} {modelo!r}. Corré antes `python -m scripts.seed_catalogo`."
        )
    return producto


def _buscar_por_nombre(db, model, nombre: str):
    fila = db.query(model).filter(model.nombre == nombre).first()
    if not fila:
        raise SystemExit(
            f"No existe {model.__name__} {nombre!r}. Corré antes `python -m scripts.seed_catalogo`."
        )
    return fila


def _ajustar_timestamps_de_fases(db, fase_por_nombre: dict, fecha_inicio, ultima_actividad: dict) -> None:
    """
    fecha_creacion/fecha_actualizacion las pone la DB sola con el now() del
    momento, así que en la demo todas las fases quedarían "creadas hoy" aunque
    el proyecto haya arrancado en marzo. Acá se las corre a mano a fechas
    coherentes con la historia del proyecto: la fase nace cuando arranca el
    proyecto y se actualiza por última vez con su último movimiento cargado.

    Importa porque el Panel usa fecha_actualizacion para detectar fases "en
    curso" que hace mucho no se tocan; sin esto esa alerta nunca se ve en la demo.
    """
    creacion = datetime.combine(fecha_inicio, time(9, 0), tzinfo=timezone.utc)

    for nombre, fase in fase_por_nombre.items():
        ultima = ultima_actividad.get(nombre)
        actualizacion = (
            datetime.combine(max(ultima, fecha_inicio), time(18, 0), tzinfo=timezone.utc)
            if ultima
            else creacion
        )
        # Se setean explícitamente para que el onupdate=now() del modelo no las pise.
        db.execute(
            update(models.Fase)
            .where(models.Fase.id == fase.id)
            .values(fecha_creacion=creacion, fecha_actualizacion=actualizacion)
        )


def crear_proyecto(db, usuario, datos: dict) -> dict:
    resumen = {"fases": 0, "cobros": 0, "gastos": 0, "compras": 0}
    # Última fecha de negocio cargada contra cada fase (gasto o compra).
    ultima_actividad: dict[str, date] = {}

    proyecto = models.Proyecto(
        nombre=datos["nombre"],
        direccion=datos["direccion"],
        fecha_inicio=datos["fecha_inicio"],
        estado=datos["estado"],
        precio_acordado_usd=datos["precio_acordado_usd"],
    )
    db.add(proyecto)
    db.flush()

    fase_por_nombre = {}
    for nombre, descripcion, estado in datos["fases"]:
        fase = models.Fase(proyecto_id=proyecto.id, nombre=nombre, descripcion=descripcion, estado=estado)
        db.add(fase)
        db.flush()
        fase_por_nombre[nombre] = fase
        resumen["fases"] += 1

    for monto, descripcion, fecha, tipo_factura, con_comprobante in datos["cobros"]:
        cobro = models.Cobro(
            proyecto_id=proyecto.id,
            usuario_id=usuario.id,
            monto=monto,
            descripcion=descripcion,
            fecha=fecha,
            tipo_factura=tipo_factura,
        )
        db.add(cobro)
        db.flush()
        if con_comprobante:
            path = _guardar_comprobante(
                "comprobantes_cobro", cobro.id,
                [f"Recibo de cobro - {datos['nombre']}", descripcion, f"Monto: $ {monto:,.2f}", f"Fecha: {fecha}"],
            )
            db.add(models.ComprobanteCobro(cobro_id=cobro.id, archivo_path=path))
        resumen["cobros"] += 1

    for monto, descripcion, fecha, tipo_factura, fase_nombre, categorias, con_comprobante in datos["gastos"]:
        gasto = models.Gasto(
            proyecto_id=proyecto.id,
            fase_id=fase_por_nombre[fase_nombre].id if fase_nombre else None,
            usuario_id=usuario.id,
            monto=monto,
            descripcion=descripcion,
            fecha=fecha,
            tipo_factura=tipo_factura,
            categorias=[_buscar_por_nombre(db, models.CategoriaGasto, c) for c in categorias],
        )
        db.add(gasto)
        db.flush()
        if con_comprobante:
            path = _guardar_comprobante(
                "comprobantes_gasto", gasto.id,
                [f"Comprobante de gasto - {datos['nombre']}", descripcion, f"Monto: $ {monto:,.2f}", f"Fecha: {fecha}"],
            )
            db.add(models.ComprobanteGasto(gasto_id=gasto.id, archivo_path=path))
        if fase_nombre:
            ultima_actividad[fase_nombre] = max(ultima_actividad.get(fase_nombre, fecha), fecha)
        resumen["gastos"] += 1

    for datos_compra in datos["compras"]:
        proveedor = _buscar_por_nombre(db, models.Proveedor, datos_compra["proveedor"])

        lineas = []
        neto = Decimal("0")
        for marca, modelo, cantidad in datos_compra["detalle"]:
            producto = _buscar_producto(db, marca, modelo)
            if producto.proveedor_id != proveedor.id:
                raise SystemExit(
                    f"{marca} {modelo!r} no es del proveedor {proveedor.nombre}: la compra quedaría incoherente."
                )
            precio_unitario = _redondear(producto.precio)
            lineas.append((producto, cantidad, precio_unitario))
            neto += precio_unitario * Decimal(cantidad)

        compra = models.Compra(
            fase_id=fase_por_nombre[datos_compra["fase"]].id,
            proveedor_id=proveedor.id,
            usuario_id=usuario.id,
            descripcion=datos_compra["descripcion"],
            precio_neto=_redondear(neto),
            tipo_factura=datos_compra["tipo_factura"],
            fecha=datos_compra["fecha"],
            condicion_pago=datos_compra["condicion_pago"],
            estado_pago=datos_compra["estado_pago"],
            estado_envio=datos_compra["estado_envio"],
        )
        db.add(compra)
        db.flush()

        for producto, cantidad, precio_unitario in lineas:
            db.add(models.DetalleCompra(
                compra_id=compra.id,
                producto_id=producto.id,
                cantidad=cantidad,
                precio_unitario=precio_unitario,
            ))

        for nombre_impuesto, alicuota in datos_compra["impuestos"]:
            impuesto = _buscar_por_nombre(db, models.Impuesto, nombre_impuesto)
            db.add(models.CompraImpuesto(
                compra_id=compra.id,
                impuesto_id=impuesto.id,
                monto=_redondear(neto * Decimal(str(alicuota))),
            ))

        if datos_compra["comprobante"]:
            path = _guardar_comprobante(
                "comprobantes_compra", compra.id,
                [
                    f"Factura de compra - {proveedor.nombre}",
                    datos_compra["descripcion"],
                    f"Neto: $ {neto:,.2f}",
                    f"Fecha: {datos_compra['fecha']}",
                ],
            )
            db.add(models.ComprobanteCompra(compra_id=compra.id, archivo_path=path))

        fase_nombre = datos_compra["fase"]
        ultima_actividad[fase_nombre] = max(
            ultima_actividad.get(fase_nombre, datos_compra["fecha"]), datos_compra["fecha"]
        )
        resumen["compras"] += 1

    _ajustar_timestamps_de_fases(db, fase_por_nombre, datos["fecha_inicio"], ultima_actividad)

    return resumen


def main():
    db = SessionLocal()
    try:
        usuario = db.query(models.Usuario).filter(models.Usuario.rol == "admin").first()
        if not usuario:
            raise SystemExit("No hay ningún usuario admin en la base: creá uno antes de correr la demo.")

        for datos in PROYECTOS:
            recreado = _borrar_proyecto_existente(db, datos["nombre"])
            resumen = crear_proyecto(db, usuario, datos)
            marca = "recreado" if recreado else "creado"
            print(f"{datos['nombre']}: {marca} ({resumen})")

        db.commit()
        print(f"\nSeed de demo OK: {len(PROYECTOS)} proyectos.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
