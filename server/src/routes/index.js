import { Router } from 'express';
import uploadCsv from '../middlewares/upload.js';
import { notFoundHandler } from '../middlewares/errorHandler.js';
import * as controllers from '../controllers/index.js';

// Express 4 does not catch rejected promises; forward them to the error handler.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const router = Router();

router.post('/imports', uploadCsv, asyncHandler(controllers.createImport));
router.get('/students', asyncHandler(controllers.listStudentsHandler));
router.get('/students/:id', asyncHandler(controllers.showStudent));
router.get('/stats', asyncHandler(controllers.showStats));

router.use(notFoundHandler); // unknown /api/* paths get JSON 404, not the SPA

export default router;
