import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    fileIcon,
    StudentEvidenceModal,
    TutorActivityModal,
    ViewEvidenceModal,
    ViewFeedbackModal,
    ConfirmDeleteModal,
    SuccessNoticeModal,
} from './ActivitiesModals';

function resetScroll() {
    if (window.SPP?.panels?.resetScroll) {
        window.SPP.panels.resetScroll();
        return;
    }
    window.scrollTo(0, 0);
    const appShell = document.querySelector('.app-shell');
    if (appShell) appShell.scrollTop = 0;
    const wrapper = document.querySelector('.practice-content-wrapper');
    if (wrapper) wrapper.scrollTop = 0;
}

export function getActivityStatusInfo(activity) {
    const rawGrade = activity.grade;
    const gradeNum =
        rawGrade !== null && rawGrade !== undefined && rawGrade !== ''
            ? parseFloat(rawGrade)
            : null;
    const hasValidGrade =
        gradeNum !== null && !Number.isNaN(gradeNum) && gradeNum > 0;
    const evidenceCount = Number(activity.evidenceCount) || 0;
    const feedbackCount =
        Number(activity.tutorFeedbackCount ?? activity.feedbackCount) || 0;

    if (hasValidGrade) {
        return {
            category: 'graded',
            badgeClass: 'act-status--graded',
            label: `Graded ${gradeNum.toFixed(1)}/5.0`,
            icon: null,
            gradeValue: gradeNum,
        };
    }

    if (feedbackCount > 0 && !hasValidGrade) {
        return {
            category: 'completed',
            badgeClass: 'act-status--submitted',
            label: 'Completed',
            icon: 'fa-solid fa-check',
            gradeValue: null,
        };
    }

    if (evidenceCount > 0 && !hasValidGrade && feedbackCount === 0) {
        return {
            category: 'review',
            badgeClass: 'act-status--in-review',
            label: 'Pending Review',
            icon: 'fa-solid fa-triangle-exclamation',
            gradeValue: null,
        };
    }

    let isOverdue = false;
    if (activity.dueDate) {
        const due = new Date(activity.dueDate);
        if (!Number.isNaN(due.getTime()) && due.getTime() < Date.now()) {
            isOverdue = true;
        }
    }

    return {
        category: 'pending',
        badgeClass: 'act-status--due',
        label: isOverdue ? 'Overdue' : 'Due',
        icon: null,
        gradeValue: null,
    };
}

export function activityMatchesFilter(activity, filter) {
    if (!filter || filter === 'all') return true;

    const rawGrade = activity.grade;
    const gradeNum =
        rawGrade !== null && rawGrade !== undefined && rawGrade !== ''
            ? parseFloat(rawGrade)
            : null;
    const hasValidGrade =
        gradeNum !== null && !Number.isNaN(gradeNum) && gradeNum > 0;
    const evidenceCount = Number(activity.evidenceCount) || 0;
    const feedbackCount =
        Number(activity.tutorFeedbackCount ?? activity.feedbackCount) || 0;

    if (filter === 'pending') return evidenceCount === 0;
    if (filter === 'review')
        return evidenceCount > 0 && !hasValidGrade && feedbackCount === 0;
    if (filter === 'completed' || filter === 'submitted')
        return feedbackCount > 0 && !hasValidGrade;
    if (filter === 'graded') return hasValidGrade;
    return true;
}

export function formatCardDueDate(dueDateStr) {
    if (!dueDateStr) return 'No due date';
    try {
        const d = new Date(dueDateStr);
        if (Number.isNaN(d.getTime())) return `Due ${dueDateStr}`;
        const months = [
            'Jan',
            'Feb',
            'Mar',
            'Apr',
            'May',
            'Jun',
            'Jul',
            'Aug',
            'Sep',
            'Oct',
            'Nov',
            'Dec',
        ];
        const month = months[d.getUTCMonth()];
        const day = d.getUTCDate();
        const year = d.getUTCFullYear();
        return `Due ${month} ${day}, ${year}`;
    } catch (_) {
        return `Due ${dueDateStr}`;
    }
}

export function formatActivityTitle(activity) {
    const rawTitle = (activity.title || '').trim();
    const actNum = activity.number;
    if (
        !rawTitle ||
        rawTitle.toLowerCase() === 'activity' ||
        rawTitle.toLowerCase() === `activity #${actNum}` ||
        rawTitle.toLowerCase() === `activity ${actNum}`
    ) {
        return `Activity #${actNum}`;
    }
    if (
        rawTitle.toLowerCase().startsWith(`activity #${actNum}`) ||
        rawTitle.toLowerCase().startsWith(`activity ${actNum}`)
    ) {
        return rawTitle;
    }
    return `Activity #${actNum} - ${rawTitle}`;
}

export function isActivityClosed(activity) {
    if (!activity) return false;
    if (activity.dueDate) {
        const str =
            typeof activity.dueDate === 'string'
                ? activity.dueDate
                      .replace(/T/, ' ')
                      .replace(/Z$|[+-][0-9:]+$/, '')
                      .trim()
                : '';
        const due = str
            ? new Date(str.replace(' ', 'T'))
            : new Date(activity.dueDate);
        if (!Number.isNaN(due.getTime()) && Date.now() >= due.getTime()) {
            return true;
        }
    }
    if (
        activity.grade !== null &&
        activity.grade !== undefined &&
        activity.grade !== ''
    ) {
        const gradeNum = Number(activity.grade);
        if (!Number.isNaN(gradeNum) && gradeNum > 0) {
            return true;
        }
    }
    return false;
}

function DropdownMenu({ id, style, ariaLabel = 'Options', items }) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const onDocClick = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('click', onDocClick);
        return () => document.removeEventListener('click', onDocClick);
    }, [open]);

    const visibleItems = (items || []).filter((item) => !item.hidden);
    if (!visibleItems.length) return null;

    return (
        <div ref={wrapRef} className="ev-menu-wrapper" id={id} style={style}>
            <button
                type="button"
                className="ev-menu-btn"
                aria-label={ariaLabel}
                aria-expanded={open ? 'true' : 'false'}
                onClick={(e) => {
                    e.stopPropagation();
                    setOpen((prev) => !prev);
                }}
            >
                <i
                    className={`fa-solid ${
                        open ? 'fa-arrow-left' : 'fa-ellipsis'
                    }`}
                    aria-hidden="true"
                />
            </button>
            <div className={`ev-dropdown${open ? ' is-open' : ''}`} role="menu">
                {visibleItems.map((item, idx) => (
                    <button
                        key={idx}
                        type="button"
                        className={`ev-dropdown-item ${item.className || ''}`}
                        role="menuitem"
                        onClick={(e) => {
                            e.stopPropagation();
                            setOpen(false);
                            item.onClick && item.onClick();
                        }}
                    >
                        <i className={item.icon} aria-hidden="true" />{' '}
                        {item.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

export default function ActivitiesAndEvidencesApp({ role }) {
    const [practice, setPractice] = useState(null);
    const [activities, setActivities] = useState([]);
    const [activeFilter, setActiveFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Selected activity & its evidences / feedback
    const [currentActivity, setCurrentActivity] = useState(null);
    const [evidences, setEvidences] = useState([]);
    const [feedbacks, setFeedbacks] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [loadingActivities, setLoadingActivities] = useState(true);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const loadedPracticeIdRef = useRef(null);

    // Tutor inline grade state
    const [isEditingGrade, setIsEditingGrade] = useState(false);
    const [gradeInputVal, setGradeInputVal] = useState('');

    // Tutor / Advisor feedback form state
    const [feedbackText, setFeedbackText] = useState('');
    const [editingFeedbackId, setEditingFeedbackId] = useState(null);
    const [submittingFeedback, setSubmittingFeedback] = useState(false);
    const feedbackTextareaRef = useRef(null);
    const feedbackCancelRef = useRef(null);

    // Modals state
    const [studentModalState, setStudentModalState] = useState({
        open: false,
        mode: 'add',
        evidence: null,
        busy: false,
    });
    const [tutorModalState, setTutorModalState] = useState({
        open: false,
        mode: 'create',
        activity: null,
        busy: false,
    });
    const [viewEvidenceTarget, setViewEvidenceTarget] = useState(null);
    const [viewFeedbackText, setViewFeedbackText] = useState(null);
    const [confirmDeleteConfig, setConfirmDeleteConfig] = useState(null);
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [successNotice, setSuccessNotice] = useState(null);

    const practiceRef = useRef(null);
    practiceRef.current = practice;
    const currentActivityRef = useRef(null);
    currentActivityRef.current = currentActivity;

    // Remove static legacy modals in student.html / tutor.html so IDs don't collide
    useEffect(() => {
        ['am-modal', 'delete-confirm-modal'].forEach((id) => {
            const existing = document.getElementById(id);
            if (existing && !existing.dataset.reactManaged) {
                existing.remove();
            }
        });
        if (window.SPP?.session) {
            window.SPP.session()
                .then((u) => setCurrentUser(u))
                .catch(() => {});
        }
    }, []);

    const updateLogbookBadges = useCallback(
        (list, prac) => {
            const p = prac || practiceRef.current;
            const pendingSelector =
                role === 'director'
                    ? '#practice #lb-pending-pill'
                    : '#lb-pending-pill';
            const hoursSelector =
                role === 'director'
                    ? '#practice #lb-hours-pill'
                    : '#lb-hours-pill';

            const pendingPill =
                document.querySelector(pendingSelector) ||
                document.getElementById('lb-pending-pill');
            if (pendingPill) {
                if (role === 'tutor' || role === 'advisor') {
                    const reviewCount = (list || []).filter(
                        (a) => getActivityStatusInfo(a).category === 'review'
                    ).length;
                    if (reviewCount > 0) {
                        pendingPill.textContent = `${reviewCount} pending review`;
                        pendingPill.className =
                            'lb-card-pill lb-card-pill--warning';
                    } else {
                        pendingPill.textContent = 'Up to date';
                        pendingPill.className =
                            'lb-card-pill lb-card-pill--uptodate';
                    }
                } else {
                    const pendingCount = (list || []).filter(
                        (a) => getActivityStatusInfo(a).category === 'pending'
                    ).length;
                    if (pendingCount > 0) {
                        pendingPill.textContent = `${pendingCount} pending`;
                        pendingPill.className =
                            'lb-card-pill lb-card-pill--warning';
                    } else {
                        pendingPill.textContent = 'Up to date';
                        pendingPill.className =
                            'lb-card-pill lb-card-pill--uptodate';
                    }
                }
            }

            const hoursPill =
                document.querySelector(hoursSelector) ||
                document.getElementById('lb-hours-pill');
            if (hoursPill) {
                const targetHours =
                    p?.hours != null && !Number.isNaN(Number(p.hours))
                        ? p.hours
                        : 0;
                const totalWorked = (list || []).reduce(
                    (sum, act) => sum + (Number(act.hours) || 0),
                    0
                );
                hoursPill.textContent = `${totalWorked} / ${targetHours} h`;
                hoursPill.classList.remove('is-skel-pill');
            }

            if (role === 'director') {
                const btnDel = document.getElementById('btn-delete-practice');
                if (btnDel) {
                    btnDel.style.display =
                        (list || []).length === 0 ? 'flex' : 'none';
                }
            }
        },
        [role]
    );

    const loadActivities = useCallback(
        async (targetPracticeOrActivityId) => {
            let p = practiceRef.current;
            let targetActivityId = null;

            if (
                targetPracticeOrActivityId &&
                typeof targetPracticeOrActivityId === 'object' &&
                targetPracticeOrActivityId.id
            ) {
                p = targetPracticeOrActivityId;
            } else if (targetPracticeOrActivityId) {
                targetActivityId = targetPracticeOrActivityId;
            }

            if (!p || !p.id) {
                setLoadingActivities(false);
                return;
            }
            if (String(loadedPracticeIdRef.current) !== String(p.id)) {
                setLoadingActivities(true);
            }
            const SPP = window.SPP;
            let list = [];
            try {
                const data = await SPP.get(`/api/practices/${p.id}/activities`);
                list = data.activities || [];
            } catch (err) {
                setLoadingActivities(false);
                if (SPP?.showError) SPP.showError(err);
                return;
            }

            list.forEach((act) => {
                const roleCount =
                    role === 'advisor'
                        ? Number(act.advisorFeedbackCount ?? act.feedbackCount ?? 0)
                        : Number(act.tutorFeedbackCount ?? act.feedbackCount ?? 0);
                act.feedbackCount = roleCount;
                act.tutorFeedbackCount = roleCount;
                act.roleFeedbackCount = roleCount;
                act.hours = Number(act.hours) || 0;
                act.evidenceCount = Number(act.evidenceCount) || 0;
            });

            loadedPracticeIdRef.current = p.id;
            setActivities(list);
            setLoadingActivities(false);
            updateLogbookBadges(list, p);

            if (window.SPP_TEACHER?.state) {
                window.SPP_TEACHER.state.activities = list;
            }

            const idToSync = targetActivityId || currentActivityRef.current?.id;
            if (idToSync) {
                const updated = list.find(
                    (a) => String(a.id) === String(idToSync)
                );
                if (updated) {
                    setCurrentActivity(updated);
                    if (window.SPP_TEACHER?.state) {
                        window.SPP_TEACHER.state.activity = updated;
                    }
                }
            }
        },
        [role, updateLogbookBadges]
    );

    const loadEvidenceAndFeedback = useCallback(async (act, showSkeleton = false) => {
        const target = act || currentActivityRef.current;
        if (!target || !target.id) {
            setLoadingDetail(false);
            return;
        }
        if (showSkeleton) {
            setLoadingDetail(true);
        }
        const SPP = window.SPP;
        try {
            const [evRes, fbRes] = await Promise.all([
                SPP.get(`/api/activities/${target.id}/evidences`),
                SPP.get(`/api/activities/${target.id}/feedback`),
            ]);
            const evList = evRes.evidences || [];
            const fbList = fbRes.feedback || [];
            setEvidences(evList);
            setFeedbacks(fbList);
            if (window.SPP_TEACHER?.state) {
                window.SPP_TEACHER.state.evidences = evList;
            }
        } catch (err) {
            if (SPP?.showError) SPP.showError(err);
        } finally {
            setLoadingDetail(false);
        }
    }, []);

    // Connect to role-specific practice state & events
    useEffect(() => {
        if (role === 'student') {
            if (window.SPP_STUDENT_PRACTICE) {
                setPractice(window.SPP_STUDENT_PRACTICE);
                loadActivities(window.SPP_STUDENT_PRACTICE);
            }
            const onStudentPractice = (e) => {
                const p = e.detail?.practice || e.detail;
                if (p) {
                    setPractice(p);
                    setActiveFilter('all');
                    setSearchQuery('');
                    loadActivities(p);
                }
            };
            window.addEventListener('spp:student-practice', onStudentPractice);
            return () =>
                window.removeEventListener(
                    'spp:student-practice',
                    onStudentPractice
                );
        }

        if (role === 'tutor' || role === 'advisor') {
            window.SPP_TEACHER = window.SPP_TEACHER || { state: {} };
            window.SPP_TEACHER.refreshActivities = (actId) =>
                loadActivities(actId);
            window.SPP_TEACHER.displayActivity = (act) => {
                if (act) {
                    setCurrentActivity(act);
                    setEvidences([]);
                    setFeedbacks([]);
                    loadEvidenceAndFeedback(act, true);
                }
            };

            if (window.SPP_TEACHER.state?.practice) {
                setPractice(window.SPP_TEACHER.state.practice);
                loadActivities(window.SPP_TEACHER.state.practice);
            }

            const onTeacherPractice = (e) => {
                const p = e.detail;
                if (p) {
                    setPractice(p);
                    setActiveFilter('all');
                    setSearchQuery('');
                    loadActivities(p);
                }
            };
            document.addEventListener('spp:practice', onTeacherPractice);
            return () =>
                document.removeEventListener('spp:practice', onTeacherPractice);
        }

        if (role === 'director') {
            const initial =
                window.SPP_DIRECTOR?.getCurrentPractice?.() ||
                window.SPP_DIRECTOR?.currentPractice;
            if (initial) {
                setPractice(initial);
                loadActivities(initial);
            }
            const onDirectorPractice = (e) => {
                const p = e.detail?.practice;
                if (p) {
                    setPractice(p);
                    setActiveFilter('all');
                    setSearchQuery('');
                    loadActivities(p);
                }
            };
            window.addEventListener(
                'spp:director-practice-changed',
                onDirectorPractice
            );
            return () =>
                window.removeEventListener(
                    'spp:director-practice-changed',
                    onDirectorPractice
                );
        }
    }, [role, loadActivities, loadEvidenceAndFeedback]);

    // Also expose SPP.evidenceModal for backwards compatibility on Student
    useEffect(() => {
        if (role === 'student' && window.SPP) {
            window.SPP.evidenceModal = {
                open: (mode = 'add') =>
                    setStudentModalState({
                        open: true,
                        mode,
                        evidence: null,
                        busy: false,
                    }),
                openForEdit: (ev) =>
                    setStudentModalState({
                        open: true,
                        mode: 'edit',
                        evidence: ev,
                        busy: false,
                    }),
                openForView: (ev) =>
                    setStudentModalState({
                        open: true,
                        mode: 'view',
                        evidence: ev,
                        busy: false,
                    }),
                close: () =>
                    setStudentModalState((prev) => ({
                        ...prev,
                        open: false,
                        busy: false,
                    })),
                setBusy: (busy) =>
                    setStudentModalState((prev) => ({ ...prev, busy })),
            };
        }
    }, [role]);

    const handleOpenActivity = (activity) => {
        setCurrentActivity(activity);
        setEvidences([]);
        setFeedbacks([]);
        setIsEditingGrade(false);
        setFeedbackText('');
        setEditingFeedbackId(null);
        if (window.SPP_TEACHER?.state) {
            window.SPP_TEACHER.state.activity = activity;
        }
        loadEvidenceAndFeedback(activity, true);

        const actPanel = document.getElementById('activities-panel');
        const evPanel = document.getElementById('evidences-panel');
        const practicePanel = document.querySelector('#practice .practice-panel');
        const logbookPanel = document.getElementById('logbook-panel');
        if (practicePanel) practicePanel.style.display = 'none';
        if (logbookPanel) logbookPanel.style.display = 'none';
        if (actPanel && evPanel) {
            actPanel.style.display = 'none';
            evPanel.style.display = role === 'student' ? 'block' : 'flex';
            resetScroll();
        }
    };

    useEffect(() => {
        const onOpenActivityEvent = async (e) => {
            const { practiceId, activityId } = e.detail || {};
            if (!activityId) return;

            let act = activities.find((a) => String(a.id) === String(activityId));
            if (!act) {
                const targetPracticeId =
                    practiceId ||
                    practiceRef.current?.id ||
                    window.SPP_TEACHER?.state?.practice?.id;
                if (targetPracticeId) {
                    try {
                        const data = await window.SPP.get(
                            `/api/practices/${targetPracticeId}/activities`
                        );
                        const list = data.activities || [];
                        list.forEach((item) => {
                            const roleCount =
                                role === 'advisor'
                                    ? Number(
                                          item.advisorFeedbackCount ??
                                              item.feedbackCount ??
                                              0
                                      )
                                    : Number(
                                          item.tutorFeedbackCount ??
                                              item.feedbackCount ??
                                              0
                                      );
                            item.feedbackCount = roleCount;
                            item.tutorFeedbackCount = roleCount;
                            item.roleFeedbackCount = roleCount;
                            item.hours = Number(item.hours) || 0;
                            item.evidenceCount =
                                Number(item.evidenceCount) || 0;
                        });
                        setActivities(list);
                        act = list.find(
                            (a) => String(a.id) === String(activityId)
                        );
                    } catch (_) {}
                }
            }

            if (act) {
                handleOpenActivity(act);
            }
        };

        window.addEventListener('spp:open-activity', onOpenActivityEvent);
        return () =>
            window.removeEventListener('spp:open-activity', onOpenActivityEvent);
    }, [role, activities, handleOpenActivity]);

    useEffect(() => {
        const onOpenUploadEvidenceEvent = () => {
            const evPanel = document.getElementById('evidences-panel');
            const actPanel = document.getElementById('activities-panel');
            if (evPanel) evPanel.style.display = 'none';
            if (actPanel) actPanel.style.display = 'flex';
            if (!practice && window.SPP_STUDENT_PRACTICE) {
                setPractice(window.SPP_STUDENT_PRACTICE);
                loadActivities(window.SPP_STUDENT_PRACTICE);
            }
            setStudentModalState({
                open: true,
                mode: 'add-activity',
                evidence: null,
                busy: false,
            });
            resetScroll();
        };

        window.addEventListener('spp:open-upload-evidence', onOpenUploadEvidenceEvent);
        return () =>
            window.removeEventListener(
                'spp:open-upload-evidence',
                onOpenUploadEvidenceEvent
            );
    }, [practice, loadActivities]);

    const handleBackToLogbook = () => {
        const actPanel = document.getElementById('activities-panel');
        const logbookPanel = document.getElementById('logbook-panel');
        if (actPanel && logbookPanel) {
            actPanel.style.display = 'none';
            logbookPanel.style.display = 'flex';
            resetScroll();
        }
    };

    const handleBackToActivities = () => {
        const evPanel = document.getElementById('evidences-panel');
        const actPanel = document.getElementById('activities-panel');
        if (evPanel && actPanel) {
            evPanel.style.display = 'none';
            actPanel.style.display = 'flex';
            resetScroll();
        }
        loadActivities();
    };

    // Student submit evidence (add-activity, add, edit)
    const handleStudentEvidenceSubmit = async ({
        mode,
        id,
        newFiles,
        newLinks,
        keptFileIds,
        hours,
        description,
    }) => {
        if (!practice) return;
        const SPP = window.SPP;
        setStudentModalState((prev) => ({ ...prev, busy: true }));
        try {
            const form = new FormData();
            newFiles.forEach((f) => form.append('files', f));
            keptFileIds.forEach((fid) => form.append('keptFileIds', fid));
            if (newLinks.length) {
                form.append(
                    'links',
                    JSON.stringify(
                        newLinks.map((l) => ({ url: l.url, name: l.name }))
                    )
                );
            }
            form.append('description', description);
            form.append('hours', hours);

            if (mode === 'add-activity') {
                const now = new Date();
                const pad = (n) => String(n).padStart(2, '0');
                const localStr = `${now.getFullYear()}-${pad(
                    now.getMonth() + 1
                )}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(
                    now.getMinutes()
                )}:${pad(now.getSeconds())}`;
                const currentP = practice || window.SPP_STUDENT_PRACTICE;
                if (!currentP) throw new Error('Practice not found');
                const createRes = await SPP.request(
                    `/api/practices/${currentP.id}/activities`,
                    {
                        method: 'POST',
                        body: { assignedDate: localStr },
                    }
                );
                const newActivityId = createRes.activity.id;
                await SPP.request(`/api/activities/${newActivityId}/evidences`, {
                    method: 'POST',
                    formData: form,
                });
                await loadActivities();
            } else if (mode === 'add') {
                if (!currentActivity) throw new Error('No activity selected');
                if (isActivityClosed(currentActivity)) {
                    throw new Error('Submissions are closed for this activity');
                }
                await SPP.request(
                    `/api/activities/${currentActivity.id}/evidences`,
                    { method: 'POST', formData: form }
                );
                await loadEvidenceAndFeedback(currentActivity);
                await loadActivities();
            } else {
                if (isActivityClosed(currentActivity)) {
                    throw new Error('Submissions are closed for this activity');
                }
                await SPP.request(`/api/evidences/${encodeURIComponent(id)}`, {
                    method: 'PUT',
                    formData: form,
                });
                await loadEvidenceAndFeedback(currentActivity);
                await loadActivities();
            }

            setStudentModalState({
                open: false,
                mode: 'add',
                evidence: null,
                busy: false,
            });
            setSuccessNotice({
                title: 'Activity Updated',
                message: 'Your activity has been successfully updated.',
            });
        } catch (err) {
            setStudentModalState((prev) => ({ ...prev, busy: false }));
            if (SPP?.showError) SPP.showError(err);
        }
    };

    // Tutor create / edit activity
    const handleTutorActivitySubmit = async ({
        mode,
        title,
        description,
        assignedDate,
        dueDate,
        newFiles,
        keptFileIds,
    }) => {
        if (!practice) return;
        const SPP = window.SPP;
        setTutorModalState((prev) => ({ ...prev, busy: true }));
        try {
            const formData = new FormData();
            formData.append('title', title);
            if (description) formData.append('description', description);
            formData.append('assignedDate', assignedDate);
            formData.append('dueDate', dueDate);
            newFiles.forEach((f) => formData.append('files', f));
            formData.append('keptFileIds', JSON.stringify(keptFileIds));

            if (mode === 'edit' && currentActivity) {
                await SPP.request(
                    `/api/practices/${practice.id}/activities/${currentActivity.id}`,
                    { method: 'PATCH', formData }
                );
                setTutorModalState({
                    open: false,
                    mode: 'create',
                    activity: null,
                    busy: false,
                });
                setSuccessNotice({
                    title: 'Activity Updated',
                    message: 'Your activity has been successfully updated.',
                });
                await loadActivities(currentActivity.id);
            } else {
                const res = await SPP.request(
                    `/api/practices/${practice.id}/activities`,
                    { method: 'POST', formData }
                );
                setTutorModalState({
                    open: false,
                    mode: 'create',
                    activity: null,
                    busy: false,
                });
                setSuccessNotice({
                    title: 'Assignment Submitted',
                    message: 'Your activity has been successfully uploaded.',
                });
                await loadActivities(res?.activity?.id);
            }
        } catch (err) {
            setTutorModalState((prev) => ({ ...prev, busy: false }));
            if (SPP?.showError) SPP.showError(err);
        }
    };

    // Tutor inline grade save
    const handleSaveActivityGrade = async (e) => {
        e.stopPropagation();
        if (!currentActivity || !practice) return;
        const SPP = window.SPP;
        const nuevaNota = gradeInputVal.trim();
        try {
            const numericGrade = nuevaNota ? Number(nuevaNota) : null;
            await SPP.patch(
                `/api/practices/${practice.id}/activities/${currentActivity.id}`,
                { grade: numericGrade }
            );
            setIsEditingGrade(false);
            setCurrentActivity((prev) =>
                prev ? { ...prev, grade: numericGrade } : prev
            );
            await loadActivities(currentActivity.id);
            setSuccessNotice({
                title: 'Success',
                message: 'Activity grade updated successfully!',
            });
        } catch (err) {
            if (SPP?.showError) SPP.showError(err);
        }
    };

    // Tutor / Advisor submit feedback
    const handleSubmitFeedback = async () => {
        if (!currentActivity) return;
        const text = feedbackText.trim();
        if (!text) {
            alert('Please enter a comment before sending.');
            return;
        }
        const SPP = window.SPP;
        setSubmittingFeedback(true);
        try {
            const now = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            const localDate = `${now.getFullYear()}-${pad(
                now.getMonth() + 1
            )}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(
                now.getMinutes()
            )}:${pad(now.getSeconds())}`;

            if (editingFeedbackId) {
                await SPP.patch(
                    `/api/activities/${currentActivity.id}/feedback/${editingFeedbackId}`,
                    { text, date: localDate }
                );
                setEditingFeedbackId(null);
                setSuccessNotice({
                    title: 'Success',
                    message: 'Feedback updated successfully',
                });
            } else {
                const firstEvidenceId = evidences[0]?.id;
                if (!firstEvidenceId) {
                    alert(
                        'This activity has no evidence to give feedback on yet.'
                    );
                    setSubmittingFeedback(false);
                    return;
                }
                await SPP.post(
                    `/api/activities/${currentActivity.id}/feedback`,
                    { text, evidenceId: firstEvidenceId, date: localDate }
                );
                setSuccessNotice({
                    title: 'Success',
                    message: 'Feedback sent successfully',
                });
            }

            setFeedbackText('');
            if (feedbackTextareaRef.current) {
                feedbackTextareaRef.current.style.height = 'auto';
            }
            await loadEvidenceAndFeedback(currentActivity);
            await loadActivities(currentActivity.id);
        } catch (err) {
            if (SPP?.showError) SPP.showError(err);
        } finally {
            setSubmittingFeedback(false);
        }
    };

    // Compute KPI counts
    let pendingCount = 0;
    let reviewCount = 0;
    let completedCount = 0;
    const gradedGrades = [];

    activities.forEach((act) => {
        const rawGrade = act.grade;
        const gradeNum =
            rawGrade !== null && rawGrade !== undefined && rawGrade !== ''
                ? parseFloat(rawGrade)
                : null;
        const hasValidGrade =
            gradeNum !== null && !Number.isNaN(gradeNum) && gradeNum > 0;
        const evidenceCount = Number(act.evidenceCount) || 0;
        const feedbackCount =
            Number(act.tutorFeedbackCount ?? act.feedbackCount) || 0;

        if (evidenceCount === 0) pendingCount++;
        if (evidenceCount > 0 && !hasValidGrade && feedbackCount === 0)
            reviewCount++;
        if (feedbackCount > 0 && !hasValidGrade) completedCount++;
        if (hasValidGrade) gradedGrades.push(gradeNum);
    });

    const avgGradeText =
        gradedGrades.length > 0
            ? `${(
                  gradedGrades.reduce((s, g) => s + g, 0) / gradedGrades.length
              ).toFixed(1)}/5.0`
            : '0.0/5.0';

    const queryLower = searchQuery.trim().toLowerCase();
    const filteredActivities = activities.filter((act) => {
        if (!activityMatchesFilter(act, activeFilter)) return false;
        if (queryLower) {
            const st = getActivityStatusInfo(act);
            const fullText = `${act.number} ${act.title || ''} ${
                act.description || ''
            } ${st.label}`.toLowerCase();
            if (!fullText.includes(queryLower)) return false;
        }
        return true;
    });

    // Activity details derived state
    const isTutorGenerated = Boolean(
        currentActivity?.title &&
            currentActivity.title.toLowerCase() !== 'activity'
    );
    const detailTitle = currentActivity
        ? isTutorGenerated
            ? currentActivity.title
            : `Activity #${currentActivity.number}`
        : 'Activity';
    const assignedDateFormatted = currentActivity
        ? window.SPP?.formatActivityDate?.(
              currentActivity.assignedDate || currentActivity.createdAt
          ) || '-'
        : '-';
    const deadlineFormatted = currentActivity
        ? currentActivity.dueDate || currentActivity.deadline
            ? window.SPP?.formatActivityDate?.(
                  currentActivity.dueDate || currentActivity.deadline
              )
            : 'without limit'
        : 'without limit';
    const totalActivityHours =
        evidences.length > 0
            ? evidences.reduce((sum, ev) => sum + (Number(ev.hours) || 0), 0)
            : Number(currentActivity?.hours || currentActivity?.totalHours) ||
              0;
    const rawCurrentGrade = Number(currentActivity?.grade);
    const gradeFormatted =
        role === 'tutor' || role === 'advisor'
            ? currentActivity?.grade
                ? String(currentActivity.grade)
                : '0.0'
            : currentActivity?.grade != null && rawCurrentGrade > 0
            ? rawCurrentGrade.toFixed(1)
            : 'Not graded';

    const activitiesPanelEl = document.getElementById('activities-panel');
    const evidencesPanelEl = document.getElementById('evidences-panel');

    return (
        <>
            {activitiesPanelEl
                ? createPortal(
                      <>
                          <div className="activities-header">
                              <button
                                  type="button"
                                  className="activities-back-btn"
                                  id="activitiesBack"
                                  aria-label="Back to Practice"
                                  onClick={handleBackToLogbook}
                              >
                                  <i
                                      className="fa-solid fa-arrow-left"
                                      aria-hidden="true"
                                  />
                              </button>
                              <h2
                                  id="activities-title"
                                  className="activities-title"
                                  style={{ margin: 0 }}
                              >
                                  Activities
                              </h2>
                              {role === 'student' && (
                                  <button
                                      type="button"
                                      className="am-open-btn"
                                      id="amOpenBtnActivities"
                                      style={{
                                          margin: 0,
                                          whiteSpace: 'nowrap',
                                      }}
                                      onClick={() =>
                                          setStudentModalState({
                                              open: true,
                                              mode: 'add-activity',
                                              evidence: null,
                                              busy: false,
                                          })
                                      }
                                  >
                                      <i
                                          className="fa-solid fa-circle-plus"
                                          aria-hidden="true"
                                      />
                                      <span>Upload evidence</span>
                                  </button>
                              )}
                              {role === 'tutor' && (
                                  <button
                                      type="button"
                                      className="am-open-btn"
                                      id="amOpenBtn"
                                      onClick={() =>
                                          setTutorModalState({
                                              open: true,
                                              mode: 'create',
                                              activity: null,
                                              busy: false,
                                          })
                                      }
                                  >
                                      <i
                                          className="fa-solid fa-circle-plus"
                                          aria-hidden="true"
                                      />
                                      <span>Assign Activity</span>
                                  </button>
                              )}
                          </div>

                          {/* Summary KPI Stats Cards */}
                          <div className="act-kpis" id="act-kpis">
                              <div
                                  className="act-kpi-card"
                                  id="act-kpi-card-pending"
                                  role="button"
                                  tabIndex={0}
                                  title="Filter pending tasks"
                                  onClick={() => setActiveFilter('pending')}
                                  onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault();
                                          setActiveFilter('pending');
                                      }
                                  }}
                              >
                                  <div className="act-kpi-icon act-kpi-icon--pending">
                                      <i
                                          className="fa-regular fa-calendar-days"
                                          aria-hidden="true"
                                      />
                                  </div>
                                  <div className="act-kpi-content">
                                      <span className="act-kpi-label">
                                          Pending Tasks:
                                      </span>
                                      <strong
                                          className="act-kpi-val"
                                          id="act-kpi-pending"
                                      >
                                          {loadingActivities ? (
                                              <span className="hm-skel act-kpi-skel" />
                                          ) : (
                                              pendingCount
                                          )}
                                      </strong>
                                  </div>
                              </div>
                              <div
                                  className="act-kpi-card"
                                  id="act-kpi-card-review"
                                  role="button"
                                  tabIndex={0}
                                  title="Filter activities pending review"
                                  onClick={() => setActiveFilter('review')}
                                  onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault();
                                          setActiveFilter('review');
                                      }
                                  }}
                              >
                                  <div className="act-kpi-icon act-kpi-icon--review">
                                      <i
                                          className="fa-solid fa-triangle-exclamation"
                                          aria-hidden="true"
                                      />
                                  </div>
                                  <div className="act-kpi-content">
                                      <span className="act-kpi-label">
                                          Pending Review:
                                      </span>
                                      <strong
                                          className="act-kpi-val"
                                          id="act-kpi-review"
                                      >
                                          {loadingActivities ? (
                                              <span className="hm-skel act-kpi-skel" />
                                          ) : (
                                              reviewCount
                                          )}
                                      </strong>
                                  </div>
                              </div>
                              <div
                                  className="act-kpi-card"
                                  id="act-kpi-card-completed"
                                  role="button"
                                  tabIndex={0}
                                  title="Filter completed activities"
                                  onClick={() => setActiveFilter('completed')}
                                  onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault();
                                          setActiveFilter('completed');
                                      }
                                  }}
                              >
                                  <div className="act-kpi-icon act-kpi-icon--completed">
                                      <i
                                          className="fa-solid fa-check"
                                          aria-hidden="true"
                                      />
                                  </div>
                                  <div className="act-kpi-content">
                                      <span className="act-kpi-label">
                                          Completed:
                                      </span>
                                      <strong
                                          className="act-kpi-val"
                                          id="act-kpi-completed"
                                      >
                                          {loadingActivities ? (
                                              <span className="hm-skel act-kpi-skel" />
                                          ) : (
                                              completedCount
                                          )}
                                      </strong>
                                  </div>
                              </div>
                              <div
                                  className="act-kpi-card"
                                  id="act-kpi-card-grade"
                                  role="button"
                                  tabIndex={0}
                                  title="Filter graded activities"
                                  onClick={() => setActiveFilter('graded')}
                                  onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault();
                                          setActiveFilter('graded');
                                      }
                                  }}
                              >
                                  <div className="act-kpi-icon act-kpi-icon--grade">
                                      <i
                                          className="fa-solid fa-chart-line"
                                          aria-hidden="true"
                                      />
                                  </div>
                                  <div className="act-kpi-content">
                                      <span className="act-kpi-label">
                                          Average Grade:
                                      </span>
                                      <strong
                                          className="act-kpi-val"
                                          id="act-kpi-grade"
                                      >
                                          {loadingActivities ? (
                                              <span className="hm-skel act-kpi-skel" />
                                          ) : (
                                              avgGradeText
                                          )}
                                      </strong>
                                  </div>
                              </div>
                          </div>

                          {/* Search & Filter Controls */}
                          <div className="act-controls">
                              <div className="act-search-box">
                                  <input
                                      type="text"
                                      id="act-search-input"
                                      className="act-search-input"
                                      placeholder="Search"
                                      aria-label="Search activities"
                                      autoComplete="off"
                                      value={searchQuery}
                                      onChange={(e) =>
                                          setSearchQuery(e.target.value)
                                      }
                                  />
                                  <i
                                      className="fa-solid fa-magnifying-glass act-search-icon"
                                      aria-hidden="true"
                                  />
                              </div>
                              <div
                                  className="act-filter-pills"
                                  role="tablist"
                                  aria-label="Activity Filters"
                              >
                                  {[
                                      { key: 'all', label: 'All' },
                                      {
                                          key: 'pending',
                                          label: 'To Do / Pending',
                                      },
                                      {
                                          key: 'review',
                                          label: 'Pending Review',
                                          icon: 'fa-solid fa-triangle-exclamation',
                                      },
                                      { key: 'completed', label: 'Completed' },
                                      { key: 'graded', label: 'Graded' },
                                  ].map((pill) => (
                                      <button
                                          key={pill.key}
                                          type="button"
                                          className={`act-pill-btn${
                                              activeFilter === pill.key
                                                  ? ' is-active'
                                                  : ''
                                          }`}
                                          data-filter={pill.key}
                                          onClick={() =>
                                              setActiveFilter(pill.key)
                                          }
                                      >
                                          {pill.icon ? (
                                              <>
                                                  <i
                                                      className={pill.icon}
                                                      aria-hidden="true"
                                                  />{' '}
                                              </>
                                          ) : null}
                                          {pill.label}
                                      </button>
                                  ))}
                              </div>
                          </div>

                          {/* Grid of Activity Cards */}
                          <div
                              id={
                                  role === 'student'
                                      ? 'activities-container'
                                      : 'activities-list-container'
                              }
                              className="act-grid"
                          >
                              {loadingActivities ? (
                                  [1, 2, 3].map((n) => (
                                      <div
                                          key={`skel-${n}`}
                                          className="act-card act-card--skel"
                                          aria-hidden="true"
                                      >
                                          <div className="act-card-header">
                                              <div className="act-card-icon hm-skel" />
                                              <div className="hm-skel act-skel-line act-skel-line--md" />
                                          </div>
                                          <div className="act-card-body">
                                              <div className="act-doc-thumb hm-skel" />
                                              <div
                                                  className="act-card-info"
                                                  style={{ flex: 1 }}
                                              >
                                                  <div
                                                      className="hm-skel act-skel-line act-skel-line--sm"
                                                      style={{
                                                          marginBottom: '8px',
                                                      }}
                                                  />
                                                  <div className="hm-skel act-skel-pill" />
                                              </div>
                                          </div>
                                      </div>
                                  ))
                              ) : filteredActivities.length === 0 ? (
                                  <div className="act-empty-msg">
                                      <i
                                          className="fa-regular fa-folder-open"
                                          aria-hidden="true"
                                      />
                                      <p>
                                          {activities.length === 0
                                              ? 'This practice currently has no activities assigned.'
                                              : 'No activities found matching your search or filter.'}
                                      </p>
                                  </div>
                              ) : (
                                  filteredActivities.map((activity) => {
                                      const status =
                                          getActivityStatusInfo(activity);
                                      const title =
                                          formatActivityTitle(activity);
                                      const dueFormatted = formatCardDueDate(
                                          activity.dueDate
                                      );

                                      return (
                                          <div
                                              key={
                                                  activity.id || activity.number
                                              }
                                              className="act-card"
                                              data-activity={activity.number}
                                              tabIndex={0}
                                              role="button"
                                              aria-label={`${title}, ${dueFormatted}, Status: ${status.label}`}
                                              onClick={() =>
                                                  handleOpenActivity(activity)
                                              }
                                              onKeyDown={(e) => {
                                                  if (
                                                      e.key === 'Enter' ||
                                                      e.key === ' '
                                                  ) {
                                                      e.preventDefault();
                                                      handleOpenActivity(
                                                          activity
                                                      );
                                                  }
                                              }}
                                          >
                                              <div className="act-card-header">
                                                  <div
                                                      className="act-card-icon"
                                                      aria-hidden="true"
                                                  >
                                                      <i className="fa-solid fa-file-lines" />
                                                  </div>
                                                  <h3
                                                      className="act-card-title"
                                                      title={title}
                                                  >
                                                      {title}
                                                  </h3>
                                              </div>
                                              <div className="act-card-body">
                                                  <div
                                                      className="act-doc-thumb"
                                                      aria-hidden="true"
                                                  >
                                                      <div className="act-doc-head" />
                                                      <div className="act-doc-line" />
                                                      <div className="act-doc-line" />
                                                      <div className="act-doc-line short" />
                                                      <div className="act-doc-line" />
                                                      <div className="act-doc-line short" />
                                                  </div>
                                                  <div className="act-card-info">
                                                      <span className="act-card-due">
                                                          {dueFormatted}
                                                      </span>
                                                      <span
                                                          className={`act-status-badge ${status.badgeClass}`}
                                                      >
                                                          {status.icon ? (
                                                              <i
                                                                  className={
                                                                      status.icon
                                                                  }
                                                                  style={{
                                                                      marginRight:
                                                                          '5px',
                                                                  }}
                                                                  aria-hidden="true"
                                                              />
                                                          ) : null}
                                                          {status.label}
                                                      </span>
                                                  </div>
                                                  <button
                                                      type="button"
                                                      className="act-arrow-btn activity-enter-btn"
                                                      data-activity={
                                                          activity.number
                                                      }
                                                      aria-label="Open activity"
                                                      onClick={(e) => {
                                                          e.stopPropagation();
                                                          handleOpenActivity(
                                                              activity
                                                          );
                                                      }}
                                                  >
                                                      <i
                                                          className="fa-solid fa-arrow-right"
                                                          aria-hidden="true"
                                                      />
                                                  </button>
                                              </div>
                                          </div>
                                      );
                                  })
                              )}
                          </div>
                      </>,
                      activitiesPanelEl
                  )
                : null}

            {evidencesPanelEl
                ? createPortal(
                      <>
                          <div className="evidences-header">
                              <button
                                  type="button"
                                  className="evidences-back-btn"
                                  id="evidencesBack"
                                  aria-label="Back to Activities"
                                  onClick={handleBackToActivities}
                              >
                                  <i
                                      className="fa-solid fa-arrow-left"
                                      aria-hidden="true"
                                  />
                              </button>
                              <h2
                                  id="evidences-title"
                                  className="evidences-title"
                              >
                                  {detailTitle}
                              </h2>

                              {role === 'tutor' && isTutorGenerated ? (
                                  <DropdownMenu
                                      id="act-main-menu"
                                      style={{ marginLeft: 'auto' }}
                                      ariaLabel="Activity options"
                                      items={[
                                          {
                                              label: 'Edit',
                                              icon: 'fa-solid fa-pen-to-square',
                                              className:
                                                  'ev-item--edit act-edit-btn',
                                              onClick: () =>
                                                  setTutorModalState({
                                                      open: true,
                                                      mode: 'edit',
                                                      activity: currentActivity,
                                                      busy: false,
                                                  }),
                                          },
                                          {
                                              label: 'Delete',
                                              icon: 'fa-solid fa-trash',
                                              className: 'ev-item--delete',
                                              hidden: evidences.length > 0,
                                              onClick: () =>
                                                  setConfirmDeleteConfig({
                                                      type: 'activity',
                                                      name: detailTitle,
                                                      onConfirm: async () => {
                                                          if (!currentActivity)
                                                              return;
                                                          setDeleteBusy(true);
                                                          try {
                                                              await window.SPP.del(
                                                                  `/api/practices/${
                                                                      currentActivity.practiceId ||
                                                                      practice?.id
                                                                  }/activities/${
                                                                      currentActivity.id
                                                                  }`
                                                              );
                                                              setConfirmDeleteConfig(
                                                                  null
                                                              );
                                                              handleBackToActivities();
                                                          } catch (err) {
                                                              if (
                                                                  window.SPP
                                                                      ?.showError
                                                              )
                                                                  window.SPP.showError(
                                                                      err
                                                                  );
                                                          } finally {
                                                              setDeleteBusy(
                                                                  false
                                                              );
                                                          }
                                                      },
                                                  }),
                                          },
                                      ]}
                                  />
                              ) : null}
                          </div>

                          {/* Activity Details Card */}
                          <div
                              className="act-details-card"
                              style={{
                                  display: isTutorGenerated ? 'flex' : 'block',
                              }}
                          >
                              <div
                                  className="act-details-left"
                                  id="act-left-panel"
                                  style={{
                                      width: isTutorGenerated ? '' : '100%',
                                  }}
                              >
                                  <div className="act-details-header-row">
                                      <h3 className="act-details-title">
                                          Activity Information
                                      </h3>
                                  </div>
                                  <div className="act-field">
                                      <span className="act-label">
                                          Activity Name
                                      </span>
                                      <div
                                          className="act-value-box"
                                          id={
                                              role === 'student'
                                                  ? 'act-name'
                                                  : 'act-name-display'
                                          }
                                      >
                                          {detailTitle}
                                      </div>
                                  </div>
                                  <div
                                      className="act-row"
                                      id="act-grid-row"
                                      style={{
                                          display: 'grid',
                                          gridTemplateColumns: isTutorGenerated
                                              ? 'repeat(4, 1fr)'
                                              : 'repeat(3, 1fr)',
                                          gap: '24px',
                                      }}
                                  >
                                      <div className="act-field act-field--date">
                                          <span
                                              className="act-label"
                                              id="lbl-assigned-date"
                                          >
                                              {isTutorGenerated
                                                  ? 'Assignment Date'
                                                  : 'Assigned Date'}
                                          </span>
                                          <div className="act-value-box">
                                              <span
                                                  id={
                                                      role === 'student'
                                                          ? 'act-assigned-date'
                                                          : 'act-start-display'
                                                  }
                                              >
                                                  {assignedDateFormatted}
                                              </span>
                                              {!isTutorGenerated ? (
                                                  <i
                                                      className="fa-regular fa-calendar"
                                                      id="act-calendar-icon"
                                                      aria-hidden="true"
                                                  />
                                              ) : null}
                                          </div>
                                      </div>

                                      {isTutorGenerated ? (
                                          <div
                                              className="act-field act-field--date"
                                              id="act-deadline-container"
                                          >
                                              <span className="act-label">
                                                  Deadline
                                              </span>
                                              <div
                                                  className="act-value-box"
                                                  id={
                                                      role === 'student'
                                                          ? 'act-deadline-date'
                                                          : 'act-end-display'
                                                  }
                                              >
                                                  {deadlineFormatted}
                                              </div>
                                          </div>
                                      ) : null}

                                      <div
                                          className="act-field"
                                          id="act-nota-container"
                                          style={
                                              role === 'tutor'
                                                  ? {
                                                        cursor: 'pointer',
                                                        WebkitTapHighlightColor:
                                                            'transparent',
                                                    }
                                                  : undefined
                                          }
                                          onClick={() => {
                                              if (
                                                  role === 'tutor' &&
                                                  !isEditingGrade
                                              ) {
                                                  setGradeInputVal(
                                                      gradeFormatted
                                                  );
                                                  setIsEditingGrade(true);
                                              }
                                          }}
                                      >
                                          <span
                                              className="act-label"
                                              id="lbl-grade"
                                          >
                                              {isTutorGenerated
                                                  ? 'Grade:'
                                                  : 'Grade'}
                                          </span>
                                          {!isEditingGrade ? (
                                              <div
                                                  className="act-value-box"
                                                  id={
                                                      role === 'student'
                                                          ? 'act-grade'
                                                          : 'act-grade-display'
                                                  }
                                              >
                                                  {gradeFormatted}
                                              </div>
                                          ) : (
                                              <input
                                                  type="number"
                                                  id="act-grade-input"
                                                  className="act-value-box act-input"
                                                  min="0"
                                                  max="5"
                                                  step="0.1"
                                                  placeholder="0.0"
                                                  value={gradeInputVal}
                                                  autoFocus
                                                  onClick={(e) =>
                                                      e.stopPropagation()
                                                  }
                                                  onChange={(e) =>
                                                      setGradeInputVal(
                                                          e.target.value
                                                      )
                                                  }
                                              />
                                          )}
                                      </div>

                                      <div className="act-field">
                                          <span
                                              className="act-label"
                                              id="lbl-hours"
                                          >
                                              {isTutorGenerated
                                                  ? 'Hours Completed'
                                                  : 'Hours Worked'}
                                          </span>
                                          <div
                                              className="act-value-box"
                                              id={
                                                  role === 'student'
                                                      ? 'act-hours'
                                                      : 'act-hours-display'
                                              }
                                          >
                                              {totalActivityHours}
                                          </div>
                                      </div>
                                  </div>

                                  {role === 'tutor' && isEditingGrade ? (
                                      <div
                                          className="am-actions"
                                          id="act-nota-actions"
                                          style={{
                                              display: 'flex',
                                              justifyContent: 'flex-end',
                                              marginTop: '5px',
                                              marginBottom: '15px',
                                              gap: '10px',
                                          }}
                                      >
                                          <button
                                              type="button"
                                              className="am-btn-cancel"
                                              id="act-nota-cancel-btn"
                                              onClick={(e) => {
                                                  e.stopPropagation();
                                                  setIsEditingGrade(false);
                                              }}
                                          >
                                              Cancel
                                          </button>
                                          <button
                                              type="button"
                                              className="am-btn-confirm"
                                              id="act-nota-save-btn"
                                              onClick={handleSaveActivityGrade}
                                          >
                                              Save
                                          </button>
                                      </div>
                                  ) : null}

                                  {isTutorGenerated ? (
                                      <div
                                          className="act-field"
                                          id="act-desc-container"
                                      >
                                          <span className="act-label">
                                              Description
                                          </span>
                                          <div
                                              className="act-desc-box"
                                              id={
                                                  role === 'student'
                                                      ? 'act-desc'
                                                      : 'act-desc-display'
                                              }
                                          >
                                              {currentActivity?.description ||
                                                  'No description provided'}
                                          </div>
                                      </div>
                                  ) : null}
                              </div>

                              {isTutorGenerated ? (
                                  <div
                                      className="act-details-right"
                                      id="act-right-panel"
                                  >
                                      <div
                                          className="am-file-list"
                                          id={
                                              role === 'student'
                                                  ? 'act-files'
                                                  : 'act-files-display'
                                          }
                                      >
                                          {(currentActivity?.files || [])
                                              .length === 0 ? (
                                              <span
                                                  style={{
                                                      color: '#666',
                                                      fontStyle: 'italic',
                                                  }}
                                              >
                                                  No files attached
                                              </span>
                                          ) : (
                                              (
                                                  currentActivity?.files || []
                                              ).map((f, idx) => (
                                                  <a
                                                      key={idx}
                                                      href={f.url}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="am-file-chip"
                                                      style={{
                                                          cursor: 'pointer',
                                                          textDecoration:
                                                              'none',
                                                          color: 'inherit',
                                                          display:
                                                              'inline-flex',
                                                      }}
                                                  >
                                                      <i
                                                          className={fileIcon(
                                                              f
                                                          )}
                                                      />
                                                      <span className="am-file-chip-name">
                                                          {f.name}
                                                      </span>
                                                  </a>
                                              ))
                                          )}
                                      </div>
                                  </div>
                              ) : null}
                          </div>

                          {/* Evidence Section Header */}
                          {role === 'student' ? (
                              <div className="evidences-header">
                                  <h3 className="feedback-title evidences-subtitle">
                                      Activity Evidence
                                  </h3>
                                  {!isActivityClosed(currentActivity) ? (
                                      <button
                                          type="button"
                                          className="am-open-btn"
                                          id="amOpenBtn"
                                          onClick={() =>
                                              setStudentModalState({
                                                  open: true,
                                                  mode: 'add',
                                                  evidence: null,
                                                  busy: false,
                                              })
                                          }
                                      >
                                          <i
                                              className="fa-solid fa-circle-plus"
                                              aria-hidden="true"
                                          />
                                          <span>Upload evidence</span>
                                      </button>
                                  ) : null}
                              </div>
                          ) : (
                              <h3
                                  className="feedback-title"
                                  style={{ margin: '10px 0 20px 0' }}
                              >
                                  Activity Evidence
                              </h3>
                          )}

                          {/* Evidence Cards List */}
                          {loadingDetail ? (
                              <>
                                  <div
                                      className="hm-skel ev-skel-card"
                                      aria-hidden="true"
                                  />
                                  <div
                                      className="hm-skel ev-skel-card"
                                      aria-hidden="true"
                                  />
                              </>
                          ) : evidences.length === 0 ? (
                              <p
                                  className="ev-empty"
                                  style={{
                                      padding: '16px 0',
                                      opacity: 0.7,
                                      textAlign: 'left',
                                  }}
                              >
                                  {role === 'student'
                                      ? 'You have not uploaded evidence for this activity yet.'
                                      : 'The student has not uploaded evidence for this activity yet.'}
                              </p>
                          ) : (
                              evidences.map((ev) => {
                                  const closed =
                                      isActivityClosed(currentActivity);
                                  const descText =
                                      ev.description ||
                                      'No description provided';
                                  const truncatedDesc =
                                      descText.length > 70
                                          ? `${descText.slice(0, 67)}...`
                                          : descText;

                                  const openView = () => {
                                      if (role === 'student') {
                                          setStudentModalState({
                                              open: true,
                                              mode: 'view',
                                              evidence: ev,
                                              busy: false,
                                          });
                                      } else {
                                          setViewEvidenceTarget(ev);
                                      }
                                  };

                                  return (
                                      <div key={ev.id} className="ev-card">
                                          <div
                                              className="ev-card-body"
                                              style={
                                                  role === 'student' && closed
                                                      ? { cursor: 'pointer' }
                                                      : undefined
                                              }
                                              title={
                                                  role === 'student' && closed
                                                      ? 'Click to view evidence'
                                                      : undefined
                                              }
                                              onClick={() => {
                                                  if (
                                                      role === 'student' &&
                                                      closed
                                                  ) {
                                                      openView();
                                                  }
                                              }}
                                          >
                                              <p className="ev-card-title">
                                                  {ev.hours != null
                                                      ? `${ev.hours} Hours`
                                                      : '0 Hours'}
                                              </p>
                                              <p className="ev-card-desc">
                                                  {truncatedDesc}
                                                  {ev.files &&
                                                  ev.files.length > 0 ? (
                                                      <span
                                                          style={{
                                                              marginTop: '12px',
                                                              display: 'flex',
                                                              flexWrap: 'wrap',
                                                              gap: '8px',
                                                          }}
                                                      >
                                                          {ev.files.map(
                                                              (f, fIdx) => (
                                                                  <a
                                                                      key={fIdx}
                                                                      href={
                                                                          f.url
                                                                      }
                                                                      target="_blank"
                                                                      rel="noopener noreferrer"
                                                                      className="am-file-chip"
                                                                      style={{
                                                                          cursor: 'pointer',
                                                                          textDecoration:
                                                                              'none',
                                                                          color: 'inherit',
                                                                          display:
                                                                              'inline-flex',
                                                                      }}
                                                                      onClick={(
                                                                          e
                                                                      ) =>
                                                                          e.stopPropagation()
                                                                      }
                                                                  >
                                                                      <i
                                                                          className={fileIcon(
                                                                              f
                                                                          )}
                                                                      />
                                                                      <span className="am-file-chip-name">
                                                                          {
                                                                              f.name
                                                                          }
                                                                      </span>
                                                                  </a>
                                                              )
                                                          )}
                                                      </span>
                                                  ) : null}
                                              </p>
                                          </div>
                                          <DropdownMenu
                                              ariaLabel="Evidence options"
                                              items={[
                                                  {
                                                      label: 'View',
                                                      icon: 'fa-solid fa-eye',
                                                      className:
                                                          'ev-item--view',
                                                      onClick: openView,
                                                  },
                                                  {
                                                      label: 'Edit',
                                                      icon: 'fa-solid fa-pen-to-square',
                                                      className:
                                                          'ev-item--edit',
                                                      hidden:
                                                          role !== 'student' ||
                                                          closed,
                                                      onClick: () =>
                                                          setStudentModalState({
                                                              open: true,
                                                              mode: 'edit',
                                                              evidence: ev,
                                                              busy: false,
                                                          }),
                                                  },
                                                  {
                                                      label: 'Delete',
                                                      icon: 'fa-solid fa-trash',
                                                      className:
                                                          'ev-item--delete',
                                                      hidden:
                                                          role !== 'student' ||
                                                          closed,
                                                      onClick: () =>
                                                          setConfirmDeleteConfig(
                                                              {
                                                                  type: 'evidence',
                                                                  hours: ev.hours,
                                                                  onConfirm:
                                                                      async () => {
                                                                          setDeleteBusy(
                                                                              true
                                                                          );
                                                                          try {
                                                                              await window.SPP.del(
                                                                                  `/api/evidences/${encodeURIComponent(
                                                                                      ev.id
                                                                                  )}`
                                                                              );
                                                                              setConfirmDeleteConfig(
                                                                                  null
                                                                              );
                                                                              await loadEvidenceAndFeedback(
                                                                                  currentActivity
                                                                              );
                                                                              await loadActivities(
                                                                                  currentActivity?.id
                                                                              );
                                                                          } catch (err) {
                                                                              if (
                                                                                  window
                                                                                      .SPP
                                                                                      ?.showError
                                                                              )
                                                                                  window.SPP.showError(
                                                                                      err
                                                                                  );
                                                                          } finally {
                                                                              setDeleteBusy(
                                                                                  false
                                                                              );
                                                                          }
                                                                      },
                                                              }
                                                          ),
                                                  },
                                              ]}
                                          />
                                      </div>
                                  );
                              })
                          )}

                          {/* Feedback Section */}
                          <div className="feedback-section">
                              <h3 className="feedback-title">Feedback</h3>

                              {loadingDetail ? (
                                  <div
                                      className="hm-skel ev-skel-card"
                                      aria-hidden="true"
                                  />
                              ) : feedbacks.length === 0 ? (
                                  <p
                                      className="ev-empty"
                                      style={{
                                          padding: '16px 0',
                                          opacity: 0.7,
                                          textAlign: 'left',
                                      }}
                                  >
                                      There is no feedback yet.
                                  </p>
                              ) : (
                                  feedbacks.map((fb) => {
                                      const words = (fb.text || '')
                                          .trim()
                                          .split(/\s+/)
                                          .filter(Boolean);
                                      const truncatedText =
                                          words.length > 10
                                              ? `${words
                                                    .slice(0, 10)
                                                    .join(' ')}...`
                                              : fb.text || '';
                                      const isOwner = Boolean(
                                          (role === 'tutor' ||
                                              role === 'advisor') &&
                                              currentUser &&
                                              currentUser.documentNumber ===
                                                  fb.authorDocument
                                      );

                                      return (
                                          <div
                                              key={fb.id}
                                              className="feedback-card"
                                          >
                                              <div
                                                  className="feedback-card-body"
                                                  style={{ cursor: 'pointer' }}
                                                  title="Click to view full feedback"
                                                  onClick={() =>
                                                      setViewFeedbackText(
                                                          fb.text
                                                      )
                                                  }
                                              >
                                                  <div className="feedback-header">
                                                      <span className="feedback-role">
                                                          {fb.role === 'advisor'
                                                              ? 'Advisor'
                                                              : 'Tutor'}
                                                      </span>
                                                      <span className="feedback-date">
                                                          {window.SPP?.formatDateTime?.(
                                                              fb.date
                                                          ) || fb.date}
                                                      </span>
                                                  </div>
                                                  <p className="feedback-content">
                                                      {truncatedText}
                                                  </p>
                                              </div>
                                              <DropdownMenu
                                                  ariaLabel="Feedback options"
                                                  items={[
                                                      {
                                                          label: 'View',
                                                          icon: 'fa-solid fa-eye',
                                                          className:
                                                              'ev-item--view',
                                                          onClick: () =>
                                                              setViewFeedbackText(
                                                                  fb.text
                                                              ),
                                                      },
                                                      {
                                                          label: 'Edit',
                                                          icon: 'fa-solid fa-pen',
                                                          className:
                                                              'ev-item--edit',
                                                          hidden: !isOwner,
                                                          onClick: () => {
                                                              setFeedbackText(
                                                                  fb.text || ''
                                                              );
                                                              setEditingFeedbackId(
                                                                  fb.id
                                                              );
                                                              setTimeout(() => {
                                                                  if (
                                                                      feedbackTextareaRef.current
                                                                  ) {
                                                                      feedbackTextareaRef.current.style.height =
                                                                          'auto';
                                                                      feedbackTextareaRef.current.style.height = `${Math.min(
                                                                          feedbackTextareaRef
                                                                              .current
                                                                              .scrollHeight,
                                                                          200
                                                                      )}px`;
                                                                      feedbackTextareaRef.current.focus();
                                                                  }
                                                              }, 20);
                                                          },
                                                      },
                                                      {
                                                          label: 'Delete',
                                                          icon: 'fa-solid fa-trash',
                                                          className:
                                                              'ev-item--delete',
                                                          hidden: !isOwner,
                                                          onClick: () =>
                                                              setConfirmDeleteConfig(
                                                                  {
                                                                      type: 'feedback',
                                                                      onConfirm:
                                                                          async () => {
                                                                              if (
                                                                                  !currentActivity
                                                                              )
                                                                                  return;
                                                                              setDeleteBusy(
                                                                                  true
                                                                              );
                                                                              try {
                                                                                  await window.SPP.del(
                                                                                      `/api/activities/${currentActivity.id}/feedback/${fb.id}`
                                                                                  );
                                                                                  setConfirmDeleteConfig(
                                                                                      null
                                                                                  );
                                                                                  await loadEvidenceAndFeedback(
                                                                                      currentActivity
                                                                                  );
                                                                                  await loadActivities(
                                                                                      currentActivity.id
                                                                                  );
                                                                              } catch (err) {
                                                                                  if (
                                                                                      window
                                                                                          .SPP
                                                                                          ?.showError
                                                                                  )
                                                                                      window.SPP.showError(
                                                                                          err
                                                                                      );
                                                                              } finally {
                                                                                  setDeleteBusy(
                                                                                      false
                                                                                  );
                                                                              }
                                                                          },
                                                                  }
                                                              ),
                                                      },
                                                  ]}
                                              />
                                          </div>
                                      );
                                  })
                              )}

                              {(role === 'tutor' || role === 'advisor') &&
                              evidences.length > 0 ? (
                                  <div className="feedback-form-section">
                                      <h4 className="feedback-form-title">
                                          {editingFeedbackId
                                              ? 'Edit feedback'
                                              : 'Add Comment:'}
                                      </h4>
                                      <div className="feedback-input-wrapper">
                                          <textarea
                                              ref={feedbackTextareaRef}
                                              className="feedback-textarea"
                                              placeholder="Enter the text..."
                                              value={feedbackText}
                                              onChange={(e) => {
                                                  setFeedbackText(
                                                      e.target.value
                                                  );
                                                  const el = e.target;
                                                  el.style.height = 'auto';
                                                  el.style.height = `${Math.min(
                                                      el.scrollHeight,
                                                      200
                                                  )}px`;
                                                  if (
                                                      typeof window.scrollAppShellToReveal ===
                                                          'function' &&
                                                      feedbackCancelRef.current
                                                  ) {
                                                      requestAnimationFrame(
                                                          () =>
                                                              window.scrollAppShellToReveal(
                                                                  feedbackCancelRef.current
                                                              )
                                                      );
                                                  }
                                              }}
                                          />
                                          <button
                                              type="button"
                                              className="feedback-btn-submit"
                                              aria-label="Send Feedback"
                                              disabled={submittingFeedback}
                                              onClick={handleSubmitFeedback}
                                          >
                                              <i className="fa-solid fa-paper-plane" />
                                          </button>
                                      </div>
                                      <div className="feedback-actions">
                                          <button
                                              ref={feedbackCancelRef}
                                              type="button"
                                              className="feedback-btn-cancel"
                                              onClick={() => {
                                                  setFeedbackText('');
                                                  setEditingFeedbackId(null);
                                                  if (
                                                      feedbackTextareaRef.current
                                                  ) {
                                                      feedbackTextareaRef.current.style.height =
                                                          'auto';
                                                  }
                                              }}
                                          >
                                              <i className="fa-solid fa-trash-can" />{' '}
                                              Cancel
                                          </button>
                                      </div>
                                  </div>
                              ) : null}
                          </div>
                      </>,
                      evidencesPanelEl
                  )
                : null}

            {/* Role-specific & shared Modals */}
            {role === 'student' && (
                <StudentEvidenceModal
                    open={studentModalState.open}
                    mode={studentModalState.mode}
                    evidence={studentModalState.evidence}
                    busy={studentModalState.busy}
                    onClose={() =>
                        setStudentModalState((prev) => ({
                            ...prev,
                            open: false,
                            busy: false,
                        }))
                    }
                    onSubmit={handleStudentEvidenceSubmit}
                />
            )}

            {role === 'tutor' && (
                <TutorActivityModal
                    open={tutorModalState.open}
                    mode={tutorModalState.mode}
                    activity={tutorModalState.activity}
                    busy={tutorModalState.busy}
                    onClose={() =>
                        setTutorModalState((prev) => ({
                            ...prev,
                            open: false,
                            busy: false,
                        }))
                    }
                    onSubmit={handleTutorActivitySubmit}
                />
            )}

            <ViewEvidenceModal
                evidence={viewEvidenceTarget}
                onClose={() => setViewEvidenceTarget(null)}
            />

            <ViewFeedbackModal
                text={viewFeedbackText}
                onClose={() => setViewFeedbackText(null)}
            />

            <ConfirmDeleteModal
                config={confirmDeleteConfig}
                busy={deleteBusy}
                onClose={() => setConfirmDeleteConfig(null)}
            />

            <SuccessNoticeModal
                notice={successNotice}
                onClose={() => setSuccessNotice(null)}
            />
        </>
    );
}
