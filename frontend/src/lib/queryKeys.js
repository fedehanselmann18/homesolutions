// Fuente única de query keys para React Query. Todas las pantallas que
// necesitan el mismo recurso (proyecto, fases, compras, gastos, cobros,
// productos, proveedores) tienen que armar la key acá para que React Query
// dedupe el fetch en vez de pedirlo de nuevo al cambiar de pestaña.
export const queryKeys = {
    proyectos: {
        all: ["proyectos"],
        detail: (proyectoId) => ["proyectos", proyectoId],
    },
    fases: {
        all: ["fases"],
        byProyecto: (proyectoId) => ["fases", "proyecto", proyectoId],
        detail: (faseId) => ["fases", "detalle", faseId],
    },
    gastos: {
        all: ["gastos"],
        byProyecto: (proyectoId) => ["gastos", "proyecto", proyectoId],
        byFase: (faseId) => ["gastos", "fase", faseId],
    },
    cobros: {
        all: ["cobros"],
        byProyecto: (proyectoId) => ["cobros", "proyecto", proyectoId],
    },
    compras: {
        all: ["compras"],
        byProyecto: (proyectoId) => ["compras", "proyecto", proyectoId],
        byFase: (faseId) => ["compras", "fase", faseId],
    },
    productos: {
        all: ["productos"],
    },
    proveedores: {
        all: ["proveedores"],
    },
    categoriasGasto: {
        all: ["categoriasGasto"],
    },
    impuestos: {
        all: ["impuestos"],
    },
};
