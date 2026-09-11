import { describe, it, expect, beforeEach, afterEach } from "vitest";
import axiosClient, { esRutaPublica, setCsrfToken } from "./axiosClient";

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

// El interceptor de 401 se prueba pisando axiosClient.defaults.adapter en
// vez de mockear axios entero: el "adapter" es el mismo punto de extensión
// que usan las libs tipo axios-retry, así que el mock corre el interceptor
// real (request + response) tal cual corre en producción, sin simular su
// lógica interna.
function respuestaOk(config, data) {
  return { data, status: 200, statusText: "OK", headers: {}, config };
}

function respuesta401(config) {
  return Promise.reject({ config, response: { status: 401, data: {}, config } });
}

describe("interceptor de 401 -> refresh de sesión", () => {
  const adapterOriginal = axiosClient.defaults.adapter;

  beforeEach(() => {
    setCsrfToken(null);
    // jsdom no navega de verdad -- pisamos location.href por un objeto
    // propio para poder leer a dónde "hubiera" redirigido el failsafe.
    Object.defineProperty(window, "location", {
      value: { ...window.location, pathname: "/proyectos", href: "" },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    axiosClient.defaults.adapter = adapterOriginal;
  });

  it("ante un 401 refresca sola la sesión y reintenta el pedido original sin que el caller vea el error", async () => {
    let refrescos = 0;

    axiosClient.defaults.adapter = (config) => {
      if (config.url === "/proyectos") {
        // Antes del refresh (interceptor de request) llega sin marca de
        // reintento; después de refrescar, axiosClient(original) vuelve a
        // pasar por acá con _reintentadoTrasRefresh en true.
        if (config._reintentadoTrasRefresh) {
          return Promise.resolve(respuestaOk(config, [{ id: "1" }]));
        }
        return respuesta401(config);
      }
      if (config.url === "/auth/refresh") {
        refrescos++;
        return Promise.resolve(respuestaOk(config, { message: "Token renovado" }));
      }
      if (config.url === "/usuarios/me") {
        return Promise.resolve(respuestaOk(config, { csrf_token: "csrf-nuevo" }));
      }
      throw new Error(`adapter de test no configurado para ${config.url}`);
    };

    const { data } = await axiosClient.get("/proyectos");

    expect(data).toEqual([{ id: "1" }]);
    expect(refrescos).toBe(1);
    expect(window.location.href).toBe(""); // nunca se disparó el failsafe
  });

  it("dedupea: dos pedidos que 401ean a la vez sólo disparan un POST /auth/refresh", async () => {
    let refrescos = 0;

    axiosClient.defaults.adapter = (config) => {
      if (config.url === "/proyectos" || config.url === "/proveedores") {
        if (config._reintentadoTrasRefresh) {
          return Promise.resolve(respuestaOk(config, []));
        }
        return respuesta401(config);
      }
      if (config.url === "/auth/refresh") {
        refrescos++;
        return Promise.resolve(respuestaOk(config, { message: "Token renovado" }));
      }
      if (config.url === "/usuarios/me") {
        return Promise.resolve(respuestaOk(config, { csrf_token: "csrf-nuevo" }));
      }
      throw new Error(`adapter de test no configurado para ${config.url}`);
    };

    await Promise.all([axiosClient.get("/proyectos"), axiosClient.get("/proveedores")]);

    expect(refrescos).toBe(1);
  });

  it("actualiza el csrf_token en memoria después de refrescar, para el siguiente pedido mutante", async () => {
    axiosClient.defaults.adapter = (config) => {
      if (config.url === "/proyectos" && config.method === "post") {
        if (config._reintentadoTrasRefresh) {
          return Promise.resolve(
            respuestaOk(config, { id: "1", csrfRecibido: config.headers["X-CSRF-Token"] })
          );
        }
        return respuesta401(config);
      }
      if (config.url === "/auth/refresh") {
        return Promise.resolve(respuestaOk(config, { message: "Token renovado" }));
      }
      if (config.url === "/usuarios/me") {
        return Promise.resolve(respuestaOk(config, { csrf_token: "csrf-nuevo" }));
      }
      throw new Error(`adapter de test no configurado para ${config.url}`);
    };

    const { data } = await axiosClient.post("/proyectos", { nombre: "Test" });

    expect(data.csrfRecibido).toBe("csrf-nuevo");
  });

  it("failsafe: si el refresh también da 401, no reintenta en loop y manda al login", async () => {
    axiosClient.defaults.adapter = (config) => {
      if (config.url === "/proyectos") {
        return respuesta401(config);
      }
      if (config.url === "/auth/refresh") {
        return respuesta401(config);
      }
      throw new Error(`adapter de test no configurado para ${config.url}`);
    };

    await expect(axiosClient.get("/proyectos")).rejects.toBeTruthy();
    expect(window.location.href).toBe("/login");
  });
});
