import "./Tabs.css";

/**
 * Barra de pestañas de una página de detalle (proyecto, fase) y de Catálogos.
 *
 * Antes había dos: `.tabs` en ProyectoDetalle.css dibujaba pestañas de
 * carpeta (caja con borde y radio arriba, activa en --color-terracota-dark,
 * 0.82rem) y `.fase-detalle-tabs` en FaseDetalle.css dibujaba un subrayado
 * (sin caja, borde inferior de 2px, activa en --color-terracota, 0.9rem).
 * Entrar a una fase desde su proyecto cambiaba la forma, el tamaño y el tono
 * de oliva de la misma navegación. Quedó el subrayado, que aguanta mejor los
 * nombres largos ("Seguimiento de la fase") y no compite con la carátula.
 *
 * Cada tab es `{ key, label, icono?, badge?, contador? }`. `icono` es un
 * componente de lucide-react; `badge` un número de pendientes, en el par de
 * atención; `contador` un número que sólo cuenta ("Catálogo 4"), en tenue
 * (DESIGN.md §13). Todos opcionales: sin ellos la tab es sólo el label. Un
 * badge en 0 no se pinta — "0 pendientes" no es un pendiente.
 */
export function Tabs({ tabs, activa, onCambiar, etiqueta }) {
  return (
    <div className="tabs" role="tablist" aria-label={etiqueta}>
      {tabs.map(({ key, label, icono: Icono, badge, contador }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={key === activa}
          className={`tabs__tab${key === activa ? " tabs__tab--activa" : ""}`}
          onClick={() => onCambiar(key)}
        >
          {Icono && <Icono size={15} strokeWidth={1.75} aria-hidden="true" />}
          {label}
          {contador != null && <span className="tabs__contador">{contador}</span>}
          {badge != null && badge !== 0 && <span className="tabs__badge">{badge}</span>}
        </button>
      ))}
    </div>
  );
}

export default Tabs;
