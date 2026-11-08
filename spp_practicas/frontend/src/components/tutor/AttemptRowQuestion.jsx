import React, { useState, useEffect } from 'react';
import {
    TIPOS,
    nota,
    fecha,
    toast,
    mostrarError,
    getEvalAPI,
} from '../../utils/evalBridge';
import { Badge, BusyButton, Icon } from '../common/Badge';

export default function AttemptRowQuestion({ r, index, onUpdatedIntento }) {
    const abierta = r.tipo_pregunta === 'ABIERTA';
    const valorNota = Number(
        r.nota_obtenida !== null && r.nota_obtenida !== undefined
            ? r.nota_obtenida
            : 0
    );
    const esCero = valorNota <= 0;
    const clase = r.pendiente
        ? ''
        : !esCero && r.es_correcta === true
        ? ' ev-ans--ok'
        : esCero || r.es_correcta === false
        ? ' ev-ans--bad'
        : '';

    const [score, setScore] = useState(
        r.nota_obtenida === null || r.nota_obtenida === undefined
            ? ''
            : String(r.nota_obtenida)
    );
    const [comment, setComment] = useState('');

    useEffect(() => {
        setScore(
            r.nota_obtenida === null || r.nota_obtenida === undefined
                ? ''
                : String(r.nota_obtenida)
        );
        setComment('');
    }, [r.id_respuesta, r.nota_obtenida, r.retros?.length]);

    const handleCalificar = async () => {
        if (score === '') {
            toast('Enter the score for this question.', 'error');
            return;
        }
        try {
            const api = getEvalAPI()?.tutor;
            const updated = await api.calificar(r.id_respuesta, {
                nota_obtenida: Number(score),
                comentario: comment.trim() || null,
            });
            toast('Grade saved.');
            onUpdatedIntento(updated);
        } catch (e) {
            mostrarError(e);
        }
    };

    const handleComentar = async () => {
        if (!comment.trim()) {
            toast('Enter the comment.', 'error');
            return;
        }
        try {
            const api = getEvalAPI()?.tutor;
            const updated = await api.comentar(
                r.id_respuesta,
                comment.trim()
            );
            toast('Comment submitted.');
            onUpdatedIntento(updated);
        } catch (e) {
            mostrarError(e);
        }
    };

    return (
        <article className="ev-q">
            <div className="ev-q-top">
                <span className="ev-q-num">{'Question ' + index}</span>
                <span className="ev-badge">{TIPOS[r.tipo_pregunta]}</span>
                <span className="ev-badge">
                    {'Points ' + r.valor_pregunta}
                </span>
                {r.pendiente ? (
                    <Badge estado="ENVIADO" textoPropio="To grade" />
                ) : (
                    <span
                        className={
                            'ev-badge ' +
                            (esCero
                                ? 'ev-badge--score-zero'
                                : 'ev-badge--score-ok')
                        }
                    >
                        <b
                            style={{
                                color: esCero ? '#dc2626' : '#15803d',
                            }}
                        >
                            {nota(r.nota_obtenida)}
                        </b>
                        {` / ${r.valor_pregunta}`}
                    </span>
                )}
            </div>
            <div className="ev-q-text">{r.enunciado}</div>
            <div className={'ev-ans' + clase}>
                {r.respuesta && r.respuesta.trim()
                    ? r.respuesta
                    : '(unanswered)'}
            </div>
            {!abierta && r.es_correcta === false && r.opcion_correcta ? (
                <div className="ev-q-note">
                    <b>Correct answer: </b>
                    {r.opcion_correcta}
                </div>
            ) : null}
            {abierta && r.respuesta_esperada ? (
                <div className="ev-q-note">
                    <b>Grading criteria: </b>
                    {r.respuesta_esperada}
                </div>
            ) : null}
            {(r.retros || []).map((x, idx) => (
                <div
                    key={x.id_retro || x.id_retro_pregunta || idx}
                    className="ev-retro"
                    style={{ marginTop: 10 }}
                >
                    <Icon name="fa-solid fa-comment-dots" />
                    <b style={{ marginLeft: 6 }}>
                        Tutor feedback:{' '}
                    </b>
                    {x.comentario}
                    {x.fecha ? (
                        <small
                            style={{
                                display: 'block',
                                opacity: 0.7,
                                marginTop: 3,
                            }}
                        >
                            {fecha(x.fecha)}
                        </small>
                    ) : null}
                </div>
            ))}
            {r.id_respuesta ? (
                abierta ? (
                    <div className="ev-grade">
                        <div
                            className="ev-field"
                            style={{ maxWidth: 160, flex: 'none' }}
                        >
                            <label>{`Score (0 – ${r.valor_pregunta})`}</label>
                            <input
                                className="ev-input"
                                type="number"
                                min={0}
                                max={r.valor_pregunta}
                                step={0.25}
                                value={score}
                                onChange={(e) => setScore(e.target.value)}
                            />
                        </div>
                        <div className="ev-field">
                            <label>Comment</label>
                            <input
                                className="ev-input"
                                type="text"
                                maxLength={4000}
                                placeholder="Feedback for the student (optional)"
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                            />
                        </div>
                        <BusyButton
                            className="ev-btn ev-btn--sm ev-btn--primary"
                            icon="fa-solid fa-floppy-disk"
                            onClick={handleCalificar}
                        >
                            {r.pendiente ? 'Grade' : 'Update grade'}
                        </BusyButton>
                    </div>
                ) : (
                    <div className="ev-grade">
                        <div className="ev-field">
                            <input
                                className="ev-input"
                                type="text"
                                maxLength={4000}
                                placeholder="Add a comment for the student"
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                            />
                        </div>
                        <BusyButton
                            className="ev-btn ev-btn--sm ev-btn--dark"
                            onClick={handleComentar}
                        >
                            Comment
                        </BusyButton>
                    </div>
                )
            ) : null}
        </article>
    );
}
