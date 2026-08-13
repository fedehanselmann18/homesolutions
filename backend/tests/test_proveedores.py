"""Tests de integración de routes/proveedores.py, centrados en la
validación de formato/dígito verificador de CUIT (ver _validar_cuit en
schemas.py, B-08)."""


def _payload(cuit):
    return {"nombre": "Proveedor Test", "cuit": cuit}


def test_crear_proveedor_con_cuit_valido_con_guiones(client, headers_admin):
    respuesta = client.post("/proveedores/crear", json=_payload("20-12345678-6"), headers=headers_admin)
    assert respuesta.status_code == 201
    assert respuesta.json()["cuit"] == "20-12345678-6"


def test_crear_proveedor_con_cuit_valido_sin_guiones(client, headers_admin):
    respuesta = client.post("/proveedores/crear", json=_payload("20123456786"), headers=headers_admin)
    assert respuesta.status_code == 201


def test_crear_proveedor_con_digito_verificador_incorrecto_es_rechazado(client, headers_admin):
    # El detail exacto de _validar_cuit lo aplana manejador_error_validacion
    # (ver main.py) a "Revisá los datos ingresados: cuit." -- alcanza con
    # confirmar que lo rechaza y que señala el campo correcto.
    respuesta = client.post("/proveedores/crear", json=_payload("20-12345678-9"), headers=headers_admin)
    assert respuesta.status_code == 422
    assert "cuit" in respuesta.json()["detail"]


def test_crear_proveedor_con_formato_invalido_es_rechazado(client, headers_admin):
    respuesta = client.post("/proveedores/crear", json=_payload("no-es-un-cuit"), headers=headers_admin)
    assert respuesta.status_code == 422


def test_actualizar_proveedor_con_cuit_invalido_es_rechazado(client, db_session, headers_admin):
    from app.db import models

    proveedor = models.Proveedor(nombre="Proveedor Test", cuit="20-12345678-6")
    db_session.add(proveedor)
    db_session.commit()
    db_session.refresh(proveedor)

    respuesta = client.put(
        f"/proveedores/{proveedor.id}",
        json={"cuit": "99-99999999-9"},
        headers=headers_admin,
    )
    assert respuesta.status_code == 422
