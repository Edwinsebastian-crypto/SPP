'use strict';
// Lógica pura: plantillas, HTML del correo, fechas, autenticación entre servicios y modelo Mongo. Sin red ni BD.
const crypto = require('crypto');
const { assert, test, done } = require('./helpers/harness');
process.env.APP_URL = 'https://spp.example.edu';

const tpl = require('../src/services/templates');
const { renderEmail } = require('../src/services/render-email');
const { localParts, formatWallClock, formatDate } = require('../src/utils/dates');
const { createServiceAuth } = require('../src/middlewares/service-auth');
const { buildModel } = require('../src/models/notification.model');
const { NOTIFICATION_TYPE_LIST } = require('../src/config/constants');

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const SECRET = 'a-secret-with-at-least-16-chars';
const token = (claims, { secret = SECRET, alg = 'HS256' } = {}) => {
  const h = b64({ alg, typ: 'JWT' }); const p = b64(claims);
  return `${h}.${p}.${crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url')}`;
};
const run = (auth, header) => new Promise((resolve) => auth({ get: () => header }, {}, (err) => resolve(err || null)));

(async () => {
  console.log('# plantillas');
  await test('cada notificación del enunciado tiene asunto y contenido en español', () => {
    const cases = [
      tpl.userRegistered({ fullName: 'Laura Pérez', role: 'student', status: 'pending' }),
      tpl.activityFeedback({ fullName: 'Laura Pérez', activityTitle: 'Diario', authorName: 'Carlos Gómez', authorRole: 'tutor', text: 'Bien' }),
      tpl.activityGraded({ fullName: 'Laura Pérez', activityTitle: 'Diario', grade: 4.5, graderName: 'Ana Mejía', graderRole: 'advisor' }),
      tpl.practiceGraded({ fullName: 'Laura Pérez', practiceName: 'Práctica I', finalGrade: 4.2, observation: 'Muy bien' }),
      tpl.evaluationAvailable({ fullName: 'Laura Pérez', title: 'Quiz', dueAt: '2026-11-01T15:00:00Z', tz: 'America/Bogota' }),
      tpl.evaluationGraded({ fullName: 'Laura Pérez', title: 'Quiz', grade: 4, maxGrade: 5 }),
      tpl.activityDueSoon({ fullName: 'Laura Pérez', activityTitle: 'Diario', dueLocal: '2026-10-28T17:00:00' })
    ];
    for (const c of cases) { assert.ok(c.subject.length > 5); assert.match(c.content, /^Hola /); }
    assert.match(cases[0].content, /pendiente de aprobación/);
    assert.match(cases[2].content, /Nota obtenida: 4\.5/);
    assert.match(cases[3].content, /Nota final: 4\.2/);
    assert.match(cases[6].content, /28 de octubre de 2026/);
  });
  await test('registro: cuenta creada por el director no dice «pendiente»', () => {
    assert.doesNotMatch(tpl.userRegistered({ fullName: 'Ana M', role: 'advisor', status: 'active' }).content, /pendiente/);
  });
  await test('resumen del tutor lista cada sección y limita la lista a 10 con «y N más»', () => {
    const many = Array.from({ length: 13 }, (_, i) => `Estudiante ${i} — Actividad`);
    const n = tpl.reviewPending({ fullName: 'Carlos Gómez', role: 'tutor', grade: many, feedback: ['x'], practices: ['p'], evaluations: ['e'] });
    assert.match(n.subject, /16 pendientes/);
    assert.match(n.content, /esperando tu revisión: 1 actividad por retroalimentar, 13 actividades por calificar, 1 evaluación por calificar, 1 práctica por calificar\./);
    assert.match(n.content, /Actividades por calificar \(13\)/);
    assert.match(n.content, /… y 3 más\./);
    assert.match(n.content, /Prácticas por calificar \(1\)/);
    assert.match(n.content, /Evaluaciones por calificar \(1\)/);
  });
  await test('el total del resumen no cuenta dos veces la misma actividad (por retroalimentar Y por calificar)', () => {
    const n = tpl.reviewPending({ fullName: 'Carlos Gómez', role: 'tutor', grade: ['A — X', 'B — Y'], feedback: ['A — X', 'B — Y'], practices: ['P'], evaluations: [] });
    assert.match(n.subject, /Tienes 3 pendientes/);
  });
  await test('aprobación de cuenta: asunto y texto', () => {
    const n = tpl.userApproved({ fullName: 'Laura Pérez', role: 'student' });
    assert.equal(n.subject, 'Tu cuenta en SPP fue aprobada');
    assert.match(n.content, /aprobó tu registro como estudiante/);
  });
  await test('resumen del director: singular/plural', () => {
    assert.match(tpl.ungradedPractices({ fullName: 'D T', items: [{ studentName: 'A', endDate: '2026-10-01' }], total: 1, tz: 'UTC' }).subject, /1 práctica sin calificar/);
    assert.match(tpl.ungradedPractices({ fullName: 'D T', items: [], total: 4, tz: 'UTC' }).subject, /4 prácticas sin calificar/);
  });

  console.log('# correo HTML');
  await test('escapa el contenido dinámico (no se puede inyectar HTML)', () => {
    const { html, text } = renderEmail({ subject: '<b>x</b>', content: 'Hola <script>alert(1)</script>\n\n• <img src=x onerror=1>' });
    assert.ok(!html.includes('<script>') && !html.includes('<img src=x'));
    assert.match(html, /&lt;script&gt;/);
    assert.match(text, /https:\/\/spp\.example\.edu/);
    assert.match(html, /href="https:\/\/spp\.example\.edu"/);
  });

  console.log('# fechas');
  await test('localParts respeta la zona horaria y formatWallClock no desplaza la hora', () => {
    const p = localParts(new Date('2026-10-28T03:30:00Z'), 'America/Bogota'); // 22:30 del 27
    assert.deepEqual([p.day, p.hour], ['2026-10-27', 22]);
    assert.match(formatWallClock('2026-10-28T17:00:00'), /28 de octubre de 2026/);
    assert.match(formatWallClock('2026-10-28T17:00:00'), /5:00/);
    assert.equal(formatDate('2026-10-01', 'America/Bogota'), '1 de octubre de 2026');
  });

  console.log('# autenticación entre servicios');
  const now = () => 1_800_000_000_000;
  const auth = createServiceAuth({ secret: SECRET, now });
  const good = { iss: 'spp-monolith', rol: 'SYSTEM', sub: 'spp', iat: 1_800_000_000, exp: 1_800_000_120 };
  await test('acepta un token válido', async () => assert.equal(await run(auth, `Bearer ${token(good)}`), null));
  await test('rechaza: sin token, firma ajena, vencido, otro emisor, otro rol, alg none', async () => {
    assert.equal((await run(auth, undefined)).status, 401);
    assert.equal((await run(auth, `Bearer ${token(good, { secret: 'otra-clave-distinta-1234' })}`)).status, 401);
    assert.equal((await run(auth, `Bearer ${token({ ...good, exp: 1_700_000_000 })}`)).status, 401);
    assert.equal((await run(auth, `Bearer ${token({ ...good, iss: 'otro' })}`)).status, 403);
    assert.equal((await run(auth, `Bearer ${token({ ...good, rol: 'TUTOR' })}`)).status, 403);
    assert.equal((await run(auth, `Bearer ${b64({ alg: 'none' })}.${b64(good)}.`)).status, 401);
  });
  await test('sin secreto configurado el servicio no acepta a nadie', async () => {
    assert.equal((await run(createServiceAuth({ secret: '', now }), `Bearer ${token(good)}`)).status, 401);
  });

  console.log('# modelo Mongo (diccionario TB-0001)');
  const mongoose = require('mongoose');
  const Model = buildModel(mongoose.createConnection());
  const base = { tipo: 'UsuarioRegistrado', destinatario: { numDocumento: '1', correo: 'a@b.c', nombreCompleto: 'A B' }, asunto: 'a', contenido: 'c' };
  await test('Practica y fechaEnvio son opcionales (registro de usuarios no tiene práctica)', () => {
    const d = new Model(base);
    assert.equal(d.validateSync(), undefined);
    assert.equal(d.estadoEnvio, 'Pendiente');
    assert.ok(d.fechaCreacion instanceof Date);
    assert.equal(d.fechaEnvio, undefined);
  });
  await test('guarda el objeto Practica con los campos del diccionario', () => {
    const d = new Model({ ...base, tipo: 'PracticaAsignada', Practica: { idPractica: 'PR1', fechainicio: '2026-08-01', fechafinal: '2026-12-01', notaFinal: 0, observacionFinal: '', estado: 'activa', idTipoPractica: 'TP1', numDocEstudiante: 'E1', numDocTutor: 'T1', numDocAsesor: 'A1', nitEntidad: '900123' } });
    assert.equal(d.validateSync(), undefined);
    assert.equal(d.toObject().Practica.nitEntidad, '900123');
  });
  await test('rechaza tipos desconocidos y destinatarios incompletos; acepta los 12 tipos definidos', () => {
    assert.ok(new Model({ ...base, tipo: 'Otro' }).validateSync().errors.tipo);
    assert.ok(new Model({ ...base, destinatario: { numDocumento: '1' } }).validateSync());
    assert.equal(NOTIFICATION_TYPE_LIST.length, 12);
    for (const tipo of NOTIFICATION_TYPE_LIST) assert.equal(new Model({ ...base, tipo }).validateSync(), undefined, tipo);
  });

  console.log('# configuración');
  await test('la URI de Mongo se arma con MONGO_HOST/USER/PASSWORD (codificando símbolos) y MONGO_URI_NOTIFICATIONS tiene prioridad', () => {
    const env = require('../src/config/env');
    const keys = ['MONGO_URI_NOTIFICATIONS', 'MONGO_HOST', 'MONGO_USER', 'MONGO_PASSWORD', 'MONGO_DB'];
    const set = (o) => { keys.forEach((k) => delete process.env[k]); Object.assign(process.env, o); return env.mongoUri; };
    assert.equal(set({ MONGO_HOST: 'mongo', MONGO_USER: 'spp', MONGO_PASSWORD: 'p@ss:/w', MONGO_DB: 'x' }), 'mongodb://spp:p%40ss%3A%2Fw@mongo:27017/x?authSource=admin');
    assert.equal(set({ MONGO_HOST: 'mongo', MONGO_URI_NOTIFICATIONS: 'mongodb+srv://a' }), 'mongodb+srv://a');
    assert.equal(set({}), '');
  });

  done('unit');
})();
