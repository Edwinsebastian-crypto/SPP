'use strict';
const assert = require('assert');

let passed = 0;
async function test(name, fn) {
  try { await fn(); passed += 1; console.log('  ✔', name); } catch (err) { console.error('  ✘', name, '\n   ', err.stack.split('\n').slice(0, 4).join('\n    ')); process.exitCode = 1; }
}
const done = (label) => console.log(`${label}: ${passed} pruebas OK${process.exitCode ? ' (con FALLOS)' : ''}`);

/** Cola en memoria con la misma semántica que NotificationRepository (índice único de claveUnica, reservas, reintentos). */
class FakeNotificationRepository {
  constructor() { this.docs = []; this.seq = 0; }

  async enqueue(doc, now = new Date()) {
    if (doc.claveUnica && this.docs.some((d) => d.claveUnica === doc.claveUnica)) return { created: false };
    const stored = { _id: ++this.seq, ...doc, estadoEnvio: 'Pendiente', intentos: 0, fechaCreacion: now, proximoIntento: now };
    this.docs.push(stored);
    return { created: true, id: stored._id };
  }
  /** Inserta un documento «heredado» (como los que escribía el monolito: sin estadoEnvio). */
  addLegacy(doc) { this.docs.push({ _id: ++this.seq, fechaCreacion: new Date(), ...doc }); return this.seq; }

  async claimNext(now = new Date(), lockMs = 300000, { includeLegacy = false } = {}) {
    const d = this.docs
      .filter((x) => !x.fechaEnvio && (
        (x.estadoEnvio === 'Pendiente' && x.proximoIntento <= now) || (includeLegacy && x.estadoEnvio === undefined) ||
        (x.estadoEnvio === 'Enviando' && x.bloqueadoHasta < now)))
      .sort((a, b) => a.fechaCreacion - b.fechaCreacion)[0];
    if (!d) return null;
    d.estadoEnvio = 'Enviando'; d.bloqueadoHasta = new Date(now.getTime() + lockMs); d.intentos = (d.intentos || 0) + 1;
    return { ...d };
  }
  async markSent(id, now) { Object.assign(this.#get(id), { estadoEnvio: 'Enviada', fechaEnvio: now }); delete this.#get(id).bloqueadoHasta; }
  async markFailed(id, error, { giveUp, retryAt }) {
    Object.assign(this.#get(id), { estadoEnvio: giveUp ? 'Fallida' : 'Pendiente', ultimoError: error, proximoIntento: retryAt });
    delete this.#get(id).bloqueadoHasta;
  }
  #get(id) { return this.docs.find((d) => d._id === id); }
  async list() { return [...this.docs].reverse(); }
  async inbox(documento, limit = 20) {
    const own = this.docs.filter((d) => d.destinatario.numDocumento === documento && typeof d.claveUnica === 'string');
    return { items: [...own].reverse().slice(0, limit), unread: own.filter((d) => d.leida !== true).length };
  }
  async markRead(documento, id = null) {
    let n = 0;
    for (const d of this.docs) if (d.destinatario.numDocumento === documento && typeof d.claveUnica === 'string' && d.leida !== true && (!id || String(d._id) === id)) { d.leida = true; n += 1; }
    return n;
  }
  async requeueFailed() { let n = 0; for (const d of this.docs) if (d.estadoEnvio === 'Fallida') { d.estadoEnvio = 'Pendiente'; d.intentos = 0; n += 1; } return n; }

  byType(tipo) { return this.docs.filter((d) => d.tipo === tipo); }
  to(correo) { return this.docs.filter((d) => d.destinatario.correo === correo); }
}

const person = (doc, first, last, email, status = 'activo') => ({ documentNumber: doc, firstName: first, lastName: last, fullName: `${first} ${last}`, email, status });

/** Lector de la BD de prácticas con datos fijos (las consultas reales se prueban en sql.test.js). */
class FakePracticeReader {
  constructor(data = {}) {
    this.data = {
      practices: {}, activities: {}, students: {}, tutors: {}, advisors: {}, directors: [],
      dueSoon: [], awaiting: [], ungraded: [], ...data
    };
  }
  async findPractice(id) { return this.data.practices[id] || null; }
  async findActivity(id) { return this.data.activities[id] || null; }
  async findStudent(d) { return this.data.students[d] || null; }
  async findTutor(d) { return this.data.tutors[d] || null; }
  async findAdvisor(d) { return this.data.advisors[d] || null; }
  async listActiveDirectors() { return this.data.directors; }
  async listActivitiesDueSoon() { return this.data.dueSoon; }
  async listActivitiesAwaitingReview() { return this.data.awaiting; }
  async listUngradedPractices() { return this.data.ungraded; }
}

class FakeEvaluationReader {
  constructor({ attempts = {}, dueSoon = [], awaiting = [] } = {}) { Object.assign(this, { attempts, dueSoonRows: dueSoon, awaitingRows: awaiting }); }
  async findAttempt(id) { return this.attempts[id] || null; }
  async listDueSoon() { return this.dueSoonRows; }
  async listAwaitingGrading() { return this.awaitingRows; }
}

/** Práctica de ejemplo (formato que devuelve PracticeReaderRepository.findPractice). */
const samplePractice = (over = {}) => ({
  id: 'PR2', startDate: '2026-08-01', endDate: '2026-12-15', finalGrade: 0, finalObservation: '', status: 'activa',
  typeId: 'TP1', typeName: 'Práctica Pedagógica I', institutionId: '900123', institutionName: 'Colegio Central',
  studentDocument: 'E2', studentName: 'Mario Díaz', studentEmail: 'mario@udi.edu.co', studentStatus: 'activo',
  tutorDocument: 'T1', tutorName: 'Carlos Gómez', tutorEmail: 'carlos@udi.edu.co', tutorStatus: 'activo',
  advisorDocument: 'A1', advisorName: 'Ana Mejía', advisorEmail: 'ana@udi.edu.co', advisorStatus: 'activo', ...over
});

module.exports = { assert, test, done, FakeNotificationRepository, FakePracticeReader, FakeEvaluationReader, person, samplePractice };
