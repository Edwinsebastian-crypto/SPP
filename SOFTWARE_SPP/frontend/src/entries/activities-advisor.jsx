import { mountActivities } from './activities-mount';
import { mountPanelCommon } from './panel-common-mount';

function initAdvisorActivities() {
    mountPanelCommon('advisor');
    mountActivities('advisor');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdvisorActivities);
} else {
    initAdvisorActivities();
}
