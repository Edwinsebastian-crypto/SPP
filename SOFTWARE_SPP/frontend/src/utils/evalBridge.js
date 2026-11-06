export const ESTADOS = {
    BORRADOR: ['Draft', 'fa-regular fa-pen-to-square'],
    PUBLICADA: ['Published', 'fa-solid fa-circle-check'],
    CERRADA: ['Closed', 'fa-solid fa-lock'],
    EN_CURSO: ['In progress', 'fa-solid fa-hourglass-half'],
    ENVIADO: ['Pending review', 'fa-regular fa-clock'],
    CALIFICADO: ['Graded', 'fa-solid fa-circle-check'],
    APROBADA: ['Approved', 'fa-solid fa-check'],
    RECHAZADA: ['Rejected', 'fa-solid fa-ban'],
    VENCIDA: ['Deadline passed', 'fa-regular fa-calendar-xmark'],
};

export const TIPOS = {
    OPCION_MULTIPLE: 'Multiple choice',
    VERDADERO_FALSO: 'True / False',
    ABIERTA: 'Open',
};

export function fecha(iso) {
    if (window.EvalUI?.fecha) return window.EvalUI.fecha(iso);
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return (
        d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) +
        ' ' +
        d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    );
}

export function nota(n) {
    if (window.EvalUI?.nota) return window.EvalUI.nota(n);
    return n === null || n === undefined ? '—' : Number(n).toFixed(2);
}

export function plural(n, uno, varios) {
    if (window.EvalUI?.plural) return window.EvalUI.plural(n, uno, varios);
    return `${n} ${n === 1 ? uno : varios}`;
}

export function toast(mensaje, tipo) {
    if (window.EvalUI?.toast) {
        window.EvalUI.toast(mensaje, tipo);
    }
}

export function mostrarError(e) {
    if (window.EvalUI?.error) {
        window.EvalUI.error(e);
    } else {
        toast((e && e.message) || 'An unexpected error occurred.', 'error');
    }
}

export function confirmar(opts) {
    if (window.EvalUI?.confirmar) {
        return window.EvalUI.confirmar(opts);
    }
    return Promise.resolve(window.confirm(opts.mensaje || 'Confirm?'));
}

export function habilitarEnlacesExternos() {
    window.EvalUI?.habilitarEnlacesExternos?.();
}

export function scrollTopAll() {
    window.scrollTo(0, 0);
    const s = document.querySelector('.app-shell');
    if (s) s.scrollTop = 0;
    const w = document.querySelector('.ev-wrapper');
    if (w) w.scrollTop = 0;
}

export function aLocalDatetime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function getEvalAPI() {
    return window.EvalAPI;
}
