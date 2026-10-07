import { FileText, Image } from "lucide-react";
import { formatBytes } from "./formato";

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

/** "PDF · 248 KB": el tipo y el peso de un archivo, debajo de su nombre. */
export function describirArchivo(file) {
  return [extensionDeArchivo(file.name).slice(1).toUpperCase(), formatBytes(file.size)]
    .filter(Boolean)
    .join(" · ");
}
