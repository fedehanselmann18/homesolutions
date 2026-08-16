import { TriangleAlert } from "lucide-react";

import ModalShell from "./ModalShell";
import "./ModalConfirmar.css";

export function ModalConfirmar({
  titulo = "Confirmar eliminación",
  mensaje,
  nombreRecurso,
  onConfirmar,
  onCancelar,
}) {
  return (
    <ModalShell
      titulo={titulo}
      clase="modal-contenido--peligro"
      onCerrar={onCancelar}
      acciones={
        <>
          <button type="button" className="btn btn-secondary" onClick={onCancelar}>
            Cancelar
          </button>
          <button type="button" className="btn btn-peligro" onClick={onConfirmar}>
            Eliminar
          </button>
        </>
      }
    >
      <div className="modal-confirmar">
        <span className="modal-confirmar-icono">
          <TriangleAlert size={19} strokeWidth={2.25} />
        </span>
        <div className="modal-confirmar-texto">
          <p className="modal-confirmar-mensaje">{mensaje}</p>
          {nombreRecurso && <p className="modal-confirmar-recurso">{nombreRecurso}</p>}
        </div>
      </div>
    </ModalShell>
  );
}

export default ModalConfirmar;
