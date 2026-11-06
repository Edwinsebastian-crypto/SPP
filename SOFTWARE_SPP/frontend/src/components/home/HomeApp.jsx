import React, { useEffect, useState, useRef, useCallback } from 'react';

const REFRESH_AFTER_MS = 30000;
const STATUS_PILL = {
    active: ['ok', 'Active'],
    completed: ['muted', 'Completed'],
    cancelled: ['danger', 'Cancelled']
};
const ROLE_PILL = { tutor: 'Tutor', advisor: 'Advisor', student: 'Student', director: 'Director' };
const ROLE_ICONS = {
    student: 'fa-user-graduate',
    tutor: 'fa-chalkboard-user',
    advisor: 'fa-user-tie',
    director: 'fa-user-shield'
};

const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
const num = (n) => (n == null ? '—' : Number(n).toLocaleString('en-US'));
const initials = (name) =>
    String(name || '?')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w.charAt(0))
        .join('')
        .toUpperCase() || '?';
const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 19 ? 'Good afternoon' : 'Good evening';
};
const today = () =>
    new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
const clock = (value) =>
    new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

function relative(days) {
    if (days == null) return '';
    if (days < 0) return 'overdue by ' + plural(-days, 'day', 'days');
    if (days === 0) return 'today';
    if (days === 1) return 'tomorrow';
    return 'in ' + plural(days, 'day', 'days');
}

const pillFor = (days) => (days == null ? 'muted' : days < 0 ? 'danger' : days <= 3 ? 'warn' : 'info');

function HmRing({ pct, center, small, label }) {
    const C = 226.2;
    const offset = C * (1 - Math.max(0, Math.min(100, pct || 0)) / 100);
    return (
        <div className="hm-hero-ring">
            <div className="hm-ring" role="img" aria-label={`${label}: ${center}`}>
                <svg viewBox="0 0 88 88" aria-hidden="true">
                    <circle className="hm-ring-bg" cx="44" cy="44" r="36" />
                    <circle
                        className="hm-ring-fill"
                        cx="44"
                        cy="44"
                        r="36"
                        style={{ strokeDasharray: C, strokeDashoffset: offset }}
                    />
                </svg>
                <div className="hm-ring-center">
                    <b>{center}</b>
                    <small>{small}</small>
                </div>
            </div>
            <span className="hm-ring-label">{label}</span>
        </div>
    );
}

function HmHero({ user, text, actions, ringNode, onAction }) {
    const ROLE_LABELS = (window.SPP && window.SPP.ROLES) || {};
    const roleLabel = (user && (ROLE_LABELS[user.role] || user.role)) || '';
    const firstName = (user && user.firstName) || '';
    return (
        <section className="hm-hero" aria-label="Welcome">
            <div className="hm-hero-main">
                <span className="hm-eyebrow">
                    <i className="fa-solid fa-house" aria-hidden="true"></i>
                    {`${roleLabel} · ${today()}`}
                </span>
                <h1>{`${greeting()}, ${firstName}`}</h1>
                {text ? <p>{text}</p> : null}
                <div className="hm-actions">
                    {(actions || []).map((a, idx) => (
                        <button
                            key={idx}
                            type="button"
                            className={`hm-btn hm-btn--${a.ghost ? 'ghost' : 'gold'}`}
                            onClick={() => onAction(a)}
                        >
                            <i className={`fa-solid ${a.icon}`} aria-hidden="true"></i>
                            {a.label}
                        </button>
                    ))}
                </div>
            </div>
            {ringNode}
        </section>
    );
}

function HmKpi({ icon, tone, valueNode, label, hint }) {
    return (
        <div className="hm-kpi">
            <div className={`hm-kpi-icon${tone ? ' hm-kpi-icon--' + tone : ''}`}>
                <i className={`fa-solid ${icon}`} aria-hidden="true"></i>
            </div>
            <div className="hm-kpi-body">
                <span className="hm-kpi-value">{valueNode}</span>
                <span className="hm-kpi-label">{label}</span>
                {hint ? (
                    <span className="hm-kpi-hint" title={hint}>
                        {hint}
                    </span>
                ) : null}
            </div>
        </div>
    );
}

function HmCard({ title, icon, count, action, onGo, children }) {
    return (
        <section className="hm-card">
            <div className="hm-card-head">
                <span className="hm-card-icon">
                    <i className={`fa-solid ${icon}`} aria-hidden="true"></i>
                </span>
                <h2>{title}</h2>
                {count != null ? <span className="hm-count">{count}</span> : null}
                {action ? (
                    <button
                        type="button"
                        className="hm-link"
                        onClick={() => onGo && onGo(action.go)}
                    >
                        {action.label}
                    </button>
                ) : null}
            </div>
            {children}
        </section>
    );
}

function HmEmpty({ icon, title, text }) {
    return (
        <div className="hm-empty">
            <i className={`fa-regular ${icon}`} aria-hidden="true"></i>
            <strong>{title}</strong>
            <span>{text}</span>
        </div>
    );
}

function HmRow({ icon, tone, title, meta, text, trailNode, onClick }) {
    const inner = (
        <>
            <span className={`hm-row-icon${tone ? ' hm-row-icon--' + tone : ''}`}>
                <i className={`fa-solid ${icon}`} aria-hidden="true"></i>
            </span>
            <span className="hm-row-body">
                <span className="hm-row-title">{title}</span>
                {meta ? <span className="hm-row-meta">{meta}</span> : null}
                {text ? <span className="hm-row-text">{text}</span> : null}
            </span>
            {trailNode}
            {onClick ? (
                <i className="fa-solid fa-chevron-right hm-row-go" aria-hidden="true"></i>
            ) : null}
        </>
    );

    return (
        <li>
            {onClick ? (
                <button type="button" className="hm-row" onClick={onClick}>
                    {inner}
                </button>
            ) : (
                <div className="hm-row hm-row--static">{inner}</div>
            )}
        </li>
    );
}

function HmStack({ parts }) {
    const total = parts.reduce((s, p) => s + (p.value || 0), 0);
    if (!total) {
        return (
            <HmEmpty
                icon="fa-folder-open"
                title="Nothing here yet"
                text="The numbers will appear as the practice moves forward."
            />
        );
    }
    return (
        <>
            <div
                className="hm-stack"
                role="img"
                aria-label={parts.map((p) => `${p.label}: ${p.value}`).join(', ')}
            >
                {parts
                    .filter((p) => p.value)
                    .map((p, idx) => (
                        <i
                            key={idx}
                            className={p.cls}
                            style={{ flex: `${p.value} 1 0` }}
                            title={`${p.label}: ${p.value}`}
                        ></i>
                    ))}
            </div>
            <div className="hm-legend">
                {parts.map((p, idx) => (
                    <div key={idx} className="hm-legend-row">
                        <i className={p.cls}></i>
                        {p.label}
                        <b>{num(p.value)}</b>
                    </div>
                ))}
            </div>
        </>
    );
}

export default function HomeApp() {
    const [user, setUser] = useState(null);
    const [homeData, setHomeData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const lastLoadRef = useRef(0);
    const loadingRef = useRef(false);
    const userRef = useRef(null);
    const homeDataRef = useRef(null);

    const formatDate = (v) =>
        window.SPP && window.SPP.formatDate ? window.SPP.formatDate(v) : v || '—';
    const formatActivityDate = (v) =>
        window.SPP && window.SPP.formatActivityDate ? window.SPP.formatActivityDate(v) : v || '—';

    const go = useCallback((hash) => {
        const link = document.querySelector('.app-navigation a[href="' + hash + '"]');
        if (link) link.click();
    }, []);

    const showPracticeInformation = useCallback(() => {
        go('#practice');
        const practicePanel = document.querySelector('#practice .practice-panel');
        if (practicePanel) practicePanel.style.display = 'block';
        ['#logbook-panel', '#activities-panel', '#questions-panel', '#evidences-panel'].forEach(
            (sel) => {
                const el = document.querySelector(sel);
                if (el) el.style.display = 'none';
            }
        );
        window.scrollTo(0, 0);
    }, [go]);

    const openActivityFromHome = useCallback(
        (practiceId, activityId) => {
            go('#practice');
            const select = document.getElementById('practice-selector');
            if (
                select &&
                practiceId &&
                String(select.value) !== String(practiceId) &&
                Array.from(select.options).some((o) => o.value === String(practiceId))
            ) {
                select.value = String(practiceId);
                if (window.SPP && window.SPP.customSelect && window.SPP.customSelect.sync) {
                    window.SPP.customSelect.sync(select);
                }
                select.dispatchEvent(new Event('change', { bubbles: true }));
            }

            const practicePanel = document.querySelector('#practice .practice-panel');
            if (practicePanel) practicePanel.style.display = 'none';
            const logbookPanel = document.getElementById('logbook-panel');
            if (logbookPanel) logbookPanel.style.display = 'none';
            const actPanel = document.getElementById('activities-panel');
            if (actPanel) actPanel.style.display = 'none';
            const evPanel = document.getElementById('evidences-panel');
            if (evPanel) evPanel.style.display = 'flex';

            window.dispatchEvent(
                new CustomEvent('spp:open-activity', {
                    detail: { practiceId, activityId }
                })
            );
            window.scrollTo(0, 0);
        },
        [go]
    );

    const openUploadEvidence = useCallback(
        (practiceId) => {
            go('#practice');
            const select = document.getElementById('practice-selector');
            if (
                select &&
                practiceId &&
                String(select.value) !== String(practiceId) &&
                Array.from(select.options).some((o) => o.value === String(practiceId))
            ) {
                select.value = String(practiceId);
                if (window.SPP && window.SPP.customSelect && window.SPP.customSelect.sync) {
                    window.SPP.customSelect.sync(select);
                }
                select.dispatchEvent(new Event('change', { bubbles: true }));
            }

            const practicePanel = document.querySelector('#practice .practice-panel');
            if (practicePanel) practicePanel.style.display = 'none';
            const logbookPanel = document.getElementById('logbook-panel');
            if (logbookPanel) logbookPanel.style.display = 'none';
            const questionsPanel = document.getElementById('questions-panel');
            if (questionsPanel) questionsPanel.style.display = 'none';
            const evPanel = document.getElementById('evidences-panel');
            if (evPanel) evPanel.style.display = 'none';
            const actPanel = document.getElementById('activities-panel');
            if (actPanel) actPanel.style.display = 'flex';

            window.dispatchEvent(
                new CustomEvent('spp:open-upload-evidence', {
                    detail: { practiceId }
                })
            );

            setTimeout(() => {
                window.dispatchEvent(
                    new CustomEvent('spp:open-upload-evidence', {
                        detail: { practiceId }
                    })
                );
                const modal = document.getElementById('am-modal');
                if (!modal) {
                    const btn = document.getElementById('amOpenBtnActivities');
                    if (btn) btn.click();
                }
            }, 60);

            window.scrollTo(0, 0);
        },
        [go]
    );

    const enterPractice = useCallback(() => {
        const panel = document.querySelector('#practice .practice-panel');
        const enter = document.querySelector('#practice .practice-submit');
        if (panel && enter && panel.style.display !== 'none' && !enter.disabled) enter.click();
    }, []);

    const openPractice = useCallback(
        (id) => {
            if (!id) {
                go('#practice');
                return;
            }
            const currentUser = userRef.current;
            if (currentUser && currentUser.role === 'director') {
                window.dispatchEvent(new CustomEvent('spp:open-practice', { detail: { id } }));
                go('#practice');
                return;
            }
            go('#practice');
            const select = document.getElementById('practice-selector');
            if (
                select &&
                id &&
                String(select.value) !== String(id) &&
                Array.from(select.options).some((o) => o.value === String(id))
            ) {
                select.value = String(id);
                if (window.SPP && window.SPP.customSelect && window.SPP.customSelect.sync) {
                    window.SPP.customSelect.sync(select);
                }
                select.dispatchEvent(new Event('change', { bubbles: true }));
            }
            enterPractice();
        },
        [go, enterPractice]
    );

    const openUsersList = useCallback(() => {
        go('#manage-users');
        setTimeout(() => {
            const tab = document.querySelector(
                '#manage-users .um-tab-btn[data-um-panel="um-panel-list"]'
            );
            if (tab) tab.click();
        }, 0);
    }, [go]);

    const openPendingUser = useCallback((id) => {
        const current = homeDataRef.current;
        if (!current || !current.pendingUsers) return;
        const u = (current.pendingUsers.items || []).find(
            (x) => String(x.id) === String(id) || String(x.documentNumber) === String(id)
        );
        if (u) {
            if (window.SPP && window.SPP.openUserModal) {
                window.SPP.openUserModal(u);
            } else {
                window.dispatchEvent(new CustomEvent('spp:open-user-modal', { detail: { user: u } }));
            }
        }
    }, []);

    const handleActionButton = useCallback(
        (a) => {
            if (a.practiceInfo) showPracticeInformation();
            else if (a.uploadEvidence) openUploadEvidence(a.open || '');
            else if (a.open) openPractice(a.open);
            else if (a.users) openUsersList();
            else if (a.go) go(a.go);
        },
        [showPracticeInformation, openUploadEvidence, openPractice, openUsersList, go]
    );

    const load = useCallback(async (force) => {
        const SPP = window.SPP;
        if (!SPP) return;
        if (loadingRef.current || (!force && Date.now() - lastLoadRef.current < REFRESH_AFTER_MS)) {
            return;
        }
        loadingRef.current = true;
        setLoading(true);
        setError(null);
        try {
            if (!userRef.current) {
                const u = await SPP.session();
                userRef.current = u;
                setUser(u);
            }
            const { home } = await SPP.get('/api/home');
            homeDataRef.current = home;
            setHomeData(home);
            lastLoadRef.current = Date.now();
        } catch (err) {
            setError(err || new Error('Please try again.'));
        } finally {
            loadingRef.current = false;
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const homeLink = document.querySelector('.app-navigation a[href="#home"]');
        const onHomeRefresh = () => load(true);
        const onHomeLinkClick = () => load(false);

        window.addEventListener('spp:home-refresh', onHomeRefresh);
        if (homeLink) homeLink.addEventListener('click', onHomeLinkClick);

        const hash = window.location.hash;
        const landsOnHome = !hash || hash === '#home';
        if (landsOnHome) {
            if (homeLink) homeLink.click();
            load(true);
        }

        return () => {
            window.removeEventListener('spp:home-refresh', onHomeRefresh);
            if (homeLink) homeLink.removeEventListener('click', onHomeLinkClick);
        };
    }, [load]);

    const renderDeadlineRows = (items, withStudent) =>
        (items || []).map((d, idx) => {
            const hasDue = Boolean(d.dueDate);
            const dateText = hasDue ? formatActivityDate(d.dueDate) : 'No due date';
            const pillText = hasDue && d.daysLeft != null ? relative(d.daysLeft) : 'Pending';
            const tone = d.overdue ? 'danger' : d.daysLeft != null && d.daysLeft <= 3 ? 'warn' : '';
            const pillTone = d.overdue
                ? 'danger'
                : d.daysLeft != null && d.daysLeft <= 3
                ? 'warn'
                : hasDue
                ? 'info'
                : 'muted';
            return (
                <HmRow
                    key={d.activityId || `${d.practiceId}-${idx}`}
                    icon="fa-calendar-days"
                    tone={tone}
                    title={d.title}
                    meta={(withStudent && d.student ? d.student + ' · ' : '') + dateText}
                    trailNode={<span className={`hm-pill hm-pill--${pillTone}`}>{pillText}</span>}
                    onClick={() =>
                        d.activityId
                            ? openActivityFromHome(d.practiceId, d.activityId)
                            : openPractice(d.practiceId)
                    }
                />
            );
        });

    const renderStudentView = (d) => {
        const p = d.practice;
        if (!p) {
            return (
                <>
                    <HmHero
                        user={user}
                        text="You do not have an assigned practice yet. As soon as the Director assigns one, your progress will show up here."
                        actions={[{ label: 'My profile', icon: 'fa-user', go: '#profile', ghost: true }]}
                        onAction={handleActionButton}
                    />
                    <div className="hm-card">
                        <HmEmpty
                            icon="fa-clipboard"
                            title="No practice assigned"
                            text="Contact the Pedagogical Practice Directorate if you think this is a mistake."
                        />
                    </div>
                </>
            );
        }

        const a = d.activities || {};
        const timeLeft =
            p.daysLeft == null
                ? '—'
                : p.daysLeft < 0
                ? 'Ended ' + plural(-p.daysLeft, 'day', 'days') + ' ago'
                : plural(p.daysLeft, 'day', 'days') + ' left';

        const factsList = [
            ['Institution', p.institution || '—'],
            ['Practice', p.name || '—'],
            ['Tutor', p.tutor || '—'],
            ['Advisor', p.advisor || '—'],
            ['Period', `${formatDate(p.startDate)} – ${formatDate(p.endDate)}`],
            ['Time left', timeLeft]
        ];

        return (
            <>
                <HmHero
                    user={user}
                    text=""
                    actions={[
                        {
                            label: 'Upload evidence',
                            icon: 'fa-cloud-arrow-up',
                            uploadEvidence: true,
                            open: p.id
                        }
                    ]}
                    ringNode={
                        <HmRing
                            pct={p.progressPct}
                            center={`${p.progressPct}%`}
                            small="completed"
                            label="Hours progress"
                        />
                    }
                    onAction={handleActionButton}
                />
                <div className="hm-kpis">
                    <HmKpi
                        icon="fa-clock"
                        tone=""
                        valueNode={
                            <>
                                {num(p.workedHours)} <small>/ {num(p.requiredHours)} h</small>
                            </>
                        }
                        label="Hours logged"
                        hint={`${p.progressPct}% of the practice`}
                    />
                    <HmKpi
                        icon="fa-list-check"
                        tone={a.pending ? 'red' : ''}
                        valueNode={num(a.pending)}
                        label="Pending tasks"
                        hint={a.pending ? 'No evidence uploaded yet' : 'All activities have evidence'}
                    />
                    <HmKpi
                        icon="fa-hourglass-half"
                        tone="amber"
                        valueNode={num(a.review)}
                        label="Pending review"
                        hint="Waiting for your tutor"
                    />
                    <HmKpi
                        icon="fa-star"
                        tone="blue"
                        valueNode={
                            a.averageGrade == null ? (
                                '—'
                            ) : (
                                <>
                                    {a.averageGrade.toFixed(1)} <small>/ 5.0</small>
                                </>
                            )
                        }
                        label="Average grade"
                        hint={
                            a.graded
                                ? plural(a.graded, 'graded activity', 'graded activities')
                                : 'No graded activities yet'
                        }
                    />
                </div>
                <div className="hm-grid">
                    <div className="hm-col">
                        <HmCard title="My practice" icon="fa-book-open" count={null}>
                            <dl className="hm-facts">
                                {factsList.map(([t, v]) => (
                                    <div key={t}>
                                        <dt>{t}</dt>
                                        <dd>{v}</dd>
                                    </div>
                                ))}
                            </dl>
                            <div className="hm-progress-head">
                                <span>Hours progress</span>
                                <span>{p.progressPct}%</span>
                            </div>
                            <div
                                className="hm-bar"
                                role="progressbar"
                                aria-valuenow={p.progressPct}
                                aria-valuemin="0"
                                aria-valuemax="100"
                            >
                                <span style={{ width: `${p.progressPct}%` }}></span>
                            </div>
                            <div className="hm-actions" style={{ marginTop: '18px' }}>
                                <button
                                    type="button"
                                    className="hm-btn hm-btn--solid"
                                    onClick={() => openPractice(p.id)}
                                >
                                    <i
                                        className="fa-solid fa-right-to-bracket"
                                        aria-hidden="true"
                                    ></i>
                                    Open my practice
                                </button>
                            </div>
                        </HmCard>
                        <HmCard
                            title="Upcoming deadlines"
                            icon="fa-calendar-days"
                            count={(d.upcoming && d.upcoming.length) || null}
                        >
                            {d.upcoming && d.upcoming.length ? (
                                <ul className="hm-list">{renderDeadlineRows(d.upcoming, false)}</ul>
                            ) : (
                                <HmEmpty
                                    icon="fa-circle-check"
                                    title="No pending deadlines"
                                    text="Activities assigned by your tutor will appear here."
                                />
                            )}
                        </HmCard>
                    </div>
                    <div className="hm-col">
                        <HmCard
                            title="Activity status"
                            icon="fa-chart-pie"
                            count={`${a.total || 0} total`}
                        >
                            <HmStack
                                parts={[
                                    { label: 'Pending', value: a.pending || 0, cls: 'hm-c-pending' },
                                    { label: 'In review', value: a.review || 0, cls: 'hm-c-review' },
                                    {
                                        label: 'Commented',
                                        value: a.completed || 0,
                                        cls: 'hm-c-completed'
                                    },
                                    { label: 'Graded', value: a.graded || 0, cls: 'hm-c-graded' }
                                ]}
                            />
                        </HmCard>
                        <HmCard title="Latest feedback" icon="fa-comments">
                            {d.recentFeedback && d.recentFeedback.length ? (
                                <ul className="hm-list">
                                    {d.recentFeedback.map((f, idx) => (
                                        <HmRow
                                            key={idx}
                                            icon="fa-comment-dots"
                                            title={f.activityTitle}
                                            meta={`${ROLE_PILL[f.role] || 'Reviewer'} · ${formatDate(
                                                f.date
                                            )}`}
                                            text={f.text}
                                        />
                                    ))}
                                </ul>
                            ) : (
                                <HmEmpty
                                    icon="fa-comments"
                                    title="No feedback yet"
                                    text="Your tutor and advisor comments will show up here."
                                />
                            )}
                        </HmCard>
                    </div>
                </div>
            </>
        );
    };

    const renderTeacherView = (d) => {
        const t = d.totals || {};
        const queueItems = (d.queue && d.queue.items) || [];
        const queueTotal = (d.queue && d.queue.total) || 0;
        const practices = d.practices || [];

        return (
            <>
                <HmHero
                    user={user}
                    text=""
                    actions={[{ label: 'All my practices', icon: 'fa-book-open', practiceInfo: true }]}
                    ringNode={
                        <HmRing
                            pct={t.reviewedPct}
                            center={`${t.reviewedPct}%`}
                            small="reviewed"
                            label="Review progress"
                        />
                    }
                    onAction={handleActionButton}
                />
                <div className="hm-kpis">
                    <HmKpi
                        icon="fa-user-graduate"
                        tone=""
                        valueNode={
                            <>
                                {num(t.active)} <small>/ {num(t.practices)}</small>
                            </>
                        }
                        label="Active practices"
                        hint={plural(t.practices, 'practice assigned', 'practices assigned')}
                    />
                    <HmKpi
                        icon="fa-hourglass-half"
                        tone={t.pendingReview ? 'amber' : ''}
                        valueNode={num(t.pendingReview)}
                        label="Waiting for feedback"
                        hint={
                            t.pendingReview
                                ? 'Evidence without your comment'
                                : 'You are up to date'
                        }
                    />
                    <HmKpi
                        icon="fa-triangle-exclamation"
                        tone={t.overdue ? 'red' : ''}
                        valueNode={num(t.overdue)}
                        label="Overdue tasks"
                        hint="Students late with evidence"
                    />
                    <HmKpi
                        icon="fa-clock"
                        tone="blue"
                        valueNode={
                            <>
                                {num(t.hoursWorked)} <small>h</small>
                            </>
                        }
                        label="Hours logged"
                        hint="Across active practices"
                    />
                </div>
                <div className="hm-grid">
                    <div className="hm-col">
                        <HmCard
                            title="Review queue"
                            icon="fa-inbox"
                            count={queueTotal || null}
                        >
                            {queueItems.length ? (
                                <>
                                    <div className="hm-scroll-10">
                                        <ul className="hm-list">
                                            {queueItems.map((q, idx) => (
                                                <HmRow
                                                    key={q.activityId || idx}
                                                    icon="fa-file-circle-check"
                                                    tone="warn"
                                                    title={q.title}
                                                    meta={`${q.student} · ${plural(
                                                        q.evidenceCount,
                                                        'evidence',
                                                        'evidences'
                                                    )}`}
                                                    trailNode={
                                                        <span className="hm-pill hm-pill--warn">
                                                            Review
                                                        </span>
                                                    }
                                                    onClick={() =>
                                                        openActivityFromHome(
                                                            q.practiceId,
                                                            q.activityId
                                                        )
                                                    }
                                                />
                                            ))}
                                        </ul>
                                    </div>
                                    {queueTotal > queueItems.length ? (
                                        <p className="hm-row-meta" style={{ marginTop: '10px' }}>
                                            +{queueTotal - queueItems.length} more in your practices
                                        </p>
                                    ) : null}
                                </>
                            ) : (
                                <HmEmpty
                                    icon="fa-circle-check"
                                    title="Nothing to review"
                                    text="New evidence uploaded by your students will appear here."
                                />
                            )}
                        </HmCard>
                        <HmCard
                            title="Upcoming deadlines"
                            icon="fa-calendar-days"
                            count={(d.upcoming && d.upcoming.length) || null}
                        >
                            {d.upcoming && d.upcoming.length ? (
                                <ul className="hm-list">{renderDeadlineRows(d.upcoming, true)}</ul>
                            ) : (
                                <HmEmpty
                                    icon="fa-calendar-check"
                                    title="No upcoming deadlines"
                                    text="Activities with a due date will appear here."
                                />
                            )}
                        </HmCard>
                    </div>
                    <div className="hm-col">
                        <HmCard
                            title="My students"
                            icon="fa-people-group"
                            count={t.practices || null}
                        >
                            {practices.length ? (
                                <div className="hm-scroll-10">
                                    <div className="hm-list">
                                        {practices.map((p) => {
                                            const [stTone, stLabel] = STATUS_PILL[p.status] || [
                                                'muted',
                                                p.status || '—'
                                            ];
                                            return (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    className="hm-person"
                                                    onClick={() => openPractice(p.id)}
                                                >
                                                    <span className="hm-avatar" aria-hidden="true">
                                                        {initials(p.student)}
                                                    </span>
                                                    <span className="hm-person-body">
                                                        <span className="hm-row-title">
                                                            {p.student}
                                                        </span>
                                                        <span className="hm-row-meta">
                                                            {[p.name, p.institution]
                                                                .filter(Boolean)
                                                                .join(' · ')}
                                                        </span>
                                                        <span
                                                            className="hm-bar"
                                                            role="progressbar"
                                                            aria-valuenow={p.progressPct}
                                                            aria-valuemin="0"
                                                            aria-valuemax="100"
                                                        >
                                                            <span
                                                                style={{ width: `${p.progressPct}%` }}
                                                            ></span>
                                                        </span>
                                                        <span className="hm-row-meta">
                                                            {`${num(p.workedHours)} / ${num(
                                                                p.requiredHours
                                                            )} h · ${p.progressPct}%`}
                                                        </span>
                                                    </span>
                                                    <span className="hm-person-tags">
                                                        <span
                                                            className={`hm-pill hm-pill--${stTone}`}
                                                        >
                                                            {stLabel}
                                                        </span>
                                                        {p.pendingReview ? (
                                                            <span className="hm-pill hm-pill--warn">
                                                                {p.pendingReview} to review
                                                            </span>
                                                        ) : null}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <HmEmpty
                                    icon="fa-user-graduate"
                                    title="No assigned students"
                                    text="The Director will assign practices to you."
                                />
                            )}
                        </HmCard>
                    </div>
                </div>
            </>
        );
    };

    const renderDirectorView = (d) => {
        const s = d.summary || {};
        const pr = d.practices || {};
        const pendingUsers = d.pendingUsers || { total: 0, items: [] };

        const alertRows = [];
        if (pendingUsers.total) {
            alertRows.push(
                <HmRow
                    key="pending-users"
                    icon="fa-user-clock"
                    tone="warn"
                    title={`${plural(
                        pendingUsers.total,
                        'registration',
                        'registrations'
                    )} waiting for approval`}
                    meta="Accept or reject the new accounts"
                    trailNode={<span className="hm-pill hm-pill--warn">Review</span>}
                    onClick={openUsersList}
                />
            );
        }
        if (d.studentsWithoutPractice) {
            alertRows.push(
                <HmRow
                    key="students-without-practice"
                    icon="fa-user-graduate"
                    tone="warn"
                    title={`${plural(
                        d.studentsWithoutPractice,
                        'active student has',
                        'active students have'
                    )} no practice`}
                    meta="Create a practice to assign them"
                    trailNode={<span className="hm-pill hm-pill--info">Assign</span>}
                    onClick={() => go('#create-practice')}
                />
            );
        }
        (d.endingSoon || []).forEach((e) => {
            const pTone = pillFor(e.daysLeft);
            const pText =
                e.daysLeft < 0
                    ? `ended ${plural(-e.daysLeft, 'day', 'days')} ago`
                    : relative(e.daysLeft);
            alertRows.push(
                <HmRow
                    key={`ending-${e.id}`}
                    icon="fa-flag-checkered"
                    tone={e.daysLeft < 0 ? 'danger' : 'warn'}
                    title={e.student}
                    meta={`${e.type || 'Practice'} · ends ${formatDate(e.endDate)}`}
                    trailNode={<span className={`hm-pill hm-pill--${pTone}`}>{pText}</span>}
                    onClick={() => openPractice(e.id)}
                />
            );
        });

        const tiles = [
            ['#create-practice', 'fa-circle-plus', 'Create practice'],
            ['#manage-users', 'fa-user-group', 'Manage users'],
            ['#manage-practices', 'fa-clipboard-list', 'Practice types'],
            ['#manage-institutions', 'fa-building', 'Institutions'],
            ['#reports', 'fa-chart-line', 'Reports'],
            ['#profile', 'fa-user', 'My profile']
        ];

        const pct = pr.total ? Math.round((pr.active / pr.total) * 100) : 0;
        const actions = [
            {
                label: pendingUsers.total ? 'Review registrations' : 'Create practice',
                icon: pendingUsers.total ? 'fa-user-check' : 'fa-circle-plus',
                users: Boolean(pendingUsers.total),
                go: '#create-practice'
            },
            { label: 'Reports', icon: 'fa-chart-line', go: '#reports', ghost: true }
        ];

        return (
            <>
                <HmHero
                    user={user}
                    text=""
                    actions={actions}
                    ringNode={
                        <HmRing
                            pct={pct}
                            center={num(pr.active)}
                            small="active"
                            label="Practices in progress"
                        />
                    }
                    onAction={handleActionButton}
                />
                <div className="hm-kpis">
                    <HmKpi
                        icon="fa-book-open"
                        tone=""
                        valueNode={
                            <>
                                {num(pr.active)} <small>/ {num(pr.total)}</small>
                            </>
                        }
                        label="Active practices"
                        hint={plural(pr.completed, 'completed', 'completed')}
                    />
                    <HmKpi
                        icon="fa-user-graduate"
                        tone="blue"
                        valueNode={num(s.students)}
                        label="Active students"
                        hint={plural(s.institutions || 0, 'partner institution', 'partner institutions')}
                    />
                    <HmKpi
                        icon="fa-chalkboard-user"
                        tone="pink"
                        valueNode={num((s.tutors || 0) + (s.advisors || 0))}
                        label="Tutors & advisors"
                        hint={`${num(s.tutors)} tutors · ${num(s.advisors)} advisors`}
                    />
                    <HmKpi
                        icon="fa-star"
                        tone="amber"
                        valueNode={
                            s.averageGrade == null ? (
                                '—'
                            ) : (
                                <>
                                    {Number(s.averageGrade).toFixed(1)} <small>/ 5.0</small>
                                </>
                            )
                        }
                        label="Average final grade"
                        hint="Graded practices only"
                    />
                </div>
                <div className="hm-grid">
                    <div className="hm-col">
                        <HmCard
                            title="Needs your attention"
                            icon="fa-bell"
                            count={alertRows.length || null}
                        >
                            {alertRows.length ? (
                                <ul className="hm-list">{alertRows}</ul>
                            ) : (
                                <HmEmpty
                                    icon="fa-circle-check"
                                    title="All clear"
                                    text="No pending registrations or practices about to end."
                                />
                            )}
                        </HmCard>
                        <HmCard
                            title="New registrations"
                            icon="fa-user-plus"
                            count={pendingUsers.total || null}
                            action={{ label: 'Manage all', go: '#manage-users' }}
                            onGo={go}
                        >
                            {pendingUsers.items && pendingUsers.items.length ? (
                                <div className="hm-scroll-10">
                                    <ul className="hm-list">
                                        {pendingUsers.items.map((u, idx) => (
                                            <HmRow
                                                key={u.id || u.documentNumber || idx}
                                                icon={ROLE_ICONS[u.role] || 'fa-user-clock'}
                                                tone="warn"
                                                title={
                                                    u.name ||
                                                    `${u.firstName || ''} ${u.lastName || ''}`.trim() ||
                                                    'New user'
                                                }
                                                meta={`${ROLE_PILL[u.role] || u.role} · ${
                                                    u.program || u.email
                                                }`}
                                                trailNode={
                                                    <span className="hm-pill hm-pill--warn">
                                                        Pending
                                                    </span>
                                                }
                                                onClick={() =>
                                                    openPendingUser(u.id || u.documentNumber)
                                                }
                                            />
                                        ))}
                                    </ul>
                                </div>
                            ) : (
                                <HmEmpty
                                    icon="fa-user-check"
                                    title="No new registrations"
                                    text="New user registrations waiting for approval will appear here."
                                />
                            )}
                        </HmCard>
                    </div>
                    <div className="hm-col">
                        <HmCard title="Quick actions" icon="fa-bolt">
                            <div className="hm-tiles">
                                {tiles.map(([targetHash, icon, label]) => (
                                    <button
                                        key={targetHash}
                                        type="button"
                                        className="hm-tile"
                                        onClick={() => go(targetHash)}
                                    >
                                        <i className={`fa-solid ${icon}`} aria-hidden="true"></i>
                                        <span>{label}</span>
                                    </button>
                                ))}
                            </div>
                        </HmCard>
                        <HmCard
                            title="Practices by status"
                            icon="fa-chart-pie"
                            count={`${pr.total || 0} total`}
                        >
                            <HmStack
                                parts={[
                                    { label: 'Active', value: pr.active || 0, cls: 'hm-c-active' },
                                    { label: 'Completed', value: pr.completed || 0, cls: 'hm-c-done' },
                                    {
                                        label: 'Cancelled',
                                        value: pr.cancelled || 0,
                                        cls: 'hm-c-cancel'
                                    }
                                ]}
                            />
                        </HmCard>
                    </div>
                </div>
            </>
        );
    };

    if (error && !homeData) {
        return (
            <div className="hm">
                <div className="hm-card">
                    <HmEmpty
                        icon="fa-face-frown"
                        title="We could not load your home"
                        text={error.message || 'Please try again.'}
                    />
                    <div className="hm-actions" style={{ justifyContent: 'center' }}>
                        <button
                            type="button"
                            className="hm-btn hm-btn--solid"
                            onClick={() => load(true)}
                        >
                            <i className="fa-solid fa-rotate" aria-hidden="true"></i>
                            Try again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!homeData) {
        return (
            <div className="hm" aria-busy="true">
                <div className="hm-skel hm-skel--hero"></div>
                <div className="hm-kpis">
                    <div className="hm-skel hm-skel--kpi"></div>
                    <div className="hm-skel hm-skel--kpi"></div>
                    <div className="hm-skel hm-skel--kpi"></div>
                    <div className="hm-skel hm-skel--kpi"></div>
                </div>
                <div className="hm-grid">
                    <div className="hm-skel hm-skel--card"></div>
                    <div className="hm-skel hm-skel--card"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="hm">
            <div className="hm-toolbar">
                <span>Updated {clock(homeData.generatedAt)}</span>
                <button
                    type="button"
                    className={`hm-icon-btn${loading ? ' is-spin' : ''}`}
                    aria-label="Refresh home"
                    onClick={() => load(true)}
                >
                    <i className="fa-solid fa-rotate" aria-hidden="true"></i>
                    Refresh
                </button>
            </div>
            {homeData.role === 'student'
                ? renderStudentView(homeData)
                : homeData.role === 'director'
                ? renderDirectorView(homeData)
                : renderTeacherView(homeData)}
        </div>
    );
}
