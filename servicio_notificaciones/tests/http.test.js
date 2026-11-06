'use strict';
// API HTTP real (puerto efímero) con servicios y cola en memoria.
const crypto = require('crypto');
const { assert, test, done, FakeNotificationRepository, FakePracticeReader, samplePractice, person } = require('./helpers/harness');
const SECRET = 'http-test-secret-0123456789';
process.env.NOTIFICATION_SERVICE_SECRET = SECRET;

const { createApp } = require('../src/app');
const NotificationService = require('../src/services/notification.service');
const EventService = require('../src/services/event.service');
const { JobsService } = require('../src/services/jobs.service');
const DispatcherService = require('../src/services/dispatcher.service');
const { createServiceAuth } = require('../src/middlewares/service-auth');

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function token(over = {}) {
  const iat = Math.floor(Date.now() / 1000);
  const h = b64({ alg: 'HS256', typ: 'JWT' }); const p = b64({ iss: 'spp-monolith', rol: 'SYSTEM', sub: 'spp', iat, exp: iat + 120, ...over });
  return `${h}.${p}.${crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url')}`;
}

(async () => {
  const repo = new FakeNotificationRepository();
  const sentMails = [];
  const reader = new FakePracticeReader({
    practices: { PR2: samplePractice() }, students: { E2: person('E2', 'Mario', 'Díaz', 'mario@udi.edu.co') },
    awaiting: [], ungraded: [], directors: []
  });
  const notifications = new NotificationService({ notificationRepository: repo });
  const container = {
    eventService: new EventService({ notifications, practiceReader: reader }),
    jobs: new JobsService({ notifications, practiceReader: reader, digestHour: 0 }),
    dispatcher: new DispatcherService({ notificationRepository: repo, mailer: { send: async (m) => { sentMails.push(m); return {}; } } }),
    notificationRepository: repo, auth: createServiceAuth({ secret: SECRET }), health: async () => ({ status: 'ok', mongo: true })
  };
  const server = createApp(container).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (path, { method = 'GET', body, auth = `Bearer ${token()}` } = {}) => fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) }, body: body ? JSON.stringify(body) : undefined
  });

  await test('GET /health es público', async () => {
    const r = await call('/health', { auth: null });
    assert.equal(r.status, 200); assert.equal((await r.json()).status, 'ok');
  });
  await test('la API exige el token del monolito (401/403)', async () => {
    assert.equal((await call('/api/v1/events', { method: 'POST', body: {}, auth: null })).status, 401);
    assert.equal((await call('/api/v1/events', { method: 'POST', body: {}, auth: `Bearer ${token({ rol: 'TUTOR' })}` })).status, 403);
    assert.equal((await call('/api/v1/notifications', { auth: 'Bearer abc.def.ghi' })).status, 401);
  });
  await test('POST /events: registro de usuario -> 202 y queda en la cola', async () => {
    const r = await call('/api/v1/events', { method: 'POST', body: { type: 'user.registered', data: { user: { documentNumber: '88', email: 'nuevo@udi.edu.co', firstName: 'Nuevo', lastName: 'Usuario', role: 'student', status: 'pending' } } } });
    assert.equal(r.status, 202); assert.deepEqual(await r.json(), { queued: 1, duplicates: 0, skipped: 0 });
    assert.equal(repo.docs[0].destinatario.correo, 'nuevo@udi.edu.co');
  });
  await test('POST /events: errores de validación -> 400 con mensaje', async () => {
    const r = await call('/api/v1/events', { method: 'POST', body: { type: 'no.existe', data: {} } });
    assert.equal(r.status, 400); assert.match((await r.json()).error, /Evento desconocido/);
    assert.equal((await call('/api/v1/events', { method: 'POST', body: { data: {} } })).status, 400);
    const bad = await fetch(`${base}/api/v1/events`, { method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: '{oops' });
    assert.equal(bad.status, 400);
  });
  await test('POST /jobs/run despacha la cola y marca fechaEnvio', async () => {
    const r = await call('/api/v1/jobs/run', { method: 'POST', body: { job: 'dispatch' } });
    assert.deepEqual(await r.json(), { sent: 1, failed: 0, gaveUp: 0 });
    assert.equal(sentMails[0].to, 'nuevo@udi.edu.co');
    assert.ok(repo.docs[0].fechaEnvio instanceof Date);
    assert.equal((await call('/api/v1/jobs/run', { method: 'POST', body: { job: 'nada' } })).status, 400);
  });
  await test('GET /notifications filtra y valida; retry-failed responde', async () => {
    const r = await call('/api/v1/notifications?tipo=UsuarioRegistrado');
    assert.equal(r.status, 200); assert.equal((await r.json()).length, 1);
    assert.equal((await call('/api/v1/notifications?tipo=Inventado')).status, 400);
    assert.deepEqual(await (await call('/api/v1/notifications/retry-failed', { method: 'POST' })).json(), { requeued: 0 });
  });
  await test('campanita: /notifications/inbox y /notifications/read por documento', async () => {
    await repo.enqueue({ tipo: 'ActividadCalificada', destinatario: { numDocumento: 'E2', correo: 'm@x.co', nombreCompleto: 'M' }, asunto: 'Nota', contenido: 'Hola', claveUnica: 'k1' });
    await repo.enqueue({ tipo: 'ActividadCalificada', destinatario: { numDocumento: 'E2', correo: 'm@x.co', nombreCompleto: 'M' }, asunto: 'Nota 2', contenido: 'Hola', claveUnica: 'k2' });
    await repo.enqueue({ tipo: 'ActividadCalificada', destinatario: { numDocumento: 'OTRO', correo: 'o@x.co', nombreCompleto: 'O' }, asunto: 'Ajena', contenido: 'x', claveUnica: 'k3' });
    repo.addLegacy({ tipo: 'PracticaAsignada', destinatario: { numDocumento: 'E2', correo: 'm@x.co', nombreCompleto: 'M' }, asunto: 'Practice assigned: viejo', contenido: 'x' });
    const inbox = await (await call('/api/v1/notifications/inbox?documento=E2')).json();
    assert.equal(inbox.unread, 2);
    assert.deepEqual(inbox.notifications.map((n) => n.subject), ['Nota 2', 'Nota']); // sin ajenas ni históricas
    assert.equal(inbox.notifications[0].read, false);
    assert.deepEqual(await (await call('/api/v1/notifications/read', { method: 'POST', body: { documento: 'E2', id: inbox.notifications[0].id } })).json(), { marked: 1 });
    assert.equal((await (await call('/api/v1/notifications/inbox?documento=E2')).json()).unread, 1);
    assert.deepEqual(await (await call('/api/v1/notifications/read', { method: 'POST', body: { documento: 'E2' } })).json(), { marked: 1 });
    assert.equal((await (await call('/api/v1/notifications/inbox?documento=OTRO')).json()).unread, 1, 'no toca las de otros usuarios');
    assert.equal((await call('/api/v1/notifications/inbox')).status, 400);
  });
  await test('rutas inexistentes -> 404 JSON', async () => {
    const r = await call('/api/v1/otra', { auth: `Bearer ${token()}` });
    assert.equal(r.status, 404); assert.ok((await r.json()).error);
  });

  server.close();
  done('http');
})();
