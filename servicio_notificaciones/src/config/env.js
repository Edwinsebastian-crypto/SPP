'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const isSet = (v) => v !== undefined && v !== '';
const num = (name, fallback) => {
  const n = Number(process.env[name]);
  return isSet(process.env[name]) && Number.isFinite(n) ? n : fallback;
};
const bool = (name, fallback) => (isSet(process.env[name]) ? !/^(false|0|no)$/i.test(process.env[name]) : fallback);

/** Acceso centralizado (y de solo lectura) a las variables de entorno. Se evalúa en cada acceso para poder probarlo. */
module.exports = {
  get: (name, fallback = '') => (isSet(process.env[name]) ? process.env[name] : fallback),
  get port() { return num('PORT', 4000); },
  get timezone() { return this.get('TZ', 'America/Bogota'); },

  // --- bases de datos
  /** URI completa, o armada con MONGO_HOST/USER/PASSWORD/DB (así docker compose no necesita interpolaciones anidadas). */
  get mongoUri() {
    const uri = this.get('MONGO_URI_NOTIFICATIONS');
    if (uri) return uri;
    const host = this.get('MONGO_HOST');
    if (!host) return '';
    const user = this.get('MONGO_USER');
    const auth = user ? `${encodeURIComponent(user)}:${encodeURIComponent(this.get('MONGO_PASSWORD'))}@` : '';
    return `mongodb://${auth}${host}:${this.get('MONGO_PORT', '27017')}/${this.get('MONGO_DB', 'spp_notificaciones')}${user ? '?authSource=admin' : ''}`;
  },
  // --- servicios externos (comunicación HTTP)
  get monolithUrl() { return this.get('MONOLITH_URL', this.get('PRACTICE_SERVICE_URL', 'http://localhost:3000')); },
  get evaluationServiceUrl() { return this.get('EVALUATION_SERVICE_URL', 'http://localhost:8000'); },
  get evaluationServiceSecret() { return this.get('EVALUATION_SERVICE_SECRET', this.secret); },

  // --- seguridad entre servicios (mismo formato HS256 que el servicio de evaluación)
  get secret() { return this.get('NOTIFICATION_SERVICE_SECRET'); },
  get tokenIssuer() { return this.get('TOKEN_ISSUER', 'spp-monolith'); },

  // --- correo
  get mailMode() { return this.get('MAIL_MODE', 'smtp'); }, // smtp | log
  get smtp() {
    return {
      host: this.get('SMTP_HOST'), port: num('SMTP_PORT', 587), secure: bool('SMTP_SECURE', false),
      user: this.get('SMTP_USER'), pass: this.get('SMTP_PASS')
    };
  },
  get mailFrom() { return this.get('MAIL_FROM', 'SPP Prácticas Pedagógicas <no-reply@localhost>'); },
  get appUrl() { return this.get('APP_URL', ''); },

  // --- envío (dispatcher)
  get dispatchIntervalMs() { return num('DISPATCH_INTERVAL_MS', 10000); },
  get dispatchBatch() { return num('DISPATCH_BATCH', 20); },
  get maxAttempts() { return num('MAX_ATTEMPTS', 5); },
  get retryBaseMs() { return num('RETRY_BASE_MS', 60000); },
  /** true = también envía los documentos antiguos de la cola (los que escribía el monolito, sin estadoEnvio). Por defecto se ignoran. */
  get legacyQueue() { return bool('LEGACY_QUEUE', false); },
  get lockTimeoutMs() { return num('LOCK_TIMEOUT_MS', 5 * 60000); },

  // --- tareas programadas
  get jobsEnabled() { return bool('JOBS_ENABLED', true); },
  get jobsIntervalMs() { return num('JOBS_INTERVAL_MS', 15 * 60000); },
  get reminderHours() { return num('REMINDER_HOURS', 24); },
  get digestHour() { return num('DIGEST_HOUR', 7); }
};
