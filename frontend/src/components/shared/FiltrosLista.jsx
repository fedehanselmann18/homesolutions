import { X } from "lucide-react";

import { TIPOS_FACTURA } from "../../constants/tipoFactura";
import {
  FILTRO_NOTAS,
  FILTRO_ESTADO_PAGO,
  FILTRO_ESTADO_ENVIO,
  FILTRO_COMPROBANTE,
  FILTROS_VACIOS,
  hayFiltrosActivos,
} from "../../utils/filtros";
import SelectFlotante from "./SelectFlotante";

import "./FiltrosLista.css";

const OPCIONES_TIPO_FACTURA = [{ value: "", label: "Todos" }, ...TIPOS_FACTURA];

/**
 * Barra de filtros reutilizable para listas de Compras / Cobros / Gastos.
 * Componente controlado: recibe `filtros` + `onCambiar` y no guarda estado
 * propio, así el componente padre decide qué hacer con el resultado
 * (filtrarCompras/filtrarCobros/filtrarGastos de utils/filtros.js).
 *
 * `mostrarNotas` sólo aplica a Compras/Cobros (Gasto no tiene notas).
 * `mostrarEstadoPago`/`mostrarEstadoEnvio` sólo aplican a Compras.
 * `mostrarComprobante` aplica a Cobros/Gastos.
 * `mostrarFechas` se apaga donde la lista ya está ordenada y agrupada por día
 * (el libro de obra), que es donde el rango de fechas no agrega nada.
 * `proyectos` sólo se pasa desde la lista de compras de un proveedor, que es
 * la única que cruza varios proyectos (parado adentro de uno no hay nada que
 * elegir); si no viene, el select ni se dibuja.
 */
export function FiltrosLista({
  filtros,
  onCambiar,
  mostrarNotas = false,
  mostrarEstadoPago = false,
  mostrarEstadoEnvio = false,
  mostrarComprobante = false,
  mostrarFechas = true,
  proyectos = null,
}) {
  const cambiarCampo = (campo, valor) => onCambiar({ ...filtros, [campo]: valor });
  const limpiar = () => onCambiar(FILTROS_VACIOS);

  const opcionesProyecto = proyectos
    ? [{ value: "", label: "Todos los proyectos" }, ...proyectos.map((p) => ({ value: p.id, label: p.nombre }))]
    : null;

  return (
    <div className="filtros-lista">
      {opcionesProyecto && (
        <SelectFlotante
          label="Proyecto"
          value={filtros.proyecto}
          onChange={(v) => cambiarCampo("proyecto", v)}
          opciones={opcionesProyecto}
        />
      )}

      {mostrarEstadoPago && (
        <SelectFlotante
          label="Estado de pago"
          value={filtros.estadoPago}
          onChange={(v) => cambiarCampo("estadoPago", v)}
          opciones={FILTRO_ESTADO_PAGO}
        />
      )}

      {mostrarEstadoEnvio && (
        <SelectFlotante
          label="Estado de envío"
          value={filtros.estadoEnvio}
          onChange={(v) => cambiarCampo("estadoEnvio", v)}
          opciones={FILTRO_ESTADO_ENVIO}
        />
      )}

      {mostrarNotas && (
        <SelectFlotante
          label="Notas"
          value={filtros.notas}
          onChange={(v) => cambiarCampo("notas", v)}
          opciones={FILTRO_NOTAS}
        />
      )}

      <SelectFlotante
        label="Tipo de factura"
        value={filtros.tipoFactura}
        onChange={(v) => cambiarCampo("tipoFactura", v)}
        opciones={OPCIONES_TIPO_FACTURA}
      />

      {mostrarComprobante && (
        <SelectFlotante
          label="Comprobante"
          value={filtros.comprobante}
          onChange={(v) => cambiarCampo("comprobante", v)}
          opciones={FILTRO_COMPROBANTE}
        />
      )}

      {mostrarFechas && (
        <>
          <div className="filtros-lista-campo">
            <label className="label-ficha">Desde</label>
            <input
              type="date"
              value={filtros.desde}
              onChange={(e) => cambiarCampo("desde", e.target.value)}
            />
          </div>

          <div className="filtros-lista-campo">
            <label className="label-ficha">Hasta</label>
            <input
              type="date"
              value={filtros.hasta}
              onChange={(e) => cambiarCampo("hasta", e.target.value)}
            />
          </div>
        </>
      )}

      {hayFiltrosActivos(filtros) && (
        <button type="button" className="filtros-lista-limpiar" onClick={limpiar}>
          <X size={14} strokeWidth={2} />
          Limpiar filtros
        </button>
      )}
    </div>
  );
}

export default FiltrosLista;
