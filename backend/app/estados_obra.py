"""
Transición automática de estados por movimientos.

Si se carga una compra o un gasto en una fase "por_empezar" o en una obra
"a_iniciar", la obra ya arrancó: quedaban estados contradictorios (fase "Por
empezar" con una compra pagada y entregada) y el Panel no mostraba la obra.

- Compra / gasto con fase: la fase pasa a en_curso, en curso desde la
  FECHA DEL MOVIMIENTO (no la de hoy: cargar una compra vieja no puede dejar
  la fase "en curso desde hoy"), y su proyecto, si estaba a_iniciar, también.
  Si la fase ya estaba en curso y el movimiento es anterior a su fecha, la
  fecha retrocede: la fase arrancó con ese movimiento.
- Gasto sin fase: sólo el proyecto.
- Cobro: NO cambia nada. Un anticipo del cliente se cobra antes de empezar
  la obra y no significa que haya arrancado.

Sólo avanza desde el estado inicial: nunca reabre una fase terminada ni
toca una obra terminada. No hace commit: lo hace la ruta que la llama, en la
misma transacción que el movimiento.
"""

from datetime import date

from sqlalchemy.orm import Session

from app.db import models
from app.plazos import hoy


def activar_por_movimiento(
    db: Session,
    *,
    fase: models.Fase | None = None,
    proyecto: models.Proyecto | None = None,
    fecha: date | None = None,
) -> None:
    if fase is not None:
        fecha = fecha or hoy()
        if fase.estado == "por_empezar":
            fase.estado = "en_curso"
            fase.fecha_en_curso_desde = fecha
        elif fase.estado == "en_curso" and (
            fase.fecha_en_curso_desde is None or fecha < fase.fecha_en_curso_desde
        ):
            fase.fecha_en_curso_desde = fecha
        if proyecto is None:
            proyecto = db.get(models.Proyecto, fase.proyecto_id)

    if proyecto is not None and proyecto.estado == "a_iniciar":
        proyecto.estado = "en_curso"
