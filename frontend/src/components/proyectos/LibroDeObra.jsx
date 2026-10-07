import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  FileMinus,
  FilePlus,
  FileSignature,
  Layers,
  Paperclip,
  Pencil,
  Trash2,
  Truck,
} from "lucide-react";

import { formatMoneda, formatFechaLarga, pluralizar } from "../../utils/formato";
import { nombreDeArchivo } from "../../utils/archivos";
import { getEstadoPagoConAntiguedad, getEstadoEnvio } from "../../constants/estadoCompra";
import { getTipoFacturaLabel } from "../../constants/tipoFactura";
import { montoCobroNeto, montoGasto, precioTotalCompra } from "../../utils/moneda";
import { diasDesde } from "../../utils/seguimiento";
import { TIPOS_MOVIMIENTO as TIPOS, signoTexto } from "../../constants/tipoMovimiento";

import "./LibroDeObra.css";
import { EstadoVacio } from "../shared/EstadoVacio";
import { BadgeEstado } from "../shared/BadgeEstado";

// Cuántos movimientos por página. Una obra larga junta cientos, y el libro
// pinta todos sus días: sin cortar, la página se vuelve un scroll infinito.
export const MOVIMIENTOS_POR_PAGINA = 50;

// El nombre accesible de un badge de estado: qué es y, si se puede tocar,
// qué hace tocarlo.
const tituloEstado = (texto, accion, puede) => (puede ? `${texto} — ${accion}` : texto);

const conSigno = (monto, signo, moneda) =>
  `${signoTexto(signo)}${formatMoneda(Math.abs(monto), moneda)}`;

/**
 * Libro de obra: compras, gastos y cobros del proyecto en una sola lista,
 * agrupada por día con su subtotal, con un saldo acumulado calculado del
 * movimiento más viejo al más nuevo. Click en la fila abre el detalle; los
 * estados de pago/envío de una compra se togglean desde su badge, sin abrirlo.
 * Diseño: docs/GENERALUIUXChange/Movimientos v2.dc.html, variante 3a.
 *
 * Doble moneda (decisión 6 del rediseño, #5 de docs/PLAN_TIPO_CAMBIO.md): el
 * libro es la caja, así que el SALDO y los subtotales van en pesos nominales,
 * lo que efectivamente entró y salió. Cada fila muestra su importe en la
 * moneda en que se cargó -- compras y gastos en pesos, cobros en dólares -- y
 * la otra moneda debajo, como equivalente.
 */
export function LibroDeObra({
  compras = [],
  gastos = [],
  cobros = [],
  nombreFase,
  nombreProveedor,
  // Opcional: sólo lo pasa la lista de compras de un proveedor, donde los
  // movimientos son de varios proyectos y saber de cuál es cada uno es el
  // dato que más falta. Adentro de un proyecto sobra y no se pasa.
  nombreProyecto,
  canManage = false,
  // Un admin puede tener permiso para editar y aun así no corresponder que
  // edite desde acá: en la ficha del proveedor la compra se consulta, pero
  // se carga y se corrige desde su proyecto, que es donde tiene contexto de
  // fase. Los estados de pago/envío SÍ se togglean igual (ver BadgeEstado),
  // que es la acción que uno quiere a mano mirando lo que le debe a alguien.
  permitirEdicion = true,
  // En una fase no entra plata, así que el acumulado no es un "saldo": el
  // rótulo se ajusta desde donde se use.
  saldoLabel = "Saldo",
  // { tipo, id } del movimiento cuyo detalle está abierto: su fila queda
  // marcada, así al cerrar el modal se ve de dónde se venía.
  movimientoActivo,
  onAbrirDetalle,
  onTogglePagoCompra,
  onToggleEnvioCompra,
  onEditar,
  onEliminar,
  onAgregarNota,
  onVerComprobante,
}) {
  const [errorComprobante, setErrorComprobante] = useState("");
  const [pagina, setPagina] = useState(0);

  const movimientos = useMemo(() => {
    const hoy = new Date();
    const items = [
      ...compras.map((compra) => ({
        key: `compra-${compra.id}`,
        tipo: "compra",
        entidad: compra,
        fecha: compra.fecha,
        importe: precioTotalCompra(compra, "ars"),
        mostrado: { monto: precioTotalCompra(compra, "ars"), moneda: "ars" },
        equivalente: { monto: precioTotalCompra(compra, "usd"), moneda: "usd" },
        titulo: compra.descripcion,
        proyecto: nombreProyecto?.(compra),
        fase: nombreFase?.(compra.fase_id),
        proveedor: nombreProveedor?.(compra.proveedor_id),
        meta: [
          getTipoFacturaLabel(compra.tipo_factura),
          compra.detalle?.length ? pluralizar(compra.detalle.length, "producto") : null,
        ],
        diasImpaga: diasDesde(compra.fecha, hoy),
      })),
      ...gastos.map((gasto) => ({
        key: `gasto-${gasto.id}`,
        tipo: "gasto",
        entidad: gasto,
        fecha: gasto.fecha,
        importe: montoGasto(gasto, "ars"),
        mostrado: { monto: montoGasto(gasto, "ars"), moneda: "ars" },
        equivalente: { monto: montoGasto(gasto, "usd"), moneda: "usd" },
        titulo: gasto.descripcion,
        fase: gasto.fase_id ? nombreFase?.(gasto.fase_id) : null,
        meta: [
          gasto.fase_id ? null : "Gasto general",
          getTipoFacturaLabel(gasto.tipo_factura),
          gasto.categorias?.map((c) => c.nombre).join(", ") || null,
        ],
      })),
      ...cobros.map((cobro) => ({
        key: `cobro-${cobro.id}`,
        tipo: "cobro",
        entidad: cobro,
        fecha: cobro.fecha,
        // El saldo suma los pesos congelados del cobro; lo que se muestra en
        // la fila es su cifra de verdad, la de dólares.
        importe: montoCobroNeto(cobro, "ars"),
        mostrado: { monto: montoCobroNeto(cobro, "usd"), moneda: "usd" },
        equivalente: { monto: montoCobroNeto(cobro, "ars"), moneda: "ars" },
        titulo: cobro.descripcion,
        meta: [
          getTipoFacturaLabel(cobro.tipo_factura),
          Number(cobro.monto_usd) !== montoCobroNeto(cobro, "usd")
            ? `Bruto ${formatMoneda(cobro.monto_usd, "usd")}`
            : null,
        ],
      })),
    ];

    // El saldo acumulado se calcula del más viejo al más nuevo aunque la
    // planilla después se muestre al revés: cada fila responde "cómo venía la
    // caja justo después de este movimiento".
    const cronologicos = [...items].sort((a, b) => a.fecha.localeCompare(b.fecha));
    let acumulado = 0;
    for (const item of cronologicos) {
      acumulado += TIPOS[item.tipo].signo * item.importe;
      item.saldo = acumulado;
    }

    return cronologicos.reverse();
  }, [compras, gastos, cobros, nombreFase, nombreProveedor, nombreProyecto]);

  const totalPaginas = Math.max(1, Math.ceil(movimientos.length / MOVIMIENTOS_POR_PAGINA));
  // Si un filtro achica la lista, la página en la que se estaba puede dejar
  // de existir: se cae a la última que sí existe en vez de mostrar nada.
  const paginaVisible = Math.min(pagina, totalPaginas - 1);

  const dias = useMemo(() => {
    const desde = paginaVisible * MOVIMIENTOS_POR_PAGINA;
    const porFecha = new Map();
    for (const m of movimientos.slice(desde, desde + MOVIMIENTOS_POR_PAGINA)) {
      if (!porFecha.has(m.fecha)) porFecha.set(m.fecha, []);
      porFecha.get(m.fecha).push(m);
    }
    return [...porFecha.entries()].map(([fecha, items]) => ({
      fecha,
      items,
      subtotal: items.reduce((acc, m) => acc + TIPOS[m.tipo].signo * m.importe, 0),
    }));
  }, [movimientos, paginaVisible]);

  const abrirComprobante = async (movimiento) => {
    const comprobante = (movimiento.entidad.comprobantes ?? [])[0];
    if (!comprobante || !onVerComprobante) return;
    setErrorComprobante("");
    try {
      const blob = await onVerComprobante(movimiento.tipo, movimiento.entidad.id, comprobante.id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setErrorComprobante("No se pudo abrir el comprobante.");
    }
  };

  // La columna de acciones (editar/eliminar/nota) define el ancho del grid
  // -- ver --libro-cols en LibroDeObra.css. Si no se dibuja, el grid tiene
  // que volver al de lectura o quedaría una columna vacía a la derecha.
  const mostrarAcciones = canManage && permitirEdicion;

  if (movimientos.length === 0) {
    return <EstadoVacio mensaje="No hay movimientos que coincidan." />;
  }

  return (
    <div className={`libro${mostrarAcciones ? " libro--admin" : ""}`}>
      {errorComprobante && (
        <p className="libro__error" role="alert">
          {errorComprobante}
        </p>
      )}

      <div className="libro__scroll">
        <div className="libro__columnas">
          <span />
          <span>Movimiento</span>
          <span>Estado</span>
          <span className="libro__col-comprobante" title="Comprobante">
            <Paperclip size={14} strokeWidth={1.75} aria-label="Comprobante" />
          </span>
          <span className="libro__num">Importe</span>
          <span className="libro__num">{saldoLabel} $</span>
          {mostrarAcciones && <span />}
        </div>

        {dias.map((dia) => (
          <div key={dia.fecha} className="libro__grupo">
            <div className="libro__dia">
              <span className="libro__dia-fecha">{formatFechaLarga(dia.fecha)}</span>
              <span className="libro__dia-subtotal cifra">
                Subtotal del día {conSigno(dia.subtotal, dia.subtotal >= 0 ? 1 : -1)}
              </span>
            </div>

            {dia.items.map((m) => (
              <FilaMovimiento
                key={m.key}
                movimiento={m}
                activa={movimientoActivo?.tipo === m.tipo && movimientoActivo?.id === m.entidad.id}
                canManage={canManage}
                mostrarAcciones={mostrarAcciones}
                onAbrirDetalle={onAbrirDetalle}
                onTogglePagoCompra={onTogglePagoCompra}
                onToggleEnvioCompra={onToggleEnvioCompra}
                onEditar={onEditar}
                onEliminar={onEliminar}
                onAgregarNota={onAgregarNota}
                onAbrirComprobante={abrirComprobante}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="libro__pie">
        <span className="libro__resultados">
          {movimientos.length === 1 ? "1 resultado" : `${movimientos.length} resultados`}
        </span>
        {totalPaginas > 1 && (
          <div className="libro__paginacion">
            <span className="libro__pagina cifra">
              Página {paginaVisible + 1} de {totalPaginas}
            </span>
            <button
              type="button"
              className="btn btn--sm btn-secondary"
              disabled={paginaVisible === 0}
              onClick={() => setPagina(paginaVisible - 1)}
            >
              Anterior
            </button>
            <button
              type="button"
              className="btn btn--sm btn-secondary"
              disabled={paginaVisible >= totalPaginas - 1}
              onClick={() => setPagina(paginaVisible + 1)}
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FilaMovimiento({
  movimiento,
  activa,
  canManage,
  mostrarAcciones,
  onAbrirDetalle,
  onTogglePagoCompra,
  onToggleEnvioCompra,
  onEditar,
  onEliminar,
  onAgregarNota,
  onAbrirComprobante,
}) {
  const { tipo, entidad, mostrado, equivalente, saldo } = movimiento;
  const { signo, singular, icono: IconoTipo } = TIPOS[tipo];
  const esCompra = tipo === "compra";

  const comprobantes = entidad.comprobantes ?? [];
  const notas = entidad.notas ?? [];
  const notasCredito = notas.filter((n) => n.tipo === "nota_credito").length;
  const notasDebito = notas.filter((n) => n.tipo === "nota_debito").length;

  const meta = movimiento.meta.filter(Boolean).join(" · ");

  const detener = (fn) => (e) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div
      className={`libro__fila fila-con-acciones${activa ? " libro__fila--activa" : ""}`}
      onClick={() => onAbrirDetalle?.(tipo, entidad)}
    >
      <span className="libro__tipo" role="img" aria-label={singular} title={singular}>
        <IconoTipo size={15} strokeWidth={1.75} aria-hidden="true" />
      </span>

      <span className="libro__movimiento">
        <span className="libro__movimiento-titulo">{movimiento.titulo}</span>
        <span className="libro__movimiento-contexto">
          {movimiento.proyecto && (
            <span className="libro__contexto-item">
              <Building2 size={13} strokeWidth={1.75} aria-hidden="true" />
              {movimiento.proyecto}
            </span>
          )}
          {movimiento.fase && (
            <span className="libro__contexto-item">
              <Layers size={13} strokeWidth={1.75} aria-hidden="true" />
              {movimiento.fase}
            </span>
          )}
          {movimiento.proveedor && (
            <span className="libro__contexto-item">
              <Truck size={13} strokeWidth={1.75} aria-hidden="true" />
              {movimiento.proveedor}
            </span>
          )}
          {meta && <span className="libro__meta">{meta}</span>}
          {notasCredito > 0 && (
            <span className="libro__nota" title="Notas de crédito">
              <FileMinus size={13} strokeWidth={1.75} aria-hidden="true" />
              {pluralizar(notasCredito, "nota de crédito", "notas de crédito")}
            </span>
          )}
          {notasDebito > 0 && (
            <span className="libro__nota" title="Notas de débito">
              <FilePlus size={13} strokeWidth={1.75} aria-hidden="true" />
              {pluralizar(notasDebito, "nota de débito", "notas de débito")}
            </span>
          )}
        </span>
      </span>

      <span className="libro__estados">
        {esCompra ? (
          <>
            <BadgeEstado
              estado={getEstadoPagoConAntiguedad(entidad.estado_pago, movimiento.diasImpaga)}
              titulo={tituloEstado(
                entidad.estado_pago === "pagado"
                  ? "Pagado"
                  : `Impaga hace ${pluralizar(movimiento.diasImpaga, "día")}`,
                entidad.estado_pago === "pagado"
                  ? "click para marcar sin pagar"
                  : "click para marcar pagado",
                canManage
              )}
              onToggle={canManage ? detener(() => onTogglePagoCompra?.(entidad)) : undefined}
            />
            <BadgeEstado
              estado={getEstadoEnvio(entidad.estado_envio)}
              titulo={tituloEstado(
                entidad.estado_envio === "entregado" ? "Entregado" : "Sin entregar",
                entidad.estado_envio === "entregado"
                  ? "click para marcar sin entregar"
                  : "click para marcar entregado",
                canManage
              )}
              onToggle={canManage ? detener(() => onToggleEnvioCompra?.(entidad)) : undefined}
            />
          </>
        ) : (
          // Un gasto o un cobro no tiene estado: es plata que ya salió o entró.
          <span className="badge badge--marca">{tipo === "cobro" ? "Cobrado" : "Pagado"}</span>
        )}
      </span>

      <span className="libro__comprobante-col">
        {comprobantes.length > 0 ? (
          <button
            type="button"
            className="libro__comprobante"
            title={
              comprobantes.length === 1
                ? nombreDeArchivo(comprobantes[0].archivo_path)
                : `${comprobantes.length} comprobantes`
            }
            aria-label="Ver comprobante"
            onClick={detener(() => onAbrirComprobante(movimiento))}
          >
            <Paperclip size={15} strokeWidth={1.75} aria-hidden="true" />
          </button>
        ) : (
          <span
            className="libro__sin-comprobante"
            role="img"
            aria-label="Falta el comprobante"
            title="Falta el comprobante"
          >
            <AlertTriangle size={15} strokeWidth={1.75} aria-hidden="true" />
          </span>
        )}
      </span>

      <span className="libro__importe-col">
        <span className="libro__importe-linea">
          <span className="libro__importe cifra">
            {conSigno(mostrado.monto, signo, mostrado.moneda)}
          </span>
          <span className="libro__moneda">{mostrado.moneda === "usd" ? "USD" : "ARS"}</span>
        </span>
        <span className="libro__equivalente cifra">
          ≈ {formatMoneda(equivalente.monto, equivalente.moneda)}
        </span>
      </span>

      <span className="libro__num libro__saldo-fila cifra">{formatMoneda(saldo)}</span>

      {mostrarAcciones && (
        <span className="libro__acciones acciones">
          {(tipo === "compra" || tipo === "cobro") && onAgregarNota && (
            <button
              type="button"
              className="btn-icono btn-icono--sm"
              title="Agregar nota de crédito/débito"
              aria-label="Agregar nota de crédito/débito"
              onClick={detener(() => onAgregarNota(tipo, entidad))}
            >
              <FileSignature aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            className="btn-icono btn-icono--sm"
            title="Editar"
            aria-label="Editar"
            onClick={detener(() => onEditar?.(tipo, entidad))}
          >
            <Pencil aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn-icono btn-icono--sm btn-icono--peligro"
            title="Eliminar"
            aria-label="Eliminar"
            onClick={detener(() => onEliminar?.(tipo, entidad.id))}
          >
            <Trash2 aria-hidden="true" />
          </button>
        </span>
      )}
    </div>
  );
}

export default LibroDeObra;
