import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GestionAutorizados } from "./GestionAutorizados";
import {
  autorizarUsuario,
  getUsuariosAutorizados,
  revocarAutorizacion,
} from "../../services/usuarioService";

vi.mock("../../services/usuarioService");
vi.mock("../../context/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

const AUTORIZADOS = [
  { id: "a-1", nombre_usuario: "Agustin", rol: "admin", ya_registrado: true },
  { id: "a-2", nombre_usuario: "Sofia", rol: "lectura", ya_registrado: false },
];

const enElModal = () => within(screen.getByRole("dialog"));

describe("GestionAutorizados (página de Manager)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUsuariosAutorizados.mockResolvedValue(AUTORIZADOS);
  });

  it("separa los autorizados pendientes de los que ya tienen cuenta", async () => {
    render(<GestionAutorizados />);
    await screen.findByText("Sofia");

    // Sofia todavía no se registró: se le puede revocar la autorización.
    expect(screen.getByText("Sofia")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /revocar/i })).toBeInTheDocument();
    // Agustin ya tiene cuenta: aparece marcado, sin botón de revocar.
    expect(screen.getByText("Con cuenta")).toBeInTheDocument();
  });

  it("autoriza a alguien nuevo al equipo", async () => {
    autorizarUsuario.mockResolvedValue({});
    render(<GestionAutorizados />);
    const user = userEvent.setup();
    await screen.findByText("Sofia");

    await user.type(screen.getByPlaceholderText("Ej: Sofia"), "Camila");
    await user.selectOptions(screen.getByRole("combobox"), "admin");
    await user.click(screen.getByRole("button", { name: /autorizar/i }));

    await waitFor(() => expect(autorizarUsuario).toHaveBeenCalledWith("Camila", "admin"));
  });

  it("revoca una autorización pendiente tras confirmar", async () => {
    revocarAutorizacion.mockResolvedValue();
    render(<GestionAutorizados />);
    const user = userEvent.setup();
    await screen.findByText("Sofia");

    await user.click(screen.getByRole("button", { name: /revocar/i }));
    await user.click(enElModal().getByRole("button", { name: /^revocar$/i }));

    await waitFor(() => expect(revocarAutorizacion).toHaveBeenCalledWith("a-2"));
  });

  it("no hace nada si se cancela la confirmación de revocar", async () => {
    render(<GestionAutorizados />);
    const user = userEvent.setup();
    await screen.findByText("Sofia");

    await user.click(screen.getByRole("button", { name: /revocar/i }));
    await user.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(revocarAutorizacion).not.toHaveBeenCalled();
  });
});
