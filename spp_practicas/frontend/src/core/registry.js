/**
 * registry.js — Explicit service/action registry for cross-component communication,
 * replacing ad-hoc window.SPP_* globals.
 */

const apis = new Map();

/**
 * Registers an API under `name` and returns an unsubscribe cleanup function.
 * @param {string} name
 * @param {any} api
 * @returns {Function}
 */
export const provide = (name, api) => {
    apis.set(name, api);
    return () => {
        if (apis.get(name) === api) {
            apis.delete(name);
        }
    };
};

/**
 * Retrieves the registered API for `name`, if mounted.
 * @param {string} name
 * @returns {any}
 */
export const inject = (name) => apis.get(name);

export default { provide, inject };
