// components/ProyectoDetalleHeader.jsx
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
 */
function ProyectoDetalleHeader({ proyecto, breadcrumb }) {
  const estado = getEstado(proyecto.estado);

  return (
    <div className="proyecto-header" style={{ borderLeftColor: estado.color }}>
      {breadcrumb && <Breadcrumbs items={breadcrumb} />}

      <div className="proyecto-header__top">
        <h1 className="proyecto-header__nombre">{proyecto.nombre}</h1>
        <span
          className="badge proyecto-header__estado"
          style={{
            color: estado.color,
            backgroundColor: `color-mix(in srgb, ${estado.color} 15%, white)`,
            borderColor: `color-mix(in srgb, ${estado.color} 40%, white)`,
          }}
        >
          {estado.label}
        </span>
      </div>

      <p className="proyecto-header__meta">
        {proyecto.direccion} · Iniciado el {formatFecha(proyecto.fecha_inicio)}
      </p>
    </div>
  );
}

export default ProyectoDetalleHeader;
