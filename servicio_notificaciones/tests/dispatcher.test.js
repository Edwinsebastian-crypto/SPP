'use strict';
// Envío de correo: éxito, reintentos con espera, abandono, documentos heredados del monolito y envíos concurrentes.
const { assert, test, done, FakeNotificationRepository } = require('./helpers/harness');
const DispatcherService = require('../src/services/dispatcher.service');

const T0 = new Date('2026-10-27T12:00:00Z');
const mkNotification = (over = {}) => ({
  tipo: 'ActividadCalificada', destinatario: { numDocumento: 'E2', correo: 'mario@udi.edu.co', nombreCompleto: 'Mario Díaz' },
  asunto: 'Tu actividad fue calificada', contenido: 'Hola Mario,\n\nNota obtenida: 4.5', ...over
});
function build({ failWith = null } = {}) {
  const repo = new FakeNotificationRepository();
  const sent = [];
  const state = { failWith, now: T0 };
  const mailer = { send: async (m) => { if (state.failWith) throw new Error(state.failWith); sent.push(m); return { messageId: 'id' }; } };
  const dispatcher = new DispatcherService({ notificationRepository: repo, mailer, now: () => state.now, options: { maxAttempts: 3, retryBaseMs: 60000, batch: 5 } });
  return { repo, sent, dispatcher, state };
}

(async () => {
  await test('envía el correo (texto + HTML) y registra fechaEnvio', async () => {
    const { repo, sent, dispatcher } = build();
    await repo.enqueue(mkNotification(), T0);
    assert.deepEqual(await dispatcher.dispatchOnce(), { sent: 1, failed: 0, gaveUp: 0 });
    assert.equal(sent[0].to, 'mario@udi.edu.co');
    assert.equal(sent[0].subject, 'Tu actividad fue calificada');
    assert.match(sent[0].text, /Nota obtenida: 4\.5/);
    assert.match(sent[0].html, /<html/);
    assert.equal(repo.docs[0].estadoEnvio, 'Enviada');
    assert.deepEqual(repo.docs[0].fechaEnvio, T0);
    assert.deepEqual(await dispatcher.dispatchOnce(), { sent: 0, failed: 0, gaveUp: 0 }, 'ya enviada: no se envía otra vez');
  });
  await test('si el SMTP falla reintenta más tarde (espera creciente) y NO marca fechaEnvio', async () => {
    const { repo, sent, dispatcher, state } = build({ failWith: 'SMTP caído' });
    await repo.enqueue(mkNotification(), T0);
    assert.deepEqual(await dispatcher.dispatchOnce(), { sent: 0, failed: 1, gaveUp: 0 });
    const d = repo.docs[0];
    assert.equal(d.estadoEnvio, 'Pendiente'); assert.equal(d.fechaEnvio, undefined); assert.equal(d.ultimoError, 'SMTP caído');
    assert.equal(d.proximoIntento.getTime() - T0.getTime(), 60000);
    assert.deepEqual(await dispatcher.dispatchOnce(), { sent: 0, failed: 0, gaveUp: 0 }, 'aún no toca reintentar');
    state.now = new Date(T0.getTime() + 61000); state.failWith = null;
    assert.deepEqual(await dispatcher.dispatchOnce(), { sent: 1, failed: 0, gaveUp: 0 });
    assert.equal(sent.length, 1); assert.equal(d.intentos, 2);
  });
  await test('tras MAX_ATTEMPTS queda «Fallida» y puede reencolarse a mano', async () => {
    const { repo, dispatcher, state } = build({ failWith: 'rechazado' });
    await repo.enqueue(mkNotification(), T0);
    const origWarn = console.warn; console.warn = () => {};
    const results = [];
    for (let i = 0; i < 3; i += 1) { results.push(await dispatcher.dispatchOnce()); state.now = new Date(state.now.getTime() + 3600000); }
    console.warn = origWarn;
    assert.deepEqual(results.map((r) => [r.failed, r.gaveUp]), [[1, 0], [1, 0], [0, 1]]);
    assert.equal(repo.docs[0].estadoEnvio, 'Fallida');
    assert.deepEqual(await dispatcher.dispatchOnce(), { sent: 0, failed: 0, gaveUp: 0 });
    state.failWith = null;
    assert.equal(await repo.requeueFailed(), 1);
    assert.equal((await dispatcher.dispatchOnce()).sent, 1);
  });
  await test('IGNORA los documentos antiguos del monolito (sin estadoEnvio): no se reenvía el histórico', async () => {
    const { repo, sent, dispatcher } = build();
    repo.addLegacy({ ...mkNotification({ tipo: 'PracticaAsignada', asunto: 'Practice assigned: X' }), idPractica: 'PR1' });
    assert.deepEqual(await dispatcher.dispatchOnce(), { sent: 0, failed: 0, gaveUp: 0 });
    assert.equal(sent.length, 0);
    assert.equal(repo.docs[0].estadoEnvio, undefined);
  });
  await test('con LEGACY_QUEUE=true sí los envía', async () => {
    const { repo, sent } = build();
    const dispatcher = new DispatcherService({ notificationRepository: repo, mailer: { send: async (m) => { sent.push(m); } }, now: () => T0, options: { includeLegacy: true } });
    repo.addLegacy({ ...mkNotification({ tipo: 'PracticaAsignada', asunto: 'Practice assigned: X' }), idPractica: 'PR1' });
    assert.equal((await dispatcher.dispatchOnce()).sent, 1);
    assert.equal(sent[0].subject, 'Practice assigned: X');
    assert.equal(repo.docs[0].estadoEnvio, 'Enviada');
  });
  await test('recupera una reserva abandonada por un proceso que murió a mitad del envío', async () => {
    const { repo, sent, dispatcher, state } = build();
    await repo.enqueue(mkNotification(), T0);
    await repo.claimNext(T0, 1000); // otro proceso la reservó y murió
    assert.equal((await dispatcher.dispatchOnce()).sent, 0, 'reserva vigente: no se toca');
    state.now = new Date(T0.getTime() + 10 * 60000);
    assert.equal((await dispatcher.dispatchOnce()).sent, 1);
    assert.equal(sent.length, 1);
  });
  await test('respeta el tamaño de lote y el orden de creación', async () => {
    const { repo, sent, dispatcher, state } = build();
    state.now = new Date(T0.getTime() + 100);
    for (let i = 0; i < 8; i += 1) await repo.enqueue(mkNotification({ asunto: `n${i}` }), new Date(T0.getTime() + i));
    assert.equal((await dispatcher.dispatchOnce()).sent, 5);
    assert.deepEqual(sent.map((m) => m.subject), ['n0', 'n1', 'n2', 'n3', 'n4']);
    assert.equal((await dispatcher.dispatchOnce()).sent, 3);
  });
  await test('un error con un destinatario no detiene a los demás', async () => {
    const repo = new FakeNotificationRepository(); const sent = [];
    const mailer = { send: async (m) => { if (m.to === 'malo@x.co') throw new Error('buzón inexistente'); sent.push(m.to); } };
    const dispatcher = new DispatcherService({ notificationRepository: repo, mailer, now: () => T0, options: { maxAttempts: 3 } });
    for (const to of ['malo@x.co', 'bueno@x.co']) await repo.enqueue(mkNotification({ destinatario: { numDocumento: '1', correo: to, nombreCompleto: 'X' } }), T0);
    const origWarn = console.warn; console.warn = () => {};
    const r = await dispatcher.dispatchOnce(); console.warn = origWarn;
    assert.deepEqual([r.sent, r.failed], [1, 1]); assert.deepEqual(sent, ['bueno@x.co']);
  });
  done('dispatcher');
})();
