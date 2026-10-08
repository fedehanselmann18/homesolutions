import { useState, useEffect } from "react";
import { Building2, CalendarDays, Sparkles } from "lucide-react";

import { ComprobantesUploader } from "../shared/ComprobantesUploader";
import { ControlOpcion } from "../shared/ControlOpcion";
import { SeccionNotas } from "../shared/SeccionNotas";
import { formatMoneda, formatNumero } from "../../utils/formato";
import { TIPOS_FACTURA } from "../../constants/tipoFactura";
import { totalNotasCredito, totalNotasDebito } from "../../utils/notas";
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
 * Cuánto se lleva cobrado del proyecto y adónde llega con este cobro
 * (variante 5d): el dato que uno quiere tener a la vista al cargar una cuota.
 */
function AvanceCobro({ acordado, cobrado, nuevo }) {
  const pct = (monto) => Math.min((monto / acordado) * 100, 100);
  const pctCobrado = pct(cobrado);
  const pctNuevo = Math.max(pct(cobrado + nuevo) - pctCobrado, 0);
  return (
    <div className="modal-form-panel cobro-avance">
      <div className="cobro-avance__fila">
        <span>Cobrado del proyecto</span>
        <strong>
          {formatMoneda(cobrado, "usd")} de {formatNumero(acordado)}
        </strong>
      </div>
      <div className="cobro-avance__barra" aria-hidden="true">
        <span className="cobro-avance__cobrado" style={{ width: `${pctCobrado}%` }} />
        <span className="cobro-avance__nuevo" style={{ width: `${pctNuevo}%` }} />
      </div>
      <span className="cobro-avance__texto">
        {nuevo > 0
          ? `Con este cobro llegás al ${formatNumero(((cobrado + nuevo) / acordado) * 100, 0)}%`
          : `${formatNumero((cobrado / acordado) * 100, 0)}% cobrado`}
      </span>
    </div>
  );
}

/**
 * Alta y edición de un cobro — variante 5d. El cliente paga en dólares: el
 * monto se tipea en US$ y los pesos los congela el backend.
 *
 * `proyectoActual` es `{ id, nombre, precio_acordado_usd?, cobrado_usd? }`:
 * el nombre va en el header y, si vienen el precio y lo cobrado, arriba se
 * ve el avance de cobro.
 */
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
  // El cliente paga en dólares: el monto se tipea en USD y los pesos los
  // congela el backend con esta cotización.
  const cotizacion = useCotizacionDia({ fecha: form.fecha, inicial: cobro });
  const [intentoGuardar, setIntentoGuardar] = useState(false);
  const [camposIA, setCamposIA] = useState(new Set());
  const claseIA = (campo) => (camposIA.has(campo) ? "campo-ia" : "");

  useEffect(() => {
    if (cobro) {
      setForm({
        descripcion: cobro.descripcion ?? "",
        monto: cobro.monto_usd ?? "",
        fecha: cobro.fecha ?? "",
        tipo_factura: cobro.tipo_factura ?? "",
        proyecto_id: cobro.proyecto_id ?? "",
      });
    }
    setComprobantesCambios({ archivos: [], eliminarIds: [] });
  }, [cobro]);

  const cambiar = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrores((prev) => ({ ...prev, [name]: validarCampo(name, value) }));
  };
  const handleChange = (e) => cambiar(e.target.name, e.target.value);

  // Cobro no tiene fase/categoría/proveedor (ver modelo), así que acá la
  // IA solo aporta monto/fecha/tipo de factura/descripción.
  const handleAutocompletarIA = async (archivo) => {
    try {
      const resultado = await extraer(archivo, "cobro", {});

      // La IA lee el comprobante, que está en pesos (caveat 6.4 del plan),
      // pero el cobro se tipea en dólares: se convierte con la cotización
      // que tiene el form. Sin cotización no se puede convertir, así que el
      // monto queda sin completar en vez de meter pesos donde van dólares.
      const cotizacionForm = Number(cotizacion.valor);
      const montoUsd =
        resultado.monto && cotizacionForm > 0
          ? Math.round((resultado.monto / cotizacionForm) * 100) / 100
          : null;

      const leidos = new Set();
      if (resultado.descripcion) leidos.add("descripcion");
      if (montoUsd) leidos.add("monto");
      if (resultado.fecha) leidos.add("fecha");
      if (resultado.tipo_factura) leidos.add("tipo_factura");
      setCamposIA(leidos);

      if (resultado.monto && !montoUsd) {
        toast.error(
          `El comprobante dice ${formatMoneda(resultado.monto)}: cargá la cotización para pasarlo a dólares.`
        );
      } else if (montoUsd) {
        toast.success(
          `El comprobante dice ${formatMoneda(resultado.monto)}: se pasó a dólares con la cotización del form. Revisala.`
        );
      }

      setForm((prev) => ({
        ...prev,
        descripcion: resultado.descripcion ?? prev.descripcion,
        monto: montoUsd ?? prev.monto,
        fecha: resultado.fecha ?? prev.fecha,
        tipo_factura: resultado.tipo_factura ?? prev.tipo_factura,
      }));
      setErrores({});

      if (resultado.advertencias?.length) {
        resultado.advertencias.forEach((a) => toast.error(a));
      } else if (!resultado.monto) {
        toast.success("Comprobante leído. Revisá los datos antes de guardar.");
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail ?? "No se pudo leer el comprobante con IA");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const nuevosErrores = Object.fromEntries(
      Object.keys(ETIQUETAS).map((campo) => [campo, validarCampo(campo, form[campo])])
    );
    setErrores(nuevosErrores);
    setIntentoGuardar(true);
    if (Object.values(nuevosErrores).some(Boolean) || cotizacion.error) return;

    const payload = {
      descripcion: form.descripcion,
      monto_usd: Number(form.monto),
      ...cotizacion.payload,
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

  const faltantes = intentoGuardar
    ? [
        ...Object.keys(ETIQUETAS)
          .filter((campo) => errores[campo])
          .map((campo) => ETIQUETAS[campo]),
        ...(cotizacion.error ? ["Cotización"] : []),
      ]
    : [];

  // Las notas ya cargadas son las que llevan el bruto al neto. Se muestran
  // (de sólo lectura) para que el neto se entienda; se agregan y se borran
  // desde la ficha de detalle, mismo criterio que en Compra: una nota impacta
  // contra la API al instante y "Cancelar" dejaría de cancelar.
  const notas = cobro?.notas ?? [];
  const montoBruto = Number(form.monto) || 0;
  const montoNeto = montoBruto - totalNotasCredito(notas, "usd") + totalNotasDebito(notas, "usd");
  // Preview en pesos: el bruto con la cotización del form y cada nota con la
  // suya (ya congelada). La cifra que se guarda la calcula el backend.
  const netoArs =
    montoBruto * (Number(cotizacion.valor) || 0) -
    totalNotasCredito(notas, "ars") +
    totalNotasDebito(notas, "ars");

  const acordado = Number(proyectoActual?.precio_acordado_usd) || 0;
  const nombreProyecto = proyectoActual?.nombre;

  return (
    <ModalShell
      titulo={esEdicion ? "Editar cobro" : "Nuevo cobro"}
      icono={TIPOS_MOVIMIENTO.cobro.icono}
      contexto={nombreProyecto}
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
          textoGuardar={esEdicion ? "Guardar cambios" : "Crear cobro"}
        />
      }
    >
      {!esEdicion && acordado > 0 && (
        <AvanceCobro
          acordado={acordado}
          cobrado={Number(proyectoActual.cobrado_usd) || 0}
          nuevo={montoBruto}
        />
      )}

      <ComprobantesUploader
        existentes={cobro?.comprobantes ?? []}
        onVerExistente={onVerComprobante}
        onCambio={setComprobantesCambios}
        disabled={guardando}
        textoVacio="Adjuntá la factura o"
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
          placeholder="Ej: Cuota 4 de 6"
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
          moneda="usd"
          equivalente={textoEquivalente(form.monto, "usd", cotizacion.valor)}
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

      {notas.length > 0 && (
        <div className="modal-form-panel cobro-neto">
          <div className="cobro-avance__fila">
            <span className="modal-form-panel__titulo">Neto con notas</span>
            <strong>
              {formatMoneda(montoNeto, "usd")}
              {netoArs > 0 && <span className="cobro-neto__otra"> ≈ {formatMoneda(netoArs)}</span>}
            </strong>
          </div>
          <SeccionNotas notas={notas} contexto="cobro" onVer={onVerNota} canManage={false} />
        </div>
      )}
    </ModalShell>
  );
}

export default ModalCobro;
