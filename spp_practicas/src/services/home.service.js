'use strict';
const { ROLES, PRACTICE_STATUS, USER_STATUS, OPEN_PRACTICE_STATUSES } = require('../config/constants');

/** active / evaluating / grading: the practice is still in progress. */
const isOpen = (status) => OPEN_PRACTICE_STATUSES.includes(status);

const DAY_MS = 24 * 60 * 60 * 1000;
const QUEUE_LIMIT = 50;
const LIST_LIMIT = 6;
const FEEDBACK_LIMIT = 5;
const ENDING_SOON_DAYS = 21;

/** Parses 'YYYY-MM-DD' or 'YYYY-MM-DD HH:MM[:SS][tz]' as LOCAL time (the database returns strings, see postgres.js). */
function parseLocal(value) {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(String(value));
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
}
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const calendarDays = (date, now) => Math.round((startOfDay(date) - startOfDay(now)) / DAY_MS);

function activityLabel(a) {
  const raw = (a.title || '').trim();
  return !raw || raw.toLowerCase() === 'activity' ? `Activity #${a.number}` : raw;
}

/** graded > completed (reviewer commented) > review (evidence waiting) > pending (no evidence yet). */
function classify(activity, reviewerCount) {
  if (Number(activity.grade) > 0) return 'graded';
  if (reviewerCount > 0) return 'completed';
  if (Number(activity.evidenceCount) > 0) return 'review';
  return 'pending';
}

const truncate = (text, max) => {
  const t = String(text || '').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

/**
 * Builds the role-specific data of the "Home" screen. Read-only: it only composes what the existing
 * repositories already expose, so it adds no SQL and no new permission rules
 * (each role only ever asks for the practices assigned to it).
 */
class HomeService {
  constructor({
    practiceRepository, activityRepository, feedbackRepository, userRepository, indicatorRepository, auditService,
    now = () => new Date()
  }) {
    this.practiceRepository = practiceRepository;
    this.activityRepository = activityRepository;
    this.feedbackRepository = feedbackRepository;
    this.userRepository = userRepository;
    this.indicatorRepository = indicatorRepository;
    this.auditService = auditService;
    this.now = now;
  }

  async build(user) {
    const generatedAt = this.now().toISOString();
    let body;
    switch (user.role) {
      case ROLES.STUDENT: body = await this.#student(user); break;
      case ROLES.TUTOR:
      case ROLES.ADVISOR: body = await this.#teacher(user); break;
      case ROLES.DIRECTOR: body = await this.#director(); break;
      default: body = {};
    }
    return { role: user.role, generatedAt, ...body };
  }

  // ------------------------------------------------------------------ shared helpers
  /** activityId -> how many comments from the reviewer (tutor / advisor) the activity has. */
  async #reviewerCounts(role, activities) {
    const counts = new Map();
    if (role === ROLES.ADVISOR) {
      await Promise.all(activities.filter((a) => Number(a.evidenceCount) > 0).map(async (a) => {
        const list = await this.feedbackRepository.listByActivity(a.id);
        counts.set(a.id, list.filter((f) => f.role === ROLES.ADVISOR).length);
      }));
    } else {
      activities.forEach((a) => counts.set(a.id, Number(a.feedbackCount) || 0));
    }
    return counts;
  }

  #analyze(activities, reviewerCounts, now) {
    const counts = { pending: 0, review: 0, completed: 0, graded: 0 };
    const grades = [];
    let workedHours = 0;
    const items = activities.map((a) => {
      const status = classify(a, reviewerCounts.get(a.id) || 0);
      counts[status] += 1;
      if (status === 'graded') grades.push(Number(a.grade));
      const hours = Number(a.hours) || 0;
      workedHours += hours;
      const due = parseLocal(a.dueDate);
      return {
        id: a.id, practiceId: a.practiceId, number: a.number, title: activityLabel(a), status, hours,
        evidenceCount: Number(a.evidenceCount) || 0,
        dueDate: a.dueDate || null,
        daysLeft: due ? calendarDays(due, now) : null,
        overdue: Boolean(due && due < now)
      };
    });
    const averageGrade = grades.length ? Math.round((grades.reduce((s, g) => s + g, 0) / grades.length) * 10) / 10 : null;
    return { counts, averageGrade, workedHours, items };
  }

  #practiceCard(p, workedHours, now) {
    const required = Number(p.requiredHours) || 0;
    const end = parseLocal(p.endDate);
    return {
      id: p.id, code: p.id, name: p.typeName || '', status: p.status,
      student: p.studentName || '', tutor: p.tutorName || '', advisor: p.advisorName || '',
      institution: p.institutionName || '', startDate: p.startDate, endDate: p.endDate,
      requiredHours: required, workedHours,
      progressPct: required > 0 ? Math.min(100, Math.round((workedHours / required) * 100)) : 0,
      daysLeft: end ? calendarDays(end, now) : null,
      finalGrade: Number(p.finalGrade) > 0 ? Number(p.finalGrade) : null
    };
  }

  #deadlines(entries, statuses) {
    return entries
      .filter((e) => statuses.includes(e.item.status))
      .sort((a, b) => {
        if (a.item.dueDate && b.item.dueDate) return (parseLocal(a.item.dueDate) - parseLocal(b.item.dueDate));
        if (a.item.dueDate) return -1;
        if (b.item.dueDate) return 1;
        return 0;
      })
      .slice(0, LIST_LIMIT)
      .map(({ item, practice }) => ({
        activityId: item.id, practiceId: item.practiceId, title: item.title, status: item.status,
        dueDate: item.dueDate || null, daysLeft: item.daysLeft != null ? item.daysLeft : null, overdue: Boolean(item.overdue),
        student: practice ? practice.studentName || '' : ''
      }));
  }

  // ------------------------------------------------------------------ student
  async #student(user) {
    const now = this.now();
    const practices = await this.practiceRepository.list({ studentDocument: user.documentNumber });
    const practice = practices.find((p) => isOpen(p.status)) || practices[0] || null;
    if (!practice) return { practice: null };

    const activities = await this.activityRepository.listByPractice(practice.id);
    const reviewer = await this.#reviewerCounts(ROLES.STUDENT, activities);
    const analysis = this.#analyze(activities, reviewer, now);

    const withEvidence = activities.filter((a) => Number(a.evidenceCount) > 0);
    const feedback = (await Promise.all(withEvidence.map(async (a) => {
      const list = await this.feedbackRepository.listByActivity(a.id);
      return list.map((f) => ({ role: f.role, text: truncate(f.text, 160), date: f.date, activityTitle: activityLabel(a) }));
    }))).flat().sort((x, y) => String(y.date).localeCompare(String(x.date))).slice(0, FEEDBACK_LIMIT);

    return {
      practice: this.#practiceCard(practice, analysis.workedHours, now),
      activities: { total: activities.length, ...analysis.counts, averageGrade: analysis.averageGrade },
      upcoming: this.#deadlines(analysis.items.map((item) => ({ item, practice })), ['pending']),
      recentFeedback: feedback
    };
  }

  // ------------------------------------------------------------------ tutor / advisor
  async #teacher(user) {
    const now = this.now();
    const filter = user.role === ROLES.TUTOR ? { tutorDocument: user.documentNumber } : { advisorDocument: user.documentNumber };
    const practices = await this.practiceRepository.list(filter);

    const loaded = await Promise.all(practices.map(async (practice) => {
      const activities = await this.activityRepository.listByPractice(practice.id);
      const reviewer = await this.#reviewerCounts(user.role, activities);
      return { practice, ...this.#analyze(activities, reviewer, now) };
    }));
    const active = loaded.filter((l) => isOpen(l.practice.status));

    const queueAll = active.flatMap((l) => l.items.filter((i) => i.status === 'review')
      .map((i) => ({ practiceId: l.practice.id, student: l.practice.studentName || '', activityId: i.id, title: i.title, evidenceCount: i.evidenceCount })));
    const sum = (key) => active.reduce((s, l) => s + l.counts[key], 0);
    const reviewed = sum('completed') + sum('graded');
    const pendingReview = sum('review');

    const cards = loaded.map((l) => ({
      ...this.#practiceCard(l.practice, l.workedHours, now),
      pendingReview: l.counts.review, pendingTasks: l.counts.pending
    })).sort((a, b) => (isOpen(a.status) ? 0 : 1) - (isOpen(b.status) ? 0 : 1)
      || String(a.endDate).localeCompare(String(b.endDate)));

    return {
      totals: {
        practices: practices.length,
        active: active.length,
        pendingReview,
        overdue: active.reduce((s, l) => s + l.items.filter((i) => i.status === 'pending' && i.overdue).length, 0),
        hoursWorked: active.reduce((s, l) => s + l.workedHours, 0),
        reviewedPct: reviewed + pendingReview > 0 ? Math.round((reviewed / (reviewed + pendingReview)) * 100) : 100
      },
      queue: { total: queueAll.length, items: queueAll.slice(0, QUEUE_LIMIT) },
      upcoming: this.#deadlines(active.flatMap((l) => l.items.map((item) => ({ item, practice: l.practice }))), ['pending', 'review']),
      practices: cards
    };
  }

  // ------------------------------------------------------------------ director
  async #director() {
    const now = this.now();
    const [summary, pendingUsers, practices, activeStudents, audit] = await Promise.all([
      this.indicatorRepository.summary(),
      this.userRepository.list({ status: USER_STATUS.PENDING }),
      this.practiceRepository.list(),
      this.userRepository.list({ role: ROLES.STUDENT, status: USER_STATUS.ACTIVE }),
      this.#recentAudit()
    ]);

    const byStatus = (s) => practices.filter((p) => p.status === s);
    const active = practices.filter((p) => isOpen(p.status));
    const withActive = new Set(active.map((p) => p.studentDocument));

    const endingSoon = active
      .map((p) => ({ p, end: parseLocal(p.endDate) }))
      .filter(({ end }) => end && calendarDays(end, now) <= ENDING_SOON_DAYS)
      .sort((a, b) => a.end - b.end)
      .slice(0, LIST_LIMIT)
      .map(({ p, end }) => ({ id: p.id, student: p.studentName || '', type: p.typeName || '', endDate: p.endDate, daysLeft: calendarDays(end, now) }));

    return {
      summary,
      practices: { total: practices.length, active: active.length, completed: byStatus(PRACTICE_STATUS.COMPLETED).length, cancelled: byStatus(PRACTICE_STATUS.CANCELLED).length },
      pendingUsers: {
        total: pendingUsers.length,
        items: pendingUsers.slice(0, 15).map((u) => ({
          id: u.documentNumber,
          documentNumber: u.documentNumber,
          documentType: u.documentType || 'CC',
          firstName: u.firstName,
          lastName: u.lastName,
          name: `${u.firstName} ${u.lastName}`.trim(),
          role: u.role,
          email: u.email,
          program: u.program || '',
          faculty: u.faculty || '',
          status: u.status || 'pending'
        }))
      },
      studentsWithoutPractice: activeStudents.filter((u) => !withActive.has(u.documentNumber)).length,
      endingSoon,
      recentActivity: audit
    };
  }

  async #recentAudit() {
    try {
      const entries = await this.auditService.list({});
      return entries.slice(0, LIST_LIMIT).map((e) => ({
        who: (e.user && e.user.fullName) || 'Someone', role: e.user && e.user.role, entity: e.entity, action: e.action, date: e.date
      }));
    } catch (_err) {
      return []; // an audit outage must never break the Home screen
    }
  }
}

module.exports = HomeService;
