import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Link } from "react-router-dom";
import userEvent from "@testing-library/user-event";

import { TransicionDeRuta } from "./TransicionDeRuta";

// jsdom no implementa scrollTo: se stubea para poder ver con qué se llamó.
beforeEach(() => {
  window.scrollTo = vi.fn();
});

const renderEn = (ruta) =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <TransicionDeRuta>
        <Routes>
          <Route path="/" element={<Link to="/proyectos/1">ir al proyecto</Link>} />
          <Route path="/proyectos/:id" element={<p>Proyecto</p>} />
          <Route path="/seguimiento" element={<p>Seguimiento</p>} />
        </Routes>
      </TransicionDeRuta>
    </MemoryRouter>
  );

describe("TransicionDeRuta", () => {
  it("al cambiar de página manda el scroll arriba, sin animarlo", async () => {
    renderEn("/");
    window.scrollTo.mockClear();

    await userEvent.click(screen.getByRole("link", { name: "ir al proyecto" }));

    expect(screen.getByText("Proyecto")).toBeInTheDocument();
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "instant" });
  });

  it("con ?foco= no toca el scroll: la página se posiciona sola en esa fila", () => {
    // Si acá se mandara el scroll arriba, se pisaría el scrollIntoView de
    // Bandeja y el usuario volvería a perder de vista lo que tocó.
    renderEn("/seguimiento?foco=pagar-abc");
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it("la página entrante se remonta por ruta, que es lo que dispara la entrada", () => {
    const { container } = renderEn("/seguimiento");
    expect(container.querySelector(".transicion-ruta")).toBeInTheDocument();
  });
});
