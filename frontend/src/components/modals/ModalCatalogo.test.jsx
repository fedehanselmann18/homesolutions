// Modales de la pantalla de catálogos: que validen el nombre obligatorio sin
// llegar a llamar al callback, y que el payload salga con la forma exacta que
// espera el backend ({ nombre } o { nombre, tipo }).
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ModalCatalogoSimple from "./ModalCatalogoSimple";
import ModalCategoria from "./ModalCategoria";

describe("ModalCatalogoSimple", () => {
  it("renderiza con el título que recibe", () => {
    render(<ModalCatalogoSimple titulo="Nuevo impuesto" onGuardar={vi.fn()} onCerrar={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "Nuevo impuesto" })).toBeInTheDocument();
  });

  it("no guarda un nombre vacío o sólo con espacios, y muestra el error", async () => {
    const onGuardar = vi.fn();
    render(
      <ModalCatalogoSimple titulo="Nuevo impuesto" onGuardar={onGuardar} onCerrar={vi.fn()} />
    );

    await userEvent.type(screen.getByLabelText("Nombre"), "   ");
    await userEvent.click(screen.getByRole("button", { name: "Crear" }));

    expect(onGuardar).not.toHaveBeenCalled();
    expect(screen.getByText("El nombre es obligatorio.")).toBeInTheDocument();
  });

  it("llama a onGuardar con { nombre } recortado", async () => {
    const onGuardar = vi.fn().mockResolvedValue();
    render(
      <ModalCatalogoSimple titulo="Nuevo impuesto" onGuardar={onGuardar} onCerrar={vi.fn()} />
    );

    await userEvent.type(screen.getByLabelText("Nombre"), "  IVA 21%  ");
    await userEvent.click(screen.getByRole("button", { name: "Crear" }));

    expect(onGuardar).toHaveBeenCalledWith({ nombre: "IVA 21%" });
  });

  it("en edición precarga el nombre", async () => {
    const onGuardar = vi.fn().mockResolvedValue();
    render(
      <ModalCatalogoSimple
        titulo="Editar impuesto"
        registro={{ id: "a", nombre: "IIBB" }}
        onGuardar={onGuardar}
        onCerrar={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Nombre")).toHaveValue("IIBB");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(onGuardar).toHaveBeenCalledWith({ nombre: "IIBB" });
  });
});

describe("ModalCategoria", () => {
  it("no guarda sin nombre", async () => {
    const onGuardar = vi.fn();
    render(<ModalCategoria onGuardar={onGuardar} onCerrar={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Nombre"), " ");
    await userEvent.click(screen.getByRole("button", { name: "Crear categoría" }));

    expect(onGuardar).not.toHaveBeenCalled();
    expect(screen.getByText("El nombre es obligatorio.")).toBeInTheDocument();
  });

  it("llama a onGuardar con { nombre, tipo } usando el valor del backend", async () => {
    const onGuardar = vi.fn().mockResolvedValue();
    render(<ModalCategoria onGuardar={onGuardar} onCerrar={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Nombre"), "Cables");
    await userEvent.selectOptions(screen.getByLabelText("Tipo"), "Mano de obra");
    await userEvent.click(screen.getByRole("button", { name: "Crear categoría" }));

    expect(onGuardar).toHaveBeenCalledWith({ nombre: "Cables", tipo: "mano_obra" });
  });

  it("en edición precarga nombre y tipo", () => {
    render(
      <ModalCategoria
        categoria={{ id: "c", nombre: "Aires", tipo: "equipo" }}
        onGuardar={vi.fn()}
        onCerrar={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Nombre")).toHaveValue("Aires");
    expect(screen.getByLabelText("Tipo")).toHaveValue("equipo");
  });
});
