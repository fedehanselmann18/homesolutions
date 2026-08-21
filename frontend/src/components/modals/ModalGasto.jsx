import { useState, useEffect } from "react";
import { ComprobantesUploader } from "../shared/ComprobantesUploader";
import { formatFecha } from "../../utils/formato";
import { TIPOS_FACTURA, getTipoFacturaLabel } from "../../constants/tipoFactura";
import { TIPOS_MOVIMIENTO } from "../../constants/tipoMovimiento";
import { useExtraccionIA } from "../../hooks/useExtraccionIA";
import { useToast } from "../../context/useToast";
import { validarRequerido, validarMonto, validarFecha } from "../../utils/formValidation";
import { EditarShell, SeccionForm } from "./PiezasEditar";
import { PasoComprobante, BannerIA, ResumenValidacion, MarcaIA } from "./PiezasIA";
import { LogoCargando } from "../shared/LogoCargando";

const validarCampo = (name, value) => {
  if (name === "descripcion") return validarRequerido(value, "La descripción es obligatoria.");
  if (name === "monto") return validarMonto(value);
  if (name === "fecha") return validarFecha(value);
  return null;
};

export function ModalGasto({
  gasto,
  categoriasDisponibles = [],
  fasesDisponibles = [],
  faseFija,
  onGuardar,
  onCerrar,
  onVerComprobante,
}) {
  const esEdicion = Boolean(gasto);

  const [form, setForm] = useState({
    descripcion: "",
    monto: "",
    fecha: "",
    tipo_factura: "",
    fase_id: faseFija?.id ?? "",
    categoria_gasto_ids: "",
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
    if (gasto) {
      setForm({
        descripcion: gasto.descripcion ?? "",
        monto: gasto.monto ?? "",
        fecha: gasto.fecha ?? "",
        tipo_factura: gasto.tipo_factura ?? "",
        // Si viene de la pantalla de una fase, la fase queda fija aunque
        // el gasto ya tuviera otra cargada (no debería pasar: acá solo se
        // editan gastos que ya son de esta fase).
        fase_id: faseFija?.id ?? gasto.fase_id ?? "",
        categoria_gasto_ids: gasto.categorias?.[0]?.id ?? "",
      });
    }
    setComprobantesCambios({ archivos: [], eliminarIds: [] });
  }, [gasto, faseFija]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrores((prev) => ({ ...prev, [name]: validarCampo(name, value) }));
  };

  // Toma el primer comprobante recién arrastrado/seleccionado (todavía sin
  // subir) y le pide a la IA que lo lea. Nunca pisa un campo que la IA no
  // pudo leer (queda en null) -- si el campo ya lo había tipeado el
  // usuario, se mantiene tal cual.
  const handleAutocompletarIA = async () => {
    const archivo = comprobantesCambios.archivos[0];
    if (!archivo) return;

    try {
      const resultado = await extraer(archivo, "gasto", {
        fases: fasesDisponibles.map((f) => ({ id: f.id, nombre: f.nombre })),
        categoriasGasto: categoriasDisponibles.map((c) => ({ id: c.id, nombre: c.nombre })),
      });

      const leidos = new Set();
      if (resultado.descripcion) leidos.add("descripcion");
      if (resultado.monto) leidos.add("monto");
      if (resultado.fecha) leidos.add("fecha");
      if (resultado.tipo_factura) leidos.add("tipo_factura");
      if (!faseFija && resultado.fase_id) leidos.add("fase_id");
      if (resultado.categoria_gasto_id) leidos.add("categoria_gasto_ids");
      setCamposIA(leidos);

      setForm((prev) => ({
        ...prev,
        descripcion: resultado.descripcion ?? prev.descripcion,
        monto: resultado.monto ?? prev.monto,
        fecha: resultado.fecha ?? prev.fecha,
        tipo_factura: resultado.tipo_factura ?? prev.tipo_factura,
        fase_id: faseFija ? prev.fase_id : (resultado.fase_id ?? prev.fase_id),
        categoria_gasto_ids: resultado.categoria_gasto_id ?? prev.categoria_gasto_ids,
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
      // Con faseFija la fase no se puede tocar desde el form -- se manda
      // siempre la fija, sin depender del estado del selector (que ni se dibuja).
      fase_id: faseFija?.id ?? form.fase_id ?? null,
      categoria_gasto_ids: form.categoria_gasto_ids ? [form.categoria_gasto_ids] : [],
    };

    // proyecto_id no se manda desde acá: Acciones.jsx ya sabe en qué
    // proyecto está parado y lo agrega al crear (GastoUpdate tampoco lo
    // acepta -- no se puede reasignar el proyecto de un gasto existente).

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
      existentes={gasto?.comprobantes ?? []}
      onVerExistente={onVerComprobante}
      onCambio={setComprobantesCambios}
      disabled={guardando}
      prominente={!mostrarFormulario}
    />
  );

  // El contexto del header acompaña lo elegido, igual que en Compra.
  const nombreFaseElegida =
    faseFija?.nombre ?? fasesDisponibles.find((f) => f.id === form.fase_id)?.nombre;
  const contexto = [getTipoFacturaLabel(form.tipo_factura), nombreFaseElegida ?? "Gasto general"]
    .filter(Boolean)
    .join(" · ");

  return (
    <EditarShell
      tipo={TIPOS_MOVIMIENTO.gasto.singular}
      icono={TIPOS_MOVIMIENTO.gasto.icono}
      esEdicion={esEdicion}
      contexto={contexto}
      fecha={form.fecha ? formatFecha(form.fecha) : null}
      guardando={guardando}
      onCerrar={onCerrar}
      onSubmit={handleSubmit}
      aviso={
        mostrarFormulario && faltantes.length > 0
          ? `Revisá ${faltantes.length} ${faltantes.length === 1 ? "campo" : "campos"}`
          : null
      }
      // Gasto no lleva riel: su monto se tipea a mano, así que el total va
      // en el footer (un riel que repita el número que estás escribiendo no
      // agrega nada, a diferencia de Compra/Cobro donde el total es derivado).
      totalLabel="Monto"
      total={Number(form.monto) || 0}
      totalColor={TIPOS_MOVIMIENTO.gasto.color}
      textoGuardar={esEdicion ? "Guardar cambios" : "Crear gasto"}
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
        <div className="mov-edit__solo-form">
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
                  {extrayendo ? (
                    <>
                      <LogoCargando size={13} />
                      Leyendo...
                    </>
                  ) : (
                    "Autocompletar con IA"
                  )}
                </button>
              )
            }
          >
            {uploader}
          </SeccionForm>

          <SeccionForm titulo="Datos generales">
            <label className={`mov-edit__campo mov-edit__campo--titulo ${claseIA("descripcion")}`}>
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
          </SeccionForm>

          <SeccionForm titulo="Clasificación">
            <div className="mov-edit__campos">
              <label className={`mov-edit__campo ${claseIA("tipo_factura")}`}>
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

              {faseFija ? (
                <label className="mov-edit__campo">
                  Fase
                  <input type="text" value={faseFija.nombre} disabled readOnly />
                </label>
              ) : (
                fasesDisponibles.length > 0 && (
                  <label className="mov-edit__campo">
                    Fase (opcional)
                    <select name="fase_id" value={form.fase_id} onChange={handleChange}>
                      <option value="">Sin fase (gasto general)</option>
                      {fasesDisponibles.map((fase) => (
                        <option key={fase.id} value={fase.id}>
                          {fase.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                )
              )}
            </div>

            {categoriasDisponibles.length > 0 && (
              <label className="mov-edit__campo">
                Categoría
                <select
                  name="categoria_gasto_ids"
                  value={form.categoria_gasto_ids}
                  onChange={handleChange}
                >
                  <option value="">Sin categoría</option>
                  {categoriasDisponibles.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nombre}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </SeccionForm>
        </div>
      )}
    </EditarShell>
  );
}

export default ModalGasto;
