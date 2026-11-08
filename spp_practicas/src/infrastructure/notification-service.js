'use strict';
const crypto = require('crypto');

const TOKEN_TTL_SECONDS = 120;
const ISSUER = 'spp-monolith';

const b64url = (input) => Buffer.from(input).toString('base64url');

/**
 * HTTP client of the notification microservice. It only PUBLISHES domain events (`POST /api/v1/events`): who gets which
 * e-mail, the templates, the queue (MongoDB) and the delivery are the service's business.
 *
 * Publishing is fire-and-forget by design: `publish` never throws and never rejects, so a notification problem can never
 * break the request that caused it (same policy as the audit log). The service trusts the signed token, so its URL must
 * NOT be reachable from the Internet.
 */
class NotificationServiceClient {
  /** @param {{url: string, secret: string, timeoutMs?: number, fetchImpl?: Function, now?: () => number, logger?: object}} options */
  constructor({ url, secret, timeoutMs = 35000, fetchImpl = globalThis.fetch, now = () => Date.now(), logger = console }) {
    this.baseUrl = String(url || '').replace(/\/+$/, '');
    this.secret = secret || '';
    this.timeoutMs = timeoutMs;
    this.fetch = fetchImpl;
    this.now = now;
    this.logger = logger;
  }

  get configured() {
    return Boolean(this.baseUrl && this.secret);
  }

  /** HS256 JWT understood by the service: { iss: 'spp-monolith', rol: 'SYSTEM', sub, iat, exp }. */
  signToken() {
    const iat = Math.floor(this.now() / 1000);
    const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = b64url(JSON.stringify({ iss: ISSUER, sub: 'spp-monolith', rol: 'SYSTEM', iat, exp: iat + TOKEN_TTL_SECONDS }));
    const signature = crypto.createHmac('sha256', this.secret).update(`${header}.${payload}`).digest('base64url');
    return `${header}.${payload}.${signature}`;
  }

  /**
   * Calls any endpoint of the service (used by the bell: inbox / mark read). Never throws.
   * @returns {Promise<object|null>} parsed JSON, or null when the service is off, unreachable or answered an error
   */
  async request(method, path, { query, body } = {}) {
    if (!this.configured) return null;
    try {
      const qs = query ? `?${new URLSearchParams(query)}` : '';
      const response = await this.fetch(`${this.baseUrl}${path}${qs}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.signToken()}` },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(this.timeoutMs)
      });
      if (!response.ok) {
        this.logger.warn(`[notification] ${method} ${path} -> HTTP ${response.status}`);
        return null;
      }
      return await response.json();
    } catch (err) {
      this.logger.warn(`[notification] ${method} ${path} failed: ${err.message}`);
      return null;
    }
  }

  /**
   * @param {string} type  event name, e.g. 'feedback.created'
   * @param {object} data  event payload (identifiers; the service reads the rest from the practice database)
   * @returns {Promise<boolean>} true when the service accepted the event
   */
  async publish(type, data) {
    if (!this.configured) return false;
    try {
      const response = await this.fetch(`${this.baseUrl}/api/v1/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.signToken()}` },
        body: JSON.stringify({ type, data }),
        signal: AbortSignal.timeout(this.timeoutMs)
      });
      if (!response.ok) {
        this.logger.warn(`[notification] the service rejected "${type}" (HTTP ${response.status})`);
        return false;
      }
      return true;
    } catch (err) {
      this.logger.warn(`[notification] could not publish "${type}": ${err.message}`);
      return false;
    }
  }
}

module.exports = NotificationServiceClient;
