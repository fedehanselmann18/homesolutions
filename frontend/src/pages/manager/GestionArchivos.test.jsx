import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GestionArchivos } from "./GestionArchivos";
import { getReconciliacion, purgarHuerfanos } from "../../services/storageService";

vi.mock("../../services/storageService");
vi.mock("../../context/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

const RECONCILIACION = {
  huerfanos: [
    {
      key: "comprobantes_gasto/g1/huerfano.pdf",
      tamanio_bytes: 2048,
      modificado_en: "2026-08-20T14:30:00+00:00",
    },
  ],
  rotos: [
    {
      tipo_recurso: "ComprobanteCompra",
      recurso_id: "abcdef12-3456-7890-abcd-ef1234567890",
      archivo_path: "comprobantes_compra/c1/roto.pdf",
    },
  ],
};

const enElModal = () => within(screen.getByRole("dialog"));

describe("GestionArchivos (página de Manager)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra un estado informativo cuando el bucket no está configurado (400)", async () => {
    getReconciliacion.mockRejectedValue({
      response: { status: 400, data: { detail: "bucket no configurado" } },
    });

    render(<GestionArchivos />);

    expect(
      await screen.findByText(/bucket de comprobantes no está configurado/i)
    ).toBeInTheDocument();
  });

  it("lista huérfanos y rotos por separado", async () => {
    getReconciliacion.mockResolvedValue(RECONCILIACION);
    render(<GestionArchivos />);

    expect(await screen.findByText(/comprobantes_gasto\/g1\/huerfano\.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/comprobantes_compra\/c1\/roto\.pdf/)).toBeInTheDocument();
    expect(screen.getByText("Huérfanos en el bucket (1)")).toBeInTheDocument();
    expect(screen.getByText(/Comprobantes rotos \(1\)/)).toBeInTheDocument();
  });

  it("el botón de purgar solo aparece con algo seleccionado", async () => {
    getReconciliacion.mockResolvedValue(RECONCILIACION);
    render(<GestionArchivos />);
    const user = userEvent.setup();
    await screen.findByText(/huerfano\.pdf/);

    expect(screen.queryByRole("button", { name: /purgar/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: /seleccionar comprobantes_gasto/i }));

    expect(screen.getByRole("button", { name: /purgar 1 seleccionado/i })).toBeInTheDocument();
  });

  it("purga tras confirmar en el modal", async () => {
    getReconciliacion.mockResolvedValue(RECONCILIACION);
    purgarHuerfanos.mockResolvedValue({
      purgadas: ["comprobantes_gasto/g1/huerfano.pdf"],
      omitidas: [],
    });
    render(<GestionArchivos />);
    const user = userEvent.setup();
    await screen.findByText(/huerfano\.pdf/);

    await user.click(screen.getByRole("checkbox", { name: /seleccionar comprobantes_gasto/i }));
    await user.click(screen.getByRole("button", { name: /purgar 1 seleccionado/i }));
    await user.click(enElModal().getByRole("button", { name: /^purgar$/i }));

    await waitFor(() =>
      expect(purgarHuerfanos).toHaveBeenCalledWith(["comprobantes_gasto/g1/huerfano.pdf"])
    );
  });

  it("no purga nada si se cancela la confirmación", async () => {
    getReconciliacion.mockResolvedValue(RECONCILIACION);
    render(<GestionArchivos />);
    const user = userEvent.setup();
    await screen.findByText(/huerfano\.pdf/);

    await user.click(screen.getByRole("checkbox", { name: /seleccionar comprobantes_gasto/i }));
    await user.click(screen.getByRole("button", { name: /purgar 1 seleccionado/i }));
    await user.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(purgarHuerfanos).not.toHaveBeenCalled();
  });
});
