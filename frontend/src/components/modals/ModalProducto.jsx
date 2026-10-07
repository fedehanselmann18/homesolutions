import { useState, useEffect } from "react";
import { Package, Truck } from "lucide-react";

import { TIPOS_PRODUCTO } from "../../constants/tipoProducto";
import ModalShell, { AccionesFormulario } from "./ModalShell";
import ChipsCategorias from "./ChipsCategorias";
import { CampoMonto } from "./CamposCotizacion";
import { ControlOpcion } from "../shared/ControlOpcion";

const OPCIONES_TIPO = Object.entries(TIPOS_PRODUCTO).map(([valor, info]) => ({
  valor,
  label: info.label,
  icono: info.icono,
}));

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
  const [errorTipo, setErrorTipo] = useState(null);

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
    setForm((prev) => ({ ...prev, [name]: value }));
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
    if (!form.tipo) {
      setErrorTipo("Elegí el tipo de producto.");
      return;
    }
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
      icono={Package}
      contexto={proveedor?.nombre}
      iconoContexto={Truck}
      onCerrar={onCerrar}
      onSubmit={handleSubmit}
      cerrarDeshabilitado={guardando}
      acciones={
        <AccionesFormulario
          guardando={guardando}
          onCancelar={onCerrar}
          textoGuardar={esEdicion ? "Guardar cambios" : "Crear producto"}
        />
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

      <ControlOpcion
        etiqueta="Tipo"
        opciones={OPCIONES_TIPO}
        valor={form.tipo}
        onCambiar={(tipo) => {
          // Si cambia el tipo, las categorías ya elegidas (de otro tipo) dejan de tener sentido.
          setForm((prev) => ({ ...prev, tipo, categoria_ids: [] }));
          setErrorTipo(null);
        }}
        error={errorTipo}
        variante="segmentado"
        disabled={guardando}
      />

      <CampoMonto
        etiqueta="Precio de catálogo"
        name="precio"
        value={form.precio}
        onChange={handleChange}
        disabled={guardando}
      />

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
