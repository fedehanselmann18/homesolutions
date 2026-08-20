import { useState, useEffect } from "react";
import { TIPOS_PRODUCTO } from "../../constants/tipoProducto";
import ModalShell from "./ModalShell";
import ChipsCategorias from "./ChipsCategorias";

export function ModalProducto({
  producto,
  proveedor,
  categoriasDisponibles = [],
  onGuardar,
  onCerrar,
  onCategoriaCreada,
}) {
  const esEdicion = Boolean(producto);

  const [form, setForm] = useState({
    marca: "",
    modelo: "",
    tipo: "",
    precio: "",
    categoria_ids: [],
  });
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (producto) {
      setForm({
        marca: producto.marca ?? "",
        modelo: producto.modelo ?? "",
        tipo: producto.tipo ?? "",
        precio: producto.precio ?? "",
        categoria_ids: producto.categorias?.map((c) => c.id) ?? [],
      });
    }
  }, [producto]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
      // Si cambia el tipo, las categorías ya elegidas (de otro tipo) dejan de tener sentido.
      ...(name === "tipo" ? { categoria_ids: [] } : {}),
    }));
  };

  const toggleCategoria = (categoriaId) => {
    setForm((prev) => ({
      ...prev,
      categoria_ids: prev.categoria_ids.includes(categoriaId)
        ? prev.categoria_ids.filter((id) => id !== categoriaId)
        : [...prev.categoria_ids, categoriaId],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await onGuardar({
        marca: form.marca,
        modelo: form.modelo,
        tipo: form.tipo,
        precio: Number(form.precio),
        categoria_ids: form.categoria_ids,
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ModalShell
      titulo={esEdicion ? "Editar producto" : "Nuevo producto"}
      contexto={proveedor?.nombre}
      contextoDestacado
      onCerrar={onCerrar}
      onSubmit={handleSubmit}
      cerrarDeshabilitado={guardando}
      acciones={
        <>
          <button
            type="button"
            onClick={onCerrar}
            className="btn btn-secondary"
            disabled={guardando}
          >
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={guardando}>
            {guardando ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear producto"}
          </button>
        </>
      }
    >
      <div className="modal-form-fila">
        <label>
          Marca
          <input type="text" name="marca" value={form.marca} onChange={handleChange} required />
        </label>

        <label>
          Modelo
          <input type="text" name="modelo" value={form.modelo} onChange={handleChange} required />
        </label>
      </div>

      <div className="modal-form-fila">
        <label>
          Tipo
          <select name="tipo" value={form.tipo} onChange={handleChange} required>
            <option value="" disabled>
              Seleccioná un tipo
            </option>
            {Object.entries(TIPOS_PRODUCTO).map(([valor, info]) => (
              <option key={valor} value={valor}>
                {info.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Precio de catálogo
          <input
            type="number"
            name="precio"
            value={form.precio}
            onChange={handleChange}
            min="0"
            step="0.01"
            required
          />
        </label>
      </div>

      {form.tipo && (
        <ChipsCategorias
          categoriaIds={form.categoria_ids}
          tipo={form.tipo}
          categoriasDisponibles={categoriasDisponibles}
          onToggle={toggleCategoria}
          onLimpiar={() => setForm((prev) => ({ ...prev, categoria_ids: [] }))}
          onCategoriaCreada={onCategoriaCreada}
        />
      )}
    </ModalShell>
  );
}

export default ModalProducto;
