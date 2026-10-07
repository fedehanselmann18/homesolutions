import { CircleAlert } from "lucide-react";

/**
 * El error de un campo de formulario, debajo del campo (DESIGN.md §9): ícono
 * + texto en --color-error-texto. Sin texto no dibuja nada, así se puede
 * dejar siempre puesto y pasarle el error del campo, que es null si está bien.
 */
export function ErrorCampo({ texto }) {
  if (!texto) return null;
  return (
    <p className="campo-error">
      <CircleAlert aria-hidden="true" />
      {texto}
    </p>
  );
}

export default ErrorCampo;
