import { useState } from "react";
import { CircleAlert, CircleCheck, RotateCcw, Save } from "lucide-react";

import "./Manager.css";

/**
 * Panel de configuración de Manager: valores
 * editables sin redeployar (hoy solo GEMINI_MODEL, piloto) más el estado
 * -- solo lectura -- de las integraciones que SÍ dependen de variables de
 * entorno reales (bucket, Gemini): esas nunca se migran a la tabla porque son
 * credenciales, así que acá solo se puede ver si están seteadas, no
 * tocarlas.
 */
export function SeccionConfiguracion({ integraciones, claves, guardando, onGuardar, onRestaurar }) {
  return (
    <div className="manager-configuracion">
      <div className="manager-configuracion__integraciones">
        <EstadoIntegracion
          nombre="Bucket de comprobantes"
          ayuda="Almacenamiento de comprobantes. Si no está, se guardan en disco local."
          configurado={integraciones?.bucket_configurado}
        />
        <EstadoIntegracion
          nombre="Gemini (IA)"
          ayuda="Lectura automática de comprobantes y catálogos."
          configurado={integraciones?.gemini_configurado}
        />
      </div>

      <ul className="manager-configuracion__lista">
        {claves.map((item) => (
          <FilaConfiguracion
            // La key incluye el valor a propósito: el estado local del
            // input (abajo) solo tiene que resetearse cuando el valor
            // EFECTIVO cambia de verdad (guardar/restaurar dispara un
            // refetch), nunca mientras el usuario está tipeando -- typear
            // no toca `item.valor`, así que no fuerza un remount a mitad de
            // edición.
            key={`${item.clave}-${item.valor}`}
            item={item}
            guardando={guardando}
            onGuardar={(valorNuevo) => onGuardar(item.clave, valorNuevo)}
            onRestaurar={() => onRestaurar(item.clave)}
          />
        ))}
      </ul>
    </div>
  );
}

function EstadoIntegracion({ nombre, ayuda, configurado }) {
  return (
    <div className="manager-configuracion__integracion">
      <div>
        <span className="manager-configuracion__integracion-nombre">{nombre}</span>
        <p className="manager-configuracion__integracion-ayuda">{ayuda}</p>
      </div>
      {/* configurado llega undefined mientras carga: no afirmar nada hasta
          tener la respuesta del backend. */}
      {configurado === undefined ? (
        <span className="badge badge--neutro">Cargando...</span>
      ) : (
        // Sin configurar no es un error: la app sigue andando (disco local, carga
        // a mano). Es "atención", y lleva su ícono como todo estado.
        <span className={`badge ${configurado ? "badge--exito" : "badge--atencion"}`}>
          {configurado ? (
            <CircleCheck size={12} strokeWidth={2} aria-hidden="true" />
          ) : (
            <CircleAlert size={12} strokeWidth={2} aria-hidden="true" />
          )}
          {configurado ? "Configurado" : "No configurado"}
        </span>
      )}
    </div>
  );
}

// Estado local propio: cada fila edita su valor sin tocar el de las demás,
// y "Guardar" solo se habilita si de verdad cambió algo (evita un PATCH
// vacío que solo generaría una fila de auditoría sin sentido).
function FilaConfiguracion({ item, guardando, onGuardar, onRestaurar }) {
  const [valor, setValor] = useState(item.valor);
  const cambio = valor.trim() !== item.valor && valor.trim() !== "";

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!cambio) return;
    await onGuardar(valor.trim());
  };

  return (
    <li className="manager-configuracion__fila">
      <div className="manager-configuracion__fila-info">
        <span className="manager-configuracion__clave">{item.clave}</span>
        <p className="manager-configuracion__descripcion">{item.descripcion}</p>
        {!item.personalizado && (
          <span className="manager-configuracion__default">
            Valor del .env, nadie lo pisó todavía.
          </span>
        )}
      </div>

      <form className="manager-configuracion__form" onSubmit={handleGuardar}>
        <input
          type="text"
          className="campo campo--sm"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          disabled={guardando}
        />
        <button type="submit" className="btn btn--sm btn-secondary" disabled={guardando || !cambio}>
          <Save size={14} strokeWidth={2} />
          Guardar
        </button>
        {item.personalizado && (
          <button
            type="button"
            className="btn btn--sm btn-secondary"
            onClick={onRestaurar}
            disabled={guardando}
            title="Volver al valor del .env"
          >
            <RotateCcw size={14} strokeWidth={2} />
            Restaurar
          </button>
        )}
      </form>
    </li>
  );
}

export default SeccionConfiguracion;
