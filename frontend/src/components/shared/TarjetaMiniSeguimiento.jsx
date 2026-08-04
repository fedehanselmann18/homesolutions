import "./TarjetaMiniSeguimiento.css";

/**
 * Mini card genérica para las listas de Seguimiento: el tablero de compras
 * (una columna por estado) y las listas de gastos/cobros sin comprobante.
 * El color viene de quien la contiene -- la card no decide su propio color,
 * así no se puede desalinear del grupo en el que vive.
 */
export function TarjetaMiniSeguimiento({ titulo, subtitulo, etiqueta, monto, color, onClick }) {
    const contenido = (
        <>
            <p className="mini-seg-titulo">{titulo}</p>
            {subtitulo && <p className="mini-seg-subtitulo">{subtitulo}</p>}
            <div className="mini-seg-footer">
                {etiqueta && <span className="mini-seg-etiqueta">{etiqueta}</span>}
                <span className="mini-seg-monto">{monto}</span>
            </div>
        </>
    );

    if (!onClick) {
        return (
            <div className="mini-seg" style={{ borderLeftColor: color }}>
                {contenido}
            </div>
        );
    }

    return (
        <button type="button" className="mini-seg" style={{ borderLeftColor: color }} onClick={onClick}>
            {contenido}
        </button>
    );
}

export default TarjetaMiniSeguimiento;
