import { Router } from 'express';
import asyncHandler from '../helpers/asyncHandler.js';
import * as students from '../controllers/students.controller.js';

const router = Router();
router.get('/', asyncHandler(students.list));
router.get('/:id', asyncHandler(students.show));

export default router;
