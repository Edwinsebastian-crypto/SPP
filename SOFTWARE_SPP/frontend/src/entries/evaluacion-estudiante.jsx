import '../core/api.js';
import '../core/shell.js';
import '../core/panels.js';
import '../core/ui.js';
import React from 'react';
import { createRoot } from 'react-dom/client';
import StudentEvaluationApp from '../components/student/StudentEvaluationApp';
import { mountActivities } from './activities-mount';
import { mountPanelCommon } from './panel-common-mount';

function mountStudentEvaluation() {
    mountPanelCommon('student');
    mountActivities('student');

    const wrapper =
        document.querySelector('#questions-panel .ev-wrapper') ||
        document.querySelector('.ev-wrapper');
    if (!wrapper) return;
    wrapper.innerHTML = '';
    const root = createRoot(wrapper);
    root.render(<StudentEvaluationApp />);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountStudentEvaluation);
} else {
    mountStudentEvaluation();
}
