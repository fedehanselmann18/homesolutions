#!/usr/bin/env python3
"""
Smoke test post-deploy para HomeSolutions.

Le pega de verdad a la URL pública del backend (Railway) y del frontend
(Vercel) para confirmar que un deploy nuevo levantó bien -- sin tocar datos,
solo lecturas y un chequeo de CORS. No reemplaza a pytest (que corre en
memoria, sin salir a internet): esto SÍ sale a la red real, por eso sirve
para agarrar justamente los bugs que encontramos en el primer deploy
(CORS mal configurado, errores sin headers de CORS por el orden de
middlewares, etc.) -- cosas que pytest no puede ver porque nunca las prueba
contra la infraestructura real.

Uso:
    cd backend && python3 scripts/smoke_test.py
    python3 scripts/smoke_test.py --backend https://otra-url.example --frontend https://otra-url.example

Se puede correr después de cada deploy nuevo (Railway y/o Vercel) para
confirmar que todo sigue andando antes de ponerse a probar a mano.
"""

import argparse
import json
import sys
import urllib.error
import urllib.request

BACKEND_DEFAULT = "https://api.homesolutions.company"
# Con www: el dominio pelado (homesolutions.company) redirige con un 308 a
# www, y no está entre los orígenes de CORS del backend -- probar contra él
# daba 3 FAIL en cada deploy aunque la app anduviera bien.
FRONTEND_DEFAULT = "https://www.homesolutions.company"

VERDE = "\033[32m"
ROJO = "\033[31m"
RESET = "\033[0m"


def get(url, headers=None):
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=10) as resp:
        # resp.headers y no dict(resp.headers): el objeto busca sin importar
        # mayúsculas, el dict no -- y el proxy de Railway manda los headers
        # en minúsculas ("access-control-allow-origin").
        return resp.status, resp.headers, resp.read()


def chequeo(nombre, fn):
    try:
        fn()
        print(f"[{VERDE}OK{RESET}] {nombre}")
        return True
    except AssertionError as e:
        print(f"[{ROJO}FAIL{RESET}] {nombre} -- {e}")
        return False
    except Exception as e:
        print(f"[{ROJO}FAIL{RESET}] {nombre} -- {type(e).__name__}: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--backend",
        default=BACKEND_DEFAULT,
        help="URL del backend (default: el dominio propio de producción)",
    )
    parser.add_argument(
        "--frontend",
        default=FRONTEND_DEFAULT,
        help="URL del frontend (default: el dominio propio de producción)",
    )
    args = parser.parse_args()
    backend = args.backend.rstrip("/")
    frontend = args.frontend.rstrip("/")

    def check_root():
        status, _, body = get(f"{backend}/")
        assert status == 200, f"status {status}"
        data = json.loads(body)
        assert "message" in data, "la respuesta no tiene 'message'"

    def check_login_options():
        status, _, body = get(f"{backend}/usuarios/login-options")
        assert status == 200, f"status {status}"
        data = json.loads(body)
        assert isinstance(data, list), "no devolvió una lista"
        assert len(data) > 0, "la lista de usuarios vino vacía"

    def check_cors_preflight():
        # Simula el preflight que manda el browser antes de un POST desde
        # el frontend real. Si esto falla, cualquier login o creación desde
        # Vercel se rompe -- justo el bug que encontramos en esta sesión.
        req = urllib.request.Request(
            f"{backend}/auth/login",
            method="OPTIONS",
            headers={
                "Origin": frontend,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            # Sin dict(): ver el comentario en get().
            allow_origin = resp.headers.get("Access-Control-Allow-Origin")
        assert allow_origin == frontend, (
            f"Access-Control-Allow-Origin={allow_origin!r}, esperaba {frontend!r} "
            f"-- revisar FRONTEND_ORIGINS en las variables de Railway"
        )

    def check_login_invalido_trae_cors():
        # Un login con credenciales inventadas tiene que dar 401 CON headers
        # de CORS -- no "bloqueado por CORS" en la consola del browser (el
        # otro bug real: errores que se cortan antes de pasar por el
        # middleware de CORS, por el orden en que se agregan en main.py).
        req = urllib.request.Request(
            f"{backend}/auth/login",
            method="POST",
            data=b"username=usuario-que-no-existe&password=lo-que-sea",
            headers={
                "Origin": frontend,
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )
        try:
            urllib.request.urlopen(req, timeout=10)
            raise AssertionError("esperaba 401, la request no tiró error")
        except urllib.error.HTTPError as e:
            assert e.code == 401, f"status {e.code} (esperaba 401)"
            allow_origin = e.headers.get("Access-Control-Allow-Origin")
            assert allow_origin == frontend, (
                "la respuesta de error no trae Access-Control-Allow-Origin -- "
                "revisar que CORSMiddleware sea el último add_middleware en main.py"
            )

    def check_frontend():
        status, _, body = get(f"{frontend}/")
        assert status == 200, f"status {status}"
        assert b'id="root"' in body, 'no parece la SPA de HomeSolutions (sin <div id="root">)'

    resultados = [
        chequeo("Backend responde en /", check_root),
        chequeo("GET /usuarios/login-options", check_login_options),
        chequeo("CORS preflight (OPTIONS /auth/login)", check_cors_preflight),
        chequeo("Login inválido da 401 con headers de CORS", check_login_invalido_trae_cors),
        chequeo("Frontend en Vercel responde", check_frontend),
    ]

    print()
    if all(resultados):
        print(f"Todo OK ({len(resultados)}/{len(resultados)})")
        sys.exit(0)
    else:
        fallidos = len(resultados) - sum(resultados)
        print(f"{fallidos} de {len(resultados)} chequeos fallaron")
        sys.exit(1)


if __name__ == "__main__":
    main()
