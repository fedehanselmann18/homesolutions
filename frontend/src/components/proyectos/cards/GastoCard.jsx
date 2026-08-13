import useAuth from "../../../context/useAuth";
import { formatMoneda, formatFecha } from "../../../utils/formato";
import { getTipoFacturaLabel } from "../../../constants/tipoFactura";
import { SeccionComprobantes } from "../../shared/SeccionComprobantes";
import "./GastoCard.css";

export function GastoCard({
  gasto,
  faseNombre,
  usuarioNombre,
  onEditar,
  onEliminar,
  onVerComprobante,
  onAgregarComprobante,
  onEliminarComprobante,
  onAbrirDetalle,
}) {
  const { usuario } = useAuth();
  const canManage = usuario?.rol === "admin";

  const handleEditar = () => onEditar(gasto);
  const handleEliminar = () => onEliminar(gasto.id);

  return (
    <div
      className="gasto-card"
      onClick={onAbrirDetalle ? () => onAbrirDetalle(gasto) : undefined}
      style={onAbrirDetalle ? { cursor: "pointer" } : undefined}
    >
      <div className="gasto-card-contenido">
        <div className="gasto-card-header">
          <h3 className="gasto-card-descripcion">{gasto.descripcion}</h3>
          <span className="gasto-card-monto">{formatMoneda(gasto.monto)}</span>
        </div>

        <div className="gasto-card-meta">
          <span>{formatFecha(gasto.fecha)}</span>
          <span className="gasto-card-separador">•</span>
          <span>{getTipoFacturaLabel(gasto.tipo_factura)}</span>
          <span className="gasto-card-separador">•</span>
          <span>{faseNombre ?? "Gasto general"}</span>
        </div>

        {gasto.categorias?.length > 0 && (
          <div className="gasto-card-chips">
            {gasto.categorias.map((cat) => (
              <span key={cat.id} className="gasto-card-chip">
                {cat.nombre}
              </span>
            ))}
          </div>
        )}

        <div className="gasto-card-expandido">
          {usuarioNombre && <p className="gasto-card-detalle-info">Cargado por {usuarioNombre}</p>}

          <div onClick={(e) => e.stopPropagation()}>
            <SeccionComprobantes
              comprobantes={gasto.comprobantes ?? []}
              onVer={onVerComprobante ? (c) => onVerComprobante(gasto.id, c.id) : undefined}
              onAgregar={
                onAgregarComprobante ? (files) => onAgregarComprobante(gasto.id, files) : undefined
              }
              onEliminar={
                onEliminarComprobante ? (id) => onEliminarComprobante(gasto.id, id) : undefined
              }
              canManage={canManage}
            />
          </div>
        </div>
      </div>

      {canManage && (
        <div className="gasto-card-acciones" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="gasto-card-btn gasto-card-btn--editar"
            onClick={handleEditar}
          >
            Editar
          </button>
          <button
            type="button"
            className="gasto-card-btn gasto-card-btn--eliminar"
            onClick={handleEliminar}
          >
            Eliminar
          </button>
        </div>
      )}
    </div>
  );
}

export default GastoCard;
