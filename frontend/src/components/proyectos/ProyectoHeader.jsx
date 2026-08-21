import { Plus } from "lucide-react";

import { PageHeader } from "../shared/PageHeader";
import { Buscador } from "../shared/Buscador";

export function ProyectosHeader({
  canManage,
  onCrearProyecto,
  cantidad,
  busqueda,
  onBuscarChange,
}) {
  return (
    <PageHeader
      titulo="Proyectos"
      chip={cantidad != null ? `${cantidad} ${cantidad === 1 ? "cargado" : "cargados"}` : undefined}
      acciones={
        <>
          <Buscador
            valor={busqueda}
            onCambiar={onBuscarChange}
            placeholder="Buscar proyecto o dirección…"
            etiqueta="Buscar proyecto"
            ancho="fijo"
          />
          {canManage && (
            <button type="button" className="btn btn-primary" onClick={onCrearProyecto}>
              <Plus size={16} strokeWidth={2} />
              Nuevo proyecto
            </button>
          )}
        </>
      }
    />
  );
}

export default ProyectosHeader;
