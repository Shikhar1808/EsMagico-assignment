import { Router } from 'express';
import uploadCsv from '../middlewares/upload.js';
import asyncHandler from '../helpers/asyncHandler.js';
import * as imports from '../controllers/imports.controller.js';

const router = Router();
router.post('/', uploadCsv, asyncHandler(imports.create));

export default router;
