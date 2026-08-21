// La cuenta "Manager" existe solo para resetear contraseñas olvidadas (ver
// requiere_manager en backend/app/auth/oAuth2.py). No es alguien del
// equipo, pero se da de alta como el resto: aparece en el combo de
// /registro hasta que se crea, y en el de /login de ahí en más.
//
// Su sesión queda encerrada en el subárbol de RUTA_RESETEO (ver
// ProtectedRoute) y el sidebar no le muestra ninguna otra página.
export const NOMBRE_USUARIO_MANAGER = "Manager";

// Antes esto era una sola pantalla con secciones apiladas; ahora es un
// subárbol de páginas propias (una por sección), para que cada una tenga su
// propio link en el sidebar en vez de compartir uno. RUTA_RESETEO queda
// como la base del subárbol -- ver esRutaManager -- y sigue siendo el
// nombre porque nació como "resetear contraseña" y cambiarlo no le agrega
// nada a nadie.
export const RUTA_RESETEO = "/resetear-contrasena";
export const RUTA_MANAGER_EQUIPO = `${RUTA_RESETEO}/equipo`;
export const RUTA_MANAGER_AUTORIZADOS = `${RUTA_RESETEO}/autorizados`;
export const RUTA_MANAGER_AUDITORIA = `${RUTA_RESETEO}/auditoria`;
export const RUTA_MANAGER_CONFIGURACION = `${RUTA_RESETEO}/configuracion`;
export const RUTA_MANAGER_ARCHIVOS = `${RUTA_RESETEO}/archivos`;

export const esManager = (usuario) => usuario?.nombre_usuario === NOMBRE_USUARIO_MANAGER;

// Cualquier página del subárbol de Manager (ver ProtectedRoute): el encierro
// bidireccional de esa cuenta ya no es una comparación de ruta exacta, así
// que "estoy en una página de Manager" pasa a ser un prefijo.
export const esRutaManager = (pathname) => pathname.startsWith(RUTA_RESETEO);
