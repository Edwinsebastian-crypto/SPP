'use strict';
const mongoose = require('mongoose');
const { NOTIFICATION_TYPE_LIST, DELIVERY } = require('../config/constants');

/**
 * Colección `notificaciones` — diccionario de datos TB-0001 (los nombres persistidos se mantienen tal cual).
 * Campos del diccionario: _id, tipo, destinatario, Practica, asunto, contenido, fechaCreacion, fechaEnvio.
 * Campos añadidos para operar la cola: rol del destinatario, estadoEnvio, intentos, ultimoError, proximoIntento,
 * bloqueadoHasta y claveUnica (evita duplicados en recordatorios y eventos repetidos).
 */
const practiceSchema = new mongoose.Schema({
  idPractica: String,
  fechainicio: String,        // 'YYYY-MM-DD'
  fechafinal: String,
  notaFinal: Number,
  observacionFinal: String,
  estado: String,
  idTipoPractica: String,
  numDocEstudiante: String,
  numDocTutor: String,
  numDocAsesor: String,
  nitEntidad: String
}, { _id: false });

const schema = new mongoose.Schema({
  tipo: { type: String, required: true, enum: NOTIFICATION_TYPE_LIST },
  destinatario: {
    numDocumento: { type: String, required: true },
    correo: { type: String, required: true },
    nombreCompleto: { type: String, required: true },
    rol: { type: String }
  },
  // Obligatoria cuando la notificación nace de una práctica; no aplica al registro de usuarios ni a los resúmenes.
  Practica: { type: practiceSchema, required: false },
  asunto: { type: String, required: true },
  contenido: { type: String, required: true },
  fechaCreacion: { type: Date, required: true, default: Date.now },
  fechaEnvio: { type: Date, required: false }, // vacío hasta que el correo sale correctamente

  estadoEnvio: { type: String, enum: Object.values(DELIVERY), default: DELIVERY.PENDING },
  intentos: { type: Number, default: 0 },
  ultimoError: { type: String },
  proximoIntento: { type: Date, default: Date.now },
  bloqueadoHasta: { type: Date },
  claveUnica: { type: String },

  // bandeja de la campanita (la lee el usuario destinatario)
  leida: { type: Boolean, default: false },
  fechaLectura: { type: Date }
}, { collection: 'notificaciones', versionKey: false });

schema.index({ claveUnica: 1 }, { unique: true, partialFilterExpression: { claveUnica: { $type: 'string' } } });
schema.index({ estadoEnvio: 1, proximoIntento: 1 });
schema.index({ 'destinatario.numDocumento': 1, fechaCreacion: -1 });

/** Modelo ligado a la conexión (se crea una vez). */
function buildModel(connection) {
  return connection.models.Notificacion || connection.model('Notificacion', schema, 'notificaciones');
}

module.exports = { buildModel, schema };
