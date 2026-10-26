import { TriangleAlert } from "lucide-react";

import ModalShell from "./ModalShell";
import "./ModalConfirmar.css";

export function ModalConfirmar({
  titulo = "Confirmar eliminación",
  mensaje,
  nombreRecurso,
  // Qué se va a borrar junto con el recurso, una línea por cosa ("3 compras").
  // Opcional: los usos que no destruyen nada (Manager) no la pasan, y lo que
  // está en cero no manda línea, así que acá nunca entra un "0 gastos" (ver
  // utils/proyectos.js).
  detalles = [],
  // Texto del botón que confirma. El default cubre el caso original (borrar
  // algo), pero el modal también se usa para acciones que no son un borrado
  // -- ver la página de Manager, donde confirma cambios de rol, cierres de
  // sesión y bajas de cuenta.
  textoConfirmar = "Eliminar",
  // Sin `onConfirmar` el modal es sólo un aviso: no hay nada que confirmar,
  // así que va un único botón que cierra (y no uno destructivo que va a
  // fallar). Lo usa el borrado de una obra con cobros.
  textoCerrar = "Entendido",
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
        onConfirmar ? (
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
        ) : (
          <button type="button" className="btn btn--lg btn-primary" onClick={onCancelar}>
            {textoCerrar}
          </button>
        )
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
          {detalles.length > 0 && (
            <ul className="modal-confirmar-detalles">
              {detalles.map((detalle) => (
                <li key={detalle}>{detalle}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

export default ModalConfirmar;
