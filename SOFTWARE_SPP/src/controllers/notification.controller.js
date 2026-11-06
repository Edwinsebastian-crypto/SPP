'use strict';
const { textId } = require('../utils/validators');

/** The bell of the top bar. Every user only ever sees (and marks) their OWN notifications: the document comes from the session. */
class NotificationController {
  constructor({ notificationService }) {
    this.notificationService = notificationService;
  }

  /** GET /api/notifications */
  list = async (req, res) => {
    res.json(await this.notificationService.inbox(req.user));
  };

  /** POST /api/notifications/read   body: { id? }  (without id = mark all) */
  markRead = async (req, res) => {
    const id = req.body && req.body.id ? textId(req.body.id, 'id') : null;
    res.json(await this.notificationService.markRead(req.user, id));
  };
}

module.exports = NotificationController;
