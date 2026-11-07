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
import { Icon, Badge, BusyButton } from '../common/Badge';
import { Modal } from '../common/Modal';
import { emit, EVENTS } from '../../core/events';
import { provide } from '../../core/registry';

const refreshQuestionsPill = () => {
    emit(EVENTS.UPDATE_STUDENT_QUESTIONS_PILL);
};

function isDeadlineExpiredError(e) {
    const msg = (e && e.message) || '';
    return (
        e &&
        e.status === 409 &&
        (msg.includes('fecha límite') ||
            msg.includes('expirado') ||
            msg.includes('venció') ||
            msg.includes('comunícate con tu tutor') ||
            msg.toLowerCase().includes('deadline') ||
            msg.toLowerCase().includes('expired'))
    );
}

function isQuestionAnswered(p, respMap) {
    const r = respMap[p.id_pregunta];
    if (!r) return false;
    if (p.tipo_pregunta === 'ABIERTA') {
        return Boolean(r.respuesta && r.respuesta.trim());
    }
    return r.id_opcion !== null && r.id_opcion !== undefined;
}

export default function StudentEvaluationApp() {
    const [view, setView] = useState('lista'); // 'lista' | 'quiz' | 'resultado'
    const [lista, setLista] = useState([]);
    const [loadingLista, setLoadingLista] = useState(true);
    const [errorLista, setErrorLista] = useState(null);

    const [loadingQuiz, setLoadingQuiz] = useState(false);
    const [quizIntento, setQuizIntento] = useState(null);
    const [quizIdx, setQuizIdx] = useState(0);
    const [respMap, setRespMap] = useState({});
    const [saveStatus, setSaveStatus] = useState('');

    const [loadingResultado, setLoadingResultado] = useState(false);
    const [resultadoIntento, setResultadoIntento] = useState(null);

    const [deadlineModalOpen, setDeadlineModalOpen] = useState(false);

    // Refs for debounced auto-save and flush on navigation/exit/pagehide
    const quizRef = useRef(null);
    const respRef = useRef({});
    const timersRef = useRef({});
    const pendingSavesRef = useRef(new Set());

    const switchView = useCallback((nextView) => {
        setView(nextView);
        scrollTopAll();
    }, []);

    const cargarLista = useCallback(async () => {
        setLoadingLista(true);
        setErrorLista(null);
        try {
            const api = getEvalAPI()?.estudiante;
            const data = await api.misEvaluaciones();
            setLista(Array.isArray(data) ? data : []);
        } catch (e) {
            setErrorLista(e.message || 'Could not load evaluations.');
        } finally {
            setLoadingLista(false);
        }
    }, []);

    const guardarYa = useCallback(
        async (idPregunta) => {
            if (timersRef.current[idPregunta]) {
                clearTimeout(timersRef.current[idPregunta]);
                delete timersRef.current[idPregunta];
            }
            const currentQuiz = quizRef.current;
            const r = respRef.current[idPregunta];
            if (!currentQuiz || !r) return;

            const idIntento = currentQuiz.id_intento;
            pendingSavesRef.current.add(idPregunta);
            setSaveStatus('Saving…');
            try {
                const api = getEvalAPI()?.estudiante;
                await api.guardarRespuesta(idIntento, idPregunta, {
                    id_opcion: r.id_opcion ?? null,
                    respuesta: r.respuesta ?? null,
                });
                setSaveStatus('Saved ✓');
            } catch (e) {
                setSaveStatus('Could not save');
                toast(e.message, 'error');
                if (e.status === 409) {
                    quizRef.current = null;
                    setQuizIntento(null);
                    switchView('lista');
                    cargarLista();
                }
            } finally {
                pendingSavesRef.current.delete(idPregunta);
            }
        },
        [cargarLista, switchView]
    );

    const guardarTodoPendiente = useCallback(async () => {
        const currentQuiz = quizRef.current;
        if (!currentQuiz) return;
        for (const p of currentQuiz.preguntas) {
            const k = p.id_pregunta;
            if (timersRef.current[k]) {
                await guardarYa(k);
            }
        }
        while (quizRef.current && pendingSavesRef.current.size > 0) {
            await new Promise((r) => setTimeout(r, 60));
        }
    }, [guardarYa]);

    const abrirQuiz = useCallback(
        (it) => {
            const initialResp = {};
            (it.respuestas || []).forEach((r) => {
                initialResp[r.id_pregunta] = {
                    id_opcion: r.id_opcion,
                    respuesta: r.respuesta,
                };
            });
            const primera = (it.preguntas || []).findIndex(
                (p) => !isQuestionAnswered(p, initialResp)
            );
            const startIdx = primera === -1 ? 0 : primera;

            quizRef.current = it;
            respRef.current = initialResp;
            timersRef.current = {};
            pendingSavesRef.current = new Set();

            setQuizIntento(it);
            setRespMap(initialResp);
            setQuizIdx(startIdx);
            setSaveStatus('');
            setLoadingQuiz(false);
            switchView('quiz');
        },
        [switchView]
    );

    const mostrarResultado = useCallback(
        (it) => {
            setResultadoIntento(it);
            setLoadingResultado(false);
            setLoadingQuiz(false);
            switchView('resultado');
        },
        [switchView]
    );

    const iniciar = useCallback(
        async (idEvaluacion) => {
            switchView('quiz');
            setLoadingQuiz(true);
            setQuizIntento(null);
            try {
                const api = getEvalAPI()?.estudiante;
                const it = await api.iniciarIntento(idEvaluacion);
                if (it.estado === 'EN_CURSO') {
                    abrirQuiz(it);
                } else {
                    mostrarResultado(it);
                }
            } catch (e) {
                setLoadingQuiz(false);
                switchView('lista');
                if (isDeadlineExpiredError(e)) {
                    setDeadlineModalOpen(true);
                } else {
                    mostrarError(e);
                    cargarLista();
                }
            }
        },
        [abrirQuiz, cargarLista, mostrarResultado, switchView]
    );

    const confirmarInicio = useCallback(
        async (ev) => {
            const ok = await confirmar({
                titulo: ev.titulo,
                ok: 'Start',
                mensaje:
                    `You have ${plural(ev.total_preguntas, 'question', 'questions')}. Your answers are saved automatically and you can leave and continue later; only what you submit at the end will count.` +
                    (ev.fecha_limite
                        ? ` Remember: the deadline is ${fecha(ev.fecha_limite)}.`
                        : ''),
            });
            if (ok) {
                await iniciar(ev.id_evaluacion);
            }
        },
        [iniciar]
    );

    const abrirResultado = useCallback(
        async (idIntento) => {
            switchView('resultado');
            setLoadingResultado(true);
            setResultadoIntento(null);
            try {
                const api = getEvalAPI()?.estudiante;
                const it = await api.verIntento(idIntento);
                mostrarResultado(it);
            } catch (e) {
                setLoadingResultado(false);
                switchView('lista');
                mostrarError(e);
            }
        },
        [mostrarResultado, switchView]
    );

    const handleOpenChange = (idPregunta, text) => {
        const next = {
            ...respRef.current,
            [idPregunta]: { id_opcion: null, respuesta: text },
        };
        respRef.current = next;
        setRespMap(next);

        if (timersRef.current[idPregunta]) {
            clearTimeout(timersRef.current[idPregunta]);
        }
        setSaveStatus('Typing…');
        timersRef.current[idPregunta] = setTimeout(() => {
            guardarYa(idPregunta);
        }, 900);
    };

    const handleChooseOption = (p, o) => {
        const next = {
            ...respRef.current,
            [p.id_pregunta]: { id_opcion: o.id_opcion, respuesta: o.texto },
        };
        respRef.current = next;
        setRespMap(next);
        guardarYa(p.id_pregunta);
    };

    const irAPregunta = async (nextIdx) => {
        if (!quizRef.current) return;
        await guardarTodoPendiente();
        if (!quizRef.current) return;
        const clamped = Math.max(
            0,
            Math.min(quizRef.current.preguntas.length - 1, nextIdx)
        );
        setQuizIdx(clamped);
        setSaveStatus('');
        window.scrollTo(0, 0);
    };

    const salirDelQuiz = async () => {
        await guardarTodoPendiente();
        quizRef.current = null;
        setQuizIntento(null);
        switchView('lista');
        cargarLista();
        toast('Your progress has been saved. You can continue whenever you want.');
        refreshQuestionsPill();
    };

    const enviarTodo = async () => {
        await guardarTodoPendiente();
        const currentQuiz = quizRef.current;
        if (!currentQuiz) return;
        const sin = currentQuiz.preguntas.filter(
            (p) => !isQuestionAnswered(p, respRef.current)
        ).length;
        const ok = await confirmar({
            titulo: 'Submit evaluation',
            ok: 'Submit',
            mensaje:
                (sin
                    ? `You have ${plural(sin, 'unanswered question', 'unanswered questions')} left (they will count as 0). `
                    : '') +
                'Once submitted, you will not be able to change your answers. Submit now?',
        });
        if (!ok) return;
        try {
            const api = getEvalAPI()?.estudiante;
            const it = await api.enviarIntento(currentQuiz.id_intento);
            quizRef.current = null;
            setQuizIntento(null);
            mostrarResultado(it);
            toast('Evaluation submitted.');
            refreshQuestionsPill();
        } catch (e) {
            if (isDeadlineExpiredError(e)) {
                setDeadlineModalOpen(true);
            } else {
                mostrarError(e);
                if (e.status === 409) {
                    quizRef.current = null;
                    setQuizIntento(null);
                    switchView('lista');
                    cargarLista();
                    refreshQuestionsPill();
                }
            }
        }
    };

    useEffect(() => {
        habilitarEnlacesExternos();
        cargarLista();

        const onPageHide = () => {
            if (quizRef.current) {
                Object.keys(timersRef.current).forEach((k) => {
                    if (timersRef.current[k]) {
                        guardarYa(k);
                    }
                });
            }
        };
        window.addEventListener('pagehide', onPageHide);

        const unsubEval = provide('eval:student', {
            abrir: () => {
                switchView('lista');
                cargarLista();
            },
            volverALista: () => {
                switchView('lista');
            },
            recargar: () => {
                cargarLista();
            },
        });

        return () => {
            window.removeEventListener('pagehide', onPageHide);
            unsubEval();
        };
    }, [cargarLista, guardarYa, switchView]);

    const renderEvaluationCard = (ev) => {
        const abierto = ev.id_intento_abierto !== null;
        const vencida = (() => {
            if (!ev.fecha_limite) return false;
            const lim = new Date(ev.fecha_limite).getTime();
            const finValido = lim + 59999 + 60000;
            return Date.now() > finValido;
        })();

        let accion = null;
        if (abierto) {
            accion = {
                txt: 'Continue',
                ic: 'fa-solid fa-play',
                cls: 'ev-btn--gold',
                fn: () => iniciar(ev.id_evaluacion),
            };
        } else if (ev.puede_intentar) {
            accion = {
                txt: ev.intentos_usados ? 'New attempt' : 'Start',
                ic: 'fa-solid fa-play',
                cls: 'ev-btn--primary',
                fn: () => confirmarInicio(ev),
            };
        }

        const verRes =
            ev.id_ultimo_intento && !ev.puede_intentar && !abierto
                ? {
                      txt: 'View result',
                      ic: 'fa-solid fa-chart-simple',
                      cls: 'ev-btn--dark',
                      fn: () => abrirResultado(ev.id_ultimo_intento),
                  }
                : vencida && !abierto && !ev.puede_intentar
                ? {
                      txt: 'View questions',
                      ic: 'fa-solid fa-eye',
                      cls: 'ev-btn--dark',
                      fn: () => iniciar(ev.id_evaluacion),
                  }
                : null;

        let estadoBadge = null;
        if (abierto) {
            estadoBadge = <Badge estado="EN_CURSO" />;
        } else if (ev.ultimo_intento_estado && !ev.puede_intentar) {
            estadoBadge = <Badge estado={ev.ultimo_intento_estado} />;
        } else if (ev.estado === 'CERRADA') {
            estadoBadge = <Badge estado="CERRADA" />;
        } else if (vencida && !ev.puede_intentar) {
            estadoBadge = <Badge estado="VENCIDA" />;
        }

        const abrirTarjeta = () => {
            if (abierto) {
                iniciar(ev.id_evaluacion);
            } else if (ev.puede_intentar) {
                confirmarInicio(ev);
            } else if (ev.id_ultimo_intento) {
                abrirResultado(ev.id_ultimo_intento);
            } else if (vencida) {
                iniciar(ev.id_evaluacion);
            }
        };

        const esClickeable =
            abierto ||
            ev.puede_intentar ||
            Boolean(ev.id_ultimo_intento) ||
            vencida;

        return (
            <div
                key={ev.id_evaluacion}
                className="ev-card"
                role={esClickeable ? 'button' : undefined}
                tabIndex={esClickeable ? 0 : undefined}
                style={esClickeable ? { cursor: 'pointer' } : undefined}
                onClick={esClickeable ? abrirTarjeta : undefined}
                onKeyDown={
                    esClickeable
                        ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  abrirTarjeta();
                              }
                          }
                        : undefined
                }
            >
                <div className="ev-card-icon">
                    <Icon name="fa-solid fa-circle-question" />
                </div>
                <div className="ev-card-body">
                    <div className="ev-card-title">{ev.titulo}</div>
                    {ev.descripcion ? (
                        <p className="ev-sub">{ev.descripcion}</p>
                    ) : null}
                    <div className="ev-badges" style={{ marginTop: 8 }}>
                        {estadoBadge}
                    </div>
                    <div className="ev-card-meta">
                        <span>
                            <Icon name="fa-regular fa-circle-question" />
                            {plural(ev.total_preguntas, 'question', 'questions')}
                        </span>
                        <span>
                            <Icon name="fa-solid fa-rotate-right" />
                            {`Attempts: ${ev.intentos_usados ?? 0} of ${ev.intentos_permitidos}`}
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
                {ev.nota_final !== null && !abierto && !ev.puede_intentar ? (
                    <div className="ev-nota">
                        {nota(ev.nota_final)}
                        <small>{'of ' + ev.nota_maxima}</small>
                    </div>
                ) : null}
                <div
                    className="ev-toolbar"
                    onClick={(e) => e.stopPropagation()}
                >
                    {verRes && !abierto && !ev.puede_intentar ? (
                        <BusyButton
                            className={`ev-btn ev-btn--sm ${verRes.cls}`}
                            icon={verRes.ic}
                            onClick={verRes.fn}
                        >
                            {verRes.txt}
                        </BusyButton>
                    ) : null}
                    {accion ? (
                        <BusyButton
                            className={`ev-btn ev-btn--sm ${accion.cls}`}
                            icon={accion.ic}
                            onClick={accion.fn}
                        >
                            {accion.txt}
                        </BusyButton>
                    ) : null}
                </div>
            </div>
        );
    };

    const renderQuizContent = () => {
        if (loadingQuiz || !quizIntento) {
            return <p className="ev-loading">Loading questions…</p>;
        }
        const total = quizIntento.preguntas.length;
        const p = quizIntento.preguntas[quizIdx];
        if (!p) return null;

        const hechas = quizIntento.preguntas.filter((q) =>
            isQuestionAnswered(q, respMap)
        ).length;
        const actual = respMap[p.id_pregunta] || {};
        const vf = p.tipo_pregunta === 'VERDADERO_FALSO';
        const ultima = quizIdx === total - 1;

        return (
            <>
                <div className="qz-top">
                    <button
                        type="button"
                        className="ev-btn ev-btn--sm ev-btn--ghost"
                        onClick={salirDelQuiz}
                    >
                        <Icon name="fa-solid fa-arrow-left" />
                        Exit
                    </button>
                    <div className="qz-title">{quizIntento.titulo}</div>
                    <span className="qz-count">{`Question ${quizIdx + 1} of ${total} · ${hechas} answered`}</span>
                </div>

                <div
                    className="qz-progress"
                    role="progressbar"
                    aria-valuemin="0"
                    aria-valuemax={String(total)}
                    aria-valuenow={String(hechas)}
                >
                    <span
                        style={{
                            width: `${total ? (hechas / total) * 100 : 0}%`,
                        }}
                    />
                </div>

                <div
                    className="qz-dots"
                    role="group"
                    aria-label="Go to a question"
                >
                    {quizIntento.preguntas.map((q, i) => {
                        const done = isQuestionAnswered(q, respMap);
                        const now = i === quizIdx;
                        return (
                            <button
                                key={q.id_pregunta}
                                type="button"
                                className={`qz-dot${done ? ' is-done' : ''}${now ? ' is-now' : ''}`}
                                aria-label={`Question ${i + 1}${done ? ' (answered)' : ''}`}
                                aria-current={now ? 'step' : undefined}
                                onClick={() => irAPregunta(i)}
                            >
                                {String(i + 1)}
                            </button>
                        );
                    })}
                </div>

                <div className="qz-card">
                    <div className="qz-meta">
                        <span className="ev-badge">
                            {TIPOS[p.tipo_pregunta]}
                        </span>
                        <span className="ev-badge">
                            <Icon name="fa-regular fa-star" />
                            {`Worth ${p.valor_pregunta}`}
                        </span>
                    </div>
                    <div className="qz-q" id="qz-enunciado">
                        {p.enunciado}
                    </div>
                    {p.tipo_pregunta === 'ABIERTA' ? (
                        <div className="qz-open">
                            <textarea
                                className="ev-textarea"
                                maxLength={10000}
                                aria-labelledby="qz-enunciado"
                                placeholder="Write your answer here…"
                                value={actual.respuesta || ''}
                                onChange={(e) =>
                                    handleOpenChange(
                                        p.id_pregunta,
                                        e.target.value
                                    )
                                }
                                onBlur={() => guardarYa(p.id_pregunta)}
                            />
                        </div>
                    ) : (
                        <div
                            className={`qz-opts${vf ? ' qz-opts--vf' : ''}`}
                            role="group"
                            aria-labelledby="qz-enunciado"
                        >
                            {(p.opciones || []).map((o, i) => (
                                <button
                                    key={o.id_opcion}
                                    type="button"
                                    className="qz-opt"
                                    aria-pressed={String(
                                        actual.id_opcion === o.id_opcion
                                    )}
                                    onClick={() => handleChooseOption(p, o)}
                                >
                                    {vf ? null : (
                                        <span className="qz-opt-letter">
                                            {String.fromCharCode(65 + i)}
                                        </span>
                                    )}
                                    <span>{o.texto}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="qz-save" id="qz-save" aria-live="polite">
                    {saveStatus}
                </div>

                <div className="qz-nav">
                    <button
                        type="button"
                        className="ev-btn ev-btn--soft"
                        disabled={quizIdx === 0}
                        onClick={() => irAPregunta(quizIdx - 1)}
                    >
                        <Icon name="fa-solid fa-arrow-left" />
                        Previous
                    </button>
                    {ultima ? (
                        <BusyButton
                            className="ev-btn ev-btn--gold"
                            icon="fa-solid fa-paper-plane"
                            onClick={enviarTodo}
                        >
                            Submit evaluation
                        </BusyButton>
                    ) : (
                        <button
                            type="button"
                            className="ev-btn ev-btn--dark"
                            onClick={() => irAPregunta(quizIdx + 1)}
                        >
                            Next
                            <Icon name="fa-solid fa-arrow-right" />
                        </button>
                    )}
                </div>
            </>
        );
    };

    const renderResultadoContent = () => {
        if (loadingResultado || !resultadoIntento) {
            return <p className="ev-loading">Loading result…</p>;
        }
        const it = resultadoIntento;
        const calificado = it.estado === 'CALIFICADO';
        const pendientes = (it.respuestas || []).filter(
            (r) => r.pendiente_revision
        ).length;

        return (
            <>
                <div className="qz-card qz-result">
                    <h2
                        className="ev-section-title"
                        style={{ fontSize: '22px' }}
                    >
                        {it.titulo}
                    </h2>
                    {calificado ? (
                        <div>
                            <div className="qz-score">
                                {nota(it.nota_obtenida)}
                                <small>{' / ' + it.nota_maxima}</small>
                            </div>
                            <p className="ev-sub" style={{ marginTop: 10 }}>
                                {!it.fecha_envio || it.numero_intento === 0
                                    ? '0 attempts'
                                    : `Attempt ${it.numero_intento} · submitted ${fecha(it.fecha_envio)}`}
                            </p>
                        </div>
                    ) : (
                        <div>
                            <div
                                className="ev-badges"
                                style={{ justifyContent: 'center' }}
                            >
                                <Badge estado="ENVIADO" />
                            </div>
                            <p
                                className="ev-sub"
                                style={{ marginTop: 12, fontSize: 16 }}
                            >
                                {`Your tutor is reviewing ${plural(pendientes, 'open response', 'open responses')}. Once completed, your grade will appear here.`}
                            </p>
                        </div>
                    )}
                    <div
                        className="ev-actions"
                        style={{ justifyContent: 'center' }}
                    >
                        <button
                            type="button"
                            className="ev-btn ev-btn--dark"
                            onClick={() => {
                                switchView('lista');
                                cargarLista();
                            }}
                        >
                            <Icon name="fa-solid fa-arrow-left" />
                            Back to my evaluations
                        </button>
                    </div>
                </div>

                <h3 className="ev-section-title">
                    {it.resultados_visibles
                        ? 'Review of your answers'
                        : 'Your answers'}
                </h3>
                <div className="qz-review">
                    {(it.preguntas || []).map((p, n) => {
                        const r =
                            (it.respuestas || []).find(
                                (x) => x.id_pregunta === p.id_pregunta
                            ) || {};
                        const respondida =
                            p.tipo_pregunta === 'ABIERTA'
                                ? Boolean(r.respuesta && r.respuesta.trim())
                                : r.id_opcion !== null &&
                                  r.id_opcion !== undefined;

                        const valorNota = Number(
                            r.nota_obtenida !== null &&
                                r.nota_obtenida !== undefined
                                ? r.nota_obtenida
                                : 0
                        );
                        const tieneNota =
                            it.resultados_visibles &&
                            r.nota_obtenida !== null &&
                            r.nota_obtenida !== undefined;
                        const esCero = valorNota <= 0;
                        const esMal =
                            !respondida ||
                            r.es_correcta === false ||
                            (tieneNota && !r.pendiente_revision && esCero);
                        const esBien =
                            respondida && r.es_correcta === true && !esCero;

                        const badgeNota = tieneNota ? (
                            <span
                                className={
                                    'ev-badge ' +
                                    (esCero || r.es_correcta === false
                                        ? 'ev-badge--rechazada ev-badge--score-zero'
                                        : 'ev-badge--calificado ev-badge--score-ok')
                                }
                            >
                                <b
                                    style={{
                                        color:
                                            esCero || r.es_correcta === false
                                                ? '#dc2626'
                                                : '#15803d',
                                    }}
                                >
                                    {nota(r.nota_obtenida)}
                                </b>
                                {` / ${p.valor_pregunta}`}
                            </span>
                        ) : null;

                        return (
                            <article key={p.id_pregunta} className="ev-q">
                                <div className="ev-q-top">
                                    <span className="ev-q-num">
                                        {'Question ' + (n + 1)}
                                    </span>
                                    <span className="ev-badge">
                                        {TIPOS[p.tipo_pregunta]}
                                    </span>
                                    {badgeNota}
                                    {r.pendiente_revision ? (
                                        <Badge
                                            estado="ENVIADO"
                                            textoPropio="To grade"
                                        />
                                    ) : null}
                                </div>
                                <div className="ev-q-text">{p.enunciado}</div>

                                {p.tipo_pregunta === 'ABIERTA' ? (
                                    <>
                                        <div
                                            className={
                                                'ev-ans' +
                                                (!respondida ||
                                                (tieneNota &&
                                                    !r.pendiente_revision &&
                                                    esMal)
                                                    ? ' ev-ans--bad'
                                                    : tieneNota &&
                                                      !r.pendiente_revision &&
                                                      esBien
                                                    ? ' ev-ans--ok'
                                                    : '')
                                            }
                                        >
                                            {respondida
                                                ? r.respuesta
                                                : '(unanswered)'}
                                        </div>
                                        {p.respuesta_esperada ? (
                                            <div className="ev-q-note">
                                                <b>Grading criteria: </b>
                                                {p.respuesta_esperada}
                                            </div>
                                        ) : null}
                                    </>
                                ) : it.resultados_visibles ? (
                                    <>
                                        {!respondida ? (
                                            <div className="ev-ans ev-ans--bad">
                                                (unanswered)
                                            </div>
                                        ) : null}
                                        <ul className="ev-q-opts">
                                            {(p.opciones || []).map((o) => {
                                                const mia =
                                                    r.id_opcion === o.id_opcion;
                                                return (
                                                    <li
                                                        key={o.id_opcion}
                                                        className={
                                                            o.es_correcta
                                                                ? 'is-ok'
                                                                : mia
                                                                ? 'ev-ans--bad'
                                                                : ''
                                                        }
                                                    >
                                                        <Icon
                                                            name={
                                                                o.es_correcta
                                                                    ? 'fa-solid fa-circle-check'
                                                                    : mia
                                                                    ? 'fa-solid fa-circle-xmark'
                                                                    : 'fa-regular fa-circle'
                                                            }
                                                        />
                                                        {o.texto}
                                                        {mia ? (
                                                            <b>
                                                                {' ← your answer'}
                                                            </b>
                                                        ) : null}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </>
                                ) : (
                                    <div
                                        className={
                                            'ev-ans' +
                                            (!respondida ? ' ev-ans--bad' : '')
                                        }
                                    >
                                        {r.respuesta || '(unanswered)'}
                                    </div>
                                )}

                                {p.explicacion ? (
                                    <div className="ev-q-note">
                                        <b>Explanation: </b>
                                        {p.explicacion}
                                    </div>
                                ) : null}
                                {(r.retroalimentacion || []).map((t, idx) => (
                                    <div key={idx} className="ev-retro">
                                        <b>Your tutor: </b>
                                        {t}
                                    </div>
                                ))}
                            </article>
                        );
                    })}
                </div>
            </>
        );
    };

    return (
        <>
            <div id="ev-banner" />

            {/* ===== MY EVALUATIONS ===== */}
            <section
                className="ev-view"
                id="view-lista"
                aria-labelledby="lista-title"
                hidden={view !== 'lista'}
            >
                <div className="ev-panel">
                    <div className="ev-head">
                        <h3
                            id="lista-title"
                            style={{
                                margin: 0,
                                fontFamily: 'var(--font-serif)',
                                fontSize: '22px',
                            }}
                        >
                            My Evaluations
                        </h3>
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
                                <Icon name="fa-regular fa-face-smile" />
                                You do not have any assigned evaluations yet.
                            </div>
                        ) : (
                            lista.map(renderEvaluationCard)
                        )}
                    </div>
                </div>
            </section>

            {/* ===== TAKE EVALUATION ===== */}
            <section
                className="ev-view"
                id="view-quiz"
                aria-label="Evaluation in progress"
                hidden={view !== 'quiz'}
            >
                <div className="qz" id="quiz-contenido">
                    {view === 'quiz' ? renderQuizContent() : null}
                </div>
            </section>

            {/* ===== RESULT ===== */}
            <section
                className="ev-view"
                id="view-resultado"
                aria-label="Result"
                hidden={view !== 'resultado'}
            >
                <div className="qz" id="resultado-contenido">
                    {view === 'resultado' ? renderResultadoContent() : null}
                </div>
            </section>

            {deadlineModalOpen ? (
                <Modal
                    titulo="Deadline expired"
                    ancho={460}
                    onClose={() => {
                        setDeadlineModalOpen(false);
                        quizRef.current = null;
                        setQuizIntento(null);
                        switchView('lista');
                        cargarLista();
                        refreshQuestionsPill();
                    }}
                >
                    <p
                        style={{
                            fontSize: 15,
                            lineHeight: 1.5,
                            margin: 0,
                            color: 'var(--text, #1f2937)',
                        }}
                    >
                        The deadline for this evaluation has expired. Please
                        contact your tutor to enable it again.
                    </p>
                    <div className="ev-actions">
                        <button
                            type="button"
                            className="ev-btn ev-btn--dark"
                            onClick={() => {
                                setDeadlineModalOpen(false);
                                quizRef.current = null;
                                setQuizIntento(null);
                                switchView('lista');
                                cargarLista();
                                refreshQuestionsPill();
                            }}
                        >
                            Understood
                        </button>
                    </div>
                </Modal>
            ) : null}
        </>
    );
}
