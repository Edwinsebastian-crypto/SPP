import '../core/api.js';
import '../core/shell.js';
import '../core/panels.js';
import '../core/custom-select.js';
import '../core/ui.js';
import React from 'react';
import { createRoot } from 'react-dom/client';
import TutorEvaluationApp from '../components/tutor/TutorEvaluationApp';
import { mountActivities } from './activities-mount';
import { mountPanelCommon } from './panel-common-mount';

function mountTutorEvaluation() {
    mountPanelCommon('tutor');
    mountActivities('tutor');

    const wrapper =
        document.querySelector('#questions-panel .ev-wrapper') ||
        document.querySelector('.ev-wrapper');
    if (!wrapper) return;
    wrapper.innerHTML = '';
    const root = createRoot(wrapper);
    root.render(<TutorEvaluationApp />);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountTutorEvaluation);
} else {
    mountTutorEvaluation();
}
