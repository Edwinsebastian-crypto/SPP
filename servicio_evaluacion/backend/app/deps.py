"""Dependencias y verificaciones compartidas por los routers."""
from __future__ import annotations

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from .models import Evaluacion, IntentoEvaluacion, Pregunta, Respuesta
from .security import Usuario, solo_estudiante, solo_tutor


def evaluacion_del_tutor(id_evaluacion: int, db: Session = Depends(get_db),
                         user: Usuario = Depends(solo_tutor)) -> Evaluacion:
    ev = db.get(Evaluacion, id_evaluacion)
    if ev is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Evaluation not found.")
    if ev.id_tutor != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This evaluation belongs to another tutor.")
    return ev


def pregunta_del_tutor(id_pregunta: int, db: Session = Depends(get_db),
                       user: Usuario = Depends(solo_tutor)) -> Pregunta:
    p = db.get(Pregunta, id_pregunta)
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question not found.")
    if p.evaluacion.id_tutor != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This question belongs to another tutor.")
    return p


def intento_del_tutor(id_intento: int, db: Session = Depends(get_db),
                      user: Usuario = Depends(solo_tutor)) -> IntentoEvaluacion:
    from sqlalchemy.orm import joinedload, selectinload
    from .models import Evaluacion, Pregunta
    i = db.query(IntentoEvaluacion).options(
        joinedload(IntentoEvaluacion.evaluacion).selectinload(Evaluacion.preguntas).selectinload(Pregunta.opciones),
        selectinload(IntentoEvaluacion.respuestas).selectinload(Respuesta.retros),
    ).filter(IntentoEvaluacion.id_intento == id_intento).first()
    if i is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attempt not found.")
    if i.evaluacion.id_tutor != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This attempt belongs to another tutor.")
    return i


def respuesta_del_tutor(id_respuesta: int, db: Session = Depends(get_db),
                        user: Usuario = Depends(solo_tutor)) -> Respuesta:
    from sqlalchemy.orm import joinedload, selectinload
    from .models import Evaluacion, IntentoEvaluacion, Pregunta
    r = db.query(Respuesta).options(
        joinedload(Respuesta.intento).joinedload(IntentoEvaluacion.evaluacion).selectinload(Evaluacion.preguntas).selectinload(Pregunta.opciones),
        joinedload(Respuesta.pregunta),
        selectinload(Respuesta.retros),
    ).filter(Respuesta.id_respuesta == id_respuesta).first()
    if r is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Response not found.")
    if r.intento.evaluacion.id_tutor != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This response belongs to another tutor.")
    return r


def asegurar_editable(ev: Evaluacion) -> None:
    """Las preguntas solo se pueden tocar mientras nadie haya presentado la evaluación."""
    if ev.estado == "CERRADA":
        raise HTTPException(status.HTTP_409_CONFLICT, "The evaluation is closed.")
    if ev.intentos:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Attempts have already been submitted; questions cannot be modified. You may close the evaluation.",
        )


def intento_del_estudiante(id_intento: int, db: Session = Depends(get_db),
                           user: Usuario = Depends(solo_estudiante)) -> IntentoEvaluacion:
    i = db.get(IntentoEvaluacion, id_intento)
    if i is None or i.id_estudiante != user.id:
        # mismo mensaje para no revelar si existe
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attempt not found.")
    return i
