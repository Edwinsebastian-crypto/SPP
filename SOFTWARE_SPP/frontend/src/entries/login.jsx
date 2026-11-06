import '../core/api.js';
import React from 'react';
import { createRoot } from 'react-dom/client';
import LoginApp from '../components/auth/LoginApp';

function mountLogin() {
    const container = document.querySelector('.login-container');
    if (!container || container.dataset.reactMounted === 'true') return;
    container.dataset.reactMounted = 'true';
    container.innerHTML = '';
    createRoot(container).render(<LoginApp />);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountLogin);
} else {
    mountLogin();
}
