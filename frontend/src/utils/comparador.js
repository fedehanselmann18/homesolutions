// Comparador de precios entre proveedores.
//
// Dos formas de comparar, pensadas para el momento de armar una compra:
// 1) agruparPorProducto: mismo producto EXACTO (marca+modelo) ofrecido por
//    más de un proveedor -> comparación 1 a 1, "quién lo tiene más barato".
// 2) filtrarProductos: navegar el catálogo completo por categoría/tipo/texto,
//    para cuando no hay match exacto de marca+modelo pero igual querés ver
//    qué hay disponible y a qué precio (comparación más laxa, de mercado).

const normalizar = (texto) => (texto ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const nombreProveedor = (proveedorId, proveedores) =>
  proveedores.find((p) => p.id === proveedorId)?.nombre ?? "Proveedor eliminado";

/**
 * Agrupa productos de distintos proveedores por marca+modelo (comparación
 * case/espacios-insensitive). Solo devuelve grupos donde el mismo marca+modelo
 * aparece en 2 o más proveedores distintos -- si solo lo vende uno, no hay
 * nada que comparar.
 *
 * Cada grupo trae sus ofertas ordenadas de más barata a más cara, y el
 * porcentaje de ahorro entre la más cara y la más barata, para poder ordenar
 * los grupos por "cuánto conviene mirar esto".
 */
export function agruparPorProducto(productos = [], proveedores = []) {
  const grupos = new Map();

  productos.forEach((producto) => {
    const clave = `${normalizar(producto.marca)}|${normalizar(producto.modelo)}`;
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(producto);
  });

  return [...grupos.values()]
    .filter((grupo) => new Set(grupo.map((p) => p.proveedor_id)).size > 1)
    .map((grupo) => {
      const ofertas = [...grupo]
        .sort((a, b) => a.precio - b.precio)
        .map((p) => ({ ...p, proveedorNombre: nombreProveedor(p.proveedor_id, proveedores) }));

      const masBarato = ofertas[0].precio;
      const masCaro = ofertas[ofertas.length - 1].precio;

      return {
        clave: `${normalizar(grupo[0].marca)}|${normalizar(grupo[0].modelo)}`,
        marca: grupo[0].marca,
        modelo: grupo[0].modelo,
        tipo: grupo[0].tipo,
        categorias: grupo[0].categorias ?? [],
        ofertas,
        masBarato,
        masCaro,
        ahorro: masCaro - masBarato,
        ahorroPct: masCaro > 0 ? ((masCaro - masBarato) / masCaro) * 100 : 0,
      };
    })
    .sort((a, b) => b.ahorroPct - a.ahorroPct);
}

/**
 * Catálogo completo (todos los proveedores) filtrado por categoría/tipo/texto
 * y ordenado por precio ascendente. Para "qué hay en Aires" aunque no sea
 * exactamente el mismo modelo entre proveedores.
 */
export function filtrarProductos(productos = [], proveedores = [], { categoriaId = "", tipo = "", texto = "" } = {}) {
  const textoNormalizado = normalizar(texto);

  return productos
    .filter((p) => !categoriaId || (p.categorias ?? []).some((c) => c.id === categoriaId))
    .filter((p) => !tipo || p.tipo === tipo)
    .filter(
      (p) =>
        !textoNormalizado ||
        normalizar(p.marca).includes(textoNormalizado) ||
        normalizar(p.modelo).includes(textoNormalizado)
    )
    .map((p) => ({ ...p, proveedorNombre: nombreProveedor(p.proveedor_id, proveedores) }))
    .sort((a, b) => a.precio - b.precio);
}
