import '../core/api.js';
import '../core/shell.js';
import { init as initCustomSelect } from '../core/custom-select.js';
import { wireTabs } from '../core/panels.js';
import '../core/modals.js';
import '../core/ui.js';
import '../core/export.js';
import '../core/reports-kit.js';
import React from 'react';
import { createRoot } from 'react-dom/client';
import DirectorPracticeEvaluationsApp from '../components/director/DirectorPracticeEvaluationsApp';
import DirectorEvaluationsDashboardApp from '../components/director/DirectorEvaluationsDashboardApp';
import CreatePracticeApp from '../components/director/CreatePracticeApp';
import PracticeTypesApp from '../components/director/PracticeTypesApp';
import InstitutionsApp from '../components/director/InstitutionsApp';
import ManageUsersApp from '../components/director/ManageUsersApp';
import AccreditationApp from '../components/reports/AccreditationApp';
import ReportsDashboardApp from '../components/reports/ReportsDashboardApp';
import { mountActivities } from './activities-mount';
import { mountPanelCommon } from './panel-common-mount';
import { habilitarEnlacesExternos } from '../utils/evalBridge';
import { inject } from '../core/registry';

function wireDirectorReportsTabs() {
    habilitarEnlacesExternos();

    const reportButtons = Array.from(document.querySelectorAll('#reports .reports-tab-btn'));
    const reportPanelIds = [
        'tab-general',
        'tab-types',
        'tab-practice',
        'tab-feedback',
        'tab-institutions',
        'tab-evaluations'
    ];
    const reportPanels = reportPanelIds.map((id) => document.getElementById(id)).filter(Boolean);

    wireTabs(
        reportButtons,
        reportPanels,
        (_button, index) => reportPanelIds[index]
    );

    const btnEvalTab = document.getElementById('btn-evaluations-tab');
    if (btnEvalTab) {
        btnEvalTab.addEventListener('click', () => {
            const evalDashboard = inject('directorEvaluations');
            if (evalDashboard && typeof evalDashboard.cargarEvaluaciones === 'function') {
                const cont = document.getElementById('panel-contenido');
                if (cont && (cont.children.length === 0 || cont.querySelector('.ev-loading'))) {
                    evalDashboard.cargarEvaluaciones();
                } else {
                    initCustomSelect('#dv-lista');
                }
            }
        });
    }

    reportButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            if (btn !== btnEvalTab) {
                const vPanel = document.getElementById('view-panel');
                const vDetalle = document.getElementById('view-detalle');
                if (vPanel) vPanel.hidden = false;
                if (vDetalle) vDetalle.hidden = true;
            }
        });
    });
}

function mountDirectorAndReports() {
    // 0. Common Panel Apps: Profile/Notifications, Practice/Logbook, Home
    mountPanelCommon('director');

    // 0.1 Director Activities & Evidences read-only panel (#activities-panel & #evidences-panel)
    mountActivities('director');

    // 0.2 Create Practice (#create-practice .practice-content-wrapper)
    const createPracticeWrapper = document.querySelector(
        '#create-practice .practice-content-wrapper'
    );
    if (createPracticeWrapper && !createPracticeWrapper.dataset.reactMounted) {
        createPracticeWrapper.dataset.reactMounted = 'true';
        createPracticeWrapper.innerHTML = '';
        createRoot(createPracticeWrapper).render(<CreatePracticeApp />);
    }

    // 0.3 Manage Users (#manage-users .practice-content-wrapper)
    const manageUsersWrapper = document.querySelector('#manage-users .practice-content-wrapper');
    if (manageUsersWrapper && !manageUsersWrapper.dataset.reactMounted) {
        manageUsersWrapper.dataset.reactMounted = 'true';
        manageUsersWrapper.innerHTML = '';
        createRoot(manageUsersWrapper).render(<ManageUsersApp />);
    }

    // 0.4 Manage Practice Types (#manage-practices .practice-content-wrapper)
    const managePracticesWrapper = document.querySelector(
        '#manage-practices .practice-content-wrapper'
    );
    if (managePracticesWrapper && !managePracticesWrapper.dataset.reactMounted) {
        managePracticesWrapper.dataset.reactMounted = 'true';
        managePracticesWrapper.innerHTML = '';
        createRoot(managePracticesWrapper).render(<PracticeTypesApp />);
    }

    // 0.5 Manage Institutions (#manage-institutions .practice-content-wrapper)
    const manageInstitutionsWrapper = document.querySelector(
        '#manage-institutions .practice-content-wrapper'
    );
    if (manageInstitutionsWrapper && !manageInstitutionsWrapper.dataset.reactMounted) {
        manageInstitutionsWrapper.dataset.reactMounted = 'true';
        manageInstitutionsWrapper.innerHTML = '';
        createRoot(manageInstitutionsWrapper).render(<InstitutionsApp />);
    }

    // 0.6 Wire Reports section tabs
    wireDirectorReportsTabs();

    // 1. Practice Evaluations & Questions read-only panel (#questions-panel .ev-wrapper)
    const practiceEvalContainer = document.querySelector('#questions-panel .ev-wrapper');
    if (practiceEvalContainer && !practiceEvalContainer.dataset.reactMounted) {
        practiceEvalContainer.dataset.reactMounted = 'true';
        createRoot(practiceEvalContainer).render(<DirectorPracticeEvaluationsApp />);
    }

    // 2. Director Evaluations Dashboard (#tab-evaluations .ev-wrapper.dv-wrapper)
    const evalDashboardContainer = document.querySelector(
        '#tab-evaluations .ev-wrapper.dv-wrapper'
    );
    if (evalDashboardContainer && !evalDashboardContainer.dataset.reactMounted) {
        evalDashboardContainer.dataset.reactMounted = 'true';
        createRoot(evalDashboardContainer).render(<DirectorEvaluationsDashboardApp />);
    }

    // 3. Accreditation Indicators (#rep-accreditation-toolbar)
    const accreditationContainer = document.getElementById('rep-accreditation-toolbar');
    if (accreditationContainer && !accreditationContainer.dataset.reactMounted) {
        accreditationContainer.dataset.reactMounted = 'true';
        createRoot(accreditationContainer).render(<AccreditationApp />);
    }

    // 4. Reports & Statistics Dashboard (Portals into #rp-*-header and #rp-*)
    const reportsView =
        document.getElementById('reports') || document.getElementById('rp-general');
    if (reportsView && !reportsView.dataset.reactReportsMounted) {
        reportsView.dataset.reactReportsMounted = 'true';
        const host = document.createElement('div');
        host.id = 'react-reports-portal-host';
        host.style.display = 'none';
        reportsView.appendChild(host);
        createRoot(host).render(<ReportsDashboardApp />);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountDirectorAndReports);
} else {
    mountDirectorAndReports();
}
