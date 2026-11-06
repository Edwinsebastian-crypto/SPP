'use strict';
const env = require('./config/env');
const mongo = require('./infrastructure/mongo');
const { createMailer } = require('./infrastructure/mailer');
const { buildModel } = require('./models/notification.model');
const { createContainer } = require('./container');
const { createApp } = require('./app');

async function start() {
  if (env.secret.length < 16) {
    console.error('Define NOTIFICATION_SERVICE_SECRET (mínimo 16 caracteres, igual al del monolito).\n  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"');
    process.exit(1);
  }

  const connection = await mongo.connect();
  const Model = buildModel(connection);

  const mailer = createMailer();
  mailer.verify().then(() => console.log(`[mail] modo ${env.mailMode} listo`)).catch((err) => console.warn('[mail] no se pudo verificar el SMTP:', err.message));

  const health = async () => ({ status: connection.readyState === 1 ? 'ok' : 'degraded', mongo: connection.readyState === 1, mail: env.mailMode });
  const container = createContainer({ Model, mailer, health });
  await container.notificationRepository.init();

  const http = createApp(container).listen(env.port, () => console.log(`Servicio de notificaciones en http://localhost:${env.port}`));
  container.dispatcher.start();
  if (env.jobsEnabled) container.scheduler.start(); else console.log('[jobs] desactivados (JOBS_ENABLED=false)');

  const shutdown = async () => {
    console.log('Cerrando…');
    container.dispatcher.stop();
    container.scheduler.stop();
    http.close();
    await mongo.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) start().catch((err) => { console.error(err); process.exit(1); });

module.exports = { start };
