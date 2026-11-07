/**
 * practiceStore.js — Shared reactive store for the active practice, student credential,
 * and activity list across panels (Logbook, Activities, Evidences, Evaluations).
 */
import { useSyncExternalStore } from 'react';

let state = {
    practice: null,
    practices: [],
    student: null,
    activities: [],
    activity: null,
    evidences: [],
    activitiesBadges: {
        hoursText: '0 / 0 h',
        pendingText: 'Up to date',
        isWarning: false,
        loading: true,
        canDelete: true
    }
};

const listeners = new Set();

export const getPractice = () => state;

export const setPractice = (patch) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
};

const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const usePractice = () => useSyncExternalStore(subscribe, getPractice, getPractice);

export default { getPractice, setPractice, usePractice };
