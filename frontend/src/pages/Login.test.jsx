import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Login } from "./Login";
import { useAuth } from "../context/useAuth";
import { getOpcionesLogin } from "../services/usuarioService";

vi.mock("../context/useAuth");
vi.mock("../services/usuarioService");

const renderLogin = () =>
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );

describe("Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOpcionesLogin.mockResolvedValue(["Agustin", "Aldana", "Alejandro"]);
  });

  it("carga las opciones de usuario desde el endpoint público (sin exponer id/rol)", async () => {
    useAuth.mockReturnValue({ login: vi.fn() });
    renderLogin();

    await waitFor(() => expect(getOpcionesLogin).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("option", { name: "Agustin" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Aldana" })).toBeInTheDocument();
  });

  it("muestra un error si se intenta enviar sin elegir usuario ni contraseña", async () => {
    useAuth.mockReturnValue({ login: vi.fn() });
    renderLogin();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    expect(await screen.findByText(/eleg[ií].*usuario/i)).toBeInTheDocument();
  });

  it("llama a login con el usuario y contraseña ingresados", async () => {
    const loginMock = vi.fn().mockResolvedValue();
    useAuth.mockReturnValue({ login: loginMock });
    renderLogin();
    const user = userEvent.setup();

    await screen.findByRole("option", { name: "Agustin" });
    await user.selectOptions(screen.getByRole("combobox"), "Agustin");
    await user.type(screen.getByPlaceholderText("••••••••"), "clave-super-segura");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    await waitFor(() => expect(loginMock).toHaveBeenCalledWith("Agustin", "clave-super-segura"));
  });

  it("muestra un mensaje de error genérico si login falla (401)", async () => {
    const loginMock = vi.fn().mockRejectedValue(new Error("Request failed with status code 401"));
    useAuth.mockReturnValue({ login: loginMock });
    renderLogin();
    const user = userEvent.setup();

    await screen.findByRole("option", { name: "Agustin" });
    await user.selectOptions(screen.getByRole("combobox"), "Agustin");
    await user.type(screen.getByPlaceholderText("••••••••"), "mala-clave");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    expect(await screen.findByText(/usuario o contraseña incorrectos/i)).toBeInTheDocument();
  });
});
