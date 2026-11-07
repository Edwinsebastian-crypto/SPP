/* =========================================================================
   custom-select.js — Replaces the native <select> of the Director forms with a
   styled dropdown (desktop) or an overlay sheet (compact desktop / mobile).
   Public API:
     customSelect.init(rootSelector)   turn the selects inside a section into custom selects
     customSelect.resetIn(root)        put every select of `root` back on its first option
     customSelect.rebuild(select)      redraw the visual list after the options changed
     customSelect.sync(select)         refresh the trigger text from the select value
     fillSelect(select, items, valueKey, textKey, placeholder)
   ========================================================================= */

const VISIBLE_ROWS = 5;
let scrollLockHost = null;
let scrollAllowEl = null;
let sheet = null;
let sheetChevron = null;

function isMobileLayout() {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 900 || window.innerHeight <= 500;
}

/** Compact desktop (laptops < ~15", reduced windows). Does not include phones. */
function isCompactComputerLayout() {
    if (typeof window === 'undefined') return false;
    if (isMobileLayout()) return false;
    return window.innerWidth <= 1536 || window.innerHeight <= 864;
}

function usesOverlaySheet() {
    return isMobileLayout() || isCompactComputerLayout();
}

// ---------------------------------------------------------------- background scroll lock
function blockBackgroundScroll(event) {
    const target = event.target;
    if (scrollAllowEl && target && scrollAllowEl.contains(target)) return;
    if (target && typeof target.closest === 'function') {
        const scrollableMenu = target.closest('.custom-options.open, .cp-select-sheet-list');
        if (scrollableMenu) return;
    }
    event.preventDefault();
}

function lockBackgroundScroll(scrollContainer) {
    if (typeof document === 'undefined') return;
    unlockBackgroundScroll();
    scrollAllowEl = scrollContainer;
    scrollLockHost = document.querySelector('.app-shell') || document;
    scrollLockHost.addEventListener('wheel', blockBackgroundScroll, { passive: false });
    scrollLockHost.addEventListener('touchmove', blockBackgroundScroll, { passive: false });
}

function unlockBackgroundScroll() {
    if (scrollLockHost) {
        scrollLockHost.removeEventListener('wheel', blockBackgroundScroll);
        scrollLockHost.removeEventListener('touchmove', blockBackgroundScroll);
    }
    scrollLockHost = null;
    scrollAllowEl = null;
}

function ensureOptionHeight() {
    if (typeof document === 'undefined') return;
    if (document.documentElement.dataset.cpSelectOptionHeight) return;
    const probe = document.createElement('div');
    probe.className = 'custom-option';
    probe.textContent = 'M';
    probe.style.visibility = 'hidden';
    probe.style.position = 'absolute';
    probe.style.pointerEvents = 'none';
    document.body.appendChild(probe);
    const height = Math.ceil(probe.getBoundingClientRect().height) || 44;
    probe.remove();
    document.documentElement.dataset.cpSelectOptionHeight = String(height);
    document.documentElement.style.setProperty('--cp-select-option-height', `${height}px`);
    document.documentElement.style.setProperty('--cp-select-visible-rows', String(VISIBLE_ROWS));
}

// ---------------------------------------------------------------- overlay sheet
function ensureSheet() {
    if (sheet) return sheet;
    if (typeof document === 'undefined') return null;

    const root = document.createElement('div');
    root.className = 'cp-select-sheet-root';
    root.id = 'cpSelectSheetRoot';
    root.hidden = true;
    root.innerHTML = `
        <div class="cp-select-sheet-backdrop" data-cp-select-dismiss tabindex="-1" aria-hidden="true"></div>
        <div class="cp-select-sheet" role="dialog" aria-modal="true" aria-labelledby="cpSelectSheetTitle" tabindex="-1">
            <button type="button" class="cp-select-sheet-close" id="cpSelectSheetClose" aria-label="Close">
                <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
            <div class="cp-select-sheet-handle" aria-hidden="true"></div>
            <p class="cp-select-sheet-title" id="cpSelectSheetTitle"></p>
            <div class="cp-select-sheet-list"></div>
        </div>`;
    document.body.appendChild(root);

    root.querySelector('[data-cp-select-dismiss]').addEventListener('click', closeSheet);
    const closeBtn = root.querySelector('.cp-select-sheet-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeSheet();
        });
    }
    root.querySelector('.cp-select-sheet').addEventListener('click', (e) => e.stopPropagation());

    sheet = {
        root,
        title: root.querySelector('.cp-select-sheet-title'),
        list: root.querySelector('.cp-select-sheet-list'),
        dialog: root.querySelector('.cp-select-sheet')
    };
    return sheet;
}

export function closeSheet() {
    if (!sheet || sheet.root.hidden) return;
    sheet.root.hidden = true;
    sheet.root.classList.remove('cp-select-sheet-root--center');
    sheet.list.replaceChildren();
    if (sheetChevron) {
        sheetChevron.style.transform = 'rotate(0deg)';
        sheetChevron = null;
    }
    unlockBackgroundScroll();
}

export function closeAll() {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('.custom-options').forEach((list) => list.classList.remove('open'));
    document.querySelectorAll('.cp-input-wrap .right-icon').forEach((icon) => {
        icon.style.transform = 'rotate(0deg)';
    });
    closeSheet();
    unlockBackgroundScroll();
}

function fieldLabel(select) {
    if (!select) return 'Select';
    if (select.id === 'practice-selector') return 'Assigned student';
    const dataTitle = select.getAttribute('data-sheet-title');
    if (dataTitle) return dataTitle;
    const ariaLabel = select.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;
    if (select.id && typeof document !== 'undefined') {
        const forLabel = document.querySelector(`label[for="${select.id}"]`);
        if (forLabel && forLabel.textContent.trim()) return forLabel.textContent.trim();
    }
    const field = select.closest('.cp-field, .practice-field, .dv-filter-wrap');
    const label = field?.querySelector('label');
    if (label?.textContent) return label.textContent.trim();
    const parentField = select.closest('.cp-input-wrap')?.parentElement;
    const parentLabel = parentField?.querySelector('label');
    if (parentLabel?.textContent) return parentLabel.textContent.trim();
    const first = select.options[0];
    return (first && !first.value) ? first.text.trim() : 'Select';
}

function updateSelectedOptions(select) {
    if (!select) return;
    const val = String(select.value ?? '');
    const wrapper = select.closest('.cp-input-wrap') || select.parentElement;
    const container = wrapper ? wrapper.querySelector('.custom-select-container') : null;
    if (container) {
        container.querySelectorAll('.custom-option').forEach((opt) => {
            opt.classList.toggle('selected', String(opt.dataset.value ?? '') === val);
        });
    }
    if (sheet && !sheet.root.hidden) {
        sheet.list.querySelectorAll('.custom-option').forEach((opt) => {
            opt.classList.toggle('selected', String(opt.dataset.value ?? '') === val);
        });
    }
}

function applyValue(select, trigger, option) {
    select.value = option.value;
    trigger.textContent = option.text;
    trigger.classList.toggle('is-placeholder', !!option.disabled);
    updateSelectedOptions(select);
    closeAll();
    select.dispatchEvent(new Event('change', { bubbles: true }));
}

function openSheet({ select, trigger, chevron }) {
    const current = ensureSheet();
    if (!current) return;
    closeAll();

    const centered = isCompactComputerLayout() && !isMobileLayout();
    current.root.classList.toggle('cp-select-sheet-root--center', centered);

    current.title.textContent = fieldLabel(select);
    current.list.replaceChildren();

    Array.from(select.options).forEach((option) => {
        if (option.disabled && option.value === '') return;

        const item = document.createElement('div');
        item.className = 'custom-option';
        item.textContent = option.text;
        item.dataset.value = option.value;
        if (String(select.value) === String(option.value)) item.classList.add('selected');

        item.addEventListener('click', (e) => {
            e.stopPropagation();
            applyValue(select, trigger, option);
        });
        current.list.appendChild(item);
    });

    if (current.list.children.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'custom-option';
        empty.style.opacity = '0.5';
        empty.style.pointerEvents = 'none';
        empty.textContent = 'No records available';
        current.list.appendChild(empty);
    }

    current.root.hidden = false;
    sheetChevron = chevron;
    if (chevron) chevron.style.transform = 'rotate(180deg)';
    lockBackgroundScroll(current.list);
    current.dialog.focus({ preventScroll: true });
}

// ---------------------------------------------------------------- public API
export function init(rootSelector) {
    if (typeof document === 'undefined') return;
    const root = typeof rootSelector === 'string' ? document.querySelector(rootSelector) : rootSelector;
    if (!root) return;

    ensureOptionHeight();

    const selects = root.tagName === 'SELECT'
        ? [root]
        : root.matches && root.matches('.cp-input-wrap')
            ? root.querySelectorAll('select')
            : root.querySelectorAll('.cp-input-wrap select');

    selects.forEach((select) => {
        if (select.classList.contains('hidden-select')) return;

        select.classList.add('hidden-select');
        const wrapper = select.parentElement;
        const chevron = wrapper.querySelector('.right-icon');

        const container = document.createElement('div');
        container.className = 'custom-select-container';

        const trigger = document.createElement('div');
        trigger.className = 'custom-select-trigger';
        trigger.setAttribute('role', 'button');
        trigger.setAttribute('tabindex', '0');
        trigger.setAttribute('aria-haspopup', 'listbox');

        const selected = select.options[select.selectedIndex] || select.options[0];
        trigger.textContent = selected ? selected.text : '';
        if (selected && selected.disabled) trigger.classList.add('is-placeholder');

        const optionsList = document.createElement('div');
        optionsList.className = 'custom-options';
        optionsList.setAttribute('role', 'listbox');
        optionsList.addEventListener('click', (e) => e.stopPropagation());
        optionsList.addEventListener('mousedown', (e) => e.stopPropagation());

        Array.from(select.options).forEach((option) => {
            if (option.disabled && option.value === '') return;

            const item = document.createElement('div');
            item.className = 'custom-option';
            item.setAttribute('role', 'option');
            item.textContent = option.text;
            item.dataset.value = option.value;
            if (String(select.value) === String(option.value)) item.classList.add('selected');
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                applyValue(select, trigger, option);
            });
            optionsList.appendChild(item);
        });

        if (optionsList.children.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'custom-option';
            empty.style.opacity = '0.5';
            empty.style.pointerEvents = 'none';
            empty.textContent = 'No records available';
            optionsList.appendChild(empty);
        }

        function toggleDropdown(e) {
            if (select.disabled) return;
            e.stopPropagation();

            if (usesOverlaySheet()) {
                if (sheet && !sheet.root.hidden && sheetChevron === chevron) {
                    closeAll();
                    return;
                }
                openSheet({ select, trigger, chevron });
                return;
            }

            const wasOpen = optionsList.classList.contains('open');
            closeAll();

            if (!wasOpen) {
                updateSelectedOptions(select);
                optionsList.classList.add('open');
                if (chevron) chevron.style.transform = 'rotate(180deg)';
                lockBackgroundScroll(optionsList);
            }
        }

        trigger.addEventListener('click', toggleDropdown);
        trigger.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleDropdown(e);
            }
        });

        if (chevron) {
            chevron.style.cursor = 'pointer';
            chevron.style.transition = 'transform 0.2s ease';
            chevron.addEventListener('click', toggleDropdown);
        }

        container.appendChild(trigger);
        container.appendChild(optionsList);
        wrapper.appendChild(container);
    });
}

/** Puts every select of `root` back on its first option and refreshes the visual trigger. */
export function resetIn(root) {
    if (!root) return;
    const selects = root.tagName === 'SELECT'
        ? [root]
        : root.matches && root.matches('.cp-input-wrap')
            ? root.querySelectorAll('select')
            : root.querySelectorAll('.cp-input-wrap select');

    selects.forEach((select) => {
        const trigger = select.parentElement.querySelector('.custom-select-trigger');
        const first = select.options[0];
        const chevron = select.parentElement.querySelector('.right-icon');
        select.selectedIndex = 0;
        if (trigger && first) {
            trigger.textContent = first.text;
            trigger.classList.toggle('is-placeholder', !!first.disabled);
        }
        if (chevron) chevron.style.transform = 'rotate(0deg)';
        updateSelectedOptions(select);
    });
}

/** Refreshes the trigger text from the select's current value. */
export function sync(select) {
    if (!select) return;
    const wrapper = select.closest('.cp-input-wrap');
    const trigger = wrapper ? wrapper.querySelector('.custom-select-trigger') : null;
    const option = select.options[select.selectedIndex];
    
    if (wrapper) {
        const container = wrapper.querySelector('.custom-select-container');
        if (select.disabled) {
            wrapper.classList.add('is-disabled');
            if (container) container.classList.add('is-disabled');
        } else {
            wrapper.classList.remove('is-disabled');
            if (container) container.classList.remove('is-disabled');
        }
    }

    if (trigger && option) {
        trigger.textContent = option.text;
        trigger.classList.toggle('is-placeholder', !!option.disabled);
    }
    updateSelectedOptions(select);
}

/** The options changed after init(): redraw the visual list from the <select>. */
export function rebuild(select) {
    if (!select) return;
    const container = select.parentElement && select.parentElement.querySelector('.custom-select-container');
    if (!container) return;
    const trigger = container.querySelector('.custom-select-trigger');
    const list = container.querySelector('.custom-options');
    const selectedOption = select.options[select.selectedIndex] || select.options[0];
    if (trigger && selectedOption) {
        trigger.textContent = selectedOption.text;
        trigger.classList.toggle('is-placeholder', !!selectedOption.disabled);
    }
    
    if (select.disabled) {
        select.parentElement.classList.add('is-disabled');
        container.classList.add('is-disabled');
    } else {
        select.parentElement.classList.remove('is-disabled');
        container.classList.remove('is-disabled');
    }

    const visibleOptions = Array.from(select.options).filter(
        (option) => !(option.disabled && option.value === '')
    );
    const existingItems = Array.from(list.querySelectorAll('.custom-option[role="option"]'));
    const sameOptions =
        visibleOptions.length === existingItems.length &&
        visibleOptions.every(
            (opt, idx) =>
                String(existingItems[idx].dataset.value ?? '') === String(opt.value ?? '') &&
                existingItems[idx].textContent === opt.text
        );

    if (sameOptions && (visibleOptions.length > 0 || list.children.length > 0)) {
        updateSelectedOptions(select);
        return;
    }

    const prevScrollTop = list.scrollTop;
    list.innerHTML = '';
    visibleOptions.forEach((option) => {
        const item = document.createElement('div');
        item.className = 'custom-option';
        item.setAttribute('role', 'option');
        item.textContent = option.text;
        item.dataset.value = option.value;
        if (String(select.value) === String(option.value)) item.classList.add('selected');
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            applyValue(select, trigger, option);
        });
        list.appendChild(item);
    });

    if (list.children.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'custom-option';
        empty.style.opacity = '0.5';
        empty.style.pointerEvents = 'none';
        empty.textContent = 'No records available';
        list.appendChild(empty);
    }
    list.scrollTop = prevScrollTop;
    updateSelectedOptions(select);
}

/** Empties a <select> and fills it with options; keeps the placeholder (first, disabled option). */
export function fillSelect(select, items, valueKey, textKey, placeholder) {
    if (!select) return;
    select.innerHTML = '';
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.disabled = true;
    placeholderOption.selected = true;
    placeholderOption.textContent = placeholder || 'Select';
    select.appendChild(placeholderOption);
    items.forEach((item) => {
        const option = document.createElement('option');
        option.value = String(item[valueKey]);
        option.textContent = typeof textKey === 'function' ? textKey(item) : item[textKey];
        select.appendChild(option);
    });
    rebuild(select);
}

let pointerDownInSelectMenu = false;

if (typeof document !== 'undefined') {
    document.addEventListener(
        'mousedown',
        (e) => {
            const t = e.target;
            pointerDownInSelectMenu = Boolean(
                t && typeof t.closest === 'function' && t.closest('.custom-options, .cp-select-sheet')
            );
        },
        true
    );
    document.addEventListener('click', (e) => {
        if (pointerDownInSelectMenu) {
            pointerDownInSelectMenu = false;
            return;
        }
        const t = e.target;
        if (t && typeof t.closest === 'function' && t.closest('.custom-options, .cp-select-sheet')) {
            return;
        }
        closeAll();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });
    window.addEventListener('resize', () => { if (!usesOverlaySheet()) closeSheet(); });
}

export const customSelect = { init, resetIn, sync, rebuild };
export { useCustomSelect } from '../hooks/useCustomSelect.js';

export default customSelect;
