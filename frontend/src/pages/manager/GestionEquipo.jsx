import { useCallback, useEffect, useState } from "react";
import { Users } from "lucide-react";

import {
  cambiarRolUsuario,
  cerrarSesionUsuario,
  desactivarUsuario,
  getUsuarios,
  reactivarUsuario,
  resetearPasswordUsuario,
} from "../../services/usuarioService";
import { NOMBRE_USUARIO_MANAGER } from "../../constants/manager";
import { obtenerMensajeError } from "../../utils/errorHandling";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useToast } from "../../context/useToast";
import { Cargando } from "../../components/shared/Cargando";
import { PageHeader } from "../../components/shared/PageHeader";
import ModalConfirmar from "../../components/modals/ModalConfirmar";
import ListaUsuarios from "../../components/manager/ListaUsuarios";
import ModalResetearPassword from "../../components/manager/ModalResetearPassword";
import "./GestionManager.css";

/**
 * Página de Manager: planilla de cuentas ya creadas -- resetear contraseña,
 * cambiar rol, cerrar sesión, desactivar/reactivar. Todas estas acciones son
 * exclusivas de "Manager" en el backend (requiere_manager), no de
 * rol == "admin".
 */
export function GestionEquipo() {
  usePageTitle("Equipo");
  const toast = useToast();

  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [guardando, setGuardando] = useState(false);

  // Acción pendiente de confirmación (cambiar rol / cerrar sesión /
  // desactivar / reactivar). Todas tocan a otra persona y no se deshacen
  // solas, así que ninguna se dispara con un click suelto.
  const [confirmacion, setConfirmacion] = useState(null);
  const [usuarioAResetear, setUsuarioAResetear] = useState(null);

  const cargarDatos = useCallback(async () => {
    try {
      const listaUsuarios = await getUsuarios();
      // La propia cuenta "Manager" queda fuera de la planilla: el backend
      // rechaza toda acción sobre uno mismo (guard de auto-acción), así que
      // mostrarla sería ofrecer botones que siempre fallan.
      setUsuarios(listaUsuarios.filter((u) => u.nombre_usuario !== NOMBRE_USUARIO_MANAGER));
      setErrorCarga(null);
    } catch (err) {
      setErrorCarga(obtenerMensajeError(err));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Envoltorio común: ejecuta la acción, avisa por toast y recarga la lista
  // (el estado que devuelve cada endpoint es de un solo usuario).
  const ejecutar = async (accion, mensajeExito) => {
    try {
      setGuardando(true);
      await accion();
      await cargarDatos();
      toast.success(mensajeExito);
      return true;
    } catch (err) {
      toast.error(obtenerMensajeError(err));
      return false;
    } finally {
      setGuardando(false);
    }
  };

  const handleResetear = async (password) => {
    const usuario = usuarioAResetear;
    const ok = await ejecutar(
      () => resetearPasswordUsuario(usuario.id, password),
      `Contraseña de ${usuario.nombre_usuario} cambiada. Su sesión anterior quedó cerrada.`
    );
    if (ok) setUsuarioAResetear(null);
  };

  const pedirCambioDeRol = (usuario) => {
    const rolNuevo = usuario.rol === "admin" ? "lectura" : "admin";
    setConfirmacion({
      titulo: "Cambiar rol",
      mensaje:
        rolNuevo === "admin"
          ? `${usuario.nombre_usuario} va a poder crear, editar y borrar datos en toda la app.`
          : `${usuario.nombre_usuario} va a pasar a solo lectura: no va a poder crear ni editar nada.`,
      nombreRecurso: `${usuario.nombre_usuario}: ${usuario.rol} → ${rolNuevo}`,
      textoConfirmar: "Cambiar rol",
      accion: () =>
        ejecutar(
          () => cambiarRolUsuario(usuario.id, rolNuevo),
          `${usuario.nombre_usuario} ahora es ${rolNuevo}.`
        ),
    });
  };

  const pedirCierreDeSesion = (usuario) => {
    setConfirmacion({
      titulo: "Cerrar sesión",
      mensaje: `${usuario.nombre_usuario} va a tener que volver a entrar. La contraseña no cambia: entra con la misma.`,
      nombreRecurso: usuario.nombre_usuario,
      textoConfirmar: "Cerrar sesión",
      accion: () =>
        ejecutar(
          () => cerrarSesionUsuario(usuario.id),
          `Sesión de ${usuario.nombre_usuario} cerrada.`
        ),
    });
  };

  const pedirToggleActivo = (usuario) => {
    if (usuario.activo) {
      setConfirmacion({
        titulo: "Desactivar cuenta",
        mensaje: `${usuario.nombre_usuario} no va a poder entrar, y si tiene una sesión abierta se corta ahora. La cuenta y su historial quedan intactos.`,
        nombreRecurso: usuario.nombre_usuario,
        textoConfirmar: "Desactivar",
        accion: () =>
          ejecutar(
            () => desactivarUsuario(usuario.id),
            `Cuenta de ${usuario.nombre_usuario} desactivada.`
          ),
      });
      return;
    }

    setConfirmacion({
      titulo: "Reactivar cuenta",
      mensaje: `${usuario.nombre_usuario} vuelve a poder entrar con su contraseña de siempre.`,
      nombreRecurso: usuario.nombre_usuario,
      textoConfirmar: "Reactivar",
      accion: () =>
        ejecutar(
          () => reactivarUsuario(usuario.id),
          `Cuenta de ${usuario.nombre_usuario} reactivada.`
        ),
    });
  };

  const confirmarAccion = async () => {
    const pendiente = confirmacion;
    setConfirmacion(null);
    await pendiente.accion();
  };

  return (
    <div className="manager-pagina">
      <PageHeader
        icono={<Users size={20} strokeWidth={2} />}
        titulo="Equipo"
        subtitulo="Contraseñas, roles y sesiones de las cuentas ya creadas. Solo lo ve esta cuenta."
      />

      {cargando ? (
        <Cargando texto="Cargando cuentas..." />
      ) : errorCarga ? (
        <p className="manager-pagina__error">{errorCarga}</p>
      ) : (
        <div className="manager-pagina__tarjeta">
          <p className="manager-pagina__ayuda">
            Desactivar corta el acceso sin borrar nada; cerrar sesión solo obliga a volver a entrar.
          </p>
          <ListaUsuarios
            usuarios={usuarios}
            onResetear={setUsuarioAResetear}
            onCambiarRol={pedirCambioDeRol}
            onCerrarSesion={pedirCierreDeSesion}
            onToggleActivo={pedirToggleActivo}
          />
        </div>
      )}

      {usuarioAResetear && (
        <ModalResetearPassword
          usuario={usuarioAResetear}
          guardando={guardando}
          onConfirmar={handleResetear}
          onCerrar={() => setUsuarioAResetear(null)}
        />
      )}

      {confirmacion && (
        <ModalConfirmar
          titulo={confirmacion.titulo}
          mensaje={confirmacion.mensaje}
          nombreRecurso={confirmacion.nombreRecurso}
          textoConfirmar={confirmacion.textoConfirmar}
          onConfirmar={confirmarAccion}
          onCancelar={() => setConfirmacion(null)}
        />
      )}
    </div>
  );
}

export default GestionEquipo;
