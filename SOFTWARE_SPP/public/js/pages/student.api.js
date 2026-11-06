/* =========================================================================
   student.api.js — Connects the STUDENT panel with the API (/api).
   student.js takes care of the navigation between panels; Activities & Evidences
   are managed by React (ActivitiesAndEvidencesApp).
   ========================================================================= */
document.addEventListener('DOMContentLoaded', async () => {
    const STATUS_COLORS = { active: '#265c48', completed: '#6b7280', cancelled: '#b3261e' };
    const $ = (selector, root) => (root || document).querySelector(selector);
    const setField = (id, value) => {
        const el = document.getElementById(id);
        if (!el) return;
        const text = value == null || value === '' ? '—' : value;
        if ('value' in el && el.tagName !== 'DIV') { el.value = value == null ? '' : value; el.readOnly = true; }
        else el.textContent = text;
    };

    let practice;

    // ---------- 1) Practice and logbook ----------
    try {
        const { practices } = await SPP.get('/api/practices');
        practice = practices.find((p) => p.status === 'active') || practices[0] || null;
    } catch (e) { SPP.showError(e); return; }

    const enterButton = $('.practice-submit');
    if (!practice) {
        if (enterButton) { enterButton.disabled = true; enterButton.title = 'You do not have an assigned practice yet'; }
        const heading = $('#practice-title');
        if (heading) heading.textContent = 'Practice Information — you do not have an assigned practice yet';
        const pPanel = $('.practice-panel');
        if (pPanel) pPanel.classList.remove('is-loading');
        return;
    }

    setField('practice-name', practice.name);
    setField('tutor', practice.tutor);
    setField('hours', practice.hours);
    setField('institution', practice.institution);
    setField('advisor', practice.advisor);
    setField('semester', practice.semester);
    setField('start-date', SPP.formatDate(practice.startDate));
    setField('end-date', SPP.formatDate(practice.endDate));
    setField('code', practice.code);

    const badge = $('.status-badge');
    if (badge) {
        badge.textContent = practice.status;
        badge.title = practice.status;
        badge.style.backgroundColor = STATUS_COLORS[practice.status] || '';
    }
    const pPanel = $('.practice-panel');
    if (pPanel) pPanel.classList.remove('is-loading');

    // Logbook card: [Final Grade, General Observation] hero banner & cards
    function updateLogbookHero(logbook) {
        const lb = logbook || {};
        const scoreValEl = $('#lb-score-val');
        const scoreTitleEl = $('#lb-grade-title');
        const ringFillEl = $('#lb-ring-fill');
        const obsTextEl = $('#lb-obs-text');

        const rawGrade = lb.finalGrade;
        const gradeNum = rawGrade != null && rawGrade !== '' ? parseFloat(rawGrade) : null;
        const hasGrade = gradeNum !== null && !isNaN(gradeNum);

        if (scoreValEl) scoreValEl.textContent = hasGrade ? gradeNum.toFixed(1) : '—';

        let gradeTitle;
        if (!hasGrade) gradeTitle = '—';
        else if (gradeNum >= 4.5) gradeTitle = 'Excellent';
        else if (gradeNum >= 4.0) gradeTitle = 'Outstanding';
        else if (gradeNum >= 3.0) gradeTitle = 'Passed';
        else if (gradeNum > 0) gradeTitle = 'Failed';
        else gradeTitle = '—';

        if (scoreTitleEl) scoreTitleEl.textContent = gradeTitle;

        if (ringFillEl) {
            const circumference = 226.2;
            const pct = hasGrade ? Math.max(0, Math.min(1, gradeNum / 5.0)) : 0;
            ringFillEl.style.strokeDasharray = `${circumference}`;
            ringFillEl.style.strokeDashoffset = `${circumference * (1 - pct)}`;
        }

        if (obsTextEl) {
            const obsText = lb.generalObservation && lb.generalObservation.trim()
                ? lb.generalObservation.trim()
                : '—';
            obsTextEl.textContent = obsText;
            obsTextEl.title = obsText;
        }
        const heroBanner = document.getElementById('lb-hero-banner');
        if (heroBanner) heroBanner.classList.remove('is-loading');
    }

    updateLogbookHero(practice.logbook);

    // Bind cards to trigger navigation buttons when whole card is clicked
    const cardActivities = document.getElementById('lb-card-activities');
    const actBtn = document.getElementById('activities-btn');
    if (cardActivities && actBtn) {
        cardActivities.addEventListener('click', (e) => {
            if (!e.target.closest('#activities-btn')) actBtn.click();
        });
        cardActivities.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                actBtn.click();
            }
        });
    }

    const cardQuestions = document.getElementById('lb-card-questions');
    const qBtn = document.getElementById('questions-btn');
    if (cardQuestions && qBtn) {
        cardQuestions.addEventListener('click', (e) => {
            if (!e.target.closest('#questions-btn') && !e.target.closest('.lb-action-btn')) qBtn.click();
        });
        cardQuestions.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                qBtn.click();
            }
        });
    }

    if (qBtn && !qBtn.dataset.studentBound) {
        qBtn.addEventListener('click', () => {
            const panelLogbook = document.getElementById('logbook-panel');
            const questionsPanel = document.getElementById('questions-panel');
            if (panelLogbook) panelLogbook.style.display = 'none';
            if (questionsPanel) questionsPanel.style.display = 'flex';
            window.scrollTo(0, 0);
            if (window.SPP_EVAL_ESTUDIANTE && typeof window.SPP_EVAL_ESTUDIANTE.abrir === 'function') {
                window.SPP_EVAL_ESTUDIANTE.abrir();
            }
        });
        qBtn.dataset.studentBound = 'true';
    }

    async function updateStudentQuestionsPill() {
        const qPill = document.getElementById('lb-questions-pill');
        if (!qPill) return;

        const setPill = (text, isWarning) => {
            qPill.textContent = text;
            qPill.className = isWarning ? 'lb-card-pill lb-card-pill--warning' : 'lb-card-pill lb-card-pill--uptodate';
        };

        try {
            const evalApi = window.EvalAPI || SPP.EvalAPI;
            if (!evalApi || !evalApi.estudiante || typeof evalApi.estudiante.misEvaluaciones !== 'function') {
                setPill('Up to date', false);
                return;
            }

            const lista = await evalApi.estudiante.misEvaluaciones();
            if (!Array.isArray(lista) || lista.length === 0) {
                setPill('Up to date', false);
                return;
            }

            let pendingCount = 0;
            let pendingEvaluations = 0;
            for (const ev of lista) {
                if (ev.estado !== 'PUBLICADA') continue;

                let isPending = false;
                if (ev.id_intento_abierto) {
                    try {
                        const intento = await evalApi.estudiante.verIntento(ev.id_intento_abierto);
                        const preguntas = intento?.preguntas || [];
                        const respuestas = intento?.respuestas || [];
                        const unanswered = preguntas.filter((p) => {
                            const r = respuestas.find((x) => x.id_pregunta === p.id_pregunta);
                            if (!r) return true;
                            if (p.tipo_pregunta === 'ABIERTA') {
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
                } else if (ev.puede_intentar && (!ev.intentos_usados || ev.intentos_usados === 0)) {
                    pendingCount += Number(ev.total_preguntas) || 0;
                    isPending = true;
                } else if (ev.puede_intentar && ev.ultimo_intento_estado !== 'ENVIADO' && ev.ultimo_intento_estado !== 'CALIFICADO') {
                    pendingCount += Number(ev.total_preguntas) || 0;
                    isPending = true;
                }

                if (isPending) pendingEvaluations++;
            }

            if (pendingCount > 0) {
                setPill(`${pendingCount} ${pendingCount === 1 ? 'question' : 'questions'}`, true);
            } else if (pendingEvaluations > 0) {
                setPill(`${pendingEvaluations} ${pendingEvaluations === 1 ? 'evaluation' : 'evaluations'}`, true);
            } else {
                setPill('Up to date', false);
            }
        } catch (_) {
            setPill('Up to date', false);
        }
    }
    window.updateStudentQuestionsPill = updateStudentQuestionsPill;

    const questionsBackBtn = document.getElementById('questionsBack');
    if (questionsBackBtn && !questionsBackBtn.dataset.badgeRefreshBound) {
        questionsBackBtn.addEventListener('click', () => {
            updateStudentQuestionsPill();
        });
        questionsBackBtn.dataset.badgeRefreshBound = 'true';
    }

    // Notify React ActivitiesAndEvidencesApp about the selected student practice
    window.SPP_STUDENT_PRACTICE = practice;
    window.dispatchEvent(new CustomEvent('spp:student-practice', { detail: { practice } }));
    await updateStudentQuestionsPill();
});
