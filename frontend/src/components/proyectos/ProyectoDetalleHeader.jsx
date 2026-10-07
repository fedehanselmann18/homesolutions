// components/ProyectoDetalleHeader.jsx
import { MapPin } from "lucide-react";
import "./ProyectoDetalleHeader.css";
import { Breadcrumbs } from "../shared/Breadcrumbs";
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
 * La meta es solo la dirección: la fecha de inicio y "Fase N de M" también se
 * sacaron, la fase en curso se ve en la tab Fases.
 */
function ProyectoDetalleHeader({ proyecto, breadcrumb }) {
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
      </ul>
    </header>
  );
}

export default ProyectoDetalleHeader;
