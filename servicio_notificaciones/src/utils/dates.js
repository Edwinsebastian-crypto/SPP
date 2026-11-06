'use strict';

/** Partes de fecha/hora en la zona horaria dada (la del servidor puede ser UTC dentro de Docker). */
function localParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(date).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour === '24' ? 0 : parts.hour), minute: Number(parts.minute) };
}

/** "27 de octubre de 2026, 3:30 p. m." */
function formatDateTime(value, timeZone) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-CO', { timeZone, dateStyle: 'long', timeStyle: 'short' }).format(d);
}

/** "27 de octubre de 2026" (acepta 'YYYY-MM-DD' sin desplazar la zona horaria). */
function formatDate(value, timeZone) {
  if (!value) return '';
  const s = String(value);
  const plain = /^\d{4}-\d{2}-\d{2}$/.test(s);
  const d = plain ? new Date(`${s}T12:00:00Z`) : new Date(value);
  if (Number.isNaN(d.getTime())) return s;
  return new Intl.DateTimeFormat('es-CO', { timeZone: plain ? 'UTC' : timeZone, dateStyle: 'long' }).format(d);
}

module.exports = { localParts, formatDateTime, formatDate };

/**
 * Fechas "de pared": la BD de prácticas guarda la hora local que escribió el usuario (el monolito la compara con la
 * hora local del servidor). Aquí se muestra tal cual, sin convertir de zona horaria. Entrada: 'YYYY-MM-DDTHH:mm[:ss]'.
 */
function formatWallClock(value) {
  if (!value) return '';
  const s = String(value).replace(' ', 'T').slice(0, 19);
  const d = new Date(`${s.length === 16 ? `${s}:00` : s}Z`);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', dateStyle: 'long', timeStyle: 'short' }).format(d);
}
module.exports.formatWallClock = formatWallClock;
