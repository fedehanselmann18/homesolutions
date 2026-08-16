import { useState } from "react";
import { X } from "lucide-react";
import { TIPOS_NOTA, ORIGENES_NOTA_COMPRA, ORIGENES_NOTA_COBRO } from "../../constants/notas";
import { TIPOS_FACTURA } from "../../constants/tipoFactura";
import { restanteDetalleCompra } from "../../utils/notas";
import { formatMoneda } from "../../utils/formato";
import { obtenerMensajeError } from "../../utils/errorHandling";
import "./ModalNota.css";
import ModalShell from "./ModalShell";

const EXTENSIONES_PERMITIDAS = ".pdf,.jpg,.jpeg,.png";

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
 * Props:
 * - contexto: "compra" | "cobro"
 * - entidad: la Compra o el Cobro sobre el que se carga la nota.
 * - productos: catálogo completo (para resolver marca/modelo de cada línea
 *   de detalle de la compra). Solo se usa si contexto="compra".
 * - impuestosDisponibles: catálogo de Impuesto, para las líneas de impuesto
 *   de una devolución. Solo se usa si contexto="compra".
 * - onGuardar({ archivo, tipo, tipo_factura, origen, descripcion, fecha, monto? , detalles?, impuestos? }) => Promise
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
    fecha: "",
  });
  const [archivo, setArchivo] = useState(null);
  const [detalles, setDetalles] = useState([]); // líneas de producto devuelto
  const [impuestos, setImpuestos] = useState([]); // impuestos de la devolución
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

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

  // --- Impuestos de la devolución ---
  const agregarFilaImpuesto = () => {
    setImpuestos((prev) => [...prev, { _id: nuevaFilaId(), impuesto_id: "", monto: "" }]);
  };

  const actualizarFilaImpuesto = (id, campo, valor) => {
    setImpuestos((prev) => prev.map((f) => (f._id === id ? { ...f, [campo]: valor } : f)));
  };

  const eliminarFilaImpuesto = (id) => {
    setImpuestos((prev) => prev.filter((f) => f._id !== id));
  };

  const totalLineas = detalles.reduce((acc, fila) => {
    const linea = (entidad?.detalle ?? []).find((d) => d.id === fila.detalle_compra_id);
    if (!linea) return acc;
    return acc + (Number(fila.cantidad) || 0) * Number(linea.precio_unitario);
  }, 0);
  const totalImpuestosDevolucion = impuestos.reduce((acc, f) => acc + (Number(f.monto) || 0), 0);
  const montoDevolucion = totalLineas + totalImpuestosDevolucion;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!archivo) {
      setError("Adjuntá el comprobante de la nota.");
      return;
    }

    let payloadExtra = {};
    if (usaSelectorProducto) {
      const lineasValidas = detalles.filter((f) => f.detalle_compra_id && Number(f.cantidad) > 0);
      if (lineasValidas.length === 0) {
        setError("Agregá al menos un producto.");
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
        impuestos: impuestos
          .filter((f) => f.impuesto_id)
          .map((f) => ({ impuesto_id: f.impuesto_id, monto: Number(f.monto) })),
      };
    } else {
      payloadExtra = { monto: Number(form.monto) };
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
        ...payloadExtra,
      });
    } catch (err) {
      setError(obtenerMensajeError(err));
      setGuardando(false);
    }
  };

  return (
    <ModalShell
      titulo={form.tipo === "nota_debito" ? "Nueva nota de débito" : "Nueva nota de crédito"}
      contexto={entidad?.descripcion ? `Sobre: ${entidad.descripcion}` : undefined}
      ancho={usaSelectorProducto}
      clase="modal-contenido--peligro"
      capaSuperior
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
            {guardando ? "Guardando..." : "Guardar nota"}
          </button>
        </>
      }
    >
      <div className="modal-form-fila">
        <label>
          Tipo
          <select name="tipo" value={form.tipo} onChange={handleChange}>
            {TIPOS_NOTA.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Tipo de factura
          <select name="tipo_factura" value={form.tipo_factura} onChange={handleChange} required>
            <option value="" disabled>
              Seleccioná un tipo
            </option>
            {TIPOS_FACTURA.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="modal-form-fila">
        <label>
          Origen
          <select name="origen" value={form.origen} onChange={handleChange}>
            <option value="">Sin especificar</option>
            {origenes.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Fecha
          <input type="date" name="fecha" value={form.fecha} onChange={handleChange} required />
        </label>
      </div>

      {usaSelectorProducto ? (
        <>
          <div className="modal-form-seccion">
            <div className="modal-form-seccion-header">
              <span>{esDevolucion ? "Productos devueltos" : "Productos de reposición"}</span>
              <button type="button" className="modal-btn-agregar-fila" onClick={agregarFilaDetalle}>
                + Agregar producto
              </button>
            </div>

            {detalles.length > 0 && (
              <div className="modal-form-fila-dinamica modal-form-fila-dinamica--detalle modal-form-fila-dinamica--headers">
                <span>Producto</span>
                <span>Cantidad</span>
                <span>Precio unit.</span>
                <span>Subtotal</span>
                <span />
              </div>
            )}

            {detalles.map((fila) => {
              const linea = (entidad?.detalle ?? []).find((d) => d.id === fila.detalle_compra_id);
              const restante = restanteParaFila(fila);
              return (
                <div
                  key={fila._id}
                  className="modal-form-fila-dinamica modal-form-fila-dinamica--detalle"
                >
                  <div className="modal-form-fila-dinamica-producto">
                    <select
                      value={fila.detalle_compra_id}
                      onChange={(e) =>
                        actualizarFilaDetalle(fila._id, "detalle_compra_id", e.target.value)
                      }
                      required
                    >
                      <option value="">Producto...</option>
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
                      <span
                        className="modal-form-fila-dinamica-tipo"
                        style={{ color: "#6f7f45", backgroundColor: "#eef0e9" }}
                      >
                        Disponible: {restante}
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    placeholder="Cantidad"
                    value={fila.cantidad}
                    onChange={(e) => actualizarFilaDetalle(fila._id, "cantidad", e.target.value)}
                    min="0"
                    max={fila.detalle_compra_id && esDevolucion ? restante : undefined}
                    step="0.01"
                    required
                    disabled={!fila.detalle_compra_id}
                  />
                  <span
                    className="modal-form-fila-dinamica-precio"
                    title="Precio de catálogo de la compra original"
                  >
                    {linea ? formatMoneda(Number(linea.precio_unitario)) : "—"}
                  </span>
                  <span className="modal-form-fila-dinamica-subtotal">
                    {linea
                      ? formatMoneda((Number(fila.cantidad) || 0) * Number(linea.precio_unitario))
                      : "—"}
                  </span>
                  <button
                    type="button"
                    className="modal-btn-quitar-fila"
                    onClick={() => eliminarFilaDetalle(fila._id)}
                  >
                    <X size={14} strokeWidth={2.25} />
                  </button>
                </div>
              );
            })}
            {detalles.length === 0 && (
              <p className="modal-form-seccion-vacio">Todavía no agregaste ningún producto.</p>
            )}
          </div>

          <div className="modal-form-seccion">
            <div className="modal-form-seccion-header">
              <span>Impuestos (opcional)</span>
              <button
                type="button"
                className="modal-btn-agregar-fila"
                onClick={agregarFilaImpuesto}
              >
                + Agregar impuesto
              </button>
            </div>

            {impuestos.map((fila) => (
              <div
                key={fila._id}
                className="modal-form-fila-dinamica modal-form-fila-dinamica--2col"
              >
                <select
                  value={fila.impuesto_id}
                  onChange={(e) => actualizarFilaImpuesto(fila._id, "impuesto_id", e.target.value)}
                  required
                >
                  <option value="">Impuesto...</option>
                  {impuestosDisponibles.map((imp) => (
                    <option key={imp.id} value={imp.id}>
                      {imp.nombre}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Monto"
                  value={fila.monto}
                  onChange={(e) => actualizarFilaImpuesto(fila._id, "monto", e.target.value)}
                  min="0"
                  step="0.01"
                  required
                />
                <button
                  type="button"
                  className="modal-btn-quitar-fila"
                  onClick={() => eliminarFilaImpuesto(fila._id)}
                >
                  <X size={14} strokeWidth={2.25} />
                </button>
              </div>
            ))}
            {impuestos.length === 0 && (
              <p className="modal-form-seccion-vacio">Sin impuestos cargados todavía.</p>
            )}
          </div>

          <div className="modal-form-resumen">
            <div className="modal-form-resumen-fila">
              <span>Productos</span>
              <span>{formatMoneda(totalLineas)}</span>
            </div>
            <div className="modal-form-resumen-fila">
              <span>Impuestos</span>
              <span>{formatMoneda(totalImpuestosDevolucion)}</span>
            </div>
            <div className="modal-form-resumen-fila modal-form-resumen-fila--total">
              <span>Total nota</span>
              <span>{formatMoneda(montoDevolucion)}</span>
            </div>
          </div>
        </>
      ) : (
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
        </label>
      )}

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

      <label>
        Comprobante
        <input
          type="file"
          accept={EXTENSIONES_PERMITIDAS}
          onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
          required
        />
      </label>

      {error && <p className="modal-nota-error">{error}</p>}
    </ModalShell>
  );
}

export default ModalNota;
