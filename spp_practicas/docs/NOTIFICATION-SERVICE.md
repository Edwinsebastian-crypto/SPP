# Notification service (integration)

`../servicio_notificaciones` owns everything about e-mail: who is told what, templates, the MongoDB queue and SMTP
delivery. The monolith **only publishes events** through `NotificationServiceClient` (`src/infrastructure/notification-service.js`)
→ `POST {NOTIFICATION_SERVICE_URL}/api/v1/events` with a short-lived HS256 token (`iss: spp-monolith`, `rol: SYSTEM`).

Publishing is fire-and-forget: it never throws, so a notification problem cannot break a request.
With `NOTIFICATION_SERVICE_URL` empty nothing is published (except the legacy "practice assigned" write to Mongo).

| Where in the monolith | Event | Who is e-mailed |
|---|---|---|
| `UserService.create` (Director creates, or self-registration) | `user.registered` | the new student / tutor / advisor |
| `UserService.changeStatus` / `update` with pending → active (Director approves) | `user.approved` | the approved student / tutor / advisor |
| `PracticeService.create` | `practice.assigned` | student, tutor, advisor |
| `FeedbackService.create` (tutor or advisor) | `feedback.created` | the student |
| `PracticeService.updateActivity` with a new grade > 0 | `activity.graded` | the student |
| `PracticeService.updateLogbook` with a new final grade > 0 | `practice.graded` | the student |
| Evaluation gateway: tutor `POST …/publicar` | `evaluation.published` | the student |
| Evaluation gateway: tutor `POST /respuestas/:id/calificar` leaving the attempt `CALIFICADO` | `evaluation.graded` | the student |

The bell in the top bar (`frontend/src/components/common/ProfileAndNotificationsApp.jsx`, mounted in every panel) reads `GET /api/notifications` and marks
read with `POST /api/notifications/read`; both are proxied to the service and always answer (empty when the service is off).

Time-based notifications (due-date reminders, pending-review digests) are produced by the service itself from a
read-only connection to the practice database; the monolith does nothing for them.

Full documentation: `servicio_notificaciones/README.md`.
