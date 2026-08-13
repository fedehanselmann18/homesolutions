import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { ComprobantesUploader } from "../shared/ComprobantesUploader";
import { TIPOS_FACTURA } from "../../constants/tipoFactura";
import { useExtraccionIA } from "../../hooks/useExtraccionIA";
import { useToast } from "../../context/useToast";
import { validarRequerido, validarMonto, validarFecha } from "../../utils/formValidation";
import "./ModalCobro.css";

const validarCampo = (name, value) => {
  if (name === "descripcion") return validarRequerido(value, "La descripción es obligatoria.");
  if (name === "monto") return validarMonto(value);
  if (name === "fecha") return validarFecha(value);
  return null;
};

export function ModalCobro({ cobro, proyectoActual, onGuardar, onCerrar, onVerComprobante }) {
  const esEdicion = Boolean(cobro);

  const [form, setForm] = useState({
    descripcion: "",
    monto: "",
    fecha: "",
    tipo_factura: "",
    proyecto_id: proyectoActual?.id ?? "",
  });
  const [comprobantesCambios, setComprobantesCambios] = useState({ archivos: [], eliminarIds: [] });
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState({});
  const { extraer, extrayendo } = useExtraccionIA();
  const toast = useToast();

  useEffect(() => {
    if (cobro) {
      setForm({
        descripcion: cobro.descripcion ?? "",
        monto: cobro.monto ?? "",
        fecha: cobro.fecha ?? "",
        tipo_factura: cobro.tipo_factura ?? "",
        proyecto_id: cobro.proyecto_id ?? "",
      });
    }
    setComprobantesCambios({ archivos: [], eliminarIds: [] });
  }, [cobro]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrores((prev) => ({ ...prev, [name]: validarCampo(name, value) }));
  };

  // Cobro no tiene fase/categoría/proveedor (ver modelo), así que acá la
  // IA solo aporta monto/fecha/tipo de factura/descripción.
  const handleAutocompletarIA = async () => {
    const archivo = comprobantesCambios.archivos[0];
    if (!archivo) return;

    try {
      const resultado = await extraer(archivo, "cobro", {});

      setForm((prev) => ({
        ...prev,
        descripcion: resultado.descripcion ?? prev.descripcion,
        monto: resultado.monto ?? prev.monto,
        fecha: resultado.fecha ?? prev.fecha,
        tipo_factura: resultado.tipo_factura ?? prev.tipo_factura,
      }));

      if (resultado.advertencias?.length) {
        resultado.advertencias.forEach((a) => toast.error(a));
      } else {
        toast.success("Comprobante leído. Revisá los datos antes de guardar.");
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail ?? "No se pudo leer el comprobante con IA");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const nuevosErrores = {
      descripcion: validarCampo("descripcion", form.descripcion),
      monto: validarCampo("monto", form.monto),
      fecha: validarCampo("fecha", form.fecha),
    };
    setErrores(nuevosErrores);
    if (Object.values(nuevosErrores).some(Boolean)) return;

    const payload = {
      descripcion: form.descripcion,
      monto: Number(form.monto),
      fecha: form.fecha,
      tipo_factura: form.tipo_factura,
    };

    // CobroUpdate no acepta proyecto_id -- solo se manda en la creación.
    if (!esEdicion) {
      payload.proyecto_id = form.proyecto_id;
    }

    setGuardando(true);
    try {
      await onGuardar(payload, comprobantesCambios);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-contenido modal-contenido--ancho" onClick={(e) => e.stopPropagation()}>
        <h2>{esEdicion ? "Editar cobro" : "Nuevo cobro"}</h2>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-form-seccion modal-form-seccion--ia">
            <div className="modal-form-seccion-header">
              <span>Comprobantes</span>
            </div>
            <ComprobantesUploader
              existentes={cobro?.comprobantes ?? []}
              onVerExistente={onVerComprobante}
              onCambio={setComprobantesCambios}
              disabled={guardando}
            />
            <button
              type="button"
              className="modal-btn-ia"
              onClick={handleAutocompletarIA}
              disabled={guardando || extrayendo || comprobantesCambios.archivos.length === 0}
              title={
                comprobantesCambios.archivos.length === 0
                  ? "Primero arrastrá o elegí un comprobante"
                  : "Leer el comprobante y prellenar el formulario"
              }
            >
              <Sparkles size={16} strokeWidth={2.25} />
              {extrayendo ? "Leyendo comprobante..." : "Autocompletar con IA"}
            </button>
          </div>

          <div className="modal-form-seccion">
            <div className="modal-form-seccion-header">
              <span>Datos generales</span>
            </div>

            {!esEdicion && proyectoActual && (
              <label>
                Proyecto
                <input
                  type="text"
                  value={`${proyectoActual.nombre} (proyecto actual)`}
                  disabled
                  readOnly
                />
              </label>
            )}

            <label>
              Descripción
              <input
                type="text"
                name="descripcion"
                value={form.descripcion}
                onChange={handleChange}
                required
              />
              {errores.descripcion && <p className="campo-error">{errores.descripcion}</p>}
            </label>

            <div className="modal-form-fila">
              <label>
                Monto
                <input
                  type="number"
                  name="monto"
                  value={form.monto}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  required
                />
                {errores.monto && <p className="campo-error">{errores.monto}</p>}
              </label>

              <label>
                Fecha
                <input
                  type="date"
                  name="fecha"
                  value={form.fecha}
                  onChange={handleChange}
                  required
                />
                {errores.fecha && <p className="campo-error">{errores.fecha}</p>}
              </label>
            </div>

            <label>
              Tipo de factura
              <select
                name="tipo_factura"
                value={form.tipo_factura}
                onChange={handleChange}
                required
              >
                <option value="" disabled>
                  Selecciona un tipo de factura
                </option>
                {TIPOS_FACTURA.map((tipo) => (
                  <option key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="modal-acciones">
            <button
              type="button"
              onClick={onCerrar}
              className="modal-btn-cancelar"
              disabled={guardando}
            >
              Cancelar
            </button>
            <button type="submit" className="modal-btn-guardar" disabled={guardando}>
              {guardando ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear cobro"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ModalCobro;
