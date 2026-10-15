import { Link } from "react-router-dom";
import { BarraProgreso } from "../shared/TarjetaKpi";
import { EstadoVacio } from "../shared/EstadoVacio";
import { ETIQUETAS_METRICAS } from "../../constants/metricas";
import { OLIVA, GRIS } from "../../constants/colores";
import { formatNumero } from "../../utils/formato";

const E = ETIQUETAS_METRICAS;

const pct = (v) => `${formatNumero(v, 0)} %`;

// Cada obra contra su contrato (toda la obra, no el período): la pista es el
// 100 % del precio acordado; adentro, cuánto se cobró (oliva) y cuánto se
// gastó (gris). Si la barra gris es más larga que la oliva, la obra gastó
// más de lo que cobró. Es la pregunta "cuánto cobré, cuánto gasté y cuánto
// me queda" dibujada tal cual. Las barras son las de los KPIs.

export function ObrasContraContrato({ obras }) {
  return (
    <section className="metricas-seccion" aria-label={E.obrasContrato}>
      <div className="metricas-seccion__header">
        <h2 className="metricas-seccion__titulo">{E.obrasContrato}</h2>
        <div className="metricas-leyenda">
          <span className="metricas-leyenda__item">
            <span className="metricas-leyenda__cuadro" style={{ background: OLIVA }} />
            {E.cobrado}
          </span>
          <span className="metricas-leyenda__item">
            <span className="metricas-leyenda__cuadro" style={{ background: GRIS }} />
            {E.gastado}
          </span>
        </div>
      </div>
      {obras.length === 0 ? (
        <EstadoVacio mensaje={E.sinPrecioAcordado} />
      ) : (
        <ul className="metricas-contrato">
          {obras.map((o) => (
            <li
              key={o.id}
              className="metricas-contrato__fila"
              title={`${E.cobrado}: ${pct(o.cobrado)} · ${E.gastado}: ${pct(o.gastado)}`}
            >
              <Link to={`/proyectos/${o.id}`} className="metricas-contrato__obra">
                {o.nombre}
              </Link>
              <div className="metricas-contrato__barras">
                <BarraProgreso porcentaje={o.cobrado} color={OLIVA} />
                <BarraProgreso porcentaje={o.gastado} color={GRIS} />
              </div>
              <div className="metricas-contrato__cifras cifra">
                <span>{pct(o.cobrado)}</span>
                <span>{pct(o.gastado)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default ObrasContraContrato;
