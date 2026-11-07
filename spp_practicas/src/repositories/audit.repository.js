'use strict';
const auditLog = require('../models/audit-log.model');
const legacy = require('./legacy-values');
const { NO_PRACTICE } = require('../config/constants');

/**
 * Sanitiza recursivamente objetos y arreglos para evitar persistir información sensible
 * (contraseñas, tokens, llaves API, secretos de servicio) en las trazas de auditoría.
 */
function sanitizeAuditData(data) {
  if (!data || typeof data !== 'object') return data;
  if (data instanceof Date) return data;
  if (Array.isArray(data)) return data.map(sanitizeAuditData);

  const SENSITIVE_KEYS = new Set([
    'password', 'contrasena', 'contraseña', 'token', 'secret',
    'jwt_secret', 'jwtsecret', 'apikey', 'api_key', 'service_role_key'
  ]);

  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[PROTEGIDO]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeAuditData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Calcula la diferencia campo a campo entre el estado anterior y el nuevo estado.
 * Retorna un objeto con la estructura: { [campo]: { antes, despues } }
 */
function computeDiff(before, after) {
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object') {
    return null;
  }
  const diff = {};
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of allKeys) {
    const valBefore = before[key];
    const valAfter = after[key];
    const strBefore = JSON.stringify(valBefore);
    const strAfter = JSON.stringify(valAfter);
    if (strBefore !== strAfter) {
      diff[key] = {
        antes: valBefore !== undefined ? valBefore : null,
        despues: valAfter !== undefined ? valAfter : null
      };
    }
  }
  return Object.keys(diff).length > 0 ? diff : null;
}

/**
 * Repositorio de Auditoría en MongoDB.
 * Registra eventos de forma segura: nunca rompe la operación principal en caso de fallo de persistencia.
 */
class AuditRepository {
  /**
   * @param {{
   *   user: { documentNumber: string, role: string, fullName: string },
   *   entity: string,
   *   entityId: string|number,
   *   practiceId?: string,
   *   action: string,
   *   data?: object,
   *   before?: object,
   *   after?: object,
   *   changes?: object,
   *   details?: string,
   *   metadata?: object
   * }} entry
   */
  async record(entry) {
    try {
      const Model = auditLog();
      if (!Model) return;

      const beforeSanitized = sanitizeAuditData(entry.before);
      const afterSanitized = sanitizeAuditData(entry.after);
      const dataSanitized = sanitizeAuditData(entry.data || (entry.action === 'delete' ? beforeSanitized : afterSanitized));
      const changes = entry.changes ? sanitizeAuditData(entry.changes) : computeDiff(beforeSanitized, afterSanitized);

      await Model.create({
        usuario: {
          numDocumento: entry.user.documentNumber,
          rol: entry.user.role,
          nombreCompleto: entry.user.fullName
        },
        entidad: legacy.auditEntity.toStored(entry.entity),
        idEntidad: String(entry.entityId),
        idPractica: String(entry.practiceId ?? NO_PRACTICE),
        accion: legacy.auditAction.toStored(entry.action),
        datos: dataSanitized,
        datosAnteriores: beforeSanitized,
        datosNuevos: afterSanitized,
        cambios: changes,
        detalles: entry.details || '',
        metadata: entry.metadata ? sanitizeAuditData(entry.metadata) : null
      });
    } catch (err) {
      console.warn('[audit] could not record entry:', err.message);
    }
  }

  async list({ practiceId, limit = 100 } = {}) {
    const Model = auditLog();
    if (!Model) return [];
    const filter = practiceId ? { idPractica: String(practiceId) } : {};
    const documents = await Model.find(filter).sort({ fecha: -1 }).limit(limit).lean();
    return documents.map((d) => ({
      id: String(d._id),
      user: {
        documentNumber: d.usuario?.numDocumento,
        role: d.usuario?.rol,
        fullName: d.usuario?.nombreCompleto
      },
      entity: legacy.auditEntity.fromStored(d.entidad),
      entityId: d.idEntidad,
      practiceId: d.idPractica,
      action: legacy.auditAction.fromStored(d.accion),
      date: d.fecha,
      year: d.anio,
      month: d.mes,
      data: d.datos ?? null,
      before: d.datosAnteriores ?? null,
      after: d.datosNuevos ?? null,
      changes: d.cambios ?? null,
      details: d.detalles ?? '',
      metadata: d.metadata ?? null
    }));
  }
}

module.exports = AuditRepository;
