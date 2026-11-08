'use strict';
const express = require('express');
const HttpError = require('../utils/http-error');
const { NOTIFICATION_TYPE_LIST, DELIVERY } = require('../config/constants');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** /health (público) y /api/v1/* (solo el monolito, con token firmado). */
function createRoutes({ eventService, jobs, dispatcher, notificationRepository, auth, health }) {
  const router = express.Router();
  router.get('/', wrap(async (_req, res) => res.json(await health())));
  router.get('/health', wrap(async (_req, res) => res.json(await health())));

  const api = express.Router();
  api.use(auth);

  /** El monolito publica aquí lo que ocurrió; responde 202 porque el envío del correo es asíncrono. */
  api.post('/events', wrap(async (req, res) => {
    const { type, data } = req.body || {};
    if (typeof type !== 'string') throw HttpError.badRequest('Falta "type"');
    res.status(202).json(await eventService.handle(type, data));
  }));

  /** Consulta operativa de la cola. */
  api.get('/notifications', wrap(async (req, res) => {
    const { documento, tipo, estadoEnvio, limit } = req.query;
    if (tipo && !NOTIFICATION_TYPE_LIST.includes(tipo)) throw HttpError.badRequest('tipo inválido');
    if (estadoEnvio && !Object.values(DELIVERY).includes(estadoEnvio)) throw HttpError.badRequest('estadoEnvio inválido');
    res.json(await notificationRepository.list({ documento, tipo, estadoEnvio }, limit));
  }));

  /** Campanita del monolito: bandeja de UN usuario (el monolito envía el documento de la sesión). */
  const documentOf = (v) => {
    const d = typeof v === 'string' ? v.trim() : '';
    if (!d || d.length > 30) throw HttpError.badRequest('Falta "documento" (máx. 30 caracteres)');
    return d;
  };
  api.get('/notifications/inbox', wrap(async (req, res) => {
    const { items, unread } = await notificationRepository.inbox(documentOf(req.query.documento), req.query.limit);
    res.json({
      unread,
      notifications: items.map((n) => ({ id: String(n._id), type: n.tipo, subject: n.asunto, content: n.contenido, createdAt: n.fechaCreacion, read: n.leida === true }))
    });
  }));
  api.post('/notifications/read', wrap(async (req, res) => {
    const { documento, id } = req.body || {};
    res.json({ marked: await notificationRepository.markRead(documentOf(documento), id ? String(id) : null) });
  }));

  api.post('/notifications/retry-failed', wrap(async (_req, res) => res.json({ requeued: await notificationRepository.requeueFailed() })));

  /** Ejecuta tareas a mano (pruebas y operación): { job: 'reminders' | 'digests' | 'dispatch' | 'all', forceDigest?: boolean } */
  api.post('/jobs/run', wrap(async (req, res) => {
    const { job = 'all', forceDigest = false } = req.body || {};
    const runners = {
      reminders: () => jobs.runReminders(),
      digests: () => jobs.runDigests({ force: Boolean(forceDigest) }),
      dispatch: () => dispatcher.dispatchOnce(),
      all: async () => ({ ...(await jobs.runAll({ forceDigest: Boolean(forceDigest) })), dispatch: await dispatcher.dispatchOnce() })
    };
    if (!runners[job]) throw HttpError.badRequest(`job debe ser uno de: ${Object.keys(runners).join(', ')}`);
    res.json(await runners[job]());
  }));

  router.use('/api/v1', api);
  return router;
}

module.exports = createRoutes;
