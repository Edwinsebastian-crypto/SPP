/* =========================================================================
   home.js — "Home" section of every panel (student, tutor, advisor, director).
   Loaded LAST (after shell.js, session.js, panels.js...). The section markup and the sidebar link
   are added to each page by scripts/install-home.js; this file fills #home-root with the data of
   GET /api/home, which already comes shaped for the role of the logged-in user.
   No inline handlers (the CSP forbids them): everything uses event delegation on data-* attributes.
   ========================================================================= */
document.addEventListener('DOMContentLoaded', async () => {
    'use strict';
    const root = document.getElementById('home-root');
    const homeLink = document.querySelector('.app-navigation a[href="#home"]');
    if (!root || !homeLink || !window.SPP) return;

    const esc = SPP.escapeHtml;
    const ROLE_LABELS = SPP.ROLES || {};
    const REFRESH_AFTER_MS = 30000;
    let user = null;
    let lastLoad = 0;
    let loading = false;
    let currentHomeData = null;

    /* ------------------------------------------------------------ helpers */
    const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
    const num = (n) => (n == null ? '—' : Number(n).toLocaleString('en-US'));
    const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0)).join('').toUpperCase() || '?';
    const greeting = () => {
        const h = new Date().getHours();
        return h < 12 ? 'Good morning' : h < 19 ? 'Good afternoon' : 'Good evening';
    };
    const today = () => new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    const clock = (value) => new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    /** "overdue by 2 days" / "due today" / "in 5 days" from a calendar-day difference. */
    function relative(days) {
        if (days == null) return '';
        if (days < 0) return 'overdue by ' + plural(-days, 'day', 'days');
        if (days === 0) return 'today';
        if (days === 1) return 'tomorrow';
        return 'in ' + plural(days, 'day', 'days');
    }
    const pillFor = (days) => (days == null ? 'muted' : days < 0 ? 'danger' : days <= 3 ? 'warn' : 'info');

    const STATUS_PILL = {
        active: ['ok', 'Active'], completed: ['muted', 'Completed'], cancelled: ['danger', 'Cancelled']
    };
    const statusPill = (status) => {
        const [tone, label] = STATUS_PILL[status] || ['muted', status || '—'];
        return '<span class="hm-pill hm-pill--' + tone + '">' + esc(label) + '</span>';
    };
    const ROLE_PILL = { tutor: 'Tutor', advisor: 'Advisor', student: 'Student', director: 'Director' };

    /* ------------------------------------------------------------ building blocks */
    function button(a) {
        const attrs = a.practiceInfo ? 'data-home="practice-info"'
            : a.uploadEvidence ? 'data-home="upload-evidence" data-id="' + esc(a.open || '') + '"'
            : a.open ? 'data-home="practice" data-id="' + esc(a.open) + '"'
            : a.users ? 'data-home="users"'
            : 'data-home="go" data-go="' + esc(a.go) + '"';
        return '<button type="button" class="hm-btn hm-btn--' + (a.ghost ? 'ghost' : 'gold') + '" ' + attrs + '>' +
            '<i class="fa-solid ' + a.icon + '" aria-hidden="true"></i>' + esc(a.label) + '</button>';
    }

    function ring(pct, center, small, label) {
        const C = 226.2;
        const offset = C * (1 - Math.max(0, Math.min(100, pct)) / 100);
        return '<div class="hm-hero-ring"><div class="hm-ring" role="img" aria-label="' + esc(label + ': ' + center) + '">' +
            '<svg viewBox="0 0 88 88" aria-hidden="true"><circle class="hm-ring-bg" cx="44" cy="44" r="36"/>' +
            '<circle class="hm-ring-fill" cx="44" cy="44" r="36" style="stroke-dasharray:' + C + ';stroke-dashoffset:' + offset + '"/></svg>' +
            '<div class="hm-ring-center"><b>' + esc(center) + '</b><small>' + esc(small) + '</small></div></div>' +
            '<span class="hm-ring-label">' + esc(label) + '</span></div>';
    }

    function hero({ text, actions, ringHtml }) {
        return '<section class="hm-hero" aria-label="Welcome">' +
            '<div class="hm-hero-main">' +
            '<span class="hm-eyebrow"><i class="fa-solid fa-house" aria-hidden="true"></i>' + esc((ROLE_LABELS[user.role] || user.role) + ' · ' + today()) + '</span>' +
            '<h1>' + esc(greeting() + ', ' + user.firstName) + '</h1>' +
            (text ? '<p>' + esc(text) + '</p>' : '') +
            '<div class="hm-actions">' + actions.map(button).join('') + '</div></div>' + (ringHtml || '') + '</section>';
    }

    function kpi(icon, tone, value, label, hint) {
        return '<div class="hm-kpi"><div class="hm-kpi-icon' + (tone ? ' hm-kpi-icon--' + tone : '') + '"><i class="fa-solid ' + icon + '" aria-hidden="true"></i></div>' +
            '<div class="hm-kpi-body"><span class="hm-kpi-value">' + value + '</span><span class="hm-kpi-label">' + esc(label) + '</span>' +
            (hint ? '<span class="hm-kpi-hint" title="' + esc(hint) + '">' + esc(hint) + '</span>' : '') + '</div></div>';
    }

    function card(title, icon, body, { count, action } = {}) {
        return '<section class="hm-card"><div class="hm-card-head"><span class="hm-card-icon"><i class="fa-solid ' + icon + '" aria-hidden="true"></i></span>' +
            '<h2>' + esc(title) + '</h2>' + (count != null ? '<span class="hm-count">' + esc(count) + '</span>' : '') +
            (action ? '<button type="button" class="hm-link" data-home="go" data-go="' + esc(action.go) + '">' + esc(action.label) + '</button>' : '') +
            '</div>' + body + '</section>';
    }

    const empty = (icon, title, text) => '<div class="hm-empty"><i class="fa-regular ' + icon + '" aria-hidden="true"></i><strong>' + esc(title) + '</strong><span>' + esc(text) + '</span></div>';

    /** One clickable row. `data` = attributes already escaped, `trail` = pill html. */
    function row({ icon, tone, title, meta, text, trail, data }) {
        const inner = '<span class="hm-row-icon' + (tone ? ' hm-row-icon--' + tone : '') + '"><i class="fa-solid ' + icon + '" aria-hidden="true"></i></span>' +
            '<span class="hm-row-body"><span class="hm-row-title">' + esc(title) + '</span>' +
            (meta ? '<span class="hm-row-meta">' + esc(meta) + '</span>' : '') +
            (text ? '<span class="hm-row-text">' + esc(text) + '</span>' : '') + '</span>' + (trail || '') +
            (data ? '<i class="fa-solid fa-chevron-right hm-row-go" aria-hidden="true"></i>' : '');
        return data ? '<li><button type="button" class="hm-row" ' + data + '>' + inner + '</button></li>'
            : '<li><div class="hm-row hm-row--static">' + inner + '</div></li>';
    }
    const openData = (id) => 'data-home="practice" data-id="' + esc(id) + '"';
    const list = (rows) => '<ul class="hm-list">' + rows.join('') + '</ul>';

    function stack(parts) {
        const total = parts.reduce((s, p) => s + p.value, 0);
        if (!total) return empty('fa-folder-open', 'Nothing here yet', 'The numbers will appear as the practice moves forward.');
        return '<div class="hm-stack" role="img" aria-label="' + esc(parts.map((p) => p.label + ': ' + p.value).join(', ')) + '">' +
            parts.filter((p) => p.value).map((p) => '<i class="' + p.cls + '" style="flex:' + p.value + ' 1 0" title="' + esc(p.label + ': ' + p.value) + '"></i>').join('') + '</div>' +
            '<div class="hm-legend">' + parts.map((p) => '<div class="hm-legend-row"><i class="' + p.cls + '"></i>' + esc(p.label) + '<b>' + num(p.value) + '</b></div>').join('') + '</div>';
    }

    function deadlineRows(items, withStudent) {
        return items.map((d) => {
            const hasDue = Boolean(d.dueDate);
            const dateText = hasDue ? SPP.formatActivityDate(d.dueDate) : 'No due date';
            const pillText = hasDue && d.daysLeft != null ? relative(d.daysLeft) : 'Pending';
            const tone = d.overdue ? 'danger' : d.daysLeft != null && d.daysLeft <= 3 ? 'warn' : '';
            const pillTone = d.overdue ? 'danger' : d.daysLeft != null && d.daysLeft <= 3 ? 'warn' : hasDue ? 'info' : 'muted';
            const dataAttr = d.activityId
                ? 'data-home="open-activity" data-practice-id="' + esc(d.practiceId) + '" data-activity-id="' + esc(d.activityId) + '"'
                : openData(d.practiceId);
            return row({
                icon: 'fa-calendar-days',
                tone: tone,
                title: d.title,
                meta: (withStudent && d.student ? d.student + ' · ' : '') + dateText,
                trail: '<span class="hm-pill hm-pill--' + pillTone + '">' + esc(pillText) + '</span>',
                data: dataAttr
            });
        });
    }

    /* ------------------------------------------------------------ STUDENT */
    function studentView(d) {
        const p = d.practice;
        if (!p) {
            return hero({ text: 'You do not have an assigned practice yet. As soon as the Director assigns one, your progress will show up here.', actions: [{ label: 'My profile', icon: 'fa-user', go: '#profile', ghost: true }] }) +
                '<div class="hm-card">' + empty('fa-clipboard', 'No practice assigned', 'Contact the Pedagogical Practice Directorate if you think this is a mistake.') + '</div>';
        }
        const a = d.activities;
        const lead = a.pending > 0
            ? plural(a.pending, 'task still needs', 'tasks still need') + ' evidence' + (d.upcoming[0] && d.upcoming[0].overdue ? ' and one is already overdue.' : '.')
            : 'You are up to date with your activities. Keep it up!';
        const timeLeft = p.daysLeft == null ? '—' : p.daysLeft < 0 ? 'Ended ' + plural(-p.daysLeft, 'day', 'days') + ' ago' : plural(p.daysLeft, 'day', 'days') + ' left';

        const kpis = '<div class="hm-kpis">' +
            kpi('fa-clock', '', num(p.workedHours) + ' <small>/ ' + num(p.requiredHours) + ' h</small>', 'Hours logged', p.progressPct + '% of the practice') +
            kpi('fa-list-check', a.pending ? 'red' : '', num(a.pending), 'Pending tasks', a.pending ? 'No evidence uploaded yet' : 'All activities have evidence') +
            kpi('fa-hourglass-half', 'amber', num(a.review), 'Pending review', 'Waiting for your tutor') +
            kpi('fa-star', 'blue', a.averageGrade == null ? '—' : a.averageGrade.toFixed(1) + ' <small>/ 5.0</small>', 'Average grade', a.graded ? plural(a.graded, 'graded activity', 'graded activities') : 'No graded activities yet') + '</div>';

        const facts = '<dl class="hm-facts">' +
            [['Institution', p.institution || '—'], ['Practice', p.name || '—'], ['Tutor', p.tutor || '—'], ['Advisor', p.advisor || '—'],
                ['Period', SPP.formatDate(p.startDate) + ' – ' + SPP.formatDate(p.endDate)], ['Time left', timeLeft]]
                .map(([t, v]) => '<div><dt>' + esc(t) + '</dt><dd>' + esc(v) + '</dd></div>').join('') + '</dl>' +
            '<div class="hm-progress-head"><span>Hours progress</span><span>' + p.progressPct + '%</span></div><div class="hm-bar" role="progressbar" aria-valuenow="' + p.progressPct + '" aria-valuemin="0" aria-valuemax="100"><span style="width:' + p.progressPct + '%"></span></div>' +
            '<div class="hm-actions" style="margin-top:18px"><button type="button" class="hm-btn hm-btn--solid" data-home="practice" data-id="' + esc(p.id) + '"><i class="fa-solid fa-right-to-bracket" aria-hidden="true"></i>Open my practice</button></div>';

        const deadlines = d.upcoming.length ? list(deadlineRows(d.upcoming, false)) : empty('fa-circle-check', 'No pending deadlines', 'Activities assigned by your tutor will appear here.');
        const feedback = d.recentFeedback.length ? list(d.recentFeedback.map((f) => row({
            icon: 'fa-comment-dots', title: f.activityTitle, meta: (ROLE_PILL[f.role] || 'Reviewer') + ' · ' + SPP.formatDate(f.date), text: f.text
        }))) : empty('fa-comments', 'No feedback yet', 'Your tutor and advisor comments will show up here.');

        return hero({
            text: '',
            actions: [{ label: 'Upload evidence', icon: 'fa-cloud-arrow-up', uploadEvidence: true, open: p.id }],
            ringHtml: ring(p.progressPct, p.progressPct + '%', 'completed', 'Hours progress')
        }) + kpis +
            '<div class="hm-grid"><div class="hm-col">' + card('My practice', 'fa-book-open', facts, { count: null }) +
            card('Upcoming deadlines', 'fa-calendar-days', deadlines, { count: d.upcoming.length || null }) + '</div>' +
            '<div class="hm-col">' + card('Activity status', 'fa-chart-pie', stack([
                { label: 'Pending', value: a.pending, cls: 'hm-c-pending' }, { label: 'In review', value: a.review, cls: 'hm-c-review' },
                { label: 'Commented', value: a.completed, cls: 'hm-c-completed' }, { label: 'Graded', value: a.graded, cls: 'hm-c-graded' }]), { count: a.total + ' total' }) +
            card('Latest feedback', 'fa-comments', feedback) + '</div></div>';
    }

    /* ------------------------------------------------------------ TUTOR / ADVISOR */
    function teacherView(d) {
        const t = d.totals;
        const actions = [{ label: 'All my practices', icon: 'fa-book-open', practiceInfo: true }];

        const kpis = '<div class="hm-kpis">' +
            kpi('fa-user-graduate', '', num(t.active) + ' <small>/ ' + num(t.practices) + '</small>', 'Active practices', plural(t.practices, 'practice assigned', 'practices assigned')) +
            kpi('fa-hourglass-half', t.pendingReview ? 'amber' : '', num(t.pendingReview), 'Waiting for feedback', t.pendingReview ? 'Evidence without your comment' : 'You are up to date') +
            kpi('fa-triangle-exclamation', t.overdue ? 'red' : '', num(t.overdue), 'Overdue tasks', 'Students late with evidence') +
            kpi('fa-clock', 'blue', num(t.hoursWorked) + ' <small>h</small>', 'Hours logged', 'Across active practices') + '</div>';

        const queue = d.queue.items.length ? '<div class="hm-scroll-10"><ul class="hm-list">' + d.queue.items.map((q) => row({
            icon: 'fa-file-circle-check', tone: 'warn', title: q.title, meta: q.student + ' · ' + plural(q.evidenceCount, 'evidence', 'evidences'),
            trail: '<span class="hm-pill hm-pill--warn">Review</span>',
            data: 'data-home="open-activity" data-practice-id="' + esc(q.practiceId) + '" data-activity-id="' + esc(q.activityId) + '"'
        })).join('') + '</ul></div>' : empty('fa-circle-check', 'Nothing to review', 'New evidence uploaded by your students will appear here.');
        const more = d.queue.total > d.queue.items.length ? '<p class="hm-row-meta" style="margin-top:10px">+' + (d.queue.total - d.queue.items.length) + ' more in your practices</p>' : '';

        const deadlines = d.upcoming.length ? list(deadlineRows(d.upcoming, true)) : empty('fa-calendar-check', 'No upcoming deadlines', 'Activities with a due date will appear here.');

        const people = d.practices.length ? '<div class="hm-scroll-10"><div class="hm-list">' + d.practices.map((p) => '<button type="button" class="hm-person" ' + openData(p.id) + '>' +
            '<span class="hm-avatar" aria-hidden="true">' + esc(initials(p.student)) + '</span>' +
            '<span class="hm-person-body"><span class="hm-row-title">' + esc(p.student) + '</span>' +
            '<span class="hm-row-meta">' + esc([p.name, p.institution].filter(Boolean).join(' · ')) + '</span>' +
            '<span class="hm-bar" role="progressbar" aria-valuenow="' + p.progressPct + '" aria-valuemin="0" aria-valuemax="100"><span style="width:' + p.progressPct + '%"></span></span>' +
            '<span class="hm-row-meta">' + num(p.workedHours) + ' / ' + num(p.requiredHours) + ' h · ' + p.progressPct + '%</span></span>' +
            '<span class="hm-person-tags">' + statusPill(p.status) + (p.pendingReview ? '<span class="hm-pill hm-pill--warn">' + p.pendingReview + ' to review</span>' : '') + '</span></button>').join('') + '</div></div>'
            : empty('fa-user-graduate', 'No assigned students', 'The Director will assign practices to you.');

        return hero({
            text: '', actions,
            ringHtml: ring(t.reviewedPct, t.reviewedPct + '%', 'reviewed', 'Review progress')
        }) + kpis +
            '<div class="hm-grid"><div class="hm-col">' + card('Review queue', 'fa-inbox', queue + more, { count: d.queue.total || null }) +
            card('Upcoming deadlines', 'fa-calendar-days', deadlines, { count: d.upcoming.length || null }) + '</div>' +
            '<div class="hm-col">' + card('My students', 'fa-people-group', people, { count: t.practices || null }) + '</div></div>';
    }

    /* ------------------------------------------------------------ DIRECTOR */
    const ENTITY = { practice: 'a practice', logbook: 'a logbook', activity: 'an activity', evidence: 'an evidence', feedback: 'a feedback', answer: 'an answer', user: 'a user' };
    const ACTION = { insert: 'created', update: 'updated', delete: 'deleted' };

    function directorView(d) {
        const s = d.summary || {};
        const pr = d.practices;
        const pendingUsers = d.pendingUsers;
        const alerts = [];
        if (pendingUsers.total) {
            alerts.push(row({ icon: 'fa-user-clock', tone: 'warn', title: plural(pendingUsers.total, 'registration', 'registrations') + ' waiting for approval', meta: 'Accept or reject the new accounts', trail: '<span class="hm-pill hm-pill--warn">Review</span>', data: 'data-home="users"' }));
        }
        if (d.studentsWithoutPractice) {
            alerts.push(row({ icon: 'fa-user-graduate', tone: 'warn', title: plural(d.studentsWithoutPractice, 'active student has', 'active students have') + ' no practice', meta: 'Create a practice to assign them', trail: '<span class="hm-pill hm-pill--info">Assign</span>', data: 'data-home="go" data-go="#create-practice"' }));
        }
        d.endingSoon.forEach((e) => alerts.push(row({
            icon: 'fa-flag-checkered', tone: e.daysLeft < 0 ? 'danger' : 'warn', title: e.student, meta: (e.type || 'Practice') + ' · ends ' + SPP.formatDate(e.endDate),
            trail: '<span class="hm-pill hm-pill--' + pillFor(e.daysLeft) + '">' + esc(e.daysLeft < 0 ? 'ended ' + plural(-e.daysLeft, 'day', 'days') + ' ago' : relative(e.daysLeft)) + '</span>', data: openData(e.id)
        })));
        const attention = alerts.length ? list(alerts) : empty('fa-circle-check', 'All clear', 'No pending registrations or practices about to end.');

        const ROLE_ICONS = { student: 'fa-user-graduate', tutor: 'fa-chalkboard-user', advisor: 'fa-user-tie', director: 'fa-user-shield' };
        const newRegistrations = (pendingUsers.items && pendingUsers.items.length)
            ? '<div class="hm-scroll-10"><ul class="hm-list">' + pendingUsers.items.map((u) => row({
                icon: ROLE_ICONS[u.role] || 'fa-user-clock',
                tone: 'warn',
                title: u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'New user',
                meta: (ROLE_PILL[u.role] || u.role) + ' · ' + (u.program || u.email),
                trail: '<span class="hm-pill hm-pill--warn">Pending</span>',
                data: 'data-home="review-user" data-id="' + esc(u.id || u.documentNumber) + '"'
            })).join('') + '</ul></div>'
            : empty('fa-user-check', 'No new registrations', 'New user registrations waiting for approval will appear here.');

        const tiles = [['#create-practice', 'fa-circle-plus', 'Create practice'], ['#manage-users', 'fa-user-group', 'Manage users'], ['#manage-practices', 'fa-clipboard-list', 'Practice types'],
            ['#manage-institutions', 'fa-building', 'Institutions'], ['#reports', 'fa-chart-line', 'Reports'], ['#profile', 'fa-user', 'My profile']]
            .map(([go, icon, label]) => '<button type="button" class="hm-tile" data-home="go" data-go="' + go + '"><i class="fa-solid ' + icon + '" aria-hidden="true"></i><span>' + esc(label) + '</span></button>').join('');

        const pct = pr.total ? Math.round((pr.active / pr.total) * 100) : 0;
        const kpis = '<div class="hm-kpis">' +
            kpi('fa-book-open', '', num(pr.active) + ' <small>/ ' + num(pr.total) + '</small>', 'Active practices', plural(pr.completed, 'completed', 'completed')) +
            kpi('fa-user-graduate', 'blue', num(s.students), 'Active students', plural(s.institutions || 0, 'partner institution', 'partner institutions')) +
            kpi('fa-chalkboard-user', 'pink', num((s.tutors || 0) + (s.advisors || 0)), 'Tutors & advisors', num(s.tutors) + ' tutors · ' + num(s.advisors) + ' advisors') +
            kpi('fa-star', 'amber', s.averageGrade == null ? '—' : Number(s.averageGrade).toFixed(1) + ' <small>/ 5.0</small>', 'Average final grade', 'Graded practices only') + '</div>';

        const actions = [{ label: pendingUsers.total ? 'Review registrations' : 'Create practice', icon: pendingUsers.total ? 'fa-user-check' : 'fa-circle-plus', users: Boolean(pendingUsers.total), go: '#create-practice' },
            { label: 'Reports', icon: 'fa-chart-line', go: '#reports', ghost: true }];

        return hero({
            text: '',
            actions, ringHtml: ring(pct, num(pr.active), 'active', 'Practices in progress')
        }) + kpis +
            '<div class="hm-grid"><div class="hm-col">' + card('Needs your attention', 'fa-bell', attention, { count: alerts.length || null }) +
            card('New registrations', 'fa-user-plus', newRegistrations, { count: pendingUsers.total || null, action: { label: 'Manage all', go: '#manage-users' } }) + '</div>' +
            '<div class="hm-col">' + card('Quick actions', 'fa-bolt', '<div class="hm-tiles">' + tiles + '</div>') +
            card('Practices by status', 'fa-chart-pie', stack([{ label: 'Active', value: pr.active, cls: 'hm-c-active' }, { label: 'Completed', value: pr.completed, cls: 'hm-c-done' }, { label: 'Cancelled', value: pr.cancelled, cls: 'hm-c-cancel' }]), { count: pr.total + ' total' }) + '</div></div>';
    }

    /* ------------------------------------------------------------ render / load */
    const skeleton = () => '<div class="hm" aria-busy="true"><div class="hm-skel hm-skel--hero"></div><div class="hm-kpis">' +
        '<div class="hm-skel hm-skel--kpi"></div>'.repeat(4) + '</div><div class="hm-grid"><div class="hm-skel hm-skel--card"></div><div class="hm-skel hm-skel--card"></div></div></div>';

    function render(home) {
        const body = home.role === 'student' ? studentView(home) : home.role === 'director' ? directorView(home) : teacherView(home);
        root.innerHTML = '<div class="hm"><div class="hm-toolbar"><span>Updated ' + esc(clock(home.generatedAt)) + '</span>' +
            '<button type="button" class="hm-icon-btn" data-home="refresh" aria-label="Refresh home"><i class="fa-solid fa-rotate" aria-hidden="true"></i>Refresh</button></div>' + body + '</div>';
    }

    function showError(err) {
        root.innerHTML = '<div class="hm"><div class="hm-card">' + empty('fa-face-frown', 'We could not load your home', (err && err.message) || 'Please try again.') +
            '<div class="hm-actions" style="justify-content:center"><button type="button" class="hm-btn hm-btn--solid" data-home="refresh"><i class="fa-solid fa-rotate" aria-hidden="true"></i>Try again</button></div></div></div>';
    }

    async function load(force) {
        if (loading || (!force && Date.now() - lastLoad < REFRESH_AFTER_MS)) return;
        loading = true;
        const btn = root.querySelector('[data-home="refresh"]');
        if (btn) btn.classList.add('is-spin');
        else root.innerHTML = skeleton();
        try {
            if (!user) user = await SPP.session();
            const { home } = await SPP.get('/api/home');
            currentHomeData = home;
            render(home);
            lastLoad = Date.now();
        } catch (err) {
            showError(err);
        } finally {
            loading = false;
        }
    }

    /* ------------------------------------------------------------ navigation (reuses the shell's links) */
    function go(hash) {
        const link = document.querySelector('.app-navigation a[href="' + hash + '"]');
        if (link) link.click();
    }

    function showPracticeInformation() {
        go('#practice');
        const practicePanel = document.querySelector('#practice .practice-panel');
        if (practicePanel) practicePanel.style.display = 'block';
        ['#logbook-panel', '#activities-panel', '#questions-panel', '#evidences-panel'].forEach((sel) => {
            const el = document.querySelector(sel);
            if (el) el.style.display = 'none';
        });
        window.scrollTo(0, 0);
    }

    function openActivityFromHome(practiceId, activityId) {
        go('#practice');
        const select = document.getElementById('practice-selector');
        if (select && practiceId && String(select.value) !== String(practiceId) && Array.from(select.options).some((o) => o.value === String(practiceId))) {
            select.value = String(practiceId);
            if (SPP.customSelect && SPP.customSelect.sync) SPP.customSelect.sync(select);
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

        window.dispatchEvent(new CustomEvent('spp:open-activity', {
            detail: { practiceId, activityId }
        }));
        window.scrollTo(0, 0);
    }

    function openUploadEvidence(practiceId) {
        go('#practice');
        const select = document.getElementById('practice-selector');
        if (select && practiceId && String(select.value) !== String(practiceId) && Array.from(select.options).some((o) => o.value === String(practiceId))) {
            select.value = String(practiceId);
            if (SPP.customSelect && SPP.customSelect.sync) SPP.customSelect.sync(select);
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

        window.dispatchEvent(new CustomEvent('spp:open-upload-evidence', {
            detail: { practiceId }
        }));

        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('spp:open-upload-evidence', {
                detail: { practiceId }
            }));
            const modal = document.getElementById('am-modal');
            if (!modal) {
                const btn = document.getElementById('amOpenBtnActivities');
                if (btn) btn.click();
            }
        }, 60);

        window.scrollTo(0, 0);
    }

    function enterPractice() {
        const panel = document.querySelector('#practice .practice-panel');
        const enter = document.querySelector('#practice .practice-submit');
        if (panel && enter && panel.style.display !== 'none' && !enter.disabled) enter.click();
    }

    function openPractice(id) {
        if (user.role === 'director') {
            // same event the user list uses; director.api.js selects the practice and enters its logbook
            window.dispatchEvent(new CustomEvent('spp:open-practice', { detail: { id } }));
            go('#practice');
            return;
        }
        go('#practice');
        const select = document.getElementById('practice-selector'); // tutor / advisor have one select per practice
        if (select && id && String(select.value) !== String(id) && Array.from(select.options).some((o) => o.value === String(id))) {
            select.value = String(id);
            if (SPP.customSelect && SPP.customSelect.sync) SPP.customSelect.sync(select);
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }
        enterPractice();
    }

    function openUsersList() {
        go('#manage-users');
        setTimeout(() => {
            const tab = document.querySelector('#manage-users .um-tab-btn[data-um-panel="um-panel-list"]');
            if (tab) tab.click();
        }, 0);
    }

    function openPendingUser(id) {
        if (!currentHomeData || !currentHomeData.pendingUsers) return;
        const u = (currentHomeData.pendingUsers.items || []).find((x) => String(x.id) === String(id) || String(x.documentNumber) === String(id));
        if (u) {
            if (window.SPP && window.SPP.openUserModal) {
                window.SPP.openUserModal(u);
            } else {
                window.dispatchEvent(new CustomEvent('spp:open-user-modal', { detail: { user: u } }));
            }
        }
    }

    root.addEventListener('click', (event) => {
        const el = event.target.closest('[data-home]');
        if (!el || !root.contains(el)) return;
        switch (el.dataset.home) {
            case 'go': go(el.dataset.go); break;
            case 'practice-info': showPracticeInformation(); break;
            case 'open-activity': openActivityFromHome(el.dataset.practiceId, el.dataset.activityId); break;
            case 'upload-evidence': openUploadEvidence(el.dataset.id); break;
            case 'practice': if (el.dataset.id) openPractice(el.dataset.id); else go('#practice'); break;
            case 'users': openUsersList(); break;
            case 'review-user': openPendingUser(el.dataset.id); break;
            case 'refresh': load(true); break;
            default: break;
        }
    });

    window.addEventListener('spp:home-refresh', () => load(true));

    // coming back to Home through the sidebar refreshes stale data
    homeLink.addEventListener('click', () => load(false));

    // Home is the landing screen of every panel: select it through the shell's own handler
    // (active state, scroll, mobile drawer). A deep link such as /pages/director.html#reports
    // keeps its target section; Home then loads the first time the user opens it.
    const hash = window.location.hash;
    const landsOnHome = !hash || hash === '#home';
    if (landsOnHome) {
        homeLink.click();
        await load(true);
    }
});
