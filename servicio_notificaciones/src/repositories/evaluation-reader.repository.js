'use strict';
const env = require('../config/env');

/**
 * Cliente HTTP que solicita los datos de evaluaciones al microservicio de evaluación (FastAPI).
 * El microservicio de notificaciones NO accede a la base de datos de evaluación directamente.
 */
class EvaluationReaderRepository {
  /**
   * @param {{baseUrl?: string, secret?: string, timeoutMs?: number, fetchFn?: Function}} deps
   */
  constructor({
    baseUrl = env.evaluationServiceUrl,
    secret = env.evaluationServiceSecret,
    timeoutMs = 5000,
    fetchFn = globalThis.fetch
  } = {}) {
    this.baseUrl = (baseUrl || '').replace(/\/+$/, '');
    this.secret = secret || '';
    this.timeoutMs = timeoutMs;
    this.fetch = fetchFn;
  }

  async #get(path) {
    if (!this.baseUrl) return null;
    const url = `${this.baseUrl}/api/v1/internal${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...(this.secret ? { Authorization: `Bearer ${this.secret}` } : {})
        },
        signal: controller.signal
      });
      if (res.status === 404) return null;
      if (!res.ok) {
        console.warn(`[evaluation-reader] GET ${url} -> ${res.status}`);
        return null;
      }
      return await res.json();
    } catch (err) {
      console.warn(`[evaluation-reader] Error en GET ${url}: ${err.message}`);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  findAttempt(attemptId) {
    return this.#get(`/intentos/${encodeURIComponent(attemptId)}`);
  }

  async listDueSoon(hours = 24) {
    const data = await this.#get(`/evaluaciones/due-soon?hours=${encodeURIComponent(hours)}`);
    return Array.isArray(data) ? data : [];
  }

  async listAwaitingGrading() {
    const data = await this.#get('/evaluaciones/awaiting-grading');
    return Array.isArray(data) ? data : [];
  }
}

module.exports = EvaluationReaderRepository;
