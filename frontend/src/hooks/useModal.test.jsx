// Comportamiento de teclado de los modales: cerrar con Escape, atrapar el
// foco adentro del diálogo y devolverlo al abrir/cerrar. Nada de esto existía
// antes en la app -- el test está para que no se pierda en el próximo
// refactor de ModalShell.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useModal } from "./useModal";

function Dialogo({ onCerrar, cerrarDeshabilitado = false }) {
  const ref = useModal(onCerrar, cerrarDeshabilitado);
  return (
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Diálogo de prueba">
      <button type="button">primero</button>
      <button type="button">último</button>
    </div>
  );
}

describe("useModal", () => {
  it("cierra con Escape", async () => {
    const onCerrar = vi.fn();
    const user = userEvent.setup();
    render(<Dialogo onCerrar={onCerrar} />);

    await user.keyboard("{Escape}");

    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it("no cierra con Escape mientras se está guardando", async () => {
    const onCerrar = vi.fn();
    const user = userEvent.setup();
    render(<Dialogo onCerrar={onCerrar} cerrarDeshabilitado />);

    await user.keyboard("{Escape}");

    expect(onCerrar).not.toHaveBeenCalled();
  });

  it("pone el foco en el diálogo al abrir", () => {
    render(<Dialogo onCerrar={vi.fn()} />);

    expect(document.activeElement).toBe(screen.getByRole("dialog"));
  });

  it("cicla el foco adentro del diálogo en vez de salirse", async () => {
    const user = userEvent.setup();
    render(<Dialogo onCerrar={vi.fn()} />);

    const primero = screen.getByRole("button", { name: "primero" });
    const ultimo = screen.getByRole("button", { name: "último" });

    ultimo.focus();
    await user.tab();
    expect(document.activeElement).toBe(primero);

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(ultimo);
  });

  it("devuelve el foco a donde estaba al cerrarse", async () => {
    const disparador = document.createElement("button");
    document.body.appendChild(disparador);
    disparador.focus();

    const { unmount } = render(<Dialogo onCerrar={vi.fn()} />);
    expect(document.activeElement).not.toBe(disparador);

    unmount();
    expect(document.activeElement).toBe(disparador);

    disparador.remove();
  });
});
