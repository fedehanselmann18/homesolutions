"""
Dos middlewares chicos, agrupados acá para no ensuciar main.py:

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
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.config import settings

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
            tiene_auth_header = bool(request.headers.get("authorization"))
            tiene_cookie_sesion = bool(request.cookies.get("access_token"))

            # Solo exigimos CSRF si la sesión viaja por cookie. Un cliente que
            # ya manda su propio Authorization header (ej. tests, un futuro
            # cliente mobile) no depende de que el browser adjunte nada solo.
            if tiene_cookie_sesion and not tiene_auth_header:
                csrf_cookie = request.cookies.get("csrf_token")
                csrf_header = request.headers.get("x-csrf-token")
                if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
                    return JSONResponse(
                        status_code=403,
                        content={"detail": "Token CSRF inválido o faltante"},
                    )

        return await call_next(request)
