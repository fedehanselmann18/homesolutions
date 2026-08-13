import { Link } from "react-router-dom";
import "./Breadcrumbs.css";

/**
 * `items`: [{ label, to? }] -- el último ítem se muestra como texto plano
 * (página actual), no como link, tenga `to` o no.
 */
export function Breadcrumbs({ items }) {
  return (
    <nav className="breadcrumbs" aria-label="Ruta de navegación">
      {items.map((item, i) => {
        const esUltimo = i === items.length - 1;
        return (
          <span key={i} className="breadcrumbs-item">
            {item.to && !esUltimo ? (
              <Link to={item.to} className="breadcrumbs-link">
                {item.label}
              </Link>
            ) : (
              <span className="breadcrumbs-actual">{item.label}</span>
            )}
            {!esUltimo && <span className="breadcrumbs-separador">/</span>}
          </span>
        );
      })}
    </nav>
  );
}

export default Breadcrumbs;
