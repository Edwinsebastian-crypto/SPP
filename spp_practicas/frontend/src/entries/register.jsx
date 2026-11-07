import '../core/api.js';
import '../core/custom-select.js';
import React from 'react';
import { createRoot } from 'react-dom/client';
import RegisterApp from '../components/auth/RegisterApp';

function mountRegister() {
    const container = document.getElementById('reg-root');
    if (!container || container.dataset.reactMounted === 'true') return;
    container.dataset.reactMounted = 'true';
    container.innerHTML = '';
    createRoot(container).render(<RegisterApp />);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountRegister);
} else {
    mountRegister();
}
