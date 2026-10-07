import { describe, it, expect } from "vitest";
import {
  formatMoneda,
  formatMonedaDual,
  formatCotizacion,
  formatMonedaCorta,
  formatFecha,
  formatBytes,
  formatUltimaActividad,
  formatNumero,
  pluralizar,
} from "./formato";

// Ver comentario en formatUtils.test.js: normalizamos espacios que Intl
// puede insertar entre el símbolo y el número según el motor/ICU.
const sinEspacios = (s) => s.replace(/\s/g, "");

describe("formatMoneda", () => {
  it("formatea con símbolo de pesos y sin decimales", () => {
    expect(sinEspacios(formatMoneda(250000))).toBe("$250.000");
  });
});

describe("formatMoneda en dólares", () => {
  it("usa US$ para no confundirse con el $ de pesos", () => {
    expect(sinEspacios(formatMoneda(41379, "usd"))).toBe("US$41.379");
  });
});

describe("formatNumero", () => {
  it("usa coma decimal y punto de miles, con los decimales pedidos", () => {
    expect(formatNumero(59.31, 1)).toBe("59,3");
    expect(formatNumero(14634)).toBe("14.634");
    expect(formatNumero(4, 1)).toBe("4,0");
  });
});

describe("formatMonedaDual", () => {
  it("pone el USD primero y los pesos entre paréntesis por default", () => {
    expect(sinEspacios(formatMonedaDual(60000000, 41379))).toBe("US$41.379($60.000.000)");
  });

  it("con principal ars invierte el orden (deuda, gastos)", () => {
    expect(sinEspacios(formatMonedaDual(60000000, 41379, { principal: "ars" }))).toBe(
      "$60.000.000(US$41.379)"
    );
  });

  it("sin la cifra secundaria muestra solo la principal", () => {
    expect(sinEspacios(formatMonedaDual(null, 100))).toBe("US$100");
  });
});

describe("formatCotizacion", () => {
  it("muestra los centavos del tipo de cambio", () => {
    expect(sinEspacios(formatCotizacion(1487.3456))).toBe("$1.487,35");
  });
});

describe("formatMonedaCorta", () => {
  it("usa notación compacta para montos grandes", () => {
    // Intl con notation "compact" en es-AR devuelve algo tipo "$3,9 M"
    const resultado = formatMonedaCorta(3900000);
    expect(resultado).toMatch(/M/);
  });
});

describe("formatFecha", () => {
  it("formatea una fecha ISO como dd/mm/aaaa sin corrimiento de timezone", () => {
    expect(formatFecha("2026-07-31")).toBe("31/07/2026");
  });

  it("devuelve string vacío si no hay fecha", () => {
    expect(formatFecha(null)).toBe("");
    expect(formatFecha(undefined)).toBe("");
    expect(formatFecha("")).toBe("");
  });
});

describe("pluralizar", () => {
  it("concuerda con 1 y con 2", () => {
    expect(pluralizar(1, "compra")).toBe("1 compra");
    expect(pluralizar(2, "compra")).toBe("2 compras");
  });

  it("usa el plural en 0", () => {
    expect(pluralizar(0, "fase")).toBe("0 fases");
  });

  it("acepta el plural explícito cuando no alcanza con la s", () => {
    const frase = ["compra que no tiene comprobante", "compras que no tienen comprobante"];
    expect(pluralizar(1, ...frase)).toBe("1 compra que no tiene comprobante");
    expect(pluralizar(2, ...frase)).toBe("2 compras que no tienen comprobante");
  });
});

describe("formatBytes", () => {
  it("usa B, KB o MB según el tamaño", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("formatUltimaActividad", () => {
  it("devuelve 'Nunca' si no hay valor", () => {
    expect(formatUltimaActividad(null)).toBe("Nunca");
    expect(formatUltimaActividad(undefined)).toBe("Nunca");
  });

  it("devuelve 'Ahora' para un instante de hace segundos", () => {
    expect(formatUltimaActividad(new Date().toISOString())).toBe("Ahora");
  });

  it("devuelve minutos para menos de una hora", () => {
    const hace10min = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect(formatUltimaActividad(hace10min)).toBe("Hace 10 min");
  });

  it("devuelve horas para menos de un día", () => {
    const hace3h = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(formatUltimaActividad(hace3h)).toBe("Hace 3 h");
  });

  it("cae a fecha+hora completa pasado un día", () => {
    const hace2dias = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    // No repite formatFechaHora acá (se prueba aparte): solo confirma que
    // NO usa el formato relativo pasado el día.
    expect(formatUltimaActividad(hace2dias)).not.toMatch(/Hace|Ahora|Nunca/);
  });
});
