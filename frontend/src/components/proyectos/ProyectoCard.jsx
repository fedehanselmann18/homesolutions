import { AlertTriangle, Bell, Check } from "lucide-react";

import { formatMoneda } from "../../utils/formato";
import { getEstado } from "../../constants/estados";
import { OLIVA, OLIVA_CLARO, LINEA } from "../../constants/colores";
import "./ProyectoCard.css";

// Color de cada segmento de la barra de fases. Esto NO es el semáforo de
// estado, es una barra de PROGRESO, y el progreso tiene su propia rampa
// (DESIGN.md §2, "Progreso y datos"): completado en oliva claro, actual en
// oliva, pendiente en gris de línea. Con los colores del semáforo la barra
// parecía decir "esta fase tiene un problema" cuando decía "es la que se hace".
function colorSegmentoFase(estado) {
  if (estado === "terminada" || estado === "auditada") return OLIVA_CLARO;
  if (estado === "en_curso") return OLIVA;
  return LINEA; // hex plano: los segmentos van por style inline, no CSS var
}

// El contador de alertas de arriba a la derecha: rojo si hay deuda vencida,
// ámbar si hay pendientes, y un tilde tenue si está todo al día.
function Alertas({ proyecto }) {
  const total = proyecto.comprasImpagas + proyecto.comprasSinEntregar + proyecto.fasesEstancadas;
  if (total === 0) {
    return (
      <span className="proyecto-card__alertas" title="Sin pendientes">
        <Check size={14} strokeWidth={2} aria-hidden="true" />
        Al día
      </span>
    );
  }
  const grave = proyecto.comprasVencidas > 0;
  const Icono = grave ? AlertTriangle : Bell;
  return (
    <span
      className={`proyecto-card__alertas proyecto-card__alertas--${grave ? "problema" : "atencion"}`}
      title={`${total} ${total === 1 ? "pendiente" : "pendientes"}`}
    >
      <Icono size={14} strokeWidth={2} aria-hidden="true" />
      {total}
    </span>
  );
}

/**
 * Card de un proyecto en la lista de Proyectos — variante 4L de
 * docs/GENERALUIUXChange/HS General.dc.html. `proyecto` es una fila de
 * calcularPanel (utils/panel.js): los números son los mismos del Panel y del
 * Análisis del proyecto, nunca un cálculo aparte.
 *
 * Sin sombra en reposo; en hover el borde se oscurece y aparece la sombra de
 * hover (DESIGN.md §10). Lo terminado se atenúa, no se tacha. `acciones`
 * (editar/eliminar) aparecen en hover con mouse y siempre en touch.
 */
export function ProyectoCard({ proyecto, onAbrir, acciones }) {
  const estado = getEstado(proyecto.estado);
  const IconoEstado = estado.icono;
  const terminado = proyecto.estado === "terminado";
  const negativo = proyecto.disponible < 0;

  return (
    <article
      className={`proyecto-card fila-con-acciones${terminado ? " proyecto-card--terminado" : ""}`}
      onClick={onAbrir}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAbrir();
        }
      }}
      role="link"
      tabIndex={0}
      aria-label={proyecto.nombre}
    >
      <div className="proyecto-card__arriba">
        <span className="badge" style={{ backgroundColor: estado.bg, color: estado.fg }}>
          {IconoEstado && <IconoEstado size={14} strokeWidth={2} aria-hidden="true" />}
          {estado.label}
        </span>
        <span className="proyecto-card__arriba-derecha">
          {acciones && <span className="acciones proyecto-card__acciones">{acciones}</span>}
          <Alertas proyecto={proyecto} />
        </span>
      </div>

      <div className="proyecto-card__titulo">
        <h3 className="proyecto-card__nombre">{proyecto.nombre}</h3>
        {proyecto.direccion && (
          <span className="proyecto-card__direccion">{proyecto.direccion}</span>
        )}
      </div>

      <div className="proyecto-card__fases">
        {proyecto.fasesResumen.length > 0 && (
          <div
            className="proyecto-card__segmentos"
            style={{
              gridTemplateColumns: `repeat(${proyecto.fasesResumen.length}, minmax(0, 1fr))`,
            }}
            aria-hidden="true"
          >
            {proyecto.fasesResumen.map((fase) => (
              <span key={fase.id} style={{ backgroundColor: colorSegmentoFase(fase.estado) }} />
            ))}
          </div>
        )}
        <span className="proyecto-card__fase">
          {proyecto.faseActual?.texto ?? "Sin fases cargadas"}
        </span>
      </div>

      <dl className="proyecto-card__numeros cifra">
        <div>
          <dt>Cobrado</dt>
          <dd>{Math.round(proyecto.pctCobrado)}%</dd>
        </div>
        <div>
          <dt>Gastado</dt>
          <dd>{Math.round(proyecto.pctPresupuesto)}%</dd>
        </div>
        <div>
          <dt>Disponible</dt>
          <dd className={negativo ? "proyecto-card__negativo" : undefined}>
            {formatMoneda(proyecto.disponible, proyecto.moneda)}
          </dd>
        </div>
      </dl>
    </article>
  );
}

export default ProyectoCard;
