import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GestionAuditoria } from "./GestionAuditoria";
import { getUsuarios } from "../../services/usuarioService";
import { getAuditoria, getTiposAuditoria } from "../../services/auditoriaService";

vi.mock("../../services/usuarioService");
vi.mock("../../services/auditoriaService");

const USUARIOS = [
  { id: "u-1", nombre_usuario: "Agustin", rol: "admin", activo: true },
  { id: "u-3", nombre_usuario: "Manager", rol: "lectura", activo: true },
];

const AUDITORIA = {
  items: [
    {
      id: "au-1",
      usuario_id: "u-1",
      usuario_nombre: "Agustin",
      accion: "delete",
      tipo_recurso: "Compra",
      recurso_id: "abcdef12-3456-7890-abcd-ef1234567890",
      detalle: null,
      creado_en: "2026-08-20T14:30:00+00:00",
    },
    {
      id: "au-2",
      usuario_id: "u-3",
      usuario_nombre: "Manager",
      accion: "desactivar",
      tipo_recurso: "Usuario",
      recurso_id: "u-2",
      detalle: { usuario: "Alejandro" },
      creado_en: "2026-08-19T09:00:00+00:00",
    },
  ],
  total: 2,
};

describe("GestionAuditoria (página de Manager)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUsuarios.mockResolvedValue(USUARIOS);
    getAuditoria.mockResolvedValue(AUDITORIA);
    getTiposAuditoria.mockResolvedValue(["Compra", "Usuario"]);
  });

  it("muestra el historial traduciendo la acción y el objetivo de cada fila", async () => {
    render(<GestionAuditoria />);

    // "delete" se muestra traducido, no crudo.
    expect(await screen.findByText("Borró")).toBeInTheDocument();
    // Las acciones de Manager ya vienen en español: se muestran tal cual.
    expect(screen.getByText("desactivar")).toBeInTheDocument();
    // El objetivo de esa acción sale de `detalle`, porque el id no dice nada.
    expect(
      screen.getByText("Alejandro", { selector: ".manager-auditoria__detalle" })
    ).toBeInTheDocument();
  });

  it("filtra el historial por tipo y vuelve a la primera página", async () => {
    render(<GestionAuditoria />);
    const user = userEvent.setup();
    await screen.findByText("Borró");

    await user.selectOptions(screen.getByRole("combobox", { name: /tipo/i }), "Compra");

    await waitFor(() =>
      expect(getAuditoria).toHaveBeenLastCalledWith(
        expect.objectContaining({ tipo_recurso: "Compra", offset: 0 })
      )
    );
  });

  it("el filtro de quién incluye a Manager, que ejecuta las acciones de mantenimiento", async () => {
    render(<GestionAuditoria />);
    await screen.findByText("Borró");

    const filtroQuien = screen.getByRole("combobox", { name: /quién/i });
    expect(within(filtroQuien).getByRole("option", { name: "Manager" })).toBeInTheDocument();
  });

  it("deshabilita la paginación cuando entra todo en una página", async () => {
    render(<GestionAuditoria />);
    await screen.findByText("Borró");

    expect(screen.getByRole("button", { name: /anterior/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /siguiente/i })).toBeDisabled();
    expect(screen.getByText(/Mostrando 1-2 de 2/)).toBeInTheDocument();
  });
});
