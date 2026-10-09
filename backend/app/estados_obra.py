"""
Transición automática de estados por movimientos.

Si se carga una compra o un gasto en una fase "por_empezar" o en una obra
"a_iniciar", la obra ya arrancó: quedaban estados contradictorios (fase "Por
empezar" con una compra pagada y entregada) y el Panel no mostraba la obra.

- Compra / gasto con fase: la fase pasa a en_curso (con fecha_en_curso_desde)
  y su proyecto, si estaba a_iniciar, también.
- Gasto sin fase: sólo el proyecto.
- Cobro: NO cambia nada. Un anticipo del cliente se cobra antes de empezar
  la obra y no significa que haya arrancado.

Sólo avanza desde el estado inicial: nunca reabre una fase terminada ni
toca una obra terminada. No hace commit: lo hace la ruta que la llama, en la
misma transacción que el movimiento.
"""

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.db import models


def activar_por_movimiento(
    db: Session,
    *,
    fase: models.Fase | None = None,
    proyecto: models.Proyecto | None = None,
) -> None:
    if fase is not None:
        if fase.estado == "por_empezar":
            fase.estado = "en_curso"
            fase.fecha_en_curso_desde = datetime.now(timezone.utc)
        if proyecto is None:
            proyecto = db.get(models.Proyecto, fase.proyecto_id)

    if proyecto is not None and proyecto.estado == "a_iniciar":
        proyecto.estado = "en_curso"
