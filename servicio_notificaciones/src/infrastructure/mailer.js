'use strict';
const nodemailer = require('nodemailer');
const env = require('../config/env');

/**
 * Envío de correo. MAIL_MODE=smtp usa SMTP real (o Mailpit en desarrollo); MAIL_MODE=log solo imprime el
 * mensaje (útil cuando aún no hay credenciales: la notificación igualmente se marca como enviada).
 */
function createMailer({ transport } = {}) {
  let tx = transport || null;
  const mode = env.mailMode;

  function get() {
    if (tx) return tx;
    if (mode === 'log') {
      tx = nodemailer.createTransport({ jsonTransport: true });
    } else {
      const smtp = env.smtp;
      if (!smtp.host) throw new Error('Falta SMTP_HOST (o usa MAIL_MODE=log para solo registrar en consola)');
      tx = nodemailer.createTransport({
        host: smtp.host, port: smtp.port, secure: smtp.secure,
        auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined
      });
    }
    return tx;
  }

  return {
    /** @param {{to, subject, text, html, attachments?}} message @returns {Promise<{messageId?: string}>} */
    async send({ to, subject, text, html, attachments }) {
      // Cabeceras de correo transaccional: ayudan a que Gmail lo clasifique en «Notificaciones/Novedades».
      const headers = {
        'Auto-Submitted': 'auto-generated',
        'X-Auto-Response-Suppress': 'All',
        'List-Id': 'SPP Notificaciones <notificaciones.spp.local>'
      };
      const info = await get().sendMail({ from: env.mailFrom, to, subject, text, html, attachments, headers });
      if (mode === 'log' && !transport) console.log(`[mail:log] → ${to} | ${subject}`);
      return { messageId: info && info.messageId };
    },
    async verify() {
      if (mode === 'log' || transport) return true;
      return get().verify();
    }
  };
}

module.exports = { createMailer };
