import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import { crearFase, actualizarFase, eliminarFase, moverFase } from "../../services/faseService";
import {
  useProyecto,
  useFasesPorProyecto,
  useGastosPorProyecto,
  useComprasPorProyecto,
} from "../../hooks/queries";
import ModalFase from "../modals/ModalFase";
import ModalConfirmar from "../modals/ModalConfirmar";
import { BarraProgreso } from "../shared/TarjetaKpi";
import "./Fases.css";
import useAuth from "../../context/useAuth";
import { useToast } from "../../context/useToast";
import { ESTADO_LABELS } from "../../constants/estados";
import { VERDE, NARANJA, ROJO, LINEA, TINTA_MUTED } from "../../constants/colores";
import { EstadoVacio } from "../shared/EstadoVacio";
import { calcularAnalisis } from "../../utils/analisis";
import { diasDesde } from "../../utils/seguimiento";
import { formatMoneda } from "../../utils/formato";
import { obtenerDetalleBackend } from "../../utils/errorHandling";
import { TINTE_PASTILLA } from "../../constants/tipoMovimiento";

function colorFase(estado) {
  if (estado === "terminada" || estado === "auditada") return VERDE;
  if (estado === "en_curso") return NARANJA;
  return LINEA; // plano y no CSS var porque el borde va por style inline
}

export function Fases({ proyectoId }) {
  const { usuario } = useAuth();
  const canManage = usuario?.rol === "admin";
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const proyectoQuery = useProyecto(proyectoId);
  const fasesQuery = useFasesPorProyecto(proyectoId);
  const gastosQuery = useGastosPorProyecto(proyectoId);
  const comprasQuery = useComprasPorProyecto(proyectoId);
  const fases = fasesQuery.data ?? [];

  const [modalAbierto, setModalAbierto] = useState(false);
  const [faseEditando, setFaseEditando] = useState(null);
  const [faseAEliminar, setFaseAEliminar] = useState(null);

  // Invalidar por el prefijo "fases" alcanza tanto esta key ("por
  // proyecto") como la global de Dashboard y la "detalle" de FaseDetalle
  // -- ver lib/queryKeys.js.
  const invalidarFases = () => queryClient.invalidateQueries({ queryKey: ["fases"] });

  const handleNuevaFase = () => {
    setFaseEditando(null);
    setModalAbierto(true);
  };

  const handleEditarFase = (e, fase) => {
    e.stopPropagation();
    setFaseEditando(fase);
    setModalAbierto(true);
  };

  const handleGuardarFase = async (datosForm) => {
    try {
      if (faseEditando) {
        await actualizarFase(faseEditando.id, datosForm);
      } else {
        await crearFase({ ...datosForm, proyecto_id: proyectoId });
      }
      setModalAbierto(false);
      setFaseEditando(null);
      invalidarFases();
    } catch (error) {
      console.error("Error guardando fase:", error);
      toast.error(obtenerDetalleBackend(error) ?? "No se pudo guardar la fase.");
    }
  };

  const handleSolicitarEliminarFase = (e, fase) => {
    e.stopPropagation();
    setFaseAEliminar(fase);
  };

  const handleMoverFase = async (e, fase, direccion) => {
    e.stopPropagation();
    try {
      await moverFase(fase.id, direccion);
      invalidarFases();
    } catch (error) {
      console.error("Error moviendo fase:", error);
      toast.error(obtenerDetalleBackend(error) ?? "No se pudo mover la fase.");
    }
  };

  const handleConfirmarEliminarFase = async () => {
    const faseId = faseAEliminar.id;
    setFaseAEliminar(null);
    try {
      await eliminarFase(faseId);
      invalidarFases();
    } catch (error) {
      console.error("Error eliminando fase:", error);
      toast.error(obtenerDetalleBackend(error) ?? "No se pudo eliminar la fase.");
    }
  };

  // gastadoPorFase sale de calcularAnalisis (misma fuente que Análisis
  // General/Seguimiento, ver egresosPorFase en utils/analisis.js) -- acá
  // sólo se arma un lookup por fase, no se reimplementa la suma.
  const gastadoPorFase = useMemo(() => {
    if (!proyectoQuery.data || !fasesQuery.data || !gastosQuery.data || !comprasQuery.data)
      return null;
    const analisis = calcularAnalisis({
      proyecto: proyectoQuery.data,
      fases: fasesQuery.data,
      gastos: gastosQuery.data,
      compras: comprasQuery.data,
    });
    const porFase = new Map(analisis.egresosPorFase.map((f) => [f.faseId, f.total]));
    return { porFase, totales: analisis.totales };
  }, [proyectoQuery.data, fasesQuery.data, gastosQuery.data, comprasQuery.data]);

  const precioAcordado = Number(proyectoQuery.data?.precio_acordado_usd ?? 0);

  return (
    <div>
      <div className="fases-header">
        <h2>Fases del Proyecto</h2>
        {canManage && <button onClick={handleNuevaFase}>Nueva fase</button>}
      </div>

      {fases.length === 0 ? (
        <EstadoVacio mensaje="No hay fases disponibles para este proyecto." />
      ) : (
        <div className="planilla fases-tabla">
          <div className="planilla__header fases-tabla-header">
            <span className="label-ficha">#</span>
            <span className="label-ficha">Fase</span>
            <span className="label-ficha">Estado</span>
            <span className="label-ficha fases-tabla-col--num">Gastado</span>
            <span className="label-ficha">% del presupuesto</span>
            <span />
          </div>

          {fases.map((fase, i) => {
            const estadoInfo = ESTADO_LABELS[fase.estado] ?? {
              color: TINTA_MUTED,
              label: fase.estado,
            };
            const gastado = gastadoPorFase?.porFase.get(fase.id) ?? 0;
            const pct = precioAcordado > 0 ? (gastado / precioAcordado) * 100 : 0;
            const enCurso = fase.estado === "en_curso";
            const terminada = fase.estado === "terminada" || fase.estado === "auditada";
            const sinDatos = !gastadoPorFase;
            // fecha_en_curso_desde (no fecha_actualizacion): ese campo se
            // pisa con cualquier edición de la fase, no solo al entrar en
            // curso -- ver comentario en el modelo Fase (backend).
            const diasEnCurso = fase.fecha_en_curso_desde
              ? diasDesde(fase.fecha_en_curso_desde, new Date())
              : null;

            return (
              <div
                key={fase.id}
                className="planilla__fila fases-tabla-fila"
                style={{ boxShadow: `inset 3px 0 0 ${colorFase(fase.estado)}` }}
                onClick={() => navigate(`/proyectos/${proyectoId}/fases/${fase.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) =>
                  (e.key === "Enter" || e.key === " ") &&
                  navigate(`/proyectos/${proyectoId}/fases/${fase.id}`)
                }
              >
                <span className="fases-tabla-num">{String(fase.orden).padStart(2, "0")}</span>

                <span className="fases-tabla-col--fase">
                  <span
                    className={[
                      "fases-tabla-nombre",
                      fase.estado === "por_empezar" && "fases-tabla-nombre--pendiente",
                      terminada && "fases-tabla-nombre--terminada",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {fase.nombre}
                  </span>
                  {fase.descripcion && (
                    <span className="fases-tabla-descripcion" title={fase.descripcion}>
                      {fase.descripcion}
                    </span>
                  )}
                  {enCurso && diasEnCurso !== null && (
                    <span className="fases-tabla-subtexto">En curso hace {diasEnCurso} días</span>
                  )}
                </span>

                <span
                  className="badge fases-tabla-estado"
                  style={{
                    backgroundColor: `${estadoInfo.color}${TINTE_PASTILLA}`,
                    color: estadoInfo.color,
                  }}
                >
                  {estadoInfo.label}
                </span>

                <span className="fases-tabla-col--num">
                  {sinDatos || gastado === 0 ? "—" : formatMoneda(gastado)}
                </span>

                <span className="fases-tabla-col--pct">
                  <BarraProgreso porcentaje={pct} color={pct > 100 ? ROJO : NARANJA} />
                  <span className="fases-tabla-pct-valor">
                    {sinDatos || gastado === 0 ? "—" : `${pct.toFixed(1)}%`}
                  </span>
                </span>

                <span className="fases-tabla-col--accion">
                  {canManage && (
                    <span className="fases-tabla-acciones">
                      <span className="fases-tabla-orden-btns">
                        <button
                          type="button"
                          className="fases-tabla-orden-btn"
                          onClick={(e) => handleMoverFase(e, fase, "arriba")}
                          disabled={i === 0}
                          title="Subir fase"
                        >
                          <ChevronUp size={12} strokeWidth={2.5} />
                        </button>
                        <button
                          type="button"
                          className="fases-tabla-orden-btn"
                          onClick={(e) => handleMoverFase(e, fase, "abajo")}
                          disabled={i === fases.length - 1}
                          title="Bajar fase"
                        >
                          <ChevronDown size={12} strokeWidth={2.5} />
                        </button>
                      </span>
                      <button
                        type="button"
                        className="btn-icono btn-icono--sm btn-icono--contorno"
                        onClick={(e) => handleEditarFase(e, fase)}
                        title="Editar fase"
                      >
                        <Pencil size={13} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        className="btn-icono btn-icono--sm btn-icono--contorno btn-icono--peligro"
                        onClick={(e) => handleSolicitarEliminarFase(e, fase)}
                        title="Eliminar fase"
                      >
                        <Trash2 size={13} strokeWidth={2} />
                      </button>
                    </span>
                  )}
                  <ChevronRight
                    size={18}
                    strokeWidth={2}
                    className="fases-tabla-chevron"
                    aria-hidden="true"
                  />
                </span>
              </div>
            );
          })}

          <div className="fases-tabla-total">
            <span />
            <span>
              TOTAL {fases.length} {fases.length === 1 ? "FASE" : "FASES"}
            </span>
            <span />
            <span className="fases-tabla-col--num">
              {gastadoPorFase ? formatMoneda(gastadoPorFase.totales.egresos) : "—"}
            </span>
            <span className="fases-tabla-total-pct">
              {gastadoPorFase
                ? `${gastadoPorFase.totales.pctGastado.toFixed(0)}% del presupuesto`
                : "—"}
            </span>
            <span />
          </div>
        </div>
      )}

      {modalAbierto && (
        <ModalFase
          fase={faseEditando}
          onGuardar={handleGuardarFase}
          onCerrar={() => setModalAbierto(false)}
        />
      )}

      {faseAEliminar && (
        <ModalConfirmar
          titulo="Eliminar fase"
          mensaje="Esta acción no se puede deshacer."
          nombreRecurso={faseAEliminar.nombre}
          onConfirmar={handleConfirmarEliminarFase}
          onCancelar={() => setFaseAEliminar(null)}
        />
      )}
    </div>
  );
}

export default Fases;
