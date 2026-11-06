'use strict';
const { assert, test, done } = require('./helpers/harness');
const PracticeReader = require('../src/repositories/practice-reader.repository');
const EvaluationReader = require('../src/repositories/evaluation-reader.repository');

(async () => {
  console.log('# PracticeReaderRepository (cliente HTTP hacia el monolito)');

  await test('consulta estudiantes, tutores y asesores por endpoint interno', async () => {
    const calls = [];
    const fakeFetch = async (url, opts) => {
      calls.push({ url, headers: opts.headers });
      return {
        ok: true,
        status: 200,
        json: async () => ({ documentNumber: '123', fullName: 'Ana Ruiz', email: 'ana@udi.edu.co', status: 'activo' })
      };
    };

    const reader = new PracticeReader({ baseUrl: 'http://test-monolith:3000', secret: 'sec-123', fetchFn: fakeFetch });
    const p = await reader.findStudent('123');
    assert.equal(p.fullName, 'Ana Ruiz');
    assert.equal(calls[0].url, 'http://test-monolith:3000/api/internal/notifications/persons/student/123');
    assert.equal(calls[0].headers.Authorization, 'Bearer sec-123');
  });

  await test('consulta actividades por vencer y resúmenes con parámetros', async () => {
    const calls = [];
    const fakeFetch = async (url) => {
      calls.push(url);
      return { ok: true, status: 200, json: async () => [{ activityId: 'A1' }] };
    };

    const reader = new PracticeReader({ baseUrl: 'http://test-monolith:3000', secret: 'sec-123', timezone: 'America/Bogota', fetchFn: fakeFetch });
    const acts = await reader.listActivitiesDueSoon(48);
    assert.equal(acts.length, 1);
    assert.equal(calls[0], 'http://test-monolith:3000/api/internal/notifications/activities/due-soon?hours=48&tz=America%2FBogota');
  });

  await test('maneja 404 o caídas sin lanzar excepción', async () => {
    const fakeFetch = async () => ({ ok: false, status: 404 });
    const reader = new PracticeReader({ baseUrl: 'http://test-monolith:3000', fetchFn: fakeFetch });
    assert.equal(await reader.findPractice('NO_EXISTE'), null);
    assert.deepEqual(await reader.listActiveDirectors(), []);
  });

  console.log('# EvaluationReaderRepository (cliente HTTP hacia servicio de evaluación)');

  await test('consulta intentos y evaluaciones pendientes por endpoint interno', async () => {
    const calls = [];
    const fakeFetch = async (url, opts) => {
      calls.push({ url, headers: opts.headers });
      return {
        ok: true,
        status: 200,
        json: async () => ({ attemptId: 10, status: 'CALIFICADO', grade: 4.5, title: 'Quiz 1' })
      };
    };

    const reader = new EvaluationReader({ baseUrl: 'http://test-eval:8000', secret: 'eval-sec', fetchFn: fakeFetch });
    const attempt = await reader.findAttempt(10);
    assert.equal(attempt.title, 'Quiz 1');
    assert.equal(calls[0].url, 'http://test-eval:8000/api/v1/internal/intentos/10');
    assert.equal(calls[0].headers.Authorization, 'Bearer eval-sec');
  });

  done('readers');
})();
