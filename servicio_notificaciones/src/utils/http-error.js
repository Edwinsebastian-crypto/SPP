'use strict';
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
  static badRequest(m) { return new HttpError(400, m); }
  static unauthorized(m = 'No autorizado') { return new HttpError(401, m); }
  static forbidden(m = 'Prohibido') { return new HttpError(403, m); }
  static notFound(m = 'No encontrado') { return new HttpError(404, m); }
}
module.exports = HttpError;
