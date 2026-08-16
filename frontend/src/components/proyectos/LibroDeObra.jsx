import { useMemo, useState } from "react";
import {
  FileMinus,
  FilePlus,
  Pencil,
  Trash2,
  FileSignature,
  ShoppingCart,
  Receipt,
  HandCoins,
} from "lucide-react";

import { formatMoneda, formatFecha } from "../../utils/formato";
import { iconoParaArchivo, nombreDeArchivo } from "../../utils/archivos";
import { getEstadoPago, getEstadoEnvio } from "../../constants/estadoCompra";
import { getTipoFacturaLabel } from "../../constants/tipoFactura";
import { totalNotasCredito, totalNotasDebito } from "../../utils/notas";
import { esCompraImpaga, diasDesde } from "../../utils/seguimiento";
import { VERDE, NARANJA, AZUL } from "../../constants/colores";

import "./LibroDeObra.css";

// `label` es para la leyenda de totales (en plural) y `singular` + `icono`
// para la columna Tipo de cada fila, que usa el mismo icono y el mismo
// tratamiento en mayúsculas que el header del modal de detalle.
const TIPOS = {
  cobro: { label: "Cobros", singular: "Cobro", icono: HandCoins, color: VERDE, signo: 1 },
  compra: { label: "Compras", singular: "Compra", icono: ShoppingCart, color: AZUL, signo: -1 },
  gasto: { label: "Gastos", singular: "Gasto", icono: Receipt, color: NARANJA, signo: -1 },
};

const capitalizar = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

const diaConNombre = (fecha) =>
  `${capitalizar(
    new Date(`${fecha}T00:00:00`).toLocaleDateString("es-AR", { weekday: "long" })
  )} ${formatFecha(fecha)}`;

const conSigno = (monto, signo) => `${signo > 0 ? "+" : "-"}${formatMoneda(Math.abs(monto))}`;

function montoNetoCobro(cobro) {
  const notas = cobro.notas ?? [];
  return (
    cobro.monto_neto ?? Number(cobro.monto) - totalNotasCredito(notas) + totalNotasDebito(notas)
  );
}

/**
 * Libro de obra (dirección 3b del rediseño, ver claudedesign/): compras,
 * gastos y cobros del proyecto en una sola planilla en vez de tres grillas de
 * tarjetas separadas. Las filas se agrupan por día con subtotal, cada una
 * lleva su tipo (compra / gasto / cobro) y una columna de saldo acumulado
 * calculado del movimiento más viejo al más nuevo. Click en la fila abre el
 * modal de detalle de lectura; los estados de pago/envío se togglean desde la
 * fila misma sin abrirlo.
 */
export function LibroDeObra({
  titulo,
  compras = [],
  gastos = [],
  cobros = [],
  nombreFase,
  nombreProveedor,
  canManage = false,
  // En una fase no entra plata, así que el acumulado no es un "saldo": el
  // rótulo se ajusta desde donde se use.
  saldoLabel = "Saldo",
  onAbrirDetalle,
  onTogglePagoCompra,
  onToggleEnvioCompra,
  onEditar,
  onEliminar,
  onAgregarNota,
  onVerComprobante,
}) {
  const [errorComprobante, setErrorComprobante] = useState("");

  const movimientos = useMemo(() => {
    const items = [
      ...compras.map((compra) => ({
        key: `compra-${compra.id}`,
        tipo: "compra",
        entidad: compra,
        fecha: compra.fecha,
        importe: Number(compra.precio_total) || 0,
        titulo: compra.descripcion,
        // Una compra impaga hace cuántos días lo está: es la señal que
        // dispara el "sin pagar" de los KPI, y se pierde si sólo se ve la fecha.
        alerta: esCompraImpaga(compra)
          ? `${diasDesde(compra.fecha, new Date())} días sin pagar`
          : null,
        contexto: [
          nombreProveedor?.(compra.proveedor_id),
          nombreFase?.(compra.fase_id),
          getTipoFacturaLabel(compra.tipo_factura),
          compra.detalle?.length
            ? `${compra.detalle.length} ${compra.detalle.length === 1 ? "producto" : "productos"}`
            : null,
        ],
      })),
      ...gastos.map((gasto) => ({
        key: `gasto-${gasto.id}`,
        tipo: "gasto",
        entidad: gasto,
        fecha: gasto.fecha,
        importe: Number(gasto.monto) || 0,
        titulo: gasto.descripcion,
        contexto: [
          getTipoFacturaLabel(gasto.tipo_factura),
          gasto.fase_id ? nombreFase?.(gasto.fase_id) : "Gasto general",
          gasto.categorias?.map((c) => c.nombre).join(", ") || null,
        ],
      })),
      ...cobros.map((cobro) => ({
        key: `cobro-${cobro.id}`,
        tipo: "cobro",
        entidad: cobro,
        fecha: cobro.fecha,
        importe: montoNetoCobro(cobro),
        titulo: cobro.descripcion,
        contexto: [
          getTipoFacturaLabel(cobro.tipo_factura),
          Number(cobro.monto) !== montoNetoCobro(cobro)
            ? `Bruto ${formatMoneda(cobro.monto)}`
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
  }, [compras, gastos, cobros, nombreFase, nombreProveedor]);

  const totalesPorTipo = useMemo(
    () =>
      Object.keys(TIPOS).map((tipo) => ({
        tipo,
        total: movimientos.filter((m) => m.tipo === tipo).reduce((acc, m) => acc + m.importe, 0),
      })),
    [movimientos]
  );

  const dias = useMemo(() => {
    const porFecha = new Map();
    for (const m of movimientos) {
      if (!porFecha.has(m.fecha)) porFecha.set(m.fecha, []);
      porFecha.get(m.fecha).push(m);
    }
    return [...porFecha.entries()].map(([fecha, items]) => ({
      fecha,
      items,
      subtotal: items.reduce((acc, m) => acc + TIPOS[m.tipo].signo * m.importe, 0),
    }));
  }, [movimientos]);

  const saldoFinal = movimientos.length > 0 ? movimientos[0].saldo : 0;

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

  if (movimientos.length === 0) {
    return <p className="libro-vacio">No hay movimientos que coincidan.</p>;
  }

  return (
    <div className={`libro${canManage ? " libro--admin" : ""}`}>
      <div className="libro__cabecera">
        <span className="libro__titulo">{titulo}</span>
        <span className="libro__espaciador" />
        {totalesPorTipo.map(({ tipo, total }) => (
          <span key={tipo} className="libro__leyenda">
            <span className="libro__punto" style={{ background: TIPOS[tipo].color }} />
            {TIPOS[tipo].label} {formatMoneda(total)}
          </span>
        ))}
      </div>

      {errorComprobante && <p className="libro__error">{errorComprobante}</p>}

      <div className="libro__columnas">
        <span className="label-ficha">Tipo</span>
        <span className="label-ficha">Movimiento</span>
        <span className="label-ficha">Comprobantes</span>
        <span className="label-ficha">Estado</span>
        <span className="label-ficha libro__num">Importe</span>
        <span className="label-ficha libro__num">Saldo</span>
        {canManage && <span />}
      </div>

      {dias.map((dia) => (
        <div key={dia.fecha}>
          <div className="libro__dia">
            <span className="libro__dia-fecha">{diaConNombre(dia.fecha)}</span>
            <span className="libro__dia-linea" />
            <span className="libro__dia-subtotal cifra">
              Subtotal del día {conSigno(dia.subtotal, dia.subtotal >= 0 ? 1 : -1)}
            </span>
          </div>

          {dia.items.map((m) => (
            <FilaMovimiento
              key={m.key}
              movimiento={m}
              canManage={canManage}
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

      <div className="libro__saldo">
        <span />
        <span className="libro__saldo-label">{saldoLabel}</span>
        <span />
        <span />
        <span />
        <span className="libro__num libro__saldo-monto cifra">{formatMoneda(saldoFinal)}</span>
        {canManage && <span />}
      </div>
    </div>
  );
}

function FilaMovimiento({
  movimiento,
  canManage,
  onAbrirDetalle,
  onTogglePagoCompra,
  onToggleEnvioCompra,
  onEditar,
  onEliminar,
  onAgregarNota,
  onAbrirComprobante,
}) {
  const { tipo, entidad, importe, saldo } = movimiento;
  const { color, signo, icono: IconoTipo } = TIPOS[tipo];
  const esCompra = tipo === "compra";

  const comprobantes = entidad.comprobantes ?? [];
  const notas = entidad.notas ?? [];
  const notasCredito = notas.filter((n) => n.tipo === "nota_credito").length;
  const notasDebito = notas.filter((n) => n.tipo === "nota_debito").length;

  const estadoPago = esCompra ? getEstadoPago(entidad.estado_pago) : null;
  const estadoEnvio = esCompra ? getEstadoEnvio(entidad.estado_envio) : null;

  const detener = (fn) => (e) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div className="libro__fila" onClick={() => onAbrirDetalle?.(tipo, entidad)}>
      <span className="libro__tipo" style={{ color }}>
        <IconoTipo size={13} strokeWidth={2.25} />
        {TIPOS[tipo].singular}
      </span>

      <span className="libro__movimiento">
        <span className="libro__movimiento-titulo">{movimiento.titulo}</span>
        <span className="libro__movimiento-contexto">
          {movimiento.alerta && <span className="libro__alerta">{movimiento.alerta}</span>}
          {movimiento.alerta && " · "}
          {movimiento.contexto.filter(Boolean).join(" · ")}
        </span>
      </span>

      <span className="libro__comprobantes">
        {comprobantes.length === 0 && notasCredito === 0 && notasDebito === 0 && (
          <span className="libro__sin-dato">—</span>
        )}
        {comprobantes.slice(0, 3).map((c) => {
          const Icono = iconoParaArchivo(nombreDeArchivo(c.archivo_path));
          return (
            <button
              key={c.id}
              type="button"
              className="libro__comprobante"
              title={nombreDeArchivo(c.archivo_path)}
              onClick={detener(() => onAbrirComprobante(movimiento))}
            >
              <Icono size={14} strokeWidth={2} />
            </button>
          );
        })}
        {comprobantes.length > 3 && (
          <span className="libro__comprobantes-mas">+{comprobantes.length - 3}</span>
        )}
        {notasCredito > 0 && (
          <span className="libro__nota libro__nota--credito" title="Notas de crédito">
            <FileMinus size={13} strokeWidth={2} />
            {notasCredito}
          </span>
        )}
        {notasDebito > 0 && (
          <span className="libro__nota libro__nota--debito" title="Notas de débito">
            <FilePlus size={13} strokeWidth={2} />
            {notasDebito}
          </span>
        )}
      </span>

      <span className="libro__estados">
        {esCompra ? (
          <>
            <EstadoBoton
              estado={estadoPago}
              titulo={
                entidad.estado_pago === "pagado"
                  ? "Pagado — click para marcar sin pagar"
                  : "Pago pendiente — click para marcar pagado"
              }
              canManage={canManage}
              onClick={detener(() => onTogglePagoCompra?.(entidad))}
            />
            <EstadoBoton
              estado={estadoEnvio}
              titulo={
                entidad.estado_envio === "entregado"
                  ? "Entregado — click para marcar sin entregar"
                  : "Pedido — click para marcar entregado"
              }
              canManage={canManage}
              onClick={detener(() => onToggleEnvioCompra?.(entidad))}
            />
          </>
        ) : (
          <span className="libro__sin-dato">—</span>
        )}
      </span>

      <span className="libro__num libro__importe cifra" style={{ color }}>
        {conSigno(importe, signo)}
      </span>

      <span className="libro__num libro__saldo-fila cifra">{formatMoneda(saldo)}</span>

      {canManage && (
        <span className="libro__acciones">
          {(tipo === "compra" || tipo === "cobro") && onAgregarNota && (
            <button
              type="button"
              className="libro__accion"
              title="Agregar nota de crédito/débito"
              onClick={detener(() => onAgregarNota(tipo, entidad))}
            >
              <FileSignature size={13} strokeWidth={2} />
            </button>
          )}
          <button
            type="button"
            className="libro__accion"
            title="Editar"
            onClick={detener(() => onEditar?.(tipo, entidad))}
          >
            <Pencil size={13} strokeWidth={2} />
          </button>
          <button
            type="button"
            className="libro__accion libro__accion--eliminar"
            title="Eliminar"
            onClick={detener(() => onEliminar?.(tipo, entidad.id))}
          >
            <Trash2 size={13} strokeWidth={2} />
          </button>
        </span>
      )}
    </div>
  );
}

function EstadoBoton({ estado, titulo, canManage, onClick }) {
  const Icono = estado.icono;
  return (
    <button
      type="button"
      className="libro__estado"
      title={canManage ? titulo : estado.label}
      disabled={!canManage}
      style={{ color: estado.color, backgroundColor: `${estado.color}1f` }}
      onClick={onClick}
    >
      {Icono && <Icono size={14} strokeWidth={2.25} />}
    </button>
  );
}

export default LibroDeObra;
