import { useState, useEffect } from "react";
import { Package, Truck } from "lucide-react";

import { TIPOS_PRODUCTO } from "../../constants/tipoProducto";
import ModalShell, { AccionesFormulario } from "./ModalShell";
import ChipsCategorias from "./ChipsCategorias";
import { CampoMonto } from "./CamposCotizacion";
import { ControlOpcion } from "../shared/ControlOpcion";
import { ErrorCampo } from "../shared/ErrorCampo";
import { avisoFaltantes, validarMonto, validarRequerido } from "../../utils/formValidation";

const OPCIONES_TIPO = Object.entries(TIPOS_PRODUCTO).map(([valor, info]) => ({
  valor,
  label: info.label,
  icono: info.icono,
}));

const validarCampo = (name, value) => {
  if (name === "marca") return validarRequerido(value, "Escribí la marca.");
  if (name === "modelo") return validarRequerido(value, "Escribí el modelo.");
  if (name === "tipo") return value ? null : "Elegí el tipo de producto.";
  if (name === "precio") return validarMonto(value);
  return null;
};

const ETIQUETAS = { marca: "Marca", modelo: "Modelo", tipo: "Tipo", precio: "Precio" };

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
  const [errores, setErrores] = useState({});

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

  const cambiar = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    // Un campo que ya marcó error se revalida al escribir, para que el error
    // se vaya apenas se corrige (como en gasto y compra).
    if (errores[name]) setErrores((prev) => ({ ...prev, [name]: validarCampo(name, value) }));
  };
  const handleChange = (e) => cambiar(e.target.name, e.target.value);

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
    const nuevosErrores = Object.fromEntries(
      Object.keys(ETIQUETAS).map((campo) => [campo, validarCampo(campo, form[campo])])
    );
    setErrores(nuevosErrores);
    if (Object.values(nuevosErrores).some(Boolean)) return;

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

  const faltantes = Object.keys(ETIQUETAS)
    .filter((campo) => errores[campo])
    .map((campo) => ETIQUETAS[campo]);

  return (
    <ModalShell
      titulo={esEdicion ? "Editar producto" : "Nuevo producto"}
      icono={Package}
      contexto={proveedor?.nombre}
      iconoContexto={Truck}
      onCerrar={onCerrar}
      onSubmit={handleSubmit}
      validacionPropia
      aviso={avisoFaltantes(faltantes)}
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
          <input
            type="text"
            name="marca"
            value={form.marca}
            onChange={handleChange}
            placeholder="Ej: Prysmian"
            aria-invalid={errores.marca ? true : undefined}
            className={errores.marca ? "campo--error" : undefined}
            required
          />
          <ErrorCampo texto={errores.marca} />
        </label>

        <label>
          Modelo
          <input
            type="text"
            name="modelo"
            value={form.modelo}
            onChange={handleChange}
            placeholder="Ej: Cable 2x1.5mm x 50m"
            aria-invalid={errores.modelo ? true : undefined}
            className={errores.modelo ? "campo--error" : undefined}
            required
          />
          <ErrorCampo texto={errores.modelo} />
        </label>
      </div>

      <ControlOpcion
        etiqueta="Tipo"
        opciones={OPCIONES_TIPO}
        valor={form.tipo}
        onCambiar={(tipo) => {
          // Si cambia el tipo, las categorías ya elegidas (de otro tipo) dejan de tener sentido.
          setForm((prev) => ({ ...prev, tipo, categoria_ids: [] }));
          setErrores((prev) => ({ ...prev, tipo: null }));
        }}
        error={errores.tipo}
        variante="segmentado"
        disabled={guardando}
      />

      <CampoMonto
        etiqueta="Precio de catálogo"
        name="precio"
        value={form.precio}
        onChange={handleChange}
        error={errores.precio}
        disabled={guardando}
      />

      {!form.tipo && (
        <div className="chips-cat">
          <div className="chips-cat-header">
            <span className="chips-cat-label">Categorías</span>
          </div>
          <p className="campo-hint">Elegí el tipo para ver sus categorías.</p>
        </div>
      )}

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
