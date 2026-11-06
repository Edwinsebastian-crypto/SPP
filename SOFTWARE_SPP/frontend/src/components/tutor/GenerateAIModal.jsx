import React, { useState, useEffect } from 'react';
import {
    TIPOS,
    plural,
    toast,
    mostrarError,
    getEvalAPI,
} from '../../utils/evalBridge';
import { Icon } from '../common/Badge';
import { Modal } from '../common/Modal';

const MAX_EVIDENCIAS = 3;
const DIFICULTADES = [
    ['FACIL', 'Easy'],
    ['MEDIA', 'Medium'],
    ['DIFICIL', 'Hard'],
    ['MIXTA', 'Mixed'],
];

export default function GenerateAIModal({
    idEvaluacion,
    practica,
    onClose,
    onGenerated,
}) {
    const [tema, setTema] = useState('');
    const [evidencias, setEvidencias] = useState([]);
    const [loadingEvid, setLoadingEvid] = useState(true);
    const [errorEvid, setErrorEvid] = useState(null);
    const [selectedEvid, setSelectedEvid] = useState([]); // [{ id, nombre }]

    const [cantidad, setCantidad] = useState(5);
    const [valor, setValor] = useState(1);
    const [tipos, setTipos] = useState(['OPCION_MULTIPLE']);
    const [dificultad, setDificultad] = useState('MEDIA');
    const [instr, setInstr] = useState('');

    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        let active = true;
        setLoadingEvid(true);
        setErrorEvid(null);
        const api = getEvalAPI()?.tutor;
        api.listarEvidencias(practica)
            .then((lista) => {
                if (!active) return;
                setEvidencias(Array.isArray(lista) ? lista : []);
            })
            .catch((e) => {
                if (!active) return;
                setErrorEvid(e.message || 'Could not load evidences');
            })
            .finally(() => {
                if (active) setLoadingEvid(false);
            });
        return () => {
            active = false;
        };
    }, [practica]);

    const toggleTipo = (k) => {
        setTipos((prev) => {
            if (prev.includes(k)) {
                if (prev.length > 1) return prev.filter((x) => x !== k);
                return prev;
            }
            return [...prev, k];
        });
    };

    const toggleEvidencia = (id, nombre) => {
        setSelectedEvid((prev) => {
            const exists = prev.some((x) => String(x.id) === String(id));
            if (exists) {
                return prev.filter((x) => String(x.id) !== String(id));
            }
            if (prev.length >= MAX_EVIDENCIAS) {
                toast(
                    `Maximum ${MAX_EVIDENCIAS} evidences as context to optimize generation.`,
                    'aviso'
                );
                return prev;
            }
            return [...prev, { id, nombre }];
        });
    };

    const handleGenerar = async () => {
        const fuentes = [];
        if (tema.trim()) {
            fuentes.push({ tipo: 'TEMA_LIBRE', texto: tema.trim() });
        }
        if (selectedEvid.length > MAX_EVIDENCIAS) {
            toast(
                `You can select at most ${MAX_EVIDENCIAS} evidences as context.`,
                'error'
            );
            return;
        }
        selectedEvid.forEach((ev) => {
            fuentes.push({
                tipo: 'EVIDENCIA',
                id_referencia: ev.id,
                nombre: ev.nombre,
            });
        });
        if (!fuentes.length) {
            toast('Enter a topic or select at least one evidence.', 'error');
            return;
        }
        if (tema.trim() && tema.trim().length < 10) {
            toast('The topic is too short: describe a bit more.', 'error');
            return;
        }

        const cant = Math.min(30, Math.max(1, Number(cantidad) || 1));
        setGenerating(true);
        try {
            const api = getEvalAPI()?.tutor;
            const r = await api.generar(idEvaluacion, {
                fuentes,
                cantidad: cant,
                tipos,
                dificultad,
                instrucciones: instr.trim() || null,
                valor_por_pregunta: Number(valor) || 1,
            });
            toast(
                `Generated ${plural(r.cantidad_generada, 'question', 'questions')}. Review and approve them.`
            );
            (r.advertencias || []).forEach((a) => toast(a, 'aviso'));
            await onGenerated();
        } catch (e) {
            setGenerating(false);
            mostrarError(e);
        }
    };

    const cantClamped = Math.min(30, Math.max(1, Number(cantidad) || 1));

    return (
        <Modal
            titulo="Generate questions with AI"
            ancho={680}
            onClose={onClose}
        >
            <div className="ev-form">
                {generating ? (
                    <div className="ev-generando" role="status">
                        <Icon name="fa-solid fa-wand-magic-sparkles fa-beat" />
                        <p>
                            {'Reading content and drafting ' +
                                plural(cantClamped, 'question', 'questions') +
                                '…'}
                        </p>
                        <p className="ev-hint">
                            This may take up to a minute. Do not close this
                            window.
                        </p>
                    </div>
                ) : (
                    <div className="ev-form">
                        <div className="ev-field">
                            <label>Topic or context</label>
                            <textarea
                                className="ev-textarea"
                                maxLength={30000}
                                placeholder='Enter a topic or paste context text (optional if selecting evidences). E.g. "Formative assessment strategies in elementary school".'
                                value={tema}
                                onChange={(e) => setTema(e.target.value)}
                            />
                        </div>

                        <div className="ev-field">
                            <label>Student evidences as context</label>
                            <div className="ev-evid">
                                {loadingEvid ? (
                                    <p className="ev-hint">
                                        Loading evidences…
                                    </p>
                                ) : errorEvid ? (
                                    <p className="ev-hint">
                                        {'Could not load evidences: ' +
                                            errorEvid}
                                    </p>
                                ) : evidencias.length === 0 ? (
                                    <p className="ev-hint">
                                        This practice does not have any
                                        evidences yet.
                                    </p>
                                ) : (
                                    <>
                                        <div
                                            className="ev-hint"
                                            style={{
                                                marginBottom: 6,
                                                fontWeight: 600,
                                            }}
                                        >
                                            {`Select up to ${MAX_EVIDENCIAS} evidences (${selectedEvid.length}/${MAX_EVIDENCIAS}):`}
                                        </div>
                                        {evidencias.map((e, i) => {
                                            const nombreLimpio =
                                                (e.descripcion &&
                                                    e.descripcion.trim()) ||
                                                `Evidence ${i + 1}`;
                                            const isChecked =
                                                selectedEvid.some(
                                                    (x) =>
                                                        String(x.id) ===
                                                        String(e.id_evidencia)
                                                );
                                            const isDisabled =
                                                !isChecked &&
                                                selectedEvid.length >=
                                                    MAX_EVIDENCIAS;

                                            const subtitulo = [
                                                e.nombre_actividad &&
                                                e.nombre_actividad.toLowerCase() !==
                                                    'activity'
                                                    ? e.nombre_actividad
                                                    : null,
                                                e.horas_realizadas
                                                    ? e.horas_realizadas + ' h'
                                                    : null,
                                                e.archivos &&
                                                e.archivos.length
                                                    ? e.archivos
                                                          .map((a) => a.nombre)
                                                          .join(', ') ||
                                                      plural(
                                                          e.archivos.length,
                                                          'file',
                                                          'files'
                                                      )
                                                    : null,
                                            ]
                                                .filter(Boolean)
                                                .join(' · ');

                                            return (
                                                <label key={e.id_evidencia}>
                                                    <input
                                                        type="checkbox"
                                                        value={e.id_evidencia}
                                                        data-nombre={
                                                            nombreLimpio
                                                        }
                                                        checked={isChecked}
                                                        disabled={isDisabled}
                                                        onChange={() =>
                                                            toggleEvidencia(
                                                                e.id_evidencia,
                                                                nombreLimpio
                                                            )
                                                        }
                                                    />
                                                    <span>
                                                        {nombreLimpio}
                                                        {subtitulo ? (
                                                            <small>
                                                                {subtitulo}
                                                            </small>
                                                        ) : null}
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </>
                                )}
                            </div>
                            <span className="ev-hint">
                                Reads evidence text and attached files (PDF,
                                Word, PowerPoint, text, and images).
                            </span>
                        </div>

                        <div className="ev-row">
                            <div className="ev-field">
                                <label>Number of questions</label>
                                <div className="ev-stepper">
                                    <button
                                        type="button"
                                        aria-label="Decrease"
                                        onClick={() =>
                                            setCantidad((prev) =>
                                                Math.max(
                                                    1,
                                                    (Number(prev) || 1) - 1
                                                )
                                            )
                                        }
                                    >
                                        −
                                    </button>
                                    <input
                                        type="number"
                                        min={1}
                                        max={30}
                                        value={cantidad}
                                        aria-label="Number of questions"
                                        onChange={(e) =>
                                            setCantidad(e.target.value)
                                        }
                                    />
                                    <button
                                        type="button"
                                        aria-label="Increase"
                                        onClick={() =>
                                            setCantidad((prev) =>
                                                Math.min(
                                                    30,
                                                    (Number(prev) || 1) + 1
                                                )
                                            )
                                        }
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                            <div className="ev-field">
                                <label>Points per question</label>
                                <input
                                    className="ev-input"
                                    type="number"
                                    min={0.5}
                                    max={100}
                                    step={0.5}
                                    value={valor}
                                    onChange={(e) => setValor(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="ev-field">
                            <label>Question types</label>
                            <div className="ev-chips">
                                {Object.entries(TIPOS).map(([k, v]) => {
                                    const active = tipos.includes(k);
                                    return (
                                        <button
                                            key={k}
                                            type="button"
                                            className="ev-chip"
                                            aria-pressed={String(active)}
                                            onClick={() => toggleTipo(k)}
                                        >
                                            <Icon
                                                name={
                                                    active
                                                        ? 'fa-solid fa-check'
                                                        : 'fa-regular fa-circle'
                                                }
                                            />
                                            {v}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="ev-field">
                            <label>Difficulty</label>
                            <div className="ev-seg">
                                {DIFICULTADES.map(([k, v]) => (
                                    <button
                                        key={k}
                                        type="button"
                                        aria-pressed={String(k === dificultad)}
                                        onClick={() => setDificultad(k)}
                                    >
                                        {v}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="ev-field">
                            <label>Additional instructions</label>
                            <textarea
                                className="ev-textarea"
                                style={{ height: 64 }}
                                maxLength={1000}
                                placeholder='Optional. E.g. "Focus on pedagogical reflection" or "application questions, not rote memory".'
                                value={instr}
                                onChange={(e) => setInstr(e.target.value)}
                            />
                        </div>

                        <p className="ev-hint">
                            Generated questions remain as "To review": you
                            decide which to approve before publishing.
                        </p>

                        <div className="ev-actions">
                            <button
                                type="button"
                                className="ev-btn ev-btn--soft"
                                onClick={onClose}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="ev-btn ev-btn--gold"
                                onClick={handleGenerar}
                            >
                                <Icon name="fa-solid fa-wand-magic-sparkles" />
                                Generate questions
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}
