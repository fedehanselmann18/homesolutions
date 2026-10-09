// Lo que devuelve GET /tipos-factura/ recién migrado (los de fábrica +
// «Factura interna», «Otros» último). Para los tests que mockean
// useTiposFactura.
export const TIPOS_FACTURA_PRUEBA = [
  { id: "t1", codigo: "factura_a", nombre: "Factura A", orden: 1, protegido: false },
  { id: "t2", codigo: "factura_b", nombre: "Factura B", orden: 2, protegido: false },
  { id: "t3", codigo: "factura_c", nombre: "Factura C", orden: 3, protegido: false },
  { id: "t4", codigo: "remito", nombre: "Remito", orden: 4, protegido: false },
  { id: "t5", codigo: "recibo", nombre: "Recibo", orden: 5, protegido: false },
  { id: "t6", codigo: "factura_interna", nombre: "Factura interna", orden: 6, protegido: false },
  { id: "t7", codigo: "otros", nombre: "Otros", orden: 7, protegido: true },
];

// Lo que devuelve GET /condiciones-pago/ recién migrado.
export const CONDICIONES_PAGO_PRUEBA = [
  { id: "cp0", nombre: "Contado", dias: [], orden: 1, protegido: true },
  { id: "cp30", nombre: "30 días", dias: [30], orden: 2, protegido: false },
  { id: "cp3060", nombre: "30/60 días", dias: [30, 60], orden: 3, protegido: false },
];
