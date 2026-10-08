import { useState } from "react";
import { TriangleAlert } from "lucide-react";

import { SECCIONES_GUIA } from "../constants/guia";
import { PageHeader } from "../components/shared/PageHeader";
import { usePageTitle } from "../hooks/usePageTitle";

import "./Guia.css";

function Bloque({ bloque }) {
  switch (bloque.tipo) {
    case "parrafo":
      return <p className="guia-bloque__parrafo">{bloque.texto}</p>;
    case "pasos":
      return (
        <ol className="guia-bloque__pasos">
          {bloque.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      );
    case "lista":
      return (
        <ul className="guia-bloque__lista">
          {bloque.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "aviso":
      // TarjetaAlerta no encaja: es una fila con monto y el color le llega
      // inline. El porqué del color, en Guia.css.
      return (
        <p className="guia-aviso" role="note">
          <TriangleAlert size={16} strokeWidth={1.75} aria-hidden="true" />
          <span>{bloque.texto}</span>
        </p>
      );
    default:
      return null;
  }
}

// La guía muestra UNA sección a la vez (el nav cambia el panel) y no scrollea
// a un ancla de una página larga: así no hace falta seguir qué sección va
// pasando por la pantalla para marcarla en el nav, y el buscador del PROMPT 3
// puede filtrar las secciones sin romper un scroll. La sección activa es
// estado local: no hay nada que persistir.
export function Guia() {
  usePageTitle("Guía");
  const [activaId, setActivaId] = useState(SECCIONES_GUIA[0].id);
  const activa = SECCIONES_GUIA.find((s) => s.id === activaId) ?? SECCIONES_GUIA[0];

  return (
    <div className="guia">
      <PageHeader titulo="Guía" subtitulo="Cómo usar la app, paso a paso." />

      <div className="guia__cuerpo">
        <nav className="guia-nav" aria-label="Secciones de la guía">
          {SECCIONES_GUIA.map(({ id, titulo, icono: Icono }) => (
            <button
              key={id}
              type="button"
              className={`guia-nav__item${id === activa.id ? " guia-nav__item--activo" : ""}`}
              aria-current={id === activa.id ? "true" : undefined}
              onClick={() => setActivaId(id)}
            >
              <Icono size={16} strokeWidth={1.75} aria-hidden="true" />
              {titulo}
            </button>
          ))}
        </nav>

        <article className="guia-panel" aria-labelledby="guia-panel-titulo">
          <header className="guia-panel__cabecera">
            <h2 id="guia-panel-titulo" className="guia-panel__titulo">
              {activa.titulo}
            </h2>
            <p className="guia-panel__resumen">{activa.resumen}</p>
          </header>
          <div className="guia-panel__bloques">
            {activa.bloques.map((bloque, i) => (
              <Bloque key={`${activa.id}-${i}`} bloque={bloque} />
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}

export default Guia;
