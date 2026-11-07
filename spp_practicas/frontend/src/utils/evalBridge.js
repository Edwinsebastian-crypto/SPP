import {
    toast as uiToast,
    error as uiError,
    confirmar as uiConfirmar,
    habilitarEnlacesExternos as uiHabilitar
} from '../core/ui';
import { EvalAPI } from '../core/api';

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
    return n === null || n === undefined ? '—' : Number(n).toFixed(2);
}

export function plural(n, uno, varios) {
    return `${n} ${n === 1 ? uno : varios}`;
}

export function toast(mensaje, tipo) {
    uiToast(mensaje, tipo);
}

export function mostrarError(e) {
    uiError(e);
}

export function confirmar(opts) {
    return uiConfirmar(opts);
}

export function habilitarEnlacesExternos() {
    uiHabilitar();
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
    return EvalAPI;
}
