import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Registro } from "./Registro";
import { crearUsuario, getOpcionesRegistro } from "../services/usuarioService";

vi.mock("../services/usuarioService");

const renderRegistro = () =>
  render(
    <MemoryRouter>
      <Registro />
    </MemoryRouter>
  );

const completarPasswords = async (user, password) => {
  const [campo, confirmar] = screen.getAllByPlaceholderText("••••••••");
  await user.type(campo, password);
  await user.type(confirmar, password);
};

describe("Registro", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOpcionesRegistro.mockResolvedValue(["Agustin", "Aldana"]);
  });

  it("carga los nombres autorizados desde el endpoint público, sin lista hardcodeada", async () => {
    renderRegistro();

    await waitFor(() => expect(getOpcionesRegistro).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("option", { name: "Agustin" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Aldana" })).toBeInTheDocument();
  });

  it("no ofrece forma de escribir un nombre a mano (ni siquiera para Manager)", async () => {
    // "Manager" (la cuenta de mantenimiento, ver requiere_manager en el
    // backend) no tiene que poder crearse desde este endpoint público -- ni
    // por el combo ni por ningún input de texto libre. Se crea una única
    // vez con backend/scripts/crear_usuario_manager.py.
    renderRegistro();

    await screen.findByRole("option", { name: "Agustin" });
    expect(screen.queryByRole("option", { name: "Manager" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ingresar manualmente/i })).not.toBeInTheDocument();
  });

  it("avisa cuando no queda nadie pendiente de registrarse", async () => {
    getOpcionesRegistro.mockResolvedValue([]);
    renderRegistro();

    expect(await screen.findByText(/no hay nombres pendientes de registro/i)).toBeInTheDocument();
    // Sin nadie para elegir el formulario no lleva a ningún lado: el botón
    // queda deshabilitado en vez de dejar enviar y fallar.
    expect(screen.getByRole("button", { name: /crear cuenta/i })).toBeDisabled();
  });

  it("crea la cuenta sin mandar el rol: lo decide el servidor con la whitelist", async () => {
    crearUsuario.mockResolvedValue({});
    renderRegistro();
    const user = userEvent.setup();

    await screen.findByRole("option", { name: "Agustin" });
    await user.selectOptions(screen.getByRole("combobox"), "Agustin");
    await completarPasswords(user, "clave-larga-ok");
    await user.click(screen.getByRole("button", { name: /crear cuenta/i }));

    await waitFor(() =>
      expect(crearUsuario).toHaveBeenCalledWith({
        nombre_usuario: "Agustin",
        password: "clave-larga-ok",
      })
    );
  });

  it("avisa que la contraseña es corta debajo del campo y no llama al backend", async () => {
    renderRegistro();
    const user = userEvent.setup();

    await screen.findByRole("option", { name: "Agustin" });
    await user.selectOptions(screen.getByRole("combobox"), "Agustin");
    await completarPasswords(user, "corta-123");

    expect(await screen.findByText(/al menos 10 caracteres/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /crear cuenta/i }));
    expect(crearUsuario).not.toHaveBeenCalled();
  });

  it("muestra el detail real del backend en vez de suponer que el usuario ya existe", async () => {
    // Antes cualquier error que no fuera 403 se mostraba como "puede que ya
    // exista", incluso un 422 por contraseña corta -- que es justo lo que
    // confundía: el usuario no estaba creado.
    crearUsuario.mockRejectedValue({
      response: { status: 422, data: { detail: "Revisá los datos ingresados: password." } },
    });
    renderRegistro();
    const user = userEvent.setup();

    await screen.findByRole("option", { name: "Agustin" });
    await user.selectOptions(screen.getByRole("combobox"), "Agustin");
    await completarPasswords(user, "clave-larga-ok");
    await user.click(screen.getByRole("button", { name: /crear cuenta/i }));

    expect(await screen.findByText(/revisá los datos ingresados/i)).toBeInTheDocument();
    expect(screen.queryByText(/puede que ya exista/i)).not.toBeInTheDocument();
  });

  it("avisa que el nombre no está autorizado si el backend devuelve 403", async () => {
    // Puede pasar aunque el nombre venga del combo: por ejemplo si Manager
    // revocó la autorización mientras la persona tenía la pantalla abierta.
    crearUsuario.mockRejectedValue({ response: { status: 403 } });
    renderRegistro();
    const user = userEvent.setup();

    await screen.findByRole("option", { name: "Agustin" });
    await user.selectOptions(screen.getByRole("combobox"), "Agustin");
    await completarPasswords(user, "clave-cualquiera");
    await user.click(screen.getByRole("button", { name: /crear cuenta/i }));

    expect(await screen.findByText(/no está autorizado a crear cuenta/i)).toBeInTheDocument();
  });
});
