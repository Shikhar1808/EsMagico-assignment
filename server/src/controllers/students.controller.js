import { listStudents, getStudent } from '../services/student.service.js';
import { notFound } from '../helpers/AppError.js';

const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);

export async function list(req, res) {
  const result = await listStudents({
    q: String(req.query.q || '').trim(),
    gradeLevel: parseInt(req.query.grade_level, 10) || null,
    page: Math.max(parseInt(req.query.page, 10) || 1, 1),
    limit: clamp(parseInt(req.query.limit, 10) || 25, 1, 100),
  });
  res.json(result);
}

export async function show(req, res) {
  const student = await getStudent(req.params.id);
  if (!student) throw notFound('STUDENT_NOT_FOUND', `No student with ID ${req.params.id}.`);
  res.json(student);
}

