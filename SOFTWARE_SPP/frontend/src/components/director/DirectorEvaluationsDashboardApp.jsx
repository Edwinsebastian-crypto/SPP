import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    TIPOS,
    fecha,
    plural,
    habilitarEnlacesExternos,
    getEvalAPI,
} from '../../utils/evalBridge';
import { Icon, Badge, BadgeOrigen, BusyButton } from '../common/Badge';

const loc = (n, dec) =>
    Number(n).toLocaleString('es-CO', {
        maximumFractionDigits: dec === undefined ? 0 : dec,
    });
const n0 = (n) => (n === null || n === undefined ? '—' : loc(n));
const pct = (n) => (n === null || n === undefined ? '—' : `${loc(n, 1)} %`);
const dias = (d) => plural(d, 'day', 'days');
const MESES = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
];
const nombreMes = (m) =>
    `${MESES[Number(String(m).slice(5, 7)) - 1]} ${String(m).slice(2, 4)}`;

const SEVERIDAD = {
    ALTA: ['fa-solid fa-circle-exclamation', 'High'],
    MEDIA: ['fa-solid fa-triangle-exclamation', 'Medium'],
    BAJA: ['fa-solid fa-circle-info', 'Low'],
};

const TITULO_ALERTA = {
    REVISION_ATRASADA: 'Overdue grading',
    VENCIDA_SIN_CERRAR: 'Overdue unclosed',
    BORRADOR_ANTIGUO: 'Old draft',
    SIN_INTENTOS: 'Not taken',
};

function mensajeAlerta(a) {
    switch (a.tipo) {
        case 'REVISION_ATRASADA':
            return `${plural(a.cantidad, 'attempt awaits', 'attempts await')} grading; the oldest has been waiting for ${dias(a.dias)}.`;
        case 'VENCIDA_SIN_CERRAR':
            return `The deadline passed ${dias(a.dias)} ago and the evaluation remains published.`;
        case 'BORRADOR_ANTIGUO':
            return `Has been in draft for ${dias(a.dias)} without being published.`;
        case 'SIN_INTENTOS':
            return `Published ${dias(a.dias)} ago and the student has not yet taken it.`;
        default:
            return a.tipo;
    }
}

function stripAccents(str) {
    return (str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function ToggleCard({ titulo, sub, columnas, filas, ancho, notaText, children }) {
    const [showTable, setShowTable] = useState(false);

    return (
        <article className={`dv-card${ancho ? ' dv-card--wide' : ''}`}>
            <div className="dv-card-head">
                <div style={{ marginRight: 'auto', minWidth: 0 }}>
                    <h3>{titulo}</h3>
                    {sub ? <p>{sub}</p> : null}
                </div>
                {columnas ? (
                    <button
                        type="button"
                        className="dv-toggle"
                        aria-pressed={String(showTable)}
                        onClick={() => setShowTable((prev) => !prev)}
                    >
                        <Icon name="fa-solid fa-table" />
                        View table
                    </button>
                ) : null}
            </div>
            <div hidden={showTable}>{children}</div>
            {columnas ? (
                <div hidden={!showTable}>
                    <div className="dv-tablewrap">
                        <table className="dv-table">
                            <thead>
                                <tr>
                                    {columnas.map((c, idx) => (
                                        <th
                                            key={idx}
                                            scope="col"
                                            className={c.num ? 'num' : undefined}
                                        >
                                            {c.t}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {(filas || []).map((f, rIdx) => (
                                    <tr key={rIdx}>
                                        {f.map((cell, cIdx) => (
                                            <td
                                                key={cIdx}
                                                className={
                                                    columnas[cIdx]?.num
                                                        ? 'num'
                                                        : undefined
                                                }
                                            >
                                                {cell}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : null}
            {notaText ? <p className="dv-note">{notaText}</p> : null}
        </article>
    );
}

function StackedBar({ partes }) {
    const total = partes.reduce((s, p) => s + p.valor, 0);
    if (!total) {
        return (
            <div className="dv-empty">
                <Icon name="fa-regular fa-folder-open" />
                No data available yet.
            </div>
        );
    }
    return (
        <div>
            <div
                className="dv-stack"
                role="img"
                aria-label={partes
                    .map((p) => `${p.etiqueta}: ${p.valor}`)
                    .join(', ')}
            >
                {partes.map((p, idx) => (
                    <div
                        key={idx}
                        className={`dv-seg ${p.clase}${p.valor ? '' : ' dv-seg--zero'}`}
                        style={{ flex: `${p.valor} 1 0` }}
                        data-tip={`${p.etiqueta}: ${loc(p.valor)} (${loc((p.valor / total) * 100, 1)} %)`}
                        tabIndex={0}
                    >
                        {p.valor / total >= 0.08 ? String(p.valor) : ''}
                    </div>
                ))}
            </div>
            <div className="dv-legend">
                {partes.map((p, idx) => (
                    <span key={idx}>
                        <i className={`dv-key ${p.clase}`} />
                        {`${p.etiqueta} `}
                        <b>{loc(p.valor)}</b>
                        {` (${loc((p.valor / total) * 100)} %)`}
                    </span>
                ))}
            </div>
        </div>
    );
}

function HorizontalBars({ items, maximo, claseDe }) {
    const max = maximo || Math.max(1, ...items.map((i) => i.valor));
    return (
        <div className="dv-hbars">
            {items.map((i, idx) => (
                <div key={idx} className="dv-hrow">
                    <span className="dv-hrow-label">{i.etiqueta}</span>
                    <div
                        className="dv-track"
                        data-tip={i.tip || `${i.etiqueta}: ${i.texto || i.valor}`}
                        tabIndex={0}
                    >
                        <div
                            className={`dv-fill ${claseDe ? claseDe(i) : ''}`}
                            style={{
                                width: `${Math.max(0, Math.min(100, (i.valor / max) * 100))}%`,
                            }}
                        />
                    </div>
                    <span className="dv-hrow-val">
                        {i.texto || loc(i.valor)}
                    </span>
                </div>
            ))}
        </div>
    );
}

function FlagAlert({ a }) {
    const [ic] = SEVERIDAD[a.severidad] || SEVERIDAD.BAJA;
    return (
        <span
            className={`dv-flag ${a.severidad === 'ALTA' ? '' : 'dv-flag--warn'}`}
            data-tip={mensajeAlerta(a)}
            tabIndex={0}
        >
            <Icon name={ic} />
            {TITULO_ALERTA[a.tipo] || a.tipo}
        </span>
    );
}

export default function DirectorEvaluationsDashboardApp() {
    const [view, setView] = useState('panel'); // 'panel' | 'detalle'
    const [resumen, setResumen] = useState(null);
    const [todasLasEvaluaciones, setTodasLasEvaluaciones] = useState([]);
    const [loadingPanel, setLoadingPanel] = useState(true);
    const [errorPanel, setErrorPanel] = useState(null);

    const [directorio, setDirectorio] = useState({
        practicas: {},
        tutores: {},
        estudiantes: {},
    });
    const dirRef = useRef({ practicas: {}, tutores: {}, estudiantes: {} });
    const resumenRef = useRef(null);

    // Filter state for "All evaluations"
    const [searchQuery, setSearchQuery] = useState('');
    const [filterEstado, setFilterEstado] = useState('');
    const [filterTutor, setFilterTutor] = useState('');
    const [soloAlertas, setSoloAlertas] = useState(false);
    const [limiteMostrado, setLimiteMostrado] = useState(15);

    const statusSelectRef = useRef(null);
    const tutorSelectRef = useRef(null);

    // Detalle state
    const [detalleData, setDetalleData] = useState(null);
    const [loadingDetalle, setLoadingDetalle] = useState(false);
    const [errorDetalle, setErrorDetalle] = useState(null);
    const [detalleTab, setDetalleTab] = useState('analisis');

    const absorberDirectorio = useCallback((d) => {
        if (!d) return;
        const next = {
            practicas: {
                ...dirRef.current.practicas,
                ...(d.practicas || {}),
            },
            tutores: {
                ...dirRef.current.tutores,
                ...(d.tutores || {}),
            },
            estudiantes: {
                ...dirRef.current.estudiantes,
                ...(d.estudiantes || {}),
            },
        };
        dirRef.current = next;
        setDirectorio(next);
    }, []);

    const nombreTutor = useCallback(
        (id) => dirRef.current.tutores[id] || `Tutor ${id}`,
        []
    );
    const nombreEstudiante = useCallback(
        (id) => dirRef.current.estudiantes[id] || `Student ${id}`,
        []
    );
    const etiquetaPractica = useCallback((id) => {
        const p = dirRef.current.practicas[id];
        return p
            ? `${p.estudiante || 'Student'} · ${p.tipo || 'Practice'}`
            : `Practice ${id} (not found)`;
    }, []);

    const switchView = useCallback((nombre, resetScroll = true) => {
        setView(nombre);
        if (resetScroll) {
            const w = document.querySelector('#tab-evaluations .ev-wrapper');
            if (w) w.scrollTop = 0;
            const rw = document.querySelector('.reports-wrapper');
            if (rw) rw.scrollTop = 0;
            window.scrollTo(0, 0);
        }
    }, []);

    const cargarPanel = useCallback(async () => {
        setLoadingPanel(true);
        setErrorPanel(null);
        try {
            const api = getEvalAPI()?.director;
            const [r, listRes] = await Promise.all([
                api.resumen(),
                api.listar({ limite: 100 }),
            ]);
            absorberDirectorio(r.directorio);
            if (listRes && listRes.directorio) {
                absorberDirectorio(listRes.directorio);
            }
            resumenRef.current = r;
            setResumen(r);
            setTodasLasEvaluaciones(listRes?.items || []);
            setLimiteMostrado(15);
            requestAnimationFrame(() => {
                if (window.SPP?.customSelect?.init) {
                    window.SPP.customSelect.init('#dv-lista');
                }
            });
        } catch (e) {
            setErrorPanel(
                (e && e.message) || 'Could not load information.'
            );
        } finally {
            setLoadingPanel(false);
        }
    }, [absorberDirectorio]);

    const abrirDetalle = useCallback(
        async (idEvaluacion) => {
            switchView('detalle');
            setLoadingDetalle(true);
            setErrorDetalle(null);
            setDetalleData(null);
            setDetalleTab('analisis');
            try {
                const api = getEvalAPI()?.director;
                const d = await api.detalle(idEvaluacion);
                absorberDirectorio(d.directorio);
                setDetalleData(d);
            } catch (e) {
                setErrorDetalle({
                    id: idEvaluacion,
                    message:
                        (e && e.message) || 'Could not open evaluation.',
                });
            } finally {
                setLoadingDetalle(false);
            }
        },
        [absorberDirectorio, switchView]
    );

    const datosExportables = useCallback(() => {
        const r = resumenRef.current;
        if (!r) return [];
        const t = r.totales,
            d = r.desempeno,
            ia = r.ia,
            e = r.por_estado,
            o = r.preguntas.por_origen,
            tp = r.preguntas.por_tipo,
            df = r.preguntas.por_dificultad;
        const ds = (id, title, columns, rows) => ({
            id,
            title,
            columns: columns.map(([key, label, num]) => ({
                key,
                label,
                num: Boolean(num),
            })),
            rows,
        });
        return [
            ds(
                'eval-cifras',
                'General metrics',
                [
                    ['indicador', 'Metric'],
                    ['valor', 'Value', true],
                ],
                [
                    ['Evaluations', t.evaluaciones],
                    ['Published', e.PUBLICADA],
                    ['In draft', e.BORRADOR],
                    ['Closed', e.CERRADA],
                    ['Practices with evaluation', t.practicas],
                    ['Tutors', t.tutores],
                    ['Students', t.estudiantes],
                    ['Attempts in progress', t.intentos_en_curso],
                    ['Attempts pending grading', t.intentos_pendientes_revision],
                    ['Graded attempts', t.intentos_calificados],
                    ['Final grades average (%)', d.promedio_pct],
                    ['Pass rate (%)', d.aprobacion_pct],
                    ['Graded evaluations', d.evaluaciones_calificadas],
                    ['Passed', d.aprobadas],
                    ['Failed', d.reprobadas],
                    ['Questions with AI (%)', ia.uso_pct],
                    [
                        'Overdue unclosed evaluations',
                        t.evaluaciones_vencidas_sin_cerrar,
                    ],
                ].map(([indicador, valor]) => ({ indicador, valor }))
            ),
            ds(
                'eval-notas',
                'Final grades by range',
                [
                    ['rango', 'Range (% of maximum grade)'],
                    ['cantidad', 'Evaluations', true],
                ],
                d.distribucion.map((x) => ({
                    rango: `${x.desde}–${x.hasta} %`,
                    cantidad: x.cantidad,
                }))
            ),
            ds(
                'eval-origen',
                'Question origin',
                [
                    ['concepto', 'Concept'],
                    ['preguntas', 'Questions', true],
                ],
                [
                    ['Generated with AI', o.IA],
                    ['Written by tutor', o.MANUAL],
                    ['AI approved', ia.aprobadas],
                    ['AI pending review', ia.por_revisar],
                    ['AI rejected', ia.rechazadas],
                ].map(([concepto, preguntas]) => ({ concepto, preguntas }))
            ),
            ds(
                'eval-meses',
                'Activity by month',
                [
                    ['mes', 'Month'],
                    ['creadas', 'Created evaluations', true],
                    ['enviados', 'Submitted attempts', true],
                ],
                r.historial.map((m) => ({
                    mes: m.mes,
                    creadas: m.evaluaciones_creadas,
                    enviados: m.intentos_enviados,
                }))
            ),
            ds(
                'eval-preguntas',
                'Questions by type and difficulty',
                [
                    ['categoria', 'Category'],
                    ['preguntas', 'Questions', true],
                ],
                [
                    ['Multiple choice', tp.OPCION_MULTIPLE],
                    ['True / False', tp.VERDADERO_FALSO],
                    ['Open', tp.ABIERTA],
                    ['Easy', df.FACIL],
                    ['Medium', df.MEDIA],
                    ['Hard', df.DIFICIL],
                    ['Undefined', df.SIN_DEFINIR],
                ].map(([categoria, preguntas]) => ({ categoria, preguntas }))
            ),
            ds(
                'eval-tutores',
                'Tutors',
                [
                    ['tutor', 'Tutor'],
                    ['evaluaciones', 'Evaluations', true],
                    ['publicadas', 'Published', true],
                    ['calificados', 'Graded attempts', true],
                    ['porCalificar', 'To grade', true],
                    ['espera', 'Max wait (days)', true],
                    ['promedio', 'Average (%)', true],
                    ['alertas', 'Alerts', true],
                ],
                r.por_tutor.map((x) => ({
                    tutor: nombreTutor(x.id_tutor),
                    evaluaciones: x.evaluaciones,
                    publicadas: x.publicadas,
                    calificados: x.intentos_calificados,
                    porCalificar: x.pendientes_revision,
                    espera: x.espera_max_dias,
                    promedio: x.promedio_pct,
                    alertas: x.alertas,
                }))
            ),
            ds(
                'eval-alertas',
                'Alerts (require attention)',
                [
                    ['severidad', 'Severity'],
                    ['tipo', 'Type'],
                    ['evaluacion', 'Evaluation'],
                    ['practica', 'Practice'],
                    ['tutor', 'Tutor'],
                    ['detalle', 'Detail'],
                ],
                r.alertas.map((a) => ({
                    severidad: (SEVERIDAD[a.severidad] || SEVERIDAD.BAJA)[1],
                    tipo: TITULO_ALERTA[a.tipo] || a.tipo,
                    evaluacion: a.titulo,
                    practica: etiquetaPractica(a.id_practica),
                    tutor: nombreTutor(a.id_tutor),
                    detalle: mensajeAlerta(a),
                }))
            ),
        ];
    }, [etiquetaPractica, nombreTutor]);

    const handleExportEvaluations = () => {
        const K = window.SPP?.reportKit;
        if (!K) return;
        const datasets = datosExportables();
        if (!datasets.length) {
            window.SPP?.showError?.(
                new Error(
                    'The evaluations are still loading. Try again in a moment.'
                )
            );
            return;
        }
        K.openExport({
            title: 'Export evaluations',
            subtitle:
                'Figures and grades only. Student answers and tutor comments are never included.',
            sections: datasets.map((ds) => ({ id: ds.id, label: ds.title })),
            build: ({ sections: selected }) => {
                const chosen = datasets.filter((ds) => selected.has(ds.id));
                return {
                    datasets: chosen,
                    base: 'evaluations',
                    title: 'Evaluations',
                    subtitle: 'Read-only summary of all program evaluations',
                    mode: 'tables',
                };
            },
        });
    };

    useEffect(() => {
        habilitarEnlacesExternos();

        // Tooltip wiring (#dv-tip)
        const tip = document.getElementById('dv-tip');
        const moverTip = (x, y) => {
            if (!tip) return;
            const w = tip.offsetWidth,
                hh = tip.offsetHeight;
            tip.style.left = `${Math.max(8, Math.min(x + 14, window.innerWidth - w - 8))}px`;
            tip.style.top = `${Math.max(8, Math.min(y + 16, window.innerHeight - hh - 8))}px`;
        };
        const mostrarTip = (el, x, y) => {
            if (!tip) return;
            tip.textContent = el.getAttribute('data-tip');
            tip.hidden = false;
            moverTip(x, y);
        };
        const onMouseOver = (e) => {
            const t = e.target.closest?.('[data-tip]');
            if (t) mostrarTip(t, e.clientX, e.clientY);
        };
        const onMouseMove = (e) => {
            if (tip && !tip.hidden) moverTip(e.clientX, e.clientY);
        };
        const onMouseOut = (e) => {
            if (tip && e.target.closest?.('[data-tip]')) tip.hidden = true;
        };
        const onFocusIn = (e) => {
            const t = e.target.closest?.('[data-tip]');
            if (t) {
                const r = t.getBoundingClientRect();
                mostrarTip(t, r.left + r.width / 2, r.top);
            }
        };
        const onFocusOut = () => {
            if (tip) tip.hidden = true;
        };

        document.addEventListener('mouseover', onMouseOver);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseout', onMouseOut);
        document.addEventListener('focusin', onFocusIn);
        document.addEventListener('focusout', onFocusOut);

        window.SPP_DIRECTOR = window.SPP_DIRECTOR || {};
        window.SPP_DIRECTOR.cargarEvaluaciones = cargarPanel;
        window.SPP_DIRECTOR.getExportData = datosExportables;

        cargarPanel();

        return () => {
            document.removeEventListener('mouseover', onMouseOver);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseout', onMouseOut);
            document.removeEventListener('focusin', onFocusIn);
            document.removeEventListener('focusout', onFocusOut);
        };
    }, [cargarPanel, datosExportables]);

    const filtrarTutor = (idTutor) => {
        setFilterTutor(String(idTutor));
        setLimiteMostrado(15);
        requestAnimationFrame(() => {
            if (tutorSelectRef.current && window.SPP?.customSelect?.sync) {
                tutorSelectRef.current.value = String(idTutor);
                window.SPP.customSelect.sync(tutorSelectRef.current);
            }
            const lista = document.getElementById('dv-lista');
            if (lista) lista.scrollIntoView({ behavior: 'smooth' });
        });
    };

    const handleClearFilters = () => {
        setSearchQuery('');
        setFilterEstado('');
        setFilterTutor('');
        setSoloAlertas(false);
        setLimiteMostrado(15);
        requestAnimationFrame(() => {
            if (window.SPP?.customSelect?.sync) {
                if (statusSelectRef.current) {
                    statusSelectRef.current.value = '';
                    window.SPP.customSelect.sync(statusSelectRef.current);
                }
                if (tutorSelectRef.current) {
                    tutorSelectRef.current.value = '';
                    window.SPP.customSelect.sync(tutorSelectRef.current);
                }
            }
        });
    };

    const evaluacionesFiltradas = (() => {
        const q = stripAccents(searchQuery.trim());
        return todasLasEvaluaciones.filter((ev) => {
            if (filterEstado && ev.estado !== filterEstado) return false;
            if (filterTutor && String(ev.id_tutor) !== String(filterTutor))
                return false;
            if (soloAlertas && (!ev.alertas || ev.alertas.length === 0))
                return false;
            if (!q) return true;

            const est = directorio.estudiantes[ev.id_estudiante] || `Student ${ev.id_estudiante}`;
            const tut = directorio.tutores[ev.id_tutor] || `Tutor ${ev.id_tutor}`;
            const p = directorio.practicas[ev.id_practica];
            const prac = p ? `${p.tipo || ''} ${p.institucion || ''}` : '';
            const corpus = stripAccents(
                `${ev.titulo} #${ev.id_evaluacion} ${ev.id_evaluacion} ${est} ${tut} ${prac} ${ev.estado}`
            );
            return corpus.includes(q);
        });
    })();

    const visibleEvaluaciones = evaluacionesFiltradas.slice(0, limiteMostrado);

    const glossaryItems = resumen
        ? [
              [
                  'Final grade',
                  'The highest score among the graded attempts of an evaluation.',
              ],
              [
                  'Percentage',
                  'Score divided by the maximum evaluation grade, allowing comparison across different scales.',
              ],
              [
                  'Passed',
                  `Final score of ${loc(resumen.umbral_aprobacion_pct)} % or higher (3.0 out of 5.0).`,
              ],
              [
                  'Pending grading',
                  'The student submitted the attempt, but the tutor has not graded the open questions yet.',
              ],
              [
                  'Question success rate',
                  'Correct answers among graded responses. An open question counts as correct starting from half its value.',
              ],
              [
                  'AI question',
                  'Suggested by AI from a topic or evidence. The tutor approves, edits, or rejects before publishing.',
              ],
              [
                  'Alerts',
                  `Overdue grading: an attempt has waited ${resumen.dias_revision_atrasada} days or more without grading. Overdue unclosed: the deadline passed and it remains published. Old draft: ${resumen.dias_borrador_antiguo} days or more without publishing. Not taken: published ${resumen.dias_sin_intentos} days or more ago and no one has taken it.`,
              ],
              [
                  'Privacy',
                  'This dashboard shows statistics and scores. It does not show student answers or tutor comments.',
              ],
          ]
        : [];

    const renderPanelContent = () => {
        if (loadingPanel) {
            return <p className="ev-loading">Loading…</p>;
        }
        if (errorPanel || !resumen) {
            return (
                <div className="ev-empty">
                    <Icon name="fa-solid fa-plug-circle-exclamation" />
                    {errorPanel || 'Could not load information.'}
                    <div
                        className="ev-actions"
                        style={{ justifyContent: 'center' }}
                    >
                        <button
                            type="button"
                            className="ev-btn ev-btn--primary"
                            onClick={cargarPanel}
                        >
                            <Icon name="fa-solid fa-rotate" />
                            Retry
                        </button>
                    </div>
                </div>
            );
        }

        const r = resumen;
        const t = r.totales,
            d = r.desempeno,
            ia = r.ia,
            e = r.por_estado;
        const presentados =
            t.intentos_pendientes_revision + t.intentos_calificados;
        const equivale =
            d.promedio_pct === null
                ? 'No graded evaluations yet.'
                : `Equivalent to ${loc(d.promedio_pct / 20, 1)} out of 5.0 · ${plural(d.evaluaciones_calificadas, 'graded evaluation', 'graded evaluations')}.`;

        const kpiList = [
            {
                ic: 'fa-solid fa-clipboard-question',
                val: n0(t.evaluaciones),
                label: 'Evaluations',
                sub: `${n0(e.PUBLICADA)} published · ${n0(e.BORRADOR)} in draft · ${n0(e.CERRADA)} closed`,
            },
            {
                ic: 'fa-solid fa-people-group',
                val: n0(t.practicas),
                label: 'Practices with evaluation',
                sub: `${plural(t.tutores, 'tutor', 'tutors')} · ${plural(t.estudiantes, 'student', 'students')}`,
            },
            {
                ic: 'fa-solid fa-paper-plane',
                val: n0(presentados),
                label: 'Submitted attempts',
                sub: `${n0(t.intentos_en_curso)} in progress right now`,
            },
            {
                ic: 'fa-solid fa-hourglass-half',
                val: n0(t.intentos_pendientes_revision),
                label: 'Pending grading',
                sub: t.intentos_pendientes_revision
                    ? 'Awaiting tutor grading.'
                    : 'Everything is up to date.',
                attn: r.alertas.some((a) => a.tipo === 'REVISION_ATRASADA'),
            },
            {
                ic: 'fa-solid fa-chart-simple',
                val: pct(d.promedio_pct),
                label: 'Final grades average',
                sub: equivale,
            },
            {
                ic: 'fa-solid fa-circle-check',
                val: pct(d.aprobacion_pct),
                label: 'Pass rate',
                sub: d.evaluaciones_calificadas
                    ? `${n0(d.aprobadas)} passed · ${n0(d.reprobadas)} did not reach ${loc(r.umbral_aprobacion_pct)} %.`
                    : 'No graded evaluations yet.',
            },
            {
                ic: 'fa-solid fa-wand-magic-sparkles',
                val: pct(ia.uso_pct),
                label: 'Questions generated with AI',
                sub: ia.preguntas
                    ? `${pct(ia.aceptacion_pct)} of tutor-reviewed questions were accepted.`
                    : 'No questions were generated with AI.',
            },
            {
                ic: 'fa-solid fa-calendar-xmark',
                val: n0(t.evaluaciones_vencidas_sin_cerrar),
                label: 'Overdue unclosed',
                sub: t.evaluaciones_vencidas_sin_cerrar
                    ? 'Deadline passed and still published.'
                    : 'None.',
                attn: t.evaluaciones_vencidas_sin_cerrar > 0,
            },
        ];

        // Alerts card
        const MAX_ALERTS = 6;
        const alertasVisibles = r.alertas.slice(0, MAX_ALERTS);

        // Status card data
        const partesEstado = [
            { etiqueta: 'Published', valor: e.PUBLICADA, clase: 'dv-s1' },
            { etiqueta: 'In draft', valor: e.BORRADOR, clase: 'dv-s2' },
            { etiqueta: 'Closed', valor: e.CERRADA, clase: 'dv-s3' },
        ];
        const partesIntentos = [
            {
                etiqueta: 'In progress',
                valor: t.intentos_en_curso,
                clase: 'dv-s1',
            },
            {
                etiqueta: 'To grade',
                valor: t.intentos_pendientes_revision,
                clase: 'dv-s2',
            },
            {
                etiqueta: 'Graded',
                valor: t.intentos_calificados,
                clase: 'dv-s3',
            },
        ];

        // Final grades card data
        const rangos = d.distribucion || [];
        const maxNotas = Math.max(0, ...rangos.map((x) => x.cantidad));
        const etiquetaRango = (x) => `${x.desde}–${x.hasta} %`;

        // Origin card data
        const o = r.preguntas.por_origen;
        const prov =
            Object.entries(ia.por_proveedor || {})
                .map(([k, v]) => `${k} (${v})`)
                .join(', ') || 'none';

        // Monthly activity card data
        const H = r.historial || [];
        const maxMes = Math.max(
            0,
            ...H.flatMap((m) => [m.evaluaciones_creadas, m.intentos_enviados])
        );

        // Question types & difficulty card data
        const tp = r.preguntas.por_tipo;
        const df = r.preguntas.por_dificultad;
        const totalQ = Object.values(tp).reduce((s, v) => s + v, 0);
        const filaQ = (etiqueta, valor) => ({
            etiqueta,
            valor,
            texto: `${loc(valor)}${totalQ ? ` · ${loc((valor / totalQ) * 100)} %` : ''}`,
        });

        return (
            <>
                <div className="dv-kpis">
                    {kpiList.map((k, idx) => (
                        <div
                            key={idx}
                            className={`dv-kpi${k.attn ? ' dv-kpi--attn' : ''}`}
                        >
                            <div className="dv-kpi-icon">
                                <Icon name={k.ic} />
                            </div>
                            <div className="dv-kpi-body">
                                <span className="dv-kpi-value">{k.val}</span>
                                <span className="dv-kpi-label">{k.label}</span>
                                <span className="dv-kpi-sub">{k.sub}</span>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="dv-grid">
                    {/* Require attention */}
                    <article className="dv-card dv-card--wide">
                        <div className="dv-card-head">
                            <div>
                                <h3>Require attention</h3>
                                <p>
                                    Sorted from most to least urgent. Click one
                                    to view evaluation.
                                </p>
                            </div>
                        </div>
                        {alertasVisibles.length > 0 ? (
                            <ul className="dv-alerts">
                                {alertasVisibles.map((a, idx) => {
                                    const [ic, sevTxt] =
                                        SEVERIDAD[a.severidad] ||
                                        SEVERIDAD.BAJA;
                                    const p =
                                        directorio.practicas[a.id_practica];
                                    const pracTxt = p
                                        ? `${p.estudiante || 'Student'} · ${p.tipo || 'Practice'}`
                                        : `Practice ${a.id_practica} (not found)`;
                                    const tutTxt =
                                        directorio.tutores[a.id_tutor] ||
                                        `Tutor ${a.id_tutor}`;
                                    return (
                                        <li key={idx}>
                                            <button
                                                type="button"
                                                className={`dv-alert dv-alert--${a.severidad.toLowerCase()}`}
                                                onClick={() =>
                                                    abrirDetalle(
                                                        a.id_evaluacion
                                                    )
                                                }
                                            >
                                                <span className="dv-alert-sev">
                                                    <Icon name={ic} />
                                                    {sevTxt}
                                                </span>
                                                <span>
                                                    <span className="dv-alert-title">
                                                        {`${TITULO_ALERTA[a.tipo] || a.tipo} · ${a.titulo}`}
                                                    </span>
                                                    <span className="dv-alert-text">
                                                        {`${pracTxt} · ${tutTxt}. ${mensajeAlerta(a)}`}
                                                    </span>
                                                </span>
                                                <Icon name="fa-solid fa-chevron-right dv-alert-go" />
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <div className="dv-empty">
                                <Icon name="fa-regular fa-circle-check" />
                                No situations requiring attention.
                            </div>
                        )}
                        {r.alertas.length > MAX_ALERTS ? (
                            <div className="dv-more">
                                <button
                                    type="button"
                                    className="ev-btn ev-btn--sm ev-btn--ghost"
                                    onClick={() => {
                                        setSoloAlertas(true);
                                        setLimiteMostrado(15);
                                        const el =
                                            document.getElementById('dv-lista');
                                        if (el)
                                            el.scrollIntoView({
                                                behavior: 'smooth',
                                            });
                                    }}
                                >
                                    {`View all ${r.alertas.length} alerts in list`}
                                </button>
                            </div>
                        ) : null}
                    </article>

                    {/* Evaluation status */}
                    <ToggleCard
                        titulo="Evaluation status"
                        sub="Published are visible to students; drafts are prepared by tutors; closed no longer accept attempts."
                        columnas={[
                            { t: 'Concept' },
                            { t: 'Count', num: true },
                        ]}
                        filas={[
                            ...partesEstado.map((p) => [
                                `Evaluations (${p.etiqueta.toLowerCase()})`,
                                loc(p.valor),
                            ]),
                            ...partesIntentos.map((p) => [
                                `Attempts (${p.etiqueta.toLowerCase()})`,
                                loc(p.valor),
                            ]),
                        ]}
                    >
                        <StackedBar partes={partesEstado} />
                        <h4 className="dv-sub">Student attempt status</h4>
                        <StackedBar partes={partesIntentos} />
                    </ToggleCard>

                    {/* Final grades */}
                    <ToggleCard
                        titulo="Final grades"
                        sub="Graded evaluations by percentage of maximum grade."
                        columnas={[
                            { t: 'Range' },
                            { t: 'Evaluations', num: true },
                        ]}
                        filas={rangos.map((x) => [
                            etiquetaRango(x),
                            loc(x.cantidad),
                        ])}
                        notaText={`The dashed red line indicates minimum passing score (${loc(r.umbral_aprobacion_pct)} %).`}
                    >
                        {!d.evaluaciones_calificadas ? (
                            <div className="dv-empty">
                                <Icon name="fa-regular fa-clipboard" />
                                No graded evaluations yet.
                            </div>
                        ) : (
                            <div>
                                <div
                                    className="dv-cols"
                                    role="img"
                                    aria-label={`Final grades by range: ${rangos
                                        .map(
                                            (x) =>
                                                `${etiquetaRango(x)}: ${x.cantidad}`
                                        )
                                        .join(', ')}`}
                                >
                                    {rangos.map((x, idx) => (
                                        <React.Fragment key={idx}>
                                            {x.desde ===
                                            r.umbral_aprobacion_pct ? (
                                                <i
                                                    className="dv-pass-line"
                                                    aria-hidden="true"
                                                />
                                            ) : null}
                                            <div className="dv-col">
                                                <div
                                                    className={`dv-bar dv-s1${x.cantidad ? '' : ' dv-bar--zero'}`}
                                                    style={{
                                                        height: `${maxNotas ? (x.cantidad / maxNotas) * 100 : 0}%`,
                                                    }}
                                                    data-tip={`${etiquetaRango(x)} of maximum grade: ${plural(x.cantidad, 'evaluation', 'evaluations')}`}
                                                    tabIndex={0}
                                                >
                                                    <span>
                                                        {String(x.cantidad)}
                                                    </span>
                                                </div>
                                            </div>
                                        </React.Fragment>
                                    ))}
                                </div>
                                <div className="dv-xaxis">
                                    {rangos.map((x, idx) => (
                                        <span key={idx}>
                                            {etiquetaRango(x)}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </ToggleCard>

                    {/* Question origin */}
                    <ToggleCard
                        titulo="Question origin"
                        sub="How many suggested by AI and how many accepted by the tutor."
                        columnas={[
                            { t: 'Concept' },
                            { t: 'Questions', num: true },
                        ]}
                        filas={[
                            ['Generated with AI', loc(o.IA)],
                            ['Written by tutor', loc(o.MANUAL)],
                            ['AI approved', loc(ia.aprobadas)],
                            ['AI pending review', loc(ia.por_revisar)],
                            ['AI rejected', loc(ia.rechazadas)],
                        ]}
                        notaText={`AI acceptance: ${pct(ia.aceptacion_pct)} of reviewed items. Generations: ${loc(ia.generaciones)}${ia.generaciones_fallidas ? ` (${loc(ia.generaciones_fallidas)} failed)` : ''}. Provider: ${prov}.`}
                    >
                        <StackedBar
                            partes={[
                                {
                                    etiqueta: 'Generated with AI',
                                    valor: o.IA,
                                    clase: 'dv-s1',
                                },
                                {
                                    etiqueta: 'Written by tutor',
                                    valor: o.MANUAL,
                                    clase: 'dv-s2',
                                },
                            ]}
                        />
                        {ia.preguntas ? (
                            <div>
                                <h4 className="dv-sub">
                                    Tutor actions on AI questions
                                </h4>
                                <HorizontalBars
                                    items={[
                                        {
                                            etiqueta: 'Approved',
                                            valor: ia.aprobadas,
                                        },
                                        {
                                            etiqueta: 'Pending review',
                                            valor: ia.por_revisar,
                                        },
                                        {
                                            etiqueta: 'Rejected',
                                            valor: ia.rechazadas,
                                        },
                                    ]}
                                    maximo={ia.preguntas}
                                />
                            </div>
                        ) : null}
                    </ToggleCard>

                    {/* Activity by month */}
                    <ToggleCard
                        titulo="Activity by month"
                        sub={`Last ${H.length} months.`}
                        columnas={[
                            { t: 'Month' },
                            { t: 'Created evaluations', num: true },
                            { t: 'Submitted attempts', num: true },
                        ]}
                        filas={H.map((m) => [
                            nombreMes(m.mes),
                            loc(m.evaluaciones_creadas),
                            loc(m.intentos_enviados),
                        ])}
                    >
                        {!maxMes ? (
                            <div className="dv-empty">
                                <Icon name="fa-regular fa-folder-open" />
                                No activity in these months yet.
                            </div>
                        ) : (
                            <div>
                                <div
                                    className="dv-cols dv-cols--tight"
                                    role="img"
                                    aria-label="Recent months activity"
                                >
                                    {H.map((m, idx) => (
                                        <div key={idx} className="dv-col">
                                            <div
                                                className={`dv-bar dv-s1${m.evaluaciones_creadas ? '' : ' dv-bar--zero'}`}
                                                style={{
                                                    height: `${maxMes ? (m.evaluaciones_creadas / maxMes) * 100 : 0}%`,
                                                }}
                                                data-tip={`${nombreMes(m.mes)}: ${plural(m.evaluaciones_creadas, 'created evaluation', 'created evaluations')}`}
                                                tabIndex={0}
                                            >
                                                <span>
                                                    {String(
                                                        m.evaluaciones_creadas
                                                    )}
                                                </span>
                                            </div>
                                            <div
                                                className={`dv-bar dv-s2${m.intentos_enviados ? '' : ' dv-bar--zero'}`}
                                                style={{
                                                    height: `${maxMes ? (m.intentos_enviados / maxMes) * 100 : 0}%`,
                                                }}
                                                data-tip={`${nombreMes(m.mes)}: ${plural(m.intentos_enviados, 'submitted attempt', 'submitted attempts')}`}
                                                tabIndex={0}
                                            >
                                                <span>
                                                    {String(
                                                        m.intentos_enviados
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="dv-xaxis dv-xaxis--tight">
                                    {H.map((m, idx) => (
                                        <span key={idx}>
                                            {nombreMes(m.mes)}
                                        </span>
                                    ))}
                                </div>
                                <div className="dv-legend">
                                    <span>
                                        <i className="dv-key dv-s1" />
                                        Created evaluations
                                    </span>
                                    <span>
                                        <i className="dv-key dv-s2" />
                                        Submitted attempts
                                    </span>
                                </div>
                            </div>
                        )}
                    </ToggleCard>

                    {/* Questions by type & difficulty */}
                    <ToggleCard
                        titulo="Questions"
                        ancho
                        sub={`${plural(totalQ, 'question in total', 'questions in total')}.`}
                        columnas={[
                            { t: 'Category' },
                            { t: 'Questions', num: true },
                        ]}
                        filas={[
                            ['Multiple choice', loc(tp.OPCION_MULTIPLE)],
                            ['True / False', loc(tp.VERDADERO_FALSO)],
                            ['Open', loc(tp.ABIERTA)],
                            ['Easy', loc(df.FACIL)],
                            ['Medium', loc(df.MEDIA)],
                            ['Hard', loc(df.DIFICIL)],
                            ['Undefined', loc(df.SIN_DEFINIR)],
                        ]}
                    >
                        {!totalQ ? (
                            <div className="dv-empty">
                                <Icon name="fa-regular fa-folder-open" />
                                No questions yet.
                            </div>
                        ) : (
                            <div className="dv-two">
                                <div>
                                    <h4 className="dv-sub dv-sub--first">
                                        By type
                                    </h4>
                                    <HorizontalBars
                                        items={[
                                            filaQ(
                                                'Multiple choice',
                                                tp.OPCION_MULTIPLE
                                            ),
                                            filaQ(
                                                'True / False',
                                                tp.VERDADERO_FALSO
                                            ),
                                            filaQ('Open', tp.ABIERTA),
                                        ]}
                                        maximo={totalQ}
                                    />
                                </div>
                                <div>
                                    <h4 className="dv-sub dv-sub--first">
                                        By difficulty
                                    </h4>
                                    <HorizontalBars
                                        items={[
                                            filaQ('Easy', df.FACIL),
                                            filaQ('Medium', df.MEDIA),
                                            filaQ('Hard', df.DIFICIL),
                                            filaQ('Undefined', df.SIN_DEFINIR),
                                        ]}
                                        maximo={totalQ}
                                    />
                                </div>
                            </div>
                        )}
                    </ToggleCard>

                    {/* Tutors */}
                    <article className="dv-card dv-card--wide">
                        <div className="dv-card-head">
                            <div>
                                <h3>Tutors</h3>
                                <p>
                                    Sorted by most attempts awaiting grading.
                                    Click a tutor to filter the list below.
                                </p>
                            </div>
                        </div>
                        {r.por_tutor.length > 0 ? (
                            <div className="dv-tablewrap">
                                <table className="dv-table dv-table--click">
                                    <thead>
                                        <tr>
                                            <th scope="col">Tutor</th>
                                            <th scope="col" className="num">
                                                Evaluations
                                            </th>
                                            <th scope="col" className="num">
                                                Published
                                            </th>
                                            <th scope="col" className="num">
                                                Graded
                                            </th>
                                            <th scope="col" className="num">
                                                To grade
                                            </th>
                                            <th scope="col" className="num">
                                                Average
                                            </th>
                                            <th scope="col" className="num">
                                                Alerts
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {r.por_tutor.map((tut) => {
                                            const tName =
                                                directorio.tutores[
                                                    tut.id_tutor
                                                ] || `Tutor ${tut.id_tutor}`;
                                            return (
                                                <tr
                                                    key={tut.id_tutor}
                                                    tabIndex={0}
                                                    onClick={() =>
                                                        filtrarTutor(
                                                            tut.id_tutor
                                                        )
                                                    }
                                                    onKeyDown={(evKey) => {
                                                        if (
                                                            evKey.key ===
                                                            'Enter'
                                                        )
                                                            filtrarTutor(
                                                                tut.id_tutor
                                                            );
                                                    }}
                                                >
                                                    <td>
                                                        <span className="dv-cell-title">
                                                            {tName}
                                                        </span>
                                                    </td>
                                                    <td className="num">
                                                        {loc(tut.evaluaciones)}
                                                    </td>
                                                    <td className="num">
                                                        {loc(tut.publicadas)}
                                                    </td>
                                                    <td className="num">
                                                        {loc(
                                                            tut.intentos_calificados
                                                        )}
                                                    </td>
                                                    <td className="num">
                                                        {tut.pendientes_revision ? (
                                                            <span
                                                                className={`dv-flag ${tut.espera_max_dias >= r.dias_revision_atrasada ? '' : 'dv-flag--warn'}`}
                                                                data-tip={`The oldest attempt has been waiting for ${dias(tut.espera_max_dias)}`}
                                                                tabIndex={0}
                                                            >
                                                                <Icon name="fa-solid fa-hourglass-half" />
                                                                {`${loc(tut.pendientes_revision)} · ${dias(tut.espera_max_dias)}`}
                                                            </span>
                                                        ) : (
                                                            <span className="dv-flag dv-flag--ok">
                                                                <Icon name="fa-solid fa-check" />
                                                                Up to date
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="num">
                                                        {pct(tut.promedio_pct)}
                                                    </td>
                                                    <td className="num">
                                                        {tut.alertas
                                                            ? loc(tut.alertas)
                                                            : '—'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="dv-empty">
                                <Icon name="fa-regular fa-folder-open" />
                                No tutors with evaluations yet.
                            </div>
                        )}
                    </article>

                    {/* All evaluations */}
                    <article className="dv-card dv-card--wide" id="dv-lista">
                        <div className="dv-card-head">
                            <div>
                                <h3>All evaluations</h3>
                                <p>
                                    Click a row to view question analysis and
                                    attempts.
                                </p>
                            </div>
                        </div>
                        <div className="dv-filters">
                            <div className="dv-search">
                                <Icon name="fa-solid fa-magnifying-glass" />
                                <input
                                    type="search"
                                    placeholder="Search by title, student, tutor or practice…"
                                    aria-label="Search by title, student, tutor or practice"
                                    maxLength={100}
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setLimiteMostrado(15);
                                    }}
                                />
                            </div>

                            <div className="cp-input-wrap">
                                <select
                                    ref={statusSelectRef}
                                    id="f-estado"
                                    aria-label="Select status"
                                    value={filterEstado}
                                    onChange={(e) => {
                                        setFilterEstado(e.target.value);
                                        setLimiteMostrado(15);
                                    }}
                                >
                                    <option value="">All statuses</option>
                                    <option value="PUBLICADA">Published</option>
                                    <option value="BORRADOR">In draft</option>
                                    <option value="CERRADA">Closed</option>
                                </select>
                                <Icon name="fa-solid fa-chevron-down right-icon" />
                            </div>

                            <div className="cp-input-wrap">
                                <select
                                    ref={tutorSelectRef}
                                    id="f-tutor"
                                    aria-label="Select tutor"
                                    value={filterTutor}
                                    onChange={(e) => {
                                        setFilterTutor(e.target.value);
                                        setLimiteMostrado(15);
                                    }}
                                >
                                    <option value="">All tutors</option>
                                    {r.por_tutor.map((tut) => (
                                        <option
                                            key={tut.id_tutor}
                                            value={tut.id_tutor}
                                        >
                                            {directorio.tutores[tut.id_tutor] ||
                                                `Tutor ${tut.id_tutor}`}
                                        </option>
                                    ))}
                                </select>
                                <Icon name="fa-solid fa-chevron-down right-icon" />
                            </div>

                            <label className="dv-check-pill">
                                <input
                                    type="checkbox"
                                    id="f-alertas"
                                    checked={soloAlertas}
                                    onChange={(e) => {
                                        setSoloAlertas(e.target.checked);
                                        setLimiteMostrado(15);
                                    }}
                                />
                                <span>Only with alerts</span>
                            </label>

                            <button
                                type="button"
                                className="um-ghost-btn"
                                id="ev-btn-clear"
                                aria-label="Clear filters"
                                onClick={handleClearFilters}
                            >
                                <Icon name="fa-solid fa-rotate-left" />
                                Clear
                            </button>

                            <span className="dv-count" aria-live="polite">
                                {evaluacionesFiltradas.length === 0
                                    ? 'No results'
                                    : `Showing ${loc(visibleEvaluaciones.length)} of ${loc(evaluacionesFiltradas.length)}`}
                            </span>
                        </div>

                        <div className="dv-tablewrap">
                            <table className="dv-table dv-table--click">
                                <thead>
                                    <tr>
                                        <th scope="col">Evaluation</th>
                                        <th scope="col">Tutor</th>
                                        <th scope="col">Status</th>
                                        <th scope="col" className="num">
                                            Questions
                                        </th>
                                        <th scope="col" className="num">
                                            Attempts
                                        </th>
                                        <th scope="col" className="num">
                                            Final grade
                                        </th>
                                        <th scope="col">Deadline</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {evaluacionesFiltradas.length === 0 ? (
                                        <tr>
                                            <td colSpan={7}>
                                                <div className="um-empty">
                                                    <Icon name="fa-solid fa-magnifying-glass" />
                                                    <strong>
                                                        No evaluations match the
                                                        filters
                                                    </strong>
                                                    <span>
                                                        Try changing the search
                                                        criteria or clear
                                                        filters to view all
                                                        evaluations.
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        visibleEvaluaciones.map((ev) => {
                                            const abrir = () =>
                                                abrirDetalle(ev.id_evaluacion);
                                            const p =
                                                directorio.practicas[
                                                    ev.id_practica
                                                ];
                                            const estName =
                                                directorio.estudiantes[
                                                    ev.id_estudiante
                                                ] ||
                                                `Student ${ev.id_estudiante}`;
                                            const subTxt = `${estName} · ${p ? p.tipo || 'Practice' : 'practice not found'}`;
                                            const tutName =
                                                directorio.tutores[
                                                    ev.id_tutor
                                                ] || `Tutor ${ev.id_tutor}`;

                                            return (
                                                <tr
                                                    key={ev.id_evaluacion}
                                                    tabIndex={0}
                                                    onClick={abrir}
                                                    onKeyDown={(evKey) => {
                                                        if (
                                                            evKey.key ===
                                                            'Enter'
                                                        )
                                                            abrir();
                                                    }}
                                                >
                                                    <td>
                                                        <span className="dv-cell-title">
                                                            {ev.titulo}
                                                        </span>
                                                        <span className="dv-cell-sub">
                                                            {subTxt}
                                                        </span>
                                                        {ev.alertas &&
                                                        ev.alertas.length >
                                                            0 ? (
                                                            <span className="dv-cell-sub">
                                                                {ev.alertas.map(
                                                                    (a, aIdx) => (
                                                                        <FlagAlert
                                                                            key={
                                                                                aIdx
                                                                            }
                                                                            a={
                                                                                a
                                                                            }
                                                                        />
                                                                    )
                                                                )}
                                                            </span>
                                                        ) : null}
                                                    </td>
                                                    <td>{tutName}</td>
                                                    <td>
                                                        <Badge
                                                            estado={ev.estado}
                                                        />
                                                        {ev.vencida &&
                                                        ev.estado ===
                                                            'PUBLICADA' ? (
                                                            <span className="dv-cell-sub">
                                                                Overdue
                                                            </span>
                                                        ) : null}
                                                    </td>
                                                    <td className="num">
                                                        {loc(
                                                            ev.total_preguntas
                                                        )}
                                                        {ev.preguntas_ia ? (
                                                            <span className="dv-cell-sub">
                                                                {`${loc(ev.preguntas_ia)} with AI`}
                                                            </span>
                                                        ) : null}
                                                    </td>
                                                    <td className="num">
                                                        {`${loc(ev.intentos_calificados)}/${loc(ev.intentos_enviados)}`}
                                                        {ev.pendientes_revision ? (
                                                            <span className="dv-cell-sub">
                                                                {`${loc(ev.pendientes_revision)} to grade`}
                                                            </span>
                                                        ) : null}
                                                    </td>
                                                    <td className="num">
                                                        {ev.nota_final ===
                                                        null ? (
                                                            '—'
                                                        ) : (
                                                            <span className="dv-pct">
                                                                {pct(
                                                                    ev.porcentaje_final
                                                                )}
                                                                <small>
                                                                    {`${loc(ev.nota_final, 2)} of ${loc(ev.nota_maxima, 1)}`}
                                                                </small>
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        {ev.fecha_limite
                                                            ? fecha(
                                                                  ev.fecha_limite
                                                              )
                                                            : 'No deadline'}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="dv-more">
                            {visibleEvaluaciones.length <
                            evaluacionesFiltradas.length ? (
                                <button
                                    type="button"
                                    className="ev-btn ev-btn--sm ev-btn--soft"
                                    onClick={() =>
                                        setLimiteMostrado((prev) => prev + 15)
                                    }
                                >
                                    {`View more evaluations (${loc(evaluacionesFiltradas.length - visibleEvaluaciones.length)} remaining)`}
                                </button>
                            ) : null}
                        </div>
                    </article>
                </div>
            </>
        );
    };

    const renderDetalleContent = () => {
        if (loadingDetalle) {
            return <p className="ev-loading">Loading…</p>;
        }
        if (errorDetalle || !detalleData) {
            return (
                <div className="ev-empty">
                    <Icon name="fa-solid fa-plug-circle-exclamation" />
                    {errorDetalle?.message || 'Could not load information.'}
                    <div
                        className="ev-actions"
                        style={{ justifyContent: 'center' }}
                    >
                        <button
                            type="button"
                            className="ev-btn ev-btn--primary"
                            onClick={() =>
                                errorDetalle?.id &&
                                abrirDetalle(errorDetalle.id)
                            }
                        >
                            <Icon name="fa-solid fa-rotate" />
                            Retry
                        </button>
                    </div>
                </div>
            );
        }

        const d = detalleData;
        const p = directorio.practicas[d.id_practica] || {};
        const estName =
            directorio.estudiantes[d.id_estudiante] ||
            `Student ${d.id_estudiante}`;
        const tutName =
            directorio.tutores[d.id_tutor] || `Tutor ${d.id_tutor}`;
        const pracDesc = directorio.practicas[d.id_practica]
            ? `${p.tipo || 'Practice'}${p.institucion ? ` · ${p.institucion}` : ''}`
            : `${d.id_practica} (not found)`;

        const iaQuestions = (d.preguntas || []).filter(
            (q) => q.origen === 'IA'
        );
        const cuentaIA = (est) =>
            iaQuestions.filter((q) => q.estado_revision === est).length;

        return (
            <>
                <dl className="dv-meta">
                    <div>
                        <dt>Student</dt>
                        <dd>{estName}</dd>
                    </div>
                    <div>
                        <dt>Tutor</dt>
                        <dd>{tutName}</dd>
                    </div>
                    <div>
                        <dt>Practice</dt>
                        <dd>{pracDesc}</dd>
                    </div>
                    <div>
                        <dt>Created</dt>
                        <dd>{fecha(d.fecha_evaluacion)}</dd>
                    </div>
                    <div>
                        <dt>Deadline</dt>
                        <dd>
                            {d.fecha_limite
                                ? fecha(d.fecha_limite)
                                : 'No deadline'}
                        </dd>
                    </div>
                    <div>
                        <dt>Allowed attempts</dt>
                        <dd>{String(d.intentos_permitidos)}</dd>
                    </div>
                    <div>
                        <dt>Max grade</dt>
                        <dd>{loc(d.nota_maxima, 1)}</dd>
                    </div>
                    <div>
                        <dt>Results to student</dt>
                        <dd>
                            {d.mostrar_resultados
                                ? 'Visible upon submission'
                                : 'Hidden'}
                        </dd>
                    </div>
                </dl>

                {d.descripcion ? (
                    <p
                        className="dv-note"
                        style={{ margin: '-6px 0 18px' }}
                    >
                        {d.descripcion}
                    </p>
                ) : null}

                <div className="ev-stats">
                    <div className="ev-stat">
                        <b>{String(d.total_preguntas)}</b>
                        <span>Questions</span>
                        {d.preguntas_ia ? (
                            <span
                                style={{
                                    display: 'block',
                                    fontSize: '11.5px',
                                    opacity: 0.75,
                                    marginTop: 2,
                                }}
                            >
                                {`${d.preguntas_ia} with AI`}
                            </span>
                        ) : null}
                    </div>
                    <div className="ev-stat">
                        <b>{String(d.intentos_enviados)}</b>
                        <span>Submitted attempts</span>
                        <span
                            style={{
                                display: 'block',
                                fontSize: '11.5px',
                                opacity: 0.75,
                                marginTop: 2,
                            }}
                        >
                            {`${d.intentos_iniciados} started`}
                        </span>
                    </div>
                    <div className="ev-stat">
                        <b>{String(d.pendientes_revision)}</b>
                        <span>To grade</span>
                        {d.espera_max_dias !== null ? (
                            <span
                                style={{
                                    display: 'block',
                                    fontSize: '11.5px',
                                    opacity: 0.75,
                                    marginTop: 2,
                                }}
                            >
                                {`waiting for ${dias(d.espera_max_dias)}`}
                            </span>
                        ) : null}
                    </div>
                    <div className="ev-stat">
                        <b>
                            {d.nota_final === null
                                ? '—'
                                : pct(d.porcentaje_final)}
                        </b>
                        <span>Final grade</span>
                        <span
                            style={{
                                display: 'block',
                                fontSize: '11.5px',
                                opacity: 0.75,
                                marginTop: 2,
                            }}
                        >
                            {d.nota_final === null
                                ? 'Ungraded'
                                : `${loc(d.nota_final, 2)} of ${loc(d.nota_maxima, 1)}`}
                        </span>
                    </div>
                </div>

                {d.alertas && d.alertas.length > 0 ? (
                    <ul className="dv-alerts" style={{ marginBottom: 18 }}>
                        {d.alertas.map((a, idx) => {
                            const [ic, sevTxt] =
                                SEVERIDAD[a.severidad] || SEVERIDAD.BAJA;
                            return (
                                <li
                                    key={idx}
                                    className={`dv-alert dv-alert--${a.severidad.toLowerCase()}`}
                                    style={{ cursor: 'default' }}
                                >
                                    <span className="dv-alert-sev">
                                        <Icon name={ic} />
                                        {sevTxt}
                                    </span>
                                    <span>
                                        <span className="dv-alert-title">
                                            {TITULO_ALERTA[a.tipo] || a.tipo}
                                        </span>
                                        <span className="dv-alert-text">
                                            {mensajeAlerta(a)}
                                        </span>
                                    </span>
                                    <span />
                                </li>
                            );
                        })}
                    </ul>
                ) : null}

                <div>
                    <div className="ev-tabs" role="tablist">
                        {[
                            ['analisis', 'Question analysis'],
                            ['intentos', 'Attempts'],
                            ['ia', 'AI usage'],
                        ].map(([k, title]) => (
                            <button
                                key={k}
                                type="button"
                                className="ev-tab"
                                role="tab"
                                aria-selected={String(detalleTab === k)}
                                data-tab={k}
                                onClick={() => setDetalleTab(k)}
                            >
                                {title}
                            </button>
                        ))}
                    </div>

                    {/* Tab: Question analysis */}
                    <div
                        data-panel="analisis"
                        hidden={detalleTab !== 'analisis'}
                    >
                        {!d.preguntas || d.preguntas.length === 0 ? (
                            <div className="dv-empty">
                                <Icon name="fa-regular fa-circle-question" />
                                This evaluation does not have questions yet.
                            </div>
                        ) : (
                            <div>
                                <div className="dv-tablewrap">
                                    <table className="dv-table">
                                        <thead>
                                            <tr>
                                                <th scope="col" className="num">
                                                    #
                                                </th>
                                                <th scope="col">Question</th>
                                                <th scope="col">Type</th>
                                                <th scope="col">Source</th>
                                                <th scope="col">Difficulty</th>
                                                <th scope="col" className="num">
                                                    Value
                                                </th>
                                                <th scope="col">
                                                    Success rate
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {d.preguntas.map((q, qIdx) => {
                                                const claseAcierto =
                                                    q.pct_acierto === null
                                                        ? ''
                                                        : q.pct_acierto >= 70
                                                        ? 'dv-fill--good'
                                                        : q.pct_acierto >= 40
                                                        ? 'dv-fill--mid'
                                                        : 'dv-fill--low';
                                                const calificadas =
                                                    q.correctas + q.incorrectas;
                                                return (
                                                    <tr
                                                        key={
                                                            q.id_pregunta ||
                                                            qIdx
                                                        }
                                                    >
                                                        <td className="num">
                                                            {String(q.orden)}
                                                        </td>
                                                        <td>
                                                            <span className="dv-qtext">
                                                                {q.enunciado}
                                                            </span>
                                                            {q.estado_revision !==
                                                            'APROBADA' ? (
                                                                <span className="dv-cell-sub">
                                                                    {q.estado_revision ===
                                                                    'RECHAZADA'
                                                                        ? 'Rejected by tutor (not applied)'
                                                                        : 'Pending tutor review (not applied)'}
                                                                </span>
                                                            ) : null}
                                                        </td>
                                                        <td>
                                                            {TIPOS[
                                                                q.tipo_pregunta
                                                            ] ||
                                                                q.tipo_pregunta}
                                                        </td>
                                                        <td>
                                                            <BadgeOrigen
                                                                origen={
                                                                    q.origen
                                                                }
                                                            />
                                                        </td>
                                                        <td>
                                                            {{
                                                                FACIL: 'Easy',
                                                                MEDIA: 'Medium',
                                                                DIFICIL: 'Hard',
                                                            }[q.dificultad] ||
                                                                '—'}
                                                        </td>
                                                        <td className="num">
                                                            {loc(
                                                                q.valor_pregunta,
                                                                2
                                                            )}
                                                        </td>
                                                        <td>
                                                            {q.pct_acierto ===
                                                            null ? (
                                                                <span className="dv-cell-sub">
                                                                    {q.sin_calificar
                                                                        ? `${plural(q.sin_calificar, 'answer', 'answers')} ungraded`
                                                                        : 'No answers yet'}
                                                                </span>
                                                            ) : (
                                                                <div className="dv-acierto">
                                                                    <div
                                                                        className="dv-track"
                                                                        data-tip={`${q.correctas} of ${calificadas} graded answers were correct`}
                                                                        tabIndex={
                                                                            0
                                                                        }
                                                                    >
                                                                        <div
                                                                            className={`dv-fill ${claseAcierto}`}
                                                                            style={{
                                                                                width: `${q.pct_acierto}%`,
                                                                            }}
                                                                        />
                                                                    </div>
                                                                    <b>
                                                                        {pct(
                                                                            q.pct_acierto
                                                                        )}
                                                                    </b>
                                                                    <small>
                                                                        {`${q.correctas} of ${calificadas} correct${q.sin_calificar ? ` · ${q.sin_calificar} ungraded` : ''}`}
                                                                    </small>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="dv-note">
                                    Success rate = correct answers among graded
                                    responses. An open question counts as
                                    correct from half its value. For privacy,
                                    student answers are not displayed.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Tab: Attempts */}
                    <div
                        data-panel="intentos"
                        hidden={detalleTab !== 'intentos'}
                    >
                        {!d.intentos || d.intentos.length === 0 ? (
                            <div className="dv-empty">
                                <Icon name="fa-regular fa-hourglass" />
                                The student has not started this evaluation yet.
                            </div>
                        ) : (
                            <div className="dv-tablewrap">
                                <table className="dv-table">
                                    <thead>
                                        <tr>
                                            <th scope="col" className="num">
                                                Attempt
                                            </th>
                                            <th scope="col">Status</th>
                                            <th scope="col">Start</th>
                                            <th scope="col">Submitted</th>
                                            <th scope="col" className="num">
                                                Grade
                                            </th>
                                            <th scope="col" className="num">
                                                Percentage
                                            </th>
                                            <th scope="col" className="num">
                                                Waiting
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {d.intentos.map((i, idx) => (
                                            <tr
                                                key={i.numero_intento || idx}
                                            >
                                                <td className="num">
                                                    {String(i.numero_intento)}
                                                </td>
                                                <td>
                                                    <Badge estado={i.estado} />
                                                </td>
                                                <td>
                                                    {fecha(i.fecha_inicio)}
                                                </td>
                                                <td>
                                                    {i.fecha_envio
                                                        ? fecha(i.fecha_envio)
                                                        : '—'}
                                                </td>
                                                <td className="num">
                                                    {i.nota_obtenida === null
                                                        ? '—'
                                                        : `${loc(i.nota_obtenida, 2)} of ${loc(d.nota_maxima, 1)}`}
                                                </td>
                                                <td className="num">
                                                    {pct(i.porcentaje)}
                                                </td>
                                                <td className="num">
                                                    {i.dias_esperando === null
                                                        ? '—'
                                                        : dias(
                                                              i.dias_esperando
                                                          )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Tab: AI usage */}
                    <div data-panel="ia" hidden={detalleTab !== 'ia'}>
                        <div>
                            <p
                                className="dv-note"
                                style={{ margin: '0 0 14px' }}
                            >
                                {iaQuestions.length
                                    ? `${plural(iaQuestions.length, 'question was proposed', 'questions were proposed')} by AI: ${cuentaIA('APROBADA')} approved, ${cuentaIA('BORRADOR')} pending review and ${cuentaIA('RECHAZADA')} rejected.`
                                    : 'This evaluation does not use questions generated with AI.'}
                            </p>
                            {d.generaciones && d.generaciones.length > 0 ? (
                                <div className="dv-tablewrap">
                                    <table className="dv-table">
                                        <thead>
                                            <tr>
                                                <th scope="col">Date</th>
                                                <th scope="col">Provider</th>
                                                <th scope="col">Model</th>
                                                <th scope="col">Result</th>
                                                <th scope="col" className="num">
                                                    Requested
                                                </th>
                                                <th scope="col" className="num">
                                                    Generated
                                                </th>
                                                <th scope="col" className="num">
                                                    Duration
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {d.generaciones.map((g, gIdx) => (
                                                <tr key={gIdx}>
                                                    <td>
                                                        {fecha(g.created_at)}
                                                    </td>
                                                    <td>
                                                        {g.proveedor || '—'}
                                                    </td>
                                                    <td>{g.modelo || '—'}</td>
                                                    <td>
                                                        {g.estado ===
                                                        'FALLIDA' ? (
                                                            <span className="dv-flag">
                                                                <Icon name="fa-solid fa-circle-xmark" />
                                                                Failed
                                                            </span>
                                                        ) : (
                                                            <span className="dv-flag dv-flag--ok">
                                                                <Icon name="fa-solid fa-check" />
                                                                {g.estado ===
                                                                'COMPLETADA'
                                                                    ? 'Completed'
                                                                    : g.estado}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="num">
                                                        {loc(
                                                            g.cantidad_solicitada
                                                        )}
                                                    </td>
                                                    <td className="num">
                                                        {loc(
                                                            g.cantidad_generada
                                                        )}
                                                    </td>
                                                    <td className="num">
                                                        {g.duracion_ms
                                                            ? `${loc(g.duracion_ms / 1000, 1)} s`
                                                            : '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            </>
        );
    };

    return (
        <>
            <div id="ev-banner" />

            {/* ===== PANEL GENERAL ===== */}
            <section
                className="ev-view"
                id="view-panel"
                aria-labelledby="panel-title"
                hidden={view !== 'panel'}
            >
                <header className="dv-head">
                    <div className="dv-head-text">
                        <h2 id="panel-title">Evaluations</h2>
                        <p className="ev-sub">
                            Query view of all program evaluations.{' '}
                            <span id="panel-actualizado" className="rp-updated">
                                {resumen?.generado_en
                                    ? `Updated ${fecha(resumen.generado_en)}.`
                                    : ''}
                            </span>
                        </p>
                    </div>
                    <BusyButton
                        className="ev-btn ev-btn--sm ev-btn--ghost"
                        id="btn-actualizar"
                        icon="fa-solid fa-rotate"
                        onClick={cargarPanel}
                    >
                        Refresh
                    </BusyButton>
                    <button
                        type="button"
                        className="ev-btn ev-btn--sm ev-btn--dark"
                        id="btn-export-evaluaciones"
                        onClick={handleExportEvaluations}
                    >
                        <Icon name="fa-solid fa-download" />
                        Export panel
                    </button>
                </header>

                <details className="dv-help">
                    <summary>
                        <Icon name="fa-solid fa-circle-info" />
                        How to read these figures?
                    </summary>
                    <dl id="dv-glosario">
                        {glossaryItems.map(([term, desc], idx) => (
                            <React.Fragment key={idx}>
                                <dt>{term}</dt>
                                <dd>{desc}</dd>
                            </React.Fragment>
                        ))}
                    </dl>
                </details>

                <div id="panel-contenido">{renderPanelContent()}</div>
            </section>

            {/* ===== DETALLE DE UNA EVALUACIÓN ===== */}
            <section
                className="ev-view"
                id="view-detalle"
                aria-labelledby="detalle-title"
                hidden={view !== 'detalle'}
            >
                <div className="ev-panel">
                    <div className="ev-head">
                        <button
                            type="button"
                            className="ev-back"
                            id="btn-volver"
                            aria-label="Back to panel"
                            onClick={() => {
                                const lista =
                                    document.getElementById('dv-lista');
                                switchView('panel', !lista);
                                if (lista) {
                                    requestAnimationFrame(() => {
                                        lista.scrollIntoView({
                                            behavior: 'smooth',
                                            block: 'start',
                                        });
                                    });
                                }
                            }}
                        >
                            <Icon name="fa-solid fa-arrow-left" />
                        </button>
                        <div className="dv-head-text">
                            <h2 id="detalle-title">
                                {loadingDetalle
                                    ? 'Loading…'
                                    : errorDetalle
                                    ? 'Could not open evaluation'
                                    : detalleData
                                    ? detalleData.titulo
                                    : ''}
                            </h2>
                            <div className="ev-badges" id="detalle-badges">
                                {!loadingDetalle && detalleData ? (
                                    <>
                                        <Badge estado={detalleData.estado} />
                                        {detalleData.vencida &&
                                        detalleData.estado === 'PUBLICADA' ? (
                                            <span className="ev-badge ev-badge--cerrada">
                                                <Icon name="fa-regular fa-calendar-xmark" />
                                                Deadline passed
                                            </span>
                                        ) : null}
                                        {(detalleData.alertas || []).map(
                                            (a, idx) => (
                                                <FlagAlert key={idx} a={a} />
                                            )
                                        )}
                                    </>
                                ) : null}
                            </div>
                        </div>
                    </div>
                    <div id="detalle-contenido">{renderDetalleContent()}</div>
                </div>
            </section>
        </>
    );
}
