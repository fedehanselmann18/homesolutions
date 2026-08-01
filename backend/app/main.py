from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi import _rate_limit_exceeded_handler

from app.config import settings
from app.limiter import limiter
from app.security_middleware import CSRFMiddleware, SecurityHeadersMiddleware
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
app = FastAPI()

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Orden de middlewares (Starlette los ejecuta en orden inverso al que se
# agregan): CORS tiene que quedar como la capa más externa para que
# responda bien los preflight OPTIONS antes de que CSRF/rate limit los vean.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(CSRFMiddleware)
app.add_middleware(SlowAPIMiddleware)

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
