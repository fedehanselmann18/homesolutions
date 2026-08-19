import { useCallback, useEffect, useState } from "react";
import { UserCog } from "lucide-react";

import {
  autorizarUsuario,
  cambiarRolUsuario,
  cerrarSesionUsuario,
  desactivarUsuario,
  getUsuarios,
  getUsuariosAutorizados,
  reactivarUsuario,
  resetearPasswordUsuario,
  revocarAutorizacion,
} from "../services/usuarioService";
import { NOMBRE_USUARIO_MANAGER } from "../constants/manager";
import { obtenerMensajeError } from "../utils/errorHandling";
import { useToast } from "../context/useToast";
import { Cargando } from "../components/shared/Cargando";
import ModalConfirmar from "../components/modals/ModalConfirmar";
import ListaUsuarios from "../components/manager/ListaUsuarios";
import ModalResetearPassword from "../components/manager/ModalResetearPassword";
import SeccionAutorizados from "../components/manager/SeccionAutorizados";
import "./ResetearContrasena.css";

// Única página que ve la cuenta "Manager" (ver ProtectedRoute y Sidebar):
// todo el mantenimiento de cuentas entra acá adentro en secciones, en vez de
// abrir una ruta nueva por función -- así el encierro de esa cuenta sigue
// siendo una sola comparación de ruta.
//
// Todas estas acciones son exclusivas de "Manager" en el backend
// (requiere_manager), no de rol == "admin".
export function ResetearContrasena() {
  const toast = useToast();

  const [usuarios, setUsuarios] = useState([]);
  const [autorizados, setAutorizados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [guardando, setGuardando] = useState(false);

  // Acción pendiente de confirmación (cambiar rol / cerrar sesión /
  // desactivar / reactivar / revocar). Todas tocan a otra persona y no se
  // deshacen solas, así que ninguna se dispara con un click suelto.
  const [confirmacion, setConfirmacion] = useState(null);
  const [usuarioAResetear, setUsuarioAResetear] = useState(null);

  const cargarDatos = useCallback(async () => {
    try {
      const [listaUsuarios, listaAutorizados] = await Promise.all([
        getUsuarios(),
        getUsuariosAutorizados(),
      ]);
      // La propia cuenta "Manager" queda fuera de la planilla: el backend
      // rechaza toda acción sobre uno mismo (guard de auto-acción), así que
      // mostrarla sería ofrecer botones que siempre fallan.
      setUsuarios(listaUsuarios.filter((u) => u.nombre_usuario !== NOMBRE_USUARIO_MANAGER));
      setAutorizados(listaAutorizados);
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
  // (el estado que devuelve cada endpoint es de un solo usuario, y varias
  // acciones cambian también la lista de autorizados).
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

  const handleAutorizar = async (nombreUsuario, rol, onListo) => {
    const ok = await ejecutar(
      () => autorizarUsuario(nombreUsuario, rol),
      `${nombreUsuario} ya puede crearse la cuenta desde la pantalla de registro.`
    );
    if (ok) onListo();
  };

  const pedirRevocacion = (autorizado) => {
    setConfirmacion({
      titulo: "Revocar autorización",
      mensaje: `${autorizado.nombre_usuario} deja de aparecer en la pantalla de registro y no va a poder crearse la cuenta.`,
      nombreRecurso: autorizado.nombre_usuario,
      textoConfirmar: "Revocar",
      accion: () =>
        ejecutar(
          () => revocarAutorizacion(autorizado.id),
          `Autorización de ${autorizado.nombre_usuario} revocada.`
        ),
    });
  };

  const confirmarAccion = async () => {
    const pendiente = confirmacion;
    setConfirmacion(null);
    await pendiente.accion();
  };

  return (
    <div className="reseteo-container">
      <header className="reseteo-header">
        <div>
          <h1 className="reseteo-header__titulo">Gestión de cuentas</h1>
          <p className="reseteo-header__subtitulo">
            Contraseñas, roles, sesiones y altas del equipo. Solo lo ve esta cuenta.
          </p>
        </div>
        <span className="reseteo-header__icono">
          <UserCog size={20} strokeWidth={2} />
        </span>
      </header>

      {cargando ? (
        <Cargando texto="Cargando cuentas..." />
      ) : errorCarga ? (
        <p className="reseteo-error">{errorCarga}</p>
      ) : (
        <>
          <section className="reseteo-seccion">
            <h2 className="reseteo-seccion__titulo">Equipo</h2>
            <p className="reseteo-seccion__ayuda">
              Cuentas ya creadas. Desactivar corta el acceso sin borrar nada; cerrar sesión solo
              obliga a volver a entrar.
            </p>
            <ListaUsuarios
              usuarios={usuarios}
              onResetear={setUsuarioAResetear}
              onCambiarRol={pedirCambioDeRol}
              onCerrarSesion={pedirCierreDeSesion}
              onToggleActivo={pedirToggleActivo}
            />
          </section>

          <section className="reseteo-seccion">
            <h2 className="reseteo-seccion__titulo">Autorizar gente nueva</h2>
            <p className="reseteo-seccion__ayuda">
              El nombre autorizado acá es el que esa persona va a elegir en la pantalla de registro
              para crearse la cuenta.
            </p>
            <SeccionAutorizados
              autorizados={autorizados}
              guardando={guardando}
              onAutorizar={handleAutorizar}
              onRevocar={pedirRevocacion}
            />
          </section>
        </>
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

export default ResetearContrasena;
