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

    // El regex apunta a la frase completa del error: el subtítulo de la
    // pantalla ("Elegí tu usuario para continuar") también empieza igual.
    expect(await screen.findByText(/eleg[ií] tu usuario y escrib/i)).toBeInTheDocument();
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

  it("permite escribir el nombre de usuario a mano (cuentas fuera del combo público)", async () => {
    const loginMock = vi.fn().mockResolvedValue();
    useAuth.mockReturnValue({ login: loginMock });
    renderLogin();
    const user = userEvent.setup();

    await screen.findByRole("option", { name: "Agustin" });
    await user.click(screen.getByRole("button", { name: /ingresalo manualmente/i }));

    // El combo desaparece y queda un input de texto en su lugar.
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("Nombre de usuario"), "Manager");
    await user.type(screen.getByPlaceholderText("••••••••"), "clave-del-manager");
    await user.click(screen.getByRole("button", { name: /^ingresar$/i }));

    await waitFor(() => expect(loginMock).toHaveBeenCalledWith("Manager", "clave-del-manager"));
  });

  it("muestra un mensaje de error genérico si login falla (401), sin el detail crudo del backend", async () => {
    // Shape real de un error de axios: err.message es un texto técnico en
    // inglés ("Request failed with status code 401"), nunca lo que hay que
    // mostrarle al usuario -- el 401 es siempre genérico acá (ver Login.jsx)
    // aunque el backend mande un detail en response.data.detail.
    const errorAxios = {
      message: "Request failed with status code 401",
      response: { status: 401, data: { detail: "Incorrect email or password" } },
    };
    const loginMock = vi.fn().mockRejectedValue(errorAxios);
    useAuth.mockReturnValue({ login: loginMock });
    renderLogin();
    const user = userEvent.setup();

    await screen.findByRole("option", { name: "Agustin" });
    await user.selectOptions(screen.getByRole("combobox"), "Agustin");
    await user.type(screen.getByPlaceholderText("••••••••"), "mala-clave");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    const mensaje = await screen.findByText(/usuario o contraseña incorrectos/i);
    expect(mensaje).toBeInTheDocument();
    expect(mensaje.textContent).not.toMatch(/incorrect email or password|401|request failed/i);
  });

  it("muestra el mensaje real (no genérico) si login falla por un error que no es 401", async () => {
    const errorAxios = { message: "Network Error" };
    const loginMock = vi.fn().mockRejectedValue(errorAxios);
    useAuth.mockReturnValue({ login: loginMock });
    renderLogin();
    const user = userEvent.setup();

    await screen.findByRole("option", { name: "Agustin" });
    await user.selectOptions(screen.getByRole("combobox"), "Agustin");
    await user.type(screen.getByPlaceholderText("••••••••"), "clave-cualquiera");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    expect(await screen.findByText(/no se pudo conectar con el servidor/i)).toBeInTheDocument();
  });
});
