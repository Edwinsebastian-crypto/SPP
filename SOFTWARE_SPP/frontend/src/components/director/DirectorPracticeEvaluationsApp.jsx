import React, { useState, useEffect, useCallback } from 'react';
import {
    TIPOS,
    fecha,
    nota,
    plural,
    getEvalAPI,
} from '../../utils/evalBridge';
import { Icon, Badge, BadgeOrigen, BusyButton } from '../common/Badge';

function resolveActivePractice() {
    let p = null;
    if (window.SPP_DIRECTOR?.currentPractice) {
        p = window.SPP_DIRECTOR.currentPractice;
    } else if (typeof window.SPP_DIRECTOR?.getCurrentPractice === 'function') {
        p = window.SPP_DIRECTOR.getCurrentPractice();
    } else {
        const selector = document.getElementById('practice-selector');
        if (selector && selector.value) {
            p = { id: selector.value, code: selector.value };
        }
    }
    return p;
}

function resetScrollDirector() {
    const shell = document.querySelector('.app-shell');
    const wrapper = document.querySelector('.practice-content-wrapper');
    const panelPreguntas = document.getElementById('questions-panel');
    const evWrapper = panelPreguntas?.querySelector('.ev-wrapper');
    window.scrollTo(0, 0);
    if (shell) shell.scrollTop = 0;
    if (wrapper) wrapper.scrollTop = 0;
    if (evWrapper) evWrapper.scrollTop = 0;
}

function EvaluationStatusBadge({ ev }) {
    if (!ev) return null;
    if (ev.estado === 'BORRADOR') {
        return (
            <span
                className="ev-badge ev-badge--borrador"
                title="The tutor has not published this evaluation yet"
            >
                <Icon name="fa-regular fa-clock" />
                Not assigned to student (Draft)
            </span>
        );
    }

    if (ev.estado === 'PUBLICADA') {
        const iniciados = Number(ev.intentos_iniciados) || 0;
        const enviados = Number(ev.intentos_enviados) || 0;
        const calificados = Number(ev.intentos_calificados) || 0;
        const pendientes = Number(ev.pendientes_revision) || 0;

        if (iniciados > enviados) {
            return (
                <span
                    className="ev-badge ev-badge--en_curso"
                    title="The student is currently answering this evaluation"
                >
                    <Icon name="fa-solid fa-hourglass-half" />
                    In progress
                </span>
            );
        }
        if (pendientes > 0) {
            return (
                <span
                    className="ev-badge ev-badge--enviado"
                    title="The student submitted their attempt and is awaiting tutor grading"
                >
                    <Icon name="fa-regular fa-clock" />
                    Submitted · Pending review
                </span>
            );
        }
        if (calificados > 0 || ev.nota_final !== null) {
            return (
                <span
                    className="ev-badge ev-badge--calificado"
                    title="Evaluation submitted and graded"
                >
                    <Icon name="fa-solid fa-circle-check" />
                    Graded
                </span>
            );
        }
        return (
            <span
                className="ev-badge ev-badge--publicada"
                title="Assigned to student, not yet started"
            >
                <Icon name="fa-solid fa-circle-check" />
                Assigned (Not started)
            </span>
        );
    }

    if (ev.estado === 'CERRADA') {
        return (
            <span
                className="ev-badge ev-badge--cerrada"
                title="Evaluation closed"
            >
                <Icon name="fa-solid fa-lock" />
                Closed
            </span>
        );
    }

    return <Badge estado={ev.estado} />;
}

export default function DirectorPracticeEvaluationsApp() {
    const [view, setView] = useState('lista'); // 'lista' | 'eval' | 'intento'
    const [practicaActiva, setPracticaActiva] = useState(() =>
        resolveActivePractice()
    );
    const [evaluaciones, setEvaluaciones] = useState([]);
    const [loadingLista, setLoadingLista] = useState(false);
    const [errorLista, setErrorLista] = useState(null);

    const [evalActual, setEvalActual] = useState(null);
    const [loadingEval, setLoadingEval] = useState(false);
    const [errorEval, setErrorEval] = useState(null);
    const [tab, setTab] = useState('preguntas'); // 'preguntas' | 'resultados'

    const [intentos, setIntentos] = useState([]);
    const [loadingIntentos, setLoadingIntentos] = useState(false);
    const [errorIntentos, setErrorIntentos] = useState(null);

    const [intentoActual, setIntentoActual] = useState(null);
    const [loadingIntento, setLoadingIntento] = useState(false);
    const [errorIntento, setErrorIntento] = useState(null);

    const switchView = useCallback((nextView) => {
        setView(nextView);
        resetScrollDirector();
    }, []);

    const cargarListaEvaluaciones = useCallback(async () => {
        const p = resolveActivePractice();
        setPracticaActiva(p);
        switchView('lista');

        if (!p || !p.id) {
            setEvaluaciones([]);
            setLoadingLista(false);
            setErrorLista(null);
            return;
        }

        setLoadingLista(true);
        setErrorLista(null);
        const practiceId = String(p.id || p.code || '');

        try {
            const api = getEvalAPI()?.director;
            const r = await api.listar({ id_practica: practiceId, limite: 100 });
            const lista = r?.items || (Array.isArray(r) ? r : []);
            setEvaluaciones(lista);
        } catch (e) {
            setErrorLista(
                (e && e.message) || 'Could not load practice evaluations.'
            );
            setEvaluaciones([]);
        } finally {
            setLoadingLista(false);
        }
    }, [switchView]);

    const cargarIntentosEvaluacion = useCallback(
        async (idEvaluacion, fallbackEval) => {
            setLoadingIntentos(true);
            setErrorIntentos(null);
            try {
                const api = getEvalAPI()?.director;
                const res = await api.listarIntentos(idEvaluacion);
                let listaIntentos = [];
                if (Array.isArray(res)) {
                    listaIntentos = res;
                } else if (res && typeof res === 'object') {
                    if (Array.isArray(res.items)) {
                        listaIntentos = res.items;
                    } else if (Array.isArray(res.intentos)) {
                        listaIntentos = res.intentos;
                    } else {
                        listaIntentos = Object.entries(res)
                            .filter(
                                ([k, v]) =>
                                    !isNaN(Number(k)) &&
                                    v &&
                                    typeof v === 'object' &&
                                    v.id_intento
                            )
                            .map(([, v]) => v);
                    }
                }
                const evRef = fallbackEval || evalActual;
                if (
                    !listaIntentos.length &&
                    Array.isArray(evRef?.intentos) &&
                    evRef.intentos.length
                ) {
                    listaIntentos = evRef.intentos;
                }
                setIntentos(listaIntentos);
            } catch (e) {
                setErrorIntentos(
                    (e && e.message) || 'Error loading student attempts.'
                );
            } finally {
                setLoadingIntentos(false);
            }
        },
        [evalActual]
    );

    const abrirDetalleEvaluacion = useCallback(
        async (idEvaluacion) => {
            switchView('eval');
            setLoadingEval(true);
            setErrorEval(null);
            setEvalActual(null);
            try {
                const api = getEvalAPI()?.director;
                const ev = await api.obtenerEvaluacion(idEvaluacion);
                setEvalActual(ev);
                if (tab === 'resultados') {
                    cargarIntentosEvaluacion(idEvaluacion, ev);
                }
            } catch (e) {
                setErrorEval({
                    id: idEvaluacion,
                    message:
                        (e && e.message) ||
                        'Error retrieving evaluation information.',
                });
            } finally {
                setLoadingEval(false);
            }
        },
        [cargarIntentosEvaluacion, switchView, tab]
    );

    const cambiarTabEvaluacion = (nombreTab) => {
        setTab(nombreTab);
        if (nombreTab === 'resultados' && evalActual) {
            cargarIntentosEvaluacion(evalActual.id_evaluacion, evalActual);
        }
    };

    const abrirDetalleIntento = async (idIntento) => {
        switchView('intento');
        setLoadingIntento(true);
        setErrorIntento(null);
        setIntentoActual(null);
        try {
            const api = getEvalAPI()?.director;
            const it = await api.verIntento(idIntento);
            setIntentoActual(it);
        } catch (e) {
            setErrorIntento({
                id: idIntento,
                message:
                    (e && e.message) || 'Error retrieving attempt answers.',
            });
        } finally {
            setLoadingIntento(false);
        }
    };

    useEffect(() => {
        const onPracticeChanged = (e) => {
            if (e.detail?.practice) {
                setPracticaActiva(e.detail.practice);
                const panelPreguntas =
                    document.getElementById('questions-panel');
                if (
                    panelPreguntas &&
                    panelPreguntas.style.display !== 'none'
                ) {
                    cargarListaEvaluaciones();
                }
            }
        };
        window.addEventListener(
            'spp:director-practice-changed',
            onPracticeChanged
        );

        const qBtn = document.getElementById('questions-btn');
        const qCard = document.getElementById('lb-card-questions');
        const onQBtnClick = () => {
            setTimeout(cargarListaEvaluaciones, 10);
        };
        const onQCardClick = (e) => {
            if (!e.target.closest('#questions-btn')) {
                setTimeout(cargarListaEvaluaciones, 10);
            }
        };
        if (qBtn) qBtn.addEventListener('click', onQBtnClick);
        if (qCard) qCard.addEventListener('click', onQCardClick);

        const qBack = document.getElementById('questionsBack');
        const onQBackClick = () => {
            switchView('lista');
        };
        if (qBack) qBack.addEventListener('click', onQBackClick);

        window.SPP_EVAL_DIRECTOR = {
            abrir: () => cargarListaEvaluaciones(),
            volverALista: () => switchView('lista'),
            recargar: () => cargarListaEvaluaciones(),
        };

        return () => {
            window.removeEventListener(
                'spp:director-practice-changed',
                onPracticeChanged
            );
            if (qBtn) qBtn.removeEventListener('click', onQBtnClick);
            if (qCard) qCard.removeEventListener('click', onQCardClick);
            if (qBack) qBack.removeEventListener('click', onQBackClick);
        };
    }, [cargarListaEvaluaciones, switchView]);

    // Compute KPIs for list
    const kpiStats = (() => {
        const total = evaluaciones.length;
        let asignadas = 0;
        let enCurso = 0;
        let sumaNotas = 0;
        let cantCalificadas = 0;

        evaluaciones.forEach((ev) => {
            if (ev.estado === 'PUBLICADA' || ev.estado === 'CERRADA')
                asignadas++;
            const enviados = Number(ev.intentos_enviados) || 0;
            const iniciados = Number(ev.intentos_iniciados) || 0;
            if (ev.estado === 'PUBLICADA' && iniciados > enviados) {
                enCurso++;
            }
            if (ev.nota_final !== null && ev.nota_final !== undefined) {
                sumaNotas += Number(ev.nota_final);
                cantCalificadas++;
            }
        });

        return {
            total: String(total),
            asignadas: String(asignadas),
            enCurso: String(enCurso),
            promedio:
                cantCalificadas > 0
                    ? (sumaNotas / cantCalificadas).toFixed(1) + ' / 5.0'
                    : '—',
        };
    })();

    const estudianteActivo =
        practicaActiva?.student || practicaActiva?.studentName || '';
    const listaContextoText =
        practicaActiva && practicaActiva.id
            ? `Practice #${practicaActiva.code || practicaActiva.id} · ${estudianteActivo || 'Assigned student'}${practicaActiva.tutor ? ' · Tutor: ' + practicaActiva.tutor : ''}`
            : 'Loading context…';

    return (
        <>
            <div id="dir-q-banner" />

            {/* ===== 1. LISTA DE EVALUACIONES DE LA PRÁCTICA ===== */}
            <section
                className="ev-view"
                id="dir-q-view-lista"
                aria-labelledby="dir-q-lista-title"
                hidden={view !== 'lista'}
            >
                <div className="ev-panel">
                    <div className="ev-head">
                        <div style={{ marginRight: 'auto', minWidth: 0 }}>
                            <h3
                                id="dir-q-lista-title"
                                style={{
                                    margin: 0,
                                    fontFamily: 'var(--font-serif)',
                                    fontSize: '22px',
                                }}
                            >
                                Practice Evaluations
                            </h3>
                            <p className="ev-sub" id="dir-q-lista-contexto">
                                {listaContextoText}
                            </p>
                        </div>
                        <BusyButton
                            className="ev-btn ev-btn--sm ev-btn--ghost"
                            id="dir-q-btn-recargar"
                            title="Reload evaluations"
                            icon="fa-solid fa-rotate"
                            onClick={cargarListaEvaluaciones}
                        >
                            Refresh
                        </BusyButton>
                    </div>

                    <div
                        className="ev-stats"
                        id="dir-q-list-stats"
                        style={{ marginBottom: 20 }}
                    >
                        <div className="ev-stat">
                            <b id="dir-kpi-total-evals">{kpiStats.total}</b>
                            <span>Evaluations</span>
                        </div>
                        <div className="ev-stat">
                            <b id="dir-kpi-assigned">{kpiStats.asignadas}</b>
                            <span>Assigned</span>
                        </div>
                        <div className="ev-stat">
                            <b id="dir-kpi-in-progress">{kpiStats.enCurso}</b>
                            <span>In progress</span>
                        </div>
                        <div className="ev-stat">
                            <b id="dir-kpi-avg-grade">{kpiStats.promedio}</b>
                            <span>Average</span>
                        </div>
                    </div>

                    <div className="ev-stack" id="dir-q-lista-contenido">
                        {loadingLista ? (
                            <p className="ev-loading">Loading evaluations…</p>
                        ) : !practicaActiva || !practicaActiva.id ? (
                            <div className="ev-empty">
                                <Icon name="fa-regular fa-folder-open" />
                                Select a practice first to view its evaluations.
                            </div>
                        ) : errorLista ? (
                            <div className="ev-empty">
                                <Icon name="fa-solid fa-plug-circle-xmark" />
                                {errorLista}
                                <div style={{ marginTop: 16 }}>
                                    <button
                                        type="button"
                                        className="ev-btn ev-btn--dark"
                                        onClick={cargarListaEvaluaciones}
                                    >
                                        <Icon name="fa-solid fa-rotate" />
                                        Retry
                                    </button>
                                </div>
                            </div>
                        ) : evaluaciones.length === 0 ? (
                            <div className="ev-empty">
                                <Icon name="fa-regular fa-clipboard" />
                                No evaluations created for this practice yet.
                                <p className="ev-sub" style={{ marginTop: 8 }}>
                                    The assigned tutor can create evaluations
                                    with manual or AI-generated questions.
                                </p>
                            </div>
                        ) : (
                            evaluaciones.map((ev) => {
                                const abrir = () =>
                                    abrirDetalleEvaluacion(ev.id_evaluacion);
                                return (
                                    <div
                                        key={ev.id_evaluacion}
                                        className="ev-card"
                                        role="button"
                                        tabIndex={0}
                                        style={{ cursor: 'pointer' }}
                                        onClick={abrir}
                                        onKeyDown={(e) => {
                                            if (
                                                e.key === 'Enter' ||
                                                e.key === ' '
                                            ) {
                                                e.preventDefault();
                                                abrir();
                                            }
                                        }}
                                    >
                                        <div className="ev-card-icon">
                                            <Icon name="fa-solid fa-circle-question" />
                                        </div>
                                        <div className="ev-card-body">
                                            <div className="ev-card-title">
                                                {ev.titulo}
                                            </div>
                                            <div
                                                className="ev-badges"
                                                style={{ marginTop: 8 }}
                                            >
                                                <EvaluationStatusBadge
                                                    ev={ev}
                                                />
                                                {ev.vencida &&
                                                ev.estado === 'PUBLICADA' ? (
                                                    <span className="ev-badge ev-badge--cerrada">
                                                        <Icon name="fa-regular fa-calendar-xmark" />
                                                        Deadline passed
                                                    </span>
                                                ) : null}
                                                {ev.preguntas_pendientes ? (
                                                    <span className="ev-badge ev-badge--borrador">
                                                        {`${ev.preguntas_pendientes} pending tutor review`}
                                                    </span>
                                                ) : null}
                                            </div>
                                            <div className="ev-card-meta">
                                                <span>
                                                    <Icon name="fa-regular fa-circle-question" />
                                                    {plural(
                                                        ev.total_preguntas,
                                                        'question',
                                                        'questions'
                                                    )}
                                                </span>
                                                {ev.preguntas_ia ? (
                                                    <span>
                                                        <Icon name="fa-solid fa-wand-magic-sparkles" />
                                                        {`${ev.preguntas_ia} with AI`}
                                                    </span>
                                                ) : null}
                                                <span>
                                                    <Icon name="fa-regular fa-user" />
                                                    {`${ev.intentos_presentados ?? ev.intentos_enviados ?? ev.intentos_iniciados ?? 0} / ${ev.intentos_permitidos} ${ev.intentos_permitidos === 1 ? 'attempt' : 'attempts'}`}
                                                </span>
                                                {ev.fecha_limite ? (
                                                    <span>
                                                        <Icon name="fa-regular fa-calendar" />
                                                        {'Deadline: ' +
                                                            fecha(
                                                                ev.fecha_limite
                                                            )}
                                                    </span>
                                                ) : (
                                                    <span>
                                                        <Icon name="fa-regular fa-calendar" />
                                                        No deadline
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {ev.nota_final !== null &&
                                        ev.nota_final !== undefined ? (
                                            <div className="ev-nota">
                                                {nota(ev.nota_final)}
                                                <small>
                                                    {'of ' + ev.nota_maxima}
                                                </small>
                                            </div>
                                        ) : (
                                            <div className="ev-nota">
                                                —<small>Ungraded</small>
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            className="ev-go"
                                            aria-label={
                                                'View evaluation ' + ev.titulo
                                            }
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                abrir();
                                            }}
                                        >
                                            <Icon name="fa-solid fa-arrow-right" />
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </section>

            {/* ===== 2. DETALLE DE EVALUACIÓN (PREGUNTAS DEL TUTOR + INTENTOS DEL ESTUDIANTE) ===== */}
            <section
                className="ev-view"
                id="dir-q-view-eval"
                aria-labelledby="dir-q-eval-title"
                hidden={view !== 'eval'}
            >
                <div className="ev-panel">
                    <div className="ev-head">
                        <button
                            type="button"
                            className="ev-back"
                            id="dir-q-btn-volver-lista"
                            aria-label="Back to evaluations list"
                            onClick={() => {
                                switchView('lista');
                                cargarListaEvaluaciones();
                            }}
                        >
                            <Icon name="fa-solid fa-arrow-left" />
                        </button>
                        <div style={{ marginRight: 'auto', minWidth: 0 }}>
                            <h3
                                id="dir-q-eval-title"
                                style={{
                                    margin: 0,
                                    fontFamily: 'var(--font-serif)',
                                    fontSize: '22px',
                                }}
                            >
                                {loadingEval
                                    ? 'Loading evaluation…'
                                    : errorEval
                                    ? 'Could not load evaluation'
                                    : evalActual
                                    ? evalActual.titulo
                                    : ''}
                            </h3>
                            <div
                                className="ev-badges"
                                id="dir-q-eval-badges"
                                style={{ marginTop: 8 }}
                            >
                                {!loadingEval && evalActual ? (
                                    <>
                                        <EvaluationStatusBadge
                                            ev={evalActual}
                                        />
                                        <span className="ev-badge">
                                            <Icon name="fa-regular fa-star" />
                                            {`Max grade ${evalActual.nota_maxima}`}
                                        </span>
                                        <span className="ev-badge">
                                            <Icon name="fa-solid fa-rotate-right" />
                                            {plural(
                                                evalActual.intentos_permitidos,
                                                'allowed attempt',
                                                'allowed attempts'
                                            )}
                                        </span>
                                        {evalActual.fecha_limite ? (
                                            <span className="ev-badge">
                                                <Icon name="fa-regular fa-calendar" />
                                                {'Deadline: ' +
                                                    fecha(
                                                        evalActual.fecha_limite
                                                    )}
                                            </span>
                                        ) : (
                                            <span className="ev-badge">
                                                <Icon name="fa-regular fa-calendar" />
                                                No submission deadline
                                            </span>
                                        )}
                                    </>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    <p
                        id="dir-q-eval-desc"
                        className="ev-sub"
                        style={{
                            margin: '-10px 0 16px 0',
                            fontSize: 14,
                            lineHeight: 1.5,
                            color: 'var(--text-primary)',
                        }}
                    >
                        {!loadingEval && evalActual
                            ? evalActual.descripcion &&
                              evalActual.descripcion.trim()
                                ? evalActual.descripcion
                                : 'No additional instructions.'
                            : ''}
                    </p>

                    <div className="ev-stats" id="dir-q-eval-stats">
                        {!loadingEval && evalActual ? (
                            <>
                                <div className="ev-stat">
                                    <b>{String(evalActual.total_preguntas)}</b>
                                    <span>Created questions</span>
                                    <span
                                        style={{
                                            display: 'block',
                                            fontSize: 11,
                                            opacity: 0.75,
                                            marginTop: 2,
                                        }}
                                    >
                                        {`${evalActual.preguntas_aprobadas} approved`}
                                    </span>
                                </div>
                                <div className="ev-stat">
                                    <b>{`${evalActual.intentos_presentados || 0} / ${evalActual.intentos_permitidos}`}</b>
                                    <span>Student attempts</span>
                                    <span
                                        style={{
                                            display: 'block',
                                            fontSize: 11,
                                            opacity: 0.75,
                                            marginTop: 2,
                                        }}
                                    >
                                        {evalActual.intentos_permitidos > 1
                                            ? 'Multiple attempts'
                                            : 'Single attempt'}
                                    </span>
                                </div>
                                <div className="ev-stat">
                                    <b>
                                        {evalActual.preguntas_pendientes
                                            ? `${evalActual.preguntas_pendientes} pending`
                                            : 'Up to date'}
                                    </b>
                                    <span>Tutor review</span>
                                    <span
                                        style={{
                                            display: 'block',
                                            fontSize: 11,
                                            opacity: 0.75,
                                            marginTop: 2,
                                        }}
                                    >
                                        {evalActual.estado === 'BORRADOR'
                                            ? 'Not yet published'
                                            : 'Published'}
                                    </span>
                                </div>
                                <div className="ev-stat">
                                    <b>
                                        {evalActual.nota_final !== null &&
                                        evalActual.nota_final !== undefined
                                            ? `${nota(evalActual.nota_final)} / ${evalActual.nota_maxima}`
                                            : 'Ungraded'}
                                    </b>
                                    <span>Final grade recorded</span>
                                    <span
                                        style={{
                                            display: 'block',
                                            fontSize: 11,
                                            opacity: 0.75,
                                            marginTop: 2,
                                        }}
                                    >
                                        {evalActual.nota_final !== null
                                            ? 'Current grade'
                                            : 'Pending'}
                                    </span>
                                </div>
                            </>
                        ) : null}
                    </div>

                    <div
                        className="ev-tabs"
                        role="tablist"
                        aria-label="Evaluation tabs"
                    >
                        <button
                            type="button"
                            className="ev-tab"
                            role="tab"
                            id="dir-q-tab-preguntas"
                            aria-selected={String(tab === 'preguntas')}
                            onClick={() => cambiarTabEvaluacion('preguntas')}
                        >
                            <i
                                className="fa-regular fa-circle-question"
                                style={{ marginRight: 6 }}
                            />
                            Tutor Questions
                        </button>
                        <button
                            type="button"
                            className="ev-tab"
                            role="tab"
                            id="dir-q-tab-resultados"
                            aria-selected={String(tab === 'resultados')}
                            onClick={() => cambiarTabEvaluacion('resultados')}
                        >
                            <i
                                className="fa-solid fa-user-graduate"
                                style={{ marginRight: 6 }}
                            />
                            Answers & Attempts
                        </button>
                    </div>

                    <div
                        id="dir-q-panel-preguntas"
                        role="tabpanel"
                        hidden={tab !== 'preguntas'}
                    >
                        {loadingEval ? (
                            <p className="ev-loading">Loading questions…</p>
                        ) : errorEval ? (
                            <div className="ev-empty">
                                <Icon name="fa-solid fa-triangle-exclamation" />
                                {errorEval.message}
                                <div style={{ marginTop: 14 }}>
                                    <button
                                        type="button"
                                        className="ev-btn ev-btn--dark"
                                        onClick={() =>
                                            abrirDetalleEvaluacion(errorEval.id)
                                        }
                                    >
                                        <Icon name="fa-solid fa-rotate" />
                                        Retry
                                    </button>
                                </div>
                            </div>
                        ) : !evalActual?.preguntas?.length ? (
                            <div className="ev-empty">
                                <Icon name="fa-regular fa-circle-question" />
                                This evaluation does not have questions added by
                                the tutor yet.
                            </div>
                        ) : (
                            <div className="ev-stack">
                                {evalActual.preguntas.map((p, idx) => (
                                    <article
                                        key={p.id_pregunta || idx}
                                        className={
                                            'ev-q' +
                                            (p.origen === 'IA'
                                                ? ' ev-q--ia'
                                                : '') +
                                            (p.estado_revision === 'RECHAZADA'
                                                ? ' ev-q--rechazada'
                                                : '')
                                        }
                                    >
                                        <div className="ev-q-top">
                                            <span className="ev-q-num">
                                                {`Question ${idx + 1}`}
                                            </span>
                                            <BadgeOrigen origen={p.origen} />
                                            <span className="ev-badge">
                                                {TIPOS[p.tipo_pregunta] ||
                                                    p.tipo_pregunta}
                                            </span>
                                            <span className="ev-badge">
                                                {`Value: ${p.valor_pregunta} pts`}
                                            </span>
                                            {p.estado_revision ===
                                            'APROBADA' ? (
                                                <span className="ev-badge ev-badge--aprobada">
                                                    <Icon name="fa-solid fa-check" />
                                                    Approved by tutor
                                                </span>
                                            ) : p.estado_revision ===
                                              'RECHAZADA' ? (
                                                <span className="ev-badge ev-badge--rechazada">
                                                    <Icon name="fa-solid fa-ban" />
                                                    Rejected by tutor
                                                </span>
                                            ) : (
                                                <span className="ev-badge ev-badge--borrador">
                                                    <Icon name="fa-regular fa-clock" />
                                                    Pending tutor review
                                                </span>
                                            )}
                                        </div>
                                        <div className="ev-q-text">
                                            {p.enunciado}
                                        </div>
                                        {p.opciones && p.opciones.length > 0 ? (
                                            <ul className="ev-q-opts">
                                                {p.opciones.map((opc, oIdx) => {
                                                    const esOk = Boolean(
                                                        opc.es_correcta
                                                    );
                                                    return (
                                                        <li
                                                            key={
                                                                opc.id_opcion ||
                                                                oIdx
                                                            }
                                                            className={
                                                                esOk
                                                                    ? 'is-ok'
                                                                    : ''
                                                            }
                                                        >
                                                            <Icon
                                                                name={
                                                                    esOk
                                                                        ? 'fa-solid fa-circle-check'
                                                                        : 'fa-regular fa-circle'
                                                                }
                                                            />
                                                            <span
                                                                style={
                                                                    esOk
                                                                        ? {
                                                                              fontWeight: 700,
                                                                          }
                                                                        : undefined
                                                                }
                                                            >
                                                                {opc.texto}
                                                            </span>
                                                            {esOk ? (
                                                                <small
                                                                    style={{
                                                                        marginLeft:
                                                                            'auto',
                                                                        fontWeight: 600,
                                                                        opacity: 0.85,
                                                                    }}
                                                                >
                                                                    (Correct
                                                                    answer)
                                                                </small>
                                                            ) : null}
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        ) : null}
                                        {p.tipo_pregunta === 'ABIERTA' &&
                                        p.respuesta_esperada ? (
                                            <div className="ev-q-note">
                                                <b>
                                                    Grading criteria / Expected
                                                    answer:{' '}
                                                </b>
                                                {p.respuesta_esperada}
                                            </div>
                                        ) : null}
                                        {p.explicacion ? (
                                            <div
                                                className="ev-q-note"
                                                style={{
                                                    background:
                                                        'rgba(40,131,96,.12)',
                                                    color: 'var(--text-primary)',
                                                }}
                                            >
                                                <b>Tutor explanation: </b>
                                                {p.explicacion}
                                            </div>
                                        ) : null}
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>

                    <div
                        id="dir-q-panel-resultados"
                        role="tabpanel"
                        hidden={tab !== 'resultados'}
                    >
                        {loadingIntentos ? (
                            <p className="ev-loading">
                                Loading student attempts and answers…
                            </p>
                        ) : errorIntentos ? (
                            <div className="ev-empty">
                                <Icon name="fa-solid fa-plug-circle-xmark" />
                                {errorIntentos}
                                <div style={{ marginTop: 14 }}>
                                    <button
                                        type="button"
                                        className="ev-btn ev-btn--dark"
                                        onClick={() =>
                                            evalActual &&
                                            cargarIntentosEvaluacion(
                                                evalActual.id_evaluacion,
                                                evalActual
                                            )
                                        }
                                    >
                                        <Icon name="fa-solid fa-rotate" />
                                        Retry
                                    </button>
                                </div>
                            </div>
                        ) : intentos.length === 0 ? (
                            <div className="ev-empty">
                                <Icon name="fa-regular fa-hourglass-half" />
                                {evalActual?.estado === 'BORRADOR'
                                    ? 'This evaluation has not been assigned to the student yet (it is in draft).'
                                    : 'The student has not started any attempt on this evaluation yet.'}
                            </div>
                        ) : (
                            <div
                                className="dv-tablewrap"
                                style={{ overflowX: 'auto' }}
                            >
                                <table
                                    className="ev-table"
                                    style={{ width: '100%', minWidth: 600 }}
                                >
                                    <thead>
                                        <tr>
                                            {[
                                                'Attempt',
                                                'Status',
                                                'Start',
                                                'Submitted',
                                                'Grade',
                                                'Action',
                                            ].map((col) => (
                                                <th
                                                    key={col}
                                                    style={
                                                        col === 'Action'
                                                            ? {
                                                                  textAlign:
                                                                      'right',
                                                              }
                                                            : undefined
                                                    }
                                                >
                                                    {col}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {intentos.map((it) => {
                                            let badgeEstado = (
                                                <Badge estado={it.estado} />
                                            );
                                            if (it.estado === 'EN_CURSO') {
                                                badgeEstado = (
                                                    <span className="ev-badge ev-badge--en_curso">
                                                        <Icon name="fa-solid fa-hourglass-half" />
                                                        In progress
                                                    </span>
                                                );
                                            } else if (
                                                it.estado === 'ENVIADO'
                                            ) {
                                                badgeEstado = (
                                                    <span className="ev-badge ev-badge--enviado">
                                                        <Icon name="fa-regular fa-clock" />
                                                        {`Submitted (${it.respuestas_pendientes || 0} to grade)`}
                                                    </span>
                                                );
                                            } else if (
                                                it.estado === 'CALIFICADO'
                                            ) {
                                                badgeEstado = (
                                                    <span className="ev-badge ev-badge--calificado">
                                                        <Icon name="fa-solid fa-circle-check" />
                                                        Graded
                                                    </span>
                                                );
                                            }

                                            const notaTxt =
                                                it.nota_obtenida !== null &&
                                                it.nota_obtenida !== undefined
                                                    ? `${nota(it.nota_obtenida)} / ${evalActual?.nota_maxima || 5.0}`
                                                    : '—';

                                            return (
                                                <tr key={it.id_intento}>
                                                    <td
                                                        style={{
                                                            fontWeight: 600,
                                                        }}
                                                    >
                                                        {`Attempt #${it.numero_intento}`}
                                                    </td>
                                                    <td>{badgeEstado}</td>
                                                    <td>
                                                        {fecha(it.fecha_inicio)}
                                                    </td>
                                                    <td>
                                                        {it.fecha_envio ? (
                                                            fecha(
                                                                it.fecha_envio
                                                            )
                                                        ) : (
                                                            <span
                                                                style={{
                                                                    color: 'var(--text-muted)',
                                                                    fontStyle:
                                                                        'italic',
                                                                }}
                                                            >
                                                                Taking now…
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td
                                                        style={{
                                                            fontWeight: 700,
                                                        }}
                                                    >
                                                        {notaTxt}
                                                    </td>
                                                    <td
                                                        style={{
                                                            textAlign: 'right',
                                                        }}
                                                    >
                                                        <button
                                                            type="button"
                                                            className="ev-btn ev-btn--sm ev-btn--dark"
                                                            onClick={() =>
                                                                abrirDetalleIntento(
                                                                    it.id_intento
                                                                )
                                                            }
                                                        >
                                                            <Icon name="fa-solid fa-eye" />
                                                            View answers
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* ===== 3. DETALLE DE UN INTENTO ===== */}
            <section
                className="ev-view"
                id="dir-q-view-intento"
                aria-labelledby="dir-q-intento-title"
                hidden={view !== 'intento'}
            >
                <div className="ev-panel">
                    <div className="ev-head">
                        <button
                            type="button"
                            className="ev-back"
                            id="dir-q-btn-volver-eval"
                            aria-label="Back to evaluation"
                            onClick={() => {
                                switchView('eval');
                                cambiarTabEvaluacion('resultados');
                            }}
                        >
                            <Icon name="fa-solid fa-arrow-left" />
                        </button>
                        <div style={{ marginRight: 'auto', minWidth: 0 }}>
                            <h3
                                id="dir-q-intento-title"
                                style={{
                                    margin: 0,
                                    fontFamily: 'var(--font-serif)',
                                    fontSize: '22px',
                                }}
                            >
                                {loadingIntento
                                    ? 'Loading attempt answers…'
                                    : errorIntento
                                    ? 'Could not open attempt'
                                    : intentoActual
                                    ? `${estudianteActivo ? estudianteActivo : `Student #${intentoActual.id_estudiante}`} · Attempt #${intentoActual.numero_intento}`
                                    : ''}
                            </h3>
                            <div
                                className="ev-badges"
                                id="dir-q-intento-badges"
                                style={{ marginTop: 8 }}
                            >
                                {!loadingIntento && intentoActual ? (
                                    <>
                                        {intentoActual.estado === 'EN_CURSO' ? (
                                            <span className="ev-badge ev-badge--en_curso">
                                                <Icon name="fa-solid fa-hourglass-half" />
                                                In progress (student answering)
                                            </span>
                                        ) : intentoActual.estado ===
                                          'ENVIADO' ? (
                                            <span className="ev-badge ev-badge--enviado">
                                                <Icon name="fa-regular fa-clock" />
                                                Submitted · Pending grading
                                            </span>
                                        ) : intentoActual.estado ===
                                          'CALIFICADO' ? (
                                            <span className="ev-badge ev-badge--calificado">
                                                <Icon name="fa-solid fa-circle-check" />
                                                Graded
                                            </span>
                                        ) : (
                                            <Badge
                                                estado={intentoActual.estado}
                                            />
                                        )}
                                        <span className="ev-badge">
                                            <Icon name="fa-regular fa-star" />
                                            {`Grade: ${nota(intentoActual.nota_obtenida)} / ${intentoActual.nota_maxima}`}
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
                                                <Icon name="fa-solid fa-spinner fa-spin" />
                                                In progress
                                            </span>
                                        )}
                                        <span className="ev-badge">
                                            <Icon name="fa-regular fa-calendar" />
                                            {'Started: ' +
                                                fecha(
                                                    intentoActual.fecha_inicio
                                                )}
                                        </span>
                                    </>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    <div className="ev-stack" id="dir-q-intento-contenido">
                        {loadingIntento ? (
                            <p className="ev-loading">Loading answers…</p>
                        ) : errorIntento ? (
                            <div className="ev-empty">
                                <Icon name="fa-solid fa-triangle-exclamation" />
                                {errorIntento.message}
                                <div style={{ marginTop: 14 }}>
                                    <button
                                        type="button"
                                        className="ev-btn ev-btn--dark"
                                        onClick={() =>
                                            abrirDetalleIntento(errorIntento.id)
                                        }
                                    >
                                        <Icon name="fa-solid fa-rotate" />
                                        Retry
                                    </button>
                                </div>
                            </div>
                        ) : !intentoActual?.respuestas?.length ? (
                            <div className="ev-empty">
                                <Icon name="fa-regular fa-folder-open" />
                                No answers recorded for this attempt.
                            </div>
                        ) : (
                            intentoActual.respuestas.map((r, idx) => {
                                const esAbierta = r.tipo_pregunta === 'ABIERTA';
                                const claseAns =
                                    r.es_correcta === true
                                        ? ' ev-ans--ok'
                                        : r.es_correcta === false
                                        ? ' ev-ans--bad'
                                        : '';
                                const notaObt =
                                    r.nota_obtenida !== null &&
                                    r.nota_obtenida !== undefined
                                        ? nota(r.nota_obtenida)
                                        : '—';

                                return (
                                    <article
                                        key={r.id_pregunta || idx}
                                        className="ev-q"
                                    >
                                        <div className="ev-q-top">
                                            <span className="ev-q-num">
                                                {`Question ${idx + 1}`}
                                            </span>
                                            <span className="ev-badge">
                                                {TIPOS[r.tipo_pregunta] ||
                                                    r.tipo_pregunta}
                                            </span>
                                            <span className="ev-badge">
                                                {`Value: ${r.valor_pregunta} pts`}
                                            </span>
                                            {r.pendiente ? (
                                                <span className="ev-badge ev-badge--enviado">
                                                    <Icon name="fa-regular fa-clock" />
                                                    Pending grading
                                                </span>
                                            ) : (
                                                <span className="ev-badge ev-badge--calificado">
                                                    <Icon name="fa-solid fa-circle-check" />
                                                    {`Grade: ${notaObt} / ${r.valor_pregunta} pts`}
                                                </span>
                                            )}
                                            {r.es_correcta === true ? (
                                                <span className="ev-badge ev-badge--aprobada">
                                                    <Icon name="fa-solid fa-check" />
                                                    Correct
                                                </span>
                                            ) : r.es_correcta === false ? (
                                                <span className="ev-badge ev-badge--rechazada">
                                                    <Icon name="fa-solid fa-xmark" />
                                                    Incorrect
                                                </span>
                                            ) : null}
                                        </div>
                                        <div className="ev-q-text">
                                            {r.enunciado}
                                        </div>
                                        <div style={{ marginTop: 10 }}>
                                            <small
                                                style={{
                                                    fontWeight: 700,
                                                    textTransform: 'uppercase',
                                                    fontSize: 11,
                                                    color: 'var(--text-muted)',
                                                }}
                                            >
                                                Answer submitted by student:
                                            </small>
                                            <div
                                                className={'ev-ans' + claseAns}
                                            >
                                                {r.respuesta &&
                                                r.respuesta.trim()
                                                    ? r.respuesta
                                                    : '(Unanswered)'}
                                            </div>
                                        </div>
                                        {!esAbierta &&
                                        r.es_correcta === false &&
                                        r.opcion_correcta ? (
                                            <div
                                                className="ev-q-note"
                                                style={{
                                                    background:
                                                        'rgba(40,131,96,.12)',
                                                    marginTop: 10,
                                                }}
                                            >
                                                <b>Expected correct option: </b>
                                                {r.opcion_correcta}
                                            </div>
                                        ) : null}
                                        {esAbierta && r.respuesta_esperada ? (
                                            <div
                                                className="ev-q-note"
                                                style={{ marginTop: 10 }}
                                            >
                                                <b>
                                                    Evaluation criteria /
                                                    Expected answer:{' '}
                                                </b>
                                                {r.respuesta_esperada}
                                            </div>
                                        ) : null}
                                        {r.retros && r.retros.length > 0
                                            ? r.retros.map((ret, rIdx) => (
                                                  <div
                                                      key={ret.id_retro || rIdx}
                                                      className="ev-retro"
                                                      style={{ marginTop: 10 }}
                                                  >
                                                      <Icon name="fa-solid fa-comment-dots" />
                                                      <b
                                                          style={{
                                                              marginLeft: 6,
                                                          }}
                                                      >
                                                          Tutor feedback:{' '}
                                                      </b>
                                                      {ret.comentario}
                                                      {ret.fecha ? (
                                                          <small
                                                              style={{
                                                                  display:
                                                                      'block',
                                                                  opacity: 0.7,
                                                                  marginTop: 3,
                                                              }}
                                                          >
                                                              {fecha(ret.fecha)}
                                                          </small>
                                                      ) : null}
                                                  </div>
                                              ))
                                            : null}
                                    </article>
                                );
                            })
                        )}
                    </div>
                </div>
            </section>
        </>
    );
}
