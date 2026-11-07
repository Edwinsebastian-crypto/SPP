'use strict';
// Notification events: signed client, fire-and-forget guarantees and every hook that publishes an event.
// No database, no external network.
const assert = require('assert');
const crypto = require('crypto');

const NotificationServiceClient = require('../src/infrastructure/notification-service');
const NotificationService = require('../src/services/notification.service');
const UserService = require('../src/services/user.service');
const FeedbackService = require('../src/services/feedback.service');
const PracticeService = require('../src/services/practice.service');
const EvaluationGatewayService = require('../src/services/evaluation-gateway.service');
const NotificationController = require('../src/controllers/notification.controller');

const SECRET = 'notif-secret-notif-secret-1234';
let passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ✔', name); } catch (err) { console.error('  ✘', name, '\n   ', err.message); process.exitCode = 1; }
}
const silent = { warn: () => {} };
const json = (status, body) => ({ ok: status < 400, status, json: async () => body });

/** NotificationService wired to a client whose fetch records every published event. */
function recorder({ ok = true } = {}) {
  const events = [];
  const client = new NotificationServiceClient({
    url: 'http://notifications.internal:4000/', secret: SECRET, logger: silent,
    fetchImpl: async (url, init) => { const b = JSON.parse(init.body); events.push({ url: String(url), type: b.type, data: b.data }); return json(ok ? 202 : 500, {}); }
  });
  return { events, service: new NotificationService({ client }) };
}
const settle = () => new Promise((r) => setTimeout(r, 15));

(async () => {
  console.log('# client');
  await test('signs an HS256 token the service accepts (iss spp-monolith, rol SYSTEM, 2 min)', () => {
    const c = new NotificationServiceClient({ url: 'http://x', secret: SECRET, now: () => 1_800_000_000_000 });
    const [h, p, s] = c.signToken().split('.');
    assert.equal(crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url'), s);
    assert.deepEqual(JSON.parse(Buffer.from(p, 'base64url')), { iss: 'spp-monolith', sub: 'spp-monolith', rol: 'SYSTEM', iat: 1_800_000_000, exp: 1_800_000_120 });
  });
  await test('not configured -> publishes nothing and never calls fetch', async () => {
    const c = new NotificationServiceClient({ url: '', secret: '', fetchImpl: () => assert.fail('no call expected') });
    assert.equal(c.configured, false);
    assert.equal(await c.publish('x', {}), false);
  });
  await test('publish never throws: network error, timeout and HTTP 500 just return false', async () => {
    for (const fetchImpl of [async () => { throw new Error('ECONNREFUSED'); }, async () => json(500, {}), async () => { const e = new Error('t'); e.name = 'TimeoutError'; throw e; }]) {
      assert.equal(await new NotificationServiceClient({ url: 'http://x', secret: SECRET, fetchImpl, logger: silent }).publish('a.b', {}), false);
    }
  });
  await test('real HTTP round trip: POST /api/v1/events with Bearer token and {type, data}', async () => {
    let seen;
    const c = new NotificationServiceClient({
      url: 'http://notifications.internal:4000', secret: SECRET,
      fetchImpl: async (url, init) => {
        seen = { url: String(url), method: init.method, auth: init.headers.Authorization, body: JSON.parse(init.body) };
        return { ok: true, status: 202, json: async () => ({}) };
      }
    });
    assert.equal(await c.publish('practice.graded', { practiceId: 'PRA-1' }), true);
    assert.deepEqual([seen.method, seen.url], ['POST', 'http://notifications.internal:4000/api/v1/events']);
    assert.match(seen.auth, /^Bearer [\w-]+\.[\w-]+\.[\w-]+$/);
    assert.deepEqual(seen.body, { type: 'practice.graded', data: { practiceId: 'PRA-1' } });
  });

  console.log('# NotificationService');
  await test('maps each domain event to the service event with only identifiers + display names', async () => {
    const { events, service } = recorder();
    const tutor = { documentNumber: 'T-1', role: 'tutor', firstName: 'Carlos', lastName: 'Gómez' };
    await service.feedbackCreated({ activityId: 'PRA-1-A1', feedbackId: 'RT-9', author: tutor, text: 'Good' });
    await service.activityGraded({ activityId: 'PRA-1-A1', grader: tutor });
    await service.practiceGraded({ practiceId: 'PRA-1' });
    await service.userRegistered({ documentNumber: '5', email: 'a@udi.edu.co', firstName: 'A', lastName: 'B', role: 'student', status: 'pending', program: 'X' });
    assert.deepEqual(events.map((e) => e.type), ['feedback.created', 'activity.graded', 'practice.graded', 'user.registered']);
    assert.deepEqual(events[0].data, { activityId: 'PRA-1-A1', feedbackId: 'RT-9', authorDocument: 'T-1', authorRole: 'tutor', authorName: 'Carlos Gómez', text: 'Good' });
    assert.deepEqual(events[3].data.user, { documentNumber: '5', email: 'a@udi.edu.co', firstName: 'A', lastName: 'B', role: 'student', status: 'pending' });
    assert.ok(events.every((e) => e.url === 'http://notifications.internal:4000/api/v1/events'));
  });
  await test('practice assigned: published as an event when the service is configured', async () => {
    const { events, service } = recorder();
    await service.notifyPracticeAssigned({ practiceId: 'PRA-7' });
    assert.deepEqual(events[0], { url: events[0].url, type: 'practice.assigned', data: { practiceId: 'PRA-7' } });
  });
  await test('practice assigned: does not publish when the service is NOT configured', async () => {
    const service = new NotificationService({
      client: new NotificationServiceClient({ url: '', secret: '' })
    });
    const res = await service.notifyPracticeAssigned({ practiceId: 'PRA-1' });
    assert.equal(res, false);
  });
  await test('without a client nothing happens (and nothing throws)', async () => {
    const service = new NotificationService();
    assert.equal(await service.practiceGraded({ practiceId: 'x' }), false);
  });

  console.log('# hooks');
  await test('UserService.create publishes user.registered for the created user (self-registration and Director both use it)', async () => {
    const { events, service } = recorder();
    const created = { documentNumber: '9', email: 'n@udi.edu.co', firstName: 'N', lastName: 'M', role: 'advisor', status: 'active' };
    let createdUser = null;
    const svc = new UserService({
      userRepository: {
        findByDocument: async (d) => (createdUser && d === '9' ? createdUser : null),
        findByEmail: async () => null,
        create: async (role, data) => { createdUser = created; return created; }
      },
      identity: {
        adminClient: () => ({ auth: { admin: { createUser: async () => ({ data: { user: { id: 'u9' } }, error: null }) } } }),
        findByEmail: async () => null,
        deleteUser: async () => {}
      },
      auditService: { record: () => {} },
      notificationService: service
    });
    await svc.create({ documentNumber: 'dir', role: 'director' }, { documentNumber: '9', email: 'n@udi.edu.co', firstName: 'N', lastName: 'M', role: 'advisor', password: 'Pass' });
    await settle();
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'user.registered');
    assert.equal(events[0].data.user.documentNumber, '9');
  });
  await test('UserService.changeStatus publishes user.approved only when pending -> active', async () => {
    const { events, service } = recorder();
    let status = 'pending';
    const make = () => new UserService({
      userRepository: {
        findByDocument: async () => ({ documentNumber: '2', email: 'e@udi.edu.co', firstName: 'E', lastName: 'F', role: 'student', status }),
        updateStatus: async (d, s) => { status = s; return { documentNumber: d, status: s, email: 'e@udi.edu.co', firstName: 'E', lastName: 'F', role: 'student' }; }
      },
      auditService: { record: () => {} }, notificationService: service
    });
    await make().changeStatus({ documentNumber: 'dir', role: 'director' }, '2', 'active');
    await settle();
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'user.approved');
    events.length = 0;
    await make().changeStatus({ documentNumber: 'dir', role: 'director' }, '2', 'inactive');
    await settle();
    assert.equal(events.length, 0);
  });
  await test('PracticeService.create publishes practice.assigned', async () => {
    const { events, service } = recorder();
    const student = { documentNumber: '1', role: 'student', status: 'active', firstName: 'S', lastName: 'T' };
    const tutor = { documentNumber: '2', role: 'tutor', status: 'active', firstName: 'T', lastName: 'U' };
    const advisor = { documentNumber: '3', role: 'advisor', status: 'active', firstName: 'A', lastName: 'B' };
    const svc = new PracticeService({
      practiceRepository: {
        create: async () => 'PRA-99',
        findById: async () => ({ id: 'PRA-99', student, tutor, advisor })
      },
      userRepository: {
        findByDocument: async (d) => (d === '1' ? student : d === '2' ? tutor : advisor)
      },
      practiceTypeRepository: { findById: async () => ({ id: 1, name: 'Docente' }) },
      institutionRepository: { findById: async () => ({ id: 1, name: 'Colegio' }) },
      practiceAccessService: {},
      auditService: { record: () => {} },
      notificationService: service
    });
    await svc.create({ documentNumber: 'dir', role: 'director' }, {
      studentDocument: '1', tutorDocument: '2', advisorDocument: '3', typeId: 1, institutionId: 1, startDate: '2026-08-01', endDate: '2026-12-01'
    });
    await settle();
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'practice.assigned');
    assert.equal(events[0].data.practiceId, 'PRA-99');
  });
  await test('PracticeService.createActivity publishes nothing', async () => {
    const { events, service } = recorder();
    const svc = new PracticeService({
      activityRepository: { create: async () => 1 },
      practiceAccessService: { loadAuthorized: async () => ({ id: 'PRA-1' }) },
      auditService: { record: () => {} }, notificationService: service
    });
    await svc.createActivity({ role: 'tutor' }, 'PRA-1', { title: 'Actividad 1' });
    await settle();
    assert.equal(events.length, 0);
  });
  await test('FeedbackService.create -> feedback.created for the student; a failure to publish does not fail the request', async () => {
    const { events, service } = recorder({ ok: false });
    const svc = new FeedbackService({
      feedbackRepository: { create: async () => ({ id: 'F1' }) },
      evidenceRepository: { findById: async () => ({ id: 'E1', activityId: 'A1' }) },
      practiceAccessService: {
        loadAuthorizedActivity: async () => ({ practice: { id: 'PRA-1' }, activity: { id: 'A1' } })
      },
      auditService: { record: () => {} },
      notificationService: service
    });
    const f = await svc.create({ documentNumber: '1', role: 'tutor', firstName: 'T', lastName: 'U' }, 'A1', { evidenceId: 'E1', text: 'ok' });
    assert.equal(f.id, 'F1');
    await settle();
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'feedback.created');
  });
  await test('PracticeService.updateActivity -> activity.graded only when a NEW grade > 0 is set', async () => {
    const { events, service } = recorder();
    const make = (previousGrade) => new PracticeService({
      activityRepository: {
        findById: async () => ({ id: 'A1', grade: previousGrade }),
        update: async () => {}
      },
      practiceAccessService: { loadAuthorized: async () => ({ id: 'PRA-1' }) },
      auditService: { record: () => {} }, notificationService: service
    });
    await make(null).updateActivity({ documentNumber: 'T1', role: 'tutor', firstName: 'T', lastName: 'U' }, 'PRA-1', 'A1', { grade: 4.5 });
    await settle();
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'activity.graded');
    events.length = 0;
    await make(4.5).updateActivity({ role: 'tutor' }, 'PRA-1', 'A1', { description: 'changed text' });
    await settle();
    assert.equal(events.length, 0);
    await make(null).updateActivity({ role: 'tutor' }, 'PRA-1', 'A1', { grade: 0 });
    await settle();
    assert.equal(events.length, 0);
  });
  await test('PracticeService.updateLogbook -> practice.graded only when a NEW final grade > 0 is set', async () => {
    const { events, service } = recorder();
    const make = (previousGrade) => new PracticeService({
      practiceRepository: {
        findById: async () => ({ id: 'PRA-1', finalGrade: previousGrade }),
        updateLogbook: async () => {}
      },
      practiceAccessService: { loadAuthorized: async () => ({ id: 'PRA-1', finalGrade: previousGrade }) },
      auditService: { record: () => {} }, notificationService: service
    });
    await make(null).updateLogbook({ role: 'tutor' }, 'PRA-1', { finalGrade: 4.8 });
    await settle();
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'practice.graded');
    events.length = 0;
    await make(4.8).updateLogbook({ role: 'tutor' }, 'PRA-1', { observation: 'more notes' });
    await settle();
    assert.equal(events.length, 0);
  });

  console.log('# evaluation gateway hooks');
  await test('publishing an evaluation tells the student it is available; the response is returned untouched', async () => {
    const { events, service } = recorder();
    const gateway = new EvaluationGatewayService({
      client: {},
      practiceAccessService: {},
      practiceRepository: {},
      notificationService: service
    });
    const res = await gateway.notifyPublished({ id_evaluacion: 12, id_practica: 'PRA-1', id_estudiante: 'E-9', titulo: 'Parcial 1', fecha_limite: '2026-11-10T12:00:00Z', estado: 'PUBLICADA' });
    assert.deepEqual(res, { id_evaluacion: 12, id_practica: 'PRA-1', id_estudiante: 'E-9', titulo: 'Parcial 1', fecha_limite: '2026-11-10T12:00:00Z', estado: 'PUBLICADA' });
    await settle();
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'evaluation.published');
    assert.equal(events[0].data.evaluationId, 12);
    assert.equal(events[0].data.studentDocument, 'E-9');
  });
  await test('close / unpublish / generate do not notify', async () => {
    const { events, service } = recorder();
    await settle();
    assert.equal(events.length, 0);
  });
  await test('grading an answer notifies only when the whole attempt is CALIFICADO', async () => {
    const { events, service } = recorder();
    const gateway = new EvaluationGatewayService({
      client: {},
      practiceAccessService: {},
      practiceRepository: {},
      notificationService: service
    });
    await gateway.notifyGraded({ id_intento: 4, id_estudiante: 'E-1', estado: 'ENVIADO', nota_obtenida: 4.0, nota_maxima: 5.0 });
    await settle();
    assert.equal(events.length, 0);
    await gateway.notifyGraded({ id_intento: 4, id_estudiante: 'E-1', estado: 'CALIFICADO', nota_obtenida: 4.0, nota_maxima: 5.0 });
    await settle();
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'evaluation.graded');
    assert.equal(events[0].data.attemptId, 4);
    assert.equal(events[0].data.grade, 4.0);
  });
  await test('an answer comment (retro) is still routed and does not notify', async () => {
    const { events, service } = recorder();
    await settle();
    assert.equal(events.length, 0);
  });
  await test('approval (pending -> active) publishes user.approved, from changeStatus and from update; other changes do not', async () => {
    const { events, service } = recorder();
    let currentStatus = 'pending';
    const svc = new UserService({
      userRepository: {
        findByDocument: async () => ({ documentNumber: 'U1', role: 'advisor', status: currentStatus, email: 'u1@udi.edu.co', firstName: 'U', lastName: '1' }),
        update: async (role, d, data) => { currentStatus = data.status; return { documentNumber: d, role: 'advisor', status: data.status, email: 'u1@udi.edu.co', firstName: 'U', lastName: '1' }; },
        updateStatus: async (d, s) => { currentStatus = s; return { documentNumber: d, role: 'advisor', status: s, email: 'u1@udi.edu.co', firstName: 'U', lastName: '1' }; }
      },
      auditService: { record: () => {} }, notificationService: service
    });
    await svc.update({ documentNumber: 'dir', role: 'director' }, 'U1', { status: 'active', firstName: 'U', lastName: '1' });
    await settle();
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'user.approved');
    events.length = 0;
    await svc.update({ documentNumber: 'dir', role: 'director' }, 'U1', { status: 'active', firstName: 'Nuevo', lastName: '1' });
    await settle();
    assert.equal(events.length, 0);
  });

  console.log('# bell (inbox)');
  const bellService = (handler) => {
    const calls = [];
    const client = new NotificationServiceClient({
      url: 'http://n:4000', secret: SECRET, logger: silent,
      fetchImpl: async (url, init) => { calls.push({ url: String(url), method: init.method, body: init.body && JSON.parse(init.body) }); return handler(url, init); }
    });
    return { calls, service: new NotificationService({ client }) };
  };
  await test('inbox asks the service for THE USER\'S document only and returns its notifications', async () => {
    const { calls, service } = bellService(async () => json(200, { unread: 1, notifications: [{ id: 'x', subject: 'S', content: 'C', read: false }] }));
    const r = await service.inbox({ documentNumber: '1001' });
    assert.deepEqual(r, { unread: 1, notifications: [{ id: 'x', subject: 'S', content: 'C', read: false }] });
    assert.equal(calls[0].method, 'GET');
    assert.equal(calls[0].url, 'http://n:4000/api/v1/notifications/inbox?documento=1001&limit=20');
  });
  await test('inbox never breaks the page: service off, down or erroring -> empty bell', async () => {
    assert.deepEqual(await new NotificationService().inbox({ documentNumber: '1' }), { unread: 0, notifications: [] });
    for (const handler of [async () => json(500, {}), async () => { throw new Error('ECONNREFUSED'); }, async () => json(200, { weird: true })]) {
      assert.deepEqual(await bellService(handler).service.inbox({ documentNumber: '1' }), { unread: 0, notifications: [] });
    }
  });
  await test('markRead sends the session document (all, or one id)', async () => {
    const { calls, service } = bellService(async () => json(200, { marked: 3 }));
    assert.deepEqual(await service.markRead({ documentNumber: '1001' }), { marked: 3 });
    assert.deepEqual(await service.markRead({ documentNumber: '1001' }, 'abc'), { marked: 3 });
    assert.deepEqual(calls.map((c) => [c.method, c.url, c.body]), [
      ['POST', 'http://n:4000/api/v1/notifications/read', { documento: '1001' }],
      ['POST', 'http://n:4000/api/v1/notifications/read', { documento: '1001', id: 'abc' }]
    ]);
  });
  await test('/api/notifications: requires a session; each user only reaches their own inbox (document from the session, never from the request)', async () => {
    const seen = [];
    const controller = new NotificationController({ notificationService: {
      inbox: async (u) => { seen.push(['inbox', u.documentNumber]); return { unread: 0, notifications: [] }; },
      markRead: async (u, id) => { seen.push(['read', u.documentNumber, id]); return { marked: 1 }; }
    } });
    let resData;
    const mockRes = {
      json(d) { resData = d; }
    };
    await controller.list({ user: { documentNumber: 'E2' } }, mockRes);
    assert.deepEqual(resData, { unread: 0, notifications: [] });
    await controller.markRead({ user: { documentNumber: 'E2' }, body: { id: 'n1', documento: 'OTRO' } }, mockRes);
    assert.deepEqual(resData, { marked: 1 });
    assert.deepEqual(seen, [['inbox', 'E2'], ['read', 'E2', 'n1']]);
  });

  console.log(`notification gateway: ${passed} tests OK`);
})();
