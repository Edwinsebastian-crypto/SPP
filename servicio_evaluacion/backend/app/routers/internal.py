"""Rutas internas para otros microservicios (servicio_notificaciones)."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Evaluacion, IntentoEvaluacion
from ..security import internal_auth

router = APIRouter(prefix="/internal", tags=["Internal"], dependencies=[Depends(internal_auth)])


@router.get("/intentos/{attempt_id}")
def find_attempt(attempt_id: int, db: Session = Depends(get_db)):
    row = db.query(
        IntentoEvaluacion.id_intento,
        IntentoEvaluacion.estado,
        IntentoEvaluacion.nota_obtenida,
        Evaluacion.id_evaluacion,
        Evaluacion.titulo,
        Evaluacion.nota_maxima,
        Evaluacion.id_practica,
        IntentoEvaluacion.id_estudiante,
        Evaluacion.mostrar_resultados,
    ).join(Evaluacion, Evaluacion.id_evaluacion == IntentoEvaluacion.id_evaluacion)\
     .filter(IntentoEvaluacion.id_intento == attempt_id).first()

    if not row:
        return None

    return {
        "attemptId": row[0],
        "status": row[1],
        "grade": float(row[2]) if row[2] is not None else None,
        "evaluationId": row[3],
        "title": row[4],
        "maxGrade": float(row[5]) if row[5] is not None else None,
        "practiceId": row[6],
        "studentDocument": row[7],
        "showResults": row[8],
    }


@router.get("/evaluaciones/due-soon")
def list_due_soon(hours: int = Query(default=24, ge=1, le=720), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    limit = now + timedelta(hours=hours)

    has_submitted_attempt = select(IntentoEvaluacion.id_intento).where(
        IntentoEvaluacion.id_evaluacion == Evaluacion.id_evaluacion,
        IntentoEvaluacion.id_estudiante == Evaluacion.id_estudiante,
        IntentoEvaluacion.estado.in_(["ENVIADO", "CALIFICADO"]),
    ).exists()

    rows = db.query(
        Evaluacion.id_evaluacion,
        Evaluacion.titulo,
        Evaluacion.id_practica,
        Evaluacion.id_estudiante,
        Evaluacion.fecha_limite,
    ).filter(
        Evaluacion.estado == "PUBLICADA",
        Evaluacion.fecha_limite.is_not(None),
        Evaluacion.fecha_limite > now,
        Evaluacion.fecha_limite <= limit,
        ~has_submitted_attempt,
    ).all()

    return [
        {
            "evaluationId": r[0],
            "title": r[1],
            "practiceId": r[2],
            "studentDocument": r[3],
            "dueAt": r[4].isoformat() if r[4] else None,
        }
        for r in rows
    ]


@router.get("/evaluaciones/awaiting-grading")
def list_awaiting_grading(db: Session = Depends(get_db)):
    rows = db.query(
        IntentoEvaluacion.id_intento,
        Evaluacion.id_evaluacion,
        Evaluacion.titulo,
        Evaluacion.id_tutor,
        Evaluacion.id_estudiante,
        Evaluacion.id_practica,
    ).join(Evaluacion, Evaluacion.id_evaluacion == IntentoEvaluacion.id_evaluacion)\
     .filter(IntentoEvaluacion.estado == "ENVIADO")\
     .order_by(IntentoEvaluacion.fecha_envio).all()

    return [
        {
            "attemptId": r[0],
            "evaluationId": r[1],
            "title": r[2],
            "tutorDocument": r[3],
            "studentDocument": r[4],
            "practiceId": r[5],
        }
        for r in rows
    ]
