import { TriangleAlert } from "lucide-react";

import ModalShell from "./ModalShell";
import "./ModalConfirmar.css";

export function ModalConfirmar({
  titulo = "Confirmar eliminación",
  mensaje,
  nombreRecurso,
  // Texto del botón que confirma. El default cubre el caso original (borrar
  // algo), pero el modal también se usa para acciones que no son un borrado
  // -- ver la página de Manager, donde confirma cambios de rol, cierres de
  // sesión y bajas de cuenta.
  textoConfirmar = "Eliminar",
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
            {textoConfirmar}
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
