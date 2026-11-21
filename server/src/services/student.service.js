import Student from '../models/Student.js';
import escapeRegex from '../helpers/escapeRegex.js';

const HIDDEN = { _id: 0, created_at: 0 };

export async function listStudents({ q, gradeLevel, page, limit }) {
  const filter = {};
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ student_id: rx }, { full_name: rx }];
  }
  if (gradeLevel) filter.grade_level = gradeLevel;

  const [items, total] = await Promise.all([
    Student.find(filter, { ...HIDDEN, marks: 0 })
      .sort({ student_id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Student.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

export function getStudent(id) {
  return Student.findOne({ student_id: id.trim().toUpperCase() }, HIDDEN).lean();
}
