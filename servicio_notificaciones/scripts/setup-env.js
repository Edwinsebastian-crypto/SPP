'use strict';
/**
 * Prepara los dos archivos .env para quien no quiere editarlos a mano:
 *   1. Lee SOFTWARE_SPP/.env (base de prácticas, base de evaluación y MongoDB que ya usa el monolito).
 *   2. Crea servicio_notificaciones/.env (guarda copia del anterior si existía), en modo de prueba de correo (MAIL_MODE=log).
 *   3. Agrega NOTIFICATION_SERVICE_URL y NOTIFICATION_SERVICE_SECRET al .env del monolito (guarda copia antes).
 * Uso:  npm run setup
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SERVICE_DIR = path.join(__dirname, '..');
const OWN_ENV = path.join(SERVICE_DIR, '.env');
const MONO_ENV = path.join(SERVICE_DIR, '..', 'SOFTWARE_SPP', '.env');
const MONGO_DB = 'spp_notificaciones';
const SERVICE_URL = 'http://localhost:4000';

const fail = (msg) => { console.error(`\n✖ ${msg}\n`); process.exit(1); };
const stamp = () => new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);

function parse(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(raw);
    if (!m || raw.trim().startsWith('#')) continue;
    out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

/** Cambia solo el nombre de la base dentro de la URI de MongoDB. */
function withDatabase(uri, db) {
  const m = /^(mongodb(?:\+srv)?:\/\/[^/]+)\/?([^?]*)(\?.*)?$/.exec(uri);
  return m ? `${m[1]}/${db}${m[3] || ''}` : null;
}

function setVar(text, key, value, eol) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^\\s*${key}\\s*=.*$`, 'm');
  if (re.test(text)) return text.replace(re, line);
  return `${text}${text.endsWith('\n') || text === '' ? '' : eol}${line}${eol}`;
}

if (!fs.existsSync(MONO_ENV)) fail(`No encuentro el .env del monolito en:\n  ${MONO_ENV}\nVerifica que la carpeta SOFTWARE_SPP esté junto a servicio_notificaciones.`);
const monoText = fs.readFileSync(MONO_ENV, 'utf8');
const mono = parse(monoText);

const missing = ['MONGO_URI_NOTIFICATIONS'].filter((k) => !mono[k]);
if (missing.length) fail(`Al .env del monolito le falta: ${missing.join(', ')}.`);
const mongoUri = withDatabase(mono.MONGO_URI_NOTIFICATIONS, MONGO_DB);
if (!mongoUri) fail('La MONGO_URI_NOTIFICATIONS del monolito no parece una URI de MongoDB (debe empezar con mongodb:// o mongodb+srv://).');

const previousOwn = fs.existsSync(OWN_ENV) ? parse(fs.readFileSync(OWN_ENV, 'utf8')) : {};
const pick = (v) => (v && v.length >= 16 ? v : null);
const secret = pick(mono.NOTIFICATION_SERVICE_SECRET) || pick(previousOwn.NOTIFICATION_SERVICE_SECRET) || crypto.randomBytes(48).toString('base64url');

const mailFrom = previousOwn.MAIL_FROM || mono.MAIL_FROM || '"SPP Prácticas Pedagógicas <no-reply@udi.edu.co>"';
const appUrl = previousOwn.APP_URL || mono.APP_URL || 'http://localhost:3000';
const serviceUrl = mono.NOTIFICATION_SERVICE_URL || previousOwn.SERVICE_URL || SERVICE_URL;
const monolithUrl = previousOwn.MONOLITH_URL || mono.APP_URL || 'http://localhost:3000';
const evaluationServiceUrl = previousOwn.EVALUATION_SERVICE_URL || mono.EVALUATION_SERVICE_URL || 'http://localhost:8000';

// ---- 1. .env del servicio
if (fs.existsSync(OWN_ENV)) fs.copyFileSync(OWN_ENV, `${OWN_ENV}.bak-${stamp()}`);
const own = [
  '# Generado por "npm run setup". Modo de prueba: los correos se muestran en esta consola (MAIL_MODE=log).',
  `PORT=${previousOwn.PORT || '4000'}`,
  `TZ=${previousOwn.TZ || mono.TZ || 'America/Bogota'}`,
  `NOTIFICATION_SERVICE_SECRET=${secret}`,
  `MONGO_URI_NOTIFICATIONS=${mongoUri}`,
  `MONOLITH_URL=${monolithUrl}`,
  `EVALUATION_SERVICE_URL=${evaluationServiceUrl}`,
  `MAIL_MODE=${previousOwn.MAIL_MODE || 'log'}`,
  `MAIL_FROM=${mailFrom.startsWith('"') ? mailFrom : `"${mailFrom}"`}`,
  `APP_URL=${appUrl}`,
  ''
].join('\n');
fs.writeFileSync(OWN_ENV, own);

// ---- 2. .env del monolito
const eol = monoText.includes('\r\n') ? '\r\n' : '\n';
fs.copyFileSync(MONO_ENV, `${MONO_ENV}.bak-${stamp()}`);
let updated = setVar(monoText, 'NOTIFICATION_SERVICE_URL', serviceUrl, eol);
updated = setVar(updated, 'NOTIFICATION_SERVICE_SECRET', secret, eol);
fs.writeFileSync(MONO_ENV, updated);

console.log(`
✔ Listo. Quedaron preparados los dos archivos:
   • servicio_notificaciones\\.env   (base MongoDB: ${MONGO_DB}, correos en modo prueba)
   • SOFTWARE_SPP\\.env              (se agregaron NOTIFICATION_SERVICE_URL y NOTIFICATION_SERVICE_SECRET)
   Se guardó una copia de seguridad de cada uno (archivos .bak-...).
${mono.DATABASE_URL_EVALUATION ? '' : '   Nota: no encontré DATABASE_URL_EVALUATION; no habrá avisos de evaluaciones por fecha.\n'}
Siguiente paso:  npm start
`);
