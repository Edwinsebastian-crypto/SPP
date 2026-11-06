'use strict';
const crypto = require('crypto');
const HttpError = require('../utils/http-error');
const env = require('../config/env');

const ISSUER = env.tokenIssuer;

/**
 * Autenticación servicio a servicio: «Authorization: Bearer <JWT HS256>» firmado con NOTIFICATION_SERVICE_SECRET.
 * Claims exigidos: iss = spp-monolith (o TOKEN_ISSUER), rol = SYSTEM y exp vigente.
 */
function createServiceAuth({ secret, issuer = env.tokenIssuer, now = () => Date.now() }) {
  return function serviceAuth(req, _res, next) {
    try {
      if (!secret) throw HttpError.unauthorized('El servicio no tiene NOTIFICATION_SERVICE_SECRET configurado');
      const match = /^Bearer\s+(\S+)$/i.exec(req.get('authorization') || '');
      if (!match) throw HttpError.unauthorized('Falta el token');
      const parts = match[1].split('.');
      if (parts.length !== 3) throw HttpError.unauthorized('Token inválido');

      const expected = crypto.createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
      const given = Buffer.from(parts[2], 'base64url');
      if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) throw HttpError.unauthorized('Firma inválida');

      let header; let claims;
      try {
        header = JSON.parse(Buffer.from(parts[0], 'base64url'));
        claims = JSON.parse(Buffer.from(parts[1], 'base64url'));
      } catch { throw HttpError.unauthorized('Token inválido'); }
      if (header.alg !== 'HS256') throw HttpError.unauthorized('Algoritmo no permitido');
      if (typeof claims.exp !== 'number' || claims.exp * 1000 < now()) throw HttpError.unauthorized('Token vencido');
      if (claims.iss !== issuer || claims.rol !== 'SYSTEM') throw HttpError.forbidden('Este token no puede usar el servicio de notificaciones');
      req.caller = claims;
      next();
    } catch (err) { next(err); }
  };
}

module.exports = { createServiceAuth, ISSUER };
