'use strict';
const HttpError = require('../utils/http-error');
const env = require('../config/env');
const { NOTIFICATION_TYPES: T } = require('../config/constants');
const tpl = require('./templates');

const text = (v) => (typeof v === 'string' ? v.trim() : '');
const asId = (v) => (v === undefined || v === null ? '' : String(v).trim());
const required = (data, ...fields) => {
  for (const f of fields) if (!asId(data[f])) throw HttpError.badRequest(`Falta el campo "${f}"`);
};

/**
 * Convierte los eventos que publica el monolito en notificaciones para las personas correctas.
 * El evento solo trae identificadores; los datos (quién es el estudiante, su correo, la nota…) se leen de la BD de
 * prácticas, que es la fuente de verdad. Lo que el servicio no puede leer (evaluaciones) viaja en el evento.
 */
class EventService {
  /** @param {{notifications, practiceReader, evaluationReader?, timezone?: string}} deps */
  constructor({ notifications, practiceReader, evaluationReader = null, timezone = env.timezone }) {
    this.notifications = notifications;
    this.practices = practiceReader;
    this.evaluations = evaluationReader;
    this.tz = timezone;
    this.handlers = {
      'user.registered': (d) => this.#userRegistered(d),
      'user.approved': (d) => this.#userApproved(d),
      'practice.assigned': (d) => this.#practiceAssigned(d),
      'feedback.created': (d) => this.#feedbackCreated(d),
      'activity.graded': (d) => this.#activityGraded(d),
      'practice.graded': (d) => this.#practiceGraded(d),
      'evaluation.published': (d) => this.#evaluationPublished(d),
      'evaluation.graded': (d) => this.#evaluationGraded(d)
    };
  }

  static get eventTypes() { return Object.keys(new EventService({}).handlers); }

  /** @returns {Promise<{queued: number, duplicates: number, skipped: number}>} */
  async handle(type, data) {
    const handler = this.handlers[type];
    if (!handler) throw HttpError.badRequest(`Evento desconocido: ${type}`);
    if (!data || typeof data !== 'object') throw HttpError.badRequest('El evento necesita "data"');
    const outcomes = await handler(data);
    const count = (what) => outcomes.filter((o) => o === what).length;
    return { queued: count('queued'), duplicates: count('duplicate'), skipped: count('skipped') };
  }

  #person(p, prefix, role) {
    const email = p[`${prefix}Email`];
    return email ? { documentNumber: p[`${prefix}Document`], email, fullName: p[`${prefix}Name`], role } : null;
  }

  async #loadPractice(id) {
    const practice = await this.practices.findPractice(id);
    return practice || null;
  }

  #extractUser(user) {
    if (!user || typeof user !== 'object') throw HttpError.badRequest('Falta "user"');
    required(user, 'documentNumber', 'email', 'role');
    if (!['student', 'tutor', 'advisor'].includes(user.role)) return null;
    const fullName = `${text(user.firstName)} ${text(user.lastName)}`.trim() || asId(user.documentNumber);
    return {
      documentNumber: asId(user.documentNumber),
      email: text(user.email),
      fullName,
      role: user.role,
      status: user.status
    };
  }

  // ---------------------------------------------------------------- registro (estudiante, tutor, asesor)

  async #userRegistered({ user }) {
    const parsed = this.#extractUser(user);
    if (!parsed) return []; // el director nunca se registra por aquí
    const n = tpl.userRegistered({ fullName: parsed.fullName, role: parsed.role, status: parsed.status });
    return [await this.notifications.queue({
      type: T.USER_REGISTERED,
      recipient: parsed,
      ...n, key: `usuario-registrado:${parsed.role}:${parsed.documentNumber}`
    })];
  }

  /** El director aprobó una cuenta que estaba pendiente (pending -> active). */
  async #userApproved({ user }) {
    const parsed = this.#extractUser(user);
    if (!parsed) return [];
    const n = tpl.userApproved({ fullName: parsed.fullName, role: parsed.role });
    return [await this.notifications.queue({
      type: T.USER_APPROVED, recipient: parsed, ...n,
      key: `usuario-aprobado:${parsed.role}:${parsed.documentNumber}`
    })];
  }

  // ---------------------------------------------------------------- práctica asignada

  async #practiceAssigned(data) {
    required(data, 'practiceId');
    const p = await this.#loadPractice(asId(data.practiceId));
    if (!p) return ['skipped'];
    const typeName = p.typeName || 'Práctica pedagógica';
    const targets = [
      [this.#person(p, 'student', 'student'), 'estudiante', 'student'],
      [this.#person(p, 'tutor', 'tutor'), 'tutor académico', 'tutor'],
      [this.#person(p, 'advisor', 'advisor'), 'asesor pedagógico', 'advisor']
    ];
    const out = [];
    for (const [recipient, roleLabel, role] of targets) {
      if (!recipient) { out.push('skipped'); continue; }
      const n = tpl.practiceAssigned({
        fullName: recipient.fullName, roleLabel, practiceName: typeName, startDate: p.startDate, endDate: p.endDate, tz: this.tz
      });
      out.push(await this.notifications.queue({
        type: T.PRACTICE_ASSIGNED, recipient, practice: p, ...n, key: `practica-asignada:${p.id}:${role}:${recipient.documentNumber}`
      }));
    }
    return out;
  }

  // ---------------------------------------------------------------- estudiante

  async #feedbackCreated(data) {
    required(data, 'activityId', 'feedbackId', 'authorRole');
    const activity = await this.practices.findActivity(asId(data.activityId));
    if (!activity) return ['skipped'];
    const p = await this.#loadPractice(activity.practiceId);
    const student = p && this.#person(p, 'student', 'student');
    if (!student) return ['skipped'];
    const n = tpl.activityFeedback({
      fullName: student.fullName, activityTitle: activity.title, authorName: text(data.authorName) || 'Tu docente',
      authorRole: data.authorRole, text: text(data.text)
    });
    return [await this.notifications.queue({
      type: T.ACTIVITY_FEEDBACK, recipient: student, practice: p, ...n, key: `retroalimentacion:${asId(data.feedbackId)}`
    })];
  }

  async #activityGraded(data) {
    required(data, 'activityId');
    const activity = await this.practices.findActivity(asId(data.activityId));
    if (!activity || !(activity.grade > 0)) return ['skipped']; // 0 / vacío = sin calificar
    const p = await this.#loadPractice(activity.practiceId);
    const student = p && this.#person(p, 'student', 'student');
    if (!student) return ['skipped'];
    const n = tpl.activityGraded({
      fullName: student.fullName, activityTitle: activity.title, grade: activity.grade,
      graderName: text(data.graderName) || 'Tu docente', graderRole: text(data.graderRole) || 'tutor'
    });
    return [await this.notifications.queue({
      type: T.ACTIVITY_GRADED, recipient: student, practice: p, ...n, key: `actividad-calificada:${activity.id}:${activity.grade}`
    })];
  }

  async #practiceGraded(data) {
    required(data, 'practiceId');
    const p = await this.#loadPractice(asId(data.practiceId));
    if (!p || !(p.finalGrade > 0)) return ['skipped'];
    const student = this.#person(p, 'student', 'student');
    if (!student) return ['skipped'];
    const n = tpl.practiceGraded({
      fullName: student.fullName, practiceName: p.typeName || 'Práctica pedagógica', finalGrade: p.finalGrade, observation: p.finalObservation
    });
    return [await this.notifications.queue({
      type: T.PRACTICE_GRADED, recipient: student, practice: p, ...n, key: `practica-calificada:${p.id}:${p.finalGrade}`
    })];
  }

  async #studentFor(documentNumber, practiceId) {
    const practice = practiceId ? await this.#loadPractice(asId(practiceId)) : null;
    if (practice && practice.studentDocument === documentNumber) return { practice, student: this.#person(practice, 'student', 'student') };
    const s = await this.practices.findStudent(documentNumber);
    return { practice, student: s && s.email ? { documentNumber: s.documentNumber, email: s.email, fullName: s.fullName, role: 'student' } : null };
  }

  async #evaluationPublished(data) {
    required(data, 'evaluationId', 'studentDocument', 'title');
    const { practice, student } = await this.#studentFor(asId(data.studentDocument), data.practiceId);
    if (!student) return ['skipped'];
    const n = tpl.evaluationAvailable({ fullName: student.fullName, title: text(data.title), dueAt: data.dueAt, tz: this.tz });
    return [await this.notifications.queue({
      type: T.EVALUATION_AVAILABLE, recipient: student, practice, ...n, key: `evaluacion-disponible:${asId(data.evaluationId)}`
    })];
  }

  async #evaluationGraded(data) {
    required(data, 'attemptId', 'studentDocument');
    if (data.status && data.status !== 'CALIFICADO') return ['skipped']; // aún quedan respuestas abiertas por calificar
    let info = { title: text(data.title), grade: data.grade, maxGrade: data.maxGrade, showResults: data.showResults, practiceId: data.practiceId };
    if (this.evaluations) {
      const row = await this.evaluations.findAttempt(asId(data.attemptId));
      if (row) info = { ...info, ...row, practiceId: row.practiceId || info.practiceId };
    }
    const { practice, student } = await this.#studentFor(asId(data.studentDocument), info.practiceId);
    if (!student) return ['skipped'];
    const n = tpl.evaluationGraded({ fullName: student.fullName, ...info });
    return [await this.notifications.queue({
      type: T.EVALUATION_GRADED, recipient: student, practice, ...n, key: `evaluacion-calificada:${asId(data.attemptId)}`
    })];
  }
}

module.exports = EventService;
