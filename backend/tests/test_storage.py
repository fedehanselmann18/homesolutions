"""
Tests de app/files/storage.py, centrados en el cambio de B-15: _validar ya
no lee el archivo entero a memoria de Python, solo los primeros
BYTES_FIRMA bytes para el chequeo de magic bytes, y repone el puntero a 0
para que subir_comprobante pueda streamear el contenido completo al
destino (disco local acá, con R2 no configurado en el entorno de test).
"""

import io

import pytest
from fastapi import HTTPException, UploadFile

from app.files import storage


def _upload(nombre, contenido):
    return UploadFile(filename=nombre, file=io.BytesIO(contenido))


def test_extension_no_permitida():
    archivo = _upload("factura.txt", b"hola")
    with pytest.raises(HTTPException) as exc:
        storage._validar(archivo)
    assert exc.value.status_code == 400


def test_archivo_supera_tamanio_maximo(monkeypatch):
    monkeypatch.setattr(storage, "MAX_SIZE_BYTES", 10)
    archivo = _upload("factura.pdf", b"%PDF-" + b"x" * 20)
    with pytest.raises(HTTPException) as exc:
        storage._validar(archivo)
    assert exc.value.status_code == 400
    assert "10MB" in exc.value.detail


def test_contenido_no_coincide_con_extension():
    archivo = _upload("factura.pdf", b"esto no es un pdf de verdad")
    with pytest.raises(HTTPException) as exc:
        storage._validar(archivo)
    assert exc.value.status_code == 400
    assert "no coincide" in exc.value.detail


def test_validar_solo_lee_los_bytes_de_la_firma_y_repone_el_puntero():
    contenido = b"%PDF-" + b"x" * 1000
    archivo = _upload("factura.pdf", contenido)

    ext = storage._validar(archivo)

    assert ext == ".pdf"
    assert archivo.file.tell() == 0  # el puntero quedó repuesto al inicio
    assert archivo.file.read() == contenido  # el contenido completo sigue disponible para streamear


def test_subir_y_eliminar_comprobante_local_streamea_el_contenido_completo(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "RAIZ_BACKEND", tmp_path)

    contenido = b"\x89PNG\r\n\x1a\n" + b"x" * 5000
    archivo = _upload("foto.png", contenido)

    path_relativo = storage.subir_comprobante(archivo, "comprobantes_compra", "compra-1")

    ruta_completa = tmp_path / path_relativo
    assert ruta_completa.exists()
    assert ruta_completa.read_bytes() == contenido  # llegó completo, no truncado a los bytes de firma

    storage.eliminar_comprobante(path_relativo)
    assert not ruta_completa.exists()


# ---------------------------------------------------------------------------
# _r2_client / reset_r2_client (B-12): singleton con lock en vez de
# @lru_cache, para poder forzar una instancia nueva (ej. tras rotar
# credenciales) sin reiniciar el proceso. boto3.client() no hace ninguna
# llamada de red al construirse, así que se puede probar sin mockear nada.
# ---------------------------------------------------------------------------

def test_r2_client_es_singleton_entre_llamadas():
    storage.reset_r2_client()
    try:
        assert storage._r2_client() is storage._r2_client()
    finally:
        storage.reset_r2_client()


def test_reset_r2_client_fuerza_una_instancia_nueva():
    storage.reset_r2_client()
    try:
        cliente_1 = storage._r2_client()
        storage.reset_r2_client()
        cliente_2 = storage._r2_client()
        assert cliente_1 is not cliente_2
    finally:
        storage.reset_r2_client()
