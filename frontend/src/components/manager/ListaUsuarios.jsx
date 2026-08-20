import { KeyRound, LogOut, ShieldCheck, ShieldOff, UserCheck, UserX } from "lucide-react";

import "./Manager.css";
import { EstadoVacio } from "../shared/EstadoVacio";

/**
 * Planilla de cuentas del equipo con las acciones de mantenimiento que puede
 * hacer "Manager" (ver requiere_manager en el backend: ningún otro admin
 * llega a estos endpoints).
 *
 * La cuenta "Manager" no aparece en esta lista: el backend rechaza cualquier
 * acción sobre uno mismo, así que mostrarla sería ofrecer botones que
 * siempre fallan.
 */
export function ListaUsuarios({
  usuarios,
  onResetear,
  onCambiarRol,
  onCerrarSesion,
  onToggleActivo,
}) {
  if (usuarios.length === 0) {
    return <EstadoVacio mensaje="Todavía no hay ninguna cuenta creada." />;
  }

  return (
    <div className="manager-tabla-scroll">
      <table className="manager-tabla">
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Rol</th>
            <th>Estado</th>
            <th className="manager-tabla__acciones-col">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((usuario) => {
            const esAdmin = usuario.rol === "admin";
            return (
              <tr key={usuario.id} className={usuario.activo ? "" : "manager-fila--inactiva"}>
                <td className="manager-tabla__nombre">{usuario.nombre_usuario}</td>
                <td>
                  <span className={`badge ${esAdmin ? "badge--marca" : "badge--neutro"}`}>
                    {esAdmin ? "Admin" : "Lectura"}
                  </span>
                </td>
                <td>
                  <span
                    className={`badge ${
                      usuario.activo ? "badge--exito" : "badge--peligro"
                    }`}
                  >
                    {usuario.activo ? "Activa" : "Desactivada"}
                  </span>
                </td>
                <td className="manager-tabla__acciones">
                  <button
                    type="button"
                    className="manager-accion"
                    onClick={() => onResetear(usuario)}
                    title="Asignarle una contraseña nueva"
                  >
                    <KeyRound size={14} strokeWidth={2} />
                    Contraseña
                  </button>

                  <button
                    type="button"
                    className="manager-accion"
                    onClick={() => onCambiarRol(usuario)}
                    title={esAdmin ? "Pasarlo a solo lectura" : "Darle permisos de admin"}
                  >
                    {esAdmin ? (
                      <ShieldOff size={14} strokeWidth={2} />
                    ) : (
                      <ShieldCheck size={14} strokeWidth={2} />
                    )}
                    {esAdmin ? "Pasar a lectura" : "Hacer admin"}
                  </button>

                  <button
                    type="button"
                    className="manager-accion"
                    onClick={() => onCerrarSesion(usuario)}
                    title="Cortarle la sesión sin cambiarle la contraseña"
                  >
                    <LogOut size={14} strokeWidth={2} />
                    Cerrar sesión
                  </button>

                  <button
                    type="button"
                    className={`manager-accion ${usuario.activo ? "manager-accion--peligro" : ""}`}
                    onClick={() => onToggleActivo(usuario)}
                    title={
                      usuario.activo
                        ? "Bloquearle el acceso sin borrar la cuenta"
                        : "Devolverle el acceso"
                    }
                  >
                    {usuario.activo ? (
                      <UserX size={14} strokeWidth={2} />
                    ) : (
                      <UserCheck size={14} strokeWidth={2} />
                    )}
                    {usuario.activo ? "Desactivar" : "Reactivar"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default ListaUsuarios;
