// components/ProyectoDetalleHeader.jsx
import { useMemo } from "react";
import "./ProyectoDetalleHeader.css";
import { Breadcrumbs } from "../shared/Breadcrumbs";
import { TarjetaKpi } from "../shared/TarjetaKpi";
import {
  useFasesPorProyecto,
  useGastosPorProyecto,
  useCobrosPorProyecto,
  useComprasPorProyecto,
} from "../../hooks/queries";
import { calcularAnalisis } from "../../utils/analisis";
import { calcularSeguimiento } from "../../utils/seguimiento";
import { formatMoneda, formatMonedaCorta, formatFecha } from "../../utils/formato";
import { getEstado } from "../../constants/estados";
import { VERDE, ROJO, NARANJA } from "../../constants/colores";

// Fases cerradas/totales del proyecto -- mismo criterio ("auditada" cuenta
// como cerrada) que utils/panel.js (ESTADOS_FASE_CERRADA), acá calculado
// directo sobre las fases de ESTE proyecto en vez de reusar calcularPanel
// (que agrupa varios proyectos a la vez).
function detalleFases(fases) {
  const cerradas = fases.filter((f) => f.estado === "terminada" || f.estado === "auditada").length;
  const enCurso = fases.find((f) => f.estado === "en_curso");
  let detalle;
  if (enCurso) detalle = enCurso.nombre;
  else if (fases.length === 0) detalle = "Sin fases cargadas";
  else if (cerradas === fases.length) detalle = "Todas las fases terminadas";
  else detalle = "Sin fases en curso";
  return { cerradas, totales: fases.length, detalle };
}

// Mismo criterio que kpis.requiereAccion en utils/panel.js (por proyecto):
// compras impagas + sin entregar + fases estancadas -- no se suman las
// "sin comprobante" acá (esas quedan sólo en la pestaña Seguimiento).
function detalleRequiereAccion(seguimiento) {
  const cantidad =
    seguimiento.comprasImpagas.length +
    seguimiento.comprasSinEntregar.length +
    seguimiento.fasesEstancadas.length;
  const detalle = [
    seguimiento.comprasImpagas.length > 0 &&
      `${seguimiento.comprasImpagas.length} sin pagar`,
    seguimiento.comprasSinEntregar.length > 0 &&
      `${seguimiento.comprasSinEntregar.length} ${seguimiento.comprasSinEntregar.length === 1 ? "envío" : "envíos"}`,
    seguimiento.fasesEstancadas.length > 0 &&
      `${seguimiento.fasesEstancadas.length} ${seguimiento.fasesEstancadas.length === 1 ? "fase parada" : "fases paradas"}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return { cantidad, detalle: cantidad === 0 ? "Todo al día" : detalle };
}

function ProyectoDetalleHeader({ proyecto, breadcrumb }) {
  const estado = getEstado(proyecto.estado);

  const fasesQuery = useFasesPorProyecto(proyecto.id);
  const gastosQuery = useGastosPorProyecto(proyecto.id);
  const cobrosQuery = useCobrosPorProyecto(proyecto.id);
  const comprasQuery = useComprasPorProyecto(proyecto.id);

  const cargando =
    fasesQuery.isLoading || gastosQuery.isLoading || cobrosQuery.isLoading || comprasQuery.isLoading;

  const datos = useMemo(
    () =>
      cargando
        ? null
        : {
            proyecto,
            fases: fasesQuery.data ?? [],
            gastos: gastosQuery.data ?? [],
            cobros: cobrosQuery.data ?? [],
            compras: comprasQuery.data ?? [],
          },
    [cargando, proyecto, fasesQuery.data, gastosQuery.data, cobrosQuery.data, comprasQuery.data]
  );

  const analisis = useMemo(() => (datos ? calcularAnalisis(datos) : null), [datos]);
  const seguimiento = useMemo(() => (datos ? calcularSeguimiento(datos) : null), [datos]);
  const fases = detalleFases(fasesQuery.data ?? []);
  const accion = seguimiento ? detalleRequiereAccion(seguimiento) : null;

  return (
    <div className="proyecto-header" style={{ borderLeftColor: estado.color }}>
      {breadcrumb && <Breadcrumbs items={breadcrumb} />}

      <div className="proyecto-header__top">
        <h1 className="proyecto-header__nombre">{proyecto.nombre}</h1>
        <span
          className="proyecto-header__estado"
          style={{
            color: estado.color,
            backgroundColor: `color-mix(in srgb, ${estado.color} 15%, white)`,
            borderColor: `color-mix(in srgb, ${estado.color} 40%, white)`,
          }}
        >
          {estado.label}
        </span>
      </div>

      <p className="proyecto-header__meta">
        {proyecto.direccion} · Iniciado el {formatFecha(proyecto.fecha_inicio)}
      </p>

      {proyecto.descripcion && <p className="proyecto-header__descripcion">{proyecto.descripcion}</p>}

      {analisis && seguimiento && (
        <div className="proyecto-header__kpis">
          <TarjetaKpi
            titulo="Disponible"
            valor={formatMoneda(analisis.totales.disponible)}
            detalle="Cobrado − gastos − compras"
            color={analisis.totales.disponible >= 0 ? VERDE : ROJO}
            destacado
          />
          <TarjetaKpi
            titulo="Presupuesto ejecutado"
            valor={`${analisis.totales.pctGastado.toFixed(0)}%`}
            porcentaje={analisis.totales.pctGastado}
            detalle={`${formatMonedaCorta(analisis.totales.egresos)} / ${formatMonedaCorta(analisis.totales.precioAcordado)}`}
            color={analisis.totales.pctGastado > 100 ? ROJO : NARANJA}
          />
          <TarjetaKpi
            titulo="Cobrado"
            valor={formatMoneda(seguimiento.cobranza.cobrado)}
            detalle={
              seguimiento.cobranza.pendiente > 0
                ? `${formatMoneda(seguimiento.cobranza.pendiente)} pendiente`
                : "Sin pendiente"
            }
          />
          <TarjetaKpi
            titulo="Fases"
            valor={`${fases.cerradas} / ${fases.totales}`}
            detalle={fases.detalle}
          />
          <TarjetaKpi
            titulo="Requiere acción"
            valor={accion.cantidad}
            detalle={accion.detalle}
            color={accion.cantidad > 0 ? ROJO : VERDE}
            destacado
          />
        </div>
      )}
    </div>
  );
}

export default ProyectoDetalleHeader;
