import Student from '../models/Student.js';
import { validateCsv } from '../helpers/csvValidator.js';

/**
 * Validate a CSV buffer and upsert the valid rows.
 * Throws FileError (-> 422) for a bad file; nothing is written in that case.
 */
export async function importCsv(buffer, fileName) {
  const startedAt = new Date();
  const result = validateCsv(buffer);

  // Last line of defence: Mongoose does not run schema validators inside bulkWrite updates,
  // so check every row against the model first. A failure here means the CSV validator has a bug:
  // throw (-> 500) before writing anything rather than store a bad record.
  for (const s of result.students) {
    const err = new Student(s).validateSync();
    if (err) throw new Error(`Row for ${s.student_id} passed CSV validation but not the Student schema: ${err.message}`);
  }

  // Upsert by student_id: a later file is the newer truth for that student.
  // Unchanged rows are matched but not modified, so re-uploading the same file reports 0 new / 0 updated.
  // created_at is added on insert only, by the schema's timestamps option.
  let created = 0;
  let updated = 0;
  if (result.students.length) {
    const ops = result.students.map((s) => ({
      updateOne: { filter: { student_id: s.student_id }, update: { $set: s }, upsert: true },
    }));
    const r = await Student.bulkWrite(ops, { ordered: false });
    created = r.upsertedCount;
    updated = r.modifiedCount;
  }

  return {
    file_name: fileName,
    imported_at: startedAt,
    rows_read: result.rowsRead,
    imported: result.students.length,
    created,
    updated,
    unchanged: result.students.length - created - updated,
    rejected: result.rejectedRows,
    problems: result.problems,
  };
}
