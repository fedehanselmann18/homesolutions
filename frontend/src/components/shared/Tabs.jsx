import "./Tabs.css";

/**
 * Barra de pestañas de una página de detalle (proyecto, fase).
 *
 * Antes había dos: `.tabs` en ProyectoDetalle.css dibujaba pestañas de
 * carpeta (caja con borde y radio arriba, activa en --color-terracota-dark,
 * 0.82rem) y `.fase-detalle-tabs` en FaseDetalle.css dibujaba un subrayado
 * (sin caja, borde inferior de 2px, activa en --color-terracota, 0.9rem).
 * Entrar a una fase desde su proyecto cambiaba la forma, el tamaño y el tono
 * de oliva de la misma navegación. Quedó el subrayado, que aguanta mejor los
 * nombres largos ("Seguimiento de la fase") y no compite con la carátula.
 */
export function Tabs({ tabs, activa, onCambiar, etiqueta }) {
  return (
    <div className="tabs" role="tablist" aria-label={etiqueta}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={tab.key === activa}
          className={`tabs__tab${tab.key === activa ? " tabs__tab--activa" : ""}`}
          onClick={() => onCambiar(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default Tabs;
