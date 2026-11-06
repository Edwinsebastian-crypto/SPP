'use strict';
const { DELIVERY } = require('../config/constants');

const DUPLICATE_KEY = 11000;

/** Cola de notificaciones en MongoDB. Es la única clase que habla con la colección `notificaciones`. */
class NotificationRepository {
  /** @param {import('mongoose').Model} Model */
  constructor(Model) {
    this.Model = Model;
  }

  async init() {
    await this.Model.init(); // crea los índices (incluido el único de claveUnica)
  }

  /**
   * Inserta una notificación pendiente. Si ya existe otra con la misma `claveUnica` no hace nada.
   * @returns {Promise<{created: boolean, id?: any}>}
   */
  async enqueue(doc, now = new Date()) {
    try {
      const created = await this.Model.create({
        ...doc, estadoEnvio: DELIVERY.PENDING, intentos: 0, fechaCreacion: now, proximoIntento: now
      });
      return { created: true, id: created._id };
    } catch (err) {
      if (err && err.code === DUPLICATE_KEY) return { created: false };
      throw err;
    }
  }

  /** ¿Ya existe una notificación con esa clave? (para evitar trabajo de plantillas inútil) */
  async existsKey(key) {
    return Boolean(await this.Model.exists({ claveUnica: key }));
  }

  /**
   * Reserva (de forma atómica) la siguiente notificación lista para enviar. Sirve también para documentos creados por
   * el monolito antes de este servicio (no tienen estadoEnvio) y para reservas abandonadas por un proceso caído.
   */
  async claimNext(now = new Date(), lockMs = 300000, { includeLegacy = false } = {}) {
    const ready = [
      { estadoEnvio: DELIVERY.PENDING, proximoIntento: { $lte: now } },
      { estadoEnvio: DELIVERY.SENDING, bloqueadoHasta: { $lt: now } }
    ];
    if (includeLegacy) ready.push({ estadoEnvio: { $exists: false } });
    return this.Model.findOneAndUpdate(
      { fechaEnvio: null, $or: ready },
      { $set: { estadoEnvio: DELIVERY.SENDING, bloqueadoHasta: new Date(now.getTime() + lockMs) }, $inc: { intentos: 1 } },
      { sort: { fechaCreacion: 1 }, new: true }
    ).lean();
  }

  markSent(id, now = new Date()) {
    return this.Model.updateOne(
      { _id: id },
      { $set: { estadoEnvio: DELIVERY.SENT, fechaEnvio: now }, $unset: { bloqueadoHasta: 1, ultimoError: 1 } }
    );
  }

  /** @param {{giveUp: boolean, retryAt: Date}} outcome */
  markFailed(id, error, { giveUp, retryAt }) {
    return this.Model.updateOne(
      { _id: id },
      {
        $set: { estadoEnvio: giveUp ? DELIVERY.FAILED : DELIVERY.PENDING, ultimoError: String(error).slice(0, 500), proximoIntento: retryAt },
        $unset: { bloqueadoHasta: 1 }
      }
    );
  }

  /** Consulta operativa. @param {{documento?, tipo?, estadoEnvio?}} filters */
  list({ documento, tipo, estadoEnvio } = {}, limit = 50) {
    const query = {};
    if (documento) query['destinatario.numDocumento'] = documento;
    if (tipo) query.tipo = tipo;
    if (estadoEnvio) query.estadoEnvio = estadoEnvio;
    return this.Model.find(query).sort({ fechaCreacion: -1 }).limit(Math.min(Math.max(Number(limit) || 50, 1), 200)).lean();
  }

  /** Bandeja de un usuario (campanita): solo notificaciones creadas por este servicio (con claveUnica), las más recientes primero. */
  async inbox(documento, limit = 20) {
    const own = { 'destinatario.numDocumento': String(documento), claveUnica: { $type: 'string' } };
    const [items, unread] = await Promise.all([
      this.Model.find(own).sort({ fechaCreacion: -1 }).limit(Math.min(Math.max(Number(limit) || 20, 1), 50)).lean(),
      this.Model.countDocuments({ ...own, leida: { $ne: true } })
    ]);
    return { items, unread };
  }

  /** Marca como leídas todas las del usuario, o solo `id` si se indica. @returns {Promise<number>} cuántas cambió */
  async markRead(documento, id = null, now = new Date()) {
    const filter = { 'destinatario.numDocumento': String(documento), claveUnica: { $type: 'string' }, leida: { $ne: true } };
    if (id) filter._id = id;
    const r = await this.Model.updateMany(filter, { $set: { leida: true, fechaLectura: now } });
    return r.modifiedCount;
  }

  /** Reintenta a mano las fallidas. */
  async requeueFailed(now = new Date()) {
    const r = await this.Model.updateMany(
      { estadoEnvio: DELIVERY.FAILED },
      { $set: { estadoEnvio: DELIVERY.PENDING, intentos: 0, proximoIntento: now }, $unset: { ultimoError: 1 } }
    );
    return r.modifiedCount;
  }
}

module.exports = NotificationRepository;
