import { ChevronRight } from "lucide-react";
import { BarraProgreso } from "../shared/TarjetaKpi";
import { formatMoneda, formatMonedaCorta } from "../../utils/formato";
import { VERDE, ROJO, NARANJA, LINEA, OLIVA, OLIVA_CLARO } from "../../constants/colores";
import "./TablaProyectos.css";
import { TINTE_PASTILLA } from "../../constants/tipoMovimiento";

// Color de cada segmento de la barra de fases. Mismo criterio de "cerrada" que
// ESTADOS_FASE_CERRADA en utils/panel.js.
//
// v5: esto NO es el semáforo de estado, es una barra de PROGRESO, y el progreso
// tiene su propia rampa (ver docs/DESIGN.md §2, "Progreso y datos"): tramo
// completado en oliva claro, tramo actual en oliva, pendiente en gris de línea.
// Antes usaba VERDE/NARANJA, o sea los colores del semáforo, y eso hacía que la
// barra pareciera decir "esta fase tiene un problema" cuando sólo decía "esta
// fase es la que se está haciendo". La variante 4L del rediseño lo dibuja con la
// rampa oliva, y es lo correcto: una barra de avance no es un estado.
function colorSegmentoFase(estado) {
  if (estado === "terminada" || estado === "auditada") return OLIVA_CLARO;
  if (estado === "en_curso") return OLIVA;
  return LINEA; // hex plano: los segmentos van por style inline, no CSS var
}

// Barra de segmentos de fases: un rectángulo por fase en vez de la barra de
// progreso continua de antes -- se ve de un vistazo cuál fase puntual está
// trabada, no sólo "cuántas" van.
function SegmentosFases({ fases }) {
  if (fases.length === 0) {
    return <span className="panel-tabla-fases-vacio">Sin fases</span>;
  }
  return (
    <div className="panel-fases-segmentos">
      {fases.map((fase) => (
        <span
          key={fase.id}
          className="panel-fases-segmento"
          style={{ backgroundColor: colorSegmentoFase(fase.estado) }}
        />
      ))}
    </div>
  );
}

/**
 * Fila de la tabla de proyectos, formato "planilla" (dirección 1a, ver
 * claudedesign/): reemplaza tanto la tarjeta de antes (página Proyectos)
 * como la lista simple del Panel por una fila real con sus columnas
 * alineadas. La usan `TablaProyectos` de acá abajo y por lo tanto tanto el
 * Panel ("Proyectos en curso") como la página Proyectos, para que las dos
 * pantallas lean exactamente igual.
 *
 * `renderAcciones`, si viene, se pinta al lado del chevron (ej. editar/
 * eliminar en la página Proyectos, que el Panel no necesita) -- el llamador
 * es responsable de hacer `stopPropagation` en esos botones para que no
 * disparen el click de la fila entera.
 */
export function FilaProyecto({ proyecto, onClick, renderAcciones }) {
  const excedido = proyecto.pctPresupuesto > 100;
  const positivo = proyecto.disponible >= 0;

  return (
    <div
      className="planilla__fila panel-tabla-fila"
      style={{
        borderLeftColor: positivo ? VERDE : ROJO,
        "--fila-hover": positivo
          ? "var(--color-terracota-tint-fila)"
          : "var(--color-oxido-tint-fila)",
      }}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      role="button"
      tabIndex={0}
    >
      <div className="panel-tabla-col panel-tabla-col--proyecto">
        <span className="panel-tabla-nombre">{proyecto.nombre}</span>
        <span className="panel-tabla-direccion">{proyecto.direccion}</span>
      </div>

      <div className="panel-tabla-col panel-tabla-col--disponible">
        <span className="panel-tabla-label-movil label-campo">Disponible</span>
        <span style={{ color: positivo ? VERDE : ROJO }}>
          {formatMoneda(proyecto.disponible, proyecto.moneda)}
        </span>
      </div>

      <div className="panel-tabla-col panel-tabla-col--presupuesto">
        <div className="panel-tabla-presupuesto-header">
          <span className="panel-tabla-label-movil label-campo">Presupuesto ejecutado</span>
          <span className={excedido ? "panel-proyecto-excedido" : ""}>
            {proyecto.pctPresupuesto.toFixed(0)}%
          </span>
        </div>
        <BarraProgreso porcentaje={proyecto.pctPresupuesto} color={excedido ? ROJO : NARANJA} />
        <span className="panel-tabla-presupuesto-detalle">
          {formatMonedaCorta(proyecto.egresos, proyecto.moneda)} /{" "}
          {proyecto.precioAcordado == null
            ? "sin cotización"
            : formatMonedaCorta(proyecto.precioAcordado, proyecto.moneda)}
        </span>
      </div>

      <div className="panel-tabla-col panel-tabla-col--fases">
        <SegmentosFases fases={proyecto.fasesResumen} />
        <span className="panel-tabla-fases-contador">
          {proyecto.fasesCerradas}/{proyecto.fasesTotales}
        </span>
      </div>

      <div className="panel-tabla-col panel-tabla-col--pendientes">
        {proyecto.comprasImpagas === 0 && proyecto.comprasSinEntregar === 0 ? (
          <span className="panel-proyecto-compras-ok">
            {proyecto.estado === "terminado" ? "Cerrado" : "Sin pendientes"}
          </span>
        ) : (
          <>
            {proyecto.comprasImpagas > 0 && (
              <span
                className="badge"
                style={{ color: ROJO, backgroundColor: `${ROJO}${TINTE_PASTILLA}` }}
              >
                {proyecto.comprasImpagas} sin pagar
              </span>
            )}
            {proyecto.comprasSinEntregar > 0 && (
              <span
                className="badge"
                style={{ color: NARANJA, backgroundColor: `${NARANJA}${TINTE_PASTILLA}` }}
              >
                {proyecto.comprasSinEntregar}{" "}
                {proyecto.comprasSinEntregar === 1 ? "envío" : "envíos"}
              </span>
            )}
          </>
        )}
      </div>

      <div className="panel-tabla-col panel-tabla-col--accion">
        {renderAcciones?.(proyecto)}
        <ChevronRight
          size={18}
          strokeWidth={2}
          className="panel-tabla-chevron"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

/**
 * Tabla de proyectos completa: cabecera + una `FilaProyecto` por proyecto.
 * `proyectos` ya viene resuelto (filtrado/ordenado) por el llamador --
 * ver `calcularPanel(...).proyectosResumen` en utils/panel.js, la misma
 * fuente que usan el Panel y la página Proyectos para que los números
 * nunca diverjan entre pantallas.
 */
export function TablaProyectos({ proyectos, onFilaClick, renderAcciones }) {
  return (
    <div className={`planilla panel-tabla${renderAcciones ? " panel-tabla--acciones" : ""}`}>
      <div className="planilla__header panel-tabla-header">
        <span>Proyecto</span>
        <span>Disponible</span>
        <span>Presupuesto ejecutado</span>
        <span>Fases</span>
        <span>Pendientes</span>
        <span />
      </div>
      {proyectos.map((proyecto) => (
        <FilaProyecto
          key={proyecto.id}
          proyecto={proyecto}
          onClick={() => onFilaClick(proyecto)}
          renderAcciones={renderAcciones}
        />
      ))}
    </div>
  );
}

export default TablaProyectos;
