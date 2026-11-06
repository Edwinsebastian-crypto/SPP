'use strict';
// Tareas programadas: recordatorios a 24 h y resúmenes de pendientes (con dobles en memoria).
const { assert, test, done, FakeNotificationRepository, FakePracticeReader, FakeEvaluationReader, person } = require('./helpers/harness');
const NotificationService = require('../src/services/notification.service');
const { JobsService, Scheduler } = require('../src/services/jobs.service');

// 2026-10-27 12:00 en Bogotá (17:00 UTC)
const NOON = new Date('2026-10-27T17:00:00Z');
const EARLY = new Date('2026-10-27T10:00:00Z'); // 05:00 en Bogotá
const TOMORROW = new Date('2026-10-28T17:00:00Z');

function build({ data = {}, evaluations = null, now = NOON } = {}) {
  const repo = new FakeNotificationRepository();
  let clock = now;
  const jobs = new JobsService({
    notifications: new NotificationService({ notificationRepository: repo }), practiceReader: new FakePracticeReader(data),
    evaluationReader: evaluations, timezone: 'America/Bogota', reminderHours: 24, digestHour: 7, now: () => clock
  });
  return { repo, jobs, setNow: (d) => { clock = d; } };
}

const due = (id, over = {}) => ({ activityId: id, activityTitle: `Actividad ${id}`, practiceId: 'PR2', dueLocal: '2026-10-28T09:00:00', studentDocument: 'E2', studentName: 'Mario Díaz', studentEmail: 'mario@udi.edu.co', ...over });
const act = (id, over = {}) => ({
  activityId: id, activityTitle: `Actividad ${id}`, practiceId: 'PR2', studentName: 'Mario Díaz',
  tutorDocument: 'T1', tutorName: 'Carlos Gómez', tutorEmail: 'carlos@udi.edu.co', tutorStatus: 'activo',
  advisorDocument: 'A1', advisorName: 'Ana Mejía', advisorEmail: 'ana@udi.edu.co', advisorStatus: 'activo',
  needsGrade: false, needsTutorFeedback: false, needsAdvisorFeedback: false, ...over
});
const pr = (id, over = {}) => ({
  id, startDate: '2026-07-01', endDate: '2026-10-20', tutorDocument: 'T1', tutorName: 'Carlos Gómez', tutorEmail: 'carlos@udi.edu.co', tutorStatus: 'activo',
  studentName: `Estudiante ${id}`, typeName: 'Práctica I', ...over
});
const directors = [person('D1', 'Diana', 'Torres', 'diana@udi.edu.co'), person('D3', 'Dora', 'Luna', 'dora@udi.edu.co')];

(async () => {
  console.log('# recordatorios (un día antes de la entrega)');
  await test('avisa al estudiante de cada actividad por vencer sin entregar', async () => {
    const { repo, jobs } = build({ data: { dueSoon: [due('A1'), due('A2', { studentDocument: 'E5', studentEmail: 'otro@udi.edu.co', studentName: 'Otro Est' })] } });
    assert.deepEqual(await jobs.runReminders(), { activities: 2, evaluations: 0 });
    assert.equal(repo.byType('RecordatorioActividad').length, 2);
    const n = repo.to('mario@udi.edu.co')[0];
    assert.match(n.asunto, /Recordatorio.*Actividad A1/);
    assert.match(n.contenido, /todavía no has cargado tu evidencia/);
    assert.equal(n.destinatario.rol, 'student');
  });
  await test('es idempotente: ejecutar 10 veces no repite el recordatorio', async () => {
    const { repo, jobs } = build({ data: { dueSoon: [due('A1')] } });
    for (let i = 0; i < 10; i += 1) await jobs.runReminders();
    assert.equal(repo.docs.length, 1);
  });
  await test('si el docente cambia la fecha límite se vuelve a avisar', async () => {
    const { repo, jobs } = build({ data: { dueSoon: [due('A1')] } });
    await jobs.runReminders();
    jobs.practices.data.dueSoon = [due('A1', { dueLocal: '2026-10-28T20:00:00' })];
    assert.equal((await jobs.runReminders()).activities, 1);
    assert.equal(repo.docs.length, 2);
  });
  await test('evaluaciones por vencer sin presentar: avisa al estudiante; omite estudiantes inactivos', async () => {
    const evaluations = new FakeEvaluationReader({ dueSoon: [
      { evaluationId: '1', title: 'Quiz didáctica', studentDocument: 'E2', dueAt: '2026-10-28 15:00:00+00' },
      { evaluationId: '2', title: 'Quiz B', studentDocument: 'E3', dueAt: '2026-10-28 15:00:00+00' }
    ] });
    const { repo, jobs } = build({ evaluations, data: { students: { E2: person('E2', 'Mario', 'Díaz', 'mario@udi.edu.co'), E3: person('E3', 'Inés', 'Rojas', 'ines@udi.edu.co', 'inactivo') } } });
    assert.deepEqual(await jobs.runReminders(), { activities: 0, evaluations: 1 });
    assert.match(repo.docs[0].asunto, /Quiz didáctica/);
    assert.equal(repo.docs[0].tipo, 'RecordatorioEvaluacion');
  });

  console.log('# resúmenes de pendientes');
  const awaiting = [
    act('A1', { needsGrade: true, needsTutorFeedback: true, needsAdvisorFeedback: true }),
    act('A2', { needsGrade: true }),
    act('A3', { needsAdvisorFeedback: true, studentName: 'Laura Pérez' }),
    act('A4') // nada pendiente
  ];
  await test('TUTOR: actividades por retroalimentar y por calificar + prácticas por calificar', async () => {
    const { repo, jobs } = build({ data: { awaiting, ungraded: [pr('PR1')], directors: [] } });
    const r = await jobs.runDigests();
    assert.equal(r.tutors, 1);
    const n = repo.to('carlos@udi.edu.co')[0];
    assert.equal(n.tipo, 'PendientesRevision');
    assert.match(n.asunto, /3 pendientes/); // A1 (retro y nota) + A2 + 1 práctica: A1 se cuenta una sola vez
    assert.match(n.contenido, /Actividades por retroalimentar \(1\)/);
    assert.match(n.contenido, /Actividades por calificar \(2\)/);
    assert.match(n.contenido, /Prácticas por calificar \(1\)/);
    assert.match(n.contenido, /Mario Díaz — Actividad A1/);
  });
  await test('ASESOR: lo suyo (retroalimentar + calificar) y NO las prácticas (no puede calificarlas)', async () => {
    const { repo, jobs } = build({ data: { awaiting, ungraded: [pr('PR1')] } });
    await jobs.runDigests();
    const n = repo.to('ana@udi.edu.co')[0];
    assert.match(n.contenido, /Actividades por retroalimentar \(2\)/); // A1 y A3
    assert.match(n.contenido, /Actividades por calificar \(2\)/);       // A1 y A2
    assert.doesNotMatch(n.contenido, /Prácticas por calificar/);
    assert.equal(n.destinatario.rol, 'advisor');
  });
  await test('DIRECTOR: prácticas sin calificar -> un aviso por director activo', async () => {
    const { repo, jobs } = build({ data: { ungraded: [pr('PR1'), pr('PR5', { studentName: 'Rosa León' })], directors } });
    assert.equal((await jobs.runDigests()).directors, 2);
    const n = repo.to('diana@udi.edu.co')[0];
    assert.equal(n.tipo, 'PracticasSinCalificar');
    assert.match(n.asunto, /2 prácticas sin calificar/);
    assert.match(n.contenido, /Rosa León/);
    assert.equal(repo.to('dora@udi.edu.co').length, 1);
  });
  await test('el director no recibe nada si no hay prácticas sin calificar; nadie recibe resumen vacío', async () => {
    const { repo, jobs } = build({ data: { awaiting: [act('A4')], ungraded: [], directors } });
    assert.deepEqual(await jobs.runDigests(), { tutors: 0, advisors: 0, directors: 0 });
    assert.equal(repo.docs.length, 0);
  });
  await test('tutor/asesor inactivos o sin correo no reciben resumen', async () => {
    const { repo, jobs } = build({ data: { awaiting: [act('A1', { needsGrade: true, tutorStatus: 'inactivo', advisorEmail: null })] } });
    await jobs.runDigests();
    assert.equal(repo.docs.length, 0);
  });
  await test('EVALUACIONES: el tutor recibe las que esperan calificación (respuestas abiertas)', async () => {
    const evaluations = new FakeEvaluationReader({ awaiting: [
      { attemptId: '10', evaluationId: '2', title: 'Quiz con abiertas', tutorDocument: 'T9', studentDocument: 'E2' }
    ] });
    const { repo, jobs } = build({ evaluations, data: { tutors: { T9: person('T9', 'Tomás', 'Vega', 'tomas@udi.edu.co') }, students: { E2: person('E2', 'Mario', 'Díaz', 'm@udi.edu.co') } } });
    assert.equal((await jobs.runDigests()).tutors, 1);
    assert.match(repo.to('tomas@udi.edu.co')[0].contenido, /Evaluaciones por calificar \(1\):\n• Mario Díaz — Quiz con abiertas/);
  });
  await test('una vez al día y a partir de la hora configurada', async () => {
    const { repo, jobs, setNow } = build({ now: EARLY, data: { awaiting, ungraded: [pr('PR1')], directors } });
    assert.match((await jobs.runDigests()).skipped, /antes de las 7:00/);
    assert.equal(repo.docs.length, 0);
    setNow(NOON);
    const first = await jobs.runDigests();
    const total = repo.docs.length;
    assert.ok(total > 0 && first.tutors === 1 && first.advisors === 1 && first.directors === 2);
    await jobs.runDigests(); await jobs.runDigests();
    assert.equal(repo.docs.length, total, 'no se repite el mismo día');
    setNow(TOMORROW);
    await jobs.runDigests();
    assert.equal(repo.docs.length, total * 2, 'al día siguiente se envía de nuevo');
    setNow(EARLY);
    assert.ok((await jobs.runDigests({ force: true })).tutors === 0, 'force ignora la hora pero no la deduplicación');
  });

  console.log('# ejecución');
  await test('runAll aísla errores: si fallan los recordatorios igual salen los resúmenes', async () => {
    const { repo, jobs } = build({ data: { awaiting, ungraded: [] } });
    jobs.practices.listActivitiesDueSoon = async () => { throw new Error('BD caída'); };
    const origError = console.error; console.error = () => {};
    const r = await jobs.runAll();
    console.error = origError;
    assert.equal(r.reminders.error, 'BD caída');
    assert.equal(r.digests.tutors, 1);
    assert.ok(repo.docs.length > 0);
  });
  await test('el Scheduler no se solapa consigo mismo', async () => {
    let calls = 0; let release;
    const jobs = { runAll: () => { calls += 1; return new Promise((r) => { release = r; }); } };
    const s = new Scheduler({ jobs });
    const first = s.tick();
    assert.equal(await s.tick(), null);
    release({}); await first;
    assert.equal(calls, 1);
    s.tick(); release({});
    assert.equal(calls, 2);
  });
  done('jobs');
})();
