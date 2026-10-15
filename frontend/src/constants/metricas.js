// constants/metricas.js
//
// Única fuente de las etiquetas y umbrales de la página Métricas. Lenguaje
// contable y sobrio: los textos de la UI salen de acá, no sueltos en el JSX.
import { CircleCheck, CircleDashed, Gauge, TrendingDown } from "lucide-react";
import { PARES_SEMAFORO } from "./estadoCompra";

export const ETIQUETAS_METRICAS = {
  titulo: "Métricas",
  ingresos: "Ingresos",
  egresos: "Egresos",
  resultado: "Resultado",
  rentabilidad: "Rentabilidad",
  porCobrar: "Por cobrar",
  deudaProveedores: "Deuda con proveedores",
  precioAcordado: "Precio acordado",
  pctEjecutado: "% ejecutado",
  obra: "Obra",
  estado: "Estado",
  evolucionMensual: "Ingresos y egresos",
  rentabilidadPorObra: "Rentabilidad por obra",
  egresosPorCategoria: "Egresos por categoría",
  proveedores: "Proveedores",
  obras: "Obras",
  todasLasObras: "Todas las obras",
  sinDatos: "Sin movimientos en el período",
  errorCarga: "No se pudieron cargar las métricas.",
  periodo: "Período",
  sinValor: "—",
  sinIngresos: "Sin ingresos en el período",
  sinEgresos: "Sin egresos en el período",
  sinCompras: "Sin compras en el período",
  nivel: "Situación",
};

// Fila de "Egresos por categoría" que junta todas las compras: las compras no
// tienen categoría de gasto, y sin esta fila el bloque no sumaría los egresos.
export const CATEGORIA_COMPRAS = "Compras a proveedores";

// Períodos del filtro. Son meses calendario completos contando el actual
// (como las barras del Panel): "3 meses" en octubre es agosto–octubre.
export const PERIODOS_METRICAS = [
  { value: "mes", label: "Mes actual", meses: 1 },
  { value: "3m", label: "3 meses", meses: 3 },
  { value: "6m", label: "6 meses", meses: 6 },
  { value: "12m", label: "12 meses", meses: 12 },
  { value: "anio", label: "Año" },
  { value: "todo", label: "Todo" },
];

export const PERIODO_METRICAS_DEFAULT = "6m";

// Cuántos proveedores muestra el bloque Proveedores.
export const TOP_PROVEEDORES_METRICAS = 5;

// Badge de cada obra en la tabla. Mira la obra ENTERA (no el período
// filtrado): es el estado de la obra contra su contrato, y no tiene que
// cambiar según el filtro. Orden de chequeo:
//   1. resultado acumulado negativo        -> problema
//   2. sin precio acordado (no hay % que medir) -> sin_dato
//   3. % ejecutado > PCT_EJECUTADO_ATENCION     -> atencion
//   4. el resto                                  -> resuelto
export const PCT_EJECUTADO_ATENCION = 85;

// Mismo semáforo de cuatro posiciones que el resto de la app (estadoCompra.js),
// con su ícono: el color solo no alcanza para distinguirlos (DESIGN.md §2).
export const NIVELES_OBRA = {
  problema: { ...PARES_SEMAFORO.problema, label: "Resultado negativo", icono: TrendingDown },
  atencion: { ...PARES_SEMAFORO.atencion, label: "Ejecución alta", icono: Gauge },
  resuelto: { ...PARES_SEMAFORO.resuelto, label: "En margen", icono: CircleCheck },
  sin_dato: { ...PARES_SEMAFORO.neutro, label: "Sin precio acordado", icono: CircleDashed },
};

// Orden de la tabla: lo que pide atención primero.
export const PESO_NIVEL_OBRA = { problema: 3, atencion: 2, sin_dato: 1, resuelto: 0 };
