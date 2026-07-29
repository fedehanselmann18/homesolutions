from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
                        comprobantes)
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
app.include_router(comprobantes.router)

@app.get("/")
async def root():
    return {"message": "Welcome to HomeSolutions API!"}