import { useState } from "react";

// Arma en memoria el objeto que espera POST /compras/crear:
// { fase_id, proveedor_id, descripcion, precio_neto, tipo_factura, fecha,
//   condicion_pago, estado_pago, estado_envio,
//   detalle: [{ producto_id, cantidad, precio_unitario }],
//   impuestos: [{ impuesto_id, monto }] }
//
// No pega contra el backend hasta que se llama a construirPayload() y se
// manda con agregarCompra() de useCompras. Esto evita crear la compra a medias
// si el usuario todavía está cargando líneas de producto.

export function useCompraForm() {
  const [datosCompra, setDatosCompra] = useState({
    fase_id: "",
    proveedor_id: "",
    descripcion: "",
    precio_neto: "",
    tipo_factura: "",
    fecha: "",
    condicion_pago: "",
    estado_pago: "",
    estado_envio: "",
  });

  const [detalle, setDetalle] = useState([]); // [{ producto_id, cantidad, precio_unitario }]
  const [impuestos, setImpuestos] = useState([]); // [{ impuesto_id, monto }]

  const actualizarCampo = (campo, valor) => {
    setDatosCompra((prev) => ({ ...prev, [campo]: valor }));
  };

  const agregarLineaDetalle = (linea) => {
    // linea: { producto_id, cantidad, precio_unitario }
    setDetalle((prev) => [...prev, linea]);
  };

  const quitarLineaDetalle = (index) => {
    setDetalle((prev) => prev.filter((_, i) => i !== index));
  };

  const agregarLineaImpuesto = (linea) => {
    // linea: { impuesto_id, monto }
    setImpuestos((prev) => [...prev, linea]);
  };

  const quitarLineaImpuesto = (index) => {
    setImpuestos((prev) => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setDatosCompra({
      fase_id: "",
      proveedor_id: "",
      descripcion: "",
      precio_neto: "",
      tipo_factura: "",
      fecha: "",
      condicion_pago: "",
      estado_pago: "",
      estado_envio: "",
    });
    setDetalle([]);
    setImpuestos([]);
  };

  const construirPayload = () => ({
    ...datosCompra,
    detalle,
    impuestos,
  });

  return {
    datosCompra,
    detalle,
    impuestos,
    actualizarCampo,
    agregarLineaDetalle,
    quitarLineaDetalle,
    agregarLineaImpuesto,
    quitarLineaImpuesto,
    construirPayload,
    resetForm,
  };
}
