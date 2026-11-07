/* =========================================================================
   panels.js — Panel navigation shared by the Student, Tutor, Advisor and
   Director views.

   Flow:  practice -> logbook -> activities -> evidence
                          \-> questions (student / tutor)
   ========================================================================= */

import { updateAppTopbarOffset } from './shell.js';
import { sync as syncCustomSelect } from './custom-select.js';

const byId = (id) => (typeof document !== 'undefined' ? document.getElementById(id) : null);

/** Scrolls every scrollable ancestor back to the top (the page, the wrapper and the shell). */
export function resetScroll() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
    document.querySelectorAll('.app-shell, .practice-content-wrapper, .reports-wrapper, .ev-wrapper, .ptm-panel, .inst-panel, .um-panel, .logbook-panel, .activities-panel, .questions-panel, .evidences-panel').forEach((el) => {
        el.scrollTop = 0;
    });
    if (typeof updateAppTopbarOffset === 'function') {
        updateAppTopbarOffset();
        requestAnimationFrame(updateAppTopbarOffset);
    }
}

/** Hides `from`, shows `to` and scrolls to the top. */
export function swap(from, to, display) {
    if (!from || !to) return;
    from.style.display = 'none';
    to.style.display = display || 'flex';
    resetScroll();
}

/** Clicking `trigger` swaps `from` -> `to` (no-op when any element is missing). */
export function link(trigger, from, to, display) {
    if (trigger && from && to) trigger.addEventListener('click', () => swap(from, to, display));
}

// ---------------------------------------------------------------- "..." card menus
export function setMenuState(button, open) {
    if (!button) return;
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
    const dropdown = button.nextElementSibling; // .ev-dropdown
    if (dropdown) dropdown.classList.toggle('is-open', open);
    const icon = button.querySelector('i');
    if (icon) {
        icon.classList.toggle('fa-ellipsis', !open);
        icon.classList.toggle('fa-arrow-left', open);
    }
}

export function closeAllMenus(except) {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('.ev-menu-btn').forEach((button) => {
        if (button !== except) setMenuState(button, false);
    });
}

/** Opens/closes the "..." menu of one card (the floating panel appears to the left of the button). */
export function bindMenu(card) {
    if (!card) return;
    const button = card.querySelector('.ev-menu-btn');
    if (!button) return;
    button.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = button.getAttribute('aria-expanded') === 'true';
        closeAllMenus(button);
        setMenuState(button, !isOpen);
    });
}

/**
 * Event delegation for a list of cards with a "..." menu (catalog lists of the Director).
 * `actions` = { view(card), edit(card), delete(card) }.
 */
export function bindCardList(root, cardSelector, actions) {
    if (!root) return;
    root.addEventListener('click', (e) => {
        const menuButton = e.target.closest('.ev-menu-btn');
        if (menuButton && root.contains(menuButton)) {
            e.stopPropagation();
            const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
            closeAllMenus(menuButton);
            setMenuState(menuButton, !isOpen);
            return;
        }
        const handlers = [['.ev-item--view', actions.view], ['.ev-item--edit', actions.edit], ['.ev-item--delete', actions.delete]];
        for (const [selector, handler] of handlers) {
            const item = e.target.closest(selector);
            if (item && root.contains(item)) {
                const card = item.closest(cardSelector);
                closeAllMenus(null);
                if (card && handler) handler(card);
                return;
            }
        }
    });
}

// ---------------------------------------------------------------- standard panel flow
export function wireStandardFlow(options) {
    if (typeof document === 'undefined') return;
    const o = Object.assign({ questions: 'none', scope: '' }, options);
    const scoped = (selector) => document.querySelector((o.scope ? o.scope + ' ' : '') + selector);

    const enterButton = scoped('.practice-submit');
    const practicePanel = scoped('.practice-panel');
    const logbookPanel = byId('logbook-panel');
    const activitiesPanel = byId('activities-panel');
    const evidencesPanel = byId('evidences-panel');
    const evidencesTitle = byId('evidences-title');
    const questionsPanel = byId('questions-panel');

    const logbookButtons = logbookPanel ? logbookPanel.querySelectorAll('.lb-action-btn') : [];
    const questionButtons = questionsPanel ? questionsPanel.querySelectorAll('.lb-action-btn') : [];

    link(enterButton, practicePanel, logbookPanel);
    link(byId('logbookBack'), logbookPanel, practicePanel, 'block');
    link(logbookButtons[0], logbookPanel, activitiesPanel);
    link(byId('activitiesBack'), activitiesPanel, logbookPanel);
    link(byId('evidencesBack'), evidencesPanel, activitiesPanel);

    const activityButtons = (o.scope ? document.querySelector(o.scope) : document).querySelectorAll('.activity-enter-btn');
    activityButtons.forEach((button, index) => {
        button.addEventListener('click', () => {
            const number = button.getAttribute('data-activity') || (index + 1);
            if (evidencesTitle) evidencesTitle.textContent = `Activity #${number}`;
            swap(activitiesPanel, evidencesPanel);
        });
    });

    if (o.questions === 'none') return;
    link(logbookButtons[1], logbookPanel, questionsPanel);
    link(byId('questionsBack'), questionsPanel, logbookPanel);

    if (o.questions === 'student') {
        const myQuestions = byId('my-questions-panel');
        if (myQuestions && questionButtons[1]) {
            link(questionButtons[1], questionsPanel, myQuestions);
            link(byId('myQuestionsBack'), myQuestions, questionsPanel);
        }
    } else if (o.questions === 'tutor') {
        const questionBank = byId('question-bank-panel');
        if (questionBank && questionButtons[1]) {
            link(questionButtons[1], questionsPanel, questionBank);
            link(byId('questionBankBack'), questionBank, questionsPanel);
        }
    }
}

/** Tab buttons that show one panel and hide the others. `panelFor(button, index)` returns the id of the panel to show. */
export function wireTabs(buttons, panels, panelFor) {
    buttons.forEach((button, index) => {
        button.addEventListener('click', () => {
            const target = panelFor(button, index);
            if (!target) return;
            buttons.forEach((b) => b.classList.remove('active'));
            button.classList.add('active');
            panels.forEach((panel) => { panel.style.display = panel.id === target ? '' : 'none'; });
            resetScroll();
        });
    });
}

export const PANEL_IDS = {
    PRACTICE: 'practice-panel',
    LOGBOOK: 'logbook-panel',
    ACTIVITIES: 'activities-panel',
    EVIDENCES: 'evidences-panel',
    QUESTIONS: 'questions-panel'
};

/**
 * Shows the target panel among standard practice panels and hides the others.
 * @param {'practice-panel'|'logbook-panel'|'activities-panel'|'evidences-panel'|'questions-panel'} targetId
 * @param {string} [display]
 */
export function showPanel(targetId, display) {
    if (typeof document === 'undefined') return;
    const practicePanel = document.querySelector('#practice .practice-panel') || document.querySelector('.practice-panel');
    const logbookPanel = byId('logbook-panel');
    const activitiesPanel = byId('activities-panel');
    const evidencesPanel = byId('evidences-panel');
    const questionsPanel = byId('questions-panel');

    const panelMap = {
        'practice-panel': practicePanel,
        'logbook-panel': logbookPanel,
        'activities-panel': activitiesPanel,
        'evidences-panel': evidencesPanel,
        'questions-panel': questionsPanel
    };

    Object.entries(panelMap).forEach(([id, el]) => {
        if (!el) return;
        if (id === targetId) {
            el.style.display = display || (id === 'practice-panel' ? 'block' : 'flex');
        } else {
            el.style.display = 'none';
        }
    });

    resetScroll();
}

export function isPanelVisible(targetId) {
    if (typeof document === 'undefined') return false;
    const el = targetId === 'practice-panel'
        ? (document.querySelector('#practice .practice-panel') || document.querySelector('.practice-panel'))
        : byId(targetId);
    return Boolean(el && el.style.display !== 'none' && !el.hidden);
}

export function getPanelElement(targetId) {
    if (typeof document === 'undefined') return null;
    if (targetId === 'practice-panel') {
        return document.querySelector('#practice .practice-panel') || document.querySelector('.practice-panel');
    }
    return byId(targetId);
}

export function onQuestionsBack(handler) {
    if (typeof document === 'undefined') return () => {};
    const qBack = byId('questionsBack');
    if (!qBack) return () => {};
    qBack.addEventListener('click', handler);
    return () => qBack.removeEventListener('click', handler);
}

export function removeLegacyModals(ids = ['am-modal', 'delete-confirm-modal']) {
    if (typeof document === 'undefined') return;
    ids.forEach((id) => {
        const existing = byId(id);
        if (existing && !existing.dataset.reactManaged) {
            existing.remove();
        }
    });
}

export function selectPracticeById(practiceId) {
    if (typeof document === 'undefined' || !practiceId) return;
    const select = byId('practice-selector');
    if (
        select &&
        String(select.value) !== String(practiceId) &&
        Array.from(select.options).some((o) => o.value === String(practiceId))
    ) {
        select.value = String(practiceId);
        syncCustomSelect(select);
        select.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

export function triggerPracticeEnter() {
    if (typeof document === 'undefined') return;
    const panel = document.querySelector('#practice .practice-panel');
    const enter = document.querySelector('#practice .practice-submit');
    if (panel && enter && panel.style.display !== 'none' && !enter.disabled) {
        enter.click();
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('click', () => closeAllMenus(null));
}

const panels = { resetScroll, swap, link, bindMenu, bindCardList, closeAllMenus, wireStandardFlow, wireTabs, showPanel, isPanelVisible, getPanelElement, onQuestionsBack, removeLegacyModals, selectPracticeById, triggerPracticeEnter, PANEL_IDS };

export default panels;
