import uuid
from datetime import date

from pydantic import BaseModel


class AISuggestedItem(BaseModel):
    """
    Una línea de producto que la IA propone para el detalle de una Compra.
    Solo se sugiere si el producto pertenece al proveedor ya resuelto en la
    misma extracción (ver _validar_y_limpiar) -- precio_unitario NUNCA sale
    de acá: sigue siendo el precio de catálogo (Producto.precio), congelado
    al elegir el producto, igual que si lo cargaras a mano en ModalCompra.
    """

    producto_id: uuid.UUID
    cantidad: float


class AISuggestedTax(BaseModel):
    """
    Una línea de impuesto (IVA, percepciones, retenciones...) que la IA leyó
    del comprobante. A diferencia de precio_unitario en IADetalleSugerido,
    acá `monto` SÍ sale directo de la factura -- es un importe de plata ya
    impreso ahí (no un id que haya que inventar), así que no hay el mismo
    riesgo que con matchear productos. impuesto_id solo se acepta si
    coincide con uno del catálogo que mandó el front (ver _validar_y_limpiar).
    """

    impuesto_id: uuid.UUID
    monto: float


class AIReceiptExtraction(BaseModel):
    """
    Resultado de leer un comprobante (factura/remito/recibo) con Gemini, para
    prellenar ModalGasto/ModalCompra/ModalCobro (ver app/api/ai.py).

    No se persiste nada acá -- es 100% para prellenar el formulario, el
    usuario siempre revisa y confirma con el submit normal antes de guardar.
    Los campos que no aplican al tipo de entidad pedido quedan en None (ej.
    Cobro no tiene fase/categoría/proveedor; Compra no tiene "monto" porque
    precio_neto se calcula solo a partir del detalle de productos, nunca se
    tipea a mano, ver ModalCompra.jsx).

    proveedor_id/fase_id/categoria_gasto_id solo se completan si coinciden
    EXACTO con un id de la lista que el front mandó en `contexto` -- si
    Gemini sugiere algo que no está en esa lista, se descarta a None y se
    agrega un aviso en `advertencias` en vez de guardar una referencia
    inventada (ver _validar_y_limpiar en app/ai/extractor.py). Mismo
    criterio para `detalle`: cada línea se descarta si el producto no existe
    en el catálogo que mandó el front o no pertenece al proveedor resuelto.
    """

    monto: float | None = None
    fecha: date | None = None
    tipo_factura: str | None = None
    descripcion: str | None = None
    proveedor_id: uuid.UUID | None = None
    fase_id: uuid.UUID | None = None
    categoria_gasto_id: uuid.UUID | None = None
    detalle: list[AISuggestedItem] = []
    impuestos: list[AISuggestedTax] = []
    advertencias: list[str] = []


class AISuggestedCatalogSupplier(BaseModel):
    """
    Proveedor que la IA cree haber identificado en el encabezado/pie del
    catálogo, cuando el front no mandó un proveedor_id fijo (ver
    app/ai/catalog.py). "existente" significa que matcheó (por nombre o
    cuit, comparación laxa) contra alguno de `contexto.proveedores` -- ahí
    solo importan id/nombre. "nuevo" significa que no matcheó ninguno: se
    devuelve lo que se haya podido leer del documento (puede venir con
    campos en None) para que el usuario los complete a mano antes de crear
    el proveedor.
    """

    tipo: str  # "existente" | "nuevo"
    id: uuid.UUID | None = None
    nombre: str | None = None
    cuit: str | None = None
    telefono: str | None = None
    email: str | None = None


class AICatalogProduct(BaseModel):
    """
    Una línea de producto detectada en el catálogo. `estado` la clasifica
    contra el catálogo actual del proveedor (contexto.productos, solo
    disponible si el front ya mandó un proveedor_id fijo): "nuevo" si no
    matcheó ningún producto existente (por marca+modelo), "actualiza_precio"
    si matcheó pero el precio detectado es distinto al actual, "sin_cambios"
    si matcheó y el precio es igual. producto_id/precio_actual solo vienen
    completos cuando matcheó contra algo existente.

    categoria_ids solo tiene sentido cuando estado == "nuevo": un producto
    que ya existía (actualiza_precio/sin_cambios) ya tiene sus categorías
    asignadas de antes, así que ahí siempre queda en lista vacía -- no hay
    nada que sugerir ni que pisar.
    """

    marca: str
    modelo: str
    tipo: str | None = None  # equipo/materiales/mano_obra -- None si no se pudo reconocer
    precio: float
    estado: str  # "nuevo" | "actualiza_precio" | "sin_cambios"
    producto_id: uuid.UUID | None = None
    precio_actual: float | None = None
    categoria_ids: list[uuid.UUID] = []


class AICatalogReading(BaseModel):
    """
    Resultado de leer un catálogo de proveedor (Excel/CSV/PDF/imagen) con
    Gemini, para prellenar el modal de importación (ver app/api/ai.py). No se
    persiste nada acá -- el usuario revisa la vista previa y confirma fila
    por fila antes de que el front llame a los endpoints normales de
    proveedores/productos.
    """

    proveedor_sugerido: AISuggestedCatalogSupplier | None = None
    productos: list[AICatalogProduct] = []
    advertencias: list[str] = []
