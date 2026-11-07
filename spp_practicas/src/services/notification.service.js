'use strict';
const { fullName } = require('../utils/format');

/**
 * Tells the notification microservice what happened; the service decides who is e-mailed, builds the message, queues it
 * in its own MongoDB and delivers it. Every method is fire-and-forget (returns a promise that never rejects) so the
 * caller can ignore it.
 *
 *   student ..... activity feedback / graded, practice graded, evaluation published / graded, due-date reminders (scheduled)
 *   tutor/advisor  pending reviews digest (scheduled)          director .... practices without a grade (scheduled)
 *   student, tutor, advisor .... practice assigned and account registered
 *
 * When NOTIFICATION_SERVICE_URL is not configured events are simply not published.
 */
class NotificationService {
  /** @param {{client?: {configured: boolean, publish: Function, request: Function}}} deps */
  constructor({ client = null } = {}) {
    this.client = client;
  }

  get #enabled() {
    return Boolean(this.client && this.client.configured);
  }

  #publish(type, data) {
    return this.#enabled ? this.client.publish(type, data) : Promise.resolve(false);
  }

  /**
   * The bell: the user's own notifications. Always answers (empty when the service is off or down), so the page never breaks.
   * @returns {Promise<{unread: number, notifications: Array}>}
   */
  async inbox(user) {
    const empty = { unread: 0, notifications: [] };
    if (!this.#enabled) return empty;
    const data = await this.client.request('GET', '/api/v1/notifications/inbox', { query: { documento: user.documentNumber, limit: 20 } });
    return data && Array.isArray(data.notifications) ? { unread: Number(data.unread) || 0, notifications: data.notifications } : empty;
  }

  /** Marks the user's notifications as read (all of them, or only `id`). */
  async markRead(user, id = null) {
    if (!this.#enabled) return { marked: 0 };
    const data = await this.client.request('POST', '/api/v1/notifications/read', { body: { documento: user.documentNumber, id: id || undefined } });
    return { marked: data ? Number(data.marked) || 0 : 0 };
  }

  /** A user (student, tutor or advisor) was registered, by themselves (pending) or by the Director. */
  userRegistered(user) {
    return this.#publish('user.registered', {
      user: {
        documentNumber: user.documentNumber, email: user.email, firstName: user.firstName, lastName: user.lastName,
        role: user.role, status: user.status
      }
    });
  }

  /** The Director approved an account that was pending (pending -> active). */
  userApproved(user) {
    return this.#publish('user.approved', {
      user: { documentNumber: user.documentNumber, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role }
    });
  }

  /**
   * Tells the three participants that a practice was assigned to them.
   * @param {{practiceId: string}} practice
   */
  notifyPracticeAssigned({ practiceId }) {
    return this.#publish('practice.assigned', { practiceId });
  }

  /** A tutor or advisor left feedback on the evidence of an activity -> the student is told. */
  feedbackCreated({ activityId, feedbackId, author, text }) {
    return this.#publish('feedback.created', {
      activityId, feedbackId, authorDocument: author.documentNumber, authorRole: author.role, authorName: fullName(author), text
    });
  }

  /** An activity received a grade -> the student is told (the service reads the stored grade). */
  activityGraded({ activityId, grader }) {
    return this.#publish('activity.graded', {
      activityId, graderDocument: grader.documentNumber, graderRole: grader.role, graderName: fullName(grader)
    });
  }

  /** The final grade of a practice was recorded -> the student is told. */
  practiceGraded({ practiceId }) {
    return this.#publish('practice.graded', { practiceId });
  }

  /** The tutor published an evaluation -> the student is told it is available. @param {{evaluationId, practiceId, studentDocument, title, dueAt}} e */
  evaluationPublished({ evaluationId, practiceId, studentDocument, title, dueAt }) {
    return this.#publish('evaluation.published', { evaluationId, practiceId, studentDocument, title, dueAt });
  }

  /** The tutor finished grading an attempt -> the student is told. @param {{attemptId, studentDocument, status, grade, maxGrade}} a */
  evaluationGraded({ attemptId, studentDocument, status, grade, maxGrade }) {
    return this.#publish('evaluation.graded', { attemptId, studentDocument, status, grade, maxGrade });
  }
}

module.exports = NotificationService;
