import { Link, useNavigate } from "react-router-dom";
import { BadgeEstado } from "../shared/BadgeEstado";
import { BarraProgreso } from "../shared/TarjetaKpi";
import { getEstado } from "../../constants/estados";
import { ETIQUETAS_METRICAS, NIVELES_OBRA } from "../../constants/metricas";
import { OLIVA } from "../../constants/colores";
import { formatMoneda, formatNumero } from "../../utils/formato";

const E = ETIQUETAS_METRICAS;

const pct = (valor, decimales = 1) =>
  valor == null ? E.sinValor : `${formatNumero(valor, decimales)} %`;

/**
 * Una fila por obra con movimientos en el período (ver utils/metricas.js):
 * montos del período, % ejecutado y situación de la obra entera. La fila
 * lleva al proyecto. En tablet scrollea horizontal dentro de su caja.
 */
export function TablaObras({ filas, moneda }) {
  const navigate = useNavigate();
  const monto = (valor) => (valor == null ? E.sinValor : formatMoneda(valor, moneda));

  return (
    <section className="metricas-seccion" aria-label={E.obras}>
      <div className="metricas-seccion__header">
        <h2 className="metricas-seccion__titulo">{E.obras}</h2>
      </div>
      <div className="metricas-tabla-caja">
        <div className="planilla metricas-tabla" role="table" aria-label={E.obras}>
          <div className="planilla__header metricas-tabla__fila" role="row">
            <span role="columnheader">{E.obra}</span>
            <span role="columnheader">{E.estado}</span>
            <span role="columnheader" className="metricas-tabla__num">
              {E.precioAcordado}
            </span>
            <span role="columnheader" className="metricas-tabla__num">
              {E.ingresos}
            </span>
            <span role="columnheader" className="metricas-tabla__num">
              {E.egresos}
            </span>
            <span role="columnheader" className="metricas-tabla__num">
              {E.resultado}
            </span>
            <span role="columnheader" className="metricas-tabla__num">
              {E.rentabilidad}
            </span>
            <span role="columnheader">{E.pctEjecutado}</span>
            <span role="columnheader">{E.nivel}</span>
          </div>
          {filas.map((f) => {
            const nivel = NIVELES_OBRA[f.nivel];
            const estado = getEstado(f.estado);
            return (
              <div
                key={f.id}
                className="planilla__fila metricas-tabla__fila"
                role="row"
                onClick={() => navigate(`/proyectos/${f.id}`)}
              >
                <span role="cell" className="metricas-tabla__obra">
                  <Link
                    to={`/proyectos/${f.id}`}
                    title={f.nombre}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {f.nombre}
                  </Link>
                </span>
                <span role="cell">
                  <BadgeEstado estado={estado} titulo={`${E.estado}: ${estado.label}`} chico />
                </span>
                <span role="cell" className="metricas-tabla__num cifra">
                  {monto(f.precioAcordado)}
                </span>
                <span role="cell" className="metricas-tabla__num cifra">
                  {monto(f.ingresos)}
                </span>
                <span role="cell" className="metricas-tabla__num cifra">
                  {monto(f.egresos)}
                </span>
                <span
                  role="cell"
                  className={`metricas-tabla__num metricas-tabla__fuerte cifra${
                    f.resultado < 0 ? " metricas-tabla__negativo" : ""
                  }`}
                >
                  {monto(f.resultado)}
                </span>
                <span
                  role="cell"
                  className={`metricas-tabla__num cifra${
                    f.rentabilidad < 0 ? " metricas-tabla__negativo" : ""
                  }`}
                >
                  {pct(f.rentabilidad)}
                </span>
                <span
                  role="cell"
                  className="metricas-tabla__ejecutado"
                  title={`${E.pctEjecutado}: ${pct(f.pctEjecutado, 0)}`}
                >
                  {f.pctEjecutado == null ? (
                    E.sinValor
                  ) : (
                    <>
                      <BarraProgreso porcentaje={f.pctEjecutado} color={OLIVA} />
                      <span className="cifra">{pct(f.pctEjecutado, 0)}</span>
                    </>
                  )}
                </span>
                <span role="cell">
                  <BadgeEstado estado={nivel} titulo={`${E.nivel}: ${nivel.label}`} chico />
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default TablaObras;
