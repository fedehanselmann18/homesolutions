import { useEffect, useState } from "react";
import { History } from "lucide-react";

import { getUsuarios } from "../../services/usuarioService";
import { usePageTitle } from "../../hooks/usePageTitle";
import { PageHeader } from "../../components/shared/PageHeader";
import SeccionAuditoria from "../../components/manager/SeccionAuditoria";
import "./GestionManager.css";

/**
 * Página de Manager: historial de acciones (tabla `auditoria` del backend).
 * Quién hizo qué y cuándo, en toda la app. Se escribe solo y no se puede
 * borrar desde acá.
 */
export function GestionAuditoria() {
  usePageTitle("Historial");

  // La lista SIN filtrar (con "Manager" adentro) es la que alimenta el
  // filtro "quién" del historial: esa cuenta no aparece en la planilla de
  // Equipo, pero es justamente la que ejecuta las acciones de
  // mantenimiento, así que tiene que poder elegirse acá. Si falla, el
  // filtro se queda vacío ("Todos") en vez de romper toda la página -- ver
  // el mismo criterio en SeccionAuditoria para getTiposAuditoria.
  const [usuarios, setUsuarios] = useState([]);

  useEffect(() => {
    getUsuarios()
      .then(setUsuarios)
      .catch(() => setUsuarios([]));
  }, []);

  return (
    <div className="manager-pagina">
      <PageHeader
        icono={<History size={20} strokeWidth={2} />}
        titulo="Historial"
        subtitulo="Quién hizo qué y cuándo, en toda la app. Solo lo ve esta cuenta."
      />

      <div className="manager-pagina__tarjeta">
        <SeccionAuditoria usuarios={usuarios} />
      </div>
    </div>
  );
}

export default GestionAuditoria;
