'use strict';
const HttpError = require('../utils/http-error');

const notFound = (req, _res, next) => next(HttpError.notFound(`Ruta no encontrada: ${req.method} ${req.path}`));

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  console.error('[http]', err);
  return res.status(500).json({ error: 'Error interno del servicio de notificaciones' });
}

module.exports = { notFound, errorHandler };
