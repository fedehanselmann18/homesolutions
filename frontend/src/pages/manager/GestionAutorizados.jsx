import { useCallback, useEffect, useState } from "react";

import {
  autorizarUsuario,
  getUsuariosAutorizados,
  revocarAutorizacion,
} from "../../services/usuarioService";
import { obtenerMensajeError } from "../../utils/errorHandling";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useToast } from "../../context/useToast";
import { Cargando } from "../../components/shared/Cargando";
import { EstadoError } from "../../components/shared/EstadoError";
import { PageHeader } from "../../components/shared/PageHeader";
import ModalConfirmar from "../../components/modals/ModalConfirmar";
import SeccionAutorizados from "../../components/manager/SeccionAutorizados";
import "./GestionManager.css";

/**
 * Página de Manager: whitelist de autoregistro (usuarios_autorizados) --
 * quién puede crearse cuenta en /registro y con qué rol.
 */
export function GestionAutorizados() {
  usePageTitle("Autorizar gente nueva");
  const toast = useToast();

  const [autorizados, setAutorizados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [confirmacion, setConfirmacion] = useState(null);

  const cargarDatos = useCallback(async () => {
    try {
      setAutorizados(await getUsuariosAutorizados());
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
    <div className="manager-pagina">
      <PageHeader
        titulo="Autorizar gente nueva"
        subtitulo="El nombre autorizado acá es el que esa persona va a elegir en la pantalla de registro."
      />

      {cargando ? (
        <Cargando texto="Cargando autorizados..." />
      ) : errorCarga ? (
        <EstadoError mensaje={errorCarga} />
      ) : (
        <div className="manager-pagina__tarjeta">
          <SeccionAutorizados
            autorizados={autorizados}
            guardando={guardando}
            onAutorizar={handleAutorizar}
            onRevocar={pedirRevocacion}
          />
        </div>
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

export default GestionAutorizados;
