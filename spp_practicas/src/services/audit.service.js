'use strict';
const { NO_PRACTICE } = require('../config/constants');
const { fullName } = require('../utils/format');

/**
 * Servicio de Auditoría y Trazabilidad.
 * Gestiona el registro y consulta de eventos de auditoría.
 * La grabación es "fire-and-forget": nunca interrumpe ni hace fallar la transacción de negocio principal.
 */
class AuditService {
  constructor({ auditRepository }) {
    this.auditRepository = auditRepository;
  }

  /**
   * Registra un evento de auditoría con información completa de la tabla / registro.
   * 
   * @param {object} actor Usuario autenticado que ejecuta la acción
   * @param {{
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
  record(actor, {
    entity,
    entityId,
    practiceId = NO_PRACTICE,
    action,
    data,
    before,
    after,
    changes,
    details,
    metadata
  }) {
    return this.auditRepository.record({
      user: {
        documentNumber: actor.documentNumber,
        role: actor.role,
        fullName: fullName(actor)
      },
      entity,
      entityId,
      practiceId,
      action,
      data,
      before,
      after,
      changes,
      details,
      metadata
    });
  }

  list({ practiceId } = {}) {
    return this.auditRepository.list({ practiceId });
  }
}

module.exports = AuditService;
