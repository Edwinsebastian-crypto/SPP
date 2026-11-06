/* =========================================================================
   teacher.api.js — Logic shared by the TUTOR and ADVISOR panels.
   Both see the practices assigned to them. Activities, Evidences and Feedback
   are rendered by React (ActivitiesAndEvidencesApp).
   Exposes window.SPP_TEACHER so tutor.js / React can coordinate state.
   ========================================================================= */
document.addEventListener('DOMContentLoaded', async () => {
    const STATUS_COLORS = { active: '#265c48', completed: '#6b7280', cancelled: '#b3261e' };
    const $ = (selector, root) => (root || document).querySelector(selector);
    const setField = (id, value) => {
        const el = document.getElementById(id);
        if (el) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
                el.value = value == null ? '' : value;
                el.readOnly = true;
            } else {
                el.textContent = value == null ? '' : value;
            }
        }
    };

    const state = { practices: [], practice: null, activities: [], activity: null, evidences: [] };
    window.SPP_TEACHER = { state, reloadLogbook: null };

    // ---------- practice selector ----------
    const practicePanel = $('.practice-panel');
    const practiceForm = $('.practice-form', practicePanel);
    const selectorBox = document.createElement('div');
    selectorBox.id = 'practice-selector-box';
    selectorBox.className = 'practice-field';
    selectorBox.style.marginBottom = '24px';
    selectorBox.innerHTML = '<label for="practice-selector">Assigned student</label>' +
        '<div class="cp-input-wrap">' +
        '<select id="practice-selector" aria-label="Assigned student" data-sheet-title="Assigned student"></select>' +
        '<i class="fa-solid fa-chevron-down right-icon" aria-hidden="true"></i>' +
        '</div>';
    practiceForm.insertAdjacentElement('beforebegin', selectorBox);
    SPP.customSelect.init('#practice-selector-box');
    const selector = $('#practice-selector', selectorBox);

    try {
        state.practices = (await SPP.get('/api/practices')).practices;
    } catch (e) { SPP.showError(e); return; }

    const enterButton = $('.practice-submit');
    if (!state.practices.length) {
        selector.innerHTML = '<option>You have no assigned practices</option>';
        selector.disabled = true;
        if (enterButton) enterButton.disabled = true;
        if (practicePanel) practicePanel.classList.remove('is-loading');
        SPP.customSelect.rebuild(selector);
        SPP.customSelect.sync(selector);
        return;
    }
    const previous = selector.value;
    selector.innerHTML = state.practices
        .map((p) => `<option value="${p.id}">${SPP.escapeHtml(p.student)} — ${SPP.escapeHtml(p.code)}</option>`).join('');

    if (previous && state.practices.some((p) => String(p.id) === previous)) {
        selector.value = previous;
    } else if (selector.options.length > 0) {
        selector.selectedIndex = 0;
    }

    SPP.customSelect.rebuild(selector);
    SPP.customSelect.sync(selector);

    let isUpdatingQuestionsPill = false;
    let questionsPillCache = { practiceId: null, timestamp: 0, text: '', isWarning: false };

    async function updateTeacherQuestionsPill(prefetchedEvaluations = null, force = false) {
        const qPill = document.getElementById('lb-questions-pill');
        if (!qPill) return;

        const setPill = (text, isWarning) => {
            qPill.textContent = text;
            qPill.className = isWarning ? 'lb-card-pill lb-card-pill--warning' : 'lb-card-pill lb-card-pill--uptodate';
        };

        if (!state.practice) {
            setPill('Up to date', false);
            return;
        }

        const practiceId = String(state.practice.id || state.practice.code || '');
        if (!practiceId) {
            setPill('Up to date', false);
            return;
        }

        const now = Date.now();
        if (!force && !prefetchedEvaluations && questionsPillCache.practiceId === practiceId && (now - questionsPillCache.timestamp < 10000)) {
            setPill(questionsPillCache.text, questionsPillCache.isWarning);
            return;
        }

        if (isUpdatingQuestionsPill && !prefetchedEvaluations) {
            return;
        }

        try {
            isUpdatingQuestionsPill = true;
            const evalApi = window.EvalAPI || (window.SPP && window.SPP.EvalAPI);
            if (!evalApi || !evalApi.tutor || typeof evalApi.tutor.listarEvaluaciones !== 'function') {
                setPill('Up to date', false);
                return;
            }

            const evs = Array.isArray(prefetchedEvaluations)
                ? prefetchedEvaluations
                : await evalApi.tutor.listarEvaluaciones({ id_practica: practiceId });

            if (!Array.isArray(evs) || evs.length === 0) {
                setPill('Up to date', false);
                questionsPillCache = { practiceId, timestamp: Date.now(), text: 'Up to date', isWarning: false };
                return;
            }

            const draftsCount = evs.filter((ev) => ev.estado === 'BORRADOR').length;

            let toGradeCount = 0;
            const evsWithAttempts = evs.filter((ev) => Number(ev.intentos_presentados) > 0);

            if (evsWithAttempts.length > 0) {
                await Promise.all(evsWithAttempts.map(async (ev) => {
                    try {
                        const intentos = await evalApi.tutor.listarIntentos(ev.id_evaluacion);
                        if (Array.isArray(intentos)) {
                            const pendingAttempts = intentos.filter(
                                (i) => i.estado === 'ENVIADO' || Number(i.respuestas_pendientes) > 0
                            );
                            toGradeCount += pendingAttempts.length;
                        }
                    } catch (_) {
                        // ignore failed attempt fetch
                    }
                }));
            }

            let text = 'Up to date';
            let isWarning = false;
            if (draftsCount > 0 && toGradeCount > 0) {
                const draftText = `${draftsCount} ${draftsCount === 1 ? 'draft' : 'drafts'}`;
                text = `${draftText}, ${toGradeCount} to grade`;
                isWarning = true;
            } else if (draftsCount > 0) {
                text = `${draftsCount} ${draftsCount === 1 ? 'draft' : 'drafts'}`;
                isWarning = true;
            } else if (toGradeCount > 0) {
                text = `${toGradeCount} to grade`;
                isWarning = true;
            }

            setPill(text, isWarning);
            questionsPillCache = { practiceId, timestamp: Date.now(), text, isWarning };
        } catch (_) {
            setPill('Up to date', false);
        } finally {
            isUpdatingQuestionsPill = false;
        }
    }
    window.SPP_TEACHER.updateQuestionsPill = updateTeacherQuestionsPill;

    // ---------- fill in practice + logbook ----------
    async function selectPractice(id) {
        const practice = state.practices.find((p) => String(p.id) === String(id));
        if (!practice) return;
        const isSwitching = state.practice && String(state.practice.id) !== String(practice.id);
        state.practice = practice;
        if (isSwitching) {
            ['lb-hours-pill', 'lb-pending-pill', 'lb-questions-pill'].forEach((pid) => {
                const el = document.getElementById(pid);
                if (el) el.classList.add('is-skel-pill');
            });
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
        if (practicePanel) practicePanel.classList.remove('is-loading');

        renderLogbook();
        window.SPP_CURRENT_STUDENT = {
            fullName: practice.student,
            documentType: practice.studentDetails?.documentType,
            documentNumber: practice.studentDocument,
            status: practice.studentDetails?.status,
            program: practice.studentDetails?.program,
            email: practice.studentDetails?.email
        };
        const studentName = $('.lb-student-name');
        if (studentName) studentName.textContent = '- ' + practice.student;

        document.dispatchEvent(new CustomEvent('spp:practice', { detail: practice }));
        await updateTeacherQuestionsPill();
    }

    // Bind cards to trigger navigation buttons when whole card is clicked
    const cardActivities = document.getElementById('lb-card-activities');
    const actBtn = document.getElementById('preguntas-actividades-btn') || document.getElementById('activities-btn');
    if (cardActivities && actBtn) {
        cardActivities.addEventListener('click', (e) => {
            if (!e.target.closest('#preguntas-actividades-btn') && !e.target.closest('#activities-btn')) actBtn.click();
        });
        cardActivities.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                actBtn.click();
            }
        });
    }

    const cardQuestions = document.getElementById('lb-card-questions');
    const qBtn = document.getElementById('preguntas-preguntas-btn');
    if (cardQuestions && qBtn) {
        cardQuestions.addEventListener('click', (e) => {
            if (!e.target.closest('#preguntas-preguntas-btn') && !e.target.closest('.lb-action-btn')) qBtn.click();
        });
        cardQuestions.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                qBtn.click();
            }
        });
    }

    if (qBtn && !qBtn.dataset.tutorBound) {
        qBtn.addEventListener('click', () => {
            const panelLogbook = document.getElementById('logbook-panel');
            const questionsPanel = document.getElementById('questions-panel');
            if (panelLogbook) panelLogbook.style.display = 'none';
            if (questionsPanel) questionsPanel.style.display = 'flex';
            window.scrollTo(0, 0);
            if (window.SPP_EVAL_TUTOR && typeof window.SPP_EVAL_TUTOR.abrir === 'function') {
                window.SPP_EVAL_TUTOR.abrir();
            }
        });
        qBtn.dataset.tutorBound = 'true';
    }

    function updateLogbookHero(logbook) {
        const lb = logbook || {};
        const scoreValEl = document.getElementById('lb-score-val');
        const scoreTitleEl = document.getElementById('lb-grade-title');
        const ringFillEl = document.getElementById('lb-ring-fill');
        const obsTextEl = document.getElementById('lb-obs-text');

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

        const notaDisplay = document.getElementById('grade-display');
        if (notaDisplay) notaDisplay.textContent = hasGrade ? gradeNum.toFixed(1) : '—';
        const obsDisplay = document.getElementById('obs-display');
        if (obsDisplay) {
            obsDisplay.textContent = lb.generalObservation || '—';
            obsDisplay.dataset.fullObs = lb.generalObservation || '';
        }
        const heroBanner = document.getElementById('lb-hero-banner');
        if (heroBanner) heroBanner.classList.remove('is-loading');
    }
    window.SPP_TEACHER.updateLogbookHero = updateLogbookHero;

    function renderLogbook() {
        if (!state.practice || !state.practice.logbook) return;
        updateLogbookHero(state.practice.logbook);
    }

    window.addEventListener('resize', () => {
        if (state.practice && state.practice.logbook) {
            renderLogbook();
        }
    });
    window.SPP_TEACHER.reloadLogbook = async () => {
        const fresh = (await SPP.get(`/api/practices/${state.practice.id}`)).practice;
        const index = state.practices.findIndex((p) => p.id === fresh.id);
        state.practices[index] = fresh;
        state.practice = fresh;
        renderLogbook();
    };

    selector.addEventListener('change', () => selectPractice(selector.value));

    await selectPractice(selector.value);
});
