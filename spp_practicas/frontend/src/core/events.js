/**
 * events.js — Typed event bus for cross-component and cross-panel communication.
 * Provides canonical event constants and type-safe emit/on helpers wrapping CustomEvent.
 */

export const EVENTS = Object.freeze({
    STUDENT_PRACTICE: 'spp:student-practice',
    PRACTICE: 'spp:practice',
    DIRECTOR_PRACTICE_CHANGED: 'spp:director-practice-changed',
    OPEN_ACTIVITY: 'spp:open-activity',
    OPEN_UPLOAD_EVIDENCE: 'spp:open-upload-evidence',
    DATA_CHANGED: 'spp:dataChanged',
    EDIT_PRACTICE: 'spp:edit-practice',
    PRACTICES_CHANGED: 'spp:practices-changed',
    HOME_REFRESH: 'spp:home-refresh',
    OPEN_USER_MODAL: 'spp:open-user-modal',
    OPEN_PRACTICE: 'spp:open-practice',
    UPDATE_STUDENT_QUESTIONS_PILL: 'spp:update-student-questions-pill'
});

/**
 * Dispatches a typed event.
 * @param {string} eventName - One of the canonical EVENTS constants
 * @param {any} [detail] - Payload attached to event.detail
 * @param {EventTarget} [target=window] - Event target (defaults to window)
 */
export function emit(eventName, detail, target = typeof window !== 'undefined' ? window : null) {
    if (!target) return;
    const evt = typeof CustomEvent === 'function'
        ? new CustomEvent(eventName, { detail, bubbles: true })
        : new Event(eventName);
    target.dispatchEvent(evt);
}

/**
 * Subscribes to a typed event and returns an unsubscribe function.
 * @param {string} eventName - One of the canonical EVENTS constants
 * @param {Function} handler - Callback taking (detail, event)
 * @param {EventTarget} [target=window] - Event target (defaults to window)
 * @returns {Function} Unsubscribe cleanup function
 */
export function on(eventName, handler, target = typeof window !== 'undefined' ? window : null) {
    if (!target) return () => {};
    const listener = (event) => {
        handler(event.detail, event);
    };
    target.addEventListener(eventName, listener);
    return () => {
        target.removeEventListener(eventName, listener);
    };
}

export default { EVENTS, emit, on };
