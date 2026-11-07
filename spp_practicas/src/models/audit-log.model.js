'use strict';
const mongoose = require('mongoose');
const defineModel = require('./define-model');

/**
 * Esquema de Auditoría del Sistema (Conexión "primary" de MongoDB, colección `auditoria`).
 * 
 * Garantiza trazabilidad y no repudio sobre las entidades del dominio de prácticas pedagógicas:
 * - Usuario que ejecuta la acción (documento, rol, nombre).
 * - Entidad afectada (Práctica, Bitácora, Actividad, Evidencia, Retroalimentación, Usuario).
 * - Identificadores de fila y práctica.
 * - Tipo de operación (Insertar, Modificar, Eliminar).
 * - Instantánea de datos completos de la tabla (datos/snapshot).
 * - Estado anterior (datosAnteriores) y estado posterior (datosNuevos) para auditoría forense.
 * - Registro de cambios diferenciales (cambios).
 * - Resumen legible (detalles) y metadatos técnicos (metadata).
 */
const schema = new mongoose.Schema({
  usuario: {
    numDocumento: { type: String, required: true },
    rol: { type: String, required: true },
    nombreCompleto: { type: String, required: true }
  },
  entidad: {
    type: String,
    required: true,
    enum: ['Practica', 'Bitacora', 'Actividad', 'Evidencia', 'Retroalimentacion', 'Respuesta', 'Usuario']
  },
  idEntidad: { type: String, required: true }, // Viene de PostgreSQL (String)
  idPractica: { type: String, required: false, default: 'NO_PRACTICE' }, // varchar(30) o 'NO_PRACTICE'
  accion: { type: String, required: true, enum: ['Insertar', 'Modificar', 'Eliminar'] },

  // Instantánea completa del registro auditado (evita que la auditoría sea solo un ID superficial)
  datos: { type: mongoose.Schema.Types.Mixed, default: null }, // Snapshot completo de la fila o entidad
  datosAnteriores: { type: mongoose.Schema.Types.Mixed, default: null }, // Estado previo (Modificar / Eliminar)
  datosNuevos: { type: mongoose.Schema.Types.Mixed, default: null }, // Estado resultante (Insertar / Modificar)
  cambios: { type: mongoose.Schema.Types.Mixed, default: null }, // Diferencial de campos modificados { [campo]: { antes, despues } }
  detalles: { type: String, default: '' }, // Resumen legible de la operación
  metadata: { type: mongoose.Schema.Types.Mixed, default: null }, // Contexto opcional (IP, User Agent, etc.)

  fecha: { type: Date, required: true, default: Date.now },
  anio: { type: Number, required: true },
  mes: { type: Number, required: true, min: 1, max: 12 }
});

// Índices para optimizar consultas de auditoría por fecha, práctica y entidad
schema.index({ fecha: -1 });
schema.index({ idPractica: 1, fecha: -1 });
schema.index({ entidad: 1, idEntidad: 1 });

// `anio` y `mes` se derivan automáticamente de `fecha` antes de validar
schema.pre('validate', function deriveYearAndMonth(next) {
  if (this.fecha) {
    this.anio = this.fecha.getFullYear();
    this.mes = this.fecha.getMonth() + 1;
  }
  if (!this.idPractica) {
    this.idPractica = 'NO_PRACTICE';
  }
  next();
});

module.exports = defineModel('primary', 'Auditoria', schema, 'auditoria');
