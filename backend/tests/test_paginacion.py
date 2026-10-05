"""
Tests de paginación (B-01) en los listados "generales" (GET /compras/,
/gastos/, /cobros/, /productos/, /proveedores/): limit/offset son
OPCIONALES y sin default de truncado -- si no se mandan, la respuesta
sigue siendo la lista completa (decisión explícita: Dashboard.jsx,
Comparador.jsx y varios dropdowns del frontend todavía esperan la lista
completa de una sola llamada, ver app/pagination.py). NO se tocaron los
endpoints "vista de proyecto/fase" (ej. /compras/fases/{id}/compras) ni
/productos/proveedores/{id}/productos: son rollups financieros o catálogos
de selección que no deben truncarse.
"""

from datetime import date

from app.db import models


def _crear_proveedores(db_session, cantidad):
    proveedores = [models.Proveedor(nombre=f"Proveedor {i}", cuit="20-12345678-6") for i in range(cantidad)]
    db_session.add_all(proveedores)
    db_session.commit()
    return proveedores


def test_listado_de_proveedores_sin_parametros_devuelve_todo(client, db_session, headers_admin):
    _crear_proveedores(db_session, 5)

    respuesta = client.get("/proveedores/", headers=headers_admin)

    assert respuesta.status_code == 200
    assert len(respuesta.json()) == 5


def test_listado_de_proveedores_respeta_limit_y_offset(client, db_session, headers_admin):
    _crear_proveedores(db_session, 5)

    primera_pagina = client.get("/proveedores/?limit=2&offset=0", headers=headers_admin).json()
    segunda_pagina = client.get("/proveedores/?limit=2&offset=2", headers=headers_admin).json()

    assert len(primera_pagina) == 2
    assert len(segunda_pagina) == 2
    ids_primera = {p["id"] for p in primera_pagina}
    ids_segunda = {p["id"] for p in segunda_pagina}
    assert ids_primera.isdisjoint(ids_segunda)  # páginas distintas, sin superposición


def test_listado_de_proveedores_limit_fuera_de_rango_da_422(client, headers_admin):
    assert client.get("/proveedores/?limit=0", headers=headers_admin).status_code == 422
    assert client.get("/proveedores/?limit=501", headers=headers_admin).status_code == 422
    assert client.get("/proveedores/?offset=-1", headers=headers_admin).status_code == 422


def test_listado_de_productos_respeta_limit(client, db_session, headers_admin):
    proveedor = models.Proveedor(nombre="Proveedor Test", cuit="20-12345678-6")
    db_session.add(proveedor)
    db_session.commit()
    db_session.refresh(proveedor)
    db_session.add_all(
        [
            models.Producto(proveedor_id=proveedor.id, marca="A", modelo=str(i), tipo="equipo", precio=1000)
            for i in range(4)
        ]
    )
    db_session.commit()

    respuesta = client.get("/productos/?limit=1", headers=headers_admin)
    assert respuesta.status_code == 200
    assert len(respuesta.json()) == 1


def test_productos_por_proveedor_no_se_pagina(client, db_session, headers_admin):
    """Vista de catálogo de un proveedor puntual (selector de producto en
    ModalCompra) -- tiene que seguir devolviendo todo, sin limit/offset."""
    proveedor = models.Proveedor(nombre="Proveedor Test", cuit="20-12345678-6")
    db_session.add(proveedor)
    db_session.commit()
    db_session.refresh(proveedor)
    db_session.add_all(
        [
            models.Producto(proveedor_id=proveedor.id, marca="A", modelo=str(i), tipo="equipo", precio=1000)
            for i in range(4)
        ]
    )
    db_session.commit()

    respuesta = client.get(f"/productos/proveedores/{proveedor.id}/productos", headers=headers_admin)
    assert respuesta.status_code == 200
    assert len(respuesta.json()) == 4


def _crear_gastos(db_session, usuario_admin, cantidad):
    proyecto = models.Proyecto(
        nombre="Proyecto Test",
        direccion="Calle 1",
        fecha_inicio=date(2026, 1, 1),
        estado="en_curso",
        precio_acordado_usd=1000000,
    )
    db_session.add(proyecto)
    db_session.commit()
    db_session.refresh(proyecto)
    gastos = [
        models.Gasto(
            proyecto_id=proyecto.id,
            usuario_id=usuario_admin.id,
            monto=1000,
            descripcion=f"Gasto {i}",
            fecha=date(2026, 1, 1),
            tipo_factura="factura_b",
        )
        for i in range(cantidad)
    ]
    db_session.add_all(gastos)
    db_session.commit()
    return proyecto, gastos


def test_listado_de_gastos_respeta_limit_y_offset(client, db_session, headers_admin, usuario_admin):
    proyecto, _ = _crear_gastos(db_session, usuario_admin, 5)

    pagina = client.get("/gastos/?limit=3", headers=headers_admin).json()
    assert len(pagina) == 3

    # La vista de rollup por proyecto NO se toca -- sigue trayendo todo.
    todos = client.get(f"/gastos/proyectos/{proyecto.id}/gastos", headers=headers_admin).json()
    assert len(todos) == 5
