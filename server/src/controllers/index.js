import { importCsv } from '../services/import.service.js';
import { listStudents, getStudent, getStats } from '../services/student.service.js';
import { notFound } from '../helpers/AppError.js';

const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);

export async function createImport(req, res) {
  res.json(await importCsv(req.file.buffer, req.file.originalname));
}

export async function listStudentsHandler(req, res) {
  res.json(
    await listStudents({
      q: String(req.query.q || '').trim(),
      gradeLevel: parseInt(req.query.grade_level, 10) || null,
      page: Math.max(parseInt(req.query.page, 10) || 1, 1),
      limit: clamp(parseInt(req.query.limit, 10) || 25, 1, 100),
    }),
  );
}

export async function showStudent(req, res) {
  const student = await getStudent(req.params.id);
  if (!student) throw notFound('STUDENT_NOT_FOUND', `No student with ID ${req.params.id}.`);
  res.json(student);
}

export async function showStats(req, res) {
  res.json(await getStats());
}
