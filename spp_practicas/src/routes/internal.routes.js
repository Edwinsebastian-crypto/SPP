'use strict';
const crypto = require('crypto');
const express = require('express');
const asyncHandler = require('../utils/async-handler');
const env = require('../config/env');
const HttpError = require('../utils/http-error');

function requireInternalSecret(req, _res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const validSecrets = [env.evaluationServiceSecret, env.notificationServiceSecret].filter(Boolean);
  if (!token) {
    throw HttpError.unauthorized('Missing internal service secret');
  }
  if (validSecrets.includes(token)) {
    return next();
  }
  // Check if token is HS256 JWT signed with any of the valid secrets
  for (const secret of validSecrets) {
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const expected = crypto.createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
        const given = Buffer.from(parts[2], 'base64url');
        if (given.length === expected.length && crypto.timingSafeEqual(given, expected)) {
          const claims = JSON.parse(Buffer.from(parts[1], 'base64url'));
          if (claims.rol === 'SYSTEM' && (!claims.exp || claims.exp * 1000 > Date.now())) {
            req.caller = claims;
            return next();
          }
        }
      }
    } catch (_) {
      // ignore invalid token format
    }
  }
  throw HttpError.unauthorized('Invalid or missing internal service secret');
}

function createInternalRoutes({ internalController }) {
  const router = express.Router();
  router.use(requireInternalSecret);

  // --- servicio_evaluacion ---
  router.get('/practicas/:practiceId/evidencias', asyncHandler(internalController.listEvidences));
  router.get('/evidencias/:evidenceId', asyncHandler(internalController.getEvidence));
  router.get('/actividades/:activityId', asyncHandler(internalController.getActivity));
  router.get('/evidencias/archivos/:fileId', asyncHandler(internalController.downloadEvidenceFile));
  router.get('/actividades/archivos/:fileId', asyncHandler(internalController.downloadActivityFile));
  router.get('/verificar', asyncHandler(internalController.verifyBelongs));

  // --- servicio_notificaciones ---
  router.get('/notifications/persons/:role/:documentNumber', asyncHandler(internalController.getPerson));
  router.get('/notifications/directors/active', asyncHandler(internalController.listActiveDirectors));
  router.get('/notifications/practices/:practiceId', asyncHandler(internalController.getPractice));
  router.get('/notifications/activities/:activityId', asyncHandler(internalController.getActivityNotification));
  router.get('/notifications/activities/due-soon', asyncHandler(internalController.listActivitiesDueSoon));
  router.get('/notifications/activities/awaiting-review', asyncHandler(internalController.listActivitiesAwaitingReview));
  router.get('/notifications/practices/ungraded', asyncHandler(internalController.listUngradedPractices));

  return router;
}

module.exports = createInternalRoutes;

