import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { get, post, patch, del, showError, formatDate as apiFormatDate, EvalAPI } from '../../core/api';
import { alert as alertModal, confirm as confirmModal } from '../../core/modals';
import { showPanel, getPanelElement, onQuestionsBack } from '../../core/panels';
import { sync as syncCustomSelect } from '../../core/custom-select';
import { useCustomSelect } from '../../hooks/useCustomSelect';
import { EVENTS, emit, on } from '../../core/events';
import { getPractice, setPractice as setPracticeStore, usePractice } from '../../core/practiceStore';
import { provide, inject } from '../../core/registry';

const STATUS_COLORS = {
    active: '#265c48',
    activa: '#265c48',
    completed: '#6b7280',
    finalizada: '#6b7280',
    cancelled: '#b3261e',
    cancelada: '#b3261e',
    evaluating: '#0284c7',
    evaluando: '#0284c7',
    grading: '#d97706',
    calificando: '#d97706'
};

function computeLogbookHero(logbook) {
    const lb = logbook || {};
    const rawGrade = lb.finalGrade;
    const gradeNum = rawGrade != null && rawGrade !== '' ? parseFloat(rawGrade) : null;
    const hasGrade = gradeNum !== null && !isNaN(gradeNum);

    const scoreVal = hasGrade ? gradeNum.toFixed(1) : '—';

    let gradeTitle;
    if (!hasGrade) gradeTitle = '—';
    else if (gradeNum >= 4.5) gradeTitle = 'Excellent';
    else if (gradeNum >= 4.0) gradeTitle = 'Outstanding';
    else if (gradeNum >= 3.0) gradeTitle = 'Passed';
    else if (gradeNum > 0) gradeTitle = 'Failed';
    else gradeTitle = '—';

    const circumference = 226.2;
    const pct = hasGrade ? Math.max(0, Math.min(1, gradeNum / 5.0)) : 0;
    const strokeDasharray = `${circumference}`;
    const strokeDashoffset = `${circumference * (1 - pct)}`;

    const obsText =
        lb.generalObservation && String(lb.generalObservation).trim()
            ? String(lb.generalObservation).trim()
            : '—';

    return {
        scoreVal,
        gradeTitle,
        strokeDasharray,
        strokeDashoffset,
        obsText,
        rawGrade: hasGrade ? rawGrade : '',
        rawObs: lb.generalObservation || ''
    };
}

export default function PracticeAndLogbookApp({ role }) {
    const hasPracticeFilters = role === 'director' || role === 'tutor';
    const [filtersToolbarEl, setFiltersToolbarEl] = useState(null);
    const [practicePanelEl, setPracticePanelEl] = useState(null);
    const [logbookPanelEl, setLogbookPanelEl] = useState(null);
    const { activitiesBadges } = usePractice();

    const [loading, setLoading] = useState(true);
    const [practices, setPractices] = useState([]);
    const [currentPractice, setCurrentPractice] = useState(null);

    // Practice filters state (Tutor & Director)
    const [searchQuery, setSearchQuery] = useState('');
    const [semesterFilter, setSemesterFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [evalStatesByPractice, setEvalStatesByPractice] = useState({});

    // Logbook state
    const [questionsPill, setQuestionsPill] = useState({
        text: 'Up to date',
        isWarning: false,
        loading: true
    });

    // Tutor inline edit form state
    const [editOpen, setEditOpen] = useState(false);
    const [gradeInput, setGradeInput] = useState('');
    const [obsInput, setObsInput] = useState('');

    // Director 3-dot menu open state
    const [dirMenuOpen, setDirMenuOpen] = useState(false);

    // Student credential modal state
    const [credStudent, setCredStudent] = useState(null);

    const selectorRef = useRef(null);
    const selectorBoxRef = useRef(null);
    const semesterFilterWrapRef = useRef(null);
    const semesterFilterSelectRef = useRef(null);
    const statusFilterWrapRef = useRef(null);
    const statusFilterSelectRef = useRef(null);
    const gradeInputRef = useRef(null);
    const dirMenuRef = useRef(null);
    const practicesRef = useRef([]);
    const currentPracticeRef = useRef(null);
    const questionsPillCacheRef = useRef({
        practiceId: null,
        timestamp: 0,
        text: 'Up to date',
        isWarning: false
    });
    const isUpdatingQuestionsRef = useRef(false);

    practicesRef.current = practices;
    currentPracticeRef.current = currentPractice;

    const formatDate = (val) => apiFormatDate(val) || val || '—';

    // Locate target DOM containers on mount
    useEffect(() => {
        const pPanel = getPanelElement('practice-panel');
        const lPanel = getPanelElement('logbook-panel');

        if (pPanel) {
            pPanel.innerHTML = '';
            setPracticePanelEl(pPanel);

            if (role === 'director' || role === 'tutor') {
                let fBar = document.getElementById('practice-filters-toolbar');
                if (!fBar && pPanel.parentNode) {
                    fBar = document.createElement('div');
                    fBar.id = 'practice-filters-toolbar';
                    fBar.className = 'um-toolbar pf-toolbar';
                    pPanel.parentNode.insertBefore(fBar, pPanel);
                }
                if (fBar) {
                    fBar.style.display = pPanel.style.display === 'none' ? 'none' : '';
                    setFiltersToolbarEl(fBar);
                }
            }
        }
        if (lPanel) {
            lPanel.innerHTML = '';
            setLogbookPanelEl(lPanel);
        }
    }, [role]);

    // Manage `.is-loading` class on practicePanelEl
    useEffect(() => {
        if (!practicePanelEl) return;
        if (loading) {
            practicePanelEl.classList.add('is-loading');
        } else {
            practicePanelEl.classList.remove('is-loading');
        }
    }, [loading, practicePanelEl]);

    // Questions pill calculation per role
    const updateQuestionsPill = useCallback(
        async (practiceObj, prefetchedEvaluations = null, force = false) => {
            const p = practiceObj || currentPracticeRef.current;
            if (role === 'advisor') return;

            const setPillState = (text, isWarning) => {
                setQuestionsPill({ text, isWarning, loading: false });
            };

            if (!p) {
                setPillState('Up to date', false);
                return;
            }

            const evalApi = EvalAPI;
            if (!evalApi) {
                setPillState('Up to date', false);
                return;
            }

            if (role === 'student') {
                try {
                    if (
                        !evalApi.estudiante ||
                        typeof evalApi.estudiante.misEvaluaciones !== 'function'
                    ) {
                        setPillState('Up to date', false);
                        return;
                    }
                    const lista = await evalApi.estudiante.misEvaluaciones();
                    if (!Array.isArray(lista) || lista.length === 0) {
                        setPillState('Up to date', false);
                        return;
                    }
                    let pendingCount = 0;
                    let pendingEvaluations = 0;
                    for (const ev of lista) {
                        if (ev.estado !== 'PUBLICADA') continue;
                        let isPending = false;
                        if (ev.id_intento_abierto) {
                            try {
                                const intento = await evalApi.estudiante.verIntento(
                                    ev.id_intento_abierto
                                );
                                const preguntas = intento?.preguntas || [];
                                const respuestas = intento?.respuestas || [];
                                const unanswered = preguntas.filter((q) => {
                                    const r = respuestas.find(
                                        (x) => x.id_pregunta === q.id_pregunta
                                    );
                                    if (!r) return true;
                                    if (q.tipo_pregunta === 'ABIERTA') {
                                        return !r.respuesta || !r.respuesta.trim();
                                    }
                                    return r.id_opcion === null || r.id_opcion === undefined;
                                }).length;
                                if (unanswered > 0) {
                                    pendingCount += unanswered;
                                    isPending = true;
                                }
                            } catch (_) {
                                const total = Number(ev.total_preguntas) || 0;
                                if (total > 0) {
                                    pendingCount += total;
                                    isPending = true;
                                }
                            }
                        } else if (
                            ev.puede_intentar &&
                            (!ev.intentos_usados || ev.intentos_usados === 0)
                        ) {
                            pendingCount += Number(ev.total_preguntas) || 0;
                            isPending = true;
                        } else if (
                            ev.puede_intentar &&
                            ev.ultimo_intento_estado !== 'ENVIADO' &&
                            ev.ultimo_intento_estado !== 'CALIFICADO'
                        ) {
                            pendingCount += Number(ev.total_preguntas) || 0;
                            isPending = true;
                        }
                        if (isPending) pendingEvaluations++;
                    }
                    if (pendingCount > 0) {
                        setPillState(
                            `${pendingCount} ${pendingCount === 1 ? 'question' : 'questions'}`,
                            true
                        );
                    } else if (pendingEvaluations > 0) {
                        setPillState(
                            `${pendingEvaluations} ${
                                pendingEvaluations === 1 ? 'evaluation' : 'evaluations'
                            }`,
                            true
                        );
                    } else {
                        setPillState('Up to date', false);
                    }
                } catch (_) {
                    setPillState('Up to date', false);
                }
                return;
            }

            if (role === 'tutor') {
                const practiceId = String(p.id || p.code || '');
                if (!practiceId) {
                    setPillState('Up to date', false);
                    return;
                }
                const now = Date.now();
                const cache = questionsPillCacheRef.current;
                if (
                    !force &&
                    !prefetchedEvaluations &&
                    cache.practiceId === practiceId &&
                    now - cache.timestamp < 10000
                ) {
                    setPillState(cache.text, cache.isWarning);
                    return;
                }
                if (isUpdatingQuestionsRef.current && !prefetchedEvaluations) return;

                try {
                    isUpdatingQuestionsRef.current = true;
                    if (
                        !evalApi.tutor ||
                        typeof evalApi.tutor.listarEvaluaciones !== 'function'
                    ) {
                        setPillState('Up to date', false);
                        return;
                    }
                    const evs = Array.isArray(prefetchedEvaluations)
                        ? prefetchedEvaluations
                        : await evalApi.tutor.listarEvaluaciones({ id_practica: practiceId });
                    if (!Array.isArray(evs) || evs.length === 0) {
                        questionsPillCacheRef.current = {
                            practiceId,
                            timestamp: Date.now(),
                            text: 'Up to date',
                            isWarning: false
                        };
                        setPillState('Up to date', false);
                        return;
                    }
                    const draftsCount = evs.filter((ev) => ev.estado === 'BORRADOR').length;
                    let toGradeCount = 0;
                    const evsWithAttempts = evs.filter(
                        (ev) => Number(ev.intentos_presentados) > 0
                    );
                    if (evsWithAttempts.length > 0) {
                        await Promise.all(
                            evsWithAttempts.map(async (ev) => {
                                try {
                                    const intentos = await evalApi.tutor.listarIntentos(
                                        ev.id_evaluacion
                                    );
                                    if (Array.isArray(intentos)) {
                                        const pendingAttempts = intentos.filter(
                                            (i) =>
                                                i.estado === 'ENVIADO' ||
                                                Number(i.respuestas_pendientes) > 0
                                        );
                                        toGradeCount += pendingAttempts.length;
                                    }
                                } catch (_) {
                                    // ignore
                                }
                            })
                        );
                    }
                    let text = 'Up to date';
                    let isWarning = false;
                    if (draftsCount > 0 && toGradeCount > 0) {
                        const draftText = `${draftsCount} ${
                            draftsCount === 1 ? 'draft' : 'drafts'
                        }`;
                        text = `${draftText}, ${toGradeCount} to grade`;
                        isWarning = true;
                    } else if (draftsCount > 0) {
                        text = `${draftsCount} ${draftsCount === 1 ? 'draft' : 'drafts'}`;
                        isWarning = true;
                    } else if (toGradeCount > 0) {
                        text = `${toGradeCount} to grade`;
                        isWarning = true;
                    }
                    questionsPillCacheRef.current = {
                        practiceId,
                        timestamp: Date.now(),
                        text,
                        isWarning
                    };
                    setPillState(text, isWarning);
                } catch (_) {
                    setPillState('Up to date', false);
                } finally {
                    isUpdatingQuestionsRef.current = false;
                }
                return;
            }

            if (role === 'director') {
                const practiceId = String(p.id || p.code || '');
                if (!practiceId) {
                    setPillState('Up to date', false);
                    return;
                }
                try {
                    if (!evalApi.director || typeof evalApi.director.listar !== 'function') {
                        setPillState('Up to date', false);
                        return;
                    }
                    const r = await evalApi.director.listar({ id_practica: practiceId });
                    const evs = r?.items || (Array.isArray(r) ? r : []);
                    if (!Array.isArray(evs) || evs.length === 0) {
                        setPillState('Up to date', false);
                        return;
                    }
                    let pendingCount = 0;
                    let pendingEvaluations = 0;
                    for (const ev of evs) {
                        if (ev.estado !== 'PUBLICADA') continue;
                        const enviados = Number(ev.intentos_enviados) || 0;
                        const calificados = Number(ev.intentos_calificados) || 0;
                        const totalPreguntas = Number(ev.total_preguntas) || 0;
                        if (enviados === 0 && calificados === 0) {
                            pendingCount += totalPreguntas;
                            pendingEvaluations++;
                        } else if (Number(ev.intentos_iniciados) > enviados) {
                            pendingCount += totalPreguntas;
                            pendingEvaluations++;
                        }
                    }
                    if (pendingCount > 0) {
                        setPillState(
                            `${pendingCount} ${pendingCount === 1 ? 'question' : 'questions'}`,
                            true
                        );
                    } else if (pendingEvaluations > 0) {
                        setPillState(
                            `${pendingEvaluations} ${
                                pendingEvaluations === 1 ? 'evaluation' : 'evaluations'
                            }`,
                            true
                        );
                    } else {
                        setPillState('Up to date', false);
                    }
                } catch (_) {
                    setPillState('Up to date', false);
                }
            }
        },
        [role]
    );

    // Select a practice and publish global contracts
    const selectPractice = useCallback(
        async (practiceObj, listOverride = null) => {
            if (!practiceObj) {
                setCurrentPractice(null);
                currentPracticeRef.current = null;
                return;
            }

            const prev = currentPracticeRef.current;
            const isSwitching = prev && String(prev.id) !== String(practiceObj.id);
            if (isSwitching) {
                setQuestionsPill((prevPill) => ({ ...prevPill, loading: true }));
                setPracticeStore({
                    activitiesBadges: {
                        ...getPractice().activitiesBadges,
                        loading: true
                    }
                });
            }

            setCurrentPractice(practiceObj);
            currentPracticeRef.current = practiceObj;
            setEditOpen(false);

            let studentCred = null;
            if (role !== 'student') {
                studentCred = {
                    fullName: practiceObj.student,
                    documentType: practiceObj.studentDetails?.documentType,
                    documentNumber: practiceObj.studentDocument,
                    status: practiceObj.studentDetails?.status,
                    program: practiceObj.studentDetails?.program,
                    email: practiceObj.studentDetails?.email
                };
            }

            setPracticeStore({
                practice: practiceObj,
                practices: listOverride || practicesRef.current,
                student: studentCred
            });

            if (role === 'student') {
                emit(EVENTS.STUDENT_PRACTICE, { practice: practiceObj });
            } else if (role === 'tutor' || role === 'advisor') {
                emit(EVENTS.PRACTICE, practiceObj, document);
                emit(EVENTS.PRACTICE, practiceObj, window);
            } else if (role === 'director') {
                emit(EVENTS.DIRECTOR_PRACTICE_CHANGED, { practice: practiceObj });
            }

            await updateQuestionsPill(practiceObj);
        },
        [role, updateQuestionsPill]
    );

    // Load evaluation states per practice for Tutor & Director status filtering
    const loadPracticeEvalStates = useCallback(async () => {
        if (role !== 'director' && role !== 'tutor') return;
        const evalApi = EvalAPI;
        if (!evalApi) return;
        try {
            let items = [];
            if (role === 'director' && typeof evalApi.director?.listar === 'function') {
                const res = await evalApi.director.listar({ limite: 200 });
                items = res?.items || (Array.isArray(res) ? res : []);
            } else if (role === 'tutor' && typeof evalApi.tutor?.listarEvaluaciones === 'function') {
                const res = await evalApi.tutor.listarEvaluaciones();
                items = Array.isArray(res) ? res : res?.items || [];
            }
            if (!Array.isArray(items)) return;

            const map = {};
            for (const ev of items) {
                const pid = String(ev.id_practica || '').trim();
                if (!pid) continue;
                if (!map[pid]) {
                    map[pid] = { evaluating: false, grading: false };
                }
                const enviados = Number(ev.intentos_enviados) || 0;
                const iniciados = Number(ev.intentos_iniciados) || 0;
                const presentados = Number(ev.intentos_presentados) || 0;
                const calificados = Number(ev.intentos_calificados) || 0;
                const pendientes = Number(ev.pendientes_revision) || 0;

                if (
                    ev.estado === 'PUBLICADA' &&
                    ((enviados === 0 && calificados === 0) || iniciados > enviados)
                ) {
                    map[pid].evaluating = true;
                }
                if (
                    pendientes > 0 ||
                    enviados > calificados ||
                    presentados > calificados ||
                    ev.estado === 'BORRADOR'
                ) {
                    map[pid].grading = true;
                }
            }
            setEvalStatesByPractice(map);
        } catch (_) {
            // Non-blocking if evaluation service is unreachable
        }
    }, [role]);

    // Load practices from API
    const loadPractices = useCallback(
        async (preferredId = null) => {
            try {
                const res = await get('/api/practices');
                const list = (res && res.practices) || [];
                setPractices(list);
                practicesRef.current = list;
                setLoading(false);

                if (role === 'director' || role === 'tutor') {
                    loadPracticeEvalStates();
                }

                if (role === 'student') {
                    const chosen =
                        list.find((p) => p.status === 'active') || list[0] || null;
                    await selectPractice(chosen, list);
                } else {
                    if (!list.length) {
                        await selectPractice(null, []);
                        return;
                    }
                    const currentId =
                        preferredId ||
                        (currentPracticeRef.current && currentPracticeRef.current.id);
                    const chosen =
                        (currentId &&
                            list.find((p) => String(p.id) === String(currentId))) ||
                        list[0];
                    await selectPractice(chosen, list);
                }
            } catch (err) {
                setLoading(false);
                showError(err);
            }
        },
        [role, selectPractice, loadPracticeEvalStates]
    );

    const reloadLogbook = useCallback(async () => {
        const cur = currentPracticeRef.current;
        if (!cur) return;
        const { practice: fresh } = await get(`/api/practices/${cur.id}`);
        setPractices((prev) => prev.map((p) => (p.id === fresh.id ? fresh : p)));
        setCurrentPractice(fresh);
        currentPracticeRef.current = fresh;
        setPracticeStore({ practice: fresh });
    }, []);

    // Expose role helpers via registry & events
    useEffect(() => {
        if (role === 'student') {
            return on(EVENTS.UPDATE_STUDENT_QUESTIONS_PILL, () =>
                updateQuestionsPill(currentPracticeRef.current, null, true)
            );
        } else if (role === 'tutor' || role === 'advisor') {
            return provide('logbook', {
                updateQuestionsPill: (prefetched, force) =>
                    updateQuestionsPill(currentPracticeRef.current, prefetched, force),
                updateLogbookHero: (lb) => {
                    setCurrentPractice((prev) => (prev ? { ...prev, logbook: lb } : prev));
                },
                reloadLogbook
            });
        } else if (role === 'director') {
            return provide('director', {
                getCurrentPractice: () => currentPracticeRef.current,
                reloadPractices: (preferredId) => loadPractices(preferredId)
            });
        }
    }, [role, updateQuestionsPill, loadPractices, reloadLogbook]);

    // Initial load & global event listeners
    useEffect(() => {
        loadPractices();

        const unsubOpen = on(EVENTS.OPEN_PRACTICE, (detail) => {
            const id = detail && detail.id;
            if (!id) return;
            const found = practicesRef.current.find((p) => String(p.id) === String(id));
            if (found) {
                setSearchQuery('');
                setSemesterFilter('all');
                setStatusFilter('all');
                selectPractice(found);
                if (selectorRef.current) {
                    selectorRef.current.value = String(found.id);
                    syncCustomSelect(selectorRef.current);
                }
                // Enter logbook automatically
                showPanel('logbook-panel', role === 'director' ? 'block' : 'flex');
            }
        });

        const unsubChanged = on(EVENTS.PRACTICES_CHANGED, (detail) => {
            const preferredId = detail && detail.id;
            loadPractices(preferredId);
        });

        return () => {
            unsubOpen();
            unsubChanged();
        };
    }, [loadPractices, selectPractice, role]);

    // Compute filtered practices for Tutor & Director
    const filteredPractices = useMemo(() => {
        if (!hasPracticeFilters) return practices;
        const todayIso = new Date().toISOString().slice(0, 10);
        const q = searchQuery.trim().toLowerCase();
        return practices.filter((p) => {
            // 1. Search by student
            if (q) {
                const hay = [p.student, p.studentDocument, p.code, p.name]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();
                if (!hay.includes(q)) return false;
            }
            // 2. Filter by semester
            if (semesterFilter !== 'all') {
                if (String(p.semester ?? '').trim() !== String(semesterFilter).trim()) {
                    return false;
                }
            }
            // 3. Filter by practice status [Activa, Cancelada, Finalizada, Evaluando, Calificando]
            if (statusFilter !== 'all') {
                const rawStatus = String(p.status || '')
                    .trim()
                    .toLowerCase();
                const evState = evalStatesByPractice[String(p.id || p.code || '')] || {};
                const endIso = p.endDate ? String(p.endDate).slice(0, 10) : '';
                const hasFinalGrade =
                    p.logbook && p.logbook.finalGrade != null && p.logbook.finalGrade !== '';
                const isPastEndUnGraded = Boolean(endIso && endIso < todayIso && !hasFinalGrade);

                if (statusFilter === 'active') {
                    if (rawStatus !== 'active' && rawStatus !== 'activa') return false;
                } else if (statusFilter === 'cancelled') {
                    if (rawStatus !== 'cancelled' && rawStatus !== 'cancelada') return false;
                } else if (statusFilter === 'completed') {
                    if (rawStatus !== 'completed' && rawStatus !== 'finalizada') return false;
                } else if (statusFilter === 'evaluating') {
                    const matchesEval =
                        rawStatus === 'evaluating' ||
                        rawStatus === 'evaluando' ||
                        ((rawStatus === 'active' || rawStatus === 'activa') &&
                            Boolean(evState.evaluating));
                    if (!matchesEval) return false;
                } else if (statusFilter === 'grading') {
                    const matchesGrading =
                        rawStatus === 'grading' ||
                        rawStatus === 'calificando' ||
                        ((rawStatus === 'active' || rawStatus === 'activa') &&
                            (Boolean(evState.grading) || isPastEndUnGraded));
                    if (!matchesGrading) return false;
                }
            }
            return true;
        });
    }, [
        hasPracticeFilters,
        practices,
        searchQuery,
        semesterFilter,
        statusFilter,
        evalStatesByPractice
    ]);

    const displayedPractices = hasPracticeFilters ? filteredPractices : practices;

    // Available semesters (1..8 plus any other semester present in practices)
    const semesterOptions = useMemo(
        () =>
            Array.from(
                new Set([
                    1,
                    2,
                    3,
                    4,
                    5,
                    6,
                    7,
                    8,
                    ...practices
                        .map((p) => Number(p.semester))
                        .filter((n) => Number.isFinite(n) && n > 0)
                ])
            ).sort((a, b) => a - b),
        [practices]
    );

    // Keep currentPractice synchronized with filteredPractices when filters change
    useEffect(() => {
        if (!hasPracticeFilters || loading) return;
        if (filteredPractices.length === 0) {
            if (currentPracticeRef.current !== null) {
                selectPractice(null, []);
            }
            return;
        }
        const cur = currentPracticeRef.current;
        const stillIncluded =
            cur && filteredPractices.some((p) => String(p.id) === String(cur.id));
        if (!stillIncluded) {
            selectPractice(filteredPractices[0]);
        }
    }, [
        hasPracticeFilters,
        loading,
        searchQuery,
        semesterFilter,
        statusFilter,
        filteredPractices,
        selectPractice
    ]);

    const handleClearPracticeFilters = () => {
        setSearchQuery('');
        setSemesterFilter('all');
        setStatusFilter('all');
    };

    // Sync customSelect for tutor/advisor/director practice selector and filter dropdowns
    useCustomSelect(
        [selectorRef],
        [role, displayedPractices, currentPractice, practicePanelEl]
    );
    useCustomSelect(
        [semesterFilterSelectRef, statusFilterSelectRef],
        [role, semesterFilter, statusFilter, semesterOptions, filtersToolbarEl]
    );

    // Wire `#questionsBack` button in `#questions-panel`
    useEffect(() => {
        return onQuestionsBack(() => {
            showPanel('logbook-panel', role === 'director' ? 'block' : 'flex');
            if (role === 'director') {
                inject('eval:director')?.volverALista?.();
            } else if (role === 'student') {
                inject('eval:student')?.volverALista?.();
            } else if (role === 'tutor') {
                inject('eval:tutor')?.volverALista?.();
            }
            updateQuestionsPill(currentPracticeRef.current, null, true);
        });
    }, [role, updateQuestionsPill]);

    // Close Director 3-dot menu on outside click
    useEffect(() => {
        if (role !== 'director' || !dirMenuOpen) return;
        const handleOutside = (e) => {
            if (dirMenuRef.current && !dirMenuRef.current.contains(e.target)) {
                setDirMenuOpen(false);
            }
        };
        document.addEventListener('click', handleOutside);
        return () => document.removeEventListener('click', handleOutside);
    }, [role, dirMenuOpen]);

    // Handlers
    const handleEnterLogbook = () => {
        if (!currentPractice) return;
        showPanel('logbook-panel', role === 'director' ? 'block' : 'flex');
    };

    const handleBackToPractice = () => {
        showPanel('practice-panel', 'block');
    };

    const handleEnterActivities = () => {
        showPanel('activities-panel', 'flex');
    };

    const handleEnterQuestions = () => {
        showPanel('questions-panel', role === 'director' ? 'block' : 'flex');
        if (role === 'student') {
            inject('eval:student')?.abrir?.();
        } else if (role === 'tutor') {
            inject('eval:tutor')?.abrir?.();
        } else if (role === 'director') {
            inject('eval:director')?.abrir?.();
        }
    };

    const isReadOnly =
        currentPractice?.status === 'completed' ||
        currentPractice?.status === 'cancelled';

    const handleOpenTutorEdit = () => {
        if (role !== 'tutor' || !currentPractice || isReadOnly) return;
        const lb = currentPractice.logbook || {};
        setGradeInput(lb.finalGrade != null && lb.finalGrade !== '' ? String(lb.finalGrade) : '');
        setObsInput(lb.generalObservation || '');
        setEditOpen(true);
        setTimeout(() => {
            if (gradeInputRef.current) gradeInputRef.current.focus();
        }, 20);
    };

    const handleSaveTutorEdit = async (e) => {
        e.stopPropagation();
        if (!currentPractice) return;
        const nuevaNota = String(gradeInput).trim();
        const nuevaObs = String(obsInput).trim();

        try {
            await patch('/api/practices/' + currentPractice.id + '/logbook', {
                finalGrade: nuevaNota || null,
                generalObservation: nuevaObs || null
            });
            const updatedLb = {
                ...(currentPractice.logbook || {}),
                finalGrade: nuevaNota || null,
                generalObservation: nuevaObs || null
            };
            const updatedPractice = { ...currentPractice, logbook: updatedLb };
            setCurrentPractice(updatedPractice);
            currentPracticeRef.current = updatedPractice;
            setEditOpen(false);

            await alertModal({
                title: 'Success',
                message: 'Logbook updated successfully!'
            });
            await reloadLogbook();
        } catch (err) {
            showError(err);
        }
    };

    const handleEditPracticeDirector = () => {
        setDirMenuOpen(false);
        if (!currentPractice) return;
        emit(EVENTS.EDIT_PRACTICE, { practice: currentPractice });
    };

    const handleDeletePracticeDirector = async () => {
        setDirMenuOpen(false);
        if (!currentPractice) return;
        const confirmed = await confirmModal({
            title: 'Delete practice',
            message:
                'Are you sure you want to delete this practice? will be permanently deleted.\n\nThis action cannot be undone.',
            confirmLabel: 'Delete'
        });
        if (!confirmed) return;
        try {
            await del(`/api/practices/${currentPractice.id}`);
            await loadPractices();
            inject('reports')?.reload?.();
            emit(EVENTS.HOME_REFRESH);
            await alertModal({
                title: 'Practice deleted',
                message: 'The practice was deleted successfully.'
            });
        } catch (err) {
            showError(err);
        }
    };

    const handleCancelPracticeDirector = async () => {
        setDirMenuOpen(false);
        if (!currentPractice) return;
        const confirmed = await confirmModal({
            title: 'Cancelar práctica',
            message:
                '¿Estás seguro de que deseas cancelar esta práctica? Pasará a modo solo lectura y esta acción no se puede deshacer.',
            confirmLabel: 'Cancelar práctica'
        });
        if (!confirmed) return;
        try {
            await post(`/api/practices/${currentPractice.id}/cancel`, {});
            await loadPractices();
            inject('reports')?.reload?.();
            emit(EVENTS.HOME_REFRESH);
            await alertModal({
                title: 'Práctica cancelada',
                message: 'La práctica ha sido cancelada correctamente.'
            });
        } catch (err) {
            showError(err);
        }
    };

    const handleOpenStudentCred = () => {
        const st = getPractice().student;
        if (st) {
            setCredStudent(st);
        }
    };

    const hero = computeLogbookHero(currentPractice && currentPractice.logbook);
    const valOrDash = (v) => (v == null || v === '' ? '—' : v);
    const actBtnId =
        role === 'tutor' || role === 'advisor' ? 'preguntas-actividades-btn' : 'activities-btn';
    const qBtnId = role === 'tutor' ? 'preguntas-preguntas-btn' : 'questions-btn';

    return (
        <>
            {hasPracticeFilters && filtersToolbarEl
                ? createPortal(
                      <>
                          <div className="um-search">
                              <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                              <input
                                  type="search"
                                  id="pf-search"
                                  placeholder="Search by student..."
                                  aria-label="Search by student"
                                  value={searchQuery}
                                  onChange={(e) => setSearchQuery(e.target.value)}
                              />
                          </div>

                          <div ref={semesterFilterWrapRef} className="cp-input-wrap um-filter-wrap">
                              <select
                                  ref={semesterFilterSelectRef}
                                  id="pf-semester-filter"
                                  aria-label="Filter by semester"
                                  data-sheet-title="Filter by semester"
                                  value={semesterFilter}
                                  onChange={(e) => setSemesterFilter(e.target.value)}
                              >
                                  <option value="all">All</option>
                                  {semesterOptions.map((sem) => (
                                      <option key={sem} value={String(sem)}>
                                          {`Semester ${sem}`}
                                      </option>
                                  ))}
                              </select>
                              <i
                                  className="fa-solid fa-chevron-down right-icon"
                                  aria-hidden="true"
                              ></i>
                          </div>

                          <div ref={statusFilterWrapRef} className="cp-input-wrap um-filter-wrap">
                              <select
                                  ref={statusFilterSelectRef}
                                  id="pf-status-filter"
                                  aria-label="Filter by practice status"
                                  data-sheet-title="Filter by practice status"
                                  value={statusFilter}
                                  onChange={(e) => setStatusFilter(e.target.value)}
                              >
                                  <option value="all">All</option>
                                  <option value="active">Activa</option>
                                  <option value="cancelled">Cancelada</option>
                                  <option value="completed">Finalizada</option>
                                  <option value="evaluating">Evaluando</option>
                                  <option value="grading">Calificando</option>
                              </select>
                              <i
                                  className="fa-solid fa-chevron-down right-icon"
                                  aria-hidden="true"
                              ></i>
                          </div>

                          <div className="pf-clear-group">
                              <button
                                  type="button"
                                  className="um-ghost-btn"
                                  id="pf-clear-filters"
                                  onClick={handleClearPracticeFilters}
                              >
                                  <i className="fa-solid fa-rotate-left" aria-hidden="true"></i>{' '}
                                  Clear
                              </button>
                              <span
                                  className="pf-count-badge"
                                  id="pf-filter-count"
                                  title="Filtered practices / Total practices"
                              >
                                  {`${displayedPractices.length}/${practices.length}`}
                              </span>
                          </div>
                      </>,
                      filtersToolbarEl
                  )
                : null}

            {practicePanelEl
                ? createPortal(
                      <>
                          <div className="practice-header">
                              <h2 id="practice-title">
                                  {role === 'student' && !loading && !currentPractice
                                      ? 'Practice Information — you do not have an assigned practice yet'
                                      : 'Practice Information'}
                              </h2>
                              <div className="practice-status">
                                  <span>Status</span>
                                  <div
                                      className="status-badge"
                                      title={(currentPractice && currentPractice.status) || ''}
                                      style={{
                                          backgroundColor:
                                              (currentPractice &&
                                                  STATUS_COLORS[currentPractice.status]) ||
                                              ''
                                      }}
                                  >
                                      {(currentPractice && currentPractice.status) || ''}
                                  </div>
                                  {role === 'director' ? (
                                      <div
                                          ref={dirMenuRef}
                                          className="ev-menu-wrapper"
                                          id="practice-options-menu"
                                          style={{ marginLeft: '8px' }}
                                      >
                                          <button
                                              type="button"
                                              className="ev-menu-btn"
                                              aria-label="Practice options"
                                              aria-expanded={dirMenuOpen ? 'true' : 'false'}
                                              style={{
                                                  color: '#111827',
                                                  backgroundColor: '#e5e7eb',
                                                  borderRadius: '8px',
                                                  width: '32px',
                                                  height: '32px',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  border: 'none',
                                                  cursor: 'pointer'
                                              }}
                                              onClick={(e) => {
                                                  e.stopPropagation();
                                                  setDirMenuOpen((prev) => !prev);
                                              }}
                                          >
                                              <i
                                                  className="fa-solid fa-ellipsis-vertical"
                                                  aria-hidden="true"
                                                  style={{ fontSize: '1.1rem' }}
                                              ></i>
                                          </button>
                                          <div
                                              className={`ev-dropdown${
                                                  dirMenuOpen ? ' is-open' : ''
                                              }`}
                                              role="menu"
                                          >
                                              <button
                                                  type="button"
                                                  className="ev-dropdown-item ev-item--edit"
                                                  id="btn-edit-practice"
                                                  role="menuitem"
                                                  onClick={handleEditPracticeDirector}
                                              >
                                                  <i
                                                      className="fa-solid fa-pen"
                                                      aria-hidden="true"
                                                  ></i>{' '}
                                                  Editar
                                              </button>
                                               {currentPractice?.status !== 'cancelled' &&
                                               currentPractice?.status !== 'completed' ? (
                                                   <button
                                                       type="button"
                                                       className="ev-dropdown-item ev-item--cancel"
                                                       id="btn-cancel-practice"
                                                       role="menuitem"
                                                       style={{ color: '#b3261e' }}
                                                       onClick={handleCancelPracticeDirector}
                                                   >
                                                       <i
                                                           className="fa-solid fa-ban"
                                                           aria-hidden="true"
                                                       ></i>{' '}
                                                       Cancelar
                                                   </button>
                                               ) : null}
                                              <button
                                                  type="button"
                                                  className="ev-dropdown-item ev-item--delete"
                                                  id="btn-delete-practice"
                                                  role="menuitem"
                                                  style={{
                                                      color: '#b3261e',
                                                      display: activitiesBadges.canDelete ? 'flex' : 'none'
                                                  }}
                                                  onClick={handleDeletePracticeDirector}
                                              >
                                                  <i
                                                      className="fa-solid fa-trash"
                                                      aria-hidden="true"
                                                  ></i>{' '}
                                                  Eliminar
                                              </button>
                                          </div>
                                      </div>
                                  ) : null}
                              </div>
                          </div>

                          {role !== 'student' ? (
                              <div
                                  ref={selectorBoxRef}
                                  id="practice-selector-box"
                                  className="practice-field"
                                  style={{ marginBottom: '24px' }}
                              >
                                  <label htmlFor="practice-selector">
                                      {role === 'director'
                                          ? 'Practice to view'
                                          : 'Assigned student'}
                                  </label>
                                  <div className="cp-input-wrap">
                                      <select
                                          ref={selectorRef}
                                          id="practice-selector"
                                          aria-label={
                                              role === 'director'
                                                  ? 'Practice to view'
                                                  : 'Assigned student'
                                          }
                                          data-sheet-title={
                                              role === 'director'
                                                  ? 'Practice to view'
                                                  : 'Assigned student'
                                          }
                                          disabled={displayedPractices.length === 0}
                                          value={(currentPractice && currentPractice.id) || ''}
                                          onChange={(e) => {
                                              const next = displayedPractices.find(
                                                  (p) => String(p.id) === String(e.target.value)
                                              );
                                              if (next) selectPractice(next);
                                          }}
                                      >
                                          {practices.length === 0 ? (
                                              <option value="">
                                                  {role === 'director'
                                                      ? 'No practices have been created'
                                                      : 'You have no assigned practices'}
                                              </option>
                                          ) : displayedPractices.length === 0 ? (
                                              <option value="">
                                                  No practices match the selected filters
                                              </option>
                                          ) : (
                                              displayedPractices.map((p) => (
                                                  <option key={p.id} value={p.id}>
                                                      {`${p.student} — ${p.code}`}
                                                  </option>
                                              ))
                                          )}
                                      </select>
                                      <i
                                          className="fa-solid fa-chevron-down right-icon"
                                          aria-hidden="true"
                                      ></i>
                                  </div>
                              </div>
                          ) : null}

                          <form
                              className="practice-form"
                              action="#"
                              method="post"
                              onSubmit={(e) => e.preventDefault()}
                          >
                              <div className="practice-field">
                                  <label htmlFor="practice-name">Practice Name</label>
                                  <div className="practice-value" id="practice-name">
                                      {currentPractice
                                          ? valOrDash(currentPractice.name)
                                          : '.....'}
                                  </div>
                              </div>
                              <div className="practice-field">
                                  <label htmlFor="tutor">Tutor</label>
                                  <div className="practice-value" id="tutor">
                                      {currentPractice
                                          ? valOrDash(currentPractice.tutor)
                                          : '.....'}
                                  </div>
                              </div>
                              <div className="practice-field">
                                  <label htmlFor="hours">Practice Hours</label>
                                  <div className="practice-value" id="hours">
                                      {currentPractice
                                          ? valOrDash(currentPractice.hours)
                                          : '.....'}
                                  </div>
                              </div>
                              <div className="practice-field">
                                  <label htmlFor="institution">Institution</label>
                                  <div className="practice-value" id="institution">
                                      {currentPractice
                                          ? valOrDash(currentPractice.institution)
                                          : '.....'}
                                  </div>
                              </div>
                              <div className="practice-field">
                                  <label htmlFor="advisor">Advisor</label>
                                  <div className="practice-value" id="advisor">
                                      {currentPractice
                                          ? valOrDash(currentPractice.advisor)
                                          : '.....'}
                                  </div>
                              </div>
                              <div className="practice-field">
                                  <label htmlFor="semester">Semester</label>
                                  <div className="practice-value" id="semester">
                                      {currentPractice
                                          ? valOrDash(currentPractice.semester)
                                          : '.....'}
                                  </div>
                              </div>
                              <div className="practice-field practice-field--date">
                                  <label htmlFor="start-date">Start Date</label>
                                  <div>
                                      <div className="practice-value" id="start-date">
                                          {currentPractice
                                              ? formatDate(currentPractice.startDate)
                                              : '.....'}
                                      </div>
                                      <i
                                          className="fa-regular fa-calendar"
                                          aria-hidden="true"
                                      ></i>
                                  </div>
                              </div>
                              <div className="practice-field practice-field--date">
                                  <label htmlFor="end-date">End Date</label>
                                  <div>
                                      <div className="practice-value" id="end-date">
                                          {currentPractice
                                              ? formatDate(currentPractice.endDate)
                                              : '.....'}
                                      </div>
                                      <i
                                          className="fa-regular fa-calendar"
                                          aria-hidden="true"
                                      ></i>
                                  </div>
                              </div>
                              <div className="practice-field">
                                  <label htmlFor="code">Practice Code</label>
                                  <div className="practice-value" id="code">
                                      {currentPractice
                                          ? valOrDash(currentPractice.code)
                                          : '.....'}
                                  </div>
                              </div>
                          </form>

                          <button
                              className="practice-submit"
                              type="button"
                              aria-label="Enter"
                              disabled={!currentPractice}
                              title={
                                  !currentPractice && role === 'student'
                                      ? 'You do not have an assigned practice yet'
                                      : undefined
                              }
                              onClick={handleEnterLogbook}
                          >
                              <span className="practice-submit-text">Enter</span>
                              <span className="practice-submit-glow" aria-hidden="true">
                                  <svg
                                      className="practice-submit-streaks"
                                      viewBox="0 0 120 44"
                                      preserveAspectRatio="none"
                                  >
                                      <defs>
                                          <linearGradient
                                              id="psStreakGrad"
                                              x1="100%"
                                              y1="0%"
                                              x2="0%"
                                              y2="0%"
                                          >
                                              <stop
                                                  offset="0%"
                                                  stopColor="var(--ps-streak-color-1, #34d399)"
                                                  stopOpacity="0.95"
                                              />
                                              <stop
                                                  offset="20%"
                                                  stopColor="var(--ps-streak-color-1, #34d399)"
                                                  stopOpacity="0.8"
                                              />
                                              <stop
                                                  offset="55%"
                                                  stopColor="var(--ps-streak-color-2, #10b981)"
                                                  stopOpacity="0.3"
                                              />
                                              <stop
                                                  offset="100%"
                                                  stopColor="var(--ps-streak-color-2, #10b981)"
                                                  stopOpacity="0"
                                              />
                                          </linearGradient>
                                          <filter
                                              id="psGlowBlur"
                                              x="-30%"
                                              y="-30%"
                                              width="160%"
                                              height="160%"
                                          >
                                              <feGaussianBlur stdDeviation="1" result="blur" />
                                              <feMerge>
                                                  <feMergeNode in="blur" />
                                                  <feMergeNode in="SourceGraphic" />
                                              </feMerge>
                                          </filter>
                                      </defs>
                                      <rect
                                          x="50"
                                          y="7"
                                          width="70"
                                          height="3"
                                          rx="1.5"
                                          fill="url(#psStreakGrad)"
                                          filter="url(#psGlowBlur)"
                                      />
                                      <rect
                                          x="25"
                                          y="14"
                                          width="95"
                                          height="3.5"
                                          rx="1.75"
                                          fill="url(#psStreakGrad)"
                                          filter="url(#psGlowBlur)"
                                      />
                                      <rect
                                          x="5"
                                          y="21"
                                          width="115"
                                          height="4"
                                          rx="2"
                                          fill="url(#psStreakGrad)"
                                          filter="url(#psGlowBlur)"
                                      />
                                      <rect
                                          x="22"
                                          y="28.5"
                                          width="98"
                                          height="3.5"
                                          rx="1.75"
                                          fill="url(#psStreakGrad)"
                                          filter="url(#psGlowBlur)"
                                      />
                                      <rect
                                          x="55"
                                          y="35"
                                          width="65"
                                          height="3"
                                          rx="1.5"
                                          fill="url(#psStreakGrad)"
                                          filter="url(#psGlowBlur)"
                                      />
                                  </svg>
                              </span>
                              <span className="practice-submit-circle">
                                  <svg
                                      viewBox="0 0 24 24"
                                      className="practice-submit-arrow"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2.6"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                  >
                                      <line x1="5" y1="12" x2="19" y2="12"></line>
                                      <polyline points="12 5 19 12 12 19"></polyline>
                                  </svg>
                              </span>
                          </button>
                      </>,
                      practicePanelEl
                  )
                : null}

            {logbookPanelEl
                ? createPortal(
                      <>
                          <div className="logbook-header">
                              <button
                                  type="button"
                                  className="logbook-back-btn"
                                  id="logbookBack"
                                  aria-label="Back to Practice Information"
                                  onClick={handleBackToPractice}
                              >
                                  <i className="fa-solid fa-arrow-left" aria-hidden="true"></i>
                              </button>
                              <h2 id="logbook-title" className="logbook-title">
                                  Practice{' '}
                                  {role !== 'student' ? (
                                      <span
                                          className="lb-student-name"
                                          aria-label="View student credential"
                                          onClick={handleOpenStudentCred}
                                      >
                                          {currentPractice && currentPractice.student
                                              ? `- ${currentPractice.student}`
                                              : ''}
                                      </span>
                                  ) : null}
                              </h2>
                          </div>

                          <div
                              className={`lb-hero-banner${loading ? ' is-loading' : ''}`}
                              id="lb-hero-banner"
                              style={role === 'tutor' && !isReadOnly ? { cursor: 'pointer' } : undefined}
                              title={
                                  role === 'tutor'
                                      ? 'Haz clic para editar la calificación y observación'
                                      : undefined
                              }
                              onClick={role === 'tutor' && !isReadOnly ? handleOpenTutorEdit : undefined}
                          >
                              <div className="lb-hero-left">
                                  <div className="lb-score-ring" id="lb-score-ring">
                                      <svg
                                          className="lb-ring-svg"
                                          viewBox="0 0 88 88"
                                          aria-hidden="true"
                                      >
                                          <circle className="lb-ring-bg" cx="44" cy="44" r="36" />
                                          <circle
                                              className="lb-ring-fill"
                                              id="lb-ring-fill"
                                              cx="44"
                                              cy="44"
                                              r="36"
                                              style={{
                                                  strokeDasharray: hero.strokeDasharray,
                                                  strokeDashoffset: hero.strokeDashoffset
                                              }}
                                          />
                                      </svg>
                                      <div className="lb-ring-content">
                                          <span className="lb-score-val" id="lb-score-val">
                                              {hero.scoreVal}
                                          </span>
                                          <span className="lb-score-max">OF 5.0</span>
                                      </div>
                                  </div>
                                  <div className="lb-grade-info">
                                      <span className="lb-grade-kicker">FINAL GRADE</span>
                                      <h3 className="lb-grade-title" id="lb-grade-title">
                                          {hero.gradeTitle}
                                      </h3>
                                  </div>
                              </div>

                              <div className="lb-hero-right">
                                  <div className="lb-obs-box">
                                      {role === 'tutor' ? (
                                          <div
                                              style={{
                                                  display: 'flex',
                                                  justifyContent: 'space-between',
                                                  alignItems: 'center'
                                              }}
                                          >
                                              <span className="lb-obs-kicker">
                                                  GENERAL OBSERVATION
                                              </span>
                                              <i
                                                  className="fa-solid fa-pen-to-square"
                                                  style={{ color: '#8ec3ab', fontSize: '13px' }}
                                                  title="Edit logbook"
                                              ></i>
                                          </div>
                                      ) : (
                                          <span className="lb-obs-kicker">GENERAL OBSERVATION</span>
                                      )}
                                      <div className="lb-obs-text-wrap">
                                          <span className="lb-obs-quote" aria-hidden="true">
                                              ”
                                          </span>
                                          <p
                                              className="lb-obs-text"
                                              id="lb-obs-text"
                                              title={hero.obsText}
                                          >
                                              {hero.obsText}
                                          </p>
                                      </div>
                                  </div>
                              </div>
                          </div>

                          {role === 'tutor' ? (
                              <div
                                  id="tutor-logbook-edit-form"
                                  style={{
                                      display: editOpen ? 'block' : 'none',
                                      background: '#ffffff',
                                      borderRadius: '16px',
                                      padding: '20px 24px',
                                      marginBottom: '24px',
                                      boxShadow: '0 4px 18px rgba(0,0,0,0.06)',
                                      border: '1px solid rgba(0,0,0,0.06)'
                                  }}
                              >
                                  <h4
                                      style={{
                                          margin: '0 0 16px 0',
                                          fontFamily: 'var(--font-sans)',
                                          color: '#103323',
                                          fontSize: '16px'
                                      }}
                                  >
                                      Edit Grade and Observation
                                  </h4>
                                  <div
                                      style={{
                                          display: 'grid',
                                          gridTemplateColumns: '140px 1fr',
                                          gap: '16px',
                                          marginBottom: '16px'
                                      }}
                                  >
                                      <div>
                                          <label
                                              htmlFor="grade-input"
                                              style={{
                                                  display: 'block',
                                                  fontSize: '13px',
                                                  fontWeight: 600,
                                                  color: '#53685e',
                                                  marginBottom: '6px'
                                              }}
                                          >
                                              Grade (0 - 5)
                                          </label>
                                          <input
                                              ref={gradeInputRef}
                                              type="number"
                                              id="grade-input"
                                              step="0.1"
                                              min="0"
                                              max="5"
                                              placeholder="5.0"
                                              value={gradeInput}
                                              onChange={(e) => setGradeInput(e.target.value)}
                                              style={{
                                                  width: '100%',
                                                  height: '40px',
                                                  padding: '0 12px',
                                                  border: '1px solid rgba(0,0,0,0.15)',
                                                  borderRadius: '8px',
                                                  fontSize: '15px',
                                                  boxSizing: 'border-box'
                                              }}
                                          />
                                      </div>
                                      <div>
                                          <label
                                              htmlFor="obs-input"
                                              style={{
                                                  display: 'block',
                                                  fontSize: '13px',
                                                  fontWeight: 600,
                                                  color: '#53685e',
                                                  marginBottom: '6px'
                                              }}
                                          >
                                              General Observation
                                          </label>
                                          <input
                                              type="text"
                                              id="obs-input"
                                              placeholder="Write an observation for the student..."
                                              value={obsInput}
                                              onChange={(e) => setObsInput(e.target.value)}
                                              style={{
                                                  width: '100%',
                                                  height: '40px',
                                                  padding: '0 12px',
                                                  border: '1px solid rgba(0,0,0,0.15)',
                                                  borderRadius: '8px',
                                                  fontSize: '15px',
                                                  boxSizing: 'border-box'
                                              }}
                                          />
                                      </div>
                                  </div>
                                  <div
                                      className="am-actions"
                                      id="edit-actions"
                                      style={{
                                          display: 'flex',
                                          justifyContent: 'flex-end',
                                          gap: '12px',
                                          margin: 0
                                      }}
                                  >
                                      <button
                                          type="button"
                                          className="am-btn-cancel"
                                          id="cancel-edit-btn"
                                          onClick={(e) => {
                                              e.stopPropagation();
                                              setEditOpen(false);
                                          }}
                                      >
                                          Cancel
                                      </button>
                                      <button
                                          type="button"
                                          className="am-btn-confirm"
                                          id="save-edit-btn"
                                          onClick={handleSaveTutorEdit}
                                      >
                                          Save
                                      </button>
                                  </div>
                              </div>
                          ) : null}

                          <div
                              className={`lb-cards-grid${
                                  role === 'advisor' ? ' lb-cards-grid--single' : ''
                              }`}
                          >
                              <div
                                  className="lb-card"
                                  id="lb-card-activities"
                                  role="button"
                                  tabIndex={0}
                                  onClick={handleEnterActivities}
                                  onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault();
                                          handleEnterActivities();
                                      }
                                  }}
                              >
                                  <div className="lb-card-top">
                                      <div className="lb-card-icon" aria-hidden="true">
                                          <i className="fa-regular fa-clipboard"></i>
                                      </div>
                                      <span
                                          className={
                                              activitiesBadges.loading
                                                  ? 'lb-card-pill is-skel-pill'
                                                  : 'lb-card-pill'
                                          }
                                          id="lb-hours-pill"
                                      >
                                          {activitiesBadges.hoursText}
                                      </span>
                                  </div>
                                  <div className="lb-card-body">
                                      <h3 className="lb-card-title">Activities</h3>
                                      <p className="lb-card-desc">
                                          Review assigned tasks and their delivery status.
                                      </p>
                                  </div>
                                  <div className="lb-card-bottom">
                                      <span
                                          className={
                                              activitiesBadges.loading
                                                  ? 'lb-card-pill is-skel-pill'
                                                  : activitiesBadges.isWarning
                                                  ? 'lb-card-pill lb-card-pill--warning'
                                                  : 'lb-card-pill lb-card-pill--uptodate'
                                          }
                                          id="lb-pending-pill"
                                      >
                                          {activitiesBadges.pendingText}
                                      </span>
                                      <button
                                          type="button"
                                          className="lb-action-btn"
                                          id={actBtnId}
                                          aria-label="Enter Activities"
                                          onClick={(e) => {
                                              e.stopPropagation();
                                              handleEnterActivities();
                                          }}
                                      >
                                          <i
                                              className="fa-solid fa-arrow-right"
                                              aria-hidden="true"
                                          ></i>
                                      </button>
                                  </div>
                              </div>

                              {role !== 'advisor' ? (
                                  <div
                                      className="lb-card"
                                      id="lb-card-questions"
                                      role="button"
                                      tabIndex={0}
                                      onClick={handleEnterQuestions}
                                      onKeyDown={(e) => {
                                          if (e.key === 'Enter' || e.key === ' ') {
                                              e.preventDefault();
                                              handleEnterQuestions();
                                          }
                                      }}
                                  >
                                      <div className="lb-card-top">
                                          <div className="lb-card-icon" aria-hidden="true">
                                              <i className="fa-regular fa-circle-question"></i>
                                          </div>
                                      </div>
                                      <div className="lb-card-body">
                                          <h3 className="lb-card-title">Questions Section</h3>
                                          <p className="lb-card-desc">
                                              {role === 'director'
                                                  ? 'Review the questionnaire.'
                                                  : 'Review the questionnaire and your answers.'}
                                          </p>
                                      </div>
                                      <div className="lb-card-bottom">
                                          <span
                                              className={
                                                  questionsPill.loading
                                                      ? 'lb-card-pill is-skel-pill'
                                                      : questionsPill.isWarning
                                                      ? 'lb-card-pill lb-card-pill--warning'
                                                      : 'lb-card-pill lb-card-pill--uptodate'
                                              }
                                              id="lb-questions-pill"
                                          >
                                              {questionsPill.text}
                                          </span>
                                          <button
                                              type="button"
                                              className="lb-action-btn"
                                              id={qBtnId}
                                              aria-label="Enter Questions Section"
                                              onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleEnterQuestions();
                                              }}
                                          >
                                              <i
                                                  className="fa-solid fa-arrow-right"
                                                  aria-hidden="true"
                                              ></i>
                                          </button>
                                      </div>
                                  </div>
                              ) : null}
                          </div>
                      </>,
                      logbookPanelEl
                  )
                : null}

            {credStudent && typeof document !== 'undefined'
                ? createPortal(
                      <div
                          id="lb-modal-credential"
                          className="modal-overlay"
                          style={{ display: 'flex' }}
                          onClick={(e) => {
                              if (e.target === e.currentTarget) setCredStudent(null);
                          }}
                      >
                          <div className="um-modal-card">
                              <div id="lb-modal-credential-body">
                                  <article className="lb-cred">
                                      <header className="lb-cred-top">
                                          <div className="lb-cred-brand">
                                              <i
                                                  className="fa-solid fa-shield-halved"
                                                  aria-hidden="true"
                                              ></i>
                                              <p>
                                                  University
                                                  <br />
                                                  credential <em>{new Date().getFullYear()}</em>
                                              </p>
                                          </div>
                                          <span
                                              className={`lb-cred-state lb-cred-state--${
                                                  credStudent.status || 'active'
                                              }`}
                                          >
                                              {String(credStudent.status || 'active').toUpperCase()}
                                          </span>
                                      </header>
                                      <div className="lb-cred-body">
                                          <h3 className="lb-cred-name">{credStudent.fullName}</h3>
                                          <p className="lb-cred-doc">
                                              {`${credStudent.documentType || '-'}  •  ${
                                                  credStudent.documentNumber || '—'
                                              }`}
                                          </p>
                                          <span className="lb-cred-role">
                                              <i
                                                  className="fa-solid fa-user-graduate"
                                                  aria-hidden="true"
                                              ></i>
                                              Student
                                          </span>
                                          <dl className="lb-cred-meta">
                                              <div>
                                                  <dt>Academic program</dt>
                                                  <dd>{credStudent.program || 'Unassigned'}</dd>
                                              </div>
                                              <div>
                                                  <dt>Email</dt>
                                                  <dd className="is-mono">
                                                      {credStudent.email || 'user@university.edu'}
                                                  </dd>
                                              </div>
                                          </dl>
                                      </div>
                                  </article>
                                  <button
                                      type="button"
                                      className="lb-modal-close"
                                      onClick={() => setCredStudent(null)}
                                  >
                                      Close
                                  </button>
                              </div>
                          </div>
                      </div>,
                      document.body
                  )
                : null}
        </>
    );
}
