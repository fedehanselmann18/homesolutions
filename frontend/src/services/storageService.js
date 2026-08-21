import axiosClient from "../api/axiosClient";

// Reconciliación de archivos en R2 (ver PLAN_MANAGER.md #3): exclusivo de
// "Manager" y solo aplica con R2 configurado -- en disco local (dev) el
// backend responde 400, que la página trata como estado informativo, no
// como error (ver GestionArchivos.jsx).

export const getReconciliacion = async () => {
  const { data } = await axiosClient.get("/storage/reconciliacion");
  return data; // { huerfanos, rotos }
};

export const purgarHuerfanos = async (claves) => {
  const { data } = await axiosClient.post("/storage/reconciliacion/purgar", { claves });
  return data; // { purgadas, omitidas }
};
