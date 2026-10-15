// Filtros de Métricas en la URL: lo que se lee, lo que se escribe y que los
// valores por defecto no ensucien la dirección.
import { describe, it, expect, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

import { useFiltrosMetricas } from "./useMetricas";
import { useMonedaAnalisis } from "./useMonedaAnalisis";

function renderFiltros(url = "/metricas") {
  const wrapper = ({ children }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>;
  return renderHook(
    () => ({ filtros: useFiltrosMetricas(), location: useLocation(), moneda: useMonedaAnalisis() }),
    { wrapper }
  );
}

describe("useFiltrosMetricas", () => {
  // La moneda global vive en memoria a nivel módulo: se deja en dólares.
  afterEach(() => {
    const { result } = renderFiltros();
    act(() => result.current.moneda[1]("usd"));
  });

  it("sin parámetros usa los valores por defecto", () => {
    const { result } = renderFiltros();
    expect(result.current.filtros).toMatchObject({ periodo: "6m", moneda: "usd" });
  });

  it("lee período y moneda de la URL", () => {
    const { result } = renderFiltros("/metricas?periodo=12m&moneda=ars");
    expect(result.current.filtros).toMatchObject({ periodo: "12m", moneda: "ars" });
  });

  it("un período o una moneda que no existen caen al default", () => {
    const { result } = renderFiltros("/metricas?periodo=99m&moneda=eur");
    expect(result.current.filtros.periodo).toBe("6m");
    expect(result.current.filtros.moneda).toBe("usd");
  });

  it("cambiar el período lo escribe en la URL y volver al default lo saca", () => {
    const { result } = renderFiltros();
    act(() => result.current.filtros.setPeriodo("12m"));
    expect(result.current.location.search).toBe("?periodo=12m");
    expect(result.current.filtros.periodo).toBe("12m");

    act(() => result.current.filtros.setPeriodo("6m"));
    expect(result.current.location.search).toBe("");
  });

  it("cambiar la moneda la guarda en la URL y en la elección global de la app", () => {
    const { result } = renderFiltros();
    act(() => result.current.filtros.setMoneda("ars"));
    expect(result.current.location.search).toBe("?moneda=ars");
    expect(result.current.moneda[0]).toBe("ars");
  });
});
