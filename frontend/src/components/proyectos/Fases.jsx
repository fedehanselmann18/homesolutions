import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronRight, ChevronUp, Layers, Pencil, Trash2 } from "lucide-react";
import { crearFase, actualizarFase, eliminarFase, moverFase } from "../../services/faseService";
import {
  useProyecto,
  useFasesPorProyecto,
  useGastosPorProyecto,
  useComprasPorProyecto,
} from "../../hooks/queries";
import ModalFase from "../modals/ModalFase";
import ModalConfirmar from "../modals/ModalConfirmar";
import "./Fases.css";
import useAuth from "../../context/useAuth";
import { useToast } from "../../context/useToast";
import { getEstadoLabel } from "../../constants/estados";
import { EstadoVacio } from "../shared/EstadoVacio";
import { calcularAnalisis } from "../../utils/analisis";
import { diasDesde } from "../../utils/seguimiento";
import { etapaDeFase } from "../../utils/fases";
import { formatMoneda, formatNumero, pluralizar } from "../../utils/formato";
import { obtenerDetalleBackend } from "../../utils/errorHandling";

// Variante 4b ("Línea de tiempo"): cada fase es un punto de una línea vertical
// y una tarjeta. El punto dice dónde está la obra (etapaDeFase: cerrada /
// actual / por venir) y va en el oliva de la marca; el ESTADO de la fase sigue
// siendo el badge del semáforo (estados.js), el mismo que el header del
// proyecto. Son dos cosas distintas y no comparten color (DESIGN.md §2).
function EstadoFase({ estado }) {
  const info = getEstadoLabel(estado);
  const Icono = info.icono;
  return (
    <span className="badge badge--sm" style={{ color: info.fg, backgroundColor: info.bg }}>
      {Icono && <Icono size={12} strokeWidth={2} aria-hidden="true" />}
      {info.label}
    </span>
  );
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
      // En dólares, como el precio acordado contra el que se compara cada fase.
      moneda: "usd",
    });
    const porFase = new Map(analisis.egresosPorFase.map((f) => [f.faseId, f.total]));
    return { porFase, totales: analisis.totales };
  }, [proyectoQuery.data, fasesQuery.data, gastosQuery.data, comprasQuery.data]);

  const precioAcordado = Number(proyectoQuery.data?.precio_acordado_usd ?? 0);
  const pctDe = (monto) => (precioAcordado > 0 ? (monto / precioAcordado) * 100 : 0);
  const irAFase = (fase) => navigate(`/proyectos/${proyectoId}/fases/${fase.id}`);

  const totalGastado = gastadoPorFase?.totales.egresos ?? 0;
  const gastadoSinFase = gastadoPorFase?.porFase.get(null) ?? 0;
  const excedido = pctDe(totalGastado) > 100;

  return (
    <div className="fases">
      <div className="fases__barra">
        {fases.length > 0 && (
          <div className="fases__presupuesto">
            <span className="fases__presupuesto-label">Presupuesto usado</span>
            {/* Un tramo por fase con gasto, en el orden de la obra: la barra
                total se lee como la suma de las fases de abajo. */}
            <div
              className="fases__presupuesto-barra"
              role="img"
              aria-label={`${formatNumero(pctDe(totalGastado), 1)}% del presupuesto usado`}
            >
              {gastadoPorFase &&
                fases.map((fase) => {
                  const gastado = gastadoPorFase.porFase.get(fase.id) ?? 0;
                  if (gastado <= 0) return null;
                  return (
                    <span
                      key={fase.id}
                      className={`fases__tramo fases__tramo--${excedido ? "excedido" : etapaDeFase(fase.estado)}`}
                      style={{ width: `${Math.min(pctDe(gastado), 100)}%` }}
                      title={`${fase.nombre}: ${formatMoneda(gastado, "usd")}`}
                    />
                  );
                })}
              {/* Los gastos sin fase también cuentan en el total de al lado:
                  sin su tramo la barra no sumaría lo que dice el número. */}
              {gastadoSinFase > 0 && (
                <span
                  className={`fases__tramo fases__tramo--${excedido ? "excedido" : "sin-fase"}`}
                  style={{ width: `${Math.min(pctDe(gastadoSinFase), 100)}%` }}
                  title={`Sin fase: ${formatMoneda(gastadoSinFase, "usd")}`}
                />
              )}
            </div>
            <span className="fases__presupuesto-valor">
              {gastadoPorFase
                ? `${formatMoneda(totalGastado, "usd")} / ${formatNumero(precioAcordado)}`
                : "—"}
            </span>
          </div>
        )}
        {canManage && (
          <button type="button" className="btn btn-primary" onClick={handleNuevaFase}>
            <Layers aria-hidden="true" />
            Nueva fase
          </button>
        )}
      </div>

      {fases.length === 0 ? (
        <EstadoVacio mensaje="No hay fases disponibles para este proyecto." />
      ) : (
        <ol className="fases__linea" aria-label={pluralizar(fases.length, "fase")}>
          {fases.map((fase, i) => {
            const etapa = etapaDeFase(fase.estado);
            const gastado = gastadoPorFase?.porFase.get(fase.id) ?? 0;
            const pct = pctDe(gastado);
            const sinGasto = !gastadoPorFase || gastado === 0;
            // fecha_en_curso_desde (no fecha_actualizacion): ese campo se
            // pisa con cualquier edición de la fase, no solo al entrar en
            // curso -- ver comentario en el modelo Fase (backend).
            const diasEnCurso =
              fase.estado === "en_curso" && fase.fecha_en_curso_desde
                ? diasDesde(fase.fecha_en_curso_desde, new Date())
                : null;
            const subtitulo = [
              fase.descripcion,
              diasEnCurso !== null && `En curso hace ${pluralizar(diasEnCurso, "día")}`,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <li key={fase.id} className={`fases__item fases__item--${etapa}`}>
                <div className="fases__riel" aria-hidden="true">
                  <span className="fases__punto">
                    {etapa === "cerrada" ? <Check size={14} strokeWidth={2.6} /> : i + 1}
                  </span>
                  <span className="fases__tramo-linea" />
                </div>

                <div
                  className="fases__card fila-con-acciones"
                  role="link"
                  tabIndex={0}
                  onClick={() => irAFase(fase)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && irAFase(fase)}
                >
                  <div className="fases__texto">
                    <span className="fases__nombre">
                      {fase.nombre}
                      <EstadoFase estado={fase.estado} />
                    </span>
                    {subtitulo && (
                      <span className="fases__descripcion" title={subtitulo}>
                        {subtitulo}
                      </span>
                    )}
                  </div>

                  <div className="fases__gastado">
                    <span className="fases__gastado-monto">
                      {sinGasto ? "—" : formatMoneda(gastado, "usd")}
                    </span>
                    <span className="fases__gastado-label">gastado</span>
                  </div>

                  <div className="fases__avance">
                    <div className="fases__avance-barra">
                      <span
                        className={pct > 100 ? "fases__avance-relleno--excedido" : undefined}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <span className="fases__avance-pct">
                      {sinGasto ? "—" : `${formatNumero(pct, 1)}%`}
                    </span>
                  </div>

                  <div className="fases__fin">
                    {canManage && (
                      <span className="acciones">
                        <button
                          type="button"
                          className="btn-icono btn-icono--sm"
                          onClick={(e) => handleMoverFase(e, fase, "arriba")}
                          disabled={i === 0}
                          aria-label={`Subir ${fase.nombre}`}
                          title="Subir fase"
                        >
                          <ChevronUp />
                        </button>
                        <button
                          type="button"
                          className="btn-icono btn-icono--sm"
                          onClick={(e) => handleMoverFase(e, fase, "abajo")}
                          disabled={i === fases.length - 1}
                          aria-label={`Bajar ${fase.nombre}`}
                          title="Bajar fase"
                        >
                          <ChevronDown />
                        </button>
                        <button
                          type="button"
                          className="btn-icono btn-icono--sm"
                          onClick={(e) => handleEditarFase(e, fase)}
                          aria-label={`Editar ${fase.nombre}`}
                          title="Editar fase"
                        >
                          <Pencil />
                        </button>
                        <button
                          type="button"
                          className="btn-icono btn-icono--sm btn-icono--peligro"
                          onClick={(e) => handleSolicitarEliminarFase(e, fase)}
                          aria-label={`Eliminar ${fase.nombre}`}
                          title="Eliminar fase"
                        >
                          <Trash2 />
                        </button>
                      </span>
                    )}
                    <ChevronRight size={18} className="fases__chevron" aria-hidden="true" />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {modalAbierto && (
        <ModalFase
          fase={faseEditando}
          contexto={
            proyectoQuery.data &&
            `Fase ${
              faseEditando ? fases.findIndex((f) => f.id === faseEditando.id) + 1 : fases.length + 1
            } de ${proyectoQuery.data.nombre}`
          }
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
