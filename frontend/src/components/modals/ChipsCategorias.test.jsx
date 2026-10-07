// Chips de categorías: cubre las ramas que no se pueden ejercitar a mano
// contra la base de dev (donde todos los tipos ya tienen categorías
// cargadas) -- el estado vacío con creación inline, y el filtrado por tipo.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const crearCategoriaMock = vi.fn();
vi.mock("../../services/categoriaService", () => ({
  crearCategoria: (...args) => crearCategoriaMock(...args),
}));

import ChipsCategorias from "./ChipsCategorias";
import { BotonIA } from "./PiezasIA";

const categorias = [
  { id: "c1", nombre: "Aires Acondicionados", tipo: "equipo" },
  { id: "c2", nombre: "Ventilación", tipo: "equipo" },
  { id: "c3", nombre: "Cables y Alambres", tipo: "materiales" },
];

const noop = () => {};

describe("ChipsCategorias", () => {
  beforeEach(() => {
    crearCategoriaMock.mockReset();
  });

  it("solo ofrece las categorías del tipo recibido", () => {
    render(
      <ChipsCategorias
        categoriaIds={[]}
        tipo="equipo"
        categoriasDisponibles={categorias}
        onToggle={noop}
        onLimpiar={noop}
      />
    );

    expect(screen.getByRole("button", { name: "Aires Acondicionados" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ventilación" })).toBeInTheDocument();
    // "Cables y Alambres" es de materiales -- no corresponde a un producto equipo.
    expect(screen.queryByRole("button", { name: "Cables y Alambres" })).not.toBeInTheDocument();
  });

  it("marca como elegidos los chips que están en categoriaIds", () => {
    render(
      <ChipsCategorias
        categoriaIds={["c1"]}
        tipo="equipo"
        categoriasDisponibles={categorias}
        onToggle={noop}
        onLimpiar={noop}
      />
    );

    expect(screen.getByRole("button", { name: "Aires Acondicionados" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Ventilación" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(screen.getByText("1 elegida")).toBeInTheDocument();
  });

  it("el botón Limpiar solo aparece si hay alguna elegida", () => {
    const { rerender } = render(
      <ChipsCategorias
        categoriaIds={[]}
        tipo="equipo"
        categoriasDisponibles={categorias}
        onToggle={noop}
        onLimpiar={noop}
      />
    );
    expect(screen.queryByRole("button", { name: "Limpiar" })).not.toBeInTheDocument();
    expect(screen.getByText("ninguna")).toBeInTheDocument();

    rerender(
      <ChipsCategorias
        categoriaIds={["c1"]}
        tipo="equipo"
        categoriasDisponibles={categorias}
        onToggle={noop}
        onLimpiar={noop}
      />
    );
    expect(screen.getByRole("button", { name: "Limpiar" })).toBeInTheDocument();
  });

  it("sin categorías para el tipo, ofrece crear una en vez de un mensaje muerto", () => {
    render(
      <ChipsCategorias
        categoriaIds={[]}
        tipo="mano_obra"
        categoriasDisponibles={categorias}
        onToggle={noop}
        onLimpiar={noop}
      />
    );

    expect(screen.getByText(/No hay categorías cargadas para «Mano de obra»/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Nombre de la categoría")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Crear categoría/ })).toBeInTheDocument();
  });

  it("al crear una categoría la deja auto-seleccionada y avisa al padre", async () => {
    const nueva = { id: "c9", nombre: "Plomería", tipo: "mano_obra" };
    crearCategoriaMock.mockResolvedValue(nueva);
    const onToggle = vi.fn();
    const onCategoriaCreada = vi.fn();

    render(
      <ChipsCategorias
        categoriaIds={[]}
        tipo="mano_obra"
        categoriasDisponibles={categorias}
        onToggle={onToggle}
        onLimpiar={noop}
        onCategoriaCreada={onCategoriaCreada}
      />
    );

    await userEvent.type(screen.getByPlaceholderText("Nombre de la categoría"), "Plomería");
    await userEvent.click(screen.getByRole("button", { name: /Crear categoría/ }));

    expect(crearCategoriaMock).toHaveBeenCalledWith({ nombre: "Plomería", tipo: "mano_obra" });
    expect(onCategoriaCreada).toHaveBeenCalledWith(nueva);
    expect(onToggle).toHaveBeenCalledWith("c9");
  });

  it("no crea nada si el nombre está vacío", async () => {
    render(
      <ChipsCategorias
        categoriaIds={[]}
        tipo="mano_obra"
        categoriasDisponibles={categorias}
        onToggle={noop}
        onLimpiar={noop}
      />
    );

    expect(screen.getByRole("button", { name: /Crear categoría/ })).toBeDisabled();
    expect(crearCategoriaMock).not.toHaveBeenCalled();
  });
});

describe("BotonIA", () => {
  it("muestra el logo pulsando mientras la IA lee, y el ícono normal si no", () => {
    const { container, rerender } = render(
      <BotonIA onClick={noop} leyendo={false}>
        Leer catálogo con IA
      </BotonIA>
    );
    expect(container.querySelector(".logo-cargando")).toBeNull();

    rerender(
      <BotonIA onClick={noop} leyendo textoLeyendo="Leyendo catálogo...">
        Leer catálogo con IA
      </BotonIA>
    );
    const logo = container.querySelector(".logo-cargando");
    expect(logo).toBeTruthy();
    expect(screen.getByText("Leyendo catálogo...")).toBeInTheDocument();
    // v5: el botón es `.btn-marca` (fondo tint), así que va el isotipo en
    // oliva, no el blanco de cuando el botón era oliva lleno.
    expect(logo.getAttribute("src")).not.toMatch(/blanco/);
    expect(screen.getByRole("button")).toHaveClass("btn-marca");
  });
});
