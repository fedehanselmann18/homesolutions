import { useState, useEffect } from "react";
import { ComprobantesUploader } from "../shared/ComprobantesUploader";
import { SeccionNotas } from "../shared/SeccionNotas";
import { formatFecha } from "../../utils/formato";
import { TIPOS_FACTURA, getTipoFacturaLabel } from "../../constants/tipoFactura";
import { totalNotasCredito, totalNotasDebito } from "../../utils/notas";
import { TIPOS_MOVIMIENTO } from "../../constants/tipoMovimiento";
import { useExtraccionIA } from "../../hooks/useExtraccionIA";
import { useToast } from "../../context/useToast";
import { validarRequerido, validarMonto, validarFecha } from "../../utils/formValidation";
import { BarraComposicion } from "./PiezasDetalle";
import { EditarShell, SeccionForm, TotalRiel } from "./PiezasEditar";
import { PasoComprobante, BannerIA, ResumenValidacion, MarcaIA } from "./PiezasIA";

const validarCampo = (name, value) => {
  if (name === "descripcion") return validarRequerido(value, "La descripción es obligatoria.");
  if (name === "monto") return validarMonto(value);
  if (name === "fecha") return validarFecha(value);
  return null;
};

export function ModalCobro({
  cobro,
  proyectoActual,
  onGuardar,
  onCerrar,
  onVerComprobante,
  onVerNota,
}) {
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

  // Flujo "IA primero" (dirección 5c): ver el comentario equivalente en
  // ModalCompra.jsx.
  const [mostrarFormulario, setMostrarFormulario] = useState(esEdicion);
  const [lecturaIA, setLecturaIA] = useState(null);
  const [camposIA, setCamposIA] = useState(new Set());
  const claseIA = (campo) => (camposIA.has(campo) ? "campo-ia" : "");

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

      const leidos = new Set();
      if (resultado.descripcion) leidos.add("descripcion");
      if (resultado.monto) leidos.add("monto");
      if (resultado.fecha) leidos.add("fecha");
      if (resultado.tipo_factura) leidos.add("tipo_factura");
      setCamposIA(leidos);

      setForm((prev) => ({
        ...prev,
        descripcion: resultado.descripcion ?? prev.descripcion,
        monto: resultado.monto ?? prev.monto,
        fecha: resultado.fecha ?? prev.fecha,
        tipo_factura: resultado.tipo_factura ?? prev.tipo_factura,
      }));

      setLecturaIA({ archivo: archivo.name, campos: leidos.size });
      setMostrarFormulario(true);

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

  const faltantes = [
    !form.descripcion ? "Descripción" : null,
    !form.monto ? "Monto" : null,
    !form.fecha ? "Fecha" : null,
    !form.tipo_factura ? "Tipo de factura" : null,
  ].filter(Boolean);

  const uploader = (
    <ComprobantesUploader
      key="comprobantes"
      existentes={cobro?.comprobantes ?? []}
      onVerExistente={onVerComprobante}
      onCambio={setComprobantesCambios}
      disabled={guardando}
      prominente={!mostrarFormulario}
    />
  );

  // Las notas ya cargadas son las que llevan el bruto al neto. Se muestran
  // (de sólo lectura) para que el número del riel se entienda; se agregan y
  // se borran desde la ficha de detalle, mismo criterio que en Compra: una
  // nota impacta contra la API al instante y "Cancelar" dejaría de cancelar.
  const notas = cobro?.notas ?? [];
  const notasCredito = totalNotasCredito(notas);
  const notasDebito = totalNotasDebito(notas);
  const montoBruto = Number(form.monto) || 0;
  const montoNeto = montoBruto - notasCredito + notasDebito;

  const contexto = [
    getTipoFacturaLabel(form.tipo_factura),
    !esEdicion ? proyectoActual?.nombre : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <EditarShell
      tipo={TIPOS_MOVIMIENTO.cobro.singular}
      icono={TIPOS_MOVIMIENTO.cobro.icono}
      esEdicion={esEdicion}
      contexto={contexto}
      fecha={form.fecha ? formatFecha(form.fecha) : null}
      conRiel
      guardando={guardando}
      onCerrar={onCerrar}
      onSubmit={handleSubmit}
      aviso={
        mostrarFormulario && faltantes.length > 0
          ? `Revisá ${faltantes.length} ${faltantes.length === 1 ? "campo" : "campos"}`
          : null
      }
      textoGuardar={esEdicion ? "Guardar cambios" : "Crear cobro"}
      guardarDeshabilitado={!mostrarFormulario}
    >
      {!mostrarFormulario ? (
        <div className="mov-edit__paso">
          <PasoComprobante
            hayArchivo={comprobantesCambios.archivos.length > 0}
            leyendo={extrayendo}
            onLeer={handleAutocompletarIA}
            onCargarAMano={() => setMostrarFormulario(true)}
          >
            {uploader}
          </PasoComprobante>
        </div>
      ) : (
        <div className="mov-edit__grid">
          <div className="mov-edit__form">
            {lecturaIA && (
              <BannerIA
                nombreArchivo={lecturaIA.archivo}
                resumen={`Leído con IA · ${lecturaIA.campos} ${lecturaIA.campos === 1 ? "campo" : "campos"} completados`}
                onVolverALeer={handleAutocompletarIA}
                leyendo={extrayendo}
                disabled={guardando}
              />
            )}

            <ResumenValidacion faltantes={faltantes} />

            <SeccionForm
              titulo="Comprobantes"
              accion={
                !lecturaIA && (
                  <button
                    type="button"
                    className="mov-edit__seccion-accion"
                    onClick={handleAutocompletarIA}
                    disabled={guardando || extrayendo || comprobantesCambios.archivos.length === 0}
                    title={
                      comprobantesCambios.archivos.length === 0
                        ? "Primero arrastrá o elegí un comprobante"
                        : "Leer el comprobante y prellenar el formulario"
                    }
                  >
                    {extrayendo ? "Leyendo..." : "Autocompletar con IA"}
                  </button>
                )
              }
            >
              {uploader}
            </SeccionForm>

            <SeccionForm titulo="Datos generales">
              {!esEdicion && proyectoActual && (
                <label className="mov-edit__campo">
                  Proyecto
                  <input
                    type="text"
                    value={`${proyectoActual.nombre} (proyecto actual)`}
                    disabled
                    readOnly
                  />
                </label>
              )}

              <label
                className={`mov-edit__campo mov-edit__campo--titulo ${claseIA("descripcion")}`}
              >
                Descripción
                <input
                  type="text"
                  name="descripcion"
                  value={form.descripcion}
                  onChange={handleChange}
                  required
                />
                {errores.descripcion && <p className="campo-error">{errores.descripcion}</p>}
                {camposIA.has("descripcion") && !errores.descripcion && <MarcaIA />}
              </label>

              <div className="mov-edit__campos">
                <label className={`mov-edit__campo ${claseIA("monto")}`}>
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
                  {camposIA.has("monto") && !errores.monto && <MarcaIA />}
                </label>

                <label className={`mov-edit__campo ${claseIA("fecha")}`}>
                  Fecha
                  <input
                    type="date"
                    name="fecha"
                    value={form.fecha}
                    onChange={handleChange}
                    required
                  />
                  {errores.fecha && <p className="campo-error">{errores.fecha}</p>}
                  {camposIA.has("fecha") && !errores.fecha && <MarcaIA />}
                </label>
              </div>

              <label
                className={`mov-edit__campo mov-edit__campo--corto ${claseIA("tipo_factura")}`}
              >
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
            </SeccionForm>
          </div>

          <aside className="mov-edit__riel">
            <TotalRiel
              label={notas.length > 0 ? "Neto" : "Monto"}
              monto={montoNeto}
              color={TIPOS_MOVIMIENTO.cobro.color}
            />

            <BarraComposicion
              segmentos={[
                { label: "Bruto", monto: montoBruto, color: TIPOS_MOVIMIENTO.cobro.color },
                {
                  label: "Nota de crédito",
                  monto: notasCredito,
                  color: TIPOS_MOVIMIENTO.nota_credito.color,
                  signo: -1,
                },
                {
                  label: "Nota de débito",
                  monto: notasDebito,
                  color: TIPOS_MOVIMIENTO.nota_debito.color,
                  signo: 1,
                },
              ]}
            />

            {notas.length > 0 && (
              <div className="mov-edit__notas">
                <SeccionNotas notas={notas} contexto="cobro" onVer={onVerNota} canManage={false} />
              </div>
            )}
          </aside>
        </div>
      )}
    </EditarShell>
  );
}

export default ModalCobro;
