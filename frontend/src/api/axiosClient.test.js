import { describe, it, expect } from "vitest";
import { esRutaPublica } from "./axiosClient";

// Test de regresión: el interceptor de 401 no debe forzar una recarga de
// página (window.location.href) si ya estamos en una ruta pública -- si no,
// useAuthProvider preguntando "¿hay sesión?" en /login (esperando un 401
// normal cuando no hay sesión) entra en loop de recargas infinito. Bug real
// visto en los logs del backend: /usuarios/me 401 alternado con
// /usuarios/login-options 200, sin parar.
describe("esRutaPublica", () => {
  it("considera públicas /login, /registro y /no-autorizado", () => {
    expect(esRutaPublica("/login")).toBe(true);
    expect(esRutaPublica("/registro")).toBe(true);
    expect(esRutaPublica("/no-autorizado")).toBe(true);
  });

  it("no considera públicas las rutas internas protegidas", () => {
    expect(esRutaPublica("/")).toBe(false);
    expect(esRutaPublica("/proyectos")).toBe(false);
    expect(esRutaPublica("/proyectos/123")).toBe(false);
  });
});
