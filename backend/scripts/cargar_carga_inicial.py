#!/usr/bin/env python3
"""
Carga inicial de catálogos en producción a partir de las respuestas del
Google Form de Agus (docs/carga-inicial/FORM_CARGA_INICIAL.gs).

Qué carga (secciones 1 a 5 del form):
    1. Impuestos                 -> POST /impuestos/crear
    2. Categorías de gasto       -> POST /categorias-gasto/crear
    3. Categorías de equipo      -> POST /categorias/crear  (tipo "equipo")
    4. Categorías de materiales  -> POST /categorias/crear  (tipo "materiales")
    5. Categorías de mano de obra-> POST /categorias/crear  (tipo "mano_obra")

Qué NO carga (sección 6): tipos de comprobante y condiciones de pago no son
tablas, son listas fijas en el código (frontend/src/constants/tipoFactura.js y
estadoCompra.js / ModalCompra.jsx). El script solo avisa si Agus destildó o
agregó alguno, porque eso es un cambio de código, no de datos.

Va por la API (no directo a la base): no hace falta la URL de la base de
Railway y pasa por las mismas validaciones que la app. El usuario con el que
te logueás tiene que tener rol "admin".

Es idempotente: lo que ya existe (mismo nombre, sin importar mayúsculas) se
saltea, así que se puede correr de nuevo sin duplicar. No borra nada.

Uso (sólo stdlib, no hace falta el venv):
    1. En la planilla de respuestas: Archivo > Descargar > CSV.
    2. Simulacro (no escribe nada, muestra qué haría):
         python3 backend/scripts/cargar_carga_inicial.py respuestas.csv
    3. Cargar de verdad:
         python3 backend/scripts/cargar_carga_inicial.py respuestas.csv --aplicar
       Pide usuario y contraseña de un admin. Por default le pega a
       https://api.homesolutions.company (cambiar con --backend).

Si el form tiene más de una respuesta, se usa la última (la más nueva).
"""

import argparse
import csv
import getpass
import http.cookiejar
import json
import sys
import urllib.error
import urllib.parse
import urllib.request

BACKEND_DEFAULT = "https://api.homesolutions.company"

# --- Cómo se reconocen las columnas del CSV --------------------------------
# Google Forms usa el título de la pregunta como encabezado. Se busca por un
# pedazo del título para que retocar la redacción del form no rompa nada.
COLUMNA_IMPUESTOS = "los impuestos pueden ser"
COLUMNA_CAT_GASTO = "cuando cargás un gasto"
COLUMNA_EQUIPO = "producto de tipo equipo"
COLUMNA_MATERIALES = "producto de tipo material"
COLUMNA_MANO_OBRA = "cuando cargás mano de obra"
COLUMNA_ELECTRODOMESTICO = "te sirve como categoría general"
COLUMNA_PARES_MANO_OBRA = "hay tres pares que se pisan"
COLUMNA_TIPO_FACTURA = "el tipo de comprobante puede ser"
COLUMNA_CONDICION_PAGO = "la condición de pago puede ser"
PREFIJO_OBSERVACIONES = "observaciones"

# Las dos preguntas de elección del form deciden sacar categorías aunque
# hayan quedado tildadas en las casillas.
RUBROS = ["Instalación Sanitaria", "Instalación Eléctrica", "Instalación de Aire Acondicionado"]
OFICIOS = ["Plomero", "Electricista", "Instalador de Caños"]

# Sección 6: lo que hoy tiene el código. Si cambian en el front, cambiar acá
# y en el .gs.
TIPOS_FACTURA_CODIGO = ["Factura A", "Factura B", "Factura C", "Remito", "Recibo", "Otros"]
CONDICIONES_PAGO_CODIGO = ["Contado", "Cuenta corriente", "Cheque", "Transferencia"]


# --- Lectura del CSV --------------------------------------------------------


def _clave(texto: str) -> str:
    return " ".join(texto.split()).casefold()


def leer_ultima_respuesta(ruta: str) -> dict[str, str]:
    with open(ruta, newline="", encoding="utf-8-sig") as f:
        filas = list(csv.DictReader(f))
    if not filas:
        raise SystemExit(f"El CSV {ruta} no tiene respuestas.")
    return filas[-1]


def buscar_columna(respuesta: dict[str, str], pedazo: str, obligatoria: bool = True) -> str:
    for titulo, valor in respuesta.items():
        if titulo and pedazo in _clave(titulo):
            return valor or ""
    if obligatoria:
        raise SystemExit(f'No encontré en el CSV la columna de la pregunta que dice "{pedazo}".')
    return ""


def separar_opciones(valor: str) -> list[str]:
    """'IVA, Percepción de IVA, Tasa municipal' -> lista, sin vacíos ni repetidos.

    Google Forms junta las casillas tildadas y el texto de "Otro" en la misma
    celda, separados por coma; al texto de "Otro" le pedimos a Agus que
    también separe con coma, así que se parte todo igual.
    """
    vistos: set[str] = set()
    opciones: list[str] = []
    for parte in valor.split(","):
        nombre = " ".join(parte.split())
        if nombre and _clave(nombre) not in vistos:
            vistos.add(_clave(nombre))
            opciones.append(nombre)
    return opciones


def _sin(lista: list[str], sacar: list[str]) -> list[str]:
    sacar_claves = {_clave(s) for s in sacar}
    return [x for x in lista if _clave(x) not in sacar_claves]


# --- Armado del plan ------------------------------------------------------


def armar_plan(respuesta: dict[str, str]) -> dict:
    equipo = separar_opciones(buscar_columna(respuesta, COLUMNA_EQUIPO))
    materiales = separar_opciones(buscar_columna(respuesta, COLUMNA_MATERIALES))
    mano_obra = separar_opciones(buscar_columna(respuesta, COLUMNA_MANO_OBRA))

    electro = _clave(buscar_columna(respuesta, COLUMNA_ELECTRODOMESTICO, obligatoria=False))
    if electro.startswith("no"):
        equipo = _sin(equipo, ["Electrodoméstico"])

    pares = _clave(buscar_columna(respuesta, COLUMNA_PARES_MANO_OBRA, obligatoria=False))
    if pares.startswith("por rubro"):
        mano_obra = _sin(mano_obra, OFICIOS)
    elif pares.startswith("por oficio"):
        mano_obra = _sin(mano_obra, RUBROS)

    categorias = (
        [(n, "equipo") for n in equipo]
        + [(n, "materiales") for n in materiales]
        + [(n, "mano_obra") for n in mano_obra]
    )

    # En la base el nombre de categoría es único para los tres tipos juntos:
    # si Agus escribió el mismo nombre en dos secciones, se carga sólo la
    # primera y se avisa.
    conflictos = []
    vistos: dict[str, str] = {}
    categorias_ok = []
    for nombre, tipo in categorias:
        if _clave(nombre) in vistos:
            conflictos.append((nombre, vistos[_clave(nombre)], tipo))
            continue
        vistos[_clave(nombre)] = tipo
        categorias_ok.append((nombre, tipo))

    return {
        "impuestos": separar_opciones(buscar_columna(respuesta, COLUMNA_IMPUESTOS)),
        "categorias_gasto": separar_opciones(buscar_columna(respuesta, COLUMNA_CAT_GASTO)),
        "categorias": categorias_ok,
        "conflictos": conflictos,
        "tipos_factura": separar_opciones(buscar_columna(respuesta, COLUMNA_TIPO_FACTURA, obligatoria=False)),
        "condiciones_pago": separar_opciones(
            buscar_columna(respuesta, COLUMNA_CONDICION_PAGO, obligatoria=False)
        ),
        "observaciones": {
            titulo: valor.strip()
            for titulo, valor in respuesta.items()
            if titulo and _clave(titulo).startswith(PREFIJO_OBSERVACIONES) and (valor or "").strip()
        },
    }


def diferencias_con_codigo(elegidos: list[str], en_codigo: list[str]) -> tuple[list[str], list[str]]:
    """(lo que Agus agregó y el código no tiene, lo que el código tiene y Agus no tildó)."""
    codigo = {_clave(x) for x in en_codigo}
    elegidos_claves = {_clave(x) for x in elegidos}
    nuevos = [x for x in elegidos if _clave(x) not in codigo]
    destildados = [x for x in en_codigo if _clave(x) not in elegidos_claves]
    return nuevos, destildados


# --- Cliente de la API ----------------------------------------------------


class Api:
    def __init__(self, base: str):
        self.base = base.rstrip("/")
        self.cookies = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies))

    def _pedir(self, metodo: str, ruta: str, cuerpo=None, form: bool = False):
        headers = {"Accept": "application/json"}
        datos = None
        if cuerpo is not None:
            if form:
                datos = urllib.parse.urlencode(cuerpo).encode()
                headers["Content-Type"] = "application/x-www-form-urlencoded"
            else:
                datos = json.dumps(cuerpo).encode()
                headers["Content-Type"] = "application/json"
        # La sesión viaja por cookie, así que el backend exige el doble
        # envío del token CSRF en los POST (ver security_middleware.py).
        csrf = next((c.value for c in self.cookies if c.name == "csrf_token"), None)
        if csrf:
            headers["X-CSRF-Token"] = csrf
        req = urllib.request.Request(self.base + ruta, data=datos, headers=headers, method=metodo)
        try:
            with self.opener.open(req, timeout=20) as resp:
                cuerpo_resp = resp.read()
                return resp.status, json.loads(cuerpo_resp) if cuerpo_resp else None
        except urllib.error.HTTPError as e:
            texto = e.read().decode(errors="replace")
            try:
                detalle = json.loads(texto).get("detail", texto)
            except (ValueError, AttributeError):
                detalle = texto
            return e.code, detalle

    def login(self, usuario: str, password: str):
        status, detalle = self._pedir(
            "POST", "/auth/login", {"username": usuario, "password": password}, form=True
        )
        if status != 200:
            raise SystemExit(f"No pude loguearme ({status}): {detalle}")

    def listar(self, ruta: str) -> list[dict]:
        status, datos = self._pedir("GET", ruta)
        if status != 200:
            raise SystemExit(f"GET {ruta} devolvió {status}: {datos}")
        # Por si algún listado viene paginado ({"items": [...]}).
        return datos["items"] if isinstance(datos, dict) and "items" in datos else datos

    def crear(self, ruta: str, cuerpo: dict):
        return self._pedir("POST", ruta, cuerpo)


# --- Ejecución ------------------------------------------------------------


def imprimir_plan(plan: dict):
    print("\n== Lo que eligió Agus ==")
    print(f"Impuestos ({len(plan['impuestos'])}): {', '.join(plan['impuestos']) or '-'}")
    print(
        f"Categorías de gasto ({len(plan['categorias_gasto'])}): {', '.join(plan['categorias_gasto']) or '-'}"
    )
    for tipo in ("equipo", "materiales", "mano_obra"):
        nombres = [n for n, t in plan["categorias"] if t == tipo]
        print(f"Categorías de {tipo} ({len(nombres)}): {', '.join(nombres) or '-'}")

    for nombre, tipo_1, tipo_2 in plan["conflictos"]:
        print(f'  ! "{nombre}" está en {tipo_1} y en {tipo_2}; se carga sólo como {tipo_1}.')

    avisos = []
    for etiqueta, elegidos, codigo in (
        ("tipo de comprobante", plan["tipos_factura"], TIPOS_FACTURA_CODIGO),
        ("condición de pago", plan["condiciones_pago"], CONDICIONES_PAGO_CODIGO),
    ):
        if not elegidos:
            continue
        nuevos, destildados = diferencias_con_codigo(elegidos, codigo)
        if nuevos:
            avisos.append(f"Agus agregó {etiqueta}: {', '.join(nuevos)}")
        if destildados:
            avisos.append(f"Agus no tildó {etiqueta}: {', '.join(destildados)}")
    print("\n== Sección 6 (comprobantes y pagos: viven en el código, no se cargan) ==")
    if avisos:
        for a in avisos:
            print(f"  ! {a} -> si lo querés reflejar, es un cambio de código.")
    else:
        print("  Coincide con lo que ya tiene la app. No hay nada que hacer.")

    if plan["observaciones"]:
        print("\n== Observaciones de Agus (leelas antes de aplicar) ==")
        for titulo, texto in plan["observaciones"].items():
            print(f"  {titulo}: {texto}")


def aplicar(api: Api, plan: dict) -> int:
    errores = 0
    grupos = [
        ("Impuestos", "/impuestos/", "/impuestos/crear", [({"nombre": n}) for n in plan["impuestos"]]),
        (
            "Categorías de gasto",
            "/categorias-gasto/",
            "/categorias-gasto/crear",
            [{"nombre": n} for n in plan["categorias_gasto"]],
        ),
        (
            "Categorías",
            "/categorias/",
            "/categorias/crear",
            [{"nombre": n, "tipo": t} for n, t in plan["categorias"]],
        ),
    ]
    print("\n== Cargando ==")
    for titulo, ruta_listar, ruta_crear, cuerpos in grupos:
        existentes = {_clave(x["nombre"]): x for x in api.listar(ruta_listar)}
        creados = salteados = 0
        for cuerpo in cuerpos:
            previo = existentes.get(_clave(cuerpo["nombre"]))
            if previo:
                salteados += 1
                if "tipo" in cuerpo and previo.get("tipo") != cuerpo["tipo"]:
                    print(
                        f'  ! "{cuerpo["nombre"]}" ya existe como {previo.get("tipo")}, '
                        f'no como {cuerpo["tipo"]}; no la toqué.'
                    )
                continue
            status, detalle = api.crear(ruta_crear, cuerpo)
            if status == 201:
                creados += 1
            else:
                errores += 1
                print(f'  x {titulo}: "{cuerpo["nombre"]}" -> {status}: {detalle}')
        print(f"{titulo}: {creados} creados, {salteados} ya estaban.")
    return errores


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("csv", help="CSV descargado de la planilla de respuestas del form")
    parser.add_argument("--aplicar", action="store_true", help="cargar de verdad (sin esto es un simulacro)")
    parser.add_argument("--backend", default=BACKEND_DEFAULT)
    parser.add_argument("--usuario", help="nombre de usuario admin (si no, lo pregunta)")
    args = parser.parse_args(argv)

    plan = armar_plan(leer_ultima_respuesta(args.csv))
    imprimir_plan(plan)

    if not args.aplicar:
        print("\nSimulacro: no se cargó nada. Para cargar, repetí con --aplicar.")
        return 0

    api = Api(args.backend)
    usuario = args.usuario or input(f"\nUsuario admin en {args.backend}: ").strip()
    api.login(usuario, getpass.getpass("Contraseña: "))
    errores = aplicar(api, plan)
    if errores:
        print(
            f"\nTerminó con {errores} error(es). Lo que se creó, quedó; podés corregir y volver a correrlo."
        )
        return 1
    print("\nListo. Revisalo en la app, en Catálogos.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
