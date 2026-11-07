'use strict';

/**
 * Composition root: the ONLY place where concrete classes are instantiated and wired together.
 *
 *   repositories (SQL / Mongo)  ->  services (business rules)  ->  controllers (HTTP)
 *
 * Everything below depends on abstractions it receives through its constructor, which keeps each
 * layer replaceable and unit-testable.
 */
const env = require('./config/env');
const identity = require('./infrastructure/supabase');
const fileStorage = require('./infrastructure/file-storage');
const { createAuthenticator } = require('./middlewares/authenticate.middleware');

const UserRepository = require('./repositories/user.repository');
const PracticeRepository = require('./repositories/practice.repository');
const ActivityRepository = require('./repositories/activity.repository');
const EvidenceRepository = require('./repositories/evidence.repository');
const FeedbackRepository = require('./repositories/feedback.repository');
const InstitutionRepository = require('./repositories/institution.repository');
const PracticeTypeRepository = require('./repositories/practice-type.repository');
const IndicatorRepository = require('./repositories/indicator.repository');
const AuditRepository = require('./repositories/audit.repository');
const InternalEvidenceRepository = require('./repositories/internal-evidence.repository');
const InternalNotificationRepository = require('./repositories/internal-notification.repository');
const NotificationServiceClient = require('./infrastructure/notification-service');

const AuditService = require('./services/audit.service');
const NotificationService = require('./services/notification.service');
const PracticeAccessService = require('./services/practice-access.service');
const SessionService = require('./services/session.service');
const AuthService = require('./services/auth.service');
const UserService = require('./services/user.service');
const InstitutionService = require('./services/institution.service');
const PracticeTypeService = require('./services/practice-type.service');
const PracticeService = require('./services/practice.service');
const EvidenceService = require('./services/evidence.service');
const FeedbackService = require('./services/feedback.service');
const ReportService = require('./services/report.service');
const HomeService = require('./services/home.service');
const EvaluationGatewayService = require('./services/evaluation-gateway.service');
const EvaluationServiceClient = require('./infrastructure/evaluation-service');

const AuthController = require('./controllers/auth.controller');
const UserController = require('./controllers/user.controller');
const InstitutionController = require('./controllers/institution.controller');
const PracticeTypeController = require('./controllers/practice-type.controller');
const PracticeController = require('./controllers/practice.controller');
const EvidenceController = require('./controllers/evidence.controller');
const FeedbackController = require('./controllers/feedback.controller');
const NotificationController = require('./controllers/notification.controller');
const ReportController = require('./controllers/report.controller');
const HomeController = require('./controllers/home.controller');
const EvaluationController = require('./controllers/evaluation.controller');
const PageController = require('./controllers/page.controller');
const InternalController = require('./controllers/internal.controller');

function createContainer() {
  // ----- repositories -----
  const userRepository = new UserRepository();
  const practiceRepository = new PracticeRepository();
  const activityRepository = new ActivityRepository();
  const evidenceRepository = new EvidenceRepository();
  const feedbackRepository = new FeedbackRepository();
  const institutionRepository = new InstitutionRepository();
  const practiceTypeRepository = new PracticeTypeRepository();
  const indicatorRepository = new IndicatorRepository();
  const auditRepository = new AuditRepository();
  const internalEvidenceRepository = new InternalEvidenceRepository();
  const internalNotificationRepository = new InternalNotificationRepository();

  // ----- services -----
  const auditService = new AuditService({ auditRepository });
  const notificationService = new NotificationService({
    client: new NotificationServiceClient({ url: env.notificationServiceUrl, secret: env.notificationServiceSecret })
  });
  const practiceAccessService = new PracticeAccessService({ practiceRepository, activityRepository });
  const sessionService = new SessionService({ identity, userRepository });
  const authService = new AuthService({ identity, userRepository });
  const userService = new UserService({ userRepository, identity, auditService, notificationService });
  const institutionService = new InstitutionService({ institutionRepository });
  const practiceTypeService = new PracticeTypeService({ practiceTypeRepository });
  const practiceService = new PracticeService({
    practiceRepository, activityRepository, userRepository, practiceTypeRepository, institutionRepository,
    practiceAccessService, auditService, notificationService, fileStorage
  });
  const evidenceService = new EvidenceService({ evidenceRepository, practiceAccessService, fileStorage, auditService });
  const feedbackService = new FeedbackService({ feedbackRepository, evidenceRepository, practiceAccessService, auditService, notificationService });
  const reportService = new ReportService({ indicatorRepository, auditService });
  const homeService = new HomeService({
    practiceRepository, activityRepository, feedbackRepository, userRepository, indicatorRepository, auditService
  });
  const evaluationGatewayService = new EvaluationGatewayService({
    client: new EvaluationServiceClient({ url: env.evaluationServiceUrl, secret: env.evaluationServiceSecret }),
    practiceAccessService, practiceRepository, notificationService
  });

  // ----- HTTP layer -----
  const authenticate = createAuthenticator(sessionService);
  const controllers = {
    auth: new AuthController({ authService, userService }),
    user: new UserController({ userService }),
    institution: new InstitutionController({ institutionService }),
    practiceType: new PracticeTypeController({ practiceTypeService }),
    practice: new PracticeController({ practiceService }),
    evidence: new EvidenceController({ evidenceService }),
    feedback: new FeedbackController({ feedbackService }),
    notification: new NotificationController({ notificationService }),
    report: new ReportController({ reportService }),
    home: new HomeController({ homeService }),
    evaluation: new EvaluationController({ evaluationGatewayService }),
    internal: new InternalController({ repository: internalEvidenceRepository, notificationRepository: internalNotificationRepository }),
    page: new PageController({ resolveUser: authenticate.resolveUser })
  };

  return {
    authenticate,
    controllers,
    services: {
      auditService, authService, sessionService, userService, institutionService, practiceTypeService, practiceService,
      evidenceService, feedbackService, reportService, homeService, evaluationGatewayService, notificationService
    },
    repositories: {
      userRepository, practiceRepository, activityRepository, evidenceRepository, feedbackRepository, institutionRepository,
      practiceTypeRepository, indicatorRepository, auditRepository, internalEvidenceRepository, internalNotificationRepository
    }
  };
}

module.exports = { createContainer };
