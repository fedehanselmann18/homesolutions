import { useCallback, useEffect, useState } from "react";

import {
  actualizarConfiguracion,
  getConfiguracion,
  getEstadoIntegraciones,
  restaurarConfiguracion,
} from "../../services/configuracionService";
import { obtenerMensajeError } from "../../utils/errorHandling";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useToast } from "../../context/useToast";
import { Cargando } from "../../components/shared/Cargando";
import { EstadoError } from "../../components/shared/EstadoError";
import { PageHeader } from "../../components/shared/PageHeader";
import SeccionConfiguracion from "../../components/manager/SeccionConfiguracion";
import "./GestionManager.css";

/**
 * Página de Manager: valores editables sin redeployar (tabla
 * `configuracion` del backend) más el estado -- solo lectura -- de las
 * integraciones externas (bucket, Gemini).
 */
export function GestionConfiguracion() {
  usePageTitle("Configuración");
  const toast = useToast();

  const [claves, setClaves] = useState([]);
  const [integraciones, setIntegraciones] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cargarDatos = useCallback(async () => {
    try {
      const [listaClaves, estado] = await Promise.all([
        getConfiguracion(),
        getEstadoIntegraciones(),
      ]);
      setClaves(listaClaves);
      setIntegraciones(estado);
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

  const handleGuardar = async (clave, valorNuevo) => {
    try {
      setGuardando(true);
      await actualizarConfiguracion(clave, valorNuevo);
      await cargarDatos();
      toast.success(`${clave} actualizado.`);
    } catch (err) {
      toast.error(obtenerMensajeError(err));
    } finally {
      setGuardando(false);
    }
  };

  const handleRestaurar = async (clave) => {
    try {
      setGuardando(true);
      await restaurarConfiguracion(clave);
      await cargarDatos();
      toast.success(`${clave} vuelve a usar el valor del .env.`);
    } catch (err) {
      toast.error(obtenerMensajeError(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="manager-pagina">
      <PageHeader
        titulo="Configuración"
        subtitulo="Valores editables sin redeployar y estado de las integraciones externas. Solo lo ve esta cuenta."
      />

      {cargando ? (
        <Cargando texto="Cargando configuración..." />
      ) : errorCarga ? (
        <EstadoError mensaje={errorCarga} />
      ) : (
        <div className="manager-pagina__tarjeta">
          <SeccionConfiguracion
            integraciones={integraciones}
            claves={claves}
            guardando={guardando}
            onGuardar={handleGuardar}
            onRestaurar={handleRestaurar}
          />
        </div>
      )}
    </div>
  );
}

export default GestionConfiguracion;
