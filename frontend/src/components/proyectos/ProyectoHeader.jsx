import { Plus, Search } from "lucide-react";
import "./ProyectoHeader.css";

export function ProyectosHeader({
  canManage,
  onCrearProyecto,
  cantidad,
  busqueda,
  onBuscarChange,
}) {
  return (
    <header className="proyectos-header">
      <div className="proyectos-header__titulo-grupo">
        <h1 className="proyectos-header__titulo">Proyectos</h1>
        {cantidad != null && (
          <span className="proyectos-header__chip">
            {cantidad} {cantidad === 1 ? "cargado" : "cargados"}
          </span>
        )}
      </div>

      <div className="proyectos-header__acciones">
        <label className="proyectos-header__busqueda">
          <Search size={14} strokeWidth={2} aria-hidden="true" />
          <input
            type="search"
            placeholder="Buscar proyecto o dirección…"
            value={busqueda}
            onChange={(e) => onBuscarChange(e.target.value)}
            aria-label="Buscar proyecto"
          />
        </label>

        {canManage && (
          <button type="button" className="proyectos-button" onClick={onCrearProyecto}>
            <Plus size={14} strokeWidth={2.2} />
            Nuevo proyecto
          </button>
        )}
      </div>
    </header>
  );
}

export default ProyectosHeader;
