import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    TIPOS,
    fecha,
    nota,
    plural,
    toast,
    mostrarError,
    confirmar,
    habilitarEnlacesExternos,
    scrollTopAll,
    getEvalAPI,
} from '../../utils/evalBridge';
import { Icon, Badge, BadgeOrigen, BusyButton } from '../common/Badge';
import EvaluationModal from './EvaluationModal';
import QuestionModal from './QuestionModal';
import GenerateAIModal from './GenerateAIModal';
import AttemptRowQuestion from './AttemptRowQuestion';
import { EVENTS, on, emit } from '../../core/events';
import { getPractice } from '../../core/practiceStore';
import { provide, inject } from '../../core/registry';
import { isPanelVisible } from '../../core/panels';

export default function TutorEvaluationApp() {
    const qs = new URLSearchParams(window.location.search);
    const [practica, setPractica] = useState(() => qs.get('practica') || '');
    const [estudiante, setEstudiante] = useState(
        () => qs.get('estudiante') || ''
    );
    const [contextText, setContextText] = useState(() => {
        const est = qs.get('estudiante') || '';
        const prac = qs.get('practica') || '';
        return prac ? (est ? est : '') : '';
    });

    const practicaRef = useRef(practica);
    const estudianteRef = useRef(estudiante);
    practicaRef.current = practica;
    estudianteRef.current = estudiante;

    const [mockAIBanner, setMockAIBanner] = useState(false);

    const [view, setView] = useState('lista'); // 'lista' | 'editor' | 'intento'
    const [lista, setLista] = useState([]);
    const [loadingLista, setLoadingLista] = useState(true);
    const [errorLista, setErrorLista] = useState(null);
    const loadingListaRef = useRef(false);

    // Editor state
    const [evActual, setEvActual] = useState(null);
    const [loadingEditor, setLoadingEditor] = useState(false);
    const [tab, setTab] = useState('preguntas'); // 'preguntas' | 'resultados'

    // Resultados tab state
    const [intentos, setIntentos] = useState([]);
    const [loadingIntentos, setLoadingIntentos] = useState(false);
    const [errorIntentos, setErrorIntentos] = useState(null);

    // Intento detail state
    const [intentoActual, setIntentoActual] = useState(null);

    // Modals state
    const [evalModalState, setEvalModalState] = useState({
        open: false,
        ev: null,
    });
    const [questionModalState, setQuestionModalState] = useState({
        open: false,
        pregunta: null,
    });
    const [generateModalOpen, setGenerateModalOpen] = useState(false);

    const switchView = useCallback((nextView) => {
        setView(nextView);
        scrollTopAll();
    }, []);

    const resolverPractica = useCallback(async () => {
        let nextPractica = practicaRef.current;
        let nextEstudiante = estudianteRef.current;

        const actual = getPractice().practice;
        if (actual && (actual.id || actual.code)) {
            nextPractica = String(actual.id || actual.code || '');
            nextEstudiante = String(
                actual.student || actual.studentName || nextEstudiante || ''
            );
        } else if (!nextPractica || !nextEstudiante) {
            try {
                const r = await fetch('/api/practices', {
                    credentials: 'same-origin',
                });
                const listaP = r.ok ? (await r.json()).practices || [] : [];
                const p =
                    (nextPractica
                        ? listaP.find(
                              (x) =>
                                  String(x.id) === String(nextPractica) ||
                                  String(x.code) === String(nextPractica)
                          )
                        : null) ||
                    listaP.find((x) => x.status === 'active') ||
                    listaP[0];
                if (p) {
                    nextPractica = String(p.id);
                    nextEstudiante = String(
                        p.student || p.studentName || nextEstudiante || ''
                    );
                }
            } catch {
                // ignore network error here
            }
        }

        practicaRef.current = nextPractica;
        estudianteRef.current = nextEstudiante;
        setPractica(nextPractica);
        setEstudiante(nextEstudiante);
        setContextText(
            nextEstudiante
                ? nextEstudiante
                : nextPractica
                ? 'Practice evaluations'
                : 'You do not have assigned practices.'
        );
    }, []);

    const cargarLista = useCallback(async () => {
        if (loadingListaRef.current) return;
        loadingListaRef.current = true;
        setLoadingLista(true);
        setErrorLista(null);
        try {
            const api = getEvalAPI()?.tutor;
            const data = await api.listarEvaluaciones({
                id_practica: practicaRef.current,
            });
            const items = Array.isArray(data) ? data : [];
            setLista(items);
            inject('logbook')?.updateQuestionsPill?.(items, true);
        } catch (e) {
            setErrorLista(e.message || 'Could not load evaluations.');
        } finally {
            setLoadingLista(false);
            loadingListaRef.current = false;
        }
    }, []);

    const cargarResultados = useCallback(async (idEvaluacion) => {
        if (!idEvaluacion) return;
        setLoadingIntentos(true);
        setErrorIntentos(null);
        try {
            const api = getEvalAPI()?.tutor;
            const data = await api.listarIntentos(idEvaluacion);
            setIntentos(Array.isArray(data) ? data : []);
        } catch (e) {
            setErrorIntentos(e.message || 'Could not load results.');
        } finally {
            setLoadingIntentos(false);
        }
    }, []);

    const abrirEditor = useCallback(
        async (idEvaluacion, nextTab = 'preguntas') => {
            setTab(nextTab);
            switchView('editor');
            setLoadingEditor(true);
            setEvActual(null);
            try {
                const api = getEvalAPI()?.tutor;
                const ev = await api.obtenerEvaluacion(idEvaluacion);
                setEvActual(ev);
                if (nextTab === 'resultados') {
                    cargarResultados(ev.id_evaluacion);
                }
            } catch (e) {
                switchView('lista');
                mostrarError(e);
            } finally {
                setLoadingEditor(false);
            }
        },
        [cargarResultados, switchView]
    );

    const recargarEditor = useCallback(
        async (forceTab) => {
            if (!evActual) return;
            try {
                const api = getEvalAPI()?.tutor;
                const ev = await api.obtenerEvaluacion(evActual.id_evaluacion);
                setEvActual(ev);
                const activeTab = forceTab || tab;
                if (activeTab === 'resultados') {
                    cargarResultados(ev.id_evaluacion);
                }
            } catch (e) {
                mostrarError(e);
            }
        },
        [cargarResultados, evActual, tab]
    );

    const cambiarTab = (nextTab) => {
        setTab(nextTab);
        if (nextTab === 'resultados' && evActual) {
            cargarResultados(evActual.id_evaluacion);
        }
    };

    const abrirIntento = async (idIntento) => {
        try {
            const api = getEvalAPI()?.tutor;
            const it = await api.verIntento(idIntento);
            setIntentoActual(it);
            switchView('intento');
        } catch (e) {
            mostrarError(e);
        }
    };

    useEffect(() => {
        habilitarEnlacesExternos();

        // Check health for simulated AI banner
        (async () => {
            try {
                const api = getEvalAPI();
                if (api?.health) {
                    const s = await api.health();
                    if (s && s.ia && s.ia.proveedor === 'mock') {
                        setMockAIBanner(true);
                    }
                }
            } catch {
                // ignore
            }
        })();

        const onPracticeChange = (detail) => {
            const p = detail?.practice || detail;
            if (p && (p.id || p.code)) {
                const nextP = String(p.id || p.code || '');
                const nextE = String(p.student || p.studentName || '');
                practicaRef.current = nextP;
                estudianteRef.current = nextE;
                setPractica(nextP);
                setEstudiante(nextE);
                setContextText(nextE ? nextE : '');
                if (isPanelVisible('questions-panel')) {
                    cargarLista();
                }
            }
        };
        const unsubPractice = on(EVENTS.PRACTICE, onPracticeChange, document);

        const unsubEval = provide('eval:tutor', {
            abrir: () => {
                resolverPractica()
                    .catch(() => {})
                    .then(() => {
                        switchView('lista');
                        cargarLista();
                    });
            },
            volverALista: () => {
                switchView('lista');
            },
            recargar: () => {
                cargarLista();
            },
        });

        if (isPanelVisible('questions-panel')) {
            resolverPractica()
                .catch(() => {})
                .then(() => cargarLista());
        } else {
            setLoadingLista(false);
        }

        return () => {
            unsubPractice();
            unsubEval();
        };
    }, [cargarLista, resolverPractica, switchView]);

    const editable = (ev) =>
        Boolean(ev && ev.estado !== 'CERRADA' && ev.intentos_presentados === 0);

    const handlePublicar = async () => {
        if (!evActual) return;
        const puedePublicar = (evActual.preguntas_aprobadas || 0) > 0;
        if (!puedePublicar) {
            toast(
                'You must approve at least one question before publishing the evaluation.',
                'aviso'
            );
            return;
        }
        if (evActual.preguntas_pendientes) {
            const ok = await confirmar({
                titulo: 'Unreviewed questions remain',
                mensaje: `${plural(evActual.preguntas_pendientes, 'question remains', 'questions remain')} in draft and will NOT be visible to the student. Publish anyway?`,
                ok: 'Publish',
            });
            if (!ok) return;
        }
        try {
            const api = getEvalAPI()?.tutor;
            const updated = await api.publicar(evActual.id_evaluacion);
            setEvActual(updated);
            toast('Evaluation published: the student can now take it.');
        } catch (e) {
            mostrarError(e);
        }
    };

    const handleDespublicar = async () => {
        if (!evActual) return;
        try {
            const api = getEvalAPI()?.tutor;
            const updated = await api.despublicar(evActual.id_evaluacion);
            setEvActual(updated);
            toast('The evaluation was reverted to draft.');
        } catch (e) {
            mostrarError(e);
        }
    };

    const handleCerrar = async () => {
        if (!evActual) return;
        const ok = await confirmar({
            titulo: 'Close evaluation',
            mensaje:
                'The student will no longer be able to take it and ongoing attempts will be submitted with their current answers.',
            ok: 'Close evaluation',
        });
        if (!ok) return;
        try {
            const api = getEvalAPI()?.tutor;
            const updated = await api.cerrar(evActual.id_evaluacion);
            setEvActual(updated);
            toast('Evaluation closed.');
            emit(EVENTS.PRACTICES_CHANGED);
            emit(EVENTS.HOME_REFRESH);
        } catch (e) {
            mostrarError(e);
        }
    };

    const handleEliminarEvaluacion = async () => {
        if (!evActual) return;
        const ok = await confirmar({
            titulo: 'Delete evaluation',
            mensaje:
                'The evaluation and all of its questions will be deleted. This action cannot be undone.',
            ok: 'Delete',
            peligro: true,
        });
        if (!ok) return;
        try {
            const api = getEvalAPI()?.tutor;
            await api.eliminarEvaluacion(evActual.id_evaluacion);
            toast('Evaluation deleted.');
            switchView('lista');
            cargarLista();
        } catch (e) {
            mostrarError(e);
        }
    };

    const handleAprobarTodas = async () => {
        if (!evActual) return;
        try {
            const api = getEvalAPI()?.tutor;
            const r = await api.aprobarTodas(evActual.id_evaluacion);
            toast(
                `${plural(r.aprobadas, 'question approved', 'questions approved')}.`
            );
            await recargarEditor();
        } catch (e) {
            mostrarError(e);
        }
    };

    const handleRevisarPregunta = async (idPregunta, action, msg) => {
        try {
            const api = getEvalAPI()?.tutor;
            if (action === 'approve') {
                await api.aprobarPregunta(idPregunta);
            } else {
                await api.rechazarPregunta(idPregunta);
            }
            toast(msg);
            await recargarEditor();
        } catch (e) {
            mostrarError(e);
        }
    };

    const handleEliminarPregunta = async (idPregunta) => {
        const ok = await confirmar({
            titulo: 'Delete question',
            mensaje: 'Delete this question?',
            ok: 'Delete',
            peligro: true,
        });
        if (!ok) return;
        try {
            const api = getEvalAPI()?.tutor;
            await api.eliminarPregunta(idPregunta);
            toast('Question deleted.');
            await recargarEditor();
        } catch (e) {
            mostrarError(e);
        }
    };

    const renderEvaluationCard = (ev) => {
        const abrir = () => abrirEditor(ev.id_evaluacion);
        return (
            <div
                key={ev.id_evaluacion}
                className="ev-card"
                role="button"
                tabIndex={0}
                style={{ cursor: 'pointer' }}
                onClick={abrir}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        abrir();
                    }
                }}
            >
                <div className="ev-card-icon">
                    <Icon name="fa-solid fa-circle-question" />
                </div>
                <div className="ev-card-body">
                    <div className="ev-card-title">{ev.titulo}</div>
                    <div className="ev-badges" style={{ marginTop: 8 }}>
                        <Badge estado={ev.estado} />
                        {ev.preguntas_pendientes ? (
                            <Badge
                                estado="BORRADOR"
                                textoPropio={plural(
                                    ev.preguntas_pendientes,
                                    'to review',
                                    'to review'
                                )}
                            />
                        ) : null}
                    </div>
                    <div className="ev-card-meta">
                        <span>
                            <Icon name="fa-regular fa-circle-question" />
                            {plural(
                                ev.preguntas_aprobadas,
                                'approved question',
                                'approved questions'
                            )}
                        </span>
                        <span>
                            <Icon name="fa-regular fa-user" />
                            {`${ev.intentos_presentados || 0} / ${ev.intentos_permitidos} ${ev.intentos_permitidos === 1 ? 'attempt' : 'attempts'}`}
                        </span>
                        {ev.fecha_limite ? (
                            <span>
                                <Icon name="fa-regular fa-calendar" />
                                {'Deadline: ' + fecha(ev.fecha_limite)}
                            </span>
                        ) : (
                            <span>
                                <Icon name="fa-regular fa-calendar" />
                                No deadline
                            </span>
                        )}
                    </div>
                </div>
                {ev.nota_final !== null ? (
                    <div className="ev-nota">
                        {nota(ev.nota_final)}
                        <small>{'of ' + ev.nota_maxima}</small>
                    </div>
                ) : null}
                <button
                    type="button"
                    className="ev-go"
                    aria-label={'Open ' + ev.titulo}
                    onClick={(e) => {
                        e.stopPropagation();
                        abrir();
                    }}
                >
                    <Icon name="fa-solid fa-arrow-right" />
                </button>
            </div>
        );
    };

    const renderQuestionCard = (p, n) => {
        const ed = editable(evActual);
        return (
            <article
                key={p.id_pregunta}
                className={
                    'ev-q' +
                    (p.origen === 'IA' ? ' ev-q--ia' : '') +
                    (p.estado_revision === 'RECHAZADA' ? ' ev-q--rechazada' : '')
                }
            >
                <div className="ev-q-top">
                    <span className="ev-q-num">{'Question ' + n}</span>
                    <BadgeOrigen origen={p.origen} />
                    {p.estado_revision !== 'APROBADA' || p.origen === 'IA' ? (
                        <Badge
                            estado={
                                p.estado_revision === 'BORRADOR'
                                    ? 'BORRADOR'
                                    : p.estado_revision
                            }
                            textoPropio={
                                p.estado_revision === 'BORRADOR'
                                    ? 'To review'
                                    : null
                            }
                        />
                    ) : null}
                    <span className="ev-badge">{TIPOS[p.tipo_pregunta]}</span>
                    <span className="ev-badge">
                        {'Points ' + p.valor_pregunta}
                    </span>
                    <div className="ev-q-tools">
                        {ed ? (
                            <>
                                {p.estado_revision !== 'APROBADA' ? (
                                    <button
                                        type="button"
                                        className="ev-icon-btn ev-icon-btn--ok"
                                        title="Approve"
                                        aria-label="Approve"
                                        onClick={() =>
                                            handleRevisarPregunta(
                                                p.id_pregunta,
                                                'approve',
                                                'Question approved.'
                                            )
                                        }
                                    >
                                        <Icon name="fa-solid fa-check" />
                                    </button>
                                ) : null}
                                {p.estado_revision !== 'RECHAZADA' ? (
                                    <button
                                        type="button"
                                        className="ev-icon-btn ev-icon-btn--bad"
                                        title="Reject"
                                        aria-label="Reject"
                                        onClick={() =>
                                            handleRevisarPregunta(
                                                p.id_pregunta,
                                                'reject',
                                                'Question rejected.'
                                            )
                                        }
                                    >
                                        <Icon name="fa-solid fa-ban" />
                                    </button>
                                ) : null}
                                <button
                                    type="button"
                                    className="ev-icon-btn"
                                    title="Edit"
                                    aria-label="Edit"
                                    onClick={() =>
                                        setQuestionModalState({
                                            open: true,
                                            pregunta: p,
                                        })
                                    }
                                >
                                    <Icon name="fa-solid fa-pen" />
                                </button>
                                <button
                                    type="button"
                                    className="ev-icon-btn ev-icon-btn--bad"
                                    title="Delete"
                                    aria-label="Delete"
                                    onClick={() =>
                                        handleEliminarPregunta(p.id_pregunta)
                                    }
                                >
                                    <Icon name="fa-solid fa-trash" />
                                </button>
                            </>
                        ) : null}
                    </div>
                </div>
                <div className="ev-q-text">{p.enunciado}</div>
                {p.opciones && p.opciones.length > 0 ? (
                    <ul className="ev-q-opts">
                        {p.opciones.map((o) => (
                            <li
                                key={o.id_opcion}
                                className={o.es_correcta ? 'is-ok' : ''}
                            >
                                <Icon
                                    name={
                                        o.es_correcta
                                            ? 'fa-solid fa-circle-check'
                                            : 'fa-regular fa-circle'
                                    }
                                />
                                {o.texto}
                            </li>
                        ))}
                    </ul>
                ) : null}
                {p.respuesta_esperada ? (
                    <div className="ev-q-note">
                        <b>Grading criteria: </b>
                        {p.respuesta_esperada}
                    </div>
                ) : null}
                {p.explicacion ? (
                    <div className="ev-q-note">
                        <b>Explanation: </b>
                        {p.explicacion}
                    </div>
                ) : null}
            </article>
        );
    };

    const puedePublicar = evActual && (evActual.preguntas_aprobadas || 0) > 0;
    const isEditable = editable(evActual);
    const nombreEstudianteIntento = estudiante
        ? estudiante
        : intentoActual
        ? `Student #${intentoActual.id_estudiante}`
        : '';

    return (
        <>
            <div id="ev-banner">
                {mockAIBanner ? (
                    <div className="ev-banner ev-banner--info">
                        <Icon name="fa-solid fa-flask" />
                        <span>
                            The backend is using SIMULATED AI (no
                            ANTHROPIC_API_KEY). Generated questions will be
                            simple; configure the API key to use real AI.
                        </span>
                    </div>
                ) : null}
            </div>

            {/* ===== EVALUATIONS LIST ===== */}
            <section
                className="ev-view"
                id="view-lista"
                aria-labelledby="lista-title"
                hidden={view !== 'lista'}
            >
                <div className="ev-panel">
                    <div className="ev-head">
                        <div style={{ marginRight: 'auto', minWidth: 0 }}>
                            <h3
                                id="lista-title"
                                style={{
                                    margin: 0,
                                    fontFamily: 'var(--font-serif)',
                                    fontSize: '22px',
                                }}
                            >
                                Practice Evaluations
                            </h3>
                            <p className="ev-sub" id="lista-contexto">
                                {contextText}
                            </p>
                        </div>
                        <button
                            type="button"
                            className="ev-btn ev-btn--primary"
                            id="btn-nueva"
                            onClick={() =>
                                setEvalModalState({ open: true, ev: null })
                            }
                        >
                            <Icon name="fa-solid fa-plus" />
                            New evaluation
                        </button>
                    </div>
                    <div className="ev-stack" id="lista-contenido">
                        {loadingLista ? (
                            <p className="ev-loading">Loading…</p>
                        ) : errorLista ? (
                            <div className="ev-empty">
                                <Icon name="fa-solid fa-plug-circle-xmark" />
                                {errorLista}
                                <div style={{ marginTop: 16 }}>
                                    <button
                                        type="button"
                                        className="ev-btn ev-btn--dark"
                                        onClick={cargarLista}
                                    >
                                        <Icon name="fa-solid fa-rotate" />
                                        Retry
                                    </button>
                                </div>
                            </div>
                        ) : lista.length === 0 ? (
                            <div className="ev-empty">
                                <Icon name="fa-regular fa-clipboard" />
                                There are no evaluations for this practice yet.
                                <br />
                                Create the first one with «New evaluation».
                            </div>
                        ) : (
                            lista.map(renderEvaluationCard)
                        )}
                    </div>
                </div>
            </section>

            {/* ===== EVALUATION EDITOR ===== */}
            <section
                className="ev-view"
                id="view-editor"
                aria-labelledby="editor-title"
                hidden={view !== 'editor'}
            >
                <div className="ev-panel">
                    <div className="ev-head">
                        <button
                            type="button"
                            className="ev-back"
                            id="btn-volver-lista"
                            aria-label="Back to list"
                            onClick={() => {
                                switchView('lista');
                                cargarLista();
                            }}
                        >
                            <Icon name="fa-solid fa-arrow-left" />
                        </button>
                        <div style={{ marginRight: 'auto', minWidth: 0 }}>
                            <h3
                                id="editor-title"
                                style={{
                                    margin: 0,
                                    fontFamily: 'var(--font-serif)',
                                    fontSize: '22px',
                                }}
                            >
                                {loadingEditor || !evActual
                                    ? 'Loading evaluation…'
                                    : evActual.titulo}
                            </h3>
                            <div
                                className="ev-badges"
                                id="editor-badges"
                                style={{ marginTop: 8 }}
                            >
                                {!loadingEditor && evActual ? (
                                    <>
                                        <Badge estado={evActual.estado} />
                                        <span className="ev-badge">
                                            <Icon name="fa-regular fa-star" />
                                            {`Max grade ${evActual.nota_maxima}`}
                                        </span>
                                        <span className="ev-badge">
                                            <Icon name="fa-solid fa-rotate-right" />
                                            {plural(
                                                evActual.intentos_permitidos,
                                                'attempt',
                                                'attempts'
                                            )}
                                        </span>
                                        {evActual.fecha_limite ? (
                                            <span className="ev-badge">
                                                <Icon name="fa-regular fa-calendar" />
                                                {fecha(evActual.fecha_limite)}
                                            </span>
                                        ) : (
                                            <span className="ev-badge">
                                                <Icon name="fa-regular fa-calendar" />
                                                No deadline
                                            </span>
                                        )}
                                    </>
                                ) : null}
                            </div>
                        </div>
                        <div className="ev-toolbar" id="editor-acciones">
                            {!loadingEditor && evActual ? (
                                <>
                                    {evActual.estado !== 'CERRADA' ? (
                                        <button
                                            type="button"
                                            className="ev-btn ev-btn--sm ev-btn--ghost"
                                            onClick={() =>
                                                setEvalModalState({
                                                    open: true,
                                                    ev: evActual,
                                                })
                                            }
                                        >
                                            <Icon name="fa-solid fa-pen" />
                                            Edit
                                        </button>
                                    ) : null}
                                    {evActual.estado === 'BORRADOR' ? (
                                        <BusyButton
                                            className={`ev-btn ev-btn--sm ${puedePublicar ? 'ev-btn--primary' : 'ev-btn--disabled'}`}
                                            icon="fa-solid fa-paper-plane"
                                            disabled={!puedePublicar}
                                            title={
                                                !puedePublicar
                                                    ? 'Approve at least one question before publishing'
                                                    : undefined
                                            }
                                            style={
                                                !puedePublicar
                                                    ? { cursor: 'not-allowed' }
                                                    : undefined
                                            }
                                            onClick={handlePublicar}
                                        >
                                            Publish to student
                                        </BusyButton>
                                    ) : null}
                                    {evActual.estado === 'PUBLICADA' &&
                                    evActual.intentos_presentados === 0 ? (
                                        <BusyButton
                                            className="ev-btn ev-btn--sm ev-btn--soft"
                                            icon="fa-solid fa-eye-slash"
                                            onClick={handleDespublicar}
                                        >
                                            Revert to draft
                                        </BusyButton>
                                    ) : null}
                                    {evActual.estado === 'PUBLICADA' ? (
                                        <BusyButton
                                            className="ev-btn ev-btn--sm ev-btn--dark"
                                            icon="fa-solid fa-lock"
                                            onClick={handleCerrar}
                                        >
                                            Close
                                        </BusyButton>
                                    ) : null}
                                    {evActual.intentos_presentados === 0 ? (
                                        <BusyButton
                                            className="ev-btn ev-btn--sm ev-btn--danger"
                                            icon="fa-solid fa-trash"
                                            onClick={handleEliminarEvaluacion}
                                        >
                                            Delete
                                        </BusyButton>
                                    ) : null}
                                </>
                            ) : null}
                        </div>
                    </div>

                    <div className="ev-stats" id="editor-stats">
                        {!loadingEditor && evActual ? (
                            <>
                                <div className="ev-stat">
                                    <b>{evActual.preguntas_aprobadas}</b>
                                    <span>Approved questions</span>
                                </div>
                                <div className="ev-stat">
                                    <b>{evActual.preguntas_pendientes}</b>
                                    <span>To review</span>
                                </div>
                                <div className="ev-stat">
                                    <b>{`${evActual.intentos_presentados || 0} / ${evActual.intentos_permitidos}`}</b>
                                    <span>Attempts</span>
                                </div>
                                <div className="ev-stat">
                                    <b>
                                        {evActual.nota_final === null
                                            ? '—'
                                            : nota(evActual.nota_final)}
                                    </b>
                                    <span>Final grade</span>
                                </div>
                            </>
                        ) : null}
                    </div>

                    <div className="ev-toolbar" id="editor-agregar">
                        {!loadingEditor && evActual ? (
                            isEditable ? (
                                <>
                                    <button
                                        type="button"
                                        className="ev-btn ev-btn--gold"
                                        onClick={() =>
                                            setGenerateModalOpen(true)
                                        }
                                    >
                                        <Icon name="fa-solid fa-wand-magic-sparkles" />
                                        Generate with AI
                                    </button>
                                    <button
                                        type="button"
                                        className="ev-btn ev-btn--dark"
                                        onClick={() =>
                                            setQuestionModalState({
                                                open: true,
                                                pregunta: null,
                                            })
                                        }
                                    >
                                        <Icon name="fa-solid fa-plus" />
                                        Add manual question
                                    </button>
                                </>
                            ) : (
                                <p className="ev-hint">
                                    {evActual.estado === 'CERRADA'
                                        ? 'The evaluation is closed.'
                                        : 'Attempts have already been submitted: questions cannot be modified.'}
                                </p>
                            )
                        ) : null}
                    </div>

                    <div className="ev-tabs" role="tablist">
                        <button
                            type="button"
                            className="ev-tab"
                            role="tab"
                            id="tab-preguntas"
                            aria-selected={String(tab === 'preguntas')}
                            onClick={() => cambiarTab('preguntas')}
                        >
                            Questions
                        </button>
                        <button
                            type="button"
                            className="ev-tab"
                            role="tab"
                            id="tab-resultados"
                            aria-selected={String(tab === 'resultados')}
                            onClick={() => cambiarTab('resultados')}
                        >
                            Results
                        </button>
                    </div>

                    <div
                        id="tabpanel-preguntas"
                        hidden={tab !== 'preguntas'}
                    >
                        {loadingEditor || !evActual ? (
                            <p className="ev-loading">Loading questions…</p>
                        ) : (
                            <>
                                {isEditable && evActual.preguntas_pendientes ? (
                                    <div className="ev-revision">
                                        <Icon name="fa-solid fa-triangle-exclamation" />
                                        {`${plural(evActual.preguntas_pendientes, 'AI-generated question is waiting for', 'AI-generated questions are waiting for')} your review. Only approved questions will be seen by the student.`}
                                        <BusyButton
                                            className="ev-btn ev-btn--sm ev-btn--dark"
                                            icon="fa-solid fa-check-double"
                                            onClick={handleAprobarTodas}
                                        >
                                            Approve all
                                        </BusyButton>
                                    </div>
                                ) : null}
                                {!evActual.preguntas ||
                                evActual.preguntas.length === 0 ? (
                                    <div className="ev-empty">
                                        <Icon name="fa-regular fa-circle-question" />
                                        This evaluation does not have any
                                        questions yet.
                                    </div>
                                ) : (
                                    <div className="ev-stack">
                                        {evActual.preguntas.map((p, i) =>
                                            renderQuestionCard(p, i + 1)
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div
                        id="tabpanel-resultados"
                        hidden={tab !== 'resultados'}
                    >
                        {loadingIntentos ? (
                            <p className="ev-loading">Loading…</p>
                        ) : errorIntentos ? (
                            <div className="ev-empty">
                                <Icon name="fa-solid fa-plug-circle-xmark" />
                                {errorIntentos}
                            </div>
                        ) : intentos.length === 0 ? (
                            <div className="ev-empty">
                                <Icon name="fa-regular fa-hourglass-half" />
                                No one has taken this evaluation yet.
                            </div>
                        ) : (
                            <table className="ev-table">
                                <thead>
                                    <tr>
                                        {[
                                            'Attempt',
                                            'Status',
                                            'Started',
                                            'Submitted',
                                            'Grade',
                                            '',
                                        ].map((t, idx) => (
                                            <th key={idx}>{t}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {intentos.map((i) => (
                                        <tr key={i.id_intento}>
                                            <td>
                                                {'Attempt ' + i.numero_intento}
                                            </td>
                                            <td>
                                                <Badge
                                                    estado={i.estado}
                                                    textoPropio={
                                                        i.estado === 'ENVIADO'
                                                            ? plural(
                                                                  i.respuestas_pendientes,
                                                                  'to grade',
                                                                  'to grade'
                                                              )
                                                            : null
                                                    }
                                                />
                                            </td>
                                            <td>
                                                {i.fecha_inicio
                                                    ? fecha(i.fecha_inicio)
                                                    : '—'}
                                            </td>
                                            <td>
                                                {i.fecha_envio
                                                    ? fecha(i.fecha_envio)
                                                    : 'In progress'}
                                            </td>
                                            <td>
                                                <b>{nota(i.nota_obtenida)}</b>
                                                {' / ' +
                                                    (evActual
                                                        ? evActual.nota_maxima
                                                        : '')}
                                            </td>
                                            <td>
                                                <BusyButton
                                                    className="ev-btn ev-btn--sm ev-btn--dark"
                                                    disabled={
                                                        i.estado === 'EN_CURSO'
                                                    }
                                                    busyText="Loading…"
                                                    onClick={() =>
                                                        abrirIntento(
                                                            i.id_intento
                                                        )
                                                    }
                                                >
                                                    View and grade
                                                </BusyButton>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </section>

            {/* ===== ATTEMPT DETAILS ===== */}
            <section
                className="ev-view"
                id="view-intento"
                aria-labelledby="intento-title"
                hidden={view !== 'intento'}
            >
                <div className="ev-panel">
                    <div className="ev-head">
                        <button
                            type="button"
                            className="ev-back"
                            id="btn-volver-editor"
                            aria-label="Back to evaluation"
                            onClick={() => {
                                setTab('resultados');
                                switchView('editor');
                                recargarEditor('resultados');
                            }}
                        >
                            <Icon name="fa-solid fa-arrow-left" />
                        </button>
                        <div style={{ marginRight: 'auto', minWidth: 0 }}>
                            <h3
                                id="intento-title"
                                style={{
                                    margin: 0,
                                    fontFamily: 'var(--font-serif)',
                                    fontSize: '22px',
                                }}
                            >
                                {intentoActual
                                    ? `${nombreEstudianteIntento} · attempt ${intentoActual.numero_intento}`
                                    : ''}
                            </h3>
                            <div
                                className="ev-badges"
                                id="intento-badges"
                                style={{ marginTop: 8 }}
                            >
                                {intentoActual ? (
                                    <>
                                        <Badge estado={intentoActual.estado} />
                                        <span className="ev-badge">
                                            <Icon name="fa-regular fa-star" />
                                            {`Grade ${nota(intentoActual.nota_obtenida)} / ${intentoActual.nota_maxima}`}
                                        </span>
                                        {intentoActual.fecha_envio ? (
                                            <span className="ev-badge">
                                                <Icon name="fa-regular fa-clock" />
                                                {'Submitted: ' +
                                                    fecha(
                                                        intentoActual.fecha_envio
                                                    )}
                                            </span>
                                        ) : (
                                            <span className="ev-badge">
                                                <Icon name="fa-solid fa-hourglass-half" />
                                                In progress
                                            </span>
                                        )}
                                        {intentoActual.fecha_inicio ? (
                                            <span className="ev-badge">
                                                <Icon name="fa-regular fa-calendar" />
                                                {'Started: ' +
                                                    fecha(
                                                        intentoActual.fecha_inicio
                                                    )}
                                            </span>
                                        ) : null}
                                    </>
                                ) : null}
                            </div>
                        </div>
                    </div>
                    <div className="ev-stack" id="intento-contenido">
                        {intentoActual && intentoActual.respuestas
                            ? intentoActual.respuestas.map((r, n) => (
                                  <AttemptRowQuestion
                                      key={r.id_pregunta || n}
                                      r={r}
                                      index={n + 1}
                                      onUpdatedIntento={(updated) =>
                                          setIntentoActual(updated)
                                      }
                                  />
                              ))
                            : null}
                    </div>
                </div>
            </section>

            {/* ===== MODALS ===== */}
            {evalModalState.open ? (
                <EvaluationModal
                    ev={evalModalState.ev}
                    practica={practica}
                    estudiante={estudiante}
                    onClose={() =>
                        setEvalModalState({ open: false, ev: null })
                    }
                    onSaved={async (savedEv, isNew) => {
                        setEvalModalState({ open: false, ev: null });
                        if (isNew) {
                            await abrirEditor(savedEv.id_evaluacion);
                        } else {
                            setEvActual(savedEv);
                        }
                    }}
                />
            ) : null}

            {questionModalState.open && evActual ? (
                <QuestionModal
                    pregunta={questionModalState.pregunta}
                    idEvaluacion={evActual.id_evaluacion}
                    onClose={() =>
                        setQuestionModalState({ open: false, pregunta: null })
                    }
                    onSaved={async () => {
                        setQuestionModalState({ open: false, pregunta: null });
                        await recargarEditor();
                    }}
                />
            ) : null}

            {generateModalOpen && evActual ? (
                <GenerateAIModal
                    idEvaluacion={evActual.id_evaluacion}
                    practica={practica}
                    onClose={() => setGenerateModalOpen(false)}
                    onGenerated={async () => {
                        setGenerateModalOpen(false);
                        await recargarEditor();
                    }}
                />
            ) : null}
        </>
    );
}
