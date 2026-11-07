'use strict';
// Unit tests of the practice lifecycle state machine: no database, no network.
const assert = require('assert');
const PracticeLifecycleService = require('../src/services/practice-lifecycle.service');

let passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ✔', name); } catch (err) { console.error('  ✘', name, '\n   ', err.message); process.exitCode = 1; }
}

function build(practice, { hours = 0 } = {}) {
  const state = { ...practice };
  const events = [];
  const repo = {
    findById: async () => ({ ...state }),
    totalHours: async () => hours,
    setStatus: async (_id, status) => { state.status = status; }
  };
  const notifications = { practiceReadyToEvaluate: (e) => events.push(e) };
  return { state, events, service: new PracticeLifecycleService({ practiceRepository: repo, notificationService: notifications }) };
}

(async () => {
  console.log('# practice lifecycle');
  await test('active -> evaluating when every required hour is logged, and the tutor is told once', async () => {
    const { state, events, service } = build({ id: 'P1', status: 'active', requiredHours: 120 }, { hours: 120 });
    assert.equal(await service.syncHours('P1'), 'evaluating');
    assert.equal(state.status, 'evaluating');
    assert.deepEqual(events, [{ practiceId: 'P1' }]);
  });
  await test('active stays active while hours are missing; evaluating goes back if hours drop', async () => {
    const a = build({ id: 'P1', status: 'active', requiredHours: 120 }, { hours: 119 });
    assert.equal(await a.service.syncHours('P1'), 'active');
    assert.equal(a.events.length, 0);
    const b = build({ id: 'P1', status: 'evaluating', requiredHours: 120 }, { hours: 100 });
    assert.equal(await b.service.syncHours('P1'), 'active');
  });
  await test('grading / completed / cancelled are never touched by the hours', async () => {
    for (const status of ['grading', 'completed', 'cancelled']) {
      const { state, service } = build({ id: 'P1', status, requiredHours: 120 }, { hours: 0 });
      await service.syncHours('P1');
      assert.equal(state.status, status);
    }
  });
  await test('closing an evaluation moves evaluating -> grading only', async () => {
    const a = build({ id: 'P1', status: 'evaluating' });
    assert.equal(await a.service.evaluationClosed('P1'), 'grading');
    const b = build({ id: 'P1', status: 'active' });
    assert.equal(await b.service.evaluationClosed('P1'), 'active');
  });
  await test('final grade + observation -> completed; only the grade -> grading', async () => {
    const a = build({ id: 'P1', status: 'grading', finalGrade: 4.5, finalObservation: 'Excelente' });
    assert.equal(await a.service.afterLogbook({ id: 'P1' }, { finalGrade: 4.5 }), 'completed');
    const b = build({ id: 'P1', status: 'evaluating', finalGrade: 4.5, finalObservation: '' });
    assert.equal(await b.service.afterLogbook({ id: 'P1' }, { finalGrade: 4.5 }), 'grading');
    const c = build({ id: 'P1', status: 'grading', finalGrade: 0, finalObservation: '' });
    assert.equal(await c.service.afterLogbook({ id: 'P1' }, {}), 'grading');
  });
  await test('read-only: completed and cancelled reject writes; the final grade needs evaluating / grading', async () => {
    const { service } = build({ id: 'P1' });
    assert.throws(() => service.assertWritable({ status: 'completed' }), (e) => e.status === 409);
    assert.throws(() => service.assertWritable({ status: 'cancelled' }), (e) => e.status === 409);
    assert.doesNotThrow(() => service.assertWritable({ status: 'grading' }));
    assert.throws(() => service.assertCanGrade({ status: 'active' }), (e) => e.status === 409);
    assert.doesNotThrow(() => service.assertCanGrade({ status: 'evaluating' }));
    assert.doesNotThrow(() => service.assertCanGrade({ status: 'grading' }));
  });
  await test('editing the end date: completed -> grading; any other status is untouched', async () => {
    const { service } = build({ id: 'P1' });
    assert.equal(service.statusAfterEdit({ status: 'completed', endDate: '2026-06-01' }, { endDate: '2026-07-01' }), 'grading');
    assert.equal(service.statusAfterEdit({ status: 'completed', endDate: '2026-06-01' }, { endDate: '2026-06-01' }), 'completed');
    for (const status of ['active', 'evaluating', 'grading', 'cancelled']) {
      assert.equal(service.statusAfterEdit({ status, endDate: '2026-06-01' }, { endDate: '2026-09-01' }), status);
    }
  });

  console.log(`\nLIFECYCLE: ${passed} passed${process.exitCode ? ' (with failures)' : ' — ALL OK'}`);
})();
