'use strict';
const express = require('express');
const asyncHandler = require('../utils/async-handler');

/** /api/notifications: the bell. Any authenticated user (each one only sees their own). */
function createNotificationsRoutes({ controllers: { notification }, guard }) {
  const router = express.Router();
  const anyUser = guard();

  router.get('/', anyUser, asyncHandler(notification.list));
  router.post('/read', anyUser, asyncHandler(notification.markRead));

  return router;
}

module.exports = createNotificationsRoutes;
