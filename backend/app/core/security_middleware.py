"""
Middlewares chicos, agrupados acá para no ensuciar main.py:

1. SecurityHeadersMiddleware: agrega headers HTTP estándar que mitigan
   ataques comunes (clickjacking, sniffing de content-type, etc.). No
   afectan el comportamiento normal de la API, solo instruyen al browser.

2. CSRFMiddleware: protección CSRF de "doble cookie". Solo entra en juego
   cuando la autenticación viaja por cookie httpOnly (JWT en cookie) en vez
   de header Authorization -- porque un request con Authorization: Bearer
   no es forjable desde un sitio malicioso (el browser no adjunta headers
   custom en requests cross-site automáticos), pero un request con cookie sí
   viaja solo. Requiere que el cliente mande de vuelta, en el header
   X-CSRF-Token, el mismo valor que el server puso en la cookie csrf_token
   (legible por JS a propósito, a diferencia de access_token).

3. LimiteTamanioRequestMiddleware: rechaza requests con un body más grande
   de lo que la app acepta, antes de leerlo (ver la clase).

4. UnhandledExceptionMiddleware: red de seguridad para bugs/fallos no
   anticipados (ej. la DB se cae a mitad de un request). Sin esto, una
   excepción que se escapa de una ruta la agarra Starlette con su
   ServerErrorMiddleware, que es MÁS externo que CORSMiddleware (ver el
   comentario de orden de middlewares en main.py) -- la respuesta de error
   nunca pasaría por CORSMiddleware y el browser la vería como "bloqueado
   por CORS" en vez del 500 real, igual que el bug ya documentado para CSRF.
   Por eso este middleware atrapa la excepción ACÁ (más adentro que CORS,
   ver el orden de app.add_middleware en main.py) y devuelve la respuesta
   él mismo -- así sí pasa por CORS/SecurityHeaders en su camino de vuelta.
"""

import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.config import settings

logger = logging.getLogger(__name__)

MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

# Rutas donde todavía no existe sesión (o se está creando/cerrando), así que
# no puede haber un csrf_token de cookie previo para comparar.
CSRF_EXEMPT_PATHS = {
    "/auth/login",
    "/auth/logout",
    "/usuarios/crear",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        # API pura (JSON + PDFs/comprobantes servidos como attachment): no
        # sirve HTML propio, así que el CSP puede ser todo lo estricto
        # posible sin romper nada.
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
        # Solo con HTTPS real (producción) -- en dev http:// el browser
        # ignora este header igual, pero no tiene sentido mandarlo.
        if settings.ENVIRONMENT == "production":
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        return response


class CSRFMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method in MUTATING_METHODS and request.url.path not in CSRF_EXEMPT_PATHS:
            # Tiene que ser "Bearer ...", no cualquier Authorization: get_token
            # (auth/oauth2.py) ignora los otros esquemas (Basic, etc.) y cae a
            # la cookie -- si acá alcanzara con que el header exista, un
            # "Authorization: Basic x" salteaba el CSRF y autenticaba igual
            # con la cookie.
            tiene_bearer = request.headers.get("authorization", "").lower().startswith("bearer ")
            tiene_cookie_sesion = bool(request.cookies.get("access_token"))

            # Solo exigimos CSRF si la sesión viaja por cookie. Un cliente que
            # ya manda su propio token Bearer (ej. tests, un futuro cliente
            # mobile) no depende de que el browser adjunte nada solo.
            if tiene_cookie_sesion and not tiene_bearer:
                csrf_cookie = request.cookies.get("csrf_token")
                csrf_header = request.headers.get("x-csrf-token")
                if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
                    return JSONResponse(
                        status_code=403,
                        content={"detail": "Token CSRF inválido o faltante"},
                    )

        return await call_next(request)


# Lo más grande que la app acepta es un archivo de 10MB (comprobantes y
# lecturas con IA, ver file_management/storage.py) más los campos del form: 12MB deja
# margen para el encoding multipart sin habilitar nada que no se use.
TAMANIO_MAXIMO_REQUEST = 12 * 1024 * 1024


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """
    Corta con 413 un request que declara un Content-Length más grande que
    TAMANIO_MAXIMO_REQUEST, ANTES de leer el body. Sin esto el servidor
    recibía (y spooleaba a disco) el archivo entero, del tamaño que fuera, y
    recién después la ruta se fijaba si pasaba los 10MB.

    Los browsers siempre mandan Content-Length al subir un FormData. Un
    request sin ese header (chunked) pasa de largo y lo frenan los chequeos de
    tamaño de cada ruta, como antes.
    """

    async def dispatch(self, request: Request, call_next):
        largo = request.headers.get("content-length")
        if largo is not None and largo.isdigit() and int(largo) > TAMANIO_MAXIMO_REQUEST:
            return JSONResponse(
                status_code=413,
                content={"detail": "El archivo es demasiado grande (máximo 10MB)."},
            )
        return await call_next(request)


class UnhandledExceptionMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)
        except Exception:
            # Traceback completo server-side para poder debuggear; al
            # cliente nunca le llega el nombre de la excepción ni el stack.
            logger.exception("Error no controlado en %s %s", request.method, request.url.path)
            return JSONResponse(
                status_code=500,
                content={"detail": "Ocurrió un error inesperado. Intentá de nuevo en unos minutos."},
            )
