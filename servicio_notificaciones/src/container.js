'use strict';
const env = require('./config/env');
const NotificationRepository = require('./repositories/notification.repository');
const PracticeReaderRepository = require('./repositories/practice-reader.repository');
const EvaluationReaderRepository = require('./repositories/evaluation-reader.repository');
const NotificationService = require('./services/notification.service');
const EventService = require('./services/event.service');
const { JobsService, Scheduler } = require('./services/jobs.service');
const DispatcherService = require('./services/dispatcher.service');
const { createServiceAuth } = require('./middlewares/service-auth');

/**
 * Raíz de composición: único lugar donde se instancian y conectan las clases.
 * @param {{Model, mailer, health?: Function, practiceReader?: object, evaluationReader?: object}} infra
 */
function createContainer({ Model, mailer, health, practiceReader = null, evaluationReader = null }) {
  const notificationRepository = new NotificationRepository(Model);
  const practices = practiceReader || new PracticeReaderRepository({
    baseUrl: env.monolithUrl, secret: env.secret, timezone: env.timezone
  });
  const evaluations = evaluationReader !== null ? evaluationReader : (
    env.evaluationServiceUrl ? new EvaluationReaderRepository({ baseUrl: env.evaluationServiceUrl, secret: env.evaluationServiceSecret }) : null
  );

  const notifications = new NotificationService({ notificationRepository });
  const eventService = new EventService({ notifications, practiceReader: practices, evaluationReader: evaluations });
  const jobs = new JobsService({ notifications, practiceReader: practices, evaluationReader: evaluations });
  const dispatcher = new DispatcherService({ notificationRepository, mailer });
  const scheduler = new Scheduler({ jobs });
  const auth = createServiceAuth({ secret: env.secret });

  return {
    notificationRepository, practiceReader: practices, evaluationReader: evaluations,
    eventService, jobs, dispatcher, scheduler, auth,
    health: health || (async () => ({ status: 'ok' }))
  };
}

module.exports = { createContainer };
