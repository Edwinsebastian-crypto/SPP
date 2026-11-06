'use strict';

/** Documento `Practica` del diccionario de datos a partir de la fila leída de la BD de prácticas. */
function toPracticeDoc(p) {
  if (!p) return undefined;
  return {
    idPractica: p.id, fechainicio: p.startDate, fechafinal: p.endDate, notaFinal: p.finalGrade ?? undefined,
    observacionFinal: p.finalObservation || undefined, estado: p.status, idTipoPractica: p.typeId,
    numDocEstudiante: p.studentDocument, numDocTutor: p.tutorDocument, numDocAsesor: p.advisorDocument, nitEntidad: p.institutionId
  };
}

/** Encola notificaciones (con deduplicación por `key`). No envía nada: eso lo hace el Dispatcher. */
class NotificationService {
  /** @param {{notificationRepository, now?: () => Date}} deps */
  constructor({ notificationRepository, now = () => new Date() }) {
    this.repo = notificationRepository;
    this.now = now;
  }

  /**
   * @param {{type: string, recipient: {documentNumber, email, fullName, role?}, practice?: object, subject: string,
   *          content: string, key?: string}} n
   * @returns {Promise<'queued'|'duplicate'|'skipped'>}
   */
  async queue({ type, recipient, practice, subject, content, key }) {
    if (!recipient || !recipient.email || !recipient.documentNumber) return 'skipped';
    const { created } = await this.repo.enqueue({
      tipo: type,
      destinatario: {
        numDocumento: String(recipient.documentNumber), correo: recipient.email,
        nombreCompleto: recipient.fullName || String(recipient.documentNumber), rol: recipient.role
      },
      Practica: toPracticeDoc(practice),
      asunto: subject,
      contenido: content,
      claveUnica: key
    }, this.now());
    return created ? 'queued' : 'duplicate';
  }
}

module.exports = NotificationService;
module.exports.toPracticeDoc = toPracticeDoc;
