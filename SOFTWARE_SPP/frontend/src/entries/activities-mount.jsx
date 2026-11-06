import React from 'react';
import { createRoot } from 'react-dom/client';
import ActivitiesAndEvidencesApp from '../components/activities/ActivitiesAndEvidencesApp';

export function mountActivities(role) {
    const activitiesPanel = document.getElementById('activities-panel');
    const evidencesPanel = document.getElementById('evidences-panel');
    if (!activitiesPanel || !evidencesPanel) return;
    if (activitiesPanel.dataset.reactActivitiesMounted === 'true') return;

    activitiesPanel.dataset.reactActivitiesMounted = 'true';
    evidencesPanel.dataset.reactActivitiesMounted = 'true';

    // Clear static HTML so React portal has full ownership and no duplicate event listeners remain
    activitiesPanel.innerHTML = '';
    evidencesPanel.innerHTML = '';

    const host = document.createElement('div');
    host.id = `react-activities-host-${role}`;
    host.style.display = 'none';
    document.body.appendChild(host);

    createRoot(host).render(<ActivitiesAndEvidencesApp role={role} />);
}
