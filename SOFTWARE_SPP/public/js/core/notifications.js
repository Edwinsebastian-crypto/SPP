/* =========================================================================
   notifications.js — The bell of the top bar (shared by ALL logged-in panels).
   Shows the unread counter and a dropdown with the user's own notifications.
   Load it AFTER api.js. Texts are always inserted with textContent (anti-XSS).
   ========================================================================= */
(function () {
    'use strict';
    if (!window.SPP) return;

    const POLL_MS = 60000;
    const state = { items: [], unread: 0, open: false, anchor: null, expandedId: null };
    let panel = null;
    let list = null;
    let markAllButton = null;

    const buttons = () => Array.prototype.slice.call(document.querySelectorAll('.topbar-icon[aria-label="Notifications"]'));

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    /** "hace 5 min", "hace 3 h", "hace 2 d" or a short date. */
    function timeAgo(value) {
        const date = new Date(value);
        if (isNaN(date.getTime())) return '';
        const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
        if (minutes < 1) return 'ahora';
        if (minutes < 60) return 'hace ' + minutes + ' min';
        if (minutes < 1440) return 'hace ' + Math.round(minutes / 60) + ' h';
        if (minutes < 10080) return 'hace ' + Math.round(minutes / 1440) + ' d';
        return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    /** First paragraph after the greeting, trimmed. */
    function preview(content) {
        const parts = String(content || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
        const body = (parts.length > 1 ? parts[1] : parts[0]) || '';
        const flat = body.replace(/\s*\n\s*/g, ' ');
        return flat.length > 140 ? flat.slice(0, 137) + '…' : flat;
    }

    function renderBadges() {
        buttons().forEach((button) => {
            let badge = button.querySelector('.bell-badge');
            if (!state.unread) { if (badge) badge.remove(); button.removeAttribute('data-unread'); return; }
            if (!badge) { badge = el('span', 'bell-badge'); button.appendChild(badge); }
            badge.textContent = state.unread > 99 ? '99+' : String(state.unread);
            button.setAttribute('data-unread', String(state.unread));
        });
    }

    function renderList() {
        if (!list) return;
        list.textContent = '';
        markAllButton.hidden = state.unread === 0;
        if (!state.items.length) {
            list.appendChild(el('p', 'bell-empty', 'No tienes notificaciones.'));
            return;
        }
        state.items.forEach((n) => {
            const expanded = state.expandedId === n.id;
            const item = el('button', 'bell-item' + (n.read ? '' : ' is-unread') + (expanded ? ' is-expanded' : ''));
            item.type = 'button';
            item.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            item.appendChild(el('span', 'bell-item-subject', n.subject));
            // collapsed: a short preview; expanded: the whole message (lists, dates, grades…)
            const body = expanded ? String(n.content || '') : preview(n.content);
            if (body) item.appendChild(el('span', expanded ? 'bell-item-full' : 'bell-item-body', body));
            item.appendChild(el('span', 'bell-item-time', timeAgo(n.createdAt)));
            item.addEventListener('click', () => {
                state.expandedId = expanded ? null : n.id;
                if (!n.read) markRead(n.id); else renderList();
            });
            list.appendChild(item);
        });
    }

    async function load() {
        try {
            const data = await SPP.request('/api/notifications', { skipRedirect: true });
            state.items = Array.isArray(data.notifications) ? data.notifications : [];
            state.unread = Number(data.unread) || 0;
            renderBadges();
            if (state.open) renderList();
        } catch (e) { /* the bell must never get in the way: try again on the next poll */ }
    }

    async function markRead(id) {
        const target = id ? state.items.find((n) => n.id === id) : null;
        if (id && (!target || target.read)) return;
        try {
            await SPP.request('/api/notifications/read', { method: 'POST', body: id ? { id } : {}, skipRedirect: true });
            state.items.forEach((n) => { if (!id || n.id === id) n.read = true; });
            state.unread = state.items.filter((n) => !n.read).length;
            renderBadges();
            renderList();
        } catch (e) { /* ignored */ }
    }

    function build() {
        panel = el('div', 'bell-panel');
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Notificaciones');
        panel.hidden = true;
        const head = el('div', 'bell-head');
        head.appendChild(el('strong', '', 'Notificaciones'));
        markAllButton = el('button', 'bell-markall', 'Marcar todas como leídas');
        markAllButton.type = 'button';
        markAllButton.addEventListener('click', () => markRead(null));
        head.appendChild(markAllButton);
        list = el('div', 'bell-list');
        panel.appendChild(head);
        panel.appendChild(list);
        document.body.appendChild(panel);
    }

    function place() {
        if (!state.anchor) return;
        const rect = state.anchor.getBoundingClientRect();
        const width = Math.min(380, window.innerWidth - 16);
        panel.style.width = width + 'px';
        panel.style.top = Math.round(rect.bottom + 6) + 'px';
        panel.style.left = Math.max(8, Math.min(window.innerWidth - width - 8, Math.round(rect.left + rect.width / 2 - width / 2))) + 'px';
    }

    function close() {
        state.open = false;
        if (panel) panel.hidden = true;
        buttons().forEach((b) => b.setAttribute('aria-expanded', 'false'));
    }

    function toggle(button) {
        if (state.open && state.anchor === button) { close(); return; }
        state.anchor = button;
        state.open = true;
        panel.hidden = false;
        buttons().forEach((b) => b.setAttribute('aria-expanded', b === button ? 'true' : 'false'));
        place();
        renderList();
        load();
    }

    function init() {
        const found = buttons();
        if (!found.length) return;
        build();
        found.forEach((button) => {
            button.setAttribute('aria-haspopup', 'dialog');
            button.setAttribute('aria-expanded', 'false');
            button.addEventListener('click', (event) => { event.stopPropagation(); toggle(button); });
        });
        document.addEventListener('click', (event) => {
            if (state.open && !panel.contains(event.target)) close();
        });
        document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && state.open) close(); });
        window.addEventListener('resize', () => { if (state.open) place(); });
        load();
        setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
