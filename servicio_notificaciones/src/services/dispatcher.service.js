'use strict';
const env = require('../config/env');
const { renderEmail } = require('./render-email');

const MAX_BACKOFF_MS = 6 * 3600 * 1000;

/**
 * Toma las notificaciones pendientes de la cola, las envía por correo y deja constancia (`fechaEnvio`).
 * Si el envío falla reintenta con espera creciente y, tras MAX_ATTEMPTS, la marca como «Fallida».
 */
class DispatcherService {
  /** @param {{notificationRepository, mailer, now?: () => Date, options?: object}} deps */
  constructor({ notificationRepository, mailer, now = () => new Date(), options = {} }) {
    this.repo = notificationRepository;
    this.mailer = mailer;
    this.now = now;
    this.batch = options.batch ?? env.dispatchBatch;
    this.maxAttempts = options.maxAttempts ?? env.maxAttempts;
    this.retryBaseMs = options.retryBaseMs ?? env.retryBaseMs;
    this.lockMs = options.lockMs ?? env.lockTimeoutMs;
    this.intervalMs = options.intervalMs ?? env.dispatchIntervalMs;
    this.includeLegacy = options.includeLegacy ?? env.legacyQueue;
    this.running = false;
    this.timer = null;
  }

  /** Envía hasta `batch` notificaciones. @returns {Promise<{sent: number, failed: number, gaveUp: number}>} */
  async dispatchOnce() {
    const result = { sent: 0, failed: 0, gaveUp: 0 };
    for (let i = 0; i < this.batch; i += 1) {
      const n = await this.repo.claimNext(this.now(), this.lockMs, { includeLegacy: this.includeLegacy });
      if (!n) break;
      try {
        const email = renderEmail({ subject: n.asunto, content: n.contenido, tipo: n.tipo });
        await this.mailer.send({ to: n.destinatario.correo, subject: n.asunto, ...email });
        await this.repo.markSent(n._id, this.now());
        result.sent += 1;
      } catch (err) {
        const giveUp = n.intentos >= this.maxAttempts;
        const wait = Math.min(this.retryBaseMs * 2 ** (n.intentos - 1), MAX_BACKOFF_MS);
        await this.repo.markFailed(n._id, err.message, { giveUp, retryAt: new Date(this.now().getTime() + wait) });
        console.warn(`[dispatcher] ${n.destinatario.correo}: ${err.message}${giveUp ? ' (se agotaron los intentos)' : ''}`);
        result[giveUp ? 'gaveUp' : 'failed'] += 1;
      }
    }
    return result;
  }

  async tick() {
    if (this.running) return null;
    this.running = true;
    try { return await this.dispatchOnce(); } catch (err) { console.error('[dispatcher]', err.message); return null; } finally { this.running = false; }
  }

  start() {
    this.timer = setInterval(() => this.tick(), this.intervalMs);
    if (this.timer.unref) this.timer.unref();
  }

  stop() { clearInterval(this.timer); }
}

module.exports = DispatcherService;
