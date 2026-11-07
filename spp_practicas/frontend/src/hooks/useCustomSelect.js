import { useEffect } from 'react';
import { init, rebuild, sync, closeAll } from '../core/custom-select';

/**
 * Custom React hook to initialize and sync custom selects declaratively.
 * Handles single or multiple refs (containers or <select> elements) or string selectors,
 * syncing them whenever dependencies update, and cleaning up on unmount.
 *
 * @param {React.RefObject | HTMLElement | string | Array<React.RefObject | HTMLElement | string>} target
 * @param {Array<any>} [deps=[]]
 */
export function useCustomSelect(target, deps = []) {
    useEffect(() => {
        const items = Array.isArray(target) ? target : [target];
        items.forEach((item) => {
            const el = item && typeof item === 'object' && 'current' in item ? item.current : item;
            if (!el) return;

            if (typeof el === 'string') {
                init(el);
                if (typeof document !== 'undefined') {
                    const container = document.querySelector(el);
                    if (container) {
                        const selects = container.querySelectorAll('select');
                        selects.forEach((sel) => {
                            rebuild(sel);
                            sync(sel);
                        });
                    }
                }
            } else if (typeof HTMLElement !== 'undefined' && el instanceof HTMLElement) {
                if (el.tagName === 'SELECT') {
                    if (el.parentElement) init(el.parentElement);
                    rebuild(el);
                    sync(el);
                } else {
                    init(el);
                    const selects = el.querySelectorAll('select');
                    selects.forEach((sel) => {
                        rebuild(sel);
                        sync(sel);
                    });
                }
            }
        });

        return () => {
            closeAll();
        };
    }, deps);
}

export default useCustomSelect;
