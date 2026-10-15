import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ProveedorTarjeta } from "./ProveedorItems";

const sinEspacios = (s) => s.replace(/\s/g, "");

const resumen = (extra = {}) => ({
  proveedor: {
    id: "p1",
    nombre: "Frío Sur",
    cuit: null,
    telefono: "11 4555-1020",
    email: null,
    direccion: null,
  },
  cantidadProductos: 3,
  totalComprado: 1500000,
  deuda: 0,
  comprasImpagas: [],
  diasVencidaMasVieja: null,
  ...extra,
});

const aviso = () => document.querySelector(".proveedor-tarjeta__pie .badge");

describe("ProveedorTarjeta", () => {
  it("muestra siempre las mismas líneas y lo que falta, atenuado", () => {
    render(<ProveedorTarjeta resumen={resumen()} onAbrir={() => {}} />);
    expect(screen.getByText("Sin CUIT")).toBeInTheDocument();
    expect(screen.getByText("11 4555-1020")).toBeInTheDocument();
    expect(screen.getByText("Sin email").closest("li")).toHaveClass(
      "proveedor-tarjeta__dato--falta"
    );
    expect(screen.getByText("Sin dirección")).toBeInTheDocument();
    expect(screen.getByText(/comprado · 3 productos/)).toBeInTheDocument();
  });

  it("sin deuda no muestra aviso", () => {
    render(<ProveedorTarjeta resumen={resumen()} onAbrir={() => {}} />);
    expect(aviso()).toBeNull();
    expect(screen.getByRole("link")).toHaveAccessibleName("Frío Sur");
  });

  it("con compras sin pagar avisa cuánto se debe, en ámbar", () => {
    const comprasImpagas = [{ id: "c1" }];
    render(
      <ProveedorTarjeta resumen={resumen({ deuda: 925000, comprasImpagas })} onAbrir={() => {}} />
    );
    expect(sinEspacios(aviso().textContent)).toBe("Debe$925.000");
    expect(aviso()).toHaveClass("badge--atencion");
    expect(aviso()).toHaveAttribute("title", "1 compra sin pagar");
    // Sin vista, el aviso tiene que llegar igual al lector de pantalla.
    expect(sinEspacios(screen.getByRole("link").getAttribute("aria-label"))).toBe(
      "FríoSur.Debe$925.000"
    );
  });

  it("con un plazo vencido el aviso va en rojo y lo dice", () => {
    const comprasImpagas = [{ id: "c1" }, { id: "c2" }];
    render(
      <ProveedorTarjeta
        resumen={resumen({ deuda: 925000, comprasImpagas, diasVencidaMasVieja: 5 })}
        onAbrir={() => {}}
      />
    );
    expect(sinEspacios(aviso().textContent)).toBe("Debe$925.000·vencida");
    expect(aviso()).toHaveClass("badge--peligro");
    expect(aviso()).toHaveAttribute("title", "2 compras sin pagar · un plazo venció hace 5 días");
  });

  it("editar no abre el proveedor", async () => {
    const onAbrir = vi.fn();
    const onEditar = vi.fn();
    render(<ProveedorTarjeta resumen={resumen()} onAbrir={onAbrir} onEditar={onEditar} />);
    await userEvent.click(screen.getByRole("button", { name: "Editar Frío Sur" }));
    expect(onEditar).toHaveBeenCalledOnce();
    expect(onAbrir).not.toHaveBeenCalled();
  });
});
