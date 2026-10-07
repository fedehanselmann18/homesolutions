import "./PageHeader.css";

/**
 * Encabezado de página: título + bajada (o chip de conteo) a la izquierda,
 * acciones a la derecha, línea divisoria abajo.
 *
 * Antes había cinco: `.proveedores-header`, `.comparador-header` y
 * `.reseteo-header` eran el mismo bloque escrito tres veces; `.proyectos-header`
 * era ese mismo patrón pero con el título a --text-xl (1.25rem) contra los
 * 2rem de los otros -- casi la mitad, en una página del mismo nivel; y
 * `.panel-header` del Panel no llevaba línea. Sólo Proyectos tenía regla
 * responsive, así que en pantalla angosta sus acciones se estiraban y las de
 * Proveedores y Manager no.
 *
 * `chip` y `subtitulo` son excluyentes: el chip es para un conteo corto
 * ("12 cargados"), la bajada para una frase.
 */
export function PageHeader({ titulo, subtitulo, chip, acciones }) {
  return (
    <header className="page-header">
      <div className="page-header__texto">
        <div className="page-header__titulo-grupo">
          <h1 className="page-header__titulo">{titulo}</h1>
          {chip && <span className="page-header__chip">{chip}</span>}
        </div>
        {subtitulo && <p className="page-header__subtitulo">{subtitulo}</p>}
      </div>

      {acciones && <div className="page-header__acciones">{acciones}</div>}
    </header>
  );
}

export default PageHeader;
