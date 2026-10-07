import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Check,
  CircleCheck,
  Clock,
  PackageCheck,
  Plus,
  Sparkles,
  Truck,
  X,
} from "lucide-react";

import { ComprobantesUploader } from "../shared/ComprobantesUploader";
import { ControlOpcion } from "../shared/ControlOpcion";
import { SeccionNotas } from "../shared/SeccionNotas";
import { formatMoneda } from "../../utils/formato";
import { TIPOS_FACTURA } from "../../constants/tipoFactura";
import { getTipoProducto } from "../../constants/tipoProducto";
import { getCondicionPagoLabel } from "../../constants/estadoCompra";
import { totalNotasCredito, totalNotasDebito } from "../../utils/notas";
import { ATENCION_TEXTO, OLIVA_OSCURO } from "../../constants/colores";
import { TIPOS_MOVIMIENTO } from "../../constants/tipoMovimiento";
import { useExtraccionIA } from "../../hooks/useExtraccionIA";
import { useToast } from "../../context/useToast";
import { avisoFaltantes, validarRequerido, validarFecha } from "../../utils/formValidation";
import { ErrorCampo } from "../shared/ErrorCampo";
import ModalShell from "./ModalShell";
import { BotonIA, MarcaIA } from "./PiezasIA";
import { LogoCargando } from "../shared/LogoCargando";
import { CamposCotizacion } from "./CamposCotizacion";
import { useCotizacionDia } from "../../hooks/useCotizacionDia";

import "./ModalCompra.css";

const OPCIONES_FACTURA = TIPOS_FACTURA.map((t) => ({ valor: t.value, label: t.label }));
const OPCIONES_CONDICION = ["contado", "cuenta_corriente", "cheque", "transferencia"].map(
  (valor) => ({ valor, label: getCondicionPagoLabel(valor) })
);
// Pago y envío son dos valores de un dato, no un interruptor (DESIGN.md §9):
// segmentado con el ícono y el color de texto de su badge.
const OPCIONES_PAGO = [
  { valor: "pendiente", label: "Pendiente", icono: Clock, color: ATENCION_TEXTO },
  { valor: "pagado", label: "Pagado", icono: CircleCheck, color: OLIVA_OSCURO },
];
const OPCIONES_ENVIO = [
  { valor: "pedido", label: "Pedido", icono: Truck },
  { valor: "entregado", label: "Entregado", icono: PackageCheck, color: OLIVA_OSCURO },
];

// Los tres pasos de 5b. Cada uno valida sus campos antes de avanzar.
const PASOS = [
  { label: "Comprobante y datos", campos: ["proveedor_id", "fase_id", "descripcion", "fecha"] },
  { label: "Condiciones", campos: ["tipo_factura", "condicion_pago"] },
  { label: "Productos e impuestos", campos: [] },
];

const ETIQUETAS = {
  proveedor_id: "Proveedor",
  fase_id: "Fase",
  descripcion: "Descripción",
  fecha: "Fecha",
  tipo_factura: "Tipo de factura",
  condicion_pago: "Condición de pago",
};

let contadorFilaTemp = 0;
const nuevaFilaId = () => `tmp-${++contadorFilaTemp}`;

/**
 * Nueva compra y edición — el híbrido 5ab de DESIGN.md §14.
 *
 * - Shell de 5b: 760px y tres pasos con su barrita de progreso. Los pasos se
 *   pueden recorrer clickeando su nombre; "Siguiente" valida el paso.
 * - Chips de 5a: tipo de factura y condición de pago quedan visibles en su
 *   paso (no detrás de un "Editar"), y pago y envío son segmentados.
 * - Pie en dos niveles: el desglose en su fila sobre el suave, y abajo el
 *   total grande con los botones. El pie es fijo: el total no se pierde.
 *
 * `contexto` es dónde se carga (el proyecto, o proyecto · fase): va en el
 * header con el proveedor elegido, no como campos deshabilitados.
 */
export function ModalCompra({
  compra,
  contexto,
  fasesDisponibles = [],
  faseFija,
  proveedores = [],
  proveedorFijo,
  productosDisponibles = [],
  impuestosDisponibles = [],
  onGuardar,
  onCerrar,
  onVerComprobante,
  onVerNota,
}) {
  const esEdicion = Boolean(compra);

  const [form, setForm] = useState({
    fase_id: faseFija?.id ?? "",
    proveedor_id: proveedorFijo?.id ?? "",
    descripcion: "",
    tipo_factura: "",
    fecha: "",
    condicion_pago: "",
    estado_pago: "pendiente",
    estado_envio: "pedido",
  });
  const [paso, setPaso] = useState(0);
  const [detalle, setDetalle] = useState([]);
  const [impuestos, setImpuestos] = useState([]);
  const [comprobantesCambios, setComprobantesCambios] = useState({ archivos: [], eliminarIds: [] });
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState({});
  const { extraer, extrayendo } = useExtraccionIA();
  const toast = useToast();
  // La compra se paga en pesos (el catálogo del proveedor está en pesos): el
  // neto se arma en ARS y el USD lo congela el backend con esta cotización.
  // Los impuestos heredan la misma (ver docs/PLAN_TIPO_CAMBIO.md).
  const cotizacion = useCotizacionDia({ fecha: form.fecha, inicial: compra });
  const [intentoGuardar, setIntentoGuardar] = useState(false);
  const [camposIA, setCamposIA] = useState(new Set());
  const claseIA = (campo) => (camposIA.has(campo) ? "campo-ia" : "");

  useEffect(() => {
    if (compra) {
      setForm({
        // Con faseFija/proveedorFijo esos campos no se pueden cambiar desde
        // acá: no se dibuja su selector.
        fase_id: faseFija?.id ?? compra.fase_id ?? "",
        proveedor_id: proveedorFijo?.id ?? compra.proveedor_id ?? "",
        descripcion: compra.descripcion ?? "",
        tipo_factura: compra.tipo_factura ?? "",
        fecha: compra.fecha ?? "",
        condicion_pago: compra.condicion_pago ?? "",
        estado_pago: compra.estado_pago ?? "pendiente",
        estado_envio: compra.estado_envio ?? "pedido",
      });
      setDetalle(
        (compra.detalle ?? []).map((d) => ({
          _id: nuevaFilaId(),
          producto_id: d.producto_id,
          cantidad: d.cantidad,
          precio_unitario: d.precio_unitario,
        }))
      );
      setImpuestos(
        (compra.impuestos_aplicados ?? []).map((i) => ({
          _id: nuevaFilaId(),
          impuesto_id: i.impuesto_id,
          monto: i.monto,
        }))
      );
    }
    setComprobantesCambios({ archivos: [], eliminarIds: [] });
  }, [compra, faseFija, proveedorFijo]);

  const productosDelProveedor = productosDisponibles.filter(
    (p) => p.proveedor_id === form.proveedor_id
  );

  // Precio neto y total NO se cargan a mano: se calculan solos a partir de
  // las líneas de producto (cantidad x precio unitario) y los impuestos
  // cargados, así nunca queda un total desactualizado respecto al detalle.
  const precioNeto = detalle.reduce(
    (acc, fila) => acc + (Number(fila.cantidad) || 0) * (Number(fila.precio_unitario) || 0),
    0
  );
  const totalImpuestos = impuestos.reduce((acc, fila) => acc + (Number(fila.monto) || 0), 0);

  // Las notas de crédito/débito ya existentes entran en el total que se
  // muestra, igual que en la ficha de detalle: si no, el modal de edición
  // mostraría un total distinto al de la ficha para la misma compra. No se
  // editan desde acá (se gestionan en la ficha), sólo se muestran.
  const notas = compra?.notas ?? [];
  const notasCredito = totalNotasCredito(notas);
  const notasDebito = totalNotasDebito(notas);
  const precioTotal = precioNeto + totalImpuestos - notasCredito + notasDebito;
  // Preview en dólares: neto e impuestos con la cotización del form, y cada
  // nota con la suya (ya congelada). La cifra que vale la arma el backend.
  const cotizacionNumero = Number(cotizacion.valor);
  const precioTotalUsd =
    cotizacionNumero > 0
      ? (precioNeto + totalImpuestos) / cotizacionNumero -
        totalNotasCredito(notas, "usd") +
        totalNotasDebito(notas, "usd")
      : null;

  // Qué producto (y cuánto) devuelve cada nota -- mismo criterio que
  // ModalDetalleCompra, para que la nota no sea un monto suelto.
  const resolverProductoDeNota = (detalleCompraId) => {
    const linea = compra?.detalle?.find((d) => d.id === detalleCompraId);
    if (!linea) return null;
    const producto = productosDisponibles.find((p) => p.id === linea.producto_id);
    return producto ? `${producto.marca} ${producto.modelo}` : null;
  };

  const validarCampo = (name, value) => {
    if (name === "descripcion") return validarRequerido(value, "Escribí una descripción corta.");
    if (name === "fecha") return validarFecha(value);
    if (name === "fase_id") return faseFija || value ? null : "Elegí la fase.";
    if (name === "proveedor_id") return proveedorFijo || value ? null : "Elegí el proveedor.";
    if (name === "tipo_factura") return value ? null : "Elegí el tipo de factura.";
    if (name === "condicion_pago") return value ? null : "Elegí la condición de pago.";
    return null;
  };

  const cambiar = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrores((prev) => ({ ...prev, [name]: validarCampo(name, value) }));
    // Las líneas de detalle quedan atadas a un proveedor -- si cambia,
    // los productos ya elegidos dejan de tener sentido.
    if (name === "proveedor_id") setDetalle([]);
  };
  const handleChange = (e) => cambiar(e.target.name, e.target.value);

  // Le pide a la IA que lea el primer comprobante recién elegido (todavía sin
  // subir). precio_neto sigue sin tocarse a mano (se calcula solo de las
  // líneas de detalle) pero, si la IA identifica el proveedor Y reconoce
  // productos de SU catálogo en la factura, agrega esas líneas -- con la
  // cantidad que leyó y el precio de catálogo del producto (nunca un precio
  // leído de la factura).
  const handleAutocompletarIA = async (archivo) => {
    try {
      const resultado = await extraer(archivo, "compra", {
        fases: fasesDisponibles.map((f) => ({ id: f.id, nombre: f.nombre })),
        proveedores: proveedores.map((p) => ({ id: p.id, nombre: p.nombre, cuit: p.cuit })),
        productos: productosDisponibles.map((p) => ({
          id: p.id,
          marca: p.marca,
          modelo: p.modelo,
          proveedor_id: p.proveedor_id,
        })),
        impuestos: impuestosDisponibles.map((i) => ({ id: i.id, nombre: i.nombre })),
      });

      const proveedorResuelto = proveedorFijo?.id ?? resultado.proveedor_id ?? form.proveedor_id;

      // Qué campos vinieron del comprobante, para marcarlos en el formulario.
      const leidos = new Set();
      if (resultado.descripcion) leidos.add("descripcion");
      if (resultado.fecha) leidos.add("fecha");
      if (resultado.tipo_factura) leidos.add("tipo_factura");
      if (!faseFija && resultado.fase_id) leidos.add("fase_id");
      if (!proveedorFijo && resultado.proveedor_id) leidos.add("proveedor_id");
      setCamposIA(leidos);

      setForm((prev) => ({
        ...prev,
        descripcion: resultado.descripcion ?? prev.descripcion,
        fecha: resultado.fecha ?? prev.fecha,
        tipo_factura: resultado.tipo_factura ?? prev.tipo_factura,
        fase_id: faseFija ? prev.fase_id : (resultado.fase_id ?? prev.fase_id),
        proveedor_id: proveedorFijo
          ? prev.proveedor_id
          : (resultado.proveedor_id ?? prev.proveedor_id),
      }));
      setErrores({});

      if (resultado.detalle?.length) {
        const productosDeEseProveedor = productosDisponibles.filter(
          (p) => p.proveedor_id === proveedorResuelto
        );
        const filasNuevas = resultado.detalle
          .map((linea) => {
            const producto = productosDeEseProveedor.find((p) => p.id === linea.producto_id);
            if (!producto) return null;
            return {
              _id: nuevaFilaId(),
              producto_id: producto.id,
              cantidad: linea.cantidad,
              precio_unitario: producto.precio,
            };
          })
          .filter(Boolean);
        if (filasNuevas.length) setDetalle((prev) => [...prev, ...filasNuevas]);
      }

      if (resultado.impuestos?.length) {
        setImpuestos((prev) => [
          ...prev,
          ...resultado.impuestos.map((linea) => ({
            _id: nuevaFilaId(),
            impuesto_id: linea.impuesto_id,
            monto: linea.monto,
          })),
        ]);
      }

      if (resultado.advertencias?.length) {
        resultado.advertencias.forEach((a) => toast.error(a));
      } else {
        toast.success("Comprobante leído. Revisá los datos antes de guardar.");
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail ?? "No se pudo leer el comprobante con IA");
    }
  };

  // --- Detalle (productos) ---
  // El precio unitario no se tipea: es el precio de catálogo del producto
  // elegido (Producto.precio) -- acá se "congela" en la línea de la compra,
  // así después no cambia si el proveedor actualiza su lista de precios.
  const agregarProducto = (productoId) => {
    const producto = productosDelProveedor.find((p) => p.id === productoId);
    if (!producto) return;
    setDetalle((prev) => [
      ...prev,
      {
        _id: nuevaFilaId(),
        producto_id: producto.id,
        cantidad: 1,
        precio_unitario: producto.precio,
      },
    ]);
  };

  const actualizarFilaDetalle = (id, campo, valor) => {
    setDetalle((prev) =>
      prev.map((fila) => (fila._id === id ? { ...fila, [campo]: valor } : fila))
    );
  };

  const eliminarFilaDetalle = (id) => {
    setDetalle((prev) => prev.filter((fila) => fila._id !== id));
  };

  // --- Impuestos ---
  const agregarFilaImpuesto = () => {
    setImpuestos((prev) => [...prev, { _id: nuevaFilaId(), impuesto_id: "", monto: "" }]);
  };

  const actualizarFilaImpuesto = (id, campo, valor) => {
    setImpuestos((prev) =>
      prev.map((fila) => (fila._id === id ? { ...fila, [campo]: valor } : fila))
    );
  };

  const eliminarFilaImpuesto = (id) => {
    setImpuestos((prev) => prev.filter((fila) => fila._id !== id));
  };

  // --- Pasos y validación ---
  const erroresDe = (campos) =>
    Object.fromEntries(campos.map((campo) => [campo, validarCampo(campo, form[campo])]));
  const pasoValido = (indice, encontrados) =>
    PASOS[indice].campos.every((campo) => !encontrados[campo]) &&
    (indice !== 0 || !cotizacion.error);

  const avanzar = () => {
    const encontrados = erroresDe(PASOS[paso].campos);
    setErrores((prev) => ({ ...prev, ...encontrados }));
    if (!pasoValido(paso, encontrados)) {
      setIntentoGuardar(true);
      return;
    }
    setPaso((p) => Math.min(p + 1, PASOS.length - 1));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Enter en un campo de un paso intermedio de una compra nueva avanza, no
    // guarda: el formulario todavía no está completo.
    if (!esEdicion && paso < PASOS.length - 1) {
      avanzar();
      return;
    }

    const encontrados = erroresDe(Object.keys(ETIQUETAS));
    setErrores(encontrados);
    setIntentoGuardar(true);
    const conError = PASOS.findIndex((_, i) => !pasoValido(i, encontrados));
    if (conError !== -1) {
      setPaso(conError);
      return;
    }

    setGuardando(true);
    try {
      await onGuardar(
        {
          ...form,
          ...cotizacion.payload,
          fase_id: faseFija?.id ?? form.fase_id,
          proveedor_id: proveedorFijo?.id ?? form.proveedor_id,
          precio_neto_ars: precioNeto,
          detalle: detalle
            .filter((f) => f.producto_id)
            .map((f) => ({
              producto_id: f.producto_id,
              cantidad: Number(f.cantidad),
              precio_unitario: Number(f.precio_unitario),
            })),
          impuestos: impuestos
            .filter((f) => f.impuesto_id)
            .map((f) => ({
              impuesto_id: f.impuesto_id,
              monto: Number(f.monto),
            })),
        },
        comprobantesCambios
      );
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

  // El contexto del header acompaña lo que está elegido ahora.
  const nombreProveedorElegido =
    proveedorFijo?.nombre ?? proveedores.find((p) => p.id === form.proveedor_id)?.nombre;
  const contextoHeader = [contexto ?? faseFija?.nombre, nombreProveedorElegido]
    .filter(Boolean)
    .join(" · ");

  const ultimoPaso = paso === PASOS.length - 1;
  const cantidadProductos = detalle.filter((f) => f.producto_id).length;
  const desglose = [
    `Neto ${formatMoneda(precioNeto)}${
      cantidadProductos > 0
        ? ` (${cantidadProductos} ${cantidadProductos === 1 ? "producto" : "productos"})`
        : ""
    }`,
    `impuestos ${formatMoneda(totalImpuestos)}`,
    notasCredito > 0 && `notas de crédito −${formatMoneda(notasCredito)}`,
    notasDebito > 0 && `notas de débito +${formatMoneda(notasDebito)}`,
    precioTotalUsd > 0 && `≈ ${formatMoneda(precioTotalUsd, "usd")}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const pasos = (
    <ol className="compra-pasos" aria-label="Pasos de la compra">
      {PASOS.map((p, i) => {
        const estado = i < paso ? "hecho" : i === paso ? "actual" : "pendiente";
        return (
          <li key={p.label}>
            <button
              type="button"
              className={`compra-pasos__paso compra-pasos__paso--${estado}`}
              aria-current={i === paso ? "step" : undefined}
              onClick={() => setPaso(i)}
              disabled={guardando}
            >
              <span className="compra-pasos__barra" aria-hidden="true" />
              <span className="compra-pasos__label">
                {estado === "hecho" ? (
                  <Check size={14} strokeWidth={2.4} aria-hidden="true" />
                ) : (
                  <span className="compra-pasos__numero">{i + 1}</span>
                )}
                <span className="compra-pasos__texto">{p.label}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );

  const botonGuardar = (
    <button type="submit" className="btn btn--lg btn-primary" disabled={guardando}>
      {guardando ? (
        <>
          <LogoCargando size={14} variante="blanco" />
          Guardando...
        </>
      ) : esEdicion ? (
        "Guardar cambios"
      ) : (
        "Crear compra"
      )}
    </button>
  );

  return (
    <ModalShell
      titulo={esEdicion ? "Editar compra" : "Nueva compra"}
      icono={TIPOS_MOVIMIENTO.compra.icono}
      contexto={contextoHeader || undefined}
      iconoContexto={Building2}
      ancho
      onCerrar={onCerrar}
      onSubmit={handleSubmit}
      validacionPropia
      cerrarDeshabilitado={guardando}
      encabezadoExtra={pasos}
      desglose={desglose}
      total={precioTotal}
      totalGrande
      aviso={avisoFaltantes(faltantes)}
      acciones={
        <>
          {paso === 0 ? (
            <button
              type="button"
              className="btn btn--lg btn-secondary"
              onClick={onCerrar}
              disabled={guardando}
            >
              Cancelar
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--lg btn-secondary"
              onClick={() => setPaso((p) => p - 1)}
              disabled={guardando}
            >
              <ArrowLeft size={15} strokeWidth={2} aria-hidden="true" />
              Atrás
            </button>
          )}
          {/* Al editar se puede guardar desde cualquier paso: los datos ya
              están completos y uno entra a cambiar una cosa puntual. */}
          {!ultimoPaso && (
            <button
              type="button"
              className={`btn btn--lg ${esEdicion ? "btn-secondary" : "btn-primary"}`}
              onClick={avanzar}
              disabled={guardando}
            >
              Siguiente
            </button>
          )}
          {(ultimoPaso || esEdicion) && botonGuardar}
        </>
      }
    >
      {paso === 0 && (
        <>
          <ComprobantesUploader
            existentes={compra?.comprobantes ?? []}
            onVerExistente={onVerComprobante}
            onCambio={setComprobantesCambios}
            disabled={guardando}
            textoVacio="Arrastrá la factura o"
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

          {(!proveedorFijo || !faseFija) && (
            <div className="modal-form-fila">
              {!proveedorFijo && (
                <label className={claseIA("proveedor_id")}>
                  Proveedor
                  <select
                    name="proveedor_id"
                    value={form.proveedor_id}
                    onChange={handleChange}
                    className={errores.proveedor_id ? "campo--error" : undefined}
                  >
                    <option value="">Elegí el proveedor…</option>
                    {proveedores.map((prov) => (
                      <option key={prov.id} value={prov.id}>
                        {prov.nombre}
                      </option>
                    ))}
                  </select>
                  <ErrorCampo texto={errores.proveedor_id} />
                  {camposIA.has("proveedor_id") && <MarcaIA />}
                </label>
              )}
              {!faseFija && (
                <label className={claseIA("fase_id")}>
                  Fase
                  <select
                    name="fase_id"
                    value={form.fase_id}
                    onChange={handleChange}
                    className={errores.fase_id ? "campo--error" : undefined}
                  >
                    <option value="">Elegí la fase…</option>
                    {fasesDisponibles.map((fase) => (
                      <option key={fase.id} value={fase.id}>
                        {fase.nombre}
                      </option>
                    ))}
                  </select>
                  <ErrorCampo texto={errores.fase_id} />
                  {camposIA.has("fase_id") && <MarcaIA />}
                </label>
              )}
            </div>
          )}

          <label className={claseIA("descripcion")}>
            Descripción
            <input
              type="text"
              name="descripcion"
              value={form.descripcion}
              onChange={handleChange}
              placeholder="Ej: Equipos para pisos 1 a 4"
              className={errores.descripcion ? "campo--error" : undefined}
            />
            <ErrorCampo texto={errores.descripcion} />
            {camposIA.has("descripcion") && !errores.descripcion && <MarcaIA />}
          </label>

          <label className={`compra-fecha ${claseIA("fecha")}`}>
            Fecha
            <div className={`campo${errores.fecha ? " campo--error" : ""}`}>
              <CalendarDays aria-hidden="true" />
              <input type="date" name="fecha" value={form.fecha} onChange={handleChange} />
            </div>
            <ErrorCampo texto={errores.fecha} />
            {camposIA.has("fecha") && !errores.fecha && <MarcaIA />}
          </label>

          <CamposCotizacion
            cotizacion={cotizacion}
            mostrarError={intentoGuardar}
            disabled={guardando}
          />
        </>
      )}

      {paso === 1 && (
        <>
          <ControlOpcion
            etiqueta="Tipo de factura"
            opciones={OPCIONES_FACTURA}
            valor={form.tipo_factura}
            onCambiar={(valor) => cambiar("tipo_factura", valor)}
            error={errores.tipo_factura}
            hint={camposIA.has("tipo_factura") ? <MarcaIA /> : null}
            disabled={guardando}
          />
          <ControlOpcion
            etiqueta="Condición de pago"
            opciones={OPCIONES_CONDICION}
            valor={form.condicion_pago}
            onCambiar={(valor) => cambiar("condicion_pago", valor)}
            error={errores.condicion_pago}
            disabled={guardando}
          />
          {/* Los estados son campos del formulario como cualquier otro: se
              guardan con el submit (a diferencia de la ficha de detalle, donde
              el badge pega contra la API al instante). */}
          <div className="modal-form-fila">
            <ControlOpcion
              etiqueta="Pago"
              opciones={OPCIONES_PAGO}
              valor={form.estado_pago}
              onCambiar={(valor) => cambiar("estado_pago", valor)}
              variante="segmentado"
              disabled={guardando}
            />
            <ControlOpcion
              etiqueta="Envío"
              opciones={OPCIONES_ENVIO}
              valor={form.estado_envio}
              onCambiar={(valor) => cambiar("estado_envio", valor)}
              variante="segmentado"
              disabled={guardando}
            />
          </div>
        </>
      )}

      {paso === 2 && (
        <>
          <div className="modal-form-bloque">
            <h3 className="modal-form-bloque__titulo">Productos</h3>
            {!form.proveedor_id ? (
              <p className="modal-form-seccion-vacio">
                Elegí el proveedor para ver su catálogo.{" "}
                <button type="button" className="campo-hint__accion" onClick={() => setPaso(0)}>
                  Ir al paso 1
                </button>
              </p>
            ) : (
              <select
                className="campo"
                aria-label="Agregar un producto del catálogo"
                value=""
                onChange={(e) => agregarProducto(e.target.value)}
                disabled={guardando || productosDelProveedor.length === 0}
              >
                <option value="">
                  {productosDelProveedor.length === 0
                    ? `${nombreProveedorElegido} no tiene productos cargados`
                    : `Agregar del catálogo de ${nombreProveedorElegido}…`}
                </option>
                {productosDelProveedor.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.marca} {p.modelo} · {formatMoneda(Number(p.precio) || 0)}
                  </option>
                ))}
              </select>
            )}

            {detalle.length > 0 && (
              <div className="tabla-form">
                <div className="tabla-form__cabecera">
                  <span>Producto</span>
                  <span className="tabla-form__num">Cant.</span>
                  <span className="tabla-form__num">Unitario</span>
                  <span className="tabla-form__num">Subtotal</span>
                  <span />
                </div>
                {detalle.map((fila) => {
                  const producto = productosDisponibles.find((p) => p.id === fila.producto_id);
                  const tipo = producto ? getTipoProducto(producto.tipo) : null;
                  const IconoTipo = tipo?.icono;
                  return (
                    <div key={fila._id} className="tabla-form__fila">
                      <span className="tabla-form__producto">
                        <span className="tabla-form__nombre">
                          {producto ? `${producto.marca} ${producto.modelo}` : "Producto eliminado"}
                        </span>
                        {tipo && (
                          <span className="tabla-form__hint compra-tipo">
                            {IconoTipo && (
                              <IconoTipo size={12} strokeWidth={1.75} aria-hidden="true" />
                            )}
                            {tipo.label}
                          </span>
                        )}
                      </span>
                      <input
                        className="campo campo--sm tabla-form__num"
                        type="number"
                        aria-label={`Cantidad de ${producto?.modelo ?? "producto"}`}
                        value={fila.cantidad}
                        onChange={(e) =>
                          actualizarFilaDetalle(fila._id, "cantidad", e.target.value)
                        }
                        min="0"
                        step="0.01"
                      />
                      <span
                        className="tabla-form__num tabla-form__tenue"
                        title="Precio de catálogo, no se edita"
                      >
                        {formatMoneda(Number(fila.precio_unitario) || 0)}
                      </span>
                      <span className="tabla-form__num tabla-form__fuerte">
                        {formatMoneda(
                          (Number(fila.cantidad) || 0) * (Number(fila.precio_unitario) || 0)
                        )}
                      </span>
                      <button
                        type="button"
                        className="btn-icono btn-icono--sm"
                        aria-label={`Quitar ${producto?.modelo ?? "producto"}`}
                        onClick={() => eliminarFilaDetalle(fila._id)}
                      >
                        <X aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="modal-form-bloque">
            <h3 className="modal-form-bloque__titulo">
              Impuestos
              <button
                type="button"
                className="btn btn--sm btn-secondary"
                onClick={agregarFilaImpuesto}
                disabled={guardando}
              >
                <Plus size={14} strokeWidth={2} aria-hidden="true" />
                Agregar impuesto
              </button>
            </h3>
            {impuestos.length === 0 && (
              <p className="modal-form-seccion-vacio">Sin impuestos cargados todavía.</p>
            )}
            {impuestos.map((fila) => (
              <div key={fila._id} className="tabla-form__impuesto">
                <select
                  className="campo campo--sm"
                  value={fila.impuesto_id}
                  onChange={(e) => actualizarFilaImpuesto(fila._id, "impuesto_id", e.target.value)}
                  aria-label="Impuesto"
                >
                  <option value="">Impuesto…</option>
                  {impuestosDisponibles.map((imp) => (
                    <option key={imp.id} value={imp.id}>
                      {imp.nombre}
                    </option>
                  ))}
                </select>
                <div className="campo campo--sm">
                  <span className="campo__prefijo">$</span>
                  <input
                    type="number"
                    aria-label="Monto del impuesto"
                    value={fila.monto}
                    onChange={(e) => actualizarFilaImpuesto(fila._id, "monto", e.target.value)}
                    min="0"
                    step="0.01"
                  />
                </div>
                <button
                  type="button"
                  className="btn-icono btn-icono--sm"
                  aria-label="Quitar impuesto"
                  onClick={() => eliminarFilaImpuesto(fila._id)}
                >
                  <X aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>

          {/* Las notas son de sólo lectura: una nota impacta contra la API al
              instante, así que si se pudieran cargar desde acá "Cancelar" ya
              no cancelaría todo. Se agregan y se borran desde la ficha. */}
          {notas.length > 0 && (
            <SeccionNotas
              notas={notas}
              contexto="compra"
              resolverProducto={resolverProductoDeNota}
              onVer={onVerNota}
              canManage={false}
            />
          )}
        </>
      )}
    </ModalShell>
  );
}

export default ModalCompra;
