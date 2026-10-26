import logging

from fastapi import Depends, FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api import (
    ai,
    audit_log,
    authentication,
    categories,
    client_payments,
    configuration,
    default_phases,
    exchange_rates,
    expense_categories,
    expenses,
    files,
    invoice_types,
    payment_conditions,
    payment_installments,
    payment_methods,
    phases,
    products,
    projects,
    purchases,
    suppliers,
    taxes,
    users,
)
from app.core.config import settings
from app.core.limiter import limiter
from app.core.security_middleware import (
    CSRFMiddleware,
    RequestSizeLimitMiddleware,
    SecurityHeadersMiddleware,
    UnhandledExceptionMiddleware,
)
from app.db.database import get_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

# En producción, Swagger UI / ReDoc / el schema OpenAPI quedan apagados:
# nadie externo consume esta API, y dejarlos públicos le regala de
# entrada el mapa completo de endpoints y modelos a cualquier bot de
# reconocimiento (son de las primeras rutas que prueban los scanners).
# En dev siguen disponibles para laburar cómodo.
app = FastAPI(
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
    openapi_url="/openapi.json" if settings.ENVIRONMENT != "production" else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.exception_handler(RequestValidationError)
async def manejador_error_validacion(request: Request, exc: RequestValidationError):
    # Traduce el array técnico default de FastAPI/Pydantic (loc/msg/type por
    # cada campo) a un mensaje legible en español. Si el error vino de uno
    # de nuestros field_validator (ej. _validar_cuit, contraseña muy corta)
    # ya escribimos ahí un mensaje puntual en español al levantar el
    # ValueError -- se lo mostramos tal cual en vez de esconderlo (Pydantic
    # v2 antepone "Value error, ", se lo sacamos). Para el resto (campo
    # faltante, tipo incorrecto, etc.) esos mensajes default de Pydantic no
    # son aptos para el usuario, así que seguimos con el resumen genérico
    # por campo -- acá solo importa CUÁLES campos revisar.
    errores = exc.errors()
    mensajes_propios = [
        error["msg"].removeprefix("Value error, ") for error in errores if error.get("type") == "value_error"
    ]
    if mensajes_propios:
        detalle = " ".join(mensajes_propios)
    else:
        campos = [str(error["loc"][-1]) for error in errores if error.get("loc")]
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
# Adentro de CORS (como CSRF): un 413 que corta acá vuelve igual por CORS y el
# browser lo ve como 413 y no como "bloqueado por CORS".
app.add_middleware(RequestSizeLimitMiddleware)
app.add_middleware(CSRFMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-CSRF-Token"],
)

app.include_router(authentication.router)
app.include_router(users.router)
app.include_router(projects.router)
app.include_router(categories.router)
app.include_router(expense_categories.router)
app.include_router(default_phases.router)
app.include_router(taxes.router)
app.include_router(payment_methods.router)
app.include_router(invoice_types.router)
app.include_router(payment_conditions.router)
app.include_router(payment_installments.router)
app.include_router(exchange_rates.router)
app.include_router(suppliers.router)
app.include_router(phases.router)
app.include_router(products.router)
app.include_router(purchases.router)
app.include_router(client_payments.router)
app.include_router(expenses.router)
app.include_router(ai.router)
app.include_router(audit_log.router)
app.include_router(configuration.router)
app.include_router(files.router)


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
