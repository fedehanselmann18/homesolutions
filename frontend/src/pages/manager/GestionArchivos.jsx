import { useCallback, useEffect, useState } from "react";
import { FolderSearch } from "lucide-react";

import { getReconciliacion, purgarHuerfanos } from "../../services/storageService";
import { obtenerMensajeError } from "../../utils/errorHandling";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useToast } from "../../context/useToast";
import { Cargando } from "../../components/shared/Cargando";
import { PageHeader } from "../../components/shared/PageHeader";
import { EstadoVacio } from "../../components/shared/EstadoVacio";
import ModalConfirmar from "../../components/modals/ModalConfirmar";
import SeccionArchivos from "../../components/manager/SeccionArchivos";
import "./GestionManager.css";

/**
 * Página de Manager: reconciliación de archivos en R2. Solo aplica con R2
 * configurado -- sin eso el backend responde 400, que acá se trata como
 * estado informativo (no hay nada roto, la comparación directamente no
 * aplica en disco local).
 */
export function GestionArchivos() {
  usePageTitle("Archivos");
  const toast = useToast();

  const [datos, setDatos] = useState(null);
  const [r2NoConfigurado, setR2NoConfigurado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [pendientePurgar, setPendientePurgar] = useState(null);
  // Se incrementa en cada recarga y se usa como `key` de SeccionArchivos:
  // fuerza el remount que resetea la selección de checkboxes después de una
  // purga, sin que ese componente tenga que saber cuándo terminó (ver su
  // comentario).
  const [version, setVersion] = useState(0);

  const cargarDatos = useCallback(async () => {
    try {
      setDatos(await getReconciliacion());
      setR2NoConfigurado(false);
      setErrorCarga(null);
    } catch (err) {
      if (err?.response?.status === 400) {
        setR2NoConfigurado(true);
      } else {
        setErrorCarga(obtenerMensajeError(err));
      }
    } finally {
      setCargando(false);
      setVersion((v) => v + 1);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const confirmarPurga = async () => {
    const claves = pendientePurgar;
    setPendientePurgar(null);
    try {
      const resultado = await purgarHuerfanos(claves);
      await cargarDatos();
      if (resultado.omitidas.length > 0) {
        toast.error(
          `${resultado.purgadas.length} purgados, ${resultado.omitidas.length} no se pudieron borrar.`
        );
      } else {
        toast.success(`${resultado.purgadas.length} archivo(s) purgado(s).`);
      }
    } catch (err) {
      toast.error(obtenerMensajeError(err));
    }
  };

  return (
    <div className="manager-pagina">
      <PageHeader
        icono={<FolderSearch size={20} strokeWidth={2} />}
        titulo="Archivos"
        subtitulo="Reconciliación entre R2 y la base: huérfanos y comprobantes rotos. Solo lo ve esta cuenta."
      />

      {cargando ? (
        <Cargando texto="Comparando con R2..." />
      ) : errorCarga ? (
        <p className="manager-pagina__error">{errorCarga}</p>
      ) : r2NoConfigurado ? (
        <div className="manager-pagina__tarjeta">
          <EstadoVacio
            grande
            mensaje="R2 no está configurado en este entorno: los comprobantes se guardan en disco local, sin nada que comparar acá."
          />
        </div>
      ) : (
        <div className="manager-pagina__tarjeta">
          <SeccionArchivos
            key={version}
            huerfanos={datos.huerfanos}
            rotos={datos.rotos}
            onPedirPurgar={setPendientePurgar}
          />
        </div>
      )}

      {pendientePurgar && (
        <ModalConfirmar
          titulo="Purgar archivos huérfanos"
          mensaje="Se borran del bucket R2 para siempre. Ninguna fila de la base los referencia, así que no afecta ningún comprobante visible en la app."
          nombreRecurso={`${pendientePurgar.length} archivo(s) seleccionado(s)`}
          textoConfirmar="Purgar"
          onConfirmar={confirmarPurga}
          onCancelar={() => setPendientePurgar(null)}
        />
      )}
    </div>
  );
}

export default GestionArchivos;
