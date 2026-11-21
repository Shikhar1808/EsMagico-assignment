#!/usr/bin/env node
// Generate a realistic messy student CSV and optionally upload it to a running portal.
//
//   node scripts/seed.js                         -> writes <tmp>/seed.csv (5000 rows, ~7% messy)
//   node scripts/seed.js --rows 200 --messy 0.2 --out my.csv --seed 42
//   node scripts/seed.js --upload [--url http://localhost:8080]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    rows: { type: 'string', default: '5000' },
    messy: { type: 'string', default: '0.07' },
    seed: { type: 'string' },
    // Temp dir by default: the Docker image's app folder is read-only for the "node" user.
    out: { type: 'string', default: path.join(os.tmpdir(), 'seed.csv') },
    upload: { type: 'boolean', default: false },
    url: { type: 'string', default: 'http://localhost:8080' },
  },
});
const ROWS = +args.rows;
const MESSY = +args.messy;
const OUT = args.out;
if (!(ROWS > 0) || !(MESSY >= 0 && MESSY <= 1)) {
  console.error('--rows must be a positive number and --messy between 0 and 1.');
  process.exit(1);
}

// Small seeded PRNG so a given --seed always produces the same file.
let state = +(args.seed || Date.now()) >>> 0;
const rand = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = (a) => a[Math.floor(rand() * a.length)];
const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

const FIRST = ['Aarav', 'Ananya', 'Rohan', 'Sneha', 'Ishaan', 'Kavya', 'Zoë', 'José', 'Müller', 'Ira', 'Farhan', 'Riya', 'Daniel', 'Lakshmi'];
const LAST = ['Sharma', 'Kaur', 'Menon', 'Patel', "D'Souza", 'Iyer', 'Banerjee', 'Shetty', 'Khan', 'Reddy'];
const SUBJECTS = ['maths', 'science', 'english', 'social_studies', 'second_language'];
const HEADER = ['student_id', 'full_name', 'email', 'date_of_birth', 'grade_level', 'section', ...SUBJECTS, 'parent_phone'];
const pad = (n, w = 2) => String(n).padStart(w, '0');
const csvCell = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

function cleanRow(i) {
  const grade = int(1, 12);
  const year = new Date().getFullYear() - grade - 5;
  const [first, last] = [pick(FIRST), pick(LAST)];
  const dob = [year, pad(int(1, 12)), pad(int(1, 28))];
  const ability = int(25, 95);
  const mark = () => {
    const m = Math.min(100, Math.max(0, ability + int(-15, 15)));
    return rand() < 0.3 ? `${m}.${int(0, 9)}`.replace(/^100\.\d/, '100.0') : String(m);
  };
  return {
    student_id: `STU${pad(i, 5)}`,
    full_name: rand() < 0.03 ? `${last}, ${first}` : `${first} ${last}`,
    email: `${first}.${last}${int(10, 99)}@example.edu`.toLowerCase().normalize('NFD').replace(/[^\x00-\x7f]|'/g, ''),
    date_of_birth: rand() < 0.25 ? `${dob[2]}/${dob[1]}/${dob[0]}` : dob.join('-'),
    grade_level: String(grade),
    section: pick('ABCDEF'),
    ...Object.fromEntries(SUBJECTS.map((s) => [s, mark()])),
    parent_phone: `+91 9${int(100000000, 999999999)}`,
  };
}

// Each mess returns the row (mutated) or a raw line string.
const MESSES = [
  (r) => { r[pick(['full_name', 'email', 'section', pick(SUBJECTS)])] = ''; return r; },
  (r) => { r.email = pick(['not-an-email', 'diya@', 'kabir at example.edu', 'riya@@example.edu', 'sana@example']); return r; },
  (r) => { r.date_of_birth = pick(['tomorrow', '31/02/2012', '11-30-2010', '14.03.2011', '1970-01-01', '2031-05-01']); return r; },
  (r) => { r.grade_level = pick(['IX', 'ten', '9th', '-2', '13', '0']); return r; },
  (r) => { r.section = pick(['G', 'Z', 'AB', '1']); return r; },
  (r) => { r[pick(SUBJECTS)] = pick(['N/A', 'eighty', 'abc', '82/100', '1e3', '-5', '105', '100.5']); return r; },
  (r) => Object.values(r).slice(0, -2).join(','), // wrong field count (too few)
  (r) => Object.values(r).map(csvCell).join(',') + ',extra', // wrong field count (too many)
  // Valid but messy: whitespace, case — these should be accepted.
  (r) => ({ ...r, full_name: `   ${r.full_name} `, email: `  ${r.email.toUpperCase()} `, section: `  ${r.section.toLowerCase()} ` }),
];

const lines = [HEADER.join(',')];
const ids = [];
for (let i = 1; i <= ROWS; i++) {
  let r = cleanRow(i);
  if (rand() < MESSY) r = pick(MESSES)(r);
  if (typeof r !== 'string' && rand() < MESSY / 5 && ids.length) r.student_id = pick(ids).toLowerCase(); // duplicate ID
  if (typeof r !== 'string') { ids.push(r.student_id); r = HEADER.map((h) => csvCell(r[h])).join(','); }
  lines.push(r);
  if (rand() < MESSY / 10) lines.push(pick(['', '   ', ','.repeat(HEADER.length - 1)])); // skipped blank-ish lines
}
// BOM + CRLF, like an Excel export.
fs.writeFileSync(OUT, '﻿' + lines.join('\r\n') + '\r\n');
console.log(`Wrote ${ROWS} rows to ${OUT}`);

if (args.upload) {
  const base = args.url;
  (async () => {
    const fd = new FormData();
    fd.append('file', new Blob([fs.readFileSync(OUT)]), path.basename(OUT));
    const res = await fetch(`${base}/api/imports`, { method: 'POST', body: fd });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error);
    const { problems, ...summary } = body;
    console.log({ ...summary, problems: problems.length });
  })().catch((e) => { console.error('Upload failed:', e.message); process.exit(1); });
}
