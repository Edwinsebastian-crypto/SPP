import React from 'react';
import { createRoot } from 'react-dom/client';
import ProfileAndNotificationsApp from '../components/common/ProfileAndNotificationsApp';
import HomeApp from '../components/home/HomeApp';
import PracticeAndLogbookApp from '../components/practice/PracticeAndLogbookApp';

export function mountPanelCommon(role) {
    // 1. Profile, Session & Notifications Bell
    if (!document.body.dataset.reactProfileNotificationsMounted) {
        document.body.dataset.reactProfileNotificationsMounted = 'true';
        const host = document.createElement('div');
        host.id = `react-profile-notifications-host-${role}`;
        host.style.display = 'none';
        document.body.appendChild(host);
        createRoot(host).render(<ProfileAndNotificationsApp />);
    }

    // 2. Practice & Logbook Panel + Student Credential Modal
    const practicePanel =
        document.querySelector('#practice .practice-panel') ||
        document.querySelector('.practice-panel');
    if (practicePanel && !practicePanel.dataset.reactPracticeMounted) {
        practicePanel.dataset.reactPracticeMounted = 'true';
        const host = document.createElement('div');
        host.id = `react-practice-logbook-host-${role}`;
        host.style.display = 'none';
        document.body.appendChild(host);
        createRoot(host).render(<PracticeAndLogbookApp role={role} />);
    }

    // 3. Home Dashboard (#home-root)
    const homeRoot = document.getElementById('home-root');
    if (homeRoot && !homeRoot.dataset.reactHomeMounted) {
        homeRoot.dataset.reactHomeMounted = 'true';
        homeRoot.innerHTML = '';
        createRoot(homeRoot).render(<HomeApp />);
    }
}
