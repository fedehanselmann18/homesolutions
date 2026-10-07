import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { ErrorBoundary } from "./ErrorBoundary";

function Rompe() {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  it("si un hijo rompe al dibujarse, muestra la pantalla de error con la salida al inicio", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Rompe />
      </ErrorBoundary>
    );
    expect(screen.getByRole("heading", { name: "Ocurrió un error inesperado" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Volver al inicio" })).toHaveClass("btn-primary");
    console.error.mockRestore();
  });
});
