import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Layers } from "lucide-react";
import { Tabs } from "./Tabs";

describe("Tabs", () => {
  it("sin ícono ni badge pinta sólo el label", () => {
    render(
      <Tabs
        tabs={[
          { key: "a", label: "Uno" },
          { key: "b", label: "Dos" },
        ]}
        activa="a"
        onCambiar={() => {}}
        etiqueta="Secciones"
      />
    );
    const uno = screen.getByRole("tab", { name: "Uno" });
    expect(uno).toHaveAttribute("aria-selected", "true");
    expect(uno.querySelector("svg")).toBeNull();
    expect(uno.querySelector(".tabs__badge")).toBeNull();
  });

  it("pinta el ícono decorativo y el badge de pendientes", async () => {
    const onCambiar = vi.fn();
    render(
      <Tabs
        tabs={[
          { key: "a", label: "Fases", icono: Layers },
          { key: "b", label: "Seguimiento", badge: 8 },
        ]}
        activa="a"
        onCambiar={onCambiar}
        etiqueta="Secciones"
      />
    );
    const fases = screen.getByRole("tab", { name: "Fases" });
    expect(fases.querySelector("svg")).toHaveAttribute("aria-hidden", "true");

    const seguimiento = screen.getByRole("tab", { name: /Seguimiento/ });
    expect(seguimiento.querySelector(".tabs__badge").textContent).toBe("8");
    expect(seguimiento).toHaveAttribute("aria-selected", "false");
    await userEvent.click(seguimiento);
    expect(onCambiar).toHaveBeenCalledWith("b");
  });

  it("un badge en cero no se pinta", () => {
    render(
      <Tabs tabs={[{ key: "a", label: "Seguimiento", badge: 0 }]} activa="a" onCambiar={() => {}} />
    );
    expect(
      screen.getByRole("tab", { name: "Seguimiento" }).querySelector(".tabs__badge")
    ).toBeNull();
  });
});
