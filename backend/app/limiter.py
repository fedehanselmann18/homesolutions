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

limiter = Limiter(key_func=get_remote_address)
