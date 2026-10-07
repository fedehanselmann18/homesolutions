import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";

import { useLecturaCatalogoIA } from "../../hooks/useLecturaCatalogoIA";
import { useToast } from "../../context/useToast";
import { crearProveedor } from "../../services/proveedorService";
import { crearProducto, actualizarProducto } from "../../services/productoService";
import { obtenerMensajeError } from "../../utils/errorHandling";
import { formatMoneda } from "../../utils/formato";
import { TIPOS_PRODUCTO } from "../../constants/tipoProducto";
import ModalShell from "./ModalShell";
import { BotonIA } from "./PiezasIA";
import ChipsCategorias from "./ChipsCategorias";
import { ZonaArchivo, FilaArchivo } from "../shared/ComprobantesUploader";
import { describirArchivo } from "../../utils/archivos";
import "./PiezasIA.css";
import "./ModalImportarCatalogo.css";
import { LogoCargando } from "../shared/LogoCargando";

const EXTENSIONES_PERMITIDAS = [".pdf", ".jpg", ".jpeg", ".png", ".xlsx", ".csv"];
const TAMANIO_MAXIMO_BYTES = 10 * 1024 * 1024; // 10MB, espejo de backend/app/routes/ia.py

let contadorFilaTemp = 0;
const nuevaFilaId = () => `catalogo-${++contadorFilaTemp}`;

// Comparación laxa (minúsculas, sin puntuación, espacios colapsados), mismo
// criterio que _normalizar en backend/app/ia/catalogo.py -- se usa para
// reclasificar en el momento cuando el usuario resuelve un proveedor
// "en caliente" (ver resolverProveedorExistente) sin volver a llamar a la IA.
const normalizar = (texto) =>
  (texto ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const reclasificarFilas = (filas, productosDelProveedor) => {
  const indice = new Map(
    productosDelProveedor.map((p) => [`${normalizar(p.marca)}|${normalizar(p.modelo)}`, p])
  );
  return filas.map((fila) => {
    const existente = indice.get(`${normalizar(fila.marca)}|${normalizar(fila.modelo)}`);
    if (!existente) {
      // categoria_ids se conserva tal cual vino de la IA -- sigue siendo "nuevo".
      return { ...fila, estado: "nuevo", producto_id: null, precio_actual: null };
    }
    const mismoPrecio = Number(existente.precio) === Number(fila.precio);
    return {
      ...fila,
      estado: mismoPrecio ? "sin_cambios" : "actualiza_precio",
      producto_id: existente.id,
      precio_actual: existente.precio,
      // Ya matcheó con un producto que existe -- ese producto ya tiene su
      // categoría, no hay nada que sugerir ni que pisar desde acá.
      categoria_ids: [],
      seleccionada: !mismoPrecio && Boolean(fila.tipo),
    };
  });
};

/**
 * Popover compacto de checkboxes para elegir categorías dentro de una celda
 * de la tabla -- mismo criterio de "filtrar por tipo" que
 * ModalProducto.jsx (categoriasDelTipo), pero sin ocupar el ancho de un
 * grid completo. Si el tipo de la fila no tiene categorías cargadas (o la
 * fila todavía no tiene tipo), no hay nada para elegir.
 *
 * El popover se porta a document.body (position: fixed, posicionado a mano
 * con getBoundingClientRect) en vez de vivir como hijo normal de la celda:
 * .catalogo-tabla-wrap tiene overflow-x: auto para que la tabla scrollee
 * horizontalmente, y eso recorta cualquier descendiente absolute que se
 * salga de su caja aunque tenga z-index alto -- un popover angosto en una
 * tabla ancha terminaba invisible (quedaba en el DOM pero clippeado).
 */
function SelectorCategorias({
  categoriaIds,
  tipo,
  categoriasDisponibles,
  onChange,
  onCategoriaCreada,
}) {
  const [abierto, setAbierto] = useState(false);
  const [posicion, setPosicion] = useState(null);
  const botonRef = useRef(null);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!abierto) return;
    const cerrarSiEsAfuera = (e) => {
      if (botonRef.current?.contains(e.target) || popoverRef.current?.contains(e.target)) return;
      setAbierto(false);
    };
    document.addEventListener("mousedown", cerrarSiEsAfuera);
    return () => document.removeEventListener("mousedown", cerrarSiEsAfuera);
  }, [abierto]);

  // Sin tipo no hay categorías posibles (son sub-rubros de un tipo), así que
  // no hay ni siquiera una categoría que crear -- ahí sí queda el guión.
  if (!tipo) {
    return <span className="catalogo-categorias-vacio">—</span>;
  }

  const categoriasDelTipo = categoriasDisponibles.filter((c) => c.tipo === tipo);

  const toggle = (id) => {
    onChange(
      categoriaIds.includes(id) ? categoriaIds.filter((x) => x !== id) : [...categoriaIds, id]
    );
  };

  const etiqueta = categoriaIds.length
    ? categoriasDelTipo
        .filter((c) => categoriaIds.includes(c.id))
        .map((c) => c.nombre)
        .join(", ")
    : categoriasDelTipo.length === 0
      ? "Crear categoría..."
      : "Elegir...";

  const abrir = () => {
    const rect = botonRef.current.getBoundingClientRect();
    // El popover mide 280px fijos (ver .catalogo-categorias-popover): en
    // mobile, un botón cerca del borde derecho de la tabla lo mandaba fuera
    // del viewport (no hay forma de llegar a los checkboxes). Se clampea el
    // left para que quede siempre dentro de la pantalla.
    const left = Math.min(rect.left, window.innerWidth - 280 - 8);
    setPosicion({ top: rect.bottom + 4, left: Math.max(8, left) });
    setAbierto((v) => !v);
  };

  return (
    <div className="catalogo-categorias-selector">
      <button
        type="button"
        ref={botonRef}
        className="catalogo-categorias-boton"
        onClick={abrir}
        title={etiqueta}
      >
        {etiqueta}
      </button>
      {abierto &&
        createPortal(
          <div
            ref={popoverRef}
            className="catalogo-categorias-popover"
            style={{ top: posicion.top, left: posicion.left }}
          >
            <ChipsCategorias
              categoriaIds={categoriaIds}
              tipo={tipo}
              categoriasDisponibles={categoriasDisponibles}
              onToggle={toggle}
              onLimpiar={() => onChange([])}
              onCategoriaCreada={onCategoriaCreada}
              compacto
            />
          </div>,
          document.body
        )}
    </div>
  );
}

function BadgeEstado({ fila }) {
  if (fila.estado === "actualiza_precio") {
    return (
      <span className="badge badge--marca">
        {formatMoneda(fila.precio_actual)} → {formatMoneda(fila.precio)}
      </span>
    );
  }
  if (fila.estado === "sin_cambios") {
    return <span className="badge badge--neutro">Sin cambios</span>;
  }
  return <span className="badge badge--exito">Nuevo</span>;
}

/**
 * Importar el catálogo de un proveedor (Excel/CSV, PDF o foto de una lista
 * de precios) con IA: lee el archivo, arma una vista previa editable, y
 * recién al confirmar llama a los endpoints normales de
 * proveedores/productos -- no hay un endpoint bulk, cada fila tildada es un
 * POST /productos/crear o PUT /productos/{id} normal, en paralelo.
 *
 * Sin `proveedor` fijo (se abrió desde Proveedores.jsx), la IA además
 * intenta resolver quién es el proveedor -- ver el paso intermedio más
 * abajo. Con `proveedor` fijo (desde ProveedorDetalle.jsx) ese paso se
 * saltea directo a la tabla de productos.
 */
export function ModalImportarCatalogo({
  proveedor,
  proveedoresDisponibles = [],
  productosDelProveedor = [],
  productosTodos = [],
  categoriasDisponibles = [],
  onImportado,
  onCerrar,
  onCargarAMano,
  onCategoriaCreada,
}) {
  const { leer, leyendo } = useLecturaCatalogoIA();
  const toast = useToast();

  const [archivo, setArchivo] = useState(null);
  const [erroresArchivo, setErroresArchivo] = useState([]);
  const [arrastrando, setArrastrando] = useState(false);
  const inputArchivoRef = useRef(null);

  const [lectura, setLectura] = useState(null);
  const [filas, setFilas] = useState([]);

  const [proveedorResuelto, setProveedorResuelto] = useState(
    proveedor ? { id: proveedor.id, nombre: proveedor.nombre } : null
  );
  const [formProveedorNuevo, setFormProveedorNuevo] = useState({
    nombre: "",
    cuit: "",
    telefono: "",
    email: "",
  });
  const [eligiendoExistente, setEligiendoExistente] = useState(false);
  const [proveedorElegidoId, setProveedorElegidoId] = useState("");
  const [creandoProveedor, setCreandoProveedor] = useState(false);

  const [guardando, setGuardando] = useState(false);

  const paso = !lectura ? "carga" : !proveedorResuelto ? "proveedor" : "productos";

  // --- Paso 1: carga del archivo ---

  const validarYSetArchivo = (file) => {
    const ext = `.${file.name.split(".").pop().toLowerCase()}`;
    if (!EXTENSIONES_PERMITIDAS.includes(ext)) {
      setErroresArchivo([`${file.name}: extensión no permitida`]);
      return;
    }
    if (file.size > TAMANIO_MAXIMO_BYTES) {
      setErroresArchivo([`${file.name}: supera los 10MB`]);
      return;
    }
    setErroresArchivo([]);
    setArchivo(file);
  };

  const handleSeleccionarArchivo = (e) => {
    if (e.target.files?.length) validarYSetArchivo(e.target.files[0]);
    e.target.value = "";
  };

  const handleLeer = async () => {
    if (!archivo) return;
    try {
      const resultado = await leer(archivo, proveedor?.id ?? null, {
        proveedores: proveedor
          ? []
          : proveedoresDisponibles.map((p) => ({ id: p.id, nombre: p.nombre, cuit: p.cuit })),
        productos: proveedor
          ? productosDelProveedor.map((p) => ({
              id: p.id,
              marca: p.marca,
              modelo: p.modelo,
              tipo: p.tipo,
              precio: p.precio,
            }))
          : [],
        // No depende de si el proveedor es nuevo o existente -- depende de
        // qué productos nuevos aparezcan, así que siempre se manda.
        categorias: categoriasDisponibles.map((c) => ({
          id: c.id,
          nombre: c.nombre,
          tipo: c.tipo,
        })),
      });

      setLectura(resultado);
      setFilas(
        resultado.productos.map((p) => ({
          _id: nuevaFilaId(),
          marca: p.marca,
          modelo: p.modelo,
          tipo: p.tipo,
          precio: p.precio,
          estado: p.estado,
          producto_id: p.producto_id,
          precio_actual: p.precio_actual,
          categoria_ids: p.categoria_ids ?? [],
          seleccionada: p.estado !== "sin_cambios" && Boolean(p.tipo),
        }))
      );

      if (!proveedor && resultado.proveedor_sugerido?.tipo === "nuevo") {
        setFormProveedorNuevo({
          nombre: resultado.proveedor_sugerido.nombre ?? "",
          cuit: resultado.proveedor_sugerido.cuit ?? "",
          telefono: resultado.proveedor_sugerido.telefono ?? "",
          email: resultado.proveedor_sugerido.email ?? "",
        });
      }

      if (resultado.advertencias?.length) {
        resultado.advertencias.forEach((a) => toast.error(a));
      } else if (resultado.productos.length > 0) {
        toast.success(
          `Catálogo leído: ${resultado.productos.length} ${resultado.productos.length === 1 ? "producto reconocido" : "productos reconocidos"}.`
        );
      }
    } catch (err) {
      toast.error(obtenerMensajeError(err));
    }
  };

  // --- Paso 2: resolver proveedor (solo sin proveedor fijo) ---

  const resolverProveedorExistente = (id, nombre) => {
    setProveedorResuelto({ id, nombre });
    const deEseProveedor = productosTodos.filter((p) => p.proveedor_id === id);
    setFilas((prev) => reclasificarFilas(prev, deEseProveedor));
  };

  const handleCrearProveedorYContinuar = async () => {
    setCreandoProveedor(true);
    try {
      const nuevo = await crearProveedor({
        nombre: formProveedorNuevo.nombre,
        cuit: formProveedorNuevo.cuit || null,
        telefono: formProveedorNuevo.telefono || null,
        email: formProveedorNuevo.email || null,
      });
      // Proveedor recién creado: no tiene catálogo previo, todas las filas
      // quedan "nuevo" tal cual las devolvió la IA -- no hace falta reclasificar.
      setProveedorResuelto({ id: nuevo.id, nombre: nuevo.nombre });
    } catch (err) {
      toast.error(obtenerMensajeError(err));
    } finally {
      setCreandoProveedor(false);
    }
  };

  // --- Paso 3: tabla de productos ---

  const actualizarFila = (id, campo, valor) => {
    setFilas((prev) => prev.map((f) => (f._id === id ? { ...f, [campo]: valor } : f)));
  };

  // Las categorías ya elegidas son sub-rubros del tipo anterior -- si el
  // tipo cambia, dejan de tener sentido (mismo criterio que ModalProducto.jsx).
  const handleCambiarTipo = (id, nuevoTipo) => {
    setFilas((prev) =>
      prev.map((f) => (f._id === id ? { ...f, tipo: nuevoTipo, categoria_ids: [] } : f))
    );
  };

  const toggleSeleccion = (id) => {
    setFilas((prev) =>
      prev.map((f) => (f._id === id ? { ...f, seleccionada: !f.seleccionada } : f))
    );
  };

  const filasSeleccionables = filas.filter((f) => Boolean(f.tipo));
  const seleccionadas = filas.filter((f) => f.seleccionada && f.tipo);

  const handleConfirmarImportacion = async () => {
    if (seleccionadas.length === 0 || !proveedorResuelto) return;

    setGuardando(true);
    let creados = 0;
    let actualizados = 0;
    try {
      await Promise.all(
        seleccionadas.map(async (fila) => {
          if (fila.producto_id) {
            await actualizarProducto(fila.producto_id, {
              marca: fila.marca,
              modelo: fila.modelo,
              tipo: fila.tipo,
              precio: Number(fila.precio),
            });
            actualizados += 1;
          } else {
            await crearProducto({
              proveedor_id: proveedorResuelto.id,
              marca: fila.marca,
              modelo: fila.modelo,
              tipo: fila.tipo,
              precio: Number(fila.precio),
              categoria_ids: fila.categoria_ids,
            });
            creados += 1;
          }
        })
      );

      const partes = [];
      if (creados > 0)
        partes.push(`${creados} ${creados === 1 ? "producto importado" : "productos importados"}`);
      if (actualizados > 0)
        partes.push(
          `${actualizados} ${actualizados === 1 ? "precio actualizado" : "precios actualizados"}`
        );
      toast.success(partes.join(" · ") || "Importación completada.");

      onImportado?.();
      onCerrar();
    } catch (err) {
      toast.error(obtenerMensajeError(err));
    } finally {
      setGuardando(false);
    }
  };

  const handleCargarAMano = () => {
    onCargarAMano?.();
    onCerrar();
  };

  // Paso de carga (DESIGN.md §14, "Comprobante primero"): la zona vacía y,
  // con el archivo elegido, su fila con "Leer catálogo con IA" al lado.
  const cargaArchivo = (
    <div className="comprobantes-uploader">
      <input
        ref={inputArchivoRef}
        type="file"
        accept={EXTENSIONES_PERMITIDAS.join(",")}
        hidden
        onChange={handleSeleccionarArchivo}
      />
      {archivo ? (
        <ul className="filas-archivo">
          <FilaArchivo
            nombre={archivo.name}
            meta={describirArchivo(archivo)}
            accion={
              <BotonIA
                onClick={handleLeer}
                disabled={leyendo}
                leyendo={leyendo}
                textoLeyendo="Leyendo catálogo..."
              >
                Leer catálogo con IA
              </BotonIA>
            }
            onQuitar={() => setArchivo(null)}
            disabled={leyendo}
          />
        </ul>
      ) : (
        <ZonaArchivo
          texto="Arrastrá el catálogo o"
          extra="Excel, CSV, PDF o imagen · máx. 10MB"
          arrastrando={arrastrando}
          onElegir={() => inputArchivoRef.current?.click()}
          onSoltar={(files) => validarYSetArchivo(files[0])}
          onArrastrando={setArrastrando}
        />
      )}
      {erroresArchivo.length > 0 && (
        <ul className="comprobantes-errores" role="alert">
          {erroresArchivo.map((err, i) => (
            <li key={i}>{err}</li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <ModalShell
      titulo="Importar catálogo"
      contexto={proveedor?.nombre}
      contextoDestacado
      ancho={paso === "productos"}
      clase={paso === "productos" ? "modal-contenido--importar-catalogo" : ""}
      onCerrar={onCerrar}
      cerrarDeshabilitado={guardando || creandoProveedor}
      aviso={
        paso === "productos" && filasSeleccionables.length > 0
          ? `${seleccionadas.length} de ${filasSeleccionables.length} seleccionados`
          : null
      }
      acciones={
        paso === "productos" ? (
          <>
            <button
              type="button"
              onClick={onCerrar}
              className="btn btn-secondary"
              disabled={guardando}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirmarImportacion}
              disabled={guardando || seleccionadas.length === 0}
            >
              {guardando ? "Importando..." : "Confirmar importación"}
            </button>
          </>
        ) : (
          <button type="button" onClick={onCerrar} className="btn btn--lg btn-secondary">
            Cancelar
          </button>
        )
      }
      accionesIzquierda={
        paso === "carga" && (
          <button type="button" className="btn btn--lg btn-secondary" onClick={handleCargarAMano}>
            {proveedor ? "Agregar producto a mano" : "Cargar el proveedor a mano"}
          </button>
        )
      }
    >
      {paso === "carga" && (
        <>
          <p className="catalogo-carga-texto">
            Subí la lista de precios del proveedor y la IA arma los productos para que los revises
            antes de importarlos.
          </p>
          {cargaArchivo}
        </>
      )}

      {paso === "proveedor" && (
        <div className="catalogo-paso-proveedor">
          {lectura.proveedor_sugerido?.tipo === "existente" && !eligiendoExistente && (
            <div className="catalogo-proveedor-sugerido">
              <p>
                Este catálogo parece ser de <strong>{lectura.proveedor_sugerido.nombre}</strong>.
                ¿Confirmás?
              </p>
              <div className="catalogo-proveedor-acciones">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() =>
                    resolverProveedorExistente(
                      lectura.proveedor_sugerido.id,
                      lectura.proveedor_sugerido.nombre
                    )
                  }
                >
                  <Check size={15} strokeWidth={2.25} />
                  Sí, es este proveedor
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEligiendoExistente(true)}
                >
                  No, elegir otro
                </button>
              </div>
            </div>
          )}

          {(lectura.proveedor_sugerido?.tipo !== "existente" || eligiendoExistente) && (
            <>
              <div className="catalogo-proveedor-elegir">
                <label>
                  Elegir un proveedor ya cargado
                  <select
                    value={proveedorElegidoId}
                    onChange={(e) => setProveedorElegidoId(e.target.value)}
                  >
                    <option value="">Seleccionar proveedor...</option>
                    {proveedoresDisponibles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={!proveedorElegidoId}
                  onClick={() => {
                    const p = proveedoresDisponibles.find((x) => x.id === proveedorElegidoId);
                    if (p) resolverProveedorExistente(p.id, p.nombre);
                  }}
                >
                  Usar este proveedor
                </button>
              </div>

              <div className="catalogo-proveedor-separador">o cargá uno nuevo</div>

              <div className="modal-form-fila">
                <label>
                  Nombre
                  <input
                    type="text"
                    value={formProveedorNuevo.nombre}
                    onChange={(e) =>
                      setFormProveedorNuevo((prev) => ({ ...prev, nombre: e.target.value }))
                    }
                  />
                </label>
                <label>
                  CUIT/CUIL (opcional)
                  <input
                    type="text"
                    value={formProveedorNuevo.cuit}
                    onChange={(e) =>
                      setFormProveedorNuevo((prev) => ({ ...prev, cuit: e.target.value }))
                    }
                  />
                </label>
              </div>
              <div className="modal-form-fila">
                <label>
                  Teléfono
                  <input
                    type="text"
                    value={formProveedorNuevo.telefono}
                    onChange={(e) =>
                      setFormProveedorNuevo((prev) => ({ ...prev, telefono: e.target.value }))
                    }
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={formProveedorNuevo.email}
                    onChange={(e) =>
                      setFormProveedorNuevo((prev) => ({ ...prev, email: e.target.value }))
                    }
                  />
                </label>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!formProveedorNuevo.nombre || creandoProveedor}
                onClick={handleCrearProveedorYContinuar}
              >
                {creandoProveedor ? (
                  <>
                    <LogoCargando size={14} variante="blanco" />
                    Creando...
                  </>
                ) : (
                  "Crear proveedor y continuar"
                )}
              </button>
            </>
          )}
        </div>
      )}

      {paso === "productos" && (
        <>
          {lectura.advertencias?.length > 0 && (
            <div className="catalogo-advertencias">
              {lectura.advertencias.map((a, i) => (
                <p key={i}>{a}</p>
              ))}
            </div>
          )}

          {filas.length === 0 ? (
            <div className="catalogo-vacio">
              <p>No pude reconocer productos en este archivo.</p>
              <button type="button" className="ia-paso-manual" onClick={handleCargarAMano}>
                {proveedor ? "Agregar producto a mano" : "Cargar el proveedor a mano"}
              </button>
            </div>
          ) : (
            <div className="catalogo-tabla-wrap">
              <table className="catalogo-tabla">
                <thead>
                  <tr>
                    <th />
                    <th>Marca</th>
                    <th>Modelo</th>
                    <th>Tipo</th>
                    <th>Categorías</th>
                    <th>Precio</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((fila) => {
                    const sinTipo = !fila.tipo;
                    return (
                      <tr key={fila._id} className={sinTipo ? "catalogo-fila--advertencia" : ""}>
                        <td>
                          <input
                            type="checkbox"
                            checked={fila.seleccionada}
                            disabled={sinTipo}
                            onChange={() => toggleSeleccion(fila._id)}
                            title={
                              sinTipo ? "Elegí un tipo antes de importar esta fila" : undefined
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={fila.marca}
                            onChange={(e) => actualizarFila(fila._id, "marca", e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={fila.modelo}
                            onChange={(e) => actualizarFila(fila._id, "modelo", e.target.value)}
                          />
                        </td>
                        <td>
                          <select
                            value={fila.tipo ?? ""}
                            onChange={(e) => handleCambiarTipo(fila._id, e.target.value || null)}
                          >
                            <option value="" disabled>
                              Elegir tipo...
                            </option>
                            {Object.entries(TIPOS_PRODUCTO).map(([valor, info]) => (
                              <option key={valor} value={valor}>
                                {info.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          {fila.estado === "nuevo" ? (
                            <SelectorCategorias
                              categoriaIds={fila.categoria_ids}
                              tipo={fila.tipo}
                              categoriasDisponibles={categoriasDisponibles}
                              onChange={(ids) => actualizarFila(fila._id, "categoria_ids", ids)}
                              onCategoriaCreada={onCategoriaCreada}
                            />
                          ) : (
                            <span className="catalogo-categorias-vacio">—</span>
                          )}
                        </td>
                        <td>
                          <input
                            type="number"
                            value={fila.precio}
                            min="0"
                            step="0.01"
                            onChange={(e) => actualizarFila(fila._id, "precio", e.target.value)}
                          />
                        </td>
                        <td>
                          <BadgeEstado fila={fila} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </ModalShell>
  );
}

export default ModalImportarCatalogo;
