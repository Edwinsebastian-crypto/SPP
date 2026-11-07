import React, { useState, useRef } from 'react';
import {
    aLocalDatetime,
    toast,
    mostrarError,
    getEvalAPI,
} from '../../utils/evalBridge';
import { BusyButton } from '../common/Badge';
import { Modal } from '../common/Modal';
import CustomDateTimePicker from '../common/CustomDateTimePicker';

export default function EvaluationModal({
    ev,
    practica,
    estudiante,
    onClose,
    onSaved,
}) {
    const edit = Boolean(ev);
    const bloqueado = edit && ev.intentos_presentados > 0;
    const fechaLimitePasada =
        edit &&
        Boolean(
            ev.fecha_limite &&
                new Date(ev.fecha_limite).getTime() + 59999 + 60000 < Date.now()
        );
    const limiteBloqueado =
        edit && ev.intentos_presentados > 0 && fechaLimitePasada;

    const [titulo, setTitulo] = useState(edit ? ev.titulo : '');
    const [tituloError, setTituloError] = useState(false);
    const [desc, setDesc] = useState(edit ? ev.descripcion || '' : '');
    const [intentos, setIntentos] = useState(
        edit ? ev.intentos_permitidos : 1
    );
    const [maxima, setMaxima] = useState(edit ? ev.nota_maxima : 5);
    const [limite, setLimite] = useState(
        edit && ev.fecha_limite ? aLocalDatetime(ev.fecha_limite) : ''
    );
    const [mostrar, setMostrar] = useState(
        edit ? Boolean(ev.mostrar_resultados) : true
    );

    const tituloRef = useRef(null);

    const handleSave = async () => {
        setTituloError(false);
        if (titulo.trim().length < 3) {
            setTituloError(true);
            tituloRef.current?.focus();
            toast('Title must have at least 3 characters.', 'error');
            return;
        }
        const cuerpo = {
            titulo: titulo.trim(),
            descripcion: desc.trim() || null,
            fecha_limite: limiteBloqueado
                ? ev.fecha_limite
                : limite
                ? new Date(limite).toISOString()
                : null,
            mostrar_resultados: mostrar,
        };
        if (!bloqueado) {
            cuerpo.intentos_permitidos = Number(intentos) || 1;
            cuerpo.nota_maxima = Number(maxima) || 5;
        }
        try {
            const api = getEvalAPI()?.tutor;
            if (edit) {
                const updated = await api.editarEvaluacion(
                    ev.id_evaluacion,
                    cuerpo
                );
                toast('Evaluation updated.');
                onSaved(updated, false);
            } else {
                const nuevo = await api.crearEvaluacion({
                    ...cuerpo,
                    id_practica: practica,
                    id_estudiante: estudiante,
                });
                toast(
                    'Evaluation created. Add questions manually or generate them with AI.'
                );
                onSaved(nuevo, true);
            }
        } catch (e) {
            mostrarError(e);
        }
    };

    return (
        <Modal
            titulo={edit ? 'Edit evaluation' : 'New evaluation'}
            ancho={600}
            onClose={onClose}
        >
            <form
                className="ev-form"
                noValidate
                onSubmit={(e) => {
                    e.preventDefault();
                    handleSave();
                }}
            >
                <div className="ev-field">
                    <label>Title</label>
                    <input
                        ref={tituloRef}
                        className={`ev-input${tituloError ? ' is-error' : ''}`}
                        type="text"
                        maxLength={200}
                        value={titulo}
                        onChange={(e) => {
                            setTitulo(e.target.value);
                            if (tituloError) setTituloError(false);
                        }}
                        placeholder="e.g. Lesson planning evaluation"
                    />
                </div>
                <div className="ev-field">
                    <label>Description</label>
                    <textarea
                        className="ev-textarea"
                        maxLength={4000}
                        placeholder="Instructions or context for the student (optional)"
                        value={desc}
                        onChange={(e) => setDesc(e.target.value)}
                    />
                </div>
                <div className="ev-row">
                    <div className="ev-field">
                        <label>Allowed attempts</label>
                        <input
                            className="ev-input"
                            type="number"
                            min={1}
                            max={10}
                            value={intentos}
                            disabled={bloqueado}
                            onChange={(e) => setIntentos(e.target.value)}
                        />
                    </div>
                    <div className="ev-field">
                        <label>Maximum grade</label>
                        <input
                            className="ev-input"
                            type="number"
                            min={1}
                            max={100}
                            step={0.5}
                            value={maxima}
                            disabled={bloqueado}
                            onChange={(e) => setMaxima(e.target.value)}
                        />
                    </div>
                </div>
                {bloqueado ? (
                    <p className="ev-hint">
                        Attempts have already been submitted: maximum grade and
                        attempts cannot be changed.
                    </p>
                ) : null}
                <div className="ev-field">
                    <label>Deadline (optional)</label>
                    <CustomDateTimePicker
                        type="datetime-local"
                        value={limite}
                        disabled={limiteBloqueado}
                        onChange={(e) => setLimite(e.target.value)}
                    />
                    <span className="ev-hint">
                        Past this date, the student can no longer start or
                        submit.
                    </span>
                </div>
                <label className="ev-check">
                    <input
                        type="checkbox"
                        checked={mostrar}
                        onChange={(e) => setMostrar(e.target.checked)}
                    />
                    Show the student the correct answers upon completion
                </label>
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
                        {edit ? 'Save changes' : 'Create evaluation'}
                    </BusyButton>
                </div>
            </form>
        </Modal>
    );
}
