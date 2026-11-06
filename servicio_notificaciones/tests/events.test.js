'use strict';
// Eventos del monolito -> notificaciones (con dobles en memoria).
const { assert, test, done, FakeNotificationRepository, FakePracticeReader, FakeEvaluationReader, person, samplePractice } = require('./helpers/harness');
const NotificationService = require('../src/services/notification.service');
const EventService = require('../src/services/event.service');

function build({ practices = { PR2: samplePractice() }, activities = {}, students = {}, evaluations = null } = {}) {
  const repo = new FakeNotificationRepository();
  const reader = new FakePracticeReader({ practices, activities, students });
  const service = new EventService({
    notifications: new NotificationService({ notificationRepository: repo }), practiceReader: reader, evaluationReader: evaluations, timezone: 'America/Bogota'
  });
  return { repo, service };
}
const rejects = (p, status) => assert.rejects(p, (e) => e.status === status);

(async () => {
  console.log('# registro de usuarios');
  for (const role of ['student', 'tutor', 'advisor']) {
    await test(`notifica el registro del ${role}`, async () => {
      const { repo, service } = build();
      const r = await service.handle('user.registered', { user: { documentNumber: '77', email: 'x@udi.edu.co', firstName: 'Nora', lastName: 'Silva', role, status: 'pending' } });
      assert.deepEqual(r, { queued: 1, duplicates: 0, skipped: 0 });
      const n = repo.docs[0];
      assert.equal(n.tipo, 'UsuarioRegistrado');
      assert.equal(n.destinatario.correo, 'x@udi.edu.co');
      assert.equal(n.destinatario.rol, role);
      assert.equal(n.Practica, undefined);
      assert.equal(n.estadoEnvio, 'Pendiente');
      assert.equal(n.fechaEnvio, undefined);
      // claveUnica = entra en la campanita y el mismo evento repetido no duplica
      assert.equal(n.claveUnica, `usuario-registrado:${role}:77`);
      assert.deepEqual((await repo.inbox('77')).items.map((d) => d._id), [n._id]);
      assert.deepEqual(await service.handle('user.registered', { user: { documentNumber: '77', email: 'x@udi.edu.co', role } }), { queued: 0, duplicates: 1, skipped: 0 });
    });
  }
  await test('el director no recibe aviso de registro; datos incompletos -> 400', async () => {
    const { repo, service } = build();
    assert.deepEqual(await service.handle('user.registered', { user: { documentNumber: '1', email: 'd@x', role: 'director' } }), { queued: 0, duplicates: 0, skipped: 0 });
    assert.equal(repo.docs.length, 0);
    await rejects(service.handle('user.registered', { user: { role: 'student' } }), 400);
  });

  await test('aprobación: avisa a estudiante, tutor y asesor aprobados; el director no', async () => {
    const { repo, service } = build();
    for (const role of ['student', 'tutor', 'advisor']) {
      assert.equal((await service.handle('user.approved', { user: { documentNumber: '5', email: `${role}@udi.edu.co`, firstName: 'Ana', lastName: 'Ruiz', role } })).queued, 1);
    }
    assert.deepEqual(await service.handle('user.approved', { user: { documentNumber: '1', email: 'd@x', role: 'director' } }), { queued: 0, duplicates: 0, skipped: 0 });
    assert.deepEqual(repo.docs.map((d) => d.tipo), ['UsuarioAprobado', 'UsuarioAprobado', 'UsuarioAprobado']);
    // the same document can exist in more than one role table: each approval is its own notification
    assert.deepEqual(repo.docs.map((d) => d.claveUnica), ['usuario-aprobado:student:5', 'usuario-aprobado:tutor:5', 'usuario-aprobado:advisor:5']);
    assert.match(repo.docs[0].contenido, /aprobó tu registro/);
    assert.equal((await service.handle('user.approved', { user: { documentNumber: '5', email: 'student@udi.edu.co', role: 'student' } })).duplicates, 1);
    await rejects(service.handle('user.approved', { user: { role: 'student' } }), 400);
  });

  console.log('# práctica asignada');
  await test('avisa a estudiante, tutor y asesor con el objeto Practica completo; no se duplica', async () => {
    const { repo, service } = build();
    assert.deepEqual(await service.handle('practice.assigned', { practiceId: 'PR2' }), { queued: 3, duplicates: 0, skipped: 0 });
    assert.deepEqual(repo.docs.map((d) => d.destinatario.correo).sort(), ['ana@udi.edu.co', 'carlos@udi.edu.co', 'mario@udi.edu.co']);
    assert.equal(repo.docs[0].Practica.idPractica, 'PR2');
    assert.equal(repo.docs[0].Practica.numDocTutor, 'T1');
    assert.match(repo.to('carlos@udi.edu.co')[0].contenido, /como tutor académico/);
    assert.deepEqual(await service.handle('practice.assigned', { practiceId: 'PR2' }), { queued: 0, duplicates: 3, skipped: 0 });
  });
  await test('práctica inexistente -> se omite', async () => {
    assert.deepEqual(await build().service.handle('practice.assigned', { practiceId: 'NOPE' }), { queued: 0, duplicates: 0, skipped: 1 });
  });

  console.log('# estudiante: retroalimentación y calificaciones');
  const activities = { 'PR2-A1': { id: 'PR2-A1', practiceId: 'PR2', title: 'Planeación', grade: 0 }, 'PR2-A2': { id: 'PR2-A2', practiceId: 'PR2', title: 'Diario', grade: 4.5 } };
  await test('tutor o asesor retroalimenta -> el ESTUDIANTE recibe el aviso (una vez por retroalimentación)', async () => {
    const { repo, service } = build({ activities });
    const ev = { activityId: 'PR2-A1', feedbackId: 'RT9', authorDocument: 'T1', authorRole: 'tutor', authorName: 'Carlos Gómez', text: 'Mejora la introducción' };
    assert.deepEqual(await service.handle('feedback.created', ev), { queued: 1, duplicates: 0, skipped: 0 });
    assert.equal(repo.docs[0].destinatario.correo, 'mario@udi.edu.co');
    assert.equal(repo.docs[0].tipo, 'ActividadRetroalimentada');
    assert.match(repo.docs[0].contenido, /Carlos Gómez \(tutor académico\)/);
    assert.match(repo.docs[0].contenido, /Mejora la introducción/);
    assert.equal((await service.handle('feedback.created', ev)).duplicates, 1);
    await service.handle('feedback.created', { ...ev, feedbackId: 'RA1', authorRole: 'advisor', authorName: 'Ana Mejía' });
    assert.equal(repo.docs.length, 2); // otra retroalimentación = otro aviso
  });
  await test('actividad calificada: usa la nota guardada en la BD; sin nota (0) no avisa; cambiar la nota vuelve a avisar', async () => {
    const { repo, service } = build({ activities });
    assert.equal((await service.handle('activity.graded', { activityId: 'PR2-A1', graderRole: 'tutor' })).skipped, 1);
    assert.deepEqual(await service.handle('activity.graded', { activityId: 'PR2-A2', graderRole: 'advisor', graderName: 'Ana Mejía' }), { queued: 1, duplicates: 0, skipped: 0 });
    assert.match(repo.docs[0].contenido, /Nota obtenida: 4\.5/);
    assert.equal((await service.handle('activity.graded', { activityId: 'PR2-A2' })).duplicates, 1);
    activities['PR2-A2'].grade = 3;
    assert.equal((await service.handle('activity.graded', { activityId: 'PR2-A2' })).queued, 1);
  });
  await test('práctica calificada: avisa al estudiante con nota y observación; sin nota no avisa', async () => {
    const graded = samplePractice({ finalGrade: 4.2, finalObservation: 'Excelente desempeño' });
    const { repo, service } = build({ practices: { PR2: graded, PR9: samplePractice({ id: 'PR9' }) } });
    assert.deepEqual(await service.handle('practice.graded', { practiceId: 'PR2' }), { queued: 1, duplicates: 0, skipped: 0 });
    assert.match(repo.docs[0].contenido, /Nota final: 4\.2/);
    assert.match(repo.docs[0].contenido, /Excelente desempeño/);
    assert.equal(repo.docs[0].Practica.notaFinal, 4.2);
    assert.equal((await service.handle('practice.graded', { practiceId: 'PR9' })).skipped, 1);
  });
  await test('un estudiante sin correo se omite sin fallar', async () => {
    const { service } = build({ practices: { PR2: samplePractice({ studentEmail: null }) }, activities });
    assert.equal((await service.handle('feedback.created', { activityId: 'PR2-A1', feedbackId: 'F', authorRole: 'tutor' })).skipped, 1);
  });

  console.log('# estudiante: evaluaciones');
  const evalReader = new FakeEvaluationReader({ attempts: { 12: { attemptId: '12', status: 'CALIFICADO', grade: 4.2, title: 'Quiz con abiertas', maxGrade: 5, practiceId: 'PR2', studentDocument: 'E2', showResults: true } } });
  await test('evaluación publicada -> «ya está disponible» para el estudiante, una sola vez', async () => {
    const { repo, service } = build({ evaluations: evalReader });
    const ev = { evaluationId: 3, title: 'Quiz didáctica', studentDocument: 'E2', practiceId: 'PR2', dueAt: '2026-11-01T20:00:00Z' };
    assert.equal((await service.handle('evaluation.published', ev)).queued, 1);
    assert.equal(repo.docs[0].tipo, 'EvaluacionDisponible');
    assert.equal(repo.docs[0].destinatario.correo, 'mario@udi.edu.co');
    assert.match(repo.docs[0].asunto, /Quiz didáctica/);
    assert.equal((await service.handle('evaluation.published', ev)).duplicates, 1);
  });
  await test('evaluación calificada: toma título y nota de la BD de evaluación; si aún hay respuestas abiertas no avisa', async () => {
    const { repo, service } = build({ evaluations: evalReader });
    assert.equal((await service.handle('evaluation.graded', { attemptId: 12, studentDocument: 'E2', status: 'ENVIADO' })).skipped, 1);
    assert.equal((await service.handle('evaluation.graded', { attemptId: 12, studentDocument: 'E2', status: 'CALIFICADO' })).queued, 1);
    assert.match(repo.docs[0].contenido, /Quiz con abiertas/);
    assert.match(repo.docs[0].contenido, /4\.2 de 5\.0/);
    assert.equal((await service.handle('evaluation.graded', { attemptId: 12, studentDocument: 'E2', status: 'CALIFICADO' })).duplicates, 1);
  });
  await test('sin acceso a la BD de evaluación igual funciona con los datos del evento; busca al estudiante por documento', async () => {
    const { repo, service } = build({ practices: {}, students: { E7: person('E7', 'Rosa', 'León', 'rosa@udi.edu.co') } });
    assert.equal((await service.handle('evaluation.graded', { attemptId: 5, studentDocument: 'E7', status: 'CALIFICADO', title: 'Quiz', grade: 3.8, maxGrade: 5 })).queued, 1);
    assert.equal(repo.docs[0].destinatario.correo, 'rosa@udi.edu.co');
    assert.equal(repo.docs[0].Practica, undefined);
  });

  console.log('# validación');
  await test('evento desconocido o sin datos -> 400', async () => {
    const { service } = build();
    await rejects(service.handle('nada', {}), 400);
    await rejects(service.handle('practice.graded', undefined), 400);
    await rejects(service.handle('practice.graded', {}), 400);
  });
  done('events');
})();
