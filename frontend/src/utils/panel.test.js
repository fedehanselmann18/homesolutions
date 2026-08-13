import { describe, it, expect } from "vitest";
import { calcularPanel } from "./panel";

// calcularPanel resume TODOS los proyectos para el Panel, reusando
// calcularAnalisis por proyecto -- estos tests cubren el agrupado por
// proyecto/fase, los KPIs del mes y los casos de borde (arrays vacíos,
// montos negativos, proyectos sin fase/proyecto asociado).

const HOY = new Date("2026-08-13");

describe("calcularPanel", () => {
  it("con todo vacío, no explota y devuelve KPIs en cero", () => {
    const resultado = calcularPanel({});
    expect(resultado.kpis.enCurso).toBe(0);
    expect(resultado.kpis.terminados).toBe(0);
    expect(resultado.kpis.aIniciar).toBe(0);
    expect(resultado.kpis.disponibleTotal).toBe(0);
    expect(resultado.kpis.cobradoMes).toBe(0);
    expect(resultado.kpis.pendienteDeCobrar).toBe(0);
    expect(resultado.kpis.gananciaNetaMes).toBe(0);
    expect(resultado.proyectosActivos).toEqual([]);
    expect(resultado.actividad).toEqual([]);
    expect(resultado.evolucion).toHaveLength(6);
  });

  it("cuenta proyectos por estado (en_curso / terminado / a_iniciar)", () => {
    const resultado = calcularPanel({
      proyectos: [
        { id: 1, estado: "en_curso" },
        { id: 2, estado: "en_curso" },
        { id: 3, estado: "terminado" },
        { id: 4, estado: "a_iniciar" },
      ],
      hoy: HOY,
    });
    expect(resultado.kpis.enCurso).toBe(2);
    expect(resultado.kpis.terminados).toBe(1);
    expect(resultado.kpis.aIniciar).toBe(1);
  });

  it("agrupa compras por fase -> proyecto usando fase.proyecto_id (no compra.proyecto_id)", () => {
    const resultado = calcularPanel({
      proyectos: [{ id: 1, estado: "en_curso", precio_acordado: 10000 }],
      fases: [{ id: 10, proyecto_id: 1 }],
      compras: [{ fase_id: 10, precio_neto: 500, impuestos_aplicados: [], notas: [], fecha: "2026-08-01" }],
      hoy: HOY,
    });
    expect(resultado.proyectosActivos[0].egresos).toBe(500);
  });

  it("una compra con fase_id que no matchea ninguna fase no rompe el agrupado (queda huérfana)", () => {
    const resultado = calcularPanel({
      proyectos: [{ id: 1, estado: "en_curso", precio_acordado: 10000 }],
      fases: [{ id: 10, proyecto_id: 1 }],
      compras: [{ fase_id: 999, precio_neto: 500, impuestos_aplicados: [], notas: [], fecha: "2026-08-01" }],
      hoy: HOY,
    });
    expect(resultado.proyectosActivos[0].egresos).toBe(0);
  });

  it("pendienteDeCobrar nunca es negativo: un proyecto que cobró de más no compensa a otro que debe", () => {
    const resultado = calcularPanel({
      proyectos: [
        { id: 1, estado: "en_curso", precio_acordado: 1000 },
        { id: 2, estado: "en_curso", precio_acordado: 1000 },
      ],
      cobros: [
        { proyecto_id: 1, monto_neto: 1500, fecha: "2026-06-01" }, // cobró de más
        { proyecto_id: 2, monto_neto: 200, fecha: "2026-06-01" }, // le falta 800
      ],
      hoy: HOY,
    });
    expect(resultado.kpis.pendienteDeCobrar).toBe(800);
  });

  it("gananciaNetaMes puede dar negativa si se gastó más de lo cobrado en el mes", () => {
    const resultado = calcularPanel({
      proyectos: [{ id: 1, estado: "en_curso" }],
      gastos: [{ proyecto_id: 1, monto: 5000, fecha: "2026-08-05" }],
      cobros: [{ proyecto_id: 1, monto_neto: 1000, fecha: "2026-08-05" }],
      hoy: HOY,
    });
    expect(resultado.kpis.gananciaNetaMes).toBe(-4000);
  });

  it("un gasto con monto negativo (corrección) se resta del total del mes en vez de sumarse", () => {
    const resultado = calcularPanel({
      proyectos: [{ id: 1, estado: "en_curso" }],
      gastos: [
        { proyecto_id: 1, monto: 1000, fecha: "2026-08-05" },
        { proyecto_id: 1, monto: -300, fecha: "2026-08-06" },
      ],
      hoy: HOY,
    });
    expect(resultado.kpis.gananciaNetaMes).toBe(-700);
  });

  it("solo cuenta movimientos del mes actual (hoy) para cobradoMes/gastosMes", () => {
    const resultado = calcularPanel({
      proyectos: [{ id: 1, estado: "en_curso" }],
      cobros: [
        { proyecto_id: 1, monto_neto: 1000, fecha: "2026-08-01" }, // este mes
        { proyecto_id: 1, monto_neto: 5000, fecha: "2026-07-01" }, // mes anterior, no cuenta
      ],
      hoy: HOY,
    });
    expect(resultado.kpis.cobradoMes).toBe(1000);
  });

  it("proyectosActivos solo incluye proyectos en_curso, ordenados por % de presupuesto gastado desc", () => {
    const resultado = calcularPanel({
      proyectos: [
        { id: 1, estado: "en_curso", precio_acordado: 1000 },
        { id: 2, estado: "en_curso", precio_acordado: 1000 },
        { id: 3, estado: "terminado", precio_acordado: 1000 },
      ],
      gastos: [
        { proyecto_id: 1, monto: 100, fecha: "2026-08-01" },
        { proyecto_id: 2, monto: 900, fecha: "2026-08-01" },
      ],
      hoy: HOY,
    });
    expect(resultado.proyectosActivos).toHaveLength(2);
    expect(resultado.proyectosActivos[0].id).toBe(2); // gastó 90%, va primero
    expect(resultado.proyectosActivos[1].id).toBe(1);
  });

  it("cuenta compras impagas y su monto por proyecto activo", () => {
    const resultado = calcularPanel({
      proyectos: [{ id: 1, estado: "en_curso" }],
      fases: [{ id: 10, proyecto_id: 1 }],
      compras: [
        { fase_id: 10, precio_total: 300, precio_neto: 300, impuestos_aplicados: [], notas: [], estado_pago: "pendiente", estado_envio: "entregado", fecha: "2026-08-01" },
        { fase_id: 10, precio_total: 200, precio_neto: 200, impuestos_aplicados: [], notas: [], estado_pago: "pagado", estado_envio: "entregado", fecha: "2026-08-01" },
      ],
      hoy: HOY,
    });
    expect(resultado.proyectosActivos[0].comprasImpagas).toBe(1);
    expect(resultado.proyectosActivos[0].montoImpago).toBe(300);
  });

  it("armarActividad limita a los 8 movimientos más recientes de todos los proyectos", () => {
    const gastos = Array.from({ length: 10 }, (_, i) => ({
      proyecto_id: 1,
      id: i,
      monto: 10,
      fecha: `2026-08-${String(i + 1).padStart(2, "0")}`,
    }));
    const resultado = calcularPanel({
      proyectos: [{ id: 1, estado: "en_curso" }],
      gastos,
      hoy: HOY,
    });
    expect(resultado.actividad).toHaveLength(8);
    expect(resultado.actividad[0].fecha).toBe("2026-08-10"); // el más reciente primero
  });

  it("evolucion arma 6 meses terminando en 'hoy', con cobrado/gastado en cero si no hay movimientos", () => {
    const resultado = calcularPanel({ hoy: HOY });
    expect(resultado.evolucion).toHaveLength(6);
    expect(resultado.evolucion.at(-1).mes).toBe("2026-08");
    resultado.evolucion.forEach((m) => {
      expect(m.cobrado).toBe(0);
      expect(m.gastado).toBe(0);
    });
  });
});
