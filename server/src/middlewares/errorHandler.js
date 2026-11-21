import mongoose from 'mongoose';
import { AppError, notFound } from '../helpers/AppError.js';

// Use the driver bundled with Mongoose, so instanceof matches the errors Mongoose actually throws.
const { MongoServerError, MongoNetworkError, MongoServerSelectionError, MongoNotConnectedError, MongoTopologyClosedError } =
  mongoose.mongo;

const DB_DOWN = [
  MongoNetworkError,
  MongoServerSelectionError,
  MongoNotConnectedError,
  MongoTopologyClosedError,
  mongoose.Error.MongooseServerSelectionError,
];

/** Any request that reached the end of the /api router. */
export function notFoundHandler(req, res, next) {
  next(notFound('NOT_FOUND', `No API endpoint at ${req.method} ${req.originalUrl}.`));
}

function isDbDown(err) {
  if (DB_DOWN.some((E) => err instanceof E)) return true;
  // bulkWrite wraps a connection failure in MongoBulkWriteError and loses the original error type,
  // so also treat any driver error as "DB down" while Mongoose reports the connection is not up.
  return err instanceof mongoose.mongo.MongoError && mongoose.connection.readyState !== mongoose.ConnectionStates.connected;
}

/** Map any error to { status, code, message } that is safe to send to the browser. */
function toHttpError(err) {
  if (err instanceof AppError) return err;

  if (err instanceof MongoServerError && err.code === 11000)
    return new AppError(409, 'DUPLICATE_KEY', 'This record already exists.');

  if (isDbDown(err))
    return new AppError(503, 'DB_UNAVAILABLE', 'The database is not reachable right now. Please try again in a moment.');

  // Errors raised by Express itself or its helpers (http-errors): e.g. a malformed URL like /students/%E0.
  const status = err.status ?? err.statusCode;
  if (Number.isInteger(status) && status >= 400 && status < 500)
    return new AppError(status, 'BAD_REQUEST', err.expose ? err.message : 'The request was not valid.');

  return new AppError(500, 'INTERNAL_ERROR', 'Something went wrong on the server. Please try again.');
}

// Express recognises error middleware by its 4 parameters, so `next` must stay.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err); // response already streaming: let Express close it

  const httpErr = toHttpError(err);
  if (httpErr.status >= 500) console.error(`${req.method} ${req.originalUrl} ->`, err);
  if (httpErr.status === 503) res.set('Retry-After', '5');
  res.status(httpErr.status).json({ error: httpErr.message, code: httpErr.code });
}
