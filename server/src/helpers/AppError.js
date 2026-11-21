// An expected, user-facing failure: carries the HTTP status, a stable machine-readable
// code (for clients and logs) and a plain-English message safe to show the administrator.
export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (code, message) => new AppError(400, code, message);
export const notFound = (code, message) => new AppError(404, code, message);
