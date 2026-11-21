// Pure CSV -> {students, problems} validation. No I/O, so it is easy to test.
import { parse } from 'csv-parse/sync';
import { computeResult } from './grading.js';
import { AppError } from './AppError.js';

export const SUBJECTS = ['maths', 'science', 'english', 'social_studies', 'second_language'];
export const REQUIRED = ['student_id', 'full_name', 'email', 'date_of_birth', 'grade_level', 'section', ...SUBJECTS];

const LABELS = {
  student_id: 'Student ID', full_name: 'Name', email: 'Email', date_of_birth: 'Date of birth',
  grade_level: 'Class', section: 'Section', maths: 'Maths', science: 'Science', english: 'English',
  social_studies: 'Social studies', second_language: 'Second language',
};

// A problem with the file as a whole (nothing is imported). Always 422 Unprocessable.
export class FileError extends AppError {
  constructor(code, message) {
    super(422, code, message);
    this.name = 'FileError';
  }
}

function ageOn(dob, today) {
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    today.getUTCMonth() < dob.getUTCMonth() ||
    (today.getUTCMonth() === dob.getUTCMonth() && today.getUTCDate() < dob.getUTCDate());
  return beforeBirthday ? age - 1 : age;
}

// Accepts YYYY-MM-DD or DD/MM/YYYY; returns a UTC Date or null if not a real date.
function parseDate(s) {
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  let y, mo, d;
  if (m) [, y, mo, d] = m;
  else if ((m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s))) [, d, mo, y] = m;
  else return null;
  const date = new Date(Date.UTC(+y, +mo - 1, +d));
  // Date silently rolls 31/02 into March; reject anything that rolled.
  if (date.getUTCFullYear() !== +y || date.getUTCMonth() !== +mo - 1 || date.getUTCDate() !== +d) return null;
  return date;
}

// Plain decimals only: "1e3", "0x10", "82/100", "eighty" are all rejected (Number() would accept the first two).
const NUMBER_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;
const ID_RE = /^[A-Z0-9-]{3,20}$/;
// Exported so the Student schema enforces the same rules instead of a copy.
export const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const NAME_RE = /^[\p{L}\p{M}' ’,.-]+$/u;
export const HAS_LETTER = /\p{L}/u; // rejects placeholders like "--" or "..."

function validateRow(get, today) {
  const errs = [];
  const err = (field, code, message) => errs.push({ field, code, message });
  const out = {};

  for (const f of REQUIRED) {
    if (!get(f)) err(f, 'MISSING_REQUIRED', `${LABELS[f]} is missing.`);
  }
  const missing = new Set(errs.map((e) => e.field));
  const has = (f) => !missing.has(f);

  if (has('student_id')) {
    out.student_id = get('student_id').toUpperCase();
    if (!ID_RE.test(out.student_id))
      err('student_id', 'INVALID_FORMAT', 'Student ID must be 3 to 20 letters, digits or hyphens.');
  }
  if (has('full_name')) {
    out.full_name = get('full_name').replace(/\s+/g, ' ');
    if (out.full_name.length < 2 || out.full_name.length > 100)
      err('full_name', 'OUT_OF_RANGE', 'Name must be 2 to 100 characters long.');
    else if (!NAME_RE.test(out.full_name))
      err('full_name', 'INVALID_FORMAT', 'Name may only contain letters, spaces, apostrophes, commas, hyphens and full stops.');
    else if (!HAS_LETTER.test(out.full_name))
      err('full_name', 'INVALID_FORMAT', `"${out.full_name}" is not a name. It must contain letters.`);
  }
  if (has('email')) {
    out.email = get('email').toLowerCase();
    if (!EMAIL_RE.test(out.email)) err('email', 'INVALID_FORMAT', 'Not a valid email address.');
  }
  if (has('date_of_birth')) {
    const dob = parseDate(get('date_of_birth'));
    if (!dob) err('date_of_birth', 'INVALID_FORMAT', 'Not a real date. Use YYYY-MM-DD or DD/MM/YYYY.');
    else {
      const age = ageOn(dob, today);
      if (age < 5 || age > 25)
        err('date_of_birth', 'OUT_OF_RANGE', `Student would be ${age} years old; expected 5 to 25.`);
      out.date_of_birth = dob.toISOString().slice(0, 10);
    }
  }
  if (has('grade_level')) {
    const v = get('grade_level');
    if (!/^[+-]?\d+$/.test(v)) err('grade_level', 'INVALID_FORMAT', 'Class must be a whole number such as 9 (not "IX" or "9th").');
    else if (+v < 1 || +v > 12) err('grade_level', 'OUT_OF_RANGE', 'Class must be between 1 and 12.');
    else out.grade_level = +v;
  }
  if (has('section')) {
    out.section = get('section').toUpperCase();
    if (!/^[A-F]$/.test(out.section)) err('section', 'INVALID_FORMAT', 'Section must be a single letter from A to F.');
  }
  out.marks = {};
  for (const s of SUBJECTS) {
    if (!has(s)) continue;
    const v = get(s);
    if (!NUMBER_RE.test(v)) err(s, 'INVALID_FORMAT', `${LABELS[s]} mark must be a number (got "${v}").`);
    else if (+v < 0 || +v > 100) err(s, 'OUT_OF_RANGE', `${LABELS[s]} mark ${v} is outside 0 to 100.`);
    else out.marks[s] = +v;
  }
  return { student: out, errs };
}

/**
 * @param {Buffer|string} input raw file contents
 * @param {{today?: Date}} opts today is injectable so age checks are testable
 * @returns {{rowsRead, students, problems, rejectedRows}}
 * @throws FileError for problems with the file as a whole
 */
export function validateCsv(input, { today = new Date() } = {}) {
  let text = input;
  if (Buffer.isBuffer(input)) {
    const bom = input.subarray(0, 2).toString('hex');
    if (bom === 'fffe' || bom === 'feff')
      throw new FileError('UTF16_FILE', 'This file is saved as UTF-16 ("Unicode Text"). In Excel use "Save As > CSV UTF-8" and try again.');
    if (input.includes(0)) throw new FileError('BINARY_FILE', 'This does not look like a CSV file (it contains binary data).');
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(input);
    } catch {
      throw new FileError('NOT_UTF8', 'The file is not UTF-8 text. In Excel use "Save As > CSV UTF-8" and try again.');
    }
  }
  const todayUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

  let records;
  try {
    records = parse(text, { bom: true, relax_column_count: true, relax_quotes: true, skip_empty_lines: true, info: true });
  } catch (e) {
    const line = e.lines ? ` near line ${e.lines}` : '';
    throw new FileError('MALFORMED_CSV', `The file could not be read as CSV${line} (often an unclosed quote mark).`);
  }
  if (records.length === 0) throw new FileError('EMPTY_FILE', 'The file is empty.');

  const header = records[0].record.map((h) => h.trim().toLowerCase());
  const missingCols = REQUIRED.filter((c) => !header.includes(c));
  if (missingCols.length)
    throw new FileError('MISSING_COLUMNS', `The header row is missing required columns: ${missingCols.join(', ')}.`);
  const index = Object.fromEntries(REQUIRED.map((c) => [c, header.indexOf(c)]));

  const seenIds = new Set();
  const students = [];
  const problems = [];
  let rowsRead = 0;
  let rejectedRows = 0;

  for (const { record, info } of records.slice(1)) {
    if (record.every((v) => v.trim() === '')) continue; // blank/all-empty rows are skipped, not counted
    rowsRead++;
    // info.lines is where the record ends; step back over newlines inside quoted fields.
    const row = info.lines - (record.join('').match(/\n/g) || []).length;
    const rawId = (record[index.student_id] || '').trim();

    if (record.length !== header.length) {
      problems.push({ row, student_id: rawId, field: '(whole row)', code: 'WRONG_FIELD_COUNT',
        message: `Expected ${header.length} values, found ${record.length}. Usually a stray or missing comma.` });
      rejectedRows++;
      continue;
    }

    const get = (f) => record[index[f]].trim();
    const { student, errs } = validateRow(get, todayUtc);

    // The first row with an ID claims it, even if that row is itself invalid.
    const key = rawId.toUpperCase();
    if (key) {
      if (seenIds.has(key)) errs.unshift({ field: 'student_id', code: 'DUPLICATE_ID',
        message: `${key} already appeared earlier in this file; only the first row is used.` });
      seenIds.add(key);
    }

    if (errs.length) {
      rejectedRows++;
      for (const e of errs) problems.push({ row, student_id: rawId, value: e.field in index ? get(e.field) : undefined, ...e });
    } else {
      students.push({ ...student, ...computeResult(student.marks) });
    }
  }

  return { rowsRead, students, problems, rejectedRows };
}

