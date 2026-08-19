import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResetearContrasena } from "./ResetearContrasena";
import {
  autorizarUsuario,
  cambiarRolUsuario,
  cerrarSesionUsuario,
  desactivarUsuario,
  getUsuarios,
  getUsuariosAutorizados,
  reactivarUsuario,
  resetearPasswordUsuario,
  revocarAutorizacion,
} from "../services/usuarioService";

vi.mock("../services/usuarioService");
vi.mock("../context/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

const USUARIOS = [
  { id: "u-1", nombre_usuario: "Agustin", rol: "admin", activo: true },
  { id: "u-2", nombre_usuario: "Alejandro", rol: "lectura", activo: false },
  { id: "u-3", nombre_usuario: "Manager", rol: "lectura", activo: true },
];

const AUTORIZADOS = [
  { id: "a-1", nombre_usuario: "Agustin", rol: "admin", ya_registrado: true },
  { id: "a-2", nombre_usuario: "Sofia", rol: "lectura", ya_registrado: false },
];

// Cada fila de la planilla tiene los mismos botones, así que las acciones se
// buscan dentro de la fila de esa persona y no en toda la pantalla.
const filaDe = (nombre) => screen.getByRole("row", { name: new RegExp(nombre) });

const esperarCarga = () => screen.findByRole("row", { name: /Agustin/ });

// Los botones del modal repiten el texto del botón de la fila que lo abrió
// (ej. "Cerrar sesión"), así que se buscan dentro del diálogo.
const enElModal = () => within(screen.getByRole("dialog"));

describe("ResetearContrasena (página de Manager)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUsuarios.mockResolvedValue(USUARIOS);
    getUsuariosAutorizados.mockResolvedValue(AUTORIZADOS);
  });

  it("lista las cuentas con su rol y estado, sin incluir a Manager", async () => {
    render(<ResetearContrasena />);
    await esperarCarga();

    // Manager no se muestra: el backend rechaza toda acción sobre uno mismo,
    // así que sus botones fallarían siempre.
    expect(screen.queryByRole("row", { name: /Manager/ })).not.toBeInTheDocument();

    expect(within(filaDe("Agustin")).getByText("Admin")).toBeInTheDocument();
    expect(within(filaDe("Agustin")).getByText("Activa")).toBeInTheDocument();
    expect(within(filaDe("Alejandro")).getByText("Lectura")).toBeInTheDocument();
    expect(within(filaDe("Alejandro")).getByText("Desactivada")).toBeInTheDocument();
  });

  it("resetea la contraseña desde el modal de la fila", async () => {
    resetearPasswordUsuario.mockResolvedValue({});
    render(<ResetearContrasena />);
    const user = userEvent.setup();
    await esperarCarga();

    await user.click(within(filaDe("Agustin")).getByRole("button", { name: /contraseña/i }));

    await user.type(screen.getByPlaceholderText("Mínimo 8 caracteres"), "clave-larga-ok");
    await user.type(screen.getByPlaceholderText("Repetila"), "clave-larga-ok");
    await user.click(screen.getByRole("button", { name: /cambiar contraseña/i }));

    await waitFor(() =>
      expect(resetearPasswordUsuario).toHaveBeenCalledWith("u-1", "clave-larga-ok")
    );
  });

  it("no resetea si la contraseña es corta", async () => {
    render(<ResetearContrasena />);
    const user = userEvent.setup();
    await esperarCarga();

    await user.click(within(filaDe("Agustin")).getByRole("button", { name: /contraseña/i }));
    await user.type(screen.getByPlaceholderText("Mínimo 8 caracteres"), "corta12");
    await user.type(screen.getByPlaceholderText("Repetila"), "corta12");

    expect(await screen.findByText(/al menos 8 caracteres/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /cambiar contraseña/i }));
    expect(resetearPasswordUsuario).not.toHaveBeenCalled();
  });

  it("cambia el rol recién después de confirmar", async () => {
    cambiarRolUsuario.mockResolvedValue({});
    render(<ResetearContrasena />);
    const user = userEvent.setup();
    await esperarCarga();

    // Agustin es admin -> la acción disponible es pasarlo a lectura.
    await user.click(within(filaDe("Agustin")).getByRole("button", { name: /pasar a lectura/i }));
    expect(cambiarRolUsuario).not.toHaveBeenCalled();

    await user.click(enElModal().getByRole("button", { name: /^cambiar rol$/i }));

    await waitFor(() => expect(cambiarRolUsuario).toHaveBeenCalledWith("u-1", "lectura"));
  });

  it("no hace nada si se cancela la confirmación", async () => {
    render(<ResetearContrasena />);
    const user = userEvent.setup();
    await esperarCarga();

    await user.click(within(filaDe("Agustin")).getByRole("button", { name: /cerrar sesión/i }));
    await user.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(cerrarSesionUsuario).not.toHaveBeenCalled();
  });

  it("cierra la sesión de alguien tras confirmar", async () => {
    cerrarSesionUsuario.mockResolvedValue({});
    render(<ResetearContrasena />);
    const user = userEvent.setup();
    await esperarCarga();

    await user.click(within(filaDe("Agustin")).getByRole("button", { name: /cerrar sesión/i }));
    await user.click(enElModal().getByRole("button", { name: /^cerrar sesión$/i }));

    await waitFor(() => expect(cerrarSesionUsuario).toHaveBeenCalledWith("u-1"));
  });

  it("desactiva una cuenta activa y reactiva una desactivada", async () => {
    desactivarUsuario.mockResolvedValue({});
    reactivarUsuario.mockResolvedValue({});
    render(<ResetearContrasena />);
    const user = userEvent.setup();
    await esperarCarga();

    await user.click(within(filaDe("Agustin")).getByRole("button", { name: /desactivar/i }));
    await user.click(enElModal().getByRole("button", { name: /^desactivar$/i }));
    await waitFor(() => expect(desactivarUsuario).toHaveBeenCalledWith("u-1"));

    // Alejandro está desactivado: su acción es reactivar.
    await user.click(within(filaDe("Alejandro")).getByRole("button", { name: /reactivar/i }));
    await user.click(enElModal().getByRole("button", { name: /^reactivar$/i }));
    await waitFor(() => expect(reactivarUsuario).toHaveBeenCalledWith("u-2"));
  });

  it("autoriza a alguien nuevo al equipo", async () => {
    autorizarUsuario.mockResolvedValue({});
    render(<ResetearContrasena />);
    const user = userEvent.setup();
    await esperarCarga();

    await user.type(screen.getByPlaceholderText("Ej: Sofia"), "Camila");
    await user.selectOptions(screen.getByRole("combobox"), "admin");
    await user.click(screen.getByRole("button", { name: /autorizar/i }));

    await waitFor(() => expect(autorizarUsuario).toHaveBeenCalledWith("Camila", "admin"));
  });

  it("separa los autorizados pendientes de los que ya tienen cuenta", async () => {
    render(<ResetearContrasena />);
    await esperarCarga();

    // Sofia todavía no se registró: se le puede revocar la autorización.
    expect(screen.getByText("Sofia")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /revocar/i })).toBeInTheDocument();
    // Agustin ya tiene cuenta: aparece marcado, sin botón de revocar.
    expect(screen.getByText("Con cuenta")).toBeInTheDocument();
  });

  it("revoca una autorización pendiente tras confirmar", async () => {
    revocarAutorizacion.mockResolvedValue();
    render(<ResetearContrasena />);
    const user = userEvent.setup();
    await esperarCarga();

    await user.click(screen.getByRole("button", { name: /revocar/i }));
    await user.click(enElModal().getByRole("button", { name: /^revocar$/i }));

    await waitFor(() => expect(revocarAutorizacion).toHaveBeenCalledWith("a-2"));
  });
});
