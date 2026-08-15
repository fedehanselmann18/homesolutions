import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, ChevronRight } from "lucide-react";
import { crearFase, actualizarFase, eliminarFase } from "../../services/faseService";
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
import { VERDE, NARANJA, ROJO } from "../../constants/colores";
import { calcularAnalisis } from "../../utils/analisis";
import { diasDesde } from "../../utils/seguimiento";
import { formatMoneda } from "../../utils/formato";
import { obtenerDetalleBackend } from "../../utils/errorHandling";

function colorFase(estado) {
  if (estado === "terminada" || estado === "auditada") return VERDE;
  if (estado === "en_curso") return NARANJA;
  return "#e4e4e7"; // --color-linea, plano porque el borde va por style inline
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

  const precioAcordado = Number(proyectoQuery.data?.precio_acordado ?? 0);

  return (
    <div>
      <div className="fases-header">
        <h2>Fases del Proyecto</h2>
        {canManage && <button onClick={handleNuevaFase}>Nueva fase</button>}
      </div>

      {fases.length === 0 ? (
        <p>No hay fases disponibles para este proyecto.</p>
      ) : (
        <div className="fases-tabla">
          <div className="fases-tabla-header">
            <span className="label-ficha">#</span>
            <span className="label-ficha">Fase</span>
            <span className="label-ficha">Estado</span>
            <span className="label-ficha fases-tabla-col--num">Gastado</span>
            <span className="label-ficha">% del presupuesto</span>
            <span />
          </div>

          {fases.map((fase, i) => {
            const estadoInfo = ESTADO_LABELS[fase.estado] ?? { color: "#6b7280", label: fase.estado };
            const gastado = gastadoPorFase?.porFase.get(fase.id) ?? 0;
            const pct = precioAcordado > 0 ? (gastado / precioAcordado) * 100 : 0;
            const enCurso = fase.estado === "en_curso";
            const sinDatos = !gastadoPorFase;

            return (
              <div
                key={fase.id}
                className="fases-tabla-fila"
                style={{ boxShadow: `inset 3px 0 0 ${colorFase(fase.estado)}` }}
                onClick={() => navigate(`/proyectos/${proyectoId}/fases/${fase.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) =>
                  (e.key === "Enter" || e.key === " ") &&
                  navigate(`/proyectos/${proyectoId}/fases/${fase.id}`)
                }
              >
                <span className="fases-tabla-num">{String(i + 1).padStart(2, "0")}</span>

                <span className="fases-tabla-col--fase">
                  <span
                    className={
                      fase.estado === "por_empezar" ? "fases-tabla-nombre fases-tabla-nombre--pendiente" : "fases-tabla-nombre"
                    }
                  >
                    {fase.nombre}
                  </span>
                  {enCurso && (
                    <span className="fases-tabla-subtexto">
                      En curso hace {diasDesde(fase.fecha_actualizacion, new Date())} días
                    </span>
                  )}
                </span>

                <span
                  className="fases-tabla-estado"
                  style={{ backgroundColor: `${estadoInfo.color}1c`, color: estadoInfo.color }}
                >
                  {estadoInfo.label}
                </span>

                <span className="fases-tabla-col--num">{sinDatos || gastado === 0 ? "—" : formatMoneda(gastado)}</span>

                <span className="fases-tabla-col--pct">
                  <BarraProgreso porcentaje={pct} color={pct > 100 ? ROJO : NARANJA} />
                  <span className="fases-tabla-pct-valor">
                    {sinDatos || gastado === 0 ? "—" : `${pct.toFixed(1)}%`}
                  </span>
                </span>

                <span className="fases-tabla-col--accion">
                  {canManage && (
                    <span className="fases-tabla-acciones">
                      <button
                        type="button"
                        className="fases-tabla-accion-btn"
                        onClick={(e) => handleEditarFase(e, fase)}
                        title="Editar fase"
                      >
                        <Pencil size={13} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        className="fases-tabla-accion-btn fases-tabla-accion-btn--eliminar"
                        onClick={(e) => handleSolicitarEliminarFase(e, fase)}
                        title="Eliminar fase"
                      >
                        <Trash2 size={13} strokeWidth={2} />
                      </button>
                    </span>
                  )}
                  <ChevronRight size={18} strokeWidth={2} className="fases-tabla-chevron" aria-hidden="true" />
                </span>
              </div>
            );
          })}

          <div className="fases-tabla-total">
            <span />
            <span>TOTAL {fases.length} {fases.length === 1 ? "FASE" : "FASES"}</span>
            <span />
            <span className="fases-tabla-col--num">
              {gastadoPorFase ? formatMoneda(gastadoPorFase.totales.egresos) : "—"}
            </span>
            <span className="fases-tabla-total-pct">
              {gastadoPorFase ? `${gastadoPorFase.totales.pctGastado.toFixed(0)}% del presupuesto` : "—"}
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
