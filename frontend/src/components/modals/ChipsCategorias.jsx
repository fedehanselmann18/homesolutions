import { useState } from "react";
import { Check, Plus } from "lucide-react";

import { crearCategoria } from "../../services/categoriaService";
import { TIPOS_PRODUCTO } from "../../constants/tipoProducto";
import { obtenerMensajeError } from "../../utils/errorHandling";

import "./ChipsCategorias.css";
import { LogoCargando } from "../shared/LogoCargando";

/**
 * Selector de categorías como chips, compartido por ModalProducto (bloque
 * completo dentro del form) y ModalImportarCatalogo (dentro del popover de
 * la celda de la tabla) -- el mismo criterio de negocio vive en un solo
 * lugar en vez de duplicarse en los dos modales.
 *
 * Las categorías son sub-rubros de un tipo, así que solo se ofrecen las que
 * coinciden con el `tipo` recibido: ofrecer una categoría de "materiales"
 * para un producto "equipo" sería una combinación inválida.
 *
 * Cuando no hay ninguna categoría cargada para ese tipo, en vez de un
 * mensaje muerto se ofrece crearla acá mismo: el caso típico es cargar el
 * primer producto de un tipo nuevo, y mandar al usuario a otra pantalla a
 * crear la categoría (perdiendo lo que ya tipeó en el modal) era la peor
 * salida posible.
 *
 * `compacto` saca la fila de label/contador/limpiar: en el popover de
 * ModalImportarCatalogo el botón que lo abre ya hace de etiqueta.
 */
export function ChipsCategorias({
  categoriaIds,
  tipo,
  categoriasDisponibles,
  onToggle,
  onLimpiar,
  onCategoriaCreada,
  compacto = false,
}) {
  const [nombreNueva, setNombreNueva] = useState("");
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState(null);

  const categoriasDelTipo = categoriasDisponibles.filter((c) => c.tipo === tipo);
  const etiquetaTipo = TIPOS_PRODUCTO[tipo]?.label ?? tipo;

  const handleCrear = async () => {
    const nombre = nombreNueva.trim();
    if (!nombre) return;

    setCreando(true);
    setError(null);
    try {
      const nueva = await crearCategoria({ nombre, tipo });
      setNombreNueva("");
      // El padre refresca su lista de categorías (la nueva todavía no está
      // en categoriasDisponibles); mientras tanto ya la dejamos elegida, así
      // el usuario no tiene que volver a tildarla cuando aparezca.
      onCategoriaCreada?.(nueva);
      onToggle(nueva.id);
    } catch (err) {
      setError(obtenerMensajeError(err));
    } finally {
      setCreando(false);
    }
  };

  // Enter dentro del input crearía/submitearía el form del modal que
  // envuelve a este componente -- acá tiene que crear la categoría.
  const handleKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    handleCrear();
  };

  const formCrear = (
    <div className="chips-cat-crear">
      <input
        className="campo campo--sm"
        type="text"
        aria-label="Nombre de la nueva categoría"
        value={nombreNueva}
        onChange={(e) => setNombreNueva(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Nombre de la categoría"
        disabled={creando}
      />
      <button
        type="button"
        className="btn btn-secondary"
        onClick={handleCrear}
        disabled={creando || !nombreNueva.trim()}
      >
        {creando ? <LogoCargando size={14} /> : <Plus size={14} strokeWidth={2} />}
        {creando ? "Creando..." : "Crear categoría"}
      </button>
    </div>
  );

  if (categoriasDelTipo.length === 0) {
    return (
      <div className="chips-cat">
        <div className="chips-cat-vacio">
          <span className="chips-cat-vacio-titulo">
            No hay categorías cargadas para «{etiquetaTipo}»
          </span>
          <span className="chips-cat-vacio-detalle">
            Podés crear el producto igual y asignarle categorías más adelante.
          </span>
          {formCrear}
          {error && <span className="campo-error">{error}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="chips-cat">
      {!compacto && (
        <div className="chips-cat-header">
          <span className="chips-cat-label">Categorías</span>
          <span className="chips-cat-contador">
            {categoriaIds.length === 0
              ? "ninguna"
              : `${categoriaIds.length} ${categoriaIds.length === 1 ? "elegida" : "elegidas"}`}
          </span>
          {categoriaIds.length > 0 && (
            <button type="button" className="chips-cat-limpiar" onClick={onLimpiar}>
              Limpiar
            </button>
          )}
        </div>
      )}

      <div className="chips-cat-lista">
        {categoriasDelTipo.map((cat) => {
          const elegida = categoriaIds.includes(cat.id);
          return (
            <button
              key={cat.id}
              type="button"
              // Elección múltiple: la forma es la del chip-opción (DESIGN.md
              // §9) y el elegido lleva además el check, porque puede haber
              // varios activos a la vez.
              className={`chip${compacto ? "" : " chip--opcion"}${elegida ? " chip--activo" : ""}`}
              onClick={() => onToggle(cat.id)}
              aria-pressed={elegida}
            >
              {elegida && <Check aria-hidden="true" />}
              {cat.nombre}
            </button>
          );
        })}
      </div>

      {formCrear}
      {error && <span className="campo-error">{error}</span>}
    </div>
  );
}

export default ChipsCategorias;
