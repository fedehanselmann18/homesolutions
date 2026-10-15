import { ETIQUETAS_METRICAS } from "../../constants/metricas";
import { PARES_SEMAFORO } from "../../constants/estadoCompra";
import { ERROR_TEXTO } from "../../constants/colores";
import { formatNumero } from "../../utils/formato";
import "../shared/TarjetaKpi.css";

/**
 * KPI de Métricas: la cifra del período, cuánto cambió contra el mismo tramo
 * del período anterior y, debajo, cuánto era antes. Sin gráfico a propósito:
 * una línea sin escala de cinco o seis meses no se lee, el "antes" sí. Usa
 * las clases de TarjetaKpi para que la cifra se vea igual que en el resto.
 *
 * - `variacion`: % (o puntos si `enPuntos`), null si no hay con qué comparar.
 * - `favorableSiSube`: true para ingresos/resultado/rentabilidad (subir es
 *   bueno, oliva; bajar, ámbar). false para egresos: subir no es ni bueno ni
 *   malo (la obra avanza), así que va en neutro.
 */
export function TarjetaVariacion({
  titulo,
  valor,
  negativo,
  variacion,
  enPuntos = false,
  favorableSiSube = true,
  anterior,
}) {
  const hayVariacion = variacion != null && Number.isFinite(variacion);
  const decimales = enPuntos ? 1 : 0;
  const redondeada = hayVariacion ? Number(variacion.toFixed(decimales)) : 0;
  const par =
    !hayVariacion || redondeada === 0 || !favorableSiSube
      ? PARES_SEMAFORO.neutro
      : redondeada > 0
        ? PARES_SEMAFORO.resuelto
        : PARES_SEMAFORO.atencion;
  const signo = redondeada > 0 ? "+" : redondeada < 0 ? "−" : "";
  const textoVariacion = `${signo}${formatNumero(Math.abs(redondeada), decimales)} ${
    enPuntos ? "pp" : "%"
  }`;

  return (
    <div className="kpi metricas-tarjeta">
      <div className="metricas-tarjeta__cabecera">
        <span className="kpi-titulo">{titulo}</span>
        {hayVariacion && (
          <span
            className="badge badge--sm cifra"
            style={{ backgroundColor: par.bg, color: par.fg }}
            title={`${ETIQUETAS_METRICAS.vsAnterior}: ${anterior}`}
          >
            {textoVariacion}
          </span>
        )}
      </div>
      <span className="kpi-valor" style={negativo ? { color: ERROR_TEXTO } : undefined}>
        {valor}
      </span>
      {anterior != null && (
        <span className="kpi-detalle cifra">
          {ETIQUETAS_METRICAS.antes}: {anterior}
        </span>
      )}
    </div>
  );
}

export default TarjetaVariacion;
