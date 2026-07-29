import { useState } from "react";
import { useProyectos } from "../hooks/useProyectos";
import ProyectoCard from "../components/proyectos/ProyectoCard";
import ModalProyecto from "../components/modals/ModalProyecto";
import useAuth from "../context/useAuth";
import ProyectosHeader from "../components/proyectos/ProyectoHeader";
import { Cargando } from "../components/shared/Cargando";
import { useToast } from "../context/useToast";
import { ESTADOS } from "../constants/estados";
import "./Proyectos.css";

// Orden fijo pedido: en curso primero, después a iniciar, después terminados.
const ORDEN_SECCIONES = ["en_curso", "a_iniciar", "terminado"];

export function Proyectos() {
  const { usuario } = useAuth();
  const toast = useToast();

  const {
    proyectos,
    loading,
    error,
    agregarProyecto,
    editarProyecto,
    borrarProyecto,
  } = useProyectos();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState(null);

  if (loading) {
    return <Cargando texto="Cargando proyectos..." />;
  }

  if (error) {
    return <p>Error al cargar los proyectos.</p>;
  }

  const abrirModalCrear = () => {
    setProyectoSeleccionado(null);
    setModalAbierto(true);
  };

  const abrirModalEditar = (proyecto) => {
    setProyectoSeleccionado(proyecto);
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setProyectoSeleccionado(null);
  };

  const handleGuardar = async (datosProyecto) => {
    try {
      if (proyectoSeleccionado) {
        await editarProyecto(proyectoSeleccionado.id, datosProyecto);
      } else {
        await agregarProyecto(datosProyecto);
      }
      cerrarModal();
    } catch (error) {
      console.error("Error guardando proyecto:", error);
      toast.error("No se pudo guardar el proyecto.");
    }
  };

  const handleEliminar = async (proyecto) => {
    try {
      await borrarProyecto(proyecto.id);
    } catch (error) {
      console.error("Error eliminando proyecto:", error);
      toast.error("No se pudo eliminar el proyecto.");
    }
  };

  const canManage = usuario.rol === "admin";

  return (
    <div className="proyectos-container">
      <ProyectosHeader
        canManage={canManage}
        onCrearProyecto={abrirModalCrear}
        cantidad={proyectos.length}
      />

      {proyectos.length === 0 ? (
        <p className="proyectos-feedback">
          No hay proyectos todavía. ¡Creá el primero!
        </p>
      ) : (
        ORDEN_SECCIONES.map((estadoKey) => {
          const proyectosDelEstado = proyectos.filter((p) => p.estado === estadoKey);
          if (proyectosDelEstado.length === 0) return null;
          const estado = ESTADOS[estadoKey];

          return (
            <section key={estadoKey} className="proyectos-seccion" aria-label={estado.label}>
              <h2 className="proyectos-seccion-titulo">
                <span className="proyectos-seccion-punto" style={{ backgroundColor: estado.color }} />
                {estado.label}
                <span className="proyectos-seccion-contador">{proyectosDelEstado.length}</span>
              </h2>
              <div className="proyectos-grid">
                {proyectosDelEstado.map((proyecto) => (
                  <ProyectoCard
                    key={proyecto.id}
                    proyecto={proyecto}
                    onEditar={abrirModalEditar}
                    onEliminar={handleEliminar}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}

      {modalAbierto && (
        <ModalProyecto
          proyecto={proyectoSeleccionado}
          onGuardar={handleGuardar}
          onCerrar={cerrarModal}
        />
      )}
    </div>
  );
}

export default Proyectos;