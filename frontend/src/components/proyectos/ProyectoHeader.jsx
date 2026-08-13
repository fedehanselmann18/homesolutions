import "./ProyectoHeader.css";

export function ProyectosHeader({ canManage, onCrearProyecto, cantidad }) {
  return (
    <header className="proyectos-header">
      <div className="proyectos-header__texto">
        <h1 className="proyectos-header__titulo">Proyectos</h1>
        <p className="proyectos-header__subtitulo">
          {cantidad != null
            ? `${cantidad} ${cantidad === 1 ? "proyecto activo" : "proyectos activos"}`
            : "Gestioná el estado de cada obra"}
        </p>
      </div>

      {canManage && (
        <section className="proyectos-button-container">
          <button className="proyectos-button" onClick={onCrearProyecto}>
            Crear Proyecto
          </button>
        </section>
      )}
    </header>
  );
}

export default ProyectosHeader;
