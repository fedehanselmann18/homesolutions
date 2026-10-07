import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DollarSign, Pencil, Trash2 } from "lucide-react";

import useAuth from "../../context/useAuth";
import { useToast } from "../../context/useToast";
import { useCotizaciones } from "../../hooks/queries";
import { queryKeys } from "../../lib/queryKeys";
import {
  crearCotizacion,
  actualizarCotizacion,
  eliminarCotizacion,
} from "../../services/cotizacionService";
import { obtenerMensajeError } from "../../utils/errorHandling";
import { formatCotizacion, formatFecha } from "../../utils/formato";
import { getTipoCambioLabel } from "../../utils/moneda";

import ModalCotizacion from "../modals/ModalCotizacion";
import ModalConfirmar from "../modals/ModalConfirmar";
import { Cargando } from "../shared/Cargando";
import { EstadoVacio } from "../shared/EstadoVacio";
import { EstadoError } from "../shared/EstadoError";

import "./SeccionCatalogo.css";
import "./SeccionCotizaciones.css";

/**
 * Pestaña "Cotizaciones" de la pantalla de catálogos: el dólar de cada día,
 * que los forms de carga sugieren solos (ver useCotizacionDia). Mismo molde
 * que SeccionCatalogo (barra, planilla, alta/edición/borrado) pero con sus
 * columnas propias: una cotización no es un nombre.
 *
 * Editar o borrar una fila no toca nada ya cargado: cada compra, gasto o
 * cobro guarda su propia cotización congelada (docs/PLAN_TIPO_CAMBIO.md). Por
 * eso acá no hay "en uso" que frene un borrado.
 */
export function SeccionCotizaciones() {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === "admin";
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useCotizaciones();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [aEliminar, setAEliminar] = useState(null);

  // El backend ya las manda de la más nueva a la más vieja.
  const cotizaciones = query.data ?? [];

  // `all` es prefijo de las "última a tal fecha" (ver queryKeys): invalida
  // también las sugerencias que tengan abiertas los forms.
  const invalidar = () => queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });

  const cerrarModal = () => {
    setModalAbierto(false);
    setEditando(null);
  };

  const handleGuardar = async (datos) => {
    try {
      if (editando) {
        await actualizarCotizacion(editando.id, datos);
      } else {
        await crearCotizacion(datos);
      }
      await invalidar();
      toast.success(editando ? "Cambios guardados." : "Cotización cargada.");
      cerrarModal();
    } catch (err) {
      console.error("Error guardando la cotización:", err);
      toast.error(obtenerMensajeError(err));
    }
  };

  const handleConfirmarEliminar = async () => {
    const cotizacion = aEliminar;
    setAEliminar(null);
    try {
      await eliminarCotizacion(cotizacion.id);
      await invalidar();
      toast.success("Cotización eliminada.");
    } catch (err) {
      console.error("Error eliminando la cotización:", err);
      toast.error(obtenerMensajeError(err));
    }
  };

  const describir = (c) =>
    `${getTipoCambioLabel(c.tipo)} del ${formatFecha(c.fecha)} (${formatCotizacion(c.valor)})`;

  let contenido;
  if (query.isLoading) {
    contenido = <Cargando texto="Cargando cotizaciones..." compacto />;
  } else if (query.isError) {
    contenido = <EstadoError mensaje="No se pudieron cargar las cotizaciones." />;
  } else if (cotizaciones.length === 0) {
    contenido = (
      <EstadoVacio mensaje="Todavía no hay cotizaciones cargadas. Sin ellas, el dólar se tipea a mano en cada carga." />
    );
  } else {
    contenido = (
      <div
        className={`planilla seccion-cotizaciones__tabla${
          esAdmin ? " seccion-cotizaciones__tabla--con-acciones" : ""
        }`}
      >
        <div className="planilla__header">
          <span>Fecha</span>
          <span>Dólar</span>
          <span className="seccion-cotizaciones__col-valor">$ por US$</span>
          {esAdmin && <span />}
        </div>

        {cotizaciones.map((c) => (
          <div key={c.id} className="planilla__fila">
            <span className="seccion-catalogo__nombre">{formatFecha(c.fecha)}</span>
            <span>{getTipoCambioLabel(c.tipo)}</span>
            <span className="seccion-cotizaciones__col-valor cifra">
              {formatCotizacion(c.valor)}
            </span>
            {esAdmin && (
              <span className="acciones seccion-catalogo__col-acciones">
                <button
                  type="button"
                  className="btn-icono btn-icono--sm"
                  onClick={() => {
                    setEditando(c);
                    setModalAbierto(true);
                  }}
                  aria-label={`Editar ${describir(c)}`}
                  title="Editar"
                >
                  <Pencil aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="btn-icono btn-icono--sm btn-icono--peligro"
                  onClick={() => setAEliminar(c)}
                  aria-label={`Eliminar ${describir(c)}`}
                  title="Eliminar"
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <section className="seccion-catalogo">
      <div className="seccion-catalogo__barra">
        <p className="seccion-catalogo__descripcion">
          El dólar de cada día. Se sugiere solo al cargar compras, gastos y cobros; cambiarlo acá no
          modifica lo que ya está cargado.
        </p>
        {esAdmin && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditando(null);
              setModalAbierto(true);
            }}
          >
            <DollarSign aria-hidden="true" />
            Nueva cotización
          </button>
        )}
      </div>

      {contenido}

      {modalAbierto && (
        <ModalCotizacion cotizacion={editando} onGuardar={handleGuardar} onCerrar={cerrarModal} />
      )}

      {aEliminar && (
        <ModalConfirmar
          titulo="Eliminar cotización"
          mensaje="Lo ya cargado con esta cotización no cambia: cada movimiento guarda la suya."
          nombreRecurso={describir(aEliminar)}
          onConfirmar={handleConfirmarEliminar}
          onCancelar={() => setAEliminar(null)}
        />
      )}
    </section>
  );
}

export default SeccionCotizaciones;
