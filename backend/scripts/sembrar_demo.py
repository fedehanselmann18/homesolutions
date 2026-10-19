#!/usr/bin/env python3
"""
Base local de demo: 8 obras de enero a octubre de 2026 con todo lo que la app
tiene que saber calcular, y el resultado ESPERADO calculado aparte.

Para qué: antes de subir un cambio de cálculos a producción, cargar una base
local con casos reales (anticipos en USD, egresos en pesos con el dólar de
cada semana, NC/ND, plazos vencidos y por vencer, gastos generales, obras
terminadas con ganancia y con pérdida...) y comparar lo que muestra la app
contra lo que TIENE que dar. Lo esperado sale de las reglas de negocio con
aritmética simple en este script, no del código de la app: si la app y el
script coinciden, el cálculo está bien.

Qué hace (con --aplicar):
  1. Se niega a correr si la base no es local.
  2. Vacía todo lo de negocio (proyectos, movimientos, proveedores,
     catálogo, cotizaciones, impuestos, categorías). Quedan usuarios, tipos
     de factura, condiciones de pago, configuración y auditoría. Los
     comprobantes viejos de uploads/ se mueven a backups/.
  3. Carga todo POR LA API (el backend corre en este mismo proceso), así
     cada movimiento pasa por las mismas reglas que en producción:
     conversión con el dólar del día, reparto de plazos, notas, estados.
  4. Compara movimiento por movimiento lo que guardó el backend contra lo
     esperado, y escribe en --salida:
        demo_datos_api.json   lo que devuelve la API (lo mismo que baja el front)
        demo_esperado.json    totales esperados por obra, período, Panel y Cash flow
     El front se verifica aparte con esos dos archivos.

Los datos son inventados: no copiar montos reales de Agus acá (los Excels de
obras reales no van a seeds ni a commits). Los comprobantes son un PDF de
prueba de pocos bytes, en disco local (nunca en el bucket).

Uso (desde backend/, con el venv):
    python scripts/sembrar_demo.py              # simulacro: no toca nada
    python scripts/sembrar_demo.py --aplicar    # vacía la base local y carga la demo
"""

from __future__ import annotations

import argparse
import calendar
import json
import logging
import os
import shutil
import sys
from datetime import date, datetime, timedelta
from decimal import ROUND_DOWN, ROUND_HALF_UP, Decimal
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]  # backend/
sys.path.insert(0, str(RAIZ))

CENTAVO = Decimal("0.01")
PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
HOSTS_LOCALES = {"localhost", "127.0.0.1", "::1"}

# Lo que NO se borra: cuentas, configuración, auditoría y las listas que
# siembran las migraciones.
TABLAS_QUE_QUEDAN = {
    "usuarios",
    "usuarios_autorizados",
    "intentos_login",
    "refresh_tokens_revocados",
    "auditoria",
    "configuracion",
    "tipos_factura",
    "medios_pago",
    "condiciones_pago",
    "alembic_version",
}


# ---------------------------------------------------------------------------
# Plata: la misma regla que el backend (Decimal, al centavo, half-up)
# ---------------------------------------------------------------------------


def d(valor) -> Decimal:
    return valor if isinstance(valor, Decimal) else Decimal(str(valor))


def r2(valor) -> Decimal:
    return d(valor).quantize(CENTAVO, rounding=ROUND_HALF_UP)


def a_usd(ars, cot) -> Decimal:
    return r2(d(ars) / d(cot))


def a_ars(usd, cot) -> Decimal:
    return r2(d(usd) * d(cot))


def dividir(total, partes: int) -> list[Decimal]:
    """Partes iguales; el último absorbe el redondeo."""
    total = d(total).quantize(CENTAVO)
    base = (total / partes).quantize(CENTAVO, rounding=ROUND_DOWN)
    return [base] * (partes - 1) + [total - base * (partes - 1)]


def f2(valor) -> float:
    return float(r2(valor))


# ---------------------------------------------------------------------------
# Dólar blue: uno por semana (lunes), subiendo de 1.180 a ~1.550 en el año
# ---------------------------------------------------------------------------

PRIMER_LUNES = date(2026, 1, 5)


def cotizaciones_del_anio(hasta: date) -> dict[date, Decimal]:
    cotizaciones = {}
    lunes, i = PRIMER_LUNES, 0
    while lunes <= hasta:
        ruido = {0: 0, 1: 4, 2: -3, 3: 2}[i % 4]
        cotizaciones[lunes] = Decimal(1180 + 9 * i + ruido)
        lunes += timedelta(days=7)
        i += 1
    return cotizaciones


# ---------------------------------------------------------------------------
# Catálogo inventado (precios de lista en pesos)
# ---------------------------------------------------------------------------

CATEGORIAS_PRODUCTO = {
    "VRF": "equipo",
    "Splits": "equipo",
    "Calderas": "equipo",
    "Calefacción": "materiales",
    "Cañería": "materiales",
    "Conductos": "materiales",
    "Eléctrico": "materiales",
    "Soportes": "materiales",
    "Instalación": "mano_obra",
}

CATEGORIAS_GASTO = [
    "Mano de obra",
    "Flete",
    "Honorarios",
    "Viáticos",
    "Comisiones bancarias",
    "Herramientas",
    "Varios",
]

FASES_PREDETERMINADAS = [
    "Relevamiento",
    "Equipos",
    "Equipos VRF",
    "Calefacción",
    "Cañería",
    "Conductos",
    "Instalación",
    "Puesta en marcha",
    "Entrega y garantía",
]

PROVEEDORES = {
    "frio": {"nombre": "Frío Sur Distribuidora", "telefono": "11 4555-1020", "email": "ventas@friosur.test"},
    "clima": {"nombre": "Climatización Norte", "telefono": "11 4777-3344"},
    "calderas": {"nombre": "Calderas del Plata", "email": "pedidos@calderasdelplata.test"},
    "cobres": {"nombre": "Cobres Unidos", "telefono": "11 4302-8890"},
    "conductos": {"nombre": "Conductos Patagonia", "email": "info@conductospatagonia.test"},
    "electrica": {"nombre": "Eléctrica Belgrano", "telefono": "11 4781-2200"},
    "herrajes": {"nombre": "Herrajes Oeste"},
    "ramirez": {"nombre": "Instalaciones Ramírez", "telefono": "11 15-6123-4567"},
}

# clave -> (proveedor, marca, modelo, tipo, precio, categoría)
PRODUCTOS = {
    "vrf_cond_12": ("frio", "LG", "ARUN121 condensadora VRF 12 HP", "equipo", 14_800_000, "VRF"),
    "vrf_int_09": ("frio", "LG", "ARNU09 unidad interior 9.000 BTU", "equipo", 1_180_000, "VRF"),
    "vrf_int_24": ("frio", "LG", "ARNU24 unidad interior 24.000 BTU", "equipo", 1_690_000, "VRF"),
    "vrf_ctrl": ("frio", "LG", "PREMTB100 control cableado", "equipo", 215_000, "VRF"),
    "split_3000": ("clima", "BGH", "Silent Air 3.000 frigorías", "equipo", 985_000, "Splits"),
    "split_4500": ("clima", "BGH", "Silent Air 4.500 frigorías", "equipo", 1_260_000, "Splits"),
    "split_6000": ("clima", "Surrey", "Pria 6.000 frigorías", "equipo", 1_920_000, "Splits"),
    "caldera_24": ("calderas", "Baxi", "Luna Duo-tec 24 kW", "equipo", 2_350_000, "Calderas"),
    "radiador_600": ("calderas", "Peisa", "Broen 600 (elemento)", "materiales", 96_000, "Calefacción"),
    "piso_rad": ("calderas", "Peisa", "Piso radiante (m²)", "materiales", 38_000, "Calefacción"),
    "cobre_38": (
        "cobres",
        "Cobres Unidos",
        'Caño de cobre 3/8" rollo 15 m',
        "materiales",
        215_000,
        "Cañería",
    ),
    "cobre_58": (
        "cobres",
        "Cobres Unidos",
        'Caño de cobre 5/8" rollo 15 m',
        "materiales",
        338_000,
        "Cañería",
    ),
    "codos_kit": ("cobres", "Cobres Unidos", "Kit de codos y cuplas", "materiales", 46_500, "Cañería"),
    "armaflex": ("cobres", "Armaflex", 'Aislación 3/8" (2 m)', "materiales", 7_800, "Cañería"),
    "climaver": ("conductos", "Isover", "Placa Climaver Neto 1,2 x 3 m", "materiales", 87_000, "Conductos"),
    "cinta_alu": ("conductos", "3M", "Cinta de aluminio 50 m", "materiales", 9_800, "Conductos"),
    "flexible_8": ("conductos", "Atco", 'Flexible aislado 8" (10 m)', "materiales", 23_500, "Conductos"),
    "rejilla": ("conductos", "Rejimet", "Rejilla de inyección 30 x 30", "materiales", 39_000, "Conductos"),
    "cable_mallado": (
        "electrica",
        "Prysmian",
        "Cable mallado 3 x 1,5 (100 m)",
        "materiales",
        165_000,
        "Eléctrico",
    ),
    "termica": ("electrica", "Schneider", "Térmica bipolar 20 A", "materiales", 33_000, "Eléctrico"),
    "soporte_cond": (
        "herrajes",
        "Herrajes Oeste",
        "Soporte para condensadora",
        "materiales",
        67_000,
        "Soportes",
    ),
    "mo_split": (
        "ramirez",
        "Instalaciones Ramírez",
        "Instalación de split (por equipo)",
        "mano_obra",
        185_000,
        "Instalación",
    ),
    "mo_vrf_int": (
        "ramirez",
        "Instalaciones Ramírez",
        "Instalación VRF por unidad interior",
        "mano_obra",
        255_000,
        "Instalación",
    ),
    "mo_caldera": (
        "ramirez",
        "Instalaciones Ramírez",
        "Instalación de caldera",
        "mano_obra",
        620_000,
        "Instalación",
    ),
}

IVA_21 = "IVA 21%"
IVA_105 = "IVA 10,5%"
PERCEPCION = "Percepción IIBB"
IMPUESTOS = {IVA_21: (21, "IVA"), IVA_105: (10.5, "IVA"), PERCEPCION: (3, None)}


# ---------------------------------------------------------------------------
# Cliente: la app en este mismo proceso, autenticado como un admin local
# ---------------------------------------------------------------------------


class Api:
    def __init__(self, cliente, headers):
        self.cliente = cliente
        self.headers = headers

    def _ok(self, respuesta, esperado):
        if respuesta.status_code != esperado:
            raise SystemExit(
                f"{respuesta.request.method} {respuesta.request.url} -> {respuesta.status_code}: {respuesta.text}"
            )
        return respuesta.json()

    def post(self, url, json=None, esperado=201, **kwargs):
        return self._ok(self.cliente.post(url, json=json, headers=self.headers, **kwargs), esperado)

    def put(self, url, json):
        return self._ok(self.cliente.put(url, json=json, headers=self.headers), 200)

    def get(self, url, **params):
        return self._ok(self.cliente.get(url, headers=self.headers, params=params or None), 200)

    def archivo(self, url, nombre="comprobante.pdf", data=None):
        return self.post(url, files={"archivo": (nombre, PDF, "application/pdf")}, data=data)


# ---------------------------------------------------------------------------
# La siembra: cada alta guarda también lo que el backend TIENE que devolver
# ---------------------------------------------------------------------------


class Semilla:
    def __init__(self, api: Api, hoy: date):
        self.api = api
        self.hoy = hoy
        self.cotizaciones = cotizaciones_del_anio(hoy)
        self.ids = {}  # nombre -> id de catálogos
        self.condiciones = {}
        self.obras = {}  # clave -> dict
        self.compras, self.gastos, self.cobros = [], [], []

    # --- catálogos --------------------------------------------------------

    def cot(self, fecha: date) -> Decimal:
        lunes = fecha - timedelta(days=fecha.weekday())
        while lunes not in self.cotizaciones:
            lunes -= timedelta(days=7)
        return self.cotizaciones[lunes]

    def catalogos(self):
        for fecha, valor in self.cotizaciones.items():
            self.api.post(
                "/cotizaciones/crear", {"fecha": fecha.isoformat(), "tipo": "blue", "valor": float(valor)}
            )
        for nombre, (alicuota, grupo) in IMPUESTOS.items():
            self.ids[nombre] = self.api.post(
                "/impuestos/crear", {"nombre": nombre, "alicuota": alicuota, "grupo": grupo}
            )["id"]
        for nombre, tipo in CATEGORIAS_PRODUCTO.items():
            self.ids[f"cat:{nombre}"] = self.api.post("/categorias/crear", {"nombre": nombre, "tipo": tipo})[
                "id"
            ]
        for nombre in CATEGORIAS_GASTO:
            self.ids[f"gasto:{nombre}"] = self.api.post("/categorias-gasto/crear", {"nombre": nombre})["id"]
        for nombre in FASES_PREDETERMINADAS:
            self.api.post("/fases-predeterminadas/crear", {"nombre": nombre})
        for clave, datos in PROVEEDORES.items():
            self.ids[f"prov:{clave}"] = self.api.post("/proveedores/crear", datos)["id"]
        for clave, (prov, marca, modelo, tipo, precio, categoria) in PRODUCTOS.items():
            self.ids[f"prod:{clave}"] = self.api.post(
                "/productos/crear",
                {
                    "proveedor_id": self.ids[f"prov:{prov}"],
                    "marca": marca,
                    "modelo": modelo,
                    "tipo": tipo,
                    "precio": precio,
                    "categoria_ids": [self.ids[f"cat:{categoria}"]],
                },
            )["id"]
        for condicion in self.api.get("/condiciones-pago/"):
            self.condiciones[condicion["nombre"]] = condicion

    # --- obras ------------------------------------------------------------

    def obra(self, clave, nombre, direccion, inicio: date, precio_usd, fases):
        proyecto = self.api.post(
            "/proyectos/crear",
            {
                "nombre": nombre,
                "direccion": direccion,
                "fecha_inicio": inicio.isoformat(),
                "estado": "a_iniciar",
                "precio_acordado_usd": precio_usd,
                "cotizacion_acordada": float(self.cot(min(inicio, self.hoy))),
                "tipo_cambio_acordado": "blue",
            },
        )
        obra = {"clave": clave, "id": proyecto["id"], "nombre": nombre, "precio": d(precio_usd), "fases": {}}
        for nombre_fase in fases:
            fase = self.api.post(
                "/fases/crear",
                {"proyecto_id": proyecto["id"], "nombre": nombre_fase, "estado": "por_empezar"},
            )
            # Lo esperado del estado: por empezar hasta que entre un egreso.
            obra["fases"][nombre_fase] = {"id": fase["id"], "estado": "por_empezar", "desde": None}
        self.obras[clave] = obra
        return obra

    def _arrancar_fase(self, obra, nombre_fase, fecha):
        """Regla de negocio: el primer egreso arranca la fase (desde SU fecha)
        y la obra; uno anterior retrocede la fecha."""
        if nombre_fase is None:
            obra.setdefault("arranco", True)
            return
        fase = obra["fases"][nombre_fase]
        if fase["estado"] == "por_empezar":
            fase["estado"], fase["desde"] = "en_curso", fecha
        elif fase["estado"] == "en_curso" and fecha < fase["desde"]:
            fase["desde"] = fecha
        obra["arranco"] = True

    def cerrar_fase(self, obra, nombre_fase, estado):
        fase = obra["fases"][nombre_fase]
        self.api.put(f"/fases/{fase['id']}", {"estado": estado})
        fase["estado"], fase["desde"] = estado, None

    def terminar_obra(self, obra):
        self.api.put(f"/proyectos/{obra['id']}", {"estado": "terminado"})
        obra["estado_final"] = "terminado"

    # --- movimientos ------------------------------------------------------

    def cobro(self, obra, fecha: date, usd, descripcion, notas=(), comprobante=True, tipo_factura="recibo"):
        cot = self.cot(fecha)
        api = self.api.post(
            "/cobros/crear",
            {
                "proyecto_id": obra["id"],
                "monto_usd": usd,
                "descripcion": descripcion,
                "fecha": fecha.isoformat(),
                "tipo_factura": tipo_factura,
                "cotizacion_dolar": float(cot),
                "tipo_cambio": "blue",
            },
        )
        cobro = {
            "id": api["id"],
            "obra": obra["clave"],
            "descripcion": descripcion,
            "fecha": fecha,
            "usd": d(usd),
            "ars": a_ars(usd, cot),
            "notas": [],
            "comprobante": comprobante,
        }
        for tipo, monto_usd, fecha_nota, desc_nota, origen in notas:
            cot_nota = self.cot(fecha_nota)
            self.api.archivo(
                f"/cobros/{api['id']}/notas",
                data={
                    "tipo": tipo,
                    "tipo_factura": "factura_b",
                    "monto_usd": str(monto_usd),
                    "cotizacion_dolar": str(cot_nota),
                    "tipo_cambio": "blue",
                    "descripcion": desc_nota,
                    "fecha": fecha_nota.isoformat(),
                    "origen": origen,
                },
            )
            signo = 1 if tipo == "nota_debito" else -1
            cobro["notas"].append(
                {
                    "tipo": tipo,
                    "fecha": fecha_nota,
                    "usd": d(monto_usd) * signo,
                    "ars": a_ars(monto_usd, cot_nota) * signo,
                }
            )
        cobro["neto_usd"] = cobro["usd"] + sum((n["usd"] for n in cobro["notas"]), Decimal(0))
        cobro["neto_ars"] = cobro["ars"] + sum((n["ars"] for n in cobro["notas"]), Decimal(0))
        if comprobante:
            self.api.archivo(f"/cobros/{api['id']}/comprobantes")
        self.cobros.append(cobro)
        return cobro

    def _plazos(self, movimiento, dias, total_inicial, total_final, pagar_antes_de_notas, pagos):
        """Los plazos que tiene que haber armado el backend, y los pagos."""
        n = len(dias)
        fechas = [movimiento["fecha"] + timedelta(days=x) for x in dias]
        montos = dividir(total_inicial if pagar_antes_de_notas else total_final, n)
        if pagos == "vencimiento":
            pagos = [f if f <= self.hoy else None for f in fechas]
        assert len(pagos) == n, f"{movimiento['descripcion']}: {n} plazos y {len(pagos)} pagos"
        return [
            {"vencimiento": f, "monto": m, "pagado": p is not None, "fecha_pago": p}
            for f, m, p in zip(fechas, montos, pagos)
        ]

    def _pagar(self, api_movimiento, plazos):
        por_numero = {p["numero"]: p for p in api_movimiento["plazos"]}
        for numero, plazo in enumerate(plazos, start=1):
            if plazo["pagado"]:
                self.api.put(
                    f"/plazos-pago/{por_numero[numero]['id']}",
                    {"pagado": True, "fecha_pago": plazo["fecha_pago"].isoformat()},
                )

    def compra(
        self,
        obra,
        fase,
        proveedor,
        fecha: date,
        items,
        descripcion,
        iva=IVA_21,
        percepcion=False,
        condicion="Contado",
        pagos="vencimiento",
        notas=(),
        pagar_antes_de_notas=False,
        envio="entregado",
        comprobante=True,
        tipo_factura="factura_a",
    ):
        cot = self.cot(fecha)
        detalle = []
        neto = Decimal(0)
        for clave, cantidad in items:
            precio = d(PRODUCTOS[clave][4])
            assert PRODUCTOS[clave][0] == proveedor, f"{clave} no es de {proveedor}"
            detalle.append(
                {
                    "producto_id": self.ids[f"prod:{clave}"],
                    "cantidad": cantidad,
                    "precio_unitario": float(precio),
                }
            )
            neto += precio * cantidad
        impuestos = []
        if iva:
            impuestos.append((iva, r2(neto * d(IMPUESTOS[iva][0]) / 100)))
        if percepcion:
            impuestos.append((PERCEPCION, r2(neto * d(IMPUESTOS[PERCEPCION][0]) / 100)))

        condicion_api = self.condiciones[condicion]
        api = self.api.post(
            "/compras/crear",
            {
                "fase_id": obra["fases"][fase]["id"],
                "proveedor_id": self.ids[f"prov:{proveedor}"],
                "descripcion": descripcion,
                "precio_neto_ars": float(neto),
                "tipo_factura": "factura_c" if not iva else tipo_factura,
                "fecha": fecha.isoformat(),
                "medio_pago": "transferencia",
                "estado_pago": "pendiente",
                "estado_envio": envio,
                "condicion_pago_id": condicion_api["id"],
                "cotizacion_dolar": float(cot),
                "tipo_cambio": "blue",
                "detalle": detalle,
                "impuestos": [{"impuesto_id": self.ids[n], "monto": float(m)} for n, m in impuestos],
            },
        )
        self._arrancar_fase(obra, fase, fecha)

        total_inicial = neto + sum((m for _, m in impuestos), Decimal(0))
        compra = {
            "id": api["id"],
            "obra": obra["clave"],
            "proveedor": PROVEEDORES[proveedor]["nombre"],
            "descripcion": descripcion,
            "fecha": fecha,
            "cot": cot,
            "neto_ars": neto,
            "neto_usd": a_usd(neto, cot),
            "impuestos_ars": [m for _, m in impuestos],
            "impuestos_usd": [a_usd(m, cot) for _, m in impuestos],
            "notas": [],
            "envio": envio,
            "comprobante": comprobante,
        }

        def registrar_notas():
            for tipo, monto_ars, fecha_nota, desc_nota in notas:
                cot_nota = self.cot(fecha_nota)
                self.api.archivo(
                    f"/compras/{api['id']}/notas",
                    data={
                        "tipo": tipo,
                        "tipo_factura": "factura_a",
                        "descripcion": desc_nota,
                        "fecha": fecha_nota.isoformat(),
                        "cotizacion_dolar": str(cot_nota),
                        "tipo_cambio": "blue",
                        "origen": "acuerdo_comercial",
                        "monto_ars": str(monto_ars),
                    },
                )
                signo = 1 if tipo == "nota_debito" else -1
                compra["notas"].append(
                    {
                        "tipo": tipo,
                        "fecha": fecha_nota,
                        "ars": d(monto_ars) * signo,
                        "usd": a_usd(monto_ars, cot_nota) * signo,
                    }
                )

        total_final = total_inicial + sum(
            (d(m) * (1 if t == "nota_debito" else -1) for t, m, *_ in notas), Decimal(0)
        )
        compra["plazos"] = self._plazos(
            compra, condicion_api["dias"] or [0], total_inicial, total_final, pagar_antes_de_notas, pagos
        )
        if pagar_antes_de_notas:
            self._pagar(api, compra["plazos"])
            registrar_notas()
        else:
            registrar_notas()
            self._pagar(self.api.get(f"/compras/{api['id']}"), compra["plazos"])

        compra["total_ars"] = total_final
        compra["total_usd"] = (
            compra["neto_usd"]
            + sum(compra["impuestos_usd"], Decimal(0))
            + sum((n["usd"] for n in compra["notas"]), Decimal(0))
        )
        if comprobante:
            self.api.archivo(f"/compras/{api['id']}/comprobantes")
        self.compras.append(compra)
        return compra

    def gasto(
        self,
        obra,
        fase,
        fecha: date,
        ars,
        descripcion,
        categorias,
        condicion="Contado",
        pagos="vencimiento",
        comprobante=True,
        tipo_factura="factura_b",
    ):
        cot = self.cot(fecha)
        condicion_api = self.condiciones[condicion]
        api = self.api.post(
            "/gastos/crear",
            {
                "proyecto_id": obra["id"],
                "fase_id": obra["fases"][fase]["id"] if fase else None,
                "monto_ars": ars,
                "descripcion": descripcion,
                "fecha": fecha.isoformat(),
                "tipo_factura": tipo_factura,
                "categoria_gasto_ids": [self.ids[f"gasto:{c}"] for c in categorias],
                "condicion_pago_id": condicion_api["id"],
                "medio_pago": "efectivo",
                "estado_pago": "pendiente",
                "cotizacion_dolar": float(cot),
                "tipo_cambio": "blue",
            },
        )
        self._arrancar_fase(obra, fase, fecha)
        gasto = {
            "id": api["id"],
            "obra": obra["clave"],
            "descripcion": descripcion,
            "fecha": fecha,
            "cot": cot,
            "ars": d(ars),
            "usd": a_usd(ars, cot),
            "categorias": list(categorias),
            "comprobante": comprobante,
        }
        gasto["plazos"] = self._plazos(gasto, condicion_api["dias"] or [0], d(ars), d(ars), False, pagos)
        self._pagar(api, gasto["plazos"])
        if comprobante:
            self.api.archivo(f"/gastos/{api['id']}/comprobantes")
        self.gastos.append(gasto)
        return gasto


# ---------------------------------------------------------------------------
# Las 8 obras
# ---------------------------------------------------------------------------


def sembrar_obras(s: Semilla):  # noqa: PLR0915 -- es una lista de datos
    D = date

    # 1. Terminada con ganancia: splits en una casa, enero a marzo.
    o = s.obra(
        "nordelta",
        "Casa Nordelta – Splits",
        "Barrio Los Lagos, lote 112",
        D(2026, 1, 12),
        16500,
        ["Relevamiento", "Instalación"],
    )
    s.cobro(o, D(2026, 1, 12), 8000, "Anticipo 50 %")
    s.gasto(o, "Relevamiento", D(2026, 1, 14), 45_000, "Viático relevamiento", ["Viáticos"])
    s.compra(
        o,
        "Instalación",
        "clima",
        D(2026, 1, 20),
        [("split_4500", 4), ("split_3000", 2)],
        "Splits BGH (6 equipos)",
        iva=IVA_105,
    )
    s.compra(
        o,
        "Instalación",
        "cobres",
        D(2026, 1, 22),
        [("cobre_38", 3), ("armaflex", 20), ("codos_kit", 2)],
        "Cañería de cobre y aislación",
        condicion="30 días",
    )
    s.compra(
        o, "Instalación", "ramirez", D(2026, 2, 10), [("mo_split", 6)], "Instalación de 6 splits", iva=None
    )
    s.gasto(o, "Instalación", D(2026, 2, 12), 85_000, "Flete de equipos", ["Flete"])
    s.gasto(
        o,
        "Instalación",
        D(2026, 2, 20),
        120_000,
        "Ayudante (changa)",
        ["Mano de obra"],
        tipo_factura="factura_interna",
    )
    s.cobro(
        o,
        D(2026, 3, 16),
        8500,
        "Saldo de obra",
        notas=[("nota_credito", 300, D(2026, 3, 18), "Descuento por demora en la entrega", "ajuste_precio")],
    )
    s.cerrar_fase(o, "Relevamiento", "auditada")
    s.cerrar_fase(o, "Instalación", "terminada")
    s.terminar_obra(o)

    # 2. Terminada con pérdida: VRF en oficinas, con retrabajo de MO.
    o = s.obra(
        "madero",
        "Oficinas Puerto Madero – VRF",
        "Juana Manso 1200, piso 4",
        D(2026, 2, 2),
        38000,
        ["Relevamiento", "Equipos VRF", "Instalación", "Puesta en marcha"],
    )
    s.cobro(o, D(2026, 2, 2), 15000, "Anticipo")
    s.gasto(o, "Relevamiento", D(2026, 2, 5), 950_000, "Arquitecta: planos de obra", ["Honorarios"])
    s.compra(
        o,
        "Equipos VRF",
        "frio",
        D(2026, 2, 23),
        [("vrf_cond_12", 1), ("vrf_int_09", 6), ("vrf_ctrl", 6)],
        "Equipos VRF LG",
        iva=IVA_105,
        condicion="30/60 días",
        notas=[("nota_credito", 1_180_000, D(2026, 3, 10), "NC: una unidad interior no entregada")],
    )
    s.compra(
        o,
        "Instalación",
        "cobres",
        D(2026, 3, 5),
        [("cobre_58", 8), ("cobre_38", 6), ("codos_kit", 4), ("armaflex", 60)],
        "Cañería de cobre VRF",
    )
    s.compra(
        o,
        "Instalación",
        "electrica",
        D(2026, 3, 12),
        [("cable_mallado", 4), ("termica", 6)],
        "Cable mallado y térmicas",
        percepcion=True,
    )
    s.compra(
        o,
        "Instalación",
        "ramirez",
        D(2026, 4, 6),
        [("mo_vrf_int", 6)],
        "Instalación de unidades interiores",
        iva=None,
    )
    s.gasto(o, "Instalación", D(2026, 4, 10), 2_500_000, "Anticipo MO instaladores", ["Mano de obra"])
    s.cobro(o, D(2026, 4, 20), 12000, "Avance de obra")
    s.compra(
        o,
        "Instalación",
        "conductos",
        D(2026, 5, 10),
        [("climaver", 30), ("cinta_alu", 10), ("rejilla", 12)],
        "Conductos y rejillas",
        condicion="30 días",
    )
    s.gasto(o, "Instalación", D(2026, 5, 15), 3_000_000, "Avance MO instaladores", ["Mano de obra"])
    s.gasto(o, "Instalación", D(2026, 5, 18), 120_000, "Flete de placas", ["Flete"])
    s.gasto(
        o,
        "Instalación",
        D(2026, 6, 5),
        6_000_000,
        "Retrabajo de MO (conductos mal armados)",
        ["Mano de obra"],
    )
    s.gasto(o, "Puesta en marcha", D(2026, 6, 10), 2_200_000, "Saldo MO y puesta en marcha", ["Mano de obra"])
    s.cobro(
        o,
        D(2026, 6, 15),
        11000,
        "Saldo de obra",
        notas=[("nota_debito", 800, D(2026, 6, 20), "Adicional: rejillas extra", "acuerdo_comercial")],
    )
    s.gasto(o, None, D(2026, 6, 16), 38_000, "Comisión bancaria", ["Comisiones bancarias"])
    for fase in ["Relevamiento", "Equipos VRF", "Instalación", "Puesta en marcha"]:
        s.cerrar_fase(o, fase, "terminada")
    s.terminar_obra(o)

    # 3. En curso y sana: VRF + calefacción en un edificio, con todos los casos.
    o = s.obra(
        "olleros",
        "Edificio Olleros – VRF y calefacción",
        "Olleros 2540",
        D(2026, 3, 23),
        98000,
        ["Relevamiento", "Equipos VRF", "Calefacción", "Cañería", "Conductos", "Puesta en marcha"],
    )
    s.cobro(o, D(2026, 3, 26), 30000, "Anticipo")
    s.gasto(o, "Relevamiento", D(2026, 3, 30), 620_000, "Arquitecta: anticipo 50 %", ["Honorarios"])
    s.compra(
        o,
        "Equipos VRF",
        "frio",
        D(2026, 4, 1),
        [("vrf_int_09", 6), ("vrf_ctrl", 6)],
        "Unidades interiores VRF",
        iva=IVA_105,
    )
    s.compra(
        o,
        "Equipos VRF",
        "frio",
        D(2026, 4, 4),
        [("vrf_cond_12", 2)],
        "Condensadoras VRF",
        iva=IVA_105,
        condicion="30/60 días",
    )
    # NC por mala facturación sobre una compra YA pagada (caso Terravista).
    s.compra(
        o,
        "Equipos VRF",
        "frio",
        D(2026, 4, 16),
        [("vrf_int_24", 4)],
        "Unidades interiores 24.000",
        iva=IVA_105,
        pagar_antes_de_notas=True,
        notas=[("nota_credito", 1_690_000, D(2026, 6, 14), "NC mal facturación: una unidad de más")],
    )
    s.gasto(o, "Relevamiento", D(2026, 4, 25), 620_000, "Arquitecta: saldo", ["Honorarios"])
    s.compra(
        o,
        "Calefacción",
        "calderas",
        D(2026, 5, 7),
        [("caldera_24", 2), ("radiador_600", 40)],
        "Calderas y radiadores",
        condicion="30 días",
    )
    s.compra(
        o, "Calefacción", "ramirez", D(2026, 6, 1), [("mo_caldera", 2)], "Instalación de calderas", iva=None
    )
    s.cobro(o, D(2026, 6, 2), 40000, "Segundo anticipo")
    s.gasto(
        o, "Relevamiento", D(2026, 7, 1), 80_000, "Planos, carpetas y viáticos", ["Honorarios", "Viáticos"]
    )
    s.gasto(o, "Equipos VRF", D(2026, 7, 16), 280_000, "Flete de equipos", ["Flete"])
    s.gasto(o, "Calefacción", D(2026, 8, 18), 850_000, "Avance MO calefacción", ["Mano de obra"])
    s.compra(
        o,
        "Cañería",
        "cobres",
        D(2026, 9, 25),
        [("cobre_58", 10), ("cobre_38", 8), ("codos_kit", 6), ("armaflex", 80)],
        "Cañería de cobre",
        condicion="30/60 días",
        pagos=[None, None],
    )
    s.compra(
        o, "Cañería", "electrica", D(2026, 9, 28), [("cable_mallado", 6)], "Cable mallado", pagos=[None]
    )  # contado sin pagar: vencido
    s.gasto(o, "Cañería", D(2026, 9, 30), 3_850_000, "Avance MO cañería", ["Mano de obra"])
    s.cobro(o, D(2026, 9, 30), 15000, "Certificado de avance")
    s.gasto(o, None, D(2026, 10, 1), 18_500, "Comisión bancaria", ["Comisiones bancarias"], comprobante=False)
    s.compra(
        o,
        "Conductos",
        "conductos",
        D(2026, 10, 2),
        [("climaver", 40), ("flexible_8", 10), ("cinta_alu", 12), ("rejilla", 16)],
        "Conductos y rejillas",
        percepcion=True,
        condicion="30 días",
        pagos=[None],
    )
    s.gasto(
        o,
        "Conductos",
        D(2026, 10, 8),
        1_540_000,
        "Avance MO conductos",
        ["Mano de obra"],
        condicion="30 días",
        pagos=[None],
    )
    for fase in ["Relevamiento", "Equipos VRF", "Calefacción"]:
        s.cerrar_fase(o, fase, "terminada")

    # 4. En curso y en rojo: se gastó más de lo que se cobró.
    o = s.obra(
        "tigre",
        "Casa Tigre – Calefacción",
        "Av. Cazón 980",
        D(2026, 8, 10),
        24000,
        ["Equipos", "Instalación", "Entrega y garantía"],
    )
    s.cobro(o, D(2026, 8, 12), 5000, "Anticipo")
    s.compra(
        o,
        "Equipos",
        "calderas",
        D(2026, 8, 20),
        [("caldera_24", 1), ("radiador_600", 24), ("piso_rad", 60)],
        "Caldera, radiadores y piso radiante",
        condicion="30/60/90 días",
        pagos=[D(2026, 9, 19), None, None],
    )
    s.compra(
        o,
        "Equipos",
        "cobres",
        D(2026, 9, 10),
        [("cobre_38", 4), ("codos_kit", 2)],
        "Cañería de cobre",
        condicion="30 días",
        pagos=[None],
    )  # vencido el 10/10
    s.gasto(
        o, "Instalación", D(2026, 9, 28), 1_800_000, "MO instalación (primera quincena)", ["Mano de obra"]
    )
    s.gasto(o, "Instalación", D(2026, 9, 29), 95_000, "Flete", ["Flete"], comprobante=False)
    s.gasto(
        o,
        "Instalación",
        D(2026, 10, 5),
        1_200_000,
        "MO instalación (segunda quincena)",
        ["Mano de obra"],
        condicion="30 días",
        pagos=[None],
    )
    s.cerrar_fase(o, "Equipos", "terminada")

    # 5. En curso con una fase estancada (en curso desde julio).
    o = s.obra(
        "palermo",
        "Local Palermo – Conductos",
        "Gorriti 4870",
        D(2026, 7, 13),
        14500,
        ["Relevamiento", "Conductos", "Entrega y garantía"],
    )
    s.cobro(o, D(2026, 7, 13), 7000, "Anticipo")
    s.gasto(o, "Relevamiento", D(2026, 7, 14), 35_000, "Viático relevamiento", ["Viáticos"])
    s.compra(
        o,
        "Conductos",
        "conductos",
        D(2026, 7, 20),
        [("climaver", 24), ("rejilla", 8), ("cinta_alu", 6)],
        "Placas y rejillas",
    )
    s.gasto(o, "Conductos", D(2026, 8, 5), 900_000, "MO conductos", ["Mano de obra"])
    s.gasto(o, "Conductos", D(2026, 9, 1), 700_000, "Avance MO conductos", ["Mano de obra"])
    s.cobro(o, D(2026, 9, 15), 2500, "Avance de obra", comprobante=False)
    # Devolución de 2 placas antes de pagar: el plazo pendiente baja solo.
    s.compra(
        o,
        "Conductos",
        "conductos",
        D(2026, 10, 1),
        [("flexible_8", 12), ("climaver", 10)],
        "Flexibles y placas",
        condicion="30 días",
        pagos=[None],
        notas=[("nota_credito", 210_540, D(2026, 10, 6), "Devolución de 2 placas")],
    )
    s.cerrar_fase(o, "Relevamiento", "terminada")

    # 6. En curso con ejecución alta (más del 85 % del contrato gastado).
    o = s.obra(
        "belgrano",
        "Consultorio Belgrano – Splits",
        "Cabildo 2230, 3° B",
        D(2026, 9, 1),
        9800,
        ["Equipos", "Instalación"],
    )
    s.cobro(o, D(2026, 9, 1), 6000, "Anticipo")
    s.compra(
        o,
        "Equipos",
        "clima",
        D(2026, 9, 3),
        [("split_6000", 2), ("split_4500", 3)],
        "Splits (5 equipos)",
        iva=IVA_105,
    )
    s.compra(
        o,
        "Instalación",
        "ramirez",
        D(2026, 10, 3),
        [("mo_split", 5)],
        "Instalación de 5 splits",
        iva=None,
        condicion="30 días",
        pagos=[None],
    )
    s.gasto(o, "Instalación", D(2026, 10, 3), 60_000, "Flete", ["Flete"])
    s.cobro(o, D(2026, 10, 8), 3800, "Saldo")
    s.gasto(o, "Instalación", D(2026, 10, 9), 650_000, "Materiales de ferretería", ["Varios"])
    s.compra(
        o,
        "Instalación",
        "herrajes",
        D(2026, 10, 10),
        [("soporte_cond", 5)],
        "Soportes para condensadoras",
        envio="pedido",
        comprobante=False,
    )
    s.gasto(o, "Instalación", D(2026, 10, 12), 1_400_000, "MO ayudantes", ["Mano de obra"])
    s.gasto(o, "Instalación", D(2026, 10, 13), 900_000, "Cañería y accesorios de ferretería", ["Varios"])
    s.cerrar_fase(o, "Equipos", "terminada")

    # 7. A iniciar con anticipo cobrado: un cobro NO arranca la obra.
    o = s.obra(
        "pilar",
        "Casa Pilar – Reforma de climatización",
        "Las Magnolias 45",
        D(2026, 11, 2),
        31000,
        ["Relevamiento", "Equipos", "Instalación"],
    )
    s.cobro(o, D(2026, 10, 6), 9000, "Anticipo")

    # 8. A iniciar, vacía y sin precio acordado todavía.
    s.obra(
        "recoleta", "Depto Recoleta – A cotizar", "Ayacucho 1650, 7° A", D(2026, 11, 16), 0, ["Relevamiento"]
    )


# ---------------------------------------------------------------------------
# Lo esperado: reglas de negocio con aritmética simple
# ---------------------------------------------------------------------------

PERIODOS = {"mes": 1, "3m": 3, "6m": 6, "12m": 12, "anio": None, "todo": None}


def inicio_periodo(periodo, hoy: date) -> date | None:
    if periodo == "todo":
        return None
    if periodo == "anio":
        return date(hoy.year, 1, 1)
    total = hoy.year * 12 + hoy.month - 1 - (PERIODOS[periodo] - 1)
    return date(total // 12, total % 12 + 1, 1)


def restar_meses(fecha: date, meses: int) -> date:
    """La misma fecha `meses` antes, con el día recortado al último del mes."""
    total = fecha.year * 12 + fecha.month - 1 - meses
    anio, mes = total // 12, total % 12 + 1
    return date(anio, mes, min(fecha.day, calendar.monthrange(anio, mes)[1]))


def pct(parte, total):
    return float(d(parte) / d(total) * 100) if d(total) > 0 else None


def esperado(s: Semilla) -> dict:
    hoy = s.hoy
    obras = s.obras

    def de(lista, clave):
        return [m for m in lista if m["obra"] == clave]

    def totales(clave, desde=None, hasta=None):
        en = lambda m: (desde is None or m["fecha"] >= desde) and (
            hasta is None or m["fecha"] <= hasta
        )  # noqa
        cobros = [c for c in de(s.cobros, clave) if en(c)]
        compras = [c for c in de(s.compras, clave) if en(c)]
        gastos = [g for g in de(s.gastos, clave) if en(g)]
        t = {
            "movimientos": len(cobros) + len(compras) + len(gastos),
            "ingresos_usd": sum((c["neto_usd"] for c in cobros), Decimal(0)),
            "ingresos_ars": sum((c["neto_ars"] for c in cobros), Decimal(0)),
            "egresos_usd": sum((c["total_usd"] for c in compras), Decimal(0))
            + sum((g["usd"] for g in gastos), Decimal(0)),
            "egresos_ars": sum((c["total_ars"] for c in compras), Decimal(0))
            + sum((g["ars"] for g in gastos), Decimal(0)),
            "compras_ars": sum((c["total_ars"] for c in compras), Decimal(0)),
            "compras_usd": sum((c["total_usd"] for c in compras), Decimal(0)),
        }
        t["resultado_usd"] = t["ingresos_usd"] - t["egresos_usd"]
        t["resultado_ars"] = t["ingresos_ars"] - t["egresos_ars"]
        return t

    # --- por obra (toda la historia) ---
    por_obra = {}
    for clave, obra in obras.items():
        t = totales(clave)
        precio = obra["precio"]
        pct_ej = pct(t["egresos_usd"], precio)
        if t["resultado_usd"] < 0:
            nivel = "problema"
        elif pct_ej is None:
            nivel = "sin_dato"
        elif pct_ej > 85:
            nivel = "atencion"
        else:
            nivel = "resuelto"
        estado = obra.get("estado_final") or ("en_curso" if obra.get("arranco") else "a_iniciar")
        por_obra[clave] = {
            "id": obra["id"],
            "nombre": obra["nombre"],
            "estado": estado,
            "precio_usd": f2(precio),
            "movimientos": t["movimientos"],
            **{k: f2(v) for k, v in t.items() if k != "movimientos"},
            "rentabilidad": pct(t["resultado_usd"], t["ingresos_usd"]) if t["ingresos_usd"] > 0 else None,
            "pct_cobrado": pct(t["ingresos_usd"], precio),
            "pct_ejecutado": pct_ej,
            "nivel": nivel,
            "fases": {
                nombre: {
                    "id": f["id"],
                    "estado": f["estado"],
                    "en_curso_desde": f["desde"].isoformat() if f["desde"] else None,
                }
                for nombre, f in obra["fases"].items()
            },
        }

    # --- Métricas por período ---
    metricas = {}
    for periodo in PERIODOS:
        desde = inicio_periodo(periodo, hoy)
        filas = {c: totales(c, desde) for c in obras}
        filas = {c: t for c, t in filas.items() if t["movimientos"] > 0}
        suma = lambda k: sum((t[k] for t in filas.values()), Decimal(0))  # noqa
        metricas[periodo] = {
            "desde": desde.isoformat() if desde else None,
            "obras": sorted(filas),
            "ingresos_usd": f2(suma("ingresos_usd")),
            "egresos_usd": f2(suma("egresos_usd")),
            "resultado_usd": f2(suma("resultado_usd")),
            "ingresos_ars": f2(suma("ingresos_ars")),
            "egresos_ars": f2(suma("egresos_ars")),
            "resultado_ars": f2(suma("resultado_ars")),
            "compras_usd": f2(suma("compras_usd")),
            "rentabilidad": (
                pct(suma("resultado_usd"), suma("ingresos_usd")) if suma("ingresos_usd") > 0 else None
            ),
        }
    # Período anterior de "6 meses": el mismo tramo, seis meses antes.
    desde_ant = restar_meses(inicio_periodo("6m", hoy), 6)
    hasta_ant = restar_meses(hoy, 6)
    ant = [totales(c, desde_ant, hasta_ant) for c in obras]
    metricas["6m_anterior"] = {
        "desde": desde_ant.isoformat(),
        "hasta": hasta_ant.isoformat(),
        "ingresos_usd": f2(sum((t["ingresos_usd"] for t in ant), Decimal(0))),
        "egresos_usd": f2(sum((t["egresos_usd"] for t in ant), Decimal(0))),
    }

    # --- plazos: vencidos, próximos 30 días, deuda, cash flow ---
    en30 = hoy + timedelta(days=30)
    pendientes = []
    pagos_reales_ars = Decimal(0)
    for tipo, lista in (("compra", s.compras), ("gasto", s.gastos)):
        for m in lista:
            for p in m["plazos"]:
                if p["pagado"]:
                    if p["fecha_pago"] <= hoy:
                        pagos_reales_ars += p["monto"]
                else:
                    pendientes.append(
                        {
                            "tipo": tipo,
                            "descripcion": m["descripcion"],
                            "obra": m["obra"],
                            "vencimiento": p["vencimiento"],
                            "monto_ars": p["monto"],
                        }
                    )
    vencidos = [p for p in pendientes if p["vencimiento"] < hoy]
    proximos = sorted(
        (p for p in pendientes if hoy <= p["vencimiento"] <= en30), key=lambda p: p["vencimiento"]
    )

    entradas_ars = Decimal(0)
    for c in s.cobros:
        if c["fecha"] <= hoy:
            entradas_ars += c["ars"]
        entradas_ars += sum((n["ars"] for n in c["notas"] if n["fecha"] <= hoy), Decimal(0))

    impagas = [c for c in s.compras if not all(p["pagado"] for p in c["plazos"])]
    activos = [
        c
        for c, o in por_obra.items()
        if o["estado"] == "en_curso" or (o["estado"] == "a_iniciar" and o["movimientos"] > 0)
    ]

    estancadas = []
    for c in activos:
        for nombre, f in por_obra[c]["fases"].items():
            if f["estado"] == "en_curso" and (hoy - date.fromisoformat(f["en_curso_desde"])).days >= 30:
                estancadas.append(f"{por_obra[c]['nombre']} / {nombre}")

    sin_comprobante = sum(
        1
        for lista in (s.compras, s.gastos, s.cobros)
        for m in lista
        if m["obra"] in activos and not m["comprobante"]
    )

    falta_cobrar_todas = Decimal(0)
    for o in por_obra.values():
        falta = r2(d(o["precio_usd"]) - d(o["ingresos_usd"]))
        falta_cobrar_todas += falta if falta >= 1 else 0

    panel = {
        "activos": sorted(activos),
        "disponible_total_usd": f2(sum((d(por_obra[c]["resultado_usd"]) for c in activos), Decimal(0))),
        "pendiente_de_cobrar_usd": f2(
            sum(
                (
                    max(Decimal(0), r2(d(por_obra[c]["precio_usd"]) - d(por_obra[c]["ingresos_usd"])))
                    for c in activos
                ),
                Decimal(0),
            )
        ),
        "deuda_proveedores_ars": f2(
            sum((p["monto"] for c in impagas for p in c["plazos"] if not p["pagado"]), Decimal(0))
        ),
        "compras_impagas": len(impagas),
        "compras_vencidas": sum(
            1 for c in impagas if any((not p["pagado"]) and p["vencimiento"] < hoy for p in c["plazos"])
        ),
        "proximos_30_dias": [
            {
                "descripcion": p["descripcion"],
                "obra": p["obra"],
                "vencimiento": p["vencimiento"].isoformat(),
                "monto_ars": f2(p["monto_ars"]),
            }
            for p in proximos
        ],
        "fases_estancadas": sorted(estancadas),
        "compras_sin_entregar": sum(1 for c in s.compras if c["obra"] in activos and c["envio"] == "pedido"),
        "sin_comprobante": sin_comprobante,
    }
    cashflow = {
        "saldo_hoy_ars": f2(entradas_ars - pagos_reales_ars),
        "vencido_ars": f2(sum((p["monto_ars"] for p in vencidos), Decimal(0))),
        "cantidad_vencidos": len(vencidos),
        "a_pagar_30_ars": f2(sum((p["monto_ars"] for p in proximos), Decimal(0))),
        "falta_cobrar_usd": f2(falta_cobrar_todas),
    }

    return {
        "hoy": hoy.isoformat(),
        "ultima_cotizacion": float(s.cotizaciones[max(s.cotizaciones)]),
        "obras": por_obra,
        "metricas": metricas,
        "panel": panel,
        "cashflow": cashflow,
    }


# ---------------------------------------------------------------------------
# Control movimiento por movimiento contra lo que guardó el backend
# ---------------------------------------------------------------------------


def controlar_backend(s: Semilla, api: Api) -> list[str]:
    errores = []

    def igual(que, esperado, obtenido, tolerancia=Decimal("0.005")):
        if obtenido is None or abs(d(esperado) - d(obtenido)) > tolerancia:
            errores.append(f"{que}: esperado {esperado}, el backend devolvió {obtenido}")

    compras = {c["id"]: c for c in api.get("/compras/")}
    for c in s.compras:
        a = compras[c["id"]]
        que = f"compra «{c['descripcion']}»"
        igual(f"{que} neto USD", c["neto_usd"], a["precio_neto_usd"])
        igual(f"{que} total ARS", c["total_ars"], a["precio_total_ars"])
        igual(f"{que} total USD", c["total_usd"], a["precio_total_usd"])
        plazos = sorted(a["plazos"], key=lambda p: p["numero"])
        if len(plazos) != len(c["plazos"]):
            errores.append(f"{que}: {len(c['plazos'])} plazos esperados, hay {len(plazos)}")
            continue
        for esp, obt in zip(c["plazos"], plazos):
            igual(f"{que} plazo {obt['numero']} monto", esp["monto"], obt["monto"])
            if esp["vencimiento"].isoformat() != obt["fecha_vencimiento"] or esp["pagado"] != obt["pagado"]:
                errores.append(f"{que} plazo {obt['numero']}: esperado {esp}, hay {obt}")
        estado = "pagado" if all(p["pagado"] for p in c["plazos"]) else "pendiente"
        if a["estado_pago"] != estado:
            errores.append(f"{que}: estado de pago {a['estado_pago']}, esperado {estado}")

    gastos = {g["id"]: g for g in api.get("/gastos/")}
    for g in s.gastos:
        a = gastos[g["id"]]
        igual(f"gasto «{g['descripcion']}» USD", g["usd"], a["monto_usd"])
        for esp, obt in zip(g["plazos"], sorted(a["plazos"], key=lambda p: p["numero"])):
            igual(f"gasto «{g['descripcion']}» plazo monto", esp["monto"], obt["monto"])
            if esp["pagado"] != obt["pagado"] or esp["vencimiento"].isoformat() != obt["fecha_vencimiento"]:
                errores.append(f"gasto «{g['descripcion']}» plazo: esperado {esp}, hay {obt}")

    cobros = {c["id"]: c for c in api.get("/cobros/")}
    for c in s.cobros:
        a = cobros[c["id"]]
        igual(f"cobro «{c['descripcion']}» ARS", c["ars"], a["monto_ars"])
        igual(f"cobro «{c['descripcion']}» neto USD", c["neto_usd"], a["monto_neto_usd"])
        igual(f"cobro «{c['descripcion']}» neto ARS", c["neto_ars"], a["monto_neto_ars"])

    proyectos = {p["id"]: p for p in api.get("/proyectos/")}
    fases = {f["id"]: f for f in api.get("/fases/")}
    for clave, obra in s.obras.items():
        estado = obra.get("estado_final") or ("en_curso" if obra.get("arranco") else "a_iniciar")
        if proyectos[obra["id"]]["estado"] != estado:
            errores.append(
                f"obra {obra['nombre']}: estado {proyectos[obra['id']]['estado']}, esperado {estado}"
            )
        for nombre, f in obra["fases"].items():
            a = fases[f["id"]]
            desde = f["desde"].isoformat() if f["desde"] else None
            if a["estado"] != f["estado"] or a["fecha_en_curso_desde"] != desde:
                errores.append(
                    f"fase {obra['nombre']} / {nombre}: {a['estado']} desde {a['fecha_en_curso_desde']}, "
                    f"esperado {f['estado']} desde {desde}"
                )
    return errores


# ---------------------------------------------------------------------------
# Programa
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--aplicar", action="store_true", help="vaciar la base local y cargar la demo")
    parser.add_argument(
        "--salida", default="backups/demo", help="carpeta para los JSON (default backups/demo)"
    )
    args = parser.parse_args()

    os.chdir(RAIZ)  # uploads/ y backups/ son relativos a backend/
    from app.config import settings

    if settings.database_host not in HOSTS_LOCALES:
        raise SystemExit(
            f"La base es {settings.database_host}: este script sólo corre contra una base local."
        )
    if settings.S3_BUCKET_NAME:
        raise SystemExit(
            "Hay un bucket configurado (S3_*): los comprobantes de prueba van sólo a disco local."
        )

    from sqlalchemy import text

    from app.db import models
    from app.db.db import Base, SessionLocal, engine

    tablas = sorted(t for t in Base.metadata.tables if t not in TABLAS_QUE_QUEDAN)
    print(f"Base: {settings.database_name} en {settings.database_host}")
    print(f"Se vacían {len(tablas)} tablas: {', '.join(tablas)}")
    if not args.aplicar:
        print("\nSimulacro: no se tocó nada. Para cargar la demo: --aplicar")
        return

    from fastapi.testclient import TestClient

    from app.auth.oAuth2 import create_access_token
    from app.limiter import limiter
    from app.main import app

    with engine.begin() as conn:
        quedan_antes = {
            t: conn.execute(text(f'SELECT count(*) FROM "{t}"')).scalar()
            for t in TABLAS_QUE_QUEDAN - {"alembic_version"}
        }
        conn.execute(text("TRUNCATE " + ", ".join(f'"{t}"' for t in tablas) + " RESTART IDENTITY CASCADE"))
        quedan_despues = {t: conn.execute(text(f'SELECT count(*) FROM "{t}"')).scalar() for t in quedan_antes}
    if quedan_antes != quedan_despues:
        raise SystemExit(f"El TRUNCATE tocó tablas que tenían que quedar: {quedan_antes} -> {quedan_despues}")

    uploads = RAIZ / "uploads"
    if uploads.exists() and any(uploads.iterdir()):
        destino = RAIZ / "backups" / f"uploads_antes_seed_{datetime.now():%Y-%m-%d_%H%M%S}"
        shutil.move(str(uploads), str(destino))
        print(f"Comprobantes viejos movidos a {destino.relative_to(RAIZ)}")

    with SessionLocal() as db:
        admins = (
            db.query(models.Usuario)
            .filter(models.Usuario.rol == "admin", models.Usuario.activo.is_(True))
            .order_by(models.Usuario.nombre_usuario)
            .all()
        )
        # Agus es quien carga en la app de verdad: si está, los movimientos van a su nombre.
        admin = next((u for u in admins if u.nombre_usuario == "Agustin"), admins[0] if admins else None)
        if admin is None:
            raise SystemExit("No hay ningún usuario admin activo en la base local.")
        token = create_access_token(data={"user_id": str(admin.id)})

    for ruidoso in ("httpx", "audit"):
        logging.getLogger(ruidoso).setLevel(logging.WARNING)
    limiter.enabled = False  # cientos de subidas seguidas: el 20/minuto no aplica acá
    from app.plazos import hoy

    with TestClient(app) as cliente:
        api = Api(cliente, {"Authorization": f"Bearer {token}"})
        semilla = Semilla(api, hoy())
        semilla.catalogos()
        sembrar_obras(semilla)

        errores = controlar_backend(semilla, api)
        datos = {
            "proyectos": api.get("/proyectos/"),
            "fases": api.get("/fases/"),
            "gastos": api.get("/gastos/"),
            "cobros": api.get("/cobros/"),
            "compras": api.get("/compras/"),
            "proveedores": api.get("/proveedores/"),
            "cotizacion_actual": api.get("/cotizaciones/ultima"),
        }

    salida = RAIZ / args.salida
    salida.mkdir(parents=True, exist_ok=True)
    (salida / "demo_datos_api.json").write_text(json.dumps(datos, ensure_ascii=False, indent=1))
    (salida / "demo_esperado.json").write_text(json.dumps(esperado(semilla), ensure_ascii=False, indent=1))

    cuenta = {"compras": len(semilla.compras), "gastos": len(semilla.gastos), "cobros": len(semilla.cobros)}
    print(
        f"\nCargado con {admin.nombre_usuario}: {len(semilla.obras)} obras, {cuenta}, "
        f"{len(semilla.cotizaciones)} cotizaciones, {len(PRODUCTOS)} productos."
    )
    print(f"JSON en {salida.relative_to(RAIZ)}/")
    if errores:
        print(f"\n{len(errores)} DIFERENCIAS entre lo esperado y lo que guardó el backend:")
        for e in errores:
            print(f"  - {e}")
        raise SystemExit(1)
    print("Backend: cada movimiento, plazo, fase y obra coincide con lo esperado.")


if __name__ == "__main__":
    main()
