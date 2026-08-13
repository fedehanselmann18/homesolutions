import logging

from fastapi import Depends, FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi import _rate_limit_exceeded_handler
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.db.db import get_db
from app.limiter import limiter
from app.security_middleware import CSRFMiddleware, SecurityHeadersMiddleware, UnhandledExceptionMiddleware
from app.routes import (login,
                        usuarios,
                        proyectos,
                        categorias,
                        categoriagasto,
                        impuestos,
                        proveedores,
                        fases,
                        productos,
                        compras,
                        cobros,
                        gastos,
                        ia)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

app = FastAPI()

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.exception_handler(RequestValidationError)
async def manejador_error_validacion(request: Request, exc: RequestValidationError):
    # Traduce el array técnico default de FastAPI/Pydantic (loc/msg/type por
    # cada campo) a un mensaje legible en español -- ver detalle de cada
    # campo en los logs si hace falta debuggear, acá al usuario solo le
    # importa CUÁLES campos revisar.
    campos = [str(error["loc"][-1]) for error in exc.errors() if error.get("loc")]
    detalle = "Revisá los datos ingresados"
    detalle += f": {', '.join(campos)}." if campos else "."
    return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, content={"detail": detalle})

# Orden de middlewares: Starlette hace user_middleware.insert(0, ...) en cada
# add_middleware (ver build_middleware_stack), o sea que el ÚLTIMO agregado
# termina como capa más externa -- lo contrario de "se ejecutan en el orden
# en que se agregan". CORS tiene que ser la más externa de todas: si un
# middleware interno (CSRF) corta la respuesta antes de tiempo (ej. 403 por
# token CSRF inválido) sin llamar a call_next, esa respuesta nunca pasa por
# los middlewares que quedaron "adentro" de él -- si CORS fuera uno de esos,
# el browser ve "bloqueado por CORS" en vez del 403 real (bug encontrado en
# producción: front y back en dominios distintos, un 403 de CSRF llegaba sin
# headers de CORS y el browser lo mostraba como error de CORS). Por eso CORS
# se agrega al final.
#
# UnhandledExceptionMiddleware se agrega PRIMERO (capa más interna de todas,
# justo al lado del router) por la misma razón pero al revés: si una
# excepción no controlada se escapa hasta el ServerErrorMiddleware que pone
# Starlette por fuera de TODO (más externo que CORS), esa respuesta 500
# tampoco pasaría por CORS. Atrapándola acá adentro, la respuesta que arma
# este middleware sigue su camino de vuelta normal a través de CSRF/
# SecurityHeaders/CORS como cualquier response común.
app.add_middleware(UnhandledExceptionMiddleware)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(CSRFMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-CSRF-Token"],
)

app.include_router(login.router)
app.include_router(usuarios.router)
app.include_router(proyectos.router)
app.include_router(categorias.router)
app.include_router(categoriagasto.router)
app.include_router(impuestos.router)
app.include_router(proveedores.router)
app.include_router(fases.router)
app.include_router(productos.router)
app.include_router(compras.router)
app.include_router(cobros.router)
app.include_router(gastos.router)
app.include_router(ia.router)

@app.get("/")
async def root():
    return {"message": "Welcome to HomeSolutions API!"}


@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content={"status": "error"})
    return {"status": "ok"}
