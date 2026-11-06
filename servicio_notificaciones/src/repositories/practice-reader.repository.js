'use strict';
const env = require('../config/env');

/**
 * Cliente HTTP que solicita los datos de prácticas al servicio dueño de su BD (el monolito).
 * El microservicio de notificaciones NO accede a la base de datos de prácticas directamente.
 */
class PracticeReaderRepository {
  /**
   * @param {{baseUrl?: string, secret?: string, timezone?: string, timeoutMs?: number, fetchFn?: Function}} deps
   */
  constructor({
    baseUrl = env.monolithUrl,
    secret = env.secret,
    timezone = env.timezone,
    timeoutMs = 5000,
    fetchFn = globalThis.fetch
  } = {}) {
    this.baseUrl = (baseUrl || '').replace(/\/+$/, '');
    this.secret = secret || '';
    this.timezone = timezone;
    this.timeoutMs = timeoutMs;
    this.fetch = fetchFn;
  }

  async #get(path) {
    if (!this.baseUrl) return null;
    const url = `${this.baseUrl}/api/internal/notifications${path}`;
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
        console.warn(`[practice-reader] GET ${url} -> ${res.status}`);
        return null;
      }
      return await res.json();
    } catch (err) {
      console.warn(`[practice-reader] Error en GET ${url}: ${err.message}`);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  findStudent(documentNumber) {
    return this.#get(`/persons/student/${encodeURIComponent(documentNumber)}`);
  }

  findTutor(documentNumber) {
    return this.#get(`/persons/tutor/${encodeURIComponent(documentNumber)}`);
  }

  findAdvisor(documentNumber) {
    return this.#get(`/persons/advisor/${encodeURIComponent(documentNumber)}`);
  }

  async listActiveDirectors() {
    const data = await this.#get('/directors/active');
    return Array.isArray(data) ? data : [];
  }

  findPractice(id) {
    return this.#get(`/practices/${encodeURIComponent(id)}`);
  }

  findActivity(id) {
    return this.#get(`/activities/${encodeURIComponent(id)}`);
  }

  async listActivitiesDueSoon(hours = 24) {
    const data = await this.#get(`/activities/due-soon?hours=${encodeURIComponent(hours)}&tz=${encodeURIComponent(this.timezone)}`);
    return Array.isArray(data) ? data : [];
  }

  async listActivitiesAwaitingReview() {
    const data = await this.#get('/activities/awaiting-review');
    return Array.isArray(data) ? data : [];
  }

  async listUngradedPractices() {
    const data = await this.#get(`/practices/ungraded?tz=${encodeURIComponent(this.timezone)}`);
    return Array.isArray(data) ? data : [];
  }
}

module.exports = PracticeReaderRepository;
