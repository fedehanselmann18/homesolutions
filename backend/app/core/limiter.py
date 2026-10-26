"""
Instancia compartida de slowapi para rate limiting.

Vive en su propio módulo (en vez de crearse en main.py) para evitar imports
circulares: los routers (login.py, usuarios.py) necesitan decorar sus rutas
con @limiter.limit(...), y main.py también necesita el limiter para
registrar el exception handler y el middleware. Si se creara en main.py,
los routers tendrían que importar de app.main, que a su vez importa los
routers -> ciclo.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request


def ip_del_cliente(request: Request) -> str:
    """
    IP con la que se cuentan los intentos, tomada del ÚLTIMO valor de
    X-Forwarded-For y no del primero.

    En Railway el backend corre detrás de su proxy, así que la IP de la
    conexión es la del proxy y la del cliente real viaja en ese header. El
    cliente puede mandar su propio X-Forwarded-For con lo que quiera, y el
    proxy agrega la IP real AL FINAL: el primer valor lo elige el cliente,
    el último lo pone el proxy. uvicorn --proxy-headers con
    --forwarded-allow-ips='*' (ver railway.json) toma el primero para
    request.client.host -- usar get_remote_address solo dejaba saltear el
    límite de /auth/login mandando un X-Forwarded-For distinto en cada
    intento.

    Sin el header (dev local, tests) cae a la IP de la conexión.
    """
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        ultima_ip = forwarded_for.split(",")[-1].strip()
        if ultima_ip:
            return ultima_ip
    return get_remote_address(request)


limiter = Limiter(key_func=ip_del_cliente)
