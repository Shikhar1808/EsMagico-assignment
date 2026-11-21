import { Router } from 'express';
import { notFoundHandler } from '../middlewares/errorHandler.js';
import importsRoutes from './imports.routes.js';
import studentsRoutes from './students.routes.js';
import statsRoutes from './stats.routes.js';

const router = Router();
router.use('/imports', importsRoutes);
router.use('/students', studentsRoutes);
router.use('/stats', statsRoutes);
router.use(notFoundHandler); // unknown /api/* paths get JSON 404, not the SPA

export default router;
