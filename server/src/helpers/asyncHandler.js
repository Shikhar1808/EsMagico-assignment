// Express 4 does not catch rejected promises; forward them to the error handler.
export default (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
