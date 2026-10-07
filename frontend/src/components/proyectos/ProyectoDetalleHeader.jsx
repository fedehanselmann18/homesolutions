// components/ProyectoDetalleHeader.jsx
import { MapPin, CalendarDays, Layers } from "lucide-react";
import "./ProyectoDetalleHeader.css";
import { Breadcrumbs } from "../shared/Breadcrumbs";
import { formatFecha } from "../../utils/formato";
import { getEstado } from "../../constants/estados";

/**
 * Carátula corta del proyecto: breadcrumb + nombre + estado + meta, nada
 * más. Antes traía además una cinta fija de 5 KPIs (disponible, presupuesto
 * ejecutado, cobrado, fases, requiere acción) por encima de las 4 tabs
 * (Fases/Acciones/Análisis/Seguimiento) -- eso volvía el header enorme en
 * mobile (los KPIs se apilaban verticalmente) y quedaba fijo aunque la tab
 * activa no tuviera nada que ver con esos números. Cada uno de esos datos ya
 * vive, con más detalle, en su tab correspondiente: Disponible y Presupuesto
 * ejecutado en Análisis General, Cobrado en Seguimiento, Fases en la propia
 * tabla de Fases, Requiere acción desglosado en Seguimiento.
 *
 * `faseActual` es `{ numero, total, nombre }` o null. Mientras las fases no
 * cargaron, o si el proyecto no tiene ninguna, ese ítem de la meta no se pinta.
 */
function ProyectoDetalleHeader({ proyecto, breadcrumb, faseActual }) {
  const estado = getEstado(proyecto.estado);
  const IconoEstado = estado.icono;

  return (
    <header className="proyecto-header">
      {breadcrumb && <Breadcrumbs items={breadcrumb} />}

      <div className="proyecto-header__top">
        <h1 className="proyecto-header__nombre">{proyecto.nombre}</h1>
        <span className="badge" style={{ color: estado.fg, backgroundColor: estado.bg }}>
          {IconoEstado && <IconoEstado size={14} strokeWidth={2} aria-hidden="true" />}
          {estado.label}
        </span>
      </div>

      <ul className="proyecto-header__meta">
        {proyecto.direccion && (
          <li>
            <MapPin size={15} strokeWidth={1.75} aria-hidden="true" />
            {proyecto.direccion}
          </li>
        )}
        {proyecto.fecha_inicio && (
          <li>
            <CalendarDays size={15} strokeWidth={1.75} aria-hidden="true" />
            Desde el {formatFecha(proyecto.fecha_inicio)}
          </li>
        )}
        {faseActual && (
          <li>
            <Layers size={15} strokeWidth={1.75} aria-hidden="true" />
            {faseActual.numero
              ? `Fase ${faseActual.numero} de ${faseActual.total} · ${faseActual.nombre}`
              : faseActual.nombre}
          </li>
        )}
      </ul>
    </header>
  );
}

export default ProyectoDetalleHeader;
