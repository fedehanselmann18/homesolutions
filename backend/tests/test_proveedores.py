"""Tests de integración de app/api/suppliers.py, centrados en la
validación de formato/dígito verificador de CUIT (ver _validar_cuit en
schemas/, B-08)."""


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
    # manejador_error_validacion (ver main.py) muestra el mensaje puntual de
    # _validar_cuit tal cual -- no solo "revisá el campo cuit", sino por qué.
    respuesta = client.post("/proveedores/crear", json=_payload("20-12345678-9"), headers=headers_admin)
    assert respuesta.status_code == 422
    assert "dígito verificador" in respuesta.json()["detail"]


def test_crear_proveedor_con_formato_invalido_es_rechazado(client, headers_admin):
    respuesta = client.post("/proveedores/crear", json=_payload("no-es-un-cuit"), headers=headers_admin)
    assert respuesta.status_code == 422
    assert "formato" in respuesta.json()["detail"]


def test_actualizar_proveedor_con_cuit_invalido_es_rechazado(client, db_session, headers_admin):
    from app.db import models

    proveedor = models.Supplier(nombre="Proveedor Test", cuit="20-12345678-6")
    db_session.add(proveedor)
    db_session.commit()
    db_session.refresh(proveedor)

    respuesta = client.put(
        f"/proveedores/{proveedor.id}",
        json={"cuit": "99-99999999-9"},
        headers=headers_admin,
    )
    assert respuesta.status_code == 422


# ---------------------------------------------------------------------------
# CUIT opcional: hay proveedores (distribuidoras, comercios chicos) de los que
# no se tiene el dato fiscal. Se puede omitir, pero si se manda algo tiene que
# ser válido igual -- un CUIT a medias es peor que no tenerlo.
# ---------------------------------------------------------------------------


def test_crear_proveedor_sin_cuit(client, headers_admin):
    respuesta = client.post(
        "/proveedores/crear", json={"nombre": "Distribuidora Sin CUIT"}, headers=headers_admin
    )
    assert respuesta.status_code == 201
    assert respuesta.json()["cuit"] is None


def test_crear_proveedor_con_cuit_null_explicito(client, headers_admin):
    respuesta = client.post("/proveedores/crear", json=_payload(None), headers=headers_admin)
    assert respuesta.status_code == 201
    assert respuesta.json()["cuit"] is None


def test_crear_proveedor_con_cuit_vacio_se_guarda_como_null(client, headers_admin):
    """El front manda "" cuando el input queda en blanco -- se normaliza a
    None para no tener dos formas distintas de decir "no lo sé"."""
    respuesta = client.post("/proveedores/crear", json=_payload("   "), headers=headers_admin)
    assert respuesta.status_code == 201
    assert respuesta.json()["cuit"] is None


def test_borrar_el_cuit_de_un_proveedor_existente(client, db_session, headers_admin):
    from app.db import models

    proveedor = models.Supplier(nombre="Proveedor Test", cuit="20-12345678-6")
    db_session.add(proveedor)
    db_session.commit()
    db_session.refresh(proveedor)

    respuesta = client.put(f"/proveedores/{proveedor.id}", json={"cuit": ""}, headers=headers_admin)
    assert respuesta.status_code == 200
    assert respuesta.json()["cuit"] is None


def test_un_cuit_invalido_sigue_siendo_rechazado_aunque_sea_opcional(client, headers_admin):
    respuesta = client.post("/proveedores/crear", json=_payload("20-12345678-9"), headers=headers_admin)
    assert respuesta.status_code == 422
