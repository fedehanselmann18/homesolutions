import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";

import "./Manager.css";
import { FILAS_POR_PAGINA, getAccionAuditoria } from "../../constants/auditoria";
import { getAuditoria, getTiposAuditoria } from "../../services/auditoriaService";
import { formatFechaHora } from "../../utils/formato";
import { obtenerMensajeError } from "../../utils/errorHandling";
import { Cargando } from "../shared/Cargando";
import { EstadoError } from "../shared/EstadoError";
import { EstadoVacio } from "../shared/EstadoVacio";

const FILTROS_VACIOS = { tipo_recurso: "", usuario_id: "", desde: "", hasta: "" };

/**
 * Historial de acciones (tabla `auditoria` del backend): quién hizo qué y
 * cuándo. Hasta que existió esa tabla, esto solo se podía revisar entrando a
 * los logs del servidor en Railway.
 *
 * Es la única sección de la app con paginado real contra el backend: las
 * demás listas piden todo de una porque son chicas y acotadas, pero esta
 * crece una fila por cada acción que hace cualquiera, para siempre.
 *
 * Carga sus propios datos en vez de recibirlos de la página: tiene filtros y
 * paginado propios, así que subir ese estado a quien la use solo lo
 * acoplaría a una sección que no le importa. No necesita enterarse de
 * acciones hechas en otras páginas de Manager (equipo, autorizados): al
 * vivir cada una en su propia ruta, navegar hasta acá ya remonta el
 * componente y trae el historial fresco.
 */
export function SeccionAuditoria({ usuarios }) {
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [pagina, setPagina] = useState(0);
  const [datos, setDatos] = useState({ items: [], total: 0 });
  const [tipos, setTipos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      const respuesta = await getAuditoria({
        ...filtros,
        limit: FILAS_POR_PAGINA,
        offset: pagina * FILAS_POR_PAGINA,
      });
      setDatos(respuesta);
      setError(null);
    } catch (err) {
      setError(obtenerMensajeError(err));
    } finally {
      setCargando(false);
    }
  }, [filtros, pagina]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Los tipos se piden aparte y una sola vez al montar: cambian solo cuando
  // aparece una entidad auditada nueva, no con cada filtro ni con cada
  // página.
  useEffect(() => {
    getTiposAuditoria()
      .then(setTipos)
      .catch(() => setTipos([])); // el combo se queda en "Todos", nada más
  }, []);

  // Cualquier cambio de filtro vuelve a la primera página: si no, filtrar
  // estando en la página 4 puede dejar la lista vacía sin explicación.
  const cambiarFiltro = (campo, valor) => {
    setFiltros((previos) => ({ ...previos, [campo]: valor }));
    setPagina(0);
  };

  const limpiarFiltros = () => {
    setFiltros(FILTROS_VACIOS);
    setPagina(0);
  };

  const hayFiltros = Object.values(filtros).some((valor) => valor !== "");
  const desde = datos.total === 0 ? 0 : pagina * FILAS_POR_PAGINA + 1;
  const hasta = Math.min((pagina + 1) * FILAS_POR_PAGINA, datos.total);
  const hayMas = hasta < datos.total;

  return (
    <div className="manager-auditoria">
      <div className="manager-auditoria__filtros">
        <label className="manager-campo">
          <span>Tipo</span>
          <span className="manager-campo__select">
            <select
              value={filtros.tipo_recurso}
              onChange={(e) => cambiarFiltro("tipo_recurso", e.target.value)}
            >
              <option value="">Todos</option>
              {tipos.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
            <ChevronDown size={16} />
          </span>
        </label>

        <label className="manager-campo">
          <span>Quién</span>
          <span className="manager-campo__select">
            <select
              value={filtros.usuario_id}
              onChange={(e) => cambiarFiltro("usuario_id", e.target.value)}
            >
              <option value="">Todos</option>
              {usuarios.map((usuario) => (
                <option key={usuario.id} value={usuario.id}>
                  {usuario.nombre_usuario}
                </option>
              ))}
            </select>
            <ChevronDown size={16} />
          </span>
        </label>

        <label className="manager-campo">
          <span>Desde</span>
          <input
            type="date"
            value={filtros.desde}
            onChange={(e) => cambiarFiltro("desde", e.target.value)}
          />
        </label>

        <label className="manager-campo">
          <span>Hasta</span>
          <input
            type="date"
            value={filtros.hasta}
            onChange={(e) => cambiarFiltro("hasta", e.target.value)}
          />
        </label>

        {hayFiltros && (
          <button type="button" className="manager-accion" onClick={limpiarFiltros}>
            <RotateCcw size={14} strokeWidth={2} />
            Limpiar
          </button>
        )}
      </div>

      {error ? (
        <EstadoError mensaje={error} />
      ) : cargando ? (
        <Cargando texto="Cargando historial..." />
      ) : datos.items.length === 0 ? (
        <EstadoVacio
          mensaje={
            hayFiltros
              ? "Ninguna acción coincide con estos filtros."
              : "Todavía no hay ninguna acción registrada."
          }
        />
      ) : (
        <>
          <div className="manager-tabla-scroll">
            <table className="manager-tabla" aria-label="Historial de acciones">
              <thead>
                <tr>
                  <th>Cuándo</th>
                  <th>Quién</th>
                  <th>Qué hizo</th>
                  <th>Sobre qué</th>
                </tr>
              </thead>
              <tbody>
                {datos.items.map((fila) => {
                  const accion = getAccionAuditoria(fila.accion);
                  return (
                    <tr key={fila.id}>
                      <td className="manager-auditoria__fecha">
                        {formatFechaHora(fila.creado_en)}
                      </td>
                      <td className="manager-tabla__nombre">{fila.usuario_nombre ?? "—"}</td>
                      <td>
                        <span className={`badge badge--${accion.tono}`}>{accion.label}</span>
                      </td>
                      <td>
                        <span className="manager-auditoria__recurso">{fila.tipo_recurso}</span>
                        {fila.detalle?.usuario && (
                          <span className="manager-auditoria__detalle">{fila.detalle.usuario}</span>
                        )}
                        {/* El id completo va en el title: sirve para cruzar
                            con la base cuando hace falta, pero mostrarlo
                            entero rompería la fila. */}
                        {fila.recurso_id && (
                          <span className="manager-auditoria__id" title={fila.recurso_id}>
                            {fila.recurso_id.slice(0, 8)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="manager-auditoria__paginado">
            <span className="manager-auditoria__conteo">
              Mostrando {desde}-{hasta} de {datos.total}
            </span>
            <div className="manager-auditoria__botones">
              <button
                type="button"
                className="manager-accion"
                onClick={() => setPagina((p) => p - 1)}
                disabled={pagina === 0}
              >
                <ChevronLeft size={14} strokeWidth={2} />
                Anterior
              </button>
              <button
                type="button"
                className="manager-accion"
                onClick={() => setPagina((p) => p + 1)}
                disabled={!hayMas}
              >
                Siguiente
                <ChevronRight size={14} strokeWidth={2} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default SeccionAuditoria;
