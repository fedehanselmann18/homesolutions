import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GestionConfiguracion } from "./GestionConfiguracion";
import {
  actualizarConfiguracion,
  getConfiguracion,
  getEstadoIntegraciones,
  restaurarConfiguracion,
} from "../../services/configuracionService";

vi.mock("../../services/configuracionService");
vi.mock("../../context/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

const CLAVES = [
  {
    clave: "GEMINI_MODEL",
    valor: "gemini-3.6-flash",
    descripcion: "Modelo de Gemini para la lectura de comprobantes y catálogos con IA.",
    personalizado: false,
  },
];

const ESTADO = { r2_configurado: false, gemini_configurado: true };

const esperarCarga = () => screen.findByText("GEMINI_MODEL");

describe("GestionConfiguracion (página de Manager)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConfiguracion.mockResolvedValue(CLAVES);
    getEstadoIntegraciones.mockResolvedValue(ESTADO);
  });

  it("muestra el estado de las integraciones externas", async () => {
    render(<GestionConfiguracion />);
    await esperarCarga();

    expect(screen.getByText("No configurado")).toBeInTheDocument(); // R2
    expect(screen.getByText("Configurado")).toBeInTheDocument(); // Gemini
  });

  it("marca los valores sin personalizar como del .env", async () => {
    render(<GestionConfiguracion />);
    await esperarCarga();

    expect(screen.getByText(/valor del \.env/i)).toBeInTheDocument();
  });

  it("el botón Guardar arranca deshabilitado hasta que se edita el valor", async () => {
    render(<GestionConfiguracion />);
    const user = userEvent.setup();
    await esperarCarga();

    const boton = screen.getByRole("button", { name: /guardar/i });
    expect(boton).toBeDisabled();

    const input = screen.getByDisplayValue("gemini-3.6-flash");
    await user.clear(input);
    await user.type(input, "gemini-nuevo");

    expect(boton).toBeEnabled();
  });

  it("guarda el valor editado", async () => {
    actualizarConfiguracion.mockResolvedValue({
      ...CLAVES[0],
      valor: "gemini-nuevo",
      personalizado: true,
    });
    render(<GestionConfiguracion />);
    const user = userEvent.setup();
    await esperarCarga();

    const input = screen.getByDisplayValue("gemini-3.6-flash");
    await user.clear(input);
    await user.type(input, "gemini-nuevo");
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() =>
      expect(actualizarConfiguracion).toHaveBeenCalledWith("GEMINI_MODEL", "gemini-nuevo")
    );
  });

  it("no muestra el botón Restaurar si el valor no está personalizado", async () => {
    render(<GestionConfiguracion />);
    await esperarCarga();

    expect(screen.queryByRole("button", { name: /restaurar/i })).not.toBeInTheDocument();
  });

  it("restaura un valor personalizado al del .env", async () => {
    getConfiguracion.mockResolvedValue([
      { ...CLAVES[0], valor: "gemini-piloto", personalizado: true },
    ]);
    restaurarConfiguracion.mockResolvedValue({ ...CLAVES[0], personalizado: false });
    render(<GestionConfiguracion />);
    const user = userEvent.setup();
    await screen.findByText("GEMINI_MODEL");

    await user.click(screen.getByRole("button", { name: /restaurar/i }));

    await waitFor(() => expect(restaurarConfiguracion).toHaveBeenCalledWith("GEMINI_MODEL"));
  });
});
