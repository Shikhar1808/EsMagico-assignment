import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validateCsv, FileError } from '../src/helpers/csvValidator.js';
import { computeResult } from '../src/helpers/grading.js';

// Fixed "today" so age-based rules don't drift as time passes.
const TODAY = new Date(2026, 10, 22);
const HEADER = 'student_id,full_name,email,date_of_birth,grade_level,section,maths,science,english,social_studies,second_language';
const GOOD = 'STU1,Aarav Sharma,aarav@example.edu,2012-03-14,9,B,82,74,79,71,86';

const run = (lines, opts = {}) => validateCsv(Buffer.from(lines.join('\n')), { today: TODAY, ...opts });
/** Replace one column of the GOOD row and return its problem codes. */
function codesFor(col, value) {
  const cols = HEADER.split(',');
  const row = GOOD.split(',');
  row[cols.indexOf(col)] = value;
  const r = run([HEADER, row.join(',')]);
  return r.problems.map((p) => p.code);
}

test('a clean row is imported and normalised', () => {
  const r = run([HEADER, 'stu-9,  Singh   Aarav ,  AARAV@Example.EDU ,14/03/2012,09,  b ,  82.5 ,74,79,71,86']);
  assert.equal(r.problems.length, 0);
  assert.deepEqual(r.students[0], {
    student_id: 'STU-9', full_name: 'Singh Aarav', email: 'aarav@example.edu', date_of_birth: '2012-03-14',
    grade_level: 9, section: 'B', marks: { maths: 82.5, science: 74, english: 79, social_studies: 71, second_language: 86 },
    total: 392.5, max_total: 500, percentage: 78.5, grade: 'B', passed: true, pass_mark: 35,
  });
});

test('quoted commas and unicode names are valid', () => {
  const r = run([HEADER, `STU2,"Patel, Sahil",s@example.edu,2012-03-14,9,B,1,2,3,4,5`, `STU3,Zoë D'Souza,z@example.edu,2012-03-14,9,B,1,2,3,4,5`]);
  assert.equal(r.problems.length, 0);
  assert.equal(r.students[0].full_name, 'Patel, Sahil');
});

for (const [col, value, code] of [
  ['full_name', '', 'MISSING_REQUIRED'],
  ['full_name', 'A', 'OUT_OF_RANGE'],
  ['full_name', '=HYPERLINK("x")', 'INVALID_FORMAT'],
  ['full_name', '--', 'INVALID_FORMAT'], // placeholder for a blank cell
  ['student_id', 'AB', 'INVALID_FORMAT'],
  ['student_id', 'STU 1', 'INVALID_FORMAT'],
  ['email', 'sana@example', 'INVALID_FORMAT'],
  ['email', 'riya@@example.edu', 'INVALID_FORMAT'],
  ['email', 'kabir at example.edu', 'INVALID_FORMAT'],
  ['date_of_birth', '31/02/2012', 'INVALID_FORMAT'], // not a real date
  ['date_of_birth', '11-30-2010', 'INVALID_FORMAT'],
  ['date_of_birth', 'tomorrow', 'INVALID_FORMAT'],
  ['date_of_birth', '1970-01-01', 'OUT_OF_RANGE'],
  ['date_of_birth', '2031-01-01', 'OUT_OF_RANGE'], // future
  ['date_of_birth', '2021-11-23', 'OUT_OF_RANGE'], // turns 5 tomorrow
  ['grade_level', 'IX', 'INVALID_FORMAT'],
  ['grade_level', '0', 'OUT_OF_RANGE'],
  ['grade_level', '13', 'OUT_OF_RANGE'],
  ['section', 'G', 'INVALID_FORMAT'],
  ['section', 'AB', 'INVALID_FORMAT'],
  ['maths', '1e3', 'INVALID_FORMAT'], // Number('1e3') would happily accept this
  ['maths', '82/100', 'INVALID_FORMAT'],
  ['maths', '100.5', 'OUT_OF_RANGE'],
  ['maths', '-5', 'OUT_OF_RANGE'],
  ['second_language', ' ', 'MISSING_REQUIRED'],
]) {
  test(`${col}="${value}" -> ${code}`, () => assert.deepEqual(codesFor(col, value), [code]));
}

for (const [col, value] of [['date_of_birth', '2021-11-22'], ['date_of_birth', '2001-11-23'], ['maths', '100.0'], ['maths', '0'], ['grade_level', '12']]) {
  test(`${col}="${value}" is accepted (boundary)`, () => assert.deepEqual(codesFor(col, value), []));
}

test('every problem on a row is reported, row counted once', () => {
  const r = run([HEADER, 'STU1,,bad,tomorrow,IX,Z,a,b,c,d,e']);
  assert.equal(r.rejectedRows, 1);
  assert.equal(r.problems.length, 10);
});

test('duplicate IDs: first row claims the ID even if it is invalid, case-insensitively', () => {
  const r = run([HEADER, GOOD.replace('82', '-5'), GOOD.replace('STU1', 'stu1'), GOOD.replace('STU1', 'STU2')]);
  assert.deepEqual(r.problems.map((p) => [p.row, p.code]), [[2, 'OUT_OF_RANGE'], [3, 'DUPLICATE_ID']]);
  assert.deepEqual(r.students.map((s) => s.student_id), ['STU2']);
});

test('wrong field count rejects the whole row; all-empty rows are skipped even with the wrong count', () => {
  const r = run([HEADER, GOOD + ',extra', ',,,,', '   ', '', GOOD]);
  assert.equal(r.rowsRead, 2);
  assert.deepEqual(r.problems.map((p) => [p.row, p.code]), [[2, 'WRONG_FIELD_COUNT']]);
  assert.equal(r.students.length, 1);
});

test('row numbers are file line numbers, counting blank lines and multi-line quoted fields', () => {
  const r = run([HEADER, '', `STU1,"Aarav\nSharma",x,2012-03-14,9,B,1,2,3,4,5`, 'STU2,B Name,bad,2012-03-14,9,B,1,2,3,4,5']);
  assert.deepEqual(r.problems.map((p) => p.row), [3, 5]); // record spanning lines 3-4 is reported at line 3
});

test('header: any order and case, BOM, CRLF, extra columns ignored', () => {
  const header = '﻿ Section ,EMAIL,student_id,full_name,date_of_birth,grade_level,maths,science,english,social_studies,second_language,parent_phone';
  const r = validateCsv(Buffer.from(`${header}\r\nb,a@example.edu,STU1,Aarav Sharma,2012-03-14,9,1,2,3,4,5,+91 99\r\n`), { today: TODAY });
  assert.equal(r.problems.length, 0);
  assert.equal(r.students[0].section, 'B');
});

test('bad files raise a FileError with a readable message', () => {
  const bad = [
    [Buffer.from(''), /empty/],
    [Buffer.from('name,age\nA,1'), /missing required columns: student_id/],
    [Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]), /binary/], // e.g. an .xlsx
    [Buffer.from([0x61, 0xff, 0xfe, 0x62]), /UTF-8/],
    [Buffer.from('﻿student_id,full_name', 'utf16le'), /UTF-16/], // Excel "Unicode Text" export
    [Buffer.from(`${HEADER}\nSTU1,"unclosed,a@b.c`), /could not be read/],
  ];
  for (const [buf, msg] of bad) assert.throws(() => validateCsv(buf), (e) => e instanceof FileError && msg.test(e.message));
});

test('grading: bands and pass requires every subject >= 35', () => {
  assert.equal(computeResult({ a: 80, b: 80, c: 80, d: 80, e: 80 }).grade, 'A');
  assert.equal(computeResult({ a: 79, b: 79, c: 79, d: 79, e: 79 }).grade, 'B');
  assert.equal(computeResult({ a: 34, b: 34, c: 34, d: 34, e: 34 }).grade, 'F');
  const r = computeResult({ a: 100, b: 100, c: 100, d: 100, e: 34.9 });
  assert.equal(r.grade, 'A');
  assert.equal(r.passed, false);
});

// The official sample pack is confidential and not committed; these run when it is present in ../data.
const DATA = path.join(import.meta.dirname, '..', '..', 'data');
for (const [file, read, imported, rejected] of [['students_small.csv', 25, 16, 9], ['students_sample.csv', 5000, 4685, 315]]) {
  const p = path.join(DATA, file);
  test(`sample pack ${file}: ${read} read / ${imported} imported / ${rejected} rejected`, { skip: !fs.existsSync(p) && 'data/ not present' }, () => {
    const r = validateCsv(fs.readFileSync(p), { today: TODAY });
    assert.deepEqual([r.rowsRead, r.students.length, r.rejectedRows], [read, imported, rejected]);
  });
}
