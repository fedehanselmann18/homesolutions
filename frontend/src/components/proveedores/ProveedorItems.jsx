import { Banknote, ChevronRight, Pencil, Phone, ShoppingCart, Trash2 } from "lucide-react";

import { formatFecha, formatMoneda, iniciales, pluralizar } from "../../utils/formato";
import { DIAS_DEUDA_VENCIDA } from "../../constants/estadoCompra";
import "./ProveedorItems.css";

/**
 * Las dos formas de un proveedor en la lista "primero a quién se le debe"
 * (variante 4N de HS General.dc.html): una card para
 * los que tienen deuda, con lo que se debe bien grande y la acción para
 * resolverlo, y una fila para los que están al día.
 */

export function Avatar({ nombre, grande = false }) {
  return (
    <span
      className={`proveedor-avatar${grande ? " proveedor-avatar--grande" : ""}`}
      aria-hidden="true"
    >
      {iniciales(nombre)}
    </span>
  );
}

/**
 * `proyectos`: nombres de las obras donde están las compras impagas.
 * `onRegistrarPago` sólo viene para un admin.
 */
export function ProveedorDeudaCard({ resumen, proyectos = [], onRegistrarPago, onVerCompras }) {
  const { proveedor, deuda, comprasImpagas, diasDeudaMasVieja: dias } = resumen;
  const vencida = dias >= DIAS_DEUDA_VENCIDA;
  const detalle = [
    pluralizar(comprasImpagas.length, "compra sin pagar", "compras sin pagar"),
    proyectos.join(", "),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="proveedor-deuda">
      <Avatar nombre={proveedor.nombre} grande />
      <span className="proveedor-deuda__nombre">{proveedor.nombre}</span>
      <span className="proveedor-deuda__monto cifra">{formatMoneda(deuda)}</span>
      <span className="proveedor-deuda__detalle">{detalle}</span>
      <span className={`badge badge--sm ${vencida ? "badge--peligro" : "badge--atencion"}`}>
        {comprasImpagas.length > 1 ? `Más vieja: ${dias} días` : pluralizar(dias, "día")}
      </span>
      <div className="proveedor-deuda__acciones">
        {onRegistrarPago && (
          <button type="button" className="btn btn--sm btn-primary" onClick={onRegistrarPago}>
            <Banknote aria-hidden="true" />
            Registrar pago
          </button>
        )}
        <button type="button" className="btn btn--sm btn-secondary" onClick={onVerCompras}>
          <ShoppingCart aria-hidden="true" />
          Ver compras
        </button>
      </div>
    </article>
  );
}

/** Fila de 54px de un proveedor al día. `onEditar`/`onEliminar` sólo para un admin. */
export function ProveedorFila({ resumen, onAbrir, onEditar, onEliminar }) {
  const { proveedor, cantidadProductos, totalComprado, ultimaCompra } = resumen;
  const meta = [
    pluralizar(cantidadProductos, "producto"),
    ultimaCompra ? `última compra ${formatFecha(ultimaCompra).slice(0, 5)}` : "sin compras",
  ].join(" · ");

  const detener = (fn) => (e) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div
      className="planilla__fila proveedor-fila"
      onClick={onAbrir}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAbrir();
        }
      }}
      role="link"
      tabIndex={0}
      aria-label={proveedor.nombre}
    >
      <Avatar nombre={proveedor.nombre} />
      <span className="proveedor-fila__texto">
        <span className="proveedor-fila__nombre">{proveedor.nombre}</span>
        <span className="proveedor-fila__meta">{meta}</span>
      </span>
      <span className="proveedor-fila__telefono">
        {proveedor.telefono && (
          <>
            <Phone size={14} strokeWidth={1.75} aria-hidden="true" />
            {proveedor.telefono}
          </>
        )}
      </span>
      <span className="proveedor-fila__total" title="Total comprado a este proveedor">
        <span className="cifra">{formatMoneda(totalComprado)}</span>
        <span className="proveedor-fila__total-etiqueta">comprado en total</span>
      </span>
      <span className="acciones proveedor-fila__acciones">
        {onEditar && (
          <button
            type="button"
            className="btn-icono btn-icono--sm"
            title="Editar"
            aria-label={`Editar ${proveedor.nombre}`}
            onClick={detener(onEditar)}
          >
            <Pencil aria-hidden="true" />
          </button>
        )}
        {onEliminar && (
          <button
            type="button"
            className="btn-icono btn-icono--sm btn-icono--peligro"
            title="Eliminar"
            aria-label={`Eliminar ${proveedor.nombre}`}
            onClick={detener(onEliminar)}
          >
            <Trash2 aria-hidden="true" />
          </button>
        )}
      </span>
      <ChevronRight
        className="proveedor-fila__chevron"
        size={16}
        strokeWidth={1.75}
        aria-hidden="true"
      />
    </div>
  );
}
