// La cuenta "Manager" existe solo para resetear contraseñas olvidadas (ver
// requiere_manager en backend/app/auth/oAuth2.py). No es alguien del
// equipo, pero se da de alta como el resto: aparece en el combo de
// /registro hasta que se crea, y en el de /login de ahí en más.
//
// Su sesión queda encerrada en RUTA_RESETEO (ver ProtectedRoute) y el
// sidebar no le muestra ninguna otra página.
export const NOMBRE_USUARIO_MANAGER = "Manager";

export const RUTA_RESETEO = "/resetear-contrasena";

export const esManager = (usuario) => usuario?.nombre_usuario === NOMBRE_USUARIO_MANAGER;
