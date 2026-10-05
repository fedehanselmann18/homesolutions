"""Tests de la tabla de cotizaciones: CRUD, unicidad (fecha, tipo) y la
sugerencia del form (GET /cotizaciones/ultima)."""

from datetime import date, timedelta


def _crear(client, headers, fecha, tipo="blue", valor=1200):
    return client.post(
        "/cotizaciones/crear", json={"fecha": str(fecha), "tipo": tipo, "valor": valor}, headers=headers
    )


def test_crear_y_listar_cotizacion(client, headers_admin):
    respuesta = _crear(client, headers_admin, date(2026, 3, 10), valor=1187.5)
    assert respuesta.status_code == 201, respuesta.text
    assert respuesta.json()["valor"] == 1187.5

    listado = client.get("/cotizaciones/", headers=headers_admin)
    assert listado.status_code == 200
    assert [c["valor"] for c in listado.json()] == [1187.5]


def test_misma_fecha_y_tipo_repetida_explica_el_motivo(client, headers_admin):
    _crear(client, headers_admin, date(2026, 3, 10))
    repetida = _crear(client, headers_admin, date(2026, 3, 10), valor=1300)
    assert repetida.status_code == 400
    assert repetida.json()["detail"] == "Ya hay una cotización de ese tipo cargada para esa fecha"

    # Otro tipo el mismo día sí se puede: el oficial y el blue son distintos.
    assert _crear(client, headers_admin, date(2026, 3, 10), tipo="oficial", valor=1050).status_code == 201


def test_valor_cero_o_negativo_se_rechaza(client, headers_admin):
    for valor in (0, -5):
        respuesta = _crear(client, headers_admin, date(2026, 3, 10), valor=valor)
        assert respuesta.status_code == 422
        assert respuesta.json()["detail"] == "La cotización del dólar tiene que ser mayor a 0"


def test_tipo_invalido_se_rechaza(client, headers_admin):
    respuesta = _crear(client, headers_admin, date(2026, 3, 10), tipo="cripto")
    assert respuesta.status_code == 422


def test_escritura_requiere_admin(client, headers_lectura):
    assert _crear(client, headers_lectura, date(2026, 3, 10)).status_code == 403


def test_ultima_devuelve_la_mas_reciente_hasta_la_fecha_pedida(client, headers_admin):
    _crear(client, headers_admin, date(2026, 3, 1), valor=1100)
    _crear(client, headers_admin, date(2026, 3, 15), valor=1150)
    _crear(client, headers_admin, date(2026, 4, 1), valor=1200)

    respuesta = client.get("/cotizaciones/ultima?tipo=blue&fecha=2026-03-20", headers=headers_admin)
    assert respuesta.status_code == 200
    assert respuesta.json()["valor"] == 1150


def test_ultima_filtra_por_tipo(client, headers_admin):
    _crear(client, headers_admin, date(2026, 3, 1), tipo="oficial", valor=1000)
    _crear(client, headers_admin, date(2026, 3, 1), tipo="blue", valor=1200)

    respuesta = client.get("/cotizaciones/ultima?tipo=oficial&fecha=2026-03-01", headers=headers_admin)
    assert respuesta.json()["valor"] == 1000


def test_ultima_no_mira_el_futuro_por_default(client, headers_admin):
    _crear(client, headers_admin, date.today() - timedelta(days=1), valor=1200)
    _crear(client, headers_admin, date.today() + timedelta(days=5), valor=9999)

    assert client.get("/cotizaciones/ultima", headers=headers_admin).json()["valor"] == 1200


def test_ultima_sin_cotizaciones_devuelve_null(client, headers_admin):
    respuesta = client.get("/cotizaciones/ultima?tipo=blue", headers=headers_admin)
    assert respuesta.status_code == 200
    assert respuesta.json() is None


def test_editar_y_borrar(client, headers_admin):
    creada = _crear(client, headers_admin, date(2026, 3, 10)).json()

    editada = client.put(f"/cotizaciones/{creada['id']}", json={"valor": 1225.75}, headers=headers_admin)
    assert editada.status_code == 200
    assert editada.json()["valor"] == 1225.75

    assert client.delete(f"/cotizaciones/{creada['id']}", headers=headers_admin).status_code == 200
    assert client.get(f"/cotizaciones/{creada['id']}", headers=headers_admin).status_code == 404
