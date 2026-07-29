import { FileText, Image } from "lucide-react";

export function extensionDeArchivo(nombre) {
  const punto = nombre.lastIndexOf(".");
  return punto === -1 ? "" : nombre.slice(punto).toLowerCase();
}

export function iconoParaArchivo(nombre) {
  return extensionDeArchivo(nombre) === ".pdf" ? FileText : Image;
}

export function nombreDeArchivo(path) {
  return path.split("/").pop();
}
