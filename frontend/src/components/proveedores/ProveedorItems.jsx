import { Mail, MapPin, Pencil, Phone, Trash2 } from "lucide-react";

import { formatMoneda, iniciales, pluralizar } from "../../utils/formato";
import "./ProveedorItems.css";

/** Un proveedor en la lista de Proveedores, y su avatar de iniciales. */

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
 * Tarjeta de un proveedor (variante 1c, "Fichas en grilla", de Rediseño de
 * lista de proveedores.zip). Se llama "tarjeta" y no "ficha" porque
 * `.proveedor-ficha` ya es el panel lateral de ProveedorDetalle.
 *
 * Siempre las mismas líneas —CUIT, teléfono, email, dirección— y lo que falta
 * queda atenuado ("Sin email"): así todas las tarjetas de la grilla miden
 * igual y se ve de un vistazo a quién le faltan datos. Si se le debe algo, un
 * aviso chico en el pie: ámbar, o rojo si algún plazo ya venció (el mismo
 * criterio que el detalle del proveedor). `onEditar`/`onEliminar` sólo para
 * un admin.
 */
export function ProveedorTarjeta({ resumen, onAbrir, onEditar, onEliminar }) {
  const {
    proveedor,
    cantidadProductos,
    totalComprado,
    deuda,
    comprasImpagas,
    diasVencidaMasVieja,
  } = resumen;
  const debe = deuda > 0;
  const vencida = debe && Boolean(diasVencidaMasVieja);
  const avisoDeuda = debe && `Debe ${formatMoneda(deuda)}${vencida ? " · vencida" : ""}`;
  const contacto = [
    { icono: Phone, valor: proveedor.telefono, falta: "Sin teléfono" },
    { icono: Mail, valor: proveedor.email, falta: "Sin email" },
    { icono: MapPin, valor: proveedor.direccion, falta: "Sin dirección", tenue: true },
  ];

  const detener = (fn) => (e) => {
    e.stopPropagation();
    fn();
  };

  return (
    <article
      className="proveedor-tarjeta fila-con-acciones"
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
      aria-label={debe ? `${proveedor.nombre}. ${avisoDeuda}` : proveedor.nombre}
    >
      <div className="proveedor-tarjeta__cabecera">
        <Avatar nombre={proveedor.nombre} grande />
        <span className="proveedor-tarjeta__titulo">
          <span className="proveedor-tarjeta__nombre">{proveedor.nombre}</span>
          <span className="proveedor-tarjeta__cuit cifra">
            {proveedor.cuit ? `CUIT ${proveedor.cuit}` : "Sin CUIT"}
          </span>
        </span>
        {(onEditar || onEliminar) && (
          <span className="acciones proveedor-tarjeta__acciones">
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
        )}
      </div>

      <ul className="proveedor-tarjeta__contacto">
        {contacto.map(({ icono: Icono, valor, falta, tenue }) => {
          const modificador = !valor
            ? " proveedor-tarjeta__dato--falta"
            : tenue
              ? " proveedor-tarjeta__dato--tenue"
              : "";
          return (
            <li key={falta} className={`proveedor-tarjeta__dato${modificador}`}>
              <Icono size={15} strokeWidth={1.75} aria-hidden="true" />
              <span className="proveedor-tarjeta__valor">{valor || falta}</span>
            </li>
          );
        })}
      </ul>

      <div className="proveedor-tarjeta__pie">
        <span className="proveedor-tarjeta__comprado" title="Total comprado a este proveedor">
          <span className="proveedor-tarjeta__total cifra">{formatMoneda(totalComprado)}</span>
          <span className="proveedor-tarjeta__pie-detalle">
            comprado · {pluralizar(cantidadProductos, "producto")}
          </span>
        </span>
        {debe && (
          <span
            className={`badge badge--sm cifra ${vencida ? "badge--peligro" : "badge--atencion"}`}
            title={[
              pluralizar(comprasImpagas.length, "compra sin pagar", "compras sin pagar"),
              vencida && `un plazo venció hace ${pluralizar(diasVencidaMasVieja, "día")}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          >
            {avisoDeuda}
          </span>
        )}
      </div>
    </article>
  );
}
