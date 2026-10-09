// Regresión: sin cotización cargada en la tabla, el input del dólar se abre
// solo; antes se desmontaba al tipear el primer dígito y quedaba "1".
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../hooks/queries", () => ({
  useUltimaCotizacion: () => ({ isLoading: false, data: null }),
}));

import { CamposCotizacion } from "./CamposCotizacion";
import { useCotizacionDia } from "../../hooks/useCotizacionDia";

function Prueba() {
  const cotizacion = useCotizacionDia({ fecha: "2026-10-09" });
  return <CamposCotizacion cotizacion={cotizacion} />;
}

describe("CamposCotizacion sin sugerencia", () => {
  it("deja tipear la cotización completa sin cerrarse", async () => {
    const { container } = render(<Prueba />);
    const input = container.querySelector('input[name="cotizacion_dolar"]');
    expect(input).toBeInTheDocument();
    await userEvent.type(input, "1530");
    expect(container.querySelector('input[name="cotizacion_dolar"]')).toHaveValue(1530);
  });
});
