import React, { useState } from 'react';
import {
    TIPOS,
    toast,
    mostrarError,
    getEvalAPI,
} from '../../utils/evalBridge';
import { Icon, BusyButton } from '../common/Badge';
import { Modal } from '../common/Modal';

function getInitialOptions(tipo, existingOps) {
    if (tipo === 'ABIERTA') return [];
    if (tipo === 'VERDADERO_FALSO') {
        if (
            existingOps &&
            existingOps.length === 2 &&
            (existingOps[0].texto === 'True' ||
                existingOps[0].texto === 'Verdadero')
        ) {
            return existingOps.map((o) => ({
                texto: o.texto,
                es_correcta: Boolean(o.es_correcta),
            }));
        }
        return [
            { texto: 'True', es_correcta: true },
            { texto: 'False', es_correcta: false },
        ];
    }
    if (
        existingOps &&
        existingOps.length >= 2 &&
        !(
            existingOps.length === 2 &&
            (existingOps[0].texto === 'True' ||
                existingOps[0].texto === 'Verdadero')
        )
    ) {
        return existingOps.map((o) => ({
            texto: o.texto,
            es_correcta: Boolean(o.es_correcta),
        }));
    }
    return [
        { texto: '', es_correcta: true },
        { texto: '', es_correcta: false },
        { texto: '', es_correcta: false },
        { texto: '', es_correcta: false },
    ];
}

export default function QuestionModal({
    pregunta,
    idEvaluacion,
    onClose,
    onSaved,
}) {
    const edit = Boolean(pregunta);
    const initialTipo = edit ? pregunta.tipo_pregunta : 'OPCION_MULTIPLE';

    const [tipo, setTipo] = useState(initialTipo);
    const [ops, setOps] = useState(() =>
        getInitialOptions(
            initialTipo,
            edit && pregunta.opciones ? pregunta.opciones : []
        )
    );
    const [enun, setEnun] = useState(edit ? pregunta.enunciado : '');
    const [valor, setValor] = useState(edit ? pregunta.valor_pregunta : 1);
    const [expl, setExpl] = useState(edit ? pregunta.explicacion || '' : '');
    const [rubrica, setRubrica] = useState(
        edit ? pregunta.respuesta_esperada || '' : ''
    );

    const handleTipoChange = (newTipo) => {
        if (newTipo === tipo) return;
        setTipo(newTipo);
        setOps(getInitialOptions(newTipo, []));
    };

    const handleSelectCorrect = (idx) => {
        setOps((prev) =>
            prev.map((o, i) => ({ ...o, es_correcta: i === idx }))
        );
    };

    const handleOptionTextChange = (idx, text) => {
        setOps((prev) =>
            prev.map((o, i) => (i === idx ? { ...o, texto: text } : o))
        );
    };

    const handleRemoveOption = (idx) => {
        setOps((prev) => {
            if (prev.length <= 2) return prev;
            const eraCorrecta = prev[idx].es_correcta;
            const next = prev.filter((_, i) => i !== idx);
            if (eraCorrecta && next.length > 0) {
                next[0] = { ...next[0], es_correcta: true };
            }
            return next;
        });
    };

    const handleAddOption = () => {
        setOps((prev) => {
            if (prev.length >= 6) return prev;
            return [...prev, { texto: '', es_correcta: false }];
        });
    };

    const handleSave = async () => {
        if (enun.trim().length < 3) {
            toast('Write the question statement.', 'error');
            return;
        }
        if (tipo !== 'ABIERTA' && ops.some((o) => !o.texto.trim())) {
            toast(
                'Complete the text for all options or remove extra ones.',
                'error'
            );
            return;
        }
        const cuerpo = {
            tipo_pregunta: tipo,
            enunciado: enun.trim(),
            valor_pregunta: Number(valor) || 1,
            explicacion: expl.trim() || null,
            respuesta_esperada:
                tipo === 'ABIERTA' ? rubrica.trim() || null : null,
            opciones:
                tipo === 'ABIERTA'
                    ? []
                    : ops.map((o) => ({
                          texto: o.texto.trim(),
                          es_correcta: Boolean(o.es_correcta),
                      })),
        };
        try {
            const api = getEvalAPI()?.tutor;
            if (edit) {
                await api.editarPregunta(pregunta.id_pregunta, cuerpo);
            } else {
                await api.crearPregunta(idEvaluacion, cuerpo);
            }
            toast(edit ? 'Question updated.' : 'Question added.');
            await onSaved();
        } catch (e) {
            mostrarError(e);
        }
    };

    return (
        <Modal
            titulo={edit ? 'Edit question' : 'New question'}
            onClose={onClose}
        >
            <div className="ev-form">
                <div className="ev-field">
                    <label>Type</label>
                    <div
                        className="ev-seg"
                        role="group"
                        aria-label="Question type"
                    >
                        {Object.entries(TIPOS).map(([k, v]) => (
                            <button
                                key={k}
                                type="button"
                                aria-pressed={String(k === tipo)}
                                onClick={() => handleTipoChange(k)}
                            >
                                {v}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="ev-field">
                    <label>Question statement</label>
                    <textarea
                        className="ev-textarea"
                        maxLength={4000}
                        placeholder="Write the question…"
                        value={enun}
                        onChange={(e) => setEnun(e.target.value)}
                    />
                </div>

                {tipo !== 'ABIERTA' ? (
                    <div className="ev-field">
                        <label>
                            {tipo === 'VERDADERO_FALSO'
                                ? 'Correct answer'
                                : 'Options (select the correct one)'}
                        </label>
                        {ops.map((o, i) => {
                            if (tipo === 'VERDADERO_FALSO') {
                                return (
                                    <label key={i} className="ev-check">
                                        <input
                                            type="radio"
                                            name="correcta"
                                            checked={o.es_correcta}
                                            aria-label="Is correct"
                                            onChange={() =>
                                                handleSelectCorrect(i)
                                            }
                                        />
                                        {o.texto}
                                    </label>
                                );
                            }
                            return (
                                <div key={i} className="ev-opt-edit">
                                    <input
                                        type="radio"
                                        name="correcta"
                                        checked={o.es_correcta}
                                        aria-label="Is correct"
                                        onChange={() => handleSelectCorrect(i)}
                                    />
                                    <input
                                        className="ev-input"
                                        type="text"
                                        maxLength={1000}
                                        placeholder={
                                            'Option ' +
                                            String.fromCharCode(65 + i)
                                        }
                                        value={o.texto}
                                        onChange={(e) =>
                                            handleOptionTextChange(
                                                i,
                                                e.target.value
                                            )
                                        }
                                    />
                                    <button
                                        type="button"
                                        className="ev-icon-btn ev-icon-btn--bad"
                                        title="Remove option"
                                        aria-label="Remove option"
                                        disabled={ops.length <= 2}
                                        onClick={() => handleRemoveOption(i)}
                                    >
                                        <Icon name="fa-solid fa-xmark" />
                                    </button>
                                </div>
                            );
                        })}
                        {tipo === 'OPCION_MULTIPLE' && ops.length < 6 ? (
                            <button
                                type="button"
                                className="ev-btn ev-btn--sm ev-btn--ghost"
                                style={{ width: 'fit-content' }}
                                onClick={handleAddOption}
                            >
                                <Icon name="fa-solid fa-plus" />
                                Add option
                            </button>
                        ) : null}
                    </div>
                ) : null}

                {tipo === 'ABIERTA' ? (
                    <div className="ev-field">
                        <label>Grading criteria</label>
                        <textarea
                            className="ev-textarea"
                            style={{ height: 80 }}
                            maxLength={4000}
                            placeholder="Criteria or model answer for grading (optional)"
                            value={rubrica}
                            onChange={(e) => setRubrica(e.target.value)}
                        />
                    </div>
                ) : null}

                <div className="ev-field">
                    <label>Explanation</label>
                    <textarea
                        className="ev-textarea"
                        style={{ height: 64 }}
                        maxLength={4000}
                        placeholder="Why the answer is correct (optional, shown to the student at the end)"
                        value={expl}
                        onChange={(e) => setExpl(e.target.value)}
                    />
                </div>

                <div className="ev-field" style={{ maxWidth: 200 }}>
                    <label>Points (weight)</label>
                    <input
                        className="ev-input"
                        type="number"
                        min={0.5}
                        max={100}
                        step={0.5}
                        value={valor}
                        onChange={(e) => setValor(e.target.value)}
                    />
                    <span className="ev-hint">
                        Relative weight in the final grade.
                    </span>
                </div>

                <div className="ev-actions">
                    <button
                        type="button"
                        className="ev-btn ev-btn--soft"
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <BusyButton
                        className="ev-btn ev-btn--dark"
                        onClick={handleSave}
                    >
                        {edit ? 'Save changes' : 'Add question'}
                    </BusyButton>
                </div>
            </div>
        </Modal>
    );
}
