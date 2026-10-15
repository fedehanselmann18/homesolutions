import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ChartColumn,
  Building2,
  Truck,
  SlidersHorizontal,
  GitCompare,
  Wallet,
  Users,
  UserPlus,
  History,
  Settings,
  FolderSearch,
  BookOpen,
  LogOut,
} from "lucide-react";
import { useAuth } from "../context/useAuth";
import {
  useProyectos,
  useProveedores,
  useFases,
  useGastos,
  useCobros,
  useCompras,
} from "../hooks/queries";
import { calcularPanel } from "../utils/panel";
import { iniciales } from "../utils/formato";
import {
  RUTA_MANAGER_EQUIPO,
  RUTA_MANAGER_AUTORIZADOS,
  RUTA_MANAGER_AUDITORIA,
  RUTA_MANAGER_CONFIGURACION,
  RUTA_MANAGER_ARCHIVOS,
  esManager,
} from "../constants/manager";
import isotipo from "../assets/HS_iso_negro.png";
import "./Sidebar.css";

const ITEMS_NAV = [
  { to: "/", label: "Panel", icono: LayoutDashboard, contador: null },
  { to: "/proyectos", label: "Proyectos", icono: Building2, contador: (c) => c.proyectos },
  { to: "/metricas", label: "Métricas", icono: ChartColumn, contador: null },
  { to: "/cash-flow", label: "Cash flow", icono: Wallet, contador: null },
  { to: "/proveedores", label: "Proveedores", icono: Truck, contador: (c) => c.proveedores },
  { to: "/comparador", label: "Comparador", icono: GitCompare, contador: null },
  { to: "/ajustes", label: "Ajustes", icono: SlidersHorizontal, contador: null },
  // La guía es sólo para admin (ver RUTAS_SOLO_ADMIN en ProtectedRoute).
  { to: "/guia", label: "Guía", icono: BookOpen, contador: null, soloAdmin: true },
];

// Subárbol exclusivo de la cuenta "Manager" (ver constants/manager.js): antes
// era un solo link ("Gestión de cuentas") a una pantalla con secciones
// apiladas; ahora cada sección es su propia página, así que son varios links
// bajo un mismo título de grupo -- mismo patrón visual que "En curso" más
// abajo para las obras.
const ITEMS_NAV_MANAGER = [
  { to: RUTA_MANAGER_EQUIPO, label: "Equipo", icono: Users },
  { to: RUTA_MANAGER_AUTORIZADOS, label: "Autorizados", icono: UserPlus },
  { to: RUTA_MANAGER_AUDITORIA, label: "Historial", icono: History },
  { to: RUTA_MANAGER_CONFIGURACION, label: "Configuración", icono: Settings },
  { to: RUTA_MANAGER_ARCHIVOS, label: "Archivos", icono: FolderSearch },
];

// El nav "normal" vive en su propio componente porque monta 6 queries: así
// no se disparan para la cuenta "Manager", que no ve ninguna de estas
// páginas (ver constants/manager.js) ni tiene permiso para pedir esos datos.
function NavEquipo() {
  const { isAdmin } = useAuth();
  const proyectosQuery = useProyectos();
  const proveedoresQuery = useProveedores();

  // Grupo "EN CURSO" (dirección 1a): necesita el mismo "disponible" por
  // proyecto que calcula el Panel, que a su vez necesita fases/gastos/
  // cobros/compras completos. El Sidebar se monta en TODAS las páginas
  // protegidas, así que estas 4 queries pueden disparar su primer fetch acá
  // si el usuario entra directo a una página que no las pide por su cuenta
  // (Proveedores, Comparador) -- se aceptan porque React Query las cachea
  // por queryKey (ver queryKeys.js) y quedan calientes para el Panel/
  // Proyectos, pero si en el futuro esto pesa, la alternativa es sacar el
  // punto verde/rojo y dejar sólo el nombre de la obra.
  const fasesQuery = useFases();
  const gastosQuery = useGastos();
  const cobrosQuery = useCobros();
  const comprasQuery = useCompras();

  const contadores = {
    proyectos: proyectosQuery.data?.length,
    proveedores: proveedoresQuery.data?.length,
  };

  const datosListos =
    proyectosQuery.data &&
    fasesQuery.data &&
    gastosQuery.data &&
    cobrosQuery.data &&
    comprasQuery.data;

  const obrasEnCurso = datosListos
    ? calcularPanel({
        proyectos: proyectosQuery.data,
        fases: fasesQuery.data,
        gastos: gastosQuery.data,
        cobros: cobrosQuery.data,
        compras: comprasQuery.data,
      }).proyectosActivos
    : [];

  return (
    <>
      <div className="sidebar-grupo">
        {ITEMS_NAV.filter((item) => isAdmin || !item.soloAdmin).map((item) => {
          const cantidad = item.contador?.(contadores);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                isActive ? "sidebar-link sidebar-link-active" : "sidebar-link"
              }
            >
              <item.icono
                size={16}
                strokeWidth={1.75}
                className="sidebar-link-icono"
                aria-hidden="true"
              />
              <span className="sidebar-link-label">{item.label}</span>
              {cantidad != null && <span className="sidebar-link-contador">{cantidad}</span>}
            </NavLink>
          );
        })}
      </div>

      {obrasEnCurso.length > 0 && (
        <div className="sidebar-grupo sidebar-grupo--obras">
          <div className="sidebar-grupo-titulo">En curso</div>
          {obrasEnCurso.map((proyecto) => (
            <NavLink key={proyecto.id} to={`/proyectos/${proyecto.id}`} className="sidebar-obra">
              <span
                className={
                  proyecto.disponible >= 0
                    ? "sidebar-obra-punto sidebar-obra-punto--ok"
                    : "sidebar-obra-punto sidebar-obra-punto--alerta"
                }
              />
              {proyecto.nombre}
            </NavLink>
          ))}
        </div>
      )}
    </>
  );
}

export function Sidebar() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <img src={isotipo} alt="" className="sidebar-brand" />
        <span className="sidebar-brand-nombre">
          Home
          <br />
          Solutions
        </span>
      </div>

      <nav className="sidebar-nav">
        {esManager(usuario) ? (
          <div className="sidebar-grupo">
            <div className="sidebar-grupo-titulo">Gestión de cuentas</div>
            {ITEMS_NAV_MANAGER.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive ? "sidebar-link sidebar-link-active" : "sidebar-link"
                }
              >
                <item.icono
                  size={16}
                  strokeWidth={1.75}
                  className="sidebar-link-icono"
                  aria-hidden="true"
                />
                <span className="sidebar-link-label">{item.label}</span>
              </NavLink>
            ))}
          </div>
        ) : (
          <NavEquipo />
        )}
      </nav>

      <div className="sidebar-footer">
        <span className="sidebar-avatar">{iniciales(usuario?.nombre_usuario)}</span>
        <span className="sidebar-user">
          <span className="sidebar-user-name">{usuario?.nombre_usuario}</span>
          <span className="sidebar-user-role">{usuario?.rol}</span>
        </span>
        <button
          className="sidebar-logout"
          onClick={handleLogout}
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
        >
          <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
