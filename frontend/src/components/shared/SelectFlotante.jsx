import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import "./SelectFlotante.css";

/**
 * Select propio (no <select> nativo): el label flota sobre el border-bottom
 * y el desplegable abierto usa nuestro propio diseño en vez del listbox del
 * sistema operativo, que un <select> nativo no permite estilizar.
 */
export function SelectFlotante({ label, value, onChange, opciones }) {
    const [abierto, setAbierto] = useState(false);
    const contenedorRef = useRef(null);

    useEffect(() => {
        if (!abierto) return undefined;

        const onClickFuera = (e) => {
            if (contenedorRef.current && !contenedorRef.current.contains(e.target)) {
                setAbierto(false);
            }
        };
        const onTecla = (e) => {
            if (e.key === "Escape") setAbierto(false);
        };

        document.addEventListener("mousedown", onClickFuera);
        document.addEventListener("keydown", onTecla);
        return () => {
            document.removeEventListener("mousedown", onClickFuera);
            document.removeEventListener("keydown", onTecla);
        };
    }, [abierto]);

    const seleccionada = opciones.find((o) => o.value === value);

    return (
        <div className="select-flotante" ref={contenedorRef}>
            <label className="label-ficha select-flotante-label">{label}</label>
            <button
                type="button"
                className={`select-flotante-trigger ${abierto ? "abierto" : ""}`}
                onClick={() => setAbierto((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={abierto}
            >
                <span className="select-flotante-valor">{seleccionada?.label ?? ""}</span>
                <ChevronDown size={14} strokeWidth={2} className="select-flotante-icono" />
            </button>

            {abierto && (
                <ul className="select-flotante-lista" role="listbox">
                    {opciones.map((o) => (
                        <li
                            key={o.value}
                            role="option"
                            aria-selected={o.value === value}
                            className={`select-flotante-opcion ${o.value === value ? "activa" : ""}`}
                            onClick={() => {
                                onChange(o.value);
                                setAbierto(false);
                            }}
                        >
                            {o.label}
                            {o.value === value && <Check size={14} strokeWidth={2.5} />}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default SelectFlotante;
