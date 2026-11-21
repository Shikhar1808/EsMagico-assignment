import { Router } from 'express';
import asyncHandler from '../helpers/asyncHandler.js';
import * as stats from '../controllers/stats.controller.js';

const router = Router();
router.get('/', asyncHandler(stats.show));

export default router;
