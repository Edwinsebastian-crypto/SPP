'use strict';
const env = require('../config/env');
const { NOTIFICATION_TYPES: T } = require('../config/constants');
const { localParts } = require('../utils/dates');
const tpl = require('./templates');

const isActive = (status) => status === 'activo';

/**
 * Tareas programadas. Todas son idempotentes (cada notificación lleva una `claveUnica`), así que se pueden ejecutar
 * con la frecuencia que se quiera, reiniciar el servicio o correr varias réplicas sin enviar correos repetidos.
 *
 *  · Recordatorios (cada ejecución): actividades y evaluaciones que vencen en las próximas 24 h y siguen sin entregar.
 *  · Resúmenes (una vez al día, a partir de DIGEST_HOUR): pendientes del tutor y del asesor, y prácticas sin calificar
 *    para el director.
 */
class JobsService {
  /** @param {{notifications, practiceReader, evaluationReader?, timezone?, reminderHours?, digestHour?, now?: () => Date}} deps */
  constructor({
    notifications, practiceReader, evaluationReader = null, timezone = env.timezone,
    reminderHours = env.reminderHours, digestHour = env.digestHour, now = () => new Date()
  }) {
    Object.assign(this, { notifications, practices: practiceReader, evaluations: evaluationReader, tz: timezone, reminderHours, digestHour, now });
  }

  /** Ejecuta cada tarea aislando los errores: si una falla, las demás se hacen igual. */
  async runAll({ forceDigest = false } = {}) {
    const summary = {};
    for (const [name, fn] of [['reminders', () => this.runReminders()], ['digests', () => this.runDigests({ force: forceDigest })]]) {
      try { summary[name] = await fn(); } catch (err) {
        console.error(`[jobs] ${name} falló:`, err.message);
        summary[name] = { error: err.message };
      }
    }
    return summary;
  }

  // ------------------------------------------------------------------ recordatorios

  async runReminders() {
    const out = { activities: 0, evaluations: 0 };

    for (const a of await this.practices.listActivitiesDueSoon(this.reminderHours)) {
      const n = tpl.activityDueSoon({ fullName: a.studentName, activityTitle: a.activityTitle, dueLocal: a.dueLocal });
      // la clave incluye la fecha límite: si el docente la cambia, se vuelve a avisar
      const r = await this.notifications.queue({
        type: T.ACTIVITY_DUE_SOON,
        recipient: { documentNumber: a.studentDocument, email: a.studentEmail, fullName: a.studentName, role: 'student' },
        ...n, key: `recordatorio-actividad:${a.activityId}:${a.dueLocal}`
      });
      if (r === 'queued') out.activities += 1;
    }

    if (this.evaluations) {
      const cache = new Map();
      for (const e of await this.evaluations.listDueSoon(this.reminderHours)) {
        if (!cache.has(e.studentDocument)) cache.set(e.studentDocument, await this.practices.findStudent(e.studentDocument));
        const s = cache.get(e.studentDocument);
        if (!s || !isActive(s.status)) continue;
        const n = tpl.evaluationDueSoon({ fullName: s.fullName, title: e.title, dueAt: e.dueAt, tz: this.tz });
        const r = await this.notifications.queue({
          type: T.EVALUATION_DUE_SOON,
          recipient: { documentNumber: s.documentNumber, email: s.email, fullName: s.fullName, role: 'student' },
          ...n, key: `recordatorio-evaluacion:${e.evaluationId}:${new Date(e.dueAt).toISOString()}`
        });
        if (r === 'queued') out.evaluations += 1;
      }
    }
    return out;
  }

  // ------------------------------------------------------------------ resúmenes de pendientes

  async runDigests({ force = false } = {}) {
    const { day, hour } = localParts(this.now(), this.tz);
    if (!force && hour < this.digestHour) return { skipped: `antes de las ${this.digestHour}:00 (${this.tz})` };

    const [activities, practices] = await Promise.all([this.practices.listActivitiesAwaitingReview(), this.practices.listUngradedPractices()]);
    const attempts = this.evaluations ? await this.evaluations.listAwaitingGrading() : [];

    const tutors = new Map();   // documento -> { person, grade[], feedback[], practices[], evaluations[] }
    const advisors = new Map();
    const bucket = (map, doc, person) => {
      if (!map.has(doc)) map.set(doc, { person, grade: [], feedback: [], practices: [], evaluations: [] });
      return map.get(doc);
    };
    const personOf = (doc, name, email, status, role) =>
      (email && isActive(status) ? { documentNumber: doc, email, fullName: name, role } : null);

    for (const a of activities) {
      const label = `${a.studentName} — ${a.activityTitle}`;
      const t = a.tutorDocument && personOf(a.tutorDocument, a.tutorName, a.tutorEmail, a.tutorStatus, 'tutor');
      if (t) {
        const b = bucket(tutors, a.tutorDocument, t);
        if (a.needsGrade) b.grade.push(label);
        if (a.needsTutorFeedback) b.feedback.push(label);
      }
      const ad = a.advisorDocument && personOf(a.advisorDocument, a.advisorName, a.advisorEmail, a.advisorStatus, 'advisor');
      if (ad) {
        const b = bucket(advisors, a.advisorDocument, ad);
        if (a.needsGrade) b.grade.push(label);
        if (a.needsAdvisorFeedback) b.feedback.push(label);
      }
    }
    for (const p of practices) {
      const t = p.tutorDocument && personOf(p.tutorDocument, p.tutorName, p.tutorEmail, p.tutorStatus, 'tutor');
      if (t) bucket(tutors, p.tutorDocument, t).practices.push(`${p.studentName} — ${p.typeName || 'Práctica'}`);
    }
    const tutorCache = new Map();
    const studentCache = new Map();
    for (const e of attempts) {
      if (!tutorCache.has(e.tutorDocument)) tutorCache.set(e.tutorDocument, await this.practices.findTutor(e.tutorDocument));
      if (!studentCache.has(e.studentDocument)) studentCache.set(e.studentDocument, await this.practices.findStudent(e.studentDocument));
      const t = tutorCache.get(e.tutorDocument);
      const person = t && personOf(t.documentNumber, t.fullName, t.email, t.status, 'tutor');
      if (!person) continue;
      const s = studentCache.get(e.studentDocument);
      bucket(tutors, e.tutorDocument, person).evaluations.push(`${s ? s.fullName : e.studentDocument} — ${e.title}`);
    }

    const out = { tutors: 0, advisors: 0, directors: 0 };
    const send = async (map, role, counter) => {
      for (const [doc, b] of map) {
        const total = b.grade.length + b.feedback.length + b.practices.length + b.evaluations.length;
        if (!total) continue;
        const n = tpl.reviewPending({ fullName: b.person.fullName, role, ...b });
        const r = await this.notifications.queue({
          type: T.REVIEW_PENDING, recipient: b.person, ...n, key: `pendientes:${role}:${doc}:${day}`
        });
        if (r === 'queued') out[counter] += 1;
      }
    };
    await send(tutors, 'tutor', 'tutors');
    await send(advisors, 'advisor', 'advisors');

    if (practices.length) {
      for (const d of await this.practices.listActiveDirectors()) {
        const n = tpl.ungradedPractices({ fullName: d.fullName, items: practices.slice(0, tpl.MAX_LIST), total: practices.length, tz: this.tz });
        const r = await this.notifications.queue({
          type: T.UNGRADED_PRACTICES, recipient: { documentNumber: d.documentNumber, email: d.email, fullName: d.fullName, role: 'director' },
          ...n, key: `practicas-sin-calificar:${d.documentNumber}:${day}`
        });
        if (r === 'queued') out.directors += 1;
      }
    }
    return out;
  }
}

/** Ejecuta `JobsService.runAll` periódicamente sin solaparse consigo mismo. */
class Scheduler {
  constructor({ jobs, intervalMs = env.jobsIntervalMs, initialDelayMs = 5000 }) {
    Object.assign(this, { jobs, intervalMs, initialDelayMs, running: false, timer: null, first: null });
  }

  async tick() {
    if (this.running) return null;
    this.running = true;
    try { return await this.jobs.runAll(); } finally { this.running = false; }
  }

  start() {
    this.first = setTimeout(() => this.tick(), this.initialDelayMs);
    this.timer = setInterval(() => this.tick(), this.intervalMs);
    [this.first, this.timer].forEach((t) => t.unref && t.unref());
  }

  stop() { clearTimeout(this.first); clearInterval(this.timer); }
}

module.exports = { JobsService, Scheduler };
