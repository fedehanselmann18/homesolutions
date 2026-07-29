import { createContext, useCallback, useRef, useState } from "react";

export const ToastContext = createContext(null);

let contadorId = 0;

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const timers = useRef(new Map());

    const quitar = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        const timer = timers.current.get(id);
        if (timer) {
            clearTimeout(timer);
            timers.current.delete(id);
        }
    }, []);

    const mostrar = useCallback((mensaje, tipo = "error") => {
        const id = ++contadorId;
        setToasts((prev) => [...prev, { id, mensaje, tipo }]);
        const timer = setTimeout(() => quitar(id), 5000);
        timers.current.set(id, timer);
    }, [quitar]);

    const toast = {
        error: (mensaje) => mostrar(mensaje, "error"),
        success: (mensaje) => mostrar(mensaje, "success"),
    };

    return (
        <ToastContext.Provider value={{ toasts, toast, quitar }}>
            {children}
        </ToastContext.Provider>
    );
}
