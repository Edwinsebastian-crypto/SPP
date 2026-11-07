'use strict';
const fs = require('fs');
const path = require('path');
const env = require('../config/env');
const { NOTIFICATION_TYPES: T } = require('../config/constants');

/* ============================================================================================
 *  PERSONALIZA AQUÍ  (solo cambia lo que está entre comillas)
 * ============================================================================================ */
const DISEÑO = {
  nombre: env.get('MAIL_APP_NAME', 'SPP · Prácticas Pedagógicas'),
  colorEncabezado: env.get('MAIL_HEADER_COLOR', '#103323'),
  colorDestacado: env.get('MAIL_ACCENT_COLOR', '#265c48'),
  colorFondo: env.get('MAIL_BG_COLOR', '#eef4f0'),
  colorDorado: env.get('MAIL_GOLD_COLOR', '#c9a14a'),
  // URL pública https del logo (opcional). Si se define, el logo NO va adjunto; si no, va incrustado (cid).
  logoUrl: env.get('MAIL_LOGO_URL', ''),
  textoBoton: env.get('MAIL_BUTTON_TEXT', 'Ver en SPP'),
  pie: env.get('MAIL_FOOTER', 'Este es un mensaje automático del Software de Prácticas Pedagógicas. Por favor no respondas a este correo.')
};

// Etiqueta pequeña que aparece encima del título, según el tipo de notificación.
const ETIQUETAS = {
  [T.USER_REGISTERED]: 'Registro',
  [T.USER_APPROVED]: 'Cuenta aprobada',
  [T.PRACTICE_ASSIGNED]: 'Nueva práctica',
  [T.ACTIVITY_FEEDBACK]: 'Retroalimentación',
  [T.ACTIVITY_GRADED]: 'Actividad calificada',
  [T.PRACTICE_GRADED]: 'Práctica calificada',
  [T.PRACTICE_READY_TO_EVALUATE]: 'Hora de evaluar',
  [T.EVALUATION_AVAILABLE]: 'Nueva evaluación',
  [T.EVALUATION_GRADED]: 'Evaluación calificada',
  [T.ACTIVITY_DUE_SOON]: 'Recordatorio',
  [T.EVALUATION_DUE_SOON]: 'Recordatorio',
  [T.REVIEW_PENDING]: 'Pendientes por revisar',
  [T.UNGRADED_PRACTICES]: 'Pendientes por calificar'
};
const ETIQUETA_POR_DEFECTO = 'Notificación';

// Logo (archivo en servicio_notificaciones/assets). Va adjunto al correo, así se ve aunque APP_URL sea local.
const LOGO = { archivo: path.join(__dirname, '..', '..', 'assets', 'logo-email.png'), cid: 'spp-logo', altoPx: 64 };
/* ============================================================================================ */

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Convierte el texto plano del mensaje en párrafos y listas HTML (todo el contenido dinámico va escapado). */
function renderBody(content) {
  return String(content).split(/\n{2,}/).map((block) => {
    const lines = block.split('\n');
    const isList = lines.length > 1 && lines.slice(1).every((l) => l.startsWith('• ') || l.startsWith('… '));
    if (isList || lines.every((l) => l.startsWith('• '))) {
      const head = lines[0].startsWith('• ') ? '' : `<p style="margin:16px 0 6px;font-weight:600">${escapeHtml(lines[0])}</p>`;
      const items = lines.filter((l, i) => (head ? i > 0 : true)).map((l) => (l.startsWith('• ')
        ? `<li style="margin:3px 0">${escapeHtml(l.slice(2))}</li>` : `<li style="list-style:none;color:#6b7280">${escapeHtml(l)}</li>`)).join('');
      return `${head}<ul style="margin:0 0 12px;padding-left:20px">${items}</ul>`;
    }
    return `<p style="margin:0 0 14px;line-height:1.55">${escapeHtml(block).replace(/\n/g, '<br>')}</p>`;
  }).join('');
}

/**
 * Arma el correo (texto + HTML + adjuntos) a partir de la notificación.
 * @param {{subject: string, content: string, tipo?: string}} n  `tipo` es opcional: elige la etiqueta de categoría.
 */
function renderEmail({ subject, content, tipo }) {
  const d = DISEÑO;
  const useUrl = /^https:\/\//i.test(d.logoUrl);
  const hasLogo = !useUrl && fs.existsSync(LOGO.archivo);
  const etiqueta = ETIQUETAS[tipo] || ETIQUETA_POR_DEFECTO;
  const logoSrc = useUrl ? escapeHtml(d.logoUrl) : `cid:${LOGO.cid}`;
  const logoCell = (useUrl || hasLogo)
    ? `<td style="padding:0 12px 0 0;vertical-align:middle"><img src="${logoSrc}" alt="SPP" height="${LOGO.altoPx}" style="display:block;height:${LOGO.altoPx}px;width:auto;border:0"></td>`
    : '';
  const button = env.appUrl
    ? `<p style="margin:22px 0 0"><a href="${escapeHtml(env.appUrl)}" style="background:${d.colorDestacado};color:#ffffff;padding:12px 26px;border-radius:999px;text-decoration:none;display:inline-block;font-weight:600">${escapeHtml(d.textoBoton)}</a></p>` : '';

  const html = `<!doctype html><html lang="es"><body style="margin:0;background:${d.colorFondo};font-family:Arial,Helvetica,sans-serif;color:#111827">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${d.colorFondo}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #d5e3da;border-radius:14px;overflow:hidden">
<tr><td style="background:${d.colorEncabezado};padding:16px 24px;border-bottom:3px solid ${d.colorDorado}"><table role="presentation" cellpadding="0" cellspacing="0"><tr>${logoCell}<td style="vertical-align:middle;color:#ffffff;font-size:16px;font-weight:600">${escapeHtml(d.nombre)}</td></tr></table></td></tr>
<tr><td style="padding:26px 24px 8px;font-size:14px">
<div style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${d.colorDestacado};margin:0 0 8px">${escapeHtml(etiqueta)}</div>
<h2 style="margin:0 0 18px;font-size:20px;line-height:1.3;color:#111827">${escapeHtml(subject)}</h2>
${renderBody(content)}${button}
</td></tr>
<tr><td style="padding:18px 24px;color:#6b7280;font-size:12px;border-top:1px solid #e3ede7;background:#f7faf8">${escapeHtml(d.pie)}</td></tr>
</table></td></tr></table></body></html>`;

  const attachments = hasLogo ? [{ filename: 'logo-spp.png', path: LOGO.archivo, cid: LOGO.cid }] : [];
  return { text: `${content}${env.appUrl ? `\n\n${env.appUrl}` : ''}`, html, attachments };
}

module.exports = { renderEmail, escapeHtml };
