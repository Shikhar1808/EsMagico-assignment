// The CSV validator and the Student schema describe the same record in two places.
// These tests fail if they drift apart. validateSync() needs no database connection.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Student from '../src/models/Student.js';
import { validateCsv } from '../src/helpers/csvValidator.js';

const TODAY = new Date(2026, 10, 22);
const HEADER = 'student_id,full_name,email,date_of_birth,grade_level,section,maths,science,english,social_studies,second_language';

test('every row the CSV validator accepts also passes the Student schema', () => {
  const rows = [
    'stu-9,  Singh   Aarav ,  AARAV@Example.EDU ,14/03/2012,09,  b ,  82.5 ,74,79,71,86',
    '"STU2","Patel, Sahil",s@example.edu,2012-03-14,1,A,0,0,0,0,0',
    "STU3,Zoë D'Souza,z@example.edu,2001-11-23,12,F,100,100.0,99.99,1,35",
  ];
  let { students } = validateCsv(Buffer.from([HEADER, ...rows].join('\n')), { today: TODAY });
  assert.equal(students.length, rows.length); // otherwise the loop below would check nothing

  const sample = path.join(import.meta.dirname, '..', '..', 'data', 'students_sample.csv');
  if (fs.existsSync(sample)) students = students.concat(validateCsv(fs.readFileSync(sample), { today: TODAY }).students);

  for (const s of students) assert.equal(new Student(s).validateSync(), undefined, `schema rejected ${s.student_id}`);
});

test('the schema rejects bad records on its own', () => {
  const good = validateCsv(Buffer.from(`${HEADER}\nSTU1,Aarav Sharma,a@example.edu,2012-03-14,9,B,82,74,79,71,86`), { today: TODAY }).students[0];
  const cases = [
    [{ marks: { ...good.marks, maths: 105 } }, 'marks.maths'],
    [{ section: 'G' }, 'section'],
    [{ grade_level: 13 }, 'grade_level'],
    [{ student_id: 'AB' }, 'student_id'],
    [{ full_name: undefined }, 'full_name'],
    [{ full_name: '--' }, 'full_name'],
    [{ email: 'not-an-email' }, 'email'],
    [{ pass_mark: undefined }, 'pass_mark'],
    [{ date_of_birth: '14/03/2012' }, 'date_of_birth'],
  ];
  for (const [change, field] of cases) {
    const err = new Student({ ...good, ...change }).validateSync();
    assert.ok(err?.errors[field], `expected a schema error on ${field}`);
  }
});
