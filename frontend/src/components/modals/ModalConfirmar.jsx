import "./ModalConfirmar.css";

export function ModalConfirmar({
  titulo = "Confirmar eliminación",
  mensaje,
  nombreRecurso,
  onConfirmar,
  onCancelar,
}) {
  return (
    <div className="modal-overlay" onClick={onCancelar}>
      <div className="modal-contenido modal-confirmar" onClick={(e) => e.stopPropagation()}>
        <h2>{titulo}</h2>
        <p className="modal-confirmar-mensaje">{mensaje}</p>
        {nombreRecurso && <p className="modal-confirmar-recurso">{nombreRecurso}</p>}

        <div className="modal-acciones">
          <button type="button" className="btn btn-secondary" onClick={onCancelar}>
            Cancelar
          </button>
          <button type="button" className="btn btn-peligro" onClick={onConfirmar}>
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

export default ModalConfirmar;
