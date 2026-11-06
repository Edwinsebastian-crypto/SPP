/* =========================================================================
   tutor.js — Navigation specific to the TUTOR panel.
   The common flow (practice > logbook > activities > evidence > questions)
   lives in core/panels.js. Activities & Evidences are managed by React
   (ActivitiesAndEvidencesApp).
   ========================================================================= */
document.addEventListener('DOMContentLoaded', () => {
    SPP.panels.wireStandardFlow({ questions: 'tutor' });
    initTutorUI();
});

function initTutorUI() {
    const btnEntrar = document.querySelector('.practice-submit');
    const practicePanel = document.querySelector('.practice-panel');
    const practicaPanel = document.getElementById('logbook-panel');
    const logbookBackBtn = document.getElementById('logbookBack');

    const actividadesPanel = document.getElementById('activities-panel');
    const preguntasPanel = document.getElementById('questions-panel');
    const questionsBackBtn = document.getElementById('questionsBack');

    const practicaActionBtns = practicaPanel
        ? practicaPanel.querySelectorAll('.lb-action-btn')
        : [];
    const actividadesEntrarpractica = practicaActionBtns[0] || null;
    const preguntasBtn = practicaActionBtns[1] || null;

    function resetScroll() {
        window.scrollTo(0, 0);
        const appShell = document.querySelector('.app-shell');
        if (appShell) appShell.scrollTop = 0;
        const wrapper = document.querySelector('.practice-content-wrapper');
        if (wrapper) wrapper.scrollTop = 0;
    }

    // ── Entrar a Bitácora desde Práctica ──────────────────────────────────
    if (btnEntrar && practicePanel && practicaPanel) {
        btnEntrar.addEventListener('click', () => {
            practicePanel.style.display = 'none';
            practicaPanel.style.display = 'flex';
            resetScroll();
        });
    }

    // ── Volver a Práctica desde Bitácora ──────────────────────────────────
    if (logbookBackBtn && practicePanel && practicaPanel) {
        logbookBackBtn.addEventListener('click', () => {
            practicaPanel.style.display = 'none';
            practicePanel.style.display = 'block';
            resetScroll();
        });
    }

    // ── Edición de Nota y Observación en Bitácora ─────────────────────────
    const heroBanner = document.getElementById('lb-hero-banner');
    const editForm = document.getElementById('tutor-logbook-edit-form');
    const notaInput = document.getElementById('grade-input');
    const obsInput = document.getElementById('obs-input');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const saveEditBtn = document.getElementById('save-edit-btn');

    if (heroBanner && editForm && notaInput && obsInput) {
        heroBanner.addEventListener('click', () => {
            const practice = window.SPP_TEACHER?.state?.practice;
            const currentGrade = practice?.logbook?.finalGrade;
            const currentObs = practice?.logbook?.generalObservation;

            notaInput.value = (currentGrade != null && currentGrade !== '') ? currentGrade : '';
            obsInput.value = currentObs || '';

            editForm.style.display = 'block';
            notaInput.focus();
        });

        if (cancelEditBtn) {
            cancelEditBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                editForm.style.display = 'none';
            });
        }

        if (saveEditBtn) {
            saveEditBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const nuevaNota = notaInput.value.trim();
                const nuevaObs = obsInput.value.trim();
                const practice = window.SPP_TEACHER?.state?.practice;
                if (!practice) { alert('No practice selected'); return; }

                try {
                    await SPP.patch('/api/practices/' + practice.id + '/logbook', {
                        finalGrade: nuevaNota || null,
                        generalObservation: nuevaObs || null
                    });
                    if (!practice.logbook) practice.logbook = {};
                    practice.logbook.finalGrade = nuevaNota || null;
                    practice.logbook.generalObservation = nuevaObs || null;

                    if (window.SPP_TEACHER?.updateLogbookHero) {
                        window.SPP_TEACHER.updateLogbookHero(practice.logbook);
                    }

                    editForm.style.display = 'none';

                    const modal = document.getElementById('success-modal');
                    const titleEl = document.getElementById('success-modal-title');
                    const msgEl = document.getElementById('success-modal-message');
                    if (modal && titleEl && msgEl) {
                        titleEl.textContent = 'Success';
                        msgEl.textContent = 'Logbook updated successfully!';
                        modal.style.display = 'flex';
                    }
                    if (window.SPP_TEACHER?.reloadLogbook) {
                        await window.SPP_TEACHER.reloadLogbook();
                    }
                } catch (err) {
                    SPP.showError(err);
                }
            });
        }
    }

    // ── Entrar a Actividades desde Bitácora ───────────────────────────────
    if (actividadesEntrarpractica && practicaPanel && actividadesPanel) {
        actividadesEntrarpractica.addEventListener('click', () => {
            practicaPanel.style.display = 'none';
            actividadesPanel.style.display = 'flex';
            resetScroll();
        });
    }

    // ── Entrar a Preguntas desde Bitácora ─────────────────────────────────
    if (preguntasBtn && practicaPanel && preguntasPanel) {
        preguntasBtn.addEventListener('click', () => {
            practicaPanel.style.display = 'none';
            preguntasPanel.style.display = 'flex';
            resetScroll();
            if (window.SPP_EVAL_TUTOR && typeof window.SPP_EVAL_TUTOR.abrir === 'function') {
                window.SPP_EVAL_TUTOR.abrir();
            }
        });
    }

    const cardTutorQuestions = document.getElementById('lb-card-questions') || document.getElementById('lb-card-tutor-questions');
    if (cardTutorQuestions && preguntasBtn) {
        cardTutorQuestions.addEventListener('click', (e) => {
            if (!e.target.closest('#preguntas-preguntas-btn') && !e.target.closest('.lb-action-btn')) preguntasBtn.click();
        });
        cardTutorQuestions.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                preguntasBtn.click();
            }
        });
    }

    // ── Volver a Bitácora desde Preguntas ─────────────────────────────────
    if (questionsBackBtn && practicaPanel && preguntasPanel) {
        questionsBackBtn.addEventListener('click', () => {
            preguntasPanel.style.display = 'none';
            practicaPanel.style.display = 'flex';
            resetScroll();
        });
    }

    // ── Cerrar modal de éxito de Bitácora ─────────────────────────────────
    const successModal = document.getElementById('success-modal');
    const successCloseX = document.getElementById('successModalCloseX');
    const successAcceptBtn = document.getElementById('successModalAcceptBtn');
    const closeSuccessModal = () => {
        if (successModal) successModal.style.display = 'none';
    };
    if (successCloseX) successCloseX.addEventListener('click', closeSuccessModal);
    if (successAcceptBtn) successAcceptBtn.addEventListener('click', closeSuccessModal);
}
