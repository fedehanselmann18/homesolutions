import { useRef, useState } from "react";
import { CalendarDays, CircleAlert, Plus, X } from "lucide-react";
import { TIPOS_NOTA, ORIGENES_NOTA_COMPRA, ORIGENES_NOTA_COBRO } from "../../constants/notas";
import { useOpcionesTipoFactura } from "../../hooks/useTiposFactura";
import { TIPOS_MOVIMIENTO } from "../../constants/tipoMovimiento";
import { restanteDetalleCompra } from "../../utils/notas";
import { formatMoneda, hoyISO } from "../../utils/formato";
import { describirArchivo } from "../../utils/archivos";
import { textoEquivalente } from "../../utils/moneda";
import { obtenerMensajeError } from "../../utils/errorHandling";
import ModalShell, { AccionesFormulario } from "./ModalShell";
import { CampoMonto, CamposCotizacion } from "./CamposCotizacion";
import { ControlOpcion } from "../shared/ControlOpcion";
import { ZonaArchivo, FilaArchivo } from "../shared/ComprobantesUploader";
import { useCotizacionDia } from "../../hooks/useCotizacionDia";
import { FilasImpuestos } from "./FilasImpuestos";
import {
  grupoRepetido,
  impuestosParaGuardar,
  nuevaFilaImpuesto,
  totalImpuestos as sumarImpuestos,
} from "../../utils/impuestos";

const EXTENSIONES_PERMITIDAS = ".pdf,.jpg,.jpeg,.png";

const OPCIONES_TIPO = TIPOS_NOTA.map((t) => ({
  valor: t.value,
  label: t.value === "nota_credito" ? "Crédito" : "Débito",
  icono: TIPOS_MOVIMIENTO[t.value].icono,
}));
let contadorFilaTemp = 0;
const nuevaFilaId = () => `tmp-${++contadorFilaTemp}`;

/**
 * Modal dedicado para cargar una nota de crédito o de débito (cuenta
 * corriente) sobre una Compra o un Cobro puntual -- separado del modal de
 * Compra/Cobro y del uploader de comprobantes normales (factura, remito...).
 *
 * Para nota_credito + origen="devolucion_producto", o nota_debito +
 * origen="reposicion_producto" (ambos solo contexto="compra"), el monto NO
 * se tipea a mano: se arma una tabla de líneas (mismo patrón que el detalle
 * de productos en ModalCompra) donde se elige el producto YA COMPRADO en
 * esta compra puntual y una cantidad, y opcionalmente impuestos -- el total
 * se calcula solo. Caso típico: te cambian 3 aires fallados por 3 nuevos ->
 * nota_credito devolucion_producto por los 3 fallados + nota_debito
 * reposicion_producto por los 3 nuevos que te facturan.
 *
 * La cantidad SOLO se topea (a lo que todavía no se devolvió en notas
 * anteriores) para devolucion_producto -- reposicion_producto queda libre,
 * no se valida contra nada. Para cualquier otro caso (acuerdo_comercial,
 * otro) el monto se sigue tipeando a mano.
 *
 * tipo_factura es SIEMPRE obligatorio, sin importar tipo/origen.
 *
 * Doble moneda: la nota lleva SU cotización,
 * la de su fecha, no la de la compra o el cobro que ajusta. Las de compra se
 * cargan en pesos (los productos devueltos salen a precio de la compra
 * original, en pesos); las de cobro en dólares, como el cobro.
 *
 * Props:
 * - contexto: "compra" | "cobro"
 * - entidad: la Compra o el Cobro sobre el que se carga la nota.
 * - productos: catálogo completo (para resolver marca/modelo de cada línea
 *   de detalle de la compra). Solo se usa si contexto="compra".
 * - impuestosDisponibles: catálogo de Impuesto, para las líneas de impuesto
 *   de una devolución. Solo se usa si contexto="compra".
 * - onGuardar({ archivo, tipo, tipo_factura, origen, descripcion, fecha,
 *     cotizacion_dolar, tipo_cambio, monto_ars? | monto_usd?, detalles?, impuestos? }) => Promise
 * - onCerrar: () => void
 */
export function ModalNota({
  contexto,
  entidad,
  productos = [],
  impuestosDisponibles = [],
  onGuardar,
  onCerrar,
}) {
  const origenesBase = contexto === "cobro" ? ORIGENES_NOTA_COBRO : ORIGENES_NOTA_COMPRA;

  const [form, setForm] = useState({
    tipo: "nota_credito",
    origen: "",
    tipo_factura: "",
    monto: "",
    descripcion: "",
    fecha: hoyISO(),
  });
  const [archivo, setArchivo] = useState(null);
  const [arrastrando, setArrastrando] = useState(false);
  const inputArchivoRef = useRef(null);
  const [detalles, setDetalles] = useState([]); // líneas de producto devuelto
  const [impuestos, setImpuestos] = useState([]); // impuestos de la devolución
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [intentoGuardar, setIntentoGuardar] = useState(false);

  const monedaMonto = contexto === "cobro" ? "usd" : "ars";
  const cotizacion = useCotizacionDia({ fecha: form.fecha });

  const esDevolucion = form.origen === "devolucion_producto";
  const esReposicion = form.origen === "reposicion_producto";
  const usaSelectorProducto =
    contexto === "compra" &&
    ((form.tipo === "nota_credito" && esDevolucion) ||
      (form.tipo === "nota_debito" && esReposicion));

  // "devolucion_producto" solo tiene sentido con nota_credito, y
  // "reposicion_producto" solo con nota_debito -- ambos además requieren
  // que la compra tenga productos cargados. El resto de los orígenes
  // (acuerdo_comercial, otro, ajuste_precio) sirven para cualquier tipo.
  const origenes = origenesBase.filter((o) => {
    const tieneProductos = (entidad?.detalle?.length ?? 0) > 0;
    if (o.value === "devolucion_producto") return form.tipo === "nota_credito" && tieneProductos;
    if (o.value === "reposicion_producto") return form.tipo === "nota_debito" && tieneProductos;
    return true;
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      // Cada origen-con-selector-de-producto solo es válido para un
      // tipo puntual (devolucion_producto -> crédito, reposicion_producto
      // -> débito); si cambiás el tipo y el origen elegido dejó de tener
      // sentido, se resetea.
      if (
        name === "tipo" &&
        ((value === "nota_debito" && prev.origen === "devolucion_producto") ||
          (value === "nota_credito" && prev.origen === "reposicion_producto"))
      ) {
        next.origen = "";
      }
      return next;
    });
    // Si cambiás tipo u origen y deja de usarse el selector de producto,
    // las líneas/impuestos cargados de antes ya no tienen sentido.
    if (name === "tipo") {
      setDetalles([]);
      setImpuestos([]);
    }
    if (name === "origen" && value !== "devolucion_producto" && value !== "reposicion_producto") {
      setDetalles([]);
      setImpuestos([]);
    }
  };

  // --- Líneas de producto devuelto ---
  const agregarFilaDetalle = () => {
    setDetalles((prev) => [...prev, { _id: nuevaFilaId(), detalle_compra_id: "", cantidad: "" }]);
  };

  const actualizarFilaDetalle = (id, campo, valor) => {
    setDetalles((prev) => prev.map((f) => (f._id === id ? { ...f, [campo]: valor } : f)));
  };

  const eliminarFilaDetalle = (id) => {
    setDetalles((prev) => prev.filter((f) => f._id !== id));
  };

  // Cuánto queda disponible para esa línea, descontando lo que ya se pidió
  // devolver en OTRAS filas de este mismo formulario (no solo lo de notas
  // anteriores) -- así no se puede cargar la misma línea dos veces por más
  // de lo que hay. SOLO aplica a devolucion_producto: reposicion_producto
  // no tiene tope (Infinity), no se valida contra lo devuelto.
  const restanteParaFila = (fila) => {
    if (!esDevolucion) return Infinity;
    if (!fila.detalle_compra_id) return 0;
    const restanteHistorico = restanteDetalleCompra(entidad, fila.detalle_compra_id);
    const usadoEnOtrasFilas = detalles
      .filter((f) => f._id !== fila._id && f.detalle_compra_id === fila.detalle_compra_id)
      .reduce((acc, f) => acc + (Number(f.cantidad) || 0), 0);
    return Math.max(0, restanteHistorico - usadoEnOtrasFilas);
  };

  // --- Impuestos de la devolución (las filas las maneja FilasImpuestos) ---
  const agregarFilaImpuesto = () => {
    setImpuestos((prev) => [...prev, nuevaFilaImpuesto()]);
  };

  const totalLineas = detalles.reduce((acc, fila) => {
    const linea = (entidad?.detalle ?? []).find((d) => d.id === fila.detalle_compra_id);
    if (!linea) return acc;
    return acc + (Number(fila.cantidad) || 0) * Number(linea.precio_unitario);
  }, 0);
  // El IVA de la devolución se calcula sobre lo que se devuelve.
  const totalImpuestosDevolucion = sumarImpuestos(impuestos, totalLineas, impuestosDisponibles);
  const montoDevolucion = totalLineas + totalImpuestosDevolucion;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIntentoGuardar(true);

    if (cotizacion.error) {
      setError(cotizacion.error);
      return;
    }

    if (!archivo) {
      setError("Adjuntá el comprobante de la nota.");
      return;
    }

    if (!form.tipo_factura) {
      setError("Elegí el tipo de comprobante.");
      return;
    }

    let payloadExtra = {};
    if (usaSelectorProducto) {
      const lineasValidas = detalles.filter((f) => f.detalle_compra_id && Number(f.cantidad) > 0);
      if (lineasValidas.length === 0) {
        setError("Agregá al menos un producto.");
        return;
      }
      const repetido = grupoRepetido(impuestos, impuestosDisponibles);
      if (repetido) {
        setError(`Una nota lleva una sola alícuota de ${repetido}.`);
        return;
      }
      if (esDevolucion) {
        const excedida = lineasValidas.find((fila) => {
          const restante = restanteDetalleCompra(entidad, fila.detalle_compra_id);
          const usadoEnOtrasFilas = lineasValidas
            .filter((f) => f._id !== fila._id && f.detalle_compra_id === fila.detalle_compra_id)
            .reduce((acc, f) => acc + (Number(f.cantidad) || 0), 0);
          return Number(fila.cantidad) + usadoEnOtrasFilas > restante;
        });
        if (excedida) {
          setError("Hay una línea que supera la cantidad disponible para devolver.");
          return;
        }
      }
      payloadExtra = {
        detalles: lineasValidas.map((f) => ({
          detalle_compra_id: f.detalle_compra_id,
          cantidad: Number(f.cantidad),
        })),
        impuestos: impuestosParaGuardar(impuestos, totalLineas, impuestosDisponibles),
      };
    } else {
      payloadExtra = { [`monto_${monedaMonto}`]: Number(form.monto) };
    }

    setGuardando(true);
    try {
      await onGuardar({
        archivo,
        tipo: form.tipo,
        tipo_factura: form.tipo_factura,
        origen: form.origen || undefined,
        descripcion: form.descripcion,
        fecha: form.fecha,
        ...cotizacion.payload,
        ...payloadExtra,
      });
    } catch (err) {
      setError(obtenerMensajeError(err));
      setGuardando(false);
    }
  };

  const cambiar = (name, value) => handleChange({ target: { name, value } });
  const opcionesOrigen = [
    { valor: "", label: "Sin especificar" },
    ...origenes.map((o) => ({ valor: o.value, label: o.label })),
  ];
  const tipoInfo = TIPOS_MOVIMIENTO[form.tipo];

  // Los tipos se arman en Ajustes; el actual se agrega si todavía no llegó la lista.
  const opcionesFactura = useOpcionesTipoFactura(form.tipo_factura);

  return (
    <ModalShell
      titulo={form.tipo === "nota_debito" ? "Nueva nota de débito" : "Nueva nota de crédito"}
      icono={tipoInfo.icono}
      contexto={entidad?.descripcion}
      iconoContexto={TIPOS_MOVIMIENTO[contexto]?.icono}
      // 760 sólo con la tabla de productos devueltos (DESIGN.md §14).
      ancho={usaSelectorProducto}
      capaSuperior
      onCerrar={onCerrar}
      onSubmit={handleSubmit}
      cerrarDeshabilitado={guardando}
      acciones={
        <AccionesFormulario
          guardando={guardando}
          onCancelar={onCerrar}
          textoGuardar="Guardar nota"
        />
      }
    >
      {/* Comprobante primero (DESIGN.md §14): en una nota es obligatorio. */}
      <div className="comprobantes-uploader">
        <input
          ref={inputArchivoRef}
          type="file"
          accept={EXTENSIONES_PERMITIDAS}
          hidden
          onChange={(e) => {
            setArchivo(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        {archivo ? (
          <ul className="filas-archivo">
            <FilaArchivo
              nombre={archivo.name}
              meta={describirArchivo(archivo)}
              onQuitar={() => setArchivo(null)}
              disabled={guardando}
            />
          </ul>
        ) : (
          <ZonaArchivo
            texto="Arrastrá la nota o"
            extra="Obligatorio"
            arrastrando={arrastrando}
            disabled={guardando}
            onElegir={() => inputArchivoRef.current?.click()}
            onSoltar={(files) => setArchivo(files[0])}
            onArrastrando={setArrastrando}
          />
        )}
      </div>

      <div className="modal-form-fila modal-form-fila--fecha">
        <ControlOpcion
          etiqueta="Tipo"
          opciones={OPCIONES_TIPO}
          valor={form.tipo}
          onCambiar={(valor) => cambiar("tipo", valor)}
          variante="segmentado"
          disabled={guardando}
        />
        <label>
          Fecha
          <div className="campo">
            <CalendarDays aria-hidden="true" />
            <input type="date" name="fecha" value={form.fecha} onChange={handleChange} required />
          </div>
        </label>
      </div>

      <ControlOpcion
        etiqueta="Comprobante"
        opciones={opcionesFactura}
        valor={form.tipo_factura}
        onCambiar={(valor) => cambiar("tipo_factura", valor)}
        disabled={guardando}
      />

      <ControlOpcion
        etiqueta="Origen"
        opciones={opcionesOrigen}
        valor={form.origen}
        onCambiar={(valor) => cambiar("origen", valor)}
        disabled={guardando}
      />

      {usaSelectorProducto ? (
        <div className="modal-form-bloque">
          <h3 className="modal-form-bloque__titulo">
            {esDevolucion ? "Productos devueltos" : "Productos de reposición"}
            <button
              type="button"
              className="btn btn--sm btn-secondary"
              onClick={agregarFilaDetalle}
              disabled={guardando}
            >
              <Plus size={14} strokeWidth={2} aria-hidden="true" />
              Agregar producto
            </button>
          </h3>

          {detalles.length === 0 ? (
            <p className="modal-form-seccion-vacio">Todavía no agregaste ningún producto.</p>
          ) : (
            <div className="tabla-form tabla-form--nota">
              <div className="tabla-form__cabecera">
                <span>Producto</span>
                <span className="tabla-form__num">Cant.</span>
                <span className="tabla-form__num">Unitario</span>
                <span className="tabla-form__num">Subtotal</span>
                <span />
              </div>
              {detalles.map((fila) => {
                const linea = (entidad?.detalle ?? []).find((d) => d.id === fila.detalle_compra_id);
                const restante = restanteParaFila(fila);
                return (
                  <div key={fila._id} className="tabla-form__fila">
                    <div className="tabla-form__producto">
                      <select
                        className="campo campo--sm"
                        value={fila.detalle_compra_id}
                        onChange={(e) =>
                          actualizarFilaDetalle(fila._id, "detalle_compra_id", e.target.value)
                        }
                        aria-label="Producto"
                        required
                      >
                        <option value="">Elegí el producto…</option>
                        {(entidad?.detalle ?? []).map((d) => {
                          const p = productos.find((pr) => pr.id === d.producto_id);
                          const restanteLinea = esDevolucion
                            ? restanteDetalleCompra(entidad, d.id)
                            : Infinity;
                          const sinSaldo =
                            esDevolucion && restanteLinea <= 0 && d.id !== fila.detalle_compra_id;
                          return (
                            <option key={d.id} value={d.id} disabled={sinSaldo}>
                              {p ? `${p.marca} ${p.modelo}` : "Producto"} · comprado x{d.cantidad}
                              {sinSaldo ? " (sin saldo)" : ""}
                            </option>
                          );
                        })}
                      </select>
                      {fila.detalle_compra_id && esDevolucion && (
                        <span className="tabla-form__hint">Quedan {restante} para devolver</span>
                      )}
                    </div>
                    <input
                      className="campo campo--sm tabla-form__num"
                      type="number"
                      aria-label="Cantidad"
                      value={fila.cantidad}
                      onChange={(e) => actualizarFilaDetalle(fila._id, "cantidad", e.target.value)}
                      min="0"
                      max={fila.detalle_compra_id && esDevolucion ? restante : undefined}
                      step="0.01"
                      required
                      disabled={!fila.detalle_compra_id}
                    />
                    <span
                      className="tabla-form__num tabla-form__tenue"
                      title="Precio de la compra original"
                    >
                      {linea ? formatMoneda(Number(linea.precio_unitario)) : "—"}
                    </span>
                    <span className="tabla-form__num tabla-form__fuerte">
                      {linea
                        ? formatMoneda((Number(fila.cantidad) || 0) * Number(linea.precio_unitario))
                        : "—"}
                    </span>
                    <button
                      type="button"
                      className="btn-icono btn-icono--sm"
                      onClick={() => eliminarFilaDetalle(fila._id)}
                      aria-label="Quitar producto"
                    >
                      <X aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <h3 className="modal-form-bloque__titulo">
            <span>
              Impuestos <span className="label-campo__opcional">(opcional)</span>
            </span>
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
          <FilasImpuestos
            filas={impuestos}
            onCambiar={setImpuestos}
            base={totalLineas}
            disponibles={impuestosDisponibles}
            disabled={guardando}
          />

          <dl className="tabla-form__totales">
            <div>
              <dt>Productos</dt>
              <dd>{formatMoneda(totalLineas)}</dd>
            </div>
            <div>
              <dt>Impuestos</dt>
              <dd>{formatMoneda(totalImpuestosDevolucion)}</dd>
            </div>
            <div className="tabla-form__total">
              <dt>Total de la nota</dt>
              <dd>
                {formatMoneda(montoDevolucion)}
                {textoEquivalente(montoDevolucion, "ars", cotizacion.valor) && (
                  <span className="tabla-form__tenue">
                    {" "}
                    {textoEquivalente(montoDevolucion, "ars", cotizacion.valor)}
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      ) : (
        <CampoMonto
          value={form.monto}
          onChange={handleChange}
          moneda={monedaMonto}
          equivalente={textoEquivalente(form.monto, monedaMonto, cotizacion.valor)}
          disabled={guardando}
        />
      )}

      <CamposCotizacion
        cotizacion={cotizacion}
        mostrarError={intentoGuardar}
        disabled={guardando}
      />

      <label>
        Motivo
        <input
          type="text"
          name="descripcion"
          value={form.descripcion}
          onChange={handleChange}
          placeholder="Ej: devolución de 2 unidades dañadas"
          required
        />
      </label>

      {error && (
        <p className="campo-error" role="alert">
          <CircleAlert aria-hidden="true" />
          {error}
        </p>
      )}
    </ModalShell>
  );
}

export default ModalNota;
