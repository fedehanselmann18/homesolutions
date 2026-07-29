// components/ProyectoDetalleHeader.jsx
import { MapPin, CalendarDays, Wallet } from "lucide-react";
import './ProyectoDetalleHeader.css';
import { formatearFechaLarga } from "../../utils/fechaUtils";
import { formatearMoneda } from "../../utils/formatUtils";
import { getEstado } from "../../constants/estados";

function ProyectoDetalleHeader({ proyecto }) {
  const estado = getEstado(proyecto.estado);

  return (
    <div className="proyecto-header" style={{ borderLeftColor: estado.color }}>
      <div className="proyecto-header__top">
        <h1 className="proyecto-header__nombre">{proyecto.nombre}</h1>
        <span
          className="proyecto-header__estado"
          style={{
            color: estado.color,
            backgroundColor: `color-mix(in srgb, ${estado.color} 15%, white)`,
            borderColor: `color-mix(in srgb, ${estado.color} 40%, white)`,
          }}
        >
          <span className="proyecto-header__estado-icono">{estado.icono}</span>
          {estado.label}
        </span>
      </div>
      {proyecto.descripcion && (
        <p className="proyecto-header__descripcion">{proyecto.descripcion}</p>
      )}

      <div className="proyecto-header__datos">
        <p className="proyecto-header__dato">
          <MapPin size={16} strokeWidth={2} className="proyecto-header__dato-icono" />
          {proyecto.direccion}
        </p>
        <p className="proyecto-header__dato">
          <CalendarDays size={16} strokeWidth={2} className="proyecto-header__dato-icono" />
          Iniciado el {formatearFechaLarga(proyecto.fecha_inicio)}
        </p>
        <p className="proyecto-header__dato">
          <Wallet size={16} strokeWidth={2} className="proyecto-header__dato-icono" />
          {formatearMoneda(proyecto.precio_acordado)}
        </p>
      </div>
    </div>
  );
}

export default ProyectoDetalleHeader;
