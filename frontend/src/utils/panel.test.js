import { describe, it, expect } from "vitest";
import { calcularPanel } from "./panel";

// calcularPanel resume TODOS los proyectos para el Panel, reusando
// calcularAnalisis por proyecto -- estos tests cubren el agrupado por
// proyecto/fase, los KPIs del mes y los casos de borde (arrays vacíos,
// montos negativos, proyectos sin fase/proyecto asociado). Los fixtures van
// en dólares, la moneda default del panel.

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
      proyectos: [{ id: 1, estado: "en_curso", precio_acordado_usd: 10000 }],
      fases: [{ id: 10, proyecto_id: 1 }],
      compras: [
        {
          fase_id: 10,
          precio_neto_usd: 500,
          impuestos_aplicados: [],
          notas: [],
          fecha: "2026-08-01",
        },
      ],
      hoy: HOY,
    });
    expect(resultado.proyectosActivos[0].egresos).toBe(500);
  });

  it("una compra con fase_id que no matchea ninguna fase no rompe el agrupado (queda huérfana)", () => {
    const resultado = calcularPanel({
      proyectos: [{ id: 1, estado: "en_curso", precio_acordado_usd: 10000 }],
      fases: [{ id: 10, proyecto_id: 1 }],
      compras: [
        {
          fase_id: 999,
          precio_neto_usd: 500,
          impuestos_aplicados: [],
          notas: [],
          fecha: "2026-08-01",
        },
      ],
      hoy: HOY,
    });
    expect(resultado.proyectosActivos[0].egresos).toBe(0);
  });

  it("pendienteDeCobrar nunca es negativo: un proyecto que cobró de más no compensa a otro que debe", () => {
    const resultado = calcularPanel({
      proyectos: [
        { id: 1, estado: "en_curso", precio_acordado_usd: 1000 },
        { id: 2, estado: "en_curso", precio_acordado_usd: 1000 },
      ],
      cobros: [
        { proyecto_id: 1, monto_neto_usd: 1500, fecha: "2026-06-01" }, // cobró de más
        { proyecto_id: 2, monto_neto_usd: 200, fecha: "2026-06-01" }, // le falta 800
      ],
      hoy: HOY,
    });
    expect(resultado.kpis.pendienteDeCobrar).toBe(800);
  });

  it("gananciaNetaMes puede dar negativa si se gastó más de lo cobrado en el mes", () => {
    const resultado = calcularPanel({
      proyectos: [{ id: 1, estado: "en_curso" }],
      gastos: [{ proyecto_id: 1, monto_usd: 5000, fecha: "2026-08-05" }],
      cobros: [{ proyecto_id: 1, monto_neto_usd: 1000, fecha: "2026-08-05" }],
      hoy: HOY,
    });
    expect(resultado.kpis.gananciaNetaMes).toBe(-4000);
  });

  it("un gasto con monto negativo (corrección) se resta del total del mes en vez de sumarse", () => {
    const resultado = calcularPanel({
      proyectos: [{ id: 1, estado: "en_curso" }],
      gastos: [
        { proyecto_id: 1, monto_usd: 1000, fecha: "2026-08-05" },
        { proyecto_id: 1, monto_usd: -300, fecha: "2026-08-06" },
      ],
      hoy: HOY,
    });
    expect(resultado.kpis.gananciaNetaMes).toBe(-700);
  });

  it("solo cuenta movimientos del mes actual (hoy) para cobradoMes/gastosMes", () => {
    const resultado = calcularPanel({
      proyectos: [{ id: 1, estado: "en_curso" }],
      cobros: [
        { proyecto_id: 1, monto_neto_usd: 1000, fecha: "2026-08-01" }, // este mes
        { proyecto_id: 1, monto_neto_usd: 5000, fecha: "2026-07-01" }, // mes anterior, no cuenta
      ],
      hoy: HOY,
    });
    expect(resultado.kpis.cobradoMes).toBe(1000);
  });

  it("proyectosActivos solo incluye proyectos en_curso, ordenados por % de presupuesto gastado desc", () => {
    const resultado = calcularPanel({
      proyectos: [
        { id: 1, estado: "en_curso", precio_acordado_usd: 1000 },
        { id: 2, estado: "en_curso", precio_acordado_usd: 1000 },
        { id: 3, estado: "terminado", precio_acordado_usd: 1000 },
      ],
      gastos: [
        { proyecto_id: 1, monto_usd: 100, fecha: "2026-08-01" },
        { proyecto_id: 2, monto_usd: 900, fecha: "2026-08-01" },
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
        {
          fase_id: 10,
          precio_total_usd: 300,
          precio_neto_usd: 300,
          impuestos_aplicados: [],
          notas: [],
          estado_pago: "pendiente",
          estado_envio: "entregado",
          fecha: "2026-08-01",
        },
        {
          fase_id: 10,
          precio_total_usd: 200,
          precio_neto_usd: 200,
          impuestos_aplicados: [],
          notas: [],
          estado_pago: "pagado",
          estado_envio: "entregado",
          fecha: "2026-08-01",
        },
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
      monto_usd: 10,
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

  describe("kpis.requiereAccion", () => {
    it("suma compras impagas + sin entregar + fases estancadas de todos los proyectos en curso", () => {
      const resultado = calcularPanel({
        proyectos: [
          { id: 1, estado: "en_curso" },
          { id: 2, estado: "en_curso" },
        ],
        fases: [
          // fase estancada: entró en_curso hace más de 30 días.
          { id: 10, proyecto_id: 1, estado: "en_curso", fecha_en_curso_desde: "2026-06-01" },
          { id: 20, proyecto_id: 2, estado: "en_curso", fecha_en_curso_desde: "2026-08-10" },
        ],
        compras: [
          // proyecto 1: una compra impaga y sin entregar a la vez -> cuenta como 2 acciones.
          {
            fase_id: 10,
            precio_total_usd: 100,
            precio_neto_usd: 100,
            impuestos_aplicados: [],
            notas: [],
            estado_pago: "pendiente",
            estado_envio: "pedido",
            fecha: "2026-08-01",
          },
          // proyecto 2: una compra pagada y entregada -> no suma nada.
          {
            fase_id: 20,
            precio_total_usd: 50,
            precio_neto_usd: 50,
            impuestos_aplicados: [],
            notas: [],
            estado_pago: "pagado",
            estado_envio: "entregado",
            fecha: "2026-08-01",
          },
        ],
        hoy: HOY,
      });

      // proyecto 1: 1 impaga + 1 sin entregar + 1 fase estancada = 3
      // proyecto 2: 0 + 0 + 0 (fase tocada hace 3 días, no estancada) = 0
      expect(resultado.kpis.requiereAccion).toBe(3);
      expect(resultado.kpis.comprasImpagasEnCurso).toBe(1);
      expect(resultado.kpis.comprasSinEntregarEnCurso).toBe(1);
      expect(resultado.kpis.fasesEstancadasEnCurso).toBe(1);
      expect(resultado.proyectosActivos.find((p) => p.id === 1).fasesEstancadas).toBe(1);
      expect(resultado.proyectosActivos.find((p) => p.id === 2).fasesEstancadas).toBe(0);
    });

    it("una fase por_empezar o terminada nunca cuenta como estancada, sin importar la antigüedad", () => {
      const resultado = calcularPanel({
        proyectos: [{ id: 1, estado: "en_curso" }],
        fases: [
          { id: 10, proyecto_id: 1, estado: "por_empezar", fecha_en_curso_desde: null },
          { id: 11, proyecto_id: 1, estado: "terminada", fecha_en_curso_desde: null },
        ],
        hoy: HOY,
      });
      expect(resultado.kpis.requiereAccion).toBe(0);
    });

    it("con todo vacío, requiereAccion es 0", () => {
      const resultado = calcularPanel({});
      expect(resultado.kpis.requiereAccion).toBe(0);
    });
  });

  it("proyectosActivos expone fasesResumen (id + estado) para la barra de segmentos", () => {
    const resultado = calcularPanel({
      proyectos: [{ id: 1, estado: "en_curso" }],
      fases: [
        { id: 10, proyecto_id: 1, estado: "terminada", fecha_actualizacion: "2026-08-01" },
        { id: 11, proyecto_id: 1, estado: "en_curso", fecha_actualizacion: "2026-08-10" },
      ],
      hoy: HOY,
    });
    expect(resultado.proyectosActivos[0].fasesResumen).toEqual([
      { id: 10, estado: "terminada" },
      { id: 11, estado: "en_curso" },
    ]);
  });

  describe("proyectosResumen", () => {
    it("incluye proyectos de los 3 estados (no sólo en_curso, a diferencia de proyectosActivos)", () => {
      const resultado = calcularPanel({
        proyectos: [
          { id: 1, estado: "en_curso", nombre: "En curso" },
          { id: 2, estado: "a_iniciar", nombre: "A iniciar" },
          { id: 3, estado: "terminado", nombre: "Terminado" },
        ],
        hoy: HOY,
      });
      expect(resultado.proyectosResumen).toHaveLength(3);
      expect(resultado.proyectosResumen.map((p) => p.estado).sort()).toEqual([
        "a_iniciar",
        "en_curso",
        "terminado",
      ]);
      // proyectosActivos sigue filtrando sólo en_curso, como siempre.
      expect(resultado.proyectosActivos).toHaveLength(1);
      expect(resultado.proyectosActivos[0].estado).toBe("en_curso");
    });

    it("cada fila de proyectosResumen trae su propio estado", () => {
      const resultado = calcularPanel({
        proyectos: [{ id: 1, estado: "terminado", nombre: "Loft Palermo" }],
        hoy: HOY,
      });
      expect(resultado.proyectosResumen[0]).toMatchObject({ id: 1, estado: "terminado" });
    });
  });

  describe("doble moneda", () => {
    const base = {
      proyectos: [{ id: 1, estado: "en_curso", precio_acordado_usd: 1000 }],
      cobros: [
        { proyecto_id: 1, monto_neto_usd: 400, monto_neto_ars: 400000, fecha: "2026-08-01" },
      ],
      gastos: [{ proyecto_id: 1, monto_usd: 50, monto_ars: 60000, fecha: "2026-08-02" }],
      hoy: HOY,
    };

    it("en pesos suma las cifras congeladas en pesos de cada movimiento", () => {
      const { kpis, proyectosActivos } = calcularPanel({
        ...base,
        moneda: "ars",
        cotizacionActual: { valor: 1500 },
      });
      expect(kpis.cobradoMes).toBe(400000);
      expect(kpis.gananciaNetaMes).toBe(340000);
      expect(proyectosActivos[0].moneda).toBe("ars");
    });

    it("el pendiente de cobrar se cuenta en USD y en pesos se pasa con la cotización actual", () => {
      expect(calcularPanel(base).kpis.pendienteDeCobrar).toBe(600);
      const enPesos = calcularPanel({ ...base, moneda: "ars", cotizacionActual: { valor: 1500 } });
      expect(enPesos.kpis.pendienteDeCobrar).toBe(900000);
    });

    it("sin cotización cargada, lo que depende del precio en pesos queda en null", () => {
      const { kpis } = calcularPanel({ ...base, moneda: "ars" });
      expect(kpis.pendienteDeCobrar).toBeNull();
      expect(kpis.contratadoEnCurso).toBeNull();
    });
  });
});

describe("calcularPanel — Para resolver y deuda con proveedores", () => {
  const hoy = new Date("2026-10-07T12:00:00");
  const hace = (dias) => {
    const fecha = new Date(hoy);
    fecha.setDate(fecha.getDate() - dias);
    return fecha.toISOString().slice(0, 10);
  };
  const proyectos = [
    { id: "p1", estado: "en_curso", nombre: "Olleros", precio_acordado_usd: 1000 },
  ];
  const fases = [{ id: "f1", proyecto_id: "p1", estado: "en_curso", orden: 1, nombre: "Montaje" }];
  const compra = (id, dias, extra = {}) => ({
    id,
    fase_id: "f1",
    proveedor_id: "pr1",
    descripcion: `Compra ${id}`,
    fecha: hace(dias),
    estado_pago: "pendiente",
    estado_envio: "entregado",
    precio_total_ars: 1000,
    precio_total_usd: 1,
    comprobantes: [{ id: 1 }],
    ...extra,
  });

  it("ordena por urgencia: la deuda vencida primero, después lo más viejo", () => {
    const panel = calcularPanel({
      proyectos,
      fases,
      compras: [compra("a", 10), compra("b", 120), compra("c", 40)],
      proveedores: [{ id: "pr1", nombre: "Aluar" }],
      hoy,
    });
    expect(panel.paraResolver.map((i) => i.key)).toEqual(["pago-b", "pago-c", "pago-a"]);
    expect(panel.paraResolver[0]).toMatchObject({ nivel: "problema", proveedor: "Aluar" });
    expect(panel.proyectosActivos[0].faseActual.texto).toBe("Fase 1 de 1 · Montaje");
  });

  it("la deuda con proveedores suma todas las compras impagas en pesos", () => {
    const panel = calcularPanel({
      proyectos,
      fases,
      compras: [compra("a", 10), compra("b", 120), compra("c", 5, { estado_pago: "pagado" })],
      hoy,
    });
    expect(panel.kpis.deudaProveedores).toEqual({ monto: 2000, compras: 2, vencidas: 1 });
  });
});
