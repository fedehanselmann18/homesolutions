"""
Por qué un proyecto cobrado al 100% puede mostrar "Saldo del contrato ·
Por cobrar · US$ 0" en Seguimiento.

Seguimiento muestra esa fila cuando `precio_acordado_usd - cobrado > 0`, y
los importes se muestran SIN decimales: un saldo de medio dólar o menos se
ve como "US$ 0" pero la fila aparece igual.

Este script imprime, por proyecto, el saldo con todos sus decimales, para
distinguir los dos casos:
  - saldo de 1e-13  -> cola binaria de dividir pesos por la cotización
  - saldo de 0,01   -> diferencia real de redondeo entre el precio acordado
                       y la suma de los cobros (cada uno redondeado aparte)

Solo lee: no modifica nada.

Uso: desde backend/, con el venv activado:
    python -m scripts.diagnostico_cobranza
"""

from decimal import Decimal

from app.db.db import SessionLocal
from app.db import models


def main():
    db = SessionLocal()
    try:
        proyectos = db.query(models.Proyecto).order_by(models.Proyecto.nombre).all()
        if not proyectos:
            print("No hay proyectos en la base.")
            return

        for proyecto in proyectos:
            acordado = Decimal(str(proyecto.precio_acordado_usd))
            # monto_neto_usd ya descuenta las notas de crédito/débito del cobro.
            cobros = [Decimal(str(c.monto_neto_usd)) for c in proyecto.cobros]
            cobrado = sum(cobros, Decimal("0"))
            saldo = acordado - cobrado
            pct = (cobrado / acordado * 100) if acordado else Decimal("0")

            marca = ""
            if saldo > 0 and saldo < Decimal("0.5"):
                marca = "  <-- ACÁ ESTÁ: saldo > 0 pero se muestra como US$ 0"

            print(f"\n{proyecto.nombre}{marca}")
            print(f"  precio acordado  {acordado}")
            print(f"  cobrado ({len(cobros)} cobros) {cobrado}")
            print(f"  saldo            {saldo}   ({pct:.4f}% cobrado)")
            if marca:
                for i, c in enumerate(proyecto.cobros, 1):
                    print(f"    cobro {i}: neto US$ {c.monto_neto_usd} "
                          f"(bruto {c.monto_usd}, {len(c.notas)} notas) · {c.descripcion}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
