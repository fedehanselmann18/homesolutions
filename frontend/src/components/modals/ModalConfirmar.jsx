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
  // "peligro" (borrar: botón rojo y el ícono de alerta) o "neutro" (una
  // acción que no destruye nada, como marcar compras como pagadas).
  tono = "peligro",
  onConfirmar,
  onCancelar,
}) {
  const peligro = tono === "peligro";
  return (
    <ModalShell
      titulo={titulo}
      onCerrar={onCancelar}
      acciones={
        <>
          <button type="button" className="btn btn--lg btn-secondary" onClick={onCancelar}>
            Cancelar
          </button>
          <button
            type="button"
            className={`btn btn--lg ${peligro ? "btn-peligro" : "btn-primary"}`}
            onClick={onConfirmar}
          >
            {textoConfirmar}
          </button>
        </>
      }
    >
      <div className="modal-confirmar">
        {peligro && (
          <span className="modal-confirmar-icono">
            <TriangleAlert size={20} strokeWidth={1.75} aria-hidden="true" />
          </span>
        )}
        <div className="modal-confirmar-texto">
          <p className="modal-confirmar-mensaje">{mensaje}</p>
          {nombreRecurso && <p className="modal-confirmar-recurso">{nombreRecurso}</p>}
        </div>
      </div>
    </ModalShell>
  );
}

export default ModalConfirmar;
