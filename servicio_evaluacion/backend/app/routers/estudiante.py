"""Estudiante · ver evaluaciones asignadas, presentarlas y consultar resultados."""
from __future__ import annotations

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import intento_del_estudiante
from ..models import Evaluacion, IntentoEvaluacion, OpcionPregunta, Respuesta
from ..schemas import EvaluacionEstudiante, IntentoEstudiante, RespuestaIn
from ..security import Usuario, solo_estudiante
from ..serializers import intento_estudiante
from ..services.calificacion import actualizar_nota_final, aprobadas_de, finalizar_intento, vencida

router = APIRouter(prefix="/estudiante", tags=["Estudiante"])


def _cerrar_si_corresponde(db: Session, intento: IntentoEvaluacion) -> None:
    """Si la evaluación fue cerrada explícitamente por el tutor, se envía lo que haya."""
    ev = intento.evaluacion
    if intento.estado == "EN_CURSO" and ev.estado == "CERRADA":
        finalizar_intento(ev, intento)
        db.commit()
        db.refresh(intento)


def _reabrir_si_vigente(db: Session, ev: Evaluacion, mios: list[IntentoEvaluacion]) -> list[IntentoEvaluacion]:
    """Si la evaluación está publicada y vigente (tutor amplió la fecha límite),
    cualquier intento que haya quedado sin envío manual del estudiante se reabre a EN_CURSO
    para que el estudiante pueda continuar respondiéndolo."""
    if ev.estado == "PUBLICADA" and not vencida(ev):
        reabierto = False
        for i in mios:
            if i.fecha_envio is None and i.estado != "EN_CURSO":
                i.estado = "EN_CURSO"
                i.nota_obtenida = None
                reabierto = True
        if reabierto:
            actualizar_nota_final(ev)
            db.commit()
            db.refresh(ev)
    return mios


def _tarjeta(ev: Evaluacion, mios: list[IntentoEvaluacion]) -> EvaluacionEstudiante:
    abierto = next((i for i in mios if i.estado == "EN_CURSO"), None)
    total = len(aprobadas_de(ev))
    enviados = [i for i in mios if i.fecha_envio is not None]
    intentos_usados = len(enviados)
    puede = (
        ev.estado == "PUBLICADA" and total > 0 and not vencida(ev)
        and (abierto is not None or intentos_usados < ev.intentos_permitidos)
    )
    ultimo = enviados[-1] if enviados else None

    # Nota final visible afuera (solo de intentos efectivamente enviados)
    notas = [i.nota_obtenida for i in enviados if i.estado == "CALIFICADO" and i.nota_obtenida is not None]
    if notas:
        nota_final = max(notas)
    elif ev.nota_final is not None and intentos_usados > 0:
        nota_final = float(ev.nota_final)
    elif (vencida(ev) or ev.estado == "CERRADA") and not abierto and not enviados:
        nota_final = 0.0
    else:
        nota_final = None

    return EvaluacionEstudiante(
        id_evaluacion=ev.id_evaluacion, id_practica=ev.id_practica, titulo=ev.titulo, descripcion=ev.descripcion,
        estado=ev.estado, fecha_limite=ev.fecha_limite, intentos_permitidos=ev.intentos_permitidos,
        intentos_usados=intentos_usados, nota_maxima=ev.nota_maxima,
        nota_final=nota_final,
        total_preguntas=total, id_intento_abierto=abierto.id_intento if abierto else None,
        id_ultimo_intento=ultimo.id_intento if ultimo else None,
        ultimo_intento_estado=ultimo.estado if ultimo else None, puede_intentar=puede,
    )


@router.get("/evaluaciones", response_model=list[EvaluacionEstudiante])
def mis_evaluaciones(db: Session = Depends(get_db), user: Usuario = Depends(solo_estudiante)):
    evs = db.scalars(
        select(Evaluacion)
        .where(Evaluacion.id_estudiante == user.id, Evaluacion.estado.in_(("PUBLICADA", "CERRADA")))
        .options(selectinload(Evaluacion.preguntas), selectinload(Evaluacion.intentos))
        .order_by(Evaluacion.id_evaluacion.desc())
    ).all()
    out = []
    for ev in evs:
        mios = [i for i in ev.intentos if i.id_estudiante == user.id]
        mios = _reabrir_si_vigente(db, ev, mios)
        for i in mios:
            _cerrar_si_corresponde(db, i)
        out.append(_tarjeta(ev, mios))
    return out


@router.post("/evaluaciones/{id_evaluacion}/intentos", response_model=IntentoEstudiante)
def iniciar_o_continuar(id_evaluacion: int, db: Session = Depends(get_db), user: Usuario = Depends(solo_estudiante)):
    ev = db.get(Evaluacion, id_evaluacion)
    if ev is None or ev.id_estudiante != user.id or ev.estado == "BORRADOR":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Evaluation not found.")
    mios = [i for i in ev.intentos if i.id_estudiante == user.id]
    mios = _reabrir_si_vigente(db, ev, mios)
    for i in mios:
        _cerrar_si_corresponde(db, i)

    abierto = next((i for i in mios if i.estado == "EN_CURSO"), None)
    if abierto is not None:
        # Si la evaluación sigue publicada y el tutor dio más plazo (o no ha vencido), continuar el intento
        if ev.estado == "PUBLICADA" and not vencida(ev):
            return intento_estudiante(abierto)
        # Si sigue vencida:
        if vencida(ev):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "The deadline for this evaluation has expired. Please contact your tutor to enable it again."
            )
        _cerrar_si_corresponde(db, abierto)
        return intento_estudiante(abierto)

    enviados = [i for i in mios if i.fecha_envio is not None]
    if (ev.estado == "CERRADA" or vencida(ev)) and enviados:
        return intento_estudiante(enviados[-1])

    if ev.estado != "PUBLICADA":
        raise HTTPException(status.HTTP_409_CONFLICT, "The evaluation is closed.")
    if vencida(ev):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "The deadline for this evaluation has expired. Please contact your tutor to enable it again."
        )
    if len(enviados) >= ev.intentos_permitidos:
        raise HTTPException(status.HTTP_409_CONFLICT, "You have already used all allowed attempts.")
    if not aprobadas_de(ev):
        raise HTTPException(status.HTTP_409_CONFLICT, "The evaluation does not have any questions yet.")

    intento = IntentoEvaluacion(id_evaluacion=ev.id_evaluacion, id_estudiante=user.id,
                                numero_intento=len(enviados) + 1, estado="EN_CURSO")
    db.add(intento)
    db.commit()
    db.refresh(intento)
    return intento_estudiante(intento)


@router.get("/intentos/{id_intento}", response_model=IntentoEstudiante)
def ver_intento(intento: IntentoEvaluacion = Depends(intento_del_estudiante), db: Session = Depends(get_db)):
    _cerrar_si_corresponde(db, intento)
    return intento_estudiante(intento)


@router.put("/intentos/{id_intento}/respuestas/{id_pregunta}")
def guardar_respuesta(id_pregunta: int, body: RespuestaIn, intento: IntentoEvaluacion = Depends(intento_del_estudiante),
                      db: Session = Depends(get_db)):
    """Autoguardado de una respuesta (se puede llamar muchas veces). No califica."""
    ev = intento.evaluacion
    _cerrar_si_corresponde(db, intento)
    if intento.estado != "EN_CURSO":
        raise HTTPException(status.HTTP_409_CONFLICT, "This attempt has already been submitted or the evaluation was closed.")

    pregunta = next((p for p in aprobadas_de(ev) if p.id_pregunta == id_pregunta), None)
    if pregunta is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "The question does not belong to this evaluation.")

    r = next((x for x in intento.respuestas if x.id_pregunta == id_pregunta), None)
    if r is None:
        r = Respuesta(id_intento=intento.id_intento, id_pregunta=id_pregunta)
        db.add(r)

    if pregunta.tipo_pregunta == "ABIERTA":
        r.id_opcion, r.respuesta = None, (body.respuesta or "")
    else:
        if body.id_opcion is None:
            r.id_opcion, r.respuesta = None, None
        else:
            op = next((o for o in pregunta.opciones if o.id_opcion == body.id_opcion), None)
            if op is None:
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "The option does not belong to the question.")
            r.id_opcion, r.respuesta = op.id_opcion, op.texto
    db.commit()
    return {"guardado": True}


@router.post("/intentos/{id_intento}/enviar", response_model=IntentoEstudiante)
def enviar(intento: IntentoEvaluacion = Depends(intento_del_estudiante), db: Session = Depends(get_db)):
    if intento.estado != "EN_CURSO":
        raise HTTPException(status.HTTP_409_CONFLICT, "This attempt has already been submitted.")
    
    # 1. Consulta previa en tiempo real en la base de datos para verificar fecha y hora actuales
    db.refresh(intento)
    ev = db.get(Evaluacion, intento.id_evaluacion)
    if ev is None or ev.estado != "PUBLICADA" or vencida(ev):
        # Aseguramos que las respuestas guardadas hasta este momento permanezcan persistidas en la DB
        db.commit()
        # El intento no se finaliza, se mantiene en EN_CURSO para cuando el tutor dé más plazo
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "The deadline for this evaluation has expired. Please contact your tutor to enable it again."
        )

    finalizar_intento(ev, intento)
    db.commit()
    db.refresh(intento)
    return intento_estudiante(intento)
