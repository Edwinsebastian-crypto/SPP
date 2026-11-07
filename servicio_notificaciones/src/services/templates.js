'use strict';
const { ROLE_LABELS } = require('../config/constants');
const { formatDate, formatDateTime, formatWallClock } = require('../utils/dates');

/**
 * Textos de cada notificación (asunto + contenido en texto plano). Cada función es pura: recibe datos ya resueltos
 * y devuelve { subject, content }. El HTML del correo se arma después, a partir de este mismo texto (render-email.js).
 */
const MAX_LIST = 10;

const first = (fullName) => String(fullName || '').trim().split(/\s+/)[0] || '';
const hello = (fullName) => `Hola ${first(fullName)},`;
const formatGrade = (n) => (Number.isFinite(Number(n)) ? Number(n).toFixed(1) : String(n));
const bullets = (items, total = items.length) => {
  const shown = items.slice(0, MAX_LIST).map((i) => `• ${i}`);
  if (total > shown.length) shown.push(`… y ${total - shown.length} más.`);
  return shown.join('\n');
};
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function userRegistered({ fullName, role, status }) {
  const label = ROLE_LABELS[role] || role;
  const pending = status === 'pending';
  return {
    subject: pending ? 'Recibimos tu registro en SPP' : 'Tu cuenta en SPP está lista',
    content: [
      hello(fullName),
      pending
        ? `Tu registro como ${label} en el Software de Prácticas Pedagógicas (SPP) se realizó correctamente. Quedó pendiente de aprobación por la Dirección de prácticas; cuando sea aceptado podrás ingresar con tu usuario institucional.`
        : `Se creó tu cuenta como ${label} en el Software de Prácticas Pedagógicas (SPP). Ya puedes ingresar con tu usuario institucional.`
    ].join('\n\n')
  };
}

function userApproved({ fullName, role }) {
  return {
    subject: 'Tu cuenta en SPP fue aprobada',
    content: [
      hello(fullName),
      `La Dirección de prácticas aprobó tu registro como ${ROLE_LABELS[role] || role} en el Software de Prácticas Pedagógicas (SPP).`,
      'Ya puedes ingresar con tu usuario institucional.'
    ].join('\n\n')
  };
}

function practiceAssigned({ fullName, roleLabel, practiceName, startDate, endDate, tz }) {
  return {
    subject: `Se te ha asignado una práctica: ${practiceName}`,
    content: [
      hello(fullName),
      `Se te asignó la práctica "${practiceName}" como ${roleLabel}.`,
      `Vigencia: del ${formatDate(startDate, tz)} al ${formatDate(endDate, tz)}.`
    ].join('\n\n')
  };
}

function activityFeedback({ fullName, activityTitle, authorName, authorRole, text }) {
  const who = `${authorName} (${ROLE_LABELS[authorRole] || authorRole})`;
  const preview = String(text || '').trim();
  return {
    subject: `Nueva retroalimentación en tu actividad: ${activityTitle}`,
    content: [
      hello(fullName),
      `${who} dejó una retroalimentación en tu actividad "${activityTitle}".`,
      preview ? `«${preview.length > 400 ? `${preview.slice(0, 400)}…` : preview}»` : '',
      'Ingresa al SPP para ver el detalle completo.'
    ].filter(Boolean).join('\n\n')
  };
}

function activityGraded({ fullName, activityTitle, grade, graderName, graderRole }) {
  return {
    subject: `Tu actividad fue calificada: ${activityTitle}`,
    content: [
      hello(fullName),
      `${graderName} (${ROLE_LABELS[graderRole] || graderRole}) calificó tu actividad "${activityTitle}".`,
      `Nota obtenida: ${formatGrade(grade)}`
    ].join('\n\n')
  };
}

function practiceGraded({ fullName, practiceName, finalGrade, observation }) {
  return {
    subject: `Tu práctica fue calificada: ${practiceName}`,
    content: [
      hello(fullName),
      `Tu práctica "${practiceName}" ya tiene calificación final.`,
      `Nota final: ${formatGrade(finalGrade)}`,
      observation ? `Observación del tutor: ${observation}` : ''
    ].filter(Boolean).join('\n\n')
  };
}

function practiceReadyToEvaluate({ fullName, studentName, practiceName }) {
  return {
    subject: `Es hora de evaluar: ${studentName}`,
    content: [
      hello(fullName),
      `${studentName} completó todas las horas de la práctica "${practiceName}".`,
      'La práctica pasó al estado «Evaluando»: ya puedes evaluar al estudiante y registrar su calificación desde el SPP.'
    ].join('\n\n')
  };
}

function evaluationAvailable({ fullName, title, dueAt, tz }) {
  return {
    subject: `Ya está disponible tu evaluación: ${title}`,
    content: [
      hello(fullName),
      `Tu tutor publicó la evaluación "${title}". Ya puedes presentarla desde el SPP.`,
      dueAt ? `Fecha límite: ${formatDateTime(dueAt, tz)}.` : 'Esta evaluación no tiene fecha límite.'
    ].join('\n\n')
  };
}

function evaluationGraded({ fullName, title, grade, maxGrade, showResults }) {
  const hasGrade = grade !== null && grade !== undefined;
  return {
    subject: `Tu evaluación fue calificada${title ? `: ${title}` : ''}`,
    content: [
      hello(fullName),
      `Tu evaluación${title ? ` "${title}"` : ''} ya fue calificada.`,
      hasGrade && showResults !== false ? `Nota obtenida: ${formatGrade(grade)}${maxGrade ? ` de ${formatGrade(maxGrade)}` : ''}.` : 'Ingresa al SPP para ver el resultado.'
    ].join('\n\n')
  };
}

function activityDueSoon({ fullName, activityTitle, dueLocal }) {
  return {
    subject: `Recordatorio: mañana vence tu actividad "${activityTitle}"`,
    content: [
      hello(fullName),
      `Tu actividad "${activityTitle}" vence el ${formatWallClock(dueLocal)} y todavía no has cargado tu evidencia.`,
      'Entra al SPP y súbela antes de la fecha límite: después de ese momento las entregas se cierran.'
    ].join('\n\n')
  };
}

function evaluationDueSoon({ fullName, title, dueAt, tz }) {
  return {
    subject: `Recordatorio: mañana vence tu evaluación "${title}"`,
    content: [
      hello(fullName),
      `La evaluación "${title}" vence el ${formatDateTime(dueAt, tz)} y aún no la has presentado.`,
      'Ingresa al SPP y preséntala antes de la fecha límite.'
    ].join('\n\n')
  };
}

/**
 * Resumen diario de pendientes para tutor o asesor.
 * @param {{fullName, role, day, grade: Array, feedback: Array, practices?: Array, evaluations?: Array, tz}} data
 *   `grade` / `feedback` / `practices` / `evaluations`: arrays de textos ya descriptivos.
 */
function reviewPending({ fullName, role, grade, feedback, practices = [], evaluations = [] }) {
  const sections = [];
  if (feedback.length) sections.push(`Actividades por retroalimentar (${feedback.length}):\n${bullets(feedback)}`);
  if (grade.length) sections.push(`Actividades por calificar (${grade.length}):\n${bullets(grade)}`);
  if (evaluations.length) sections.push(`Evaluaciones por calificar (${evaluations.length}):\n${bullets(evaluations)}`);
  if (practices.length) sections.push(`Prácticas por calificar (${practices.length}):\n${bullets(practices)}`);
  // una misma actividad puede estar «por retroalimentar» y «por calificar»: se cuenta una sola vez
  const total = new Set([...grade, ...feedback]).size + practices.length + evaluations.length;
  const summary = [
    feedback.length && `${plural(feedback.length, 'actividad por retroalimentar', 'actividades por retroalimentar')}`,
    grade.length && `${plural(grade.length, 'actividad por calificar', 'actividades por calificar')}`,
    evaluations.length && `${plural(evaluations.length, 'evaluación por calificar', 'evaluaciones por calificar')}`,
    practices.length && `${plural(practices.length, 'práctica por calificar', 'prácticas por calificar')}`
  ].filter(Boolean).join(', ');
  return {
    subject: `Tienes ${plural(total, 'pendiente', 'pendientes')} por revisar en SPP`,
    content: [hello(fullName), `Como ${ROLE_LABELS[role] || role} tienes trabajo esperando tu revisión: ${summary}.`, ...sections].join('\n\n')
  };
}

/** Resumen diario para el director: prácticas con fecha final vencida y sin calificar. */
function ungradedPractices({ fullName, items, total, tz }) {
  return {
    subject: `Hay ${plural(total, 'práctica sin calificar', 'prácticas sin calificar')}`,
    content: [
      hello(fullName),
      `Estas prácticas ya terminaron (fecha final vencida) y aún no tienen nota final:`,
      bullets(items.map((p) => `${p.studentName} — ${p.typeName || 'Práctica'} · terminó el ${formatDate(p.endDate, tz)} · tutor: ${p.tutorName || 'sin tutor'}`), total)
    ].join('\n\n')
  };
}

module.exports = {
  userRegistered, userApproved, practiceAssigned, activityFeedback, activityGraded, practiceGraded, practiceReadyToEvaluate, evaluationAvailable,
  evaluationGraded, activityDueSoon, evaluationDueSoon, reviewPending, ungradedPractices, MAX_LIST
};
