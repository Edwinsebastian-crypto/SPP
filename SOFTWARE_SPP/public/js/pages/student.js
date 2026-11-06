/* =========================================================================
   student.js — Navigation specific to the STUDENT panel.
   The common flow (practice > logbook > activities > evidence > questions)
   lives in core/panels.js; the data lives in student.api.js.
   Activities, Evidences & Modals are now rendered by React (ActivitiesAndEvidencesApp).
   ========================================================================= */
document.addEventListener('DOMContentLoaded', () => {
    SPP.panels.wireStandardFlow({ questions: 'student' });
});
