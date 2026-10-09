import { useState, useEffect } from "react";
import { Building2, CalendarDays, Sparkles } from "lucide-react";

import { ComprobantesUploader } from "../shared/ComprobantesUploader";
import { ControlOpcion } from "../shared/ControlOpcion";
import { TIPOS_FACTURA } from "../../constants/tipoFactura";
import { TIPOS_MOVIMIENTO } from "../../constants/tipoMovimiento";
import { useExtraccionIA } from "../../hooks/useExtraccionIA";
import { useToast } from "../../context/useToast";
import {
  avisoFaltantes,
  validarRequerido,
  validarMonto,
  validarFecha,
} from "../../utils/formValidation";
import { textoEquivalente } from "../../utils/moneda";
import { hoyISO } from "../../utils/formato";
import { ErrorCampo } from "../shared/ErrorCampo";
import ModalShell, { AccionesFormulario } from "./ModalShell";
import { BotonIA, MarcaIA } from "./PiezasIA";
import { CampoMonto, CamposCotizacion } from "./CamposCotizacion";
import { useCotizacionDia } from "../../hooks/useCotizacionDia";

const OPCIONES_FACTURA = TIPOS_FACTURA.map((t) => ({ valor: t.value, label: t.label }));

const validarCampo = (name, value) => {
  if (name === "descripcion") return validarRequerido(value, "Escribí una descripción corta.");
  if (name === "monto") return validarMonto(value);
  if (name === "fecha") return validarFecha(value);
  if (name === "tipo_factura") return value ? null : "Elegí el tipo de comprobante.";
  return null;
};

const ETIQUETAS = {
  descripcion: "Descripción",
  monto: "Monto",
  fecha: "Fecha",
  tipo_factura: "Comprobante",
};

/**
 * Alta y edición de un gasto — variante 5c. El comprobante va primero y
 * "Autocompletar con IA" al lado del archivo (DESIGN.md §14). Los errores van
 * en cada campo y aparecen al tocarlo o al intentar guardar; el pie dice
 * cuántos faltan.
 *
 * `contexto` es dónde se carga (el proyecto, o proyecto · fase): va en el
 * header, no como un campo deshabilitado.
 */
export function ModalGasto({
  gasto,
  contexto,
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
    fecha: hoyISO(),
    tipo_factura: "",
    fase_id: faseFija?.id ?? "",
    categoria_gasto_ids: "",
  });
  const [comprobantesCambios, setComprobantesCambios] = useState({ archivos: [], eliminarIds: [] });
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState({});
  const { extraer, extrayendo } = useExtraccionIA();
  const toast = useToast();
  // El gasto se paga en pesos: el monto se tipea en ARS y el USD lo congela
  // el backend con esta cotización.
  const cotizacion = useCotizacionDia({ fecha: form.fecha, inicial: gasto });
  const [intentoGuardar, setIntentoGuardar] = useState(false);
  const [camposIA, setCamposIA] = useState(new Set());
  const claseIA = (campo) => (camposIA.has(campo) ? "campo-ia" : "");

  useEffect(() => {
    if (gasto) {
      setForm({
        descripcion: gasto.descripcion ?? "",
        monto: gasto.monto_ars ?? "",
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

  const cambiar = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrores((prev) => ({ ...prev, [name]: validarCampo(name, value) }));
  };
  const handleChange = (e) => cambiar(e.target.name, e.target.value);

  // Le pide a la IA que lea el primer comprobante recién elegido (todavía sin
  // subir). Nunca pisa un campo que la IA no pudo leer (queda en null) -- si
  // el campo ya lo había tipeado el usuario, se mantiene tal cual.
  const handleAutocompletarIA = async (archivo) => {
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
      setErrores({});

      if (resultado.advertencias?.length) {
        resultado.advertencias.forEach((a) => toast.error(a));
      } else {
        toast.success("Comprobante leído. Revisá los datos antes de guardar.");
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail ?? "No se pudo leer el comprobante con IA");
    }
  };

  const validarTodo = () =>
    Object.fromEntries(
      Object.keys(ETIQUETAS).map((campo) => [campo, validarCampo(campo, form[campo])])
    );

  const handleSubmit = async (e) => {
    e.preventDefault();

    const nuevosErrores = validarTodo();
    setErrores(nuevosErrores);
    setIntentoGuardar(true);
    if (Object.values(nuevosErrores).some(Boolean) || cotizacion.error) return;

    const payload = {
      descripcion: form.descripcion,
      monto_ars: Number(form.monto),
      ...cotizacion.payload,
      fecha: form.fecha,
      tipo_factura: form.tipo_factura,
      // Con faseFija la fase no se puede tocar desde el form -- se manda
      // siempre la fija, sin depender del estado del selector (que ni se dibuja).
      fase_id: faseFija?.id ?? (form.fase_id || null),
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

  const faltantes = intentoGuardar
    ? [
        ...Object.keys(ETIQUETAS)
          .filter((campo) => errores[campo])
          .map((campo) => ETIQUETAS[campo]),
        ...(cotizacion.error ? ["Cotización"] : []),
      ]
    : [];

  return (
    <ModalShell
      titulo={esEdicion ? "Editar gasto" : "Nuevo gasto"}
      icono={TIPOS_MOVIMIENTO.gasto.icono}
      contexto={contexto ?? faseFija?.nombre}
      iconoContexto={Building2}
      onCerrar={onCerrar}
      onSubmit={handleSubmit}
      validacionPropia
      cerrarDeshabilitado={guardando}
      aviso={avisoFaltantes(faltantes)}
      acciones={
        <AccionesFormulario
          guardando={guardando}
          onCancelar={onCerrar}
          textoGuardar={esEdicion ? "Guardar cambios" : "Crear gasto"}
        />
      }
    >
      <ComprobantesUploader
        existentes={gasto?.comprobantes ?? []}
        onVerExistente={onVerComprobante}
        onCambio={setComprobantesCambios}
        disabled={guardando}
        extraVacio={
          <>
            <Sparkles size={12} strokeWidth={2} aria-hidden="true" />
            Autocompletá con IA
          </>
        }
        accionArchivo={(archivo) => (
          <BotonIA
            onClick={() => handleAutocompletarIA(archivo)}
            disabled={guardando || extrayendo}
            leyendo={extrayendo}
          >
            {camposIA.size > 0 ? "Volver a leer" : "Autocompletar con IA"}
          </BotonIA>
        )}
      />

      <label className={claseIA("descripcion")}>
        Descripción
        <input
          type="text"
          name="descripcion"
          value={form.descripcion}
          onChange={handleChange}
          placeholder="Ej: Peajes y estacionamiento del equipo de montaje"
          aria-invalid={errores.descripcion ? true : undefined}
          className={errores.descripcion ? "campo--error" : undefined}
          required
        />
        <ErrorCampo texto={errores.descripcion} />
        {camposIA.has("descripcion") && !errores.descripcion && <MarcaIA />}
      </label>

      <div className="modal-form-fila modal-form-fila--monto">
        <CampoMonto
          className={claseIA("monto")}
          value={form.monto}
          onChange={handleChange}
          moneda="ars"
          equivalente={textoEquivalente(form.monto, "ars", cotizacion.valor)}
          error={errores.monto}
          disabled={guardando}
        >
          {camposIA.has("monto") && <MarcaIA />}
        </CampoMonto>

        <label className={claseIA("fecha")}>
          Fecha
          <div className={`campo${errores.fecha ? " campo--error" : ""}`}>
            <CalendarDays aria-hidden="true" />
            <input type="date" name="fecha" value={form.fecha} onChange={handleChange} required />
          </div>
          <ErrorCampo texto={errores.fecha} />
          {camposIA.has("fecha") && !errores.fecha && <MarcaIA />}
        </label>
      </div>

      <CamposCotizacion
        cotizacion={cotizacion}
        mostrarError={intentoGuardar}
        disabled={guardando}
      />

      <ControlOpcion
        etiqueta="Comprobante"
        opciones={OPCIONES_FACTURA}
        valor={form.tipo_factura}
        onCambiar={(valor) => cambiar("tipo_factura", valor)}
        error={errores.tipo_factura}
        hint={camposIA.has("tipo_factura") ? <MarcaIA /> : null}
        disabled={guardando}
      />

      <div className="modal-form-fila">
        {!faseFija && fasesDisponibles.length > 0 && (
          <label className={claseIA("fase_id")}>
            <span>
              Fase <span className="label-campo__opcional">(opcional)</span>
            </span>
            <select name="fase_id" value={form.fase_id} onChange={handleChange}>
              <option value="">Gasto general</option>
              {fasesDisponibles.map((fase) => (
                <option key={fase.id} value={fase.id}>
                  {fase.nombre}
                </option>
              ))}
            </select>
          </label>
        )}

        {categoriasDisponibles.length > 0 && (
          <label className={claseIA("categoria_gasto_ids")}>
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
      </div>
    </ModalShell>
  );
}

export default ModalGasto;
