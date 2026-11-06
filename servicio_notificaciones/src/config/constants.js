'use strict';

/** Tipos de notificación persistidos en `notificaciones.tipo` (ver diccionario de datos TB-0001). */
const NOTIFICATION_TYPES = Object.freeze({
  PRACTICE_ASSIGNED: 'PracticaAsignada',
  USER_REGISTERED: 'UsuarioRegistrado',
  USER_APPROVED: 'UsuarioAprobado',
  ACTIVITY_FEEDBACK: 'ActividadRetroalimentada',
  ACTIVITY_GRADED: 'ActividadCalificada',
  PRACTICE_GRADED: 'PracticaCalificada',
  EVALUATION_AVAILABLE: 'EvaluacionDisponible',
  EVALUATION_GRADED: 'EvaluacionCalificada',
  ACTIVITY_DUE_SOON: 'RecordatorioActividad',
  EVALUATION_DUE_SOON: 'RecordatorioEvaluacion',
  REVIEW_PENDING: 'PendientesRevision',        // tutor y asesor
  UNGRADED_PRACTICES: 'PracticasSinCalificar'   // director
});
const NOTIFICATION_TYPE_LIST = Object.freeze(Object.values(NOTIFICATION_TYPES));

const DELIVERY = Object.freeze({ PENDING: 'Pendiente', SENDING: 'Enviando', SENT: 'Enviada', FAILED: 'Fallida' });

const ROLES = Object.freeze({ STUDENT: 'student', TUTOR: 'tutor', ADVISOR: 'advisor', DIRECTOR: 'director' });
const ROLE_LABELS = Object.freeze({
  student: 'estudiante', tutor: 'tutor académico', advisor: 'asesor pedagógico', director: 'director de prácticas'
});

module.exports = { NOTIFICATION_TYPES, NOTIFICATION_TYPE_LIST, DELIVERY, ROLES, ROLE_LABELS };
