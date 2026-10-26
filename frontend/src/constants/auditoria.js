// Rastro de auditoría: espejo de la tabla `auditoria` del backend (ver
// app/db/models/ y app/core/audit.py). Solo lo ve la cuenta "Manager".

// Las acciones del CRUD de negocio viajan en inglés porque así las viene
// escribiendo log_auditoria desde antes de que existiera la tabla; se
// traducen acá para mostrarlas. Las acciones de mantenimiento de cuentas ya
// llegan como frase en español ("desactivar", "cambiar rol a admin"), así
// que esas se muestran tal cual -- por eso getAccionAuditoria devuelve el
// valor crudo cuando no lo conoce, en vez de un "Desconocido".
//
// El tono es el semáforo del sistema de diseño (ver docs/DESIGN.md): verde
// lo que suma, rojo lo que destruye, oliva (marca) lo que modifica.
const ACCIONES = {
  create: { label: "Creó", tono: "exito" },
  update: { label: "Editó", tono: "marca" },
  delete: { label: "Borró", tono: "peligro" },
};

export function getAccionAuditoria(accion) {
  return ACCIONES[accion] ?? { label: accion, tono: "neutro" };
}

// Cuántas filas por página. La tabla crece sin techo, así que esta es la
// única pantalla de la app con paginado real contra el backend (el resto
// pide la lista completa, ver app/core/pagination.py).
export const FILAS_POR_PAGINA = 25;
