/* =========================================================================
   ui.js — Utilidades de interfaz compartidas (Core SPP / Evaluaciones).
   Todo el contenido dinámico se inserta con textContent (nunca innerHTML), así
   que lo que escriban estudiantes, tutores o la IA no puede inyectar HTML.
   ========================================================================= */

/** h('div', {class:'x', onclick:fn, 'data-id':3}, 'texto', nodoHijo, [..]) */
export function h(tag, props, ...children) {
    if (typeof document === 'undefined') return null;
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'value') el.value = v;
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
    }
    const add = (c) => {
        if (c === null || c === undefined || c === false) return;
        if (Array.isArray(c)) return c.forEach(add);
        el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    };
    children.forEach(add);
    return el;
}

export const icon = (cls) => h('i', { class: cls, 'aria-hidden': 'true' });
export const add = (el, ...nodos) => { nodos.flat().forEach((n) => { if (n !== null && n !== undefined && n !== false && el) el.append(n); }); return el; };
export const clear = (el) => { if (!el) return el; while (el.firstChild) el.removeChild(el.firstChild); return el; };
export const $ = (sel, root) => ((root || (typeof document !== 'undefined' ? document : null))?.querySelector(sel));
export const $$ = (sel, root) => Array.from((root || (typeof document !== 'undefined' ? document : null))?.querySelectorAll(sel) || []);

/* ---------- formato ---------- */
export const fecha = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
        d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};
export const nota = (n) => (n === null || n === undefined) ? '—' : Number(n).toFixed(2);
export const num = (n) => (n === null || n === undefined) ? '' : String(Number(n));
export const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/* ---------- toasts ---------- */
export function toast(mensaje, tipo) {
    if (typeof document === 'undefined') return;
    let cont = document.getElementById('ev-toasts');
    if (!cont) { cont = h('div', { id: 'ev-toasts', 'aria-live': 'polite' }); document.body.appendChild(cont); }
    const t = h('div', { class: 'ev-toast ev-toast--' + (tipo || 'ok'), role: 'status' },
        icon(tipo === 'error' ? 'fa-solid fa-circle-exclamation' : tipo === 'aviso' ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-circle-check'),
        h('span', {}, mensaje));
    cont.appendChild(t);
    setTimeout(() => { t.classList.add('is-out'); setTimeout(() => t.remove(), 300); }, tipo === 'error' ? 6500 : 3800);
}

/* ---------- modal ---------- */
export function modal({ titulo, contenido, ancho, onClose, cerrarAfuera = false }) {
    if (typeof document === 'undefined') return { el: null, close: () => {} };
    const prevFocus = document.activeElement;
    const cerrar = () => {
        overlay.remove();
        document.removeEventListener('keydown', onKey);
        if (prevFocus && prevFocus.focus) prevFocus.focus();
        if (onClose) onClose();
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); cerrar(); } };
    const caja = h('div', { class: 'ev-modal', role: 'dialog', 'aria-modal': 'true', style: ancho ? `max-width:${ancho}px` : null },
        h('button', { type: 'button', class: 'ev-modal-close', 'aria-label': 'Close', onclick: cerrar }, icon('fa-solid fa-xmark')),
        h('h3', { class: 'ev-modal-title' }, titulo),
        contenido);
    const overlay = h('div', { class: 'ev-modal-overlay' }, caja);
    overlay.addEventListener('mousedown', (e) => {
        if (e.target === overlay) {
            if (cerrarAfuera) {
                cerrar();
            } else {
                caja.classList.remove('ev-modal--shake');
                void caja.offsetWidth;
                caja.classList.add('ev-modal--shake');
            }
        }
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    const first = caja.querySelector('input,textarea,select,button:not(.ev-modal-close)');
    if (first) setTimeout(() => first.focus(), 30);
    return { el: caja, close: cerrar };
}

export function confirmar({ titulo, mensaje, ok, peligro }) {
    return new Promise((resolve) => {
        let resuelto = false;
        const fin = (v) => { if (!resuelto) { resuelto = true; resolve(v); } };
        const m = modal({
            titulo: titulo || 'Confirm?', ancho: 460, onClose: () => fin(false),
            contenido: h('div', {},
                h('p', { class: 'ev-confirm-text' }, mensaje),
                h('div', { class: 'ev-actions' },
                    h('button', { type: 'button', class: 'ev-btn ev-btn--soft', onclick: () => { fin(false); m.close(); } }, 'Cancel'),
                    h('button', { type: 'button', class: 'ev-btn ' + (peligro ? 'ev-btn--danger' : 'ev-btn--dark'), onclick: () => { fin(true); m.close(); } }, ok || 'Confirm'))),
        });
    });
}

/* ---------- botón ocupado ---------- */
export async function ocupado(btn, fn, textoOcupado) {
    if (!btn || btn.disabled) return;
    const html = Array.from(btn.childNodes);
    btn.disabled = true;
    btn.classList.add('is-busy');
    if (typeof document !== 'undefined') document.body.classList.add('is-loading-wait');
    if (textoOcupado) { clear(btn); btn.append(icon('fa-solid fa-spinner fa-spin'), ' ' + textoOcupado); }
    try { return await fn(); }
    finally {
        btn.disabled = false; btn.classList.remove('is-busy');
        if (typeof document !== 'undefined') document.body.classList.remove('is-loading-wait');
        if (textoOcupado) { clear(btn); html.forEach((n) => btn.appendChild(n)); }
    }
}

export const error = (e) => toast((e && e.message) || 'An unexpected error occurred.', 'error');

/* ---------- insignias ---------- */
export const ESTADOS = {
    BORRADOR: ['Draft', 'fa-regular fa-pen-to-square'], PUBLICADA: ['Published', 'fa-solid fa-circle-check'],
    CERRADA: ['Closed', 'fa-solid fa-lock'], EN_CURSO: ['In progress', 'fa-solid fa-hourglass-half'],
    ENVIADO: ['Pending review', 'fa-regular fa-clock'], CALIFICADO: ['Graded', 'fa-solid fa-circle-check'],
    APROBADA: ['Approved', 'fa-solid fa-check'], RECHAZADA: ['Rejected', 'fa-solid fa-ban'],
    VENCIDA: ['Deadline passed', 'fa-regular fa-calendar-xmark'],
};
export const badge = (estado, textoPropio) => {
    const [t, ic] = ESTADOS[estado] || [estado, 'fa-solid fa-circle'];
    return h('span', { class: 'ev-badge ev-badge--' + String(estado).toLowerCase() }, icon(ic), textoPropio || t);
};
export const badgeOrigen = (origen) => origen === 'IA'
    ? h('span', { class: 'ev-badge ev-badge--ia' }, icon('fa-solid fa-wand-magic-sparkles'), 'AI')
    : h('span', { class: 'ev-badge ev-badge--manual' }, icon('fa-solid fa-pen'), 'Manual');
export const TIPOS = { OPCION_MULTIPLE: 'Multiple choice', VERDADERO_FALSO: 'True / False', ABIERTA: 'Open' };

/* ---------- navegación de la carcasa ---------- */
export function habilitarEnlacesExternos() {
    if (typeof document === 'undefined') return;
    const nav = document.querySelector('.app-navigation');
    if (!nav) return;
    nav.addEventListener('click', (e) => {
        const a = e.target.closest('a[data-external], a[data-externo]');
        if (a) e.stopPropagation();
    }, true);
    const activo = document.querySelector('.app-nav-link[data-active], .app-nav-link[data-activo]');
    if (activo) { activo.classList.add('app-nav-link--active'); activo.setAttribute('aria-current', 'page'); }
}

export function banner(texto, icono, clase) {
    if (typeof document === 'undefined') return;
    const cont = document.getElementById('ev-banner');
    if (!cont) return;
    cont.appendChild(h('div', { class: 'ev-banner ' + (clase || '') }, icon(icono || 'fa-solid fa-circle-info'), h('span', {}, texto)));
}

export const UI = {
    h, icon, add, clear, $, $$, fecha, nota, num, plural, toast, modal, confirmar, ocupado, error,
    ESTADOS, badge, badgeOrigen, TIPOS, habilitarEnlacesExternos, banner
};

export default UI;
