import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";

import useAuth from "../../context/useAuth";
import { useToast } from "../../context/useToast";
import { obtenerMensajeError } from "../../utils/errorHandling";
import { getTipoProducto } from "../../constants/tipoProducto";

import ModalCatalogoSimple from "../modals/ModalCatalogoSimple";
import ModalCategoria from "../modals/ModalCategoria";
import ModalConfirmar from "../modals/ModalConfirmar";
import { Cargando } from "../shared/Cargando";
import { EstadoVacio } from "../shared/EstadoVacio";
import { EstadoError } from "../shared/EstadoError";

import "./SeccionCatalogo.css";

/**
 * Una pestaña de la pantalla de catálogos (ver pages/Catalogos.jsx): la lista
 * de un catálogo con su alta, edición y borrado. Las tres pestañas son la
 * misma pantalla con otro recurso atrás, así que comparten este componente y
 * lo que cambia entra por props.
 *
 * `conTipo`: la categoría de producto lleva además el tipo (equipo /
 * materiales / mano de obra), que se muestra como badge y se edita con
 * ModalCategoria en vez de ModalCatalogoSimple.
 *
 * `keysAlEditar`: queries que embeben el *nombre* del registro (el gasto trae
 * sus categorías, la compra sus impuestos aplicados) y quedan viejas al
 * renombrarlo. Alta y borrado no las afectan: un registro recién creado no
 * está en uso, y uno en uso no se puede borrar.
 */
export function SeccionCatalogo({
  query,
  queryKey,
  keysAlEditar = [],
  textos,
  // El ícono de la pestaña: el botón de alta lleva el de lo que crea.
  icono: Icono = Plus,
  conTipo = false,
  // false: se respeta el orden en que llegan del backend (las fases
  // predeterminadas van en el orden de la obra, no alfabético).
  ordenAlfabetico = true,
  crear,
  actualizar,
  eliminar,
}) {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === "admin";
  const toast = useToast();
  const queryClient = useQueryClient();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [registroEditando, setRegistroEditando] = useState(null);
  const [registroAEliminar, setRegistroAEliminar] = useState(null);

  const registros = [...(query.data ?? [])];
  if (ordenAlfabetico) registros.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  const invalidar = (keys) =>
    Promise.all(keys.map((key) => queryClient.invalidateQueries({ queryKey: key })));

  const abrirAlta = () => {
    setRegistroEditando(null);
    setModalAbierto(true);
  };

  const abrirEdicion = (registro) => {
    setRegistroEditando(registro);
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setRegistroEditando(null);
  };

  const handleGuardar = async (datos) => {
    try {
      if (registroEditando) {
        await actualizar(registroEditando.id, datos);
        await invalidar([queryKey, ...keysAlEditar]);
      } else {
        await crear(datos);
        await invalidar([queryKey]);
      }
      toast.success(registroEditando ? "Cambios guardados." : textos.creado);
      cerrarModal();
    } catch (err) {
      console.error(`Error guardando ${textos.singular}:`, err);
      toast.error(obtenerMensajeError(err));
    }
  };

  const handleConfirmarEliminar = async () => {
    const registro = registroAEliminar;
    setRegistroAEliminar(null);
    try {
      await eliminar(registro.id);
      await invalidar([queryKey]);
      toast.success(`Se eliminó "${registro.nombre}".`);
    } catch (err) {
      console.error(`Error eliminando ${textos.singular}:`, err);
      // El backend explica el motivo (ej. "tiene gastos asociados"): tiene que
      // llegar tal cual, no un "no se pudo eliminar" genérico.
      toast.error(obtenerMensajeError(err));
    }
  };

  const claseTabla = [
    "planilla",
    "seccion-catalogo__tabla",
    conTipo && "seccion-catalogo__tabla--con-tipo",
    esAdmin && "seccion-catalogo__tabla--con-acciones",
  ]
    .filter(Boolean)
    .join(" ");

  let contenido;
  if (query.isLoading) {
    contenido = <Cargando texto={textos.cargando} compacto />;
  } else if (query.isError) {
    contenido = <EstadoError mensaje={textos.error} />;
  } else if (registros.length === 0) {
    contenido = <EstadoVacio mensaje={textos.vacio} />;
  } else {
    contenido = (
      <div className={claseTabla}>
        <div className="planilla__header">
          <span>Nombre</span>
          {conTipo && <span>Tipo</span>}
          {esAdmin && <span />}
        </div>

        {registros.map((registro) => {
          const tipo = conTipo ? getTipoProducto(registro.tipo) : null;
          return (
            <div key={registro.id} className="planilla__fila">
              <span className="seccion-catalogo__nombre">{registro.nombre}</span>

              {tipo && (
                <span className="seccion-catalogo__tipo">
                  {tipo.icono && <tipo.icono size={14} strokeWidth={1.75} aria-hidden="true" />}
                  {tipo.label}
                </span>
              )}

              {esAdmin && (
                <span className="acciones seccion-catalogo__col-acciones">
                  <button
                    type="button"
                    className="btn-icono btn-icono--sm"
                    onClick={() => abrirEdicion(registro)}
                    aria-label={`Editar ${registro.nombre}`}
                    title="Editar"
                  >
                    <Pencil aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="btn-icono btn-icono--sm btn-icono--peligro"
                    onClick={() => setRegistroAEliminar(registro)}
                    aria-label={`Eliminar ${registro.nombre}`}
                    title="Eliminar"
                  >
                    <Trash2 aria-hidden="true" />
                  </button>
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <section className="seccion-catalogo">
      <div className="seccion-catalogo__barra">
        <p className="seccion-catalogo__descripcion">{textos.descripcion}</p>
        {esAdmin && (
          <button type="button" className="btn btn-primary" onClick={abrirAlta}>
            <Icono aria-hidden="true" />
            {textos.nuevo}
          </button>
        )}
      </div>

      {contenido}

      {modalAbierto &&
        (conTipo ? (
          <ModalCategoria
            categoria={registroEditando}
            onGuardar={handleGuardar}
            onCerrar={cerrarModal}
          />
        ) : (
          <ModalCatalogoSimple
            titulo={registroEditando ? textos.tituloEditar : textos.tituloNuevo}
            registro={registroEditando}
            onGuardar={handleGuardar}
            onCerrar={cerrarModal}
          />
        ))}

      {registroAEliminar && (
        <ModalConfirmar
          titulo={textos.tituloEliminar}
          mensaje="Esta acción no se puede deshacer."
          nombreRecurso={registroAEliminar.nombre}
          onConfirmar={handleConfirmarEliminar}
          onCancelar={() => setRegistroAEliminar(null)}
        />
      )}
    </section>
  );
}

export default SeccionCatalogo;
