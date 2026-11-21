import multer from 'multer';
import config from '../config/index.js';
import { AppError, badRequest } from '../helpers/AppError.js';

const { maxUploadMb } = config;

const multerSingle = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadMb * 1024 * 1024, files: 1 },
}).single('file');

const MULTER_MESSAGES = {
  LIMIT_UNEXPECTED_FILE: 'Send the CSV in a form field named "file", one file per upload.',
  LIMIT_FILE_COUNT: 'Upload one file at a time.',
};

// Multer reports problems through a callback; turn them into AppErrors for the error handler.
export default function uploadCsv(req, res, next) {
  multerSingle(req, res, (err) => {
    if (err?.code === 'LIMIT_FILE_SIZE')
      return next(new AppError(413, 'FILE_TOO_LARGE', `File is larger than ${maxUploadMb} MB. Split it into smaller files.`));
    if (err instanceof multer.MulterError)
      return next(badRequest('INVALID_UPLOAD', MULTER_MESSAGES[err.code] || `Upload failed: ${err.message}.`));
    if (err) return next(err); // e.g. client disconnected mid-upload
    if (!req.file) return next(badRequest('NO_FILE', 'Choose a CSV file to upload.'));
    next();
  });
}
