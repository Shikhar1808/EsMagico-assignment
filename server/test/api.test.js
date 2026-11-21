// HTTP-level tests. The Student model's methods are swapped for an in-memory stand-in
// (node:test mock.method), so no MongoDB is needed.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import mongoose from 'mongoose';
import app from '../src/app.js';
import Student from '../src/models/Student.js';

const { MongoNetworkError, MongoServerError } = mongoose.mongo;

/** In-memory version of the Student methods the services call. */
function fakeStudents() {
  const docs = new Map();
  // Supports only the filter shapes student.service builds: {$or: [{field: RegExp}]} and {grade_level}.
  const match = (f) => [...docs.values()].filter((d) =>
    (!f.$or || f.$or.some((c) => Object.entries(c).some(([k, rx]) => rx.test(d[k])))) &&
    (!f.grade_level || d.grade_level === f.grade_level));
  return {
    docs,
    async bulkWrite(ops) {
      let upsertedCount = 0, modifiedCount = 0;
      for (const { updateOne: { filter, update } } of ops) {
        const cur = docs.get(filter.student_id);
        if (!cur) { docs.set(filter.student_id, { ...update.$set }); upsertedCount++; }
        else if (Object.entries(update.$set).some(([k, v]) => !isDeepStrictEqual(cur[k], v))) {
          Object.assign(cur, update.$set); modifiedCount++;
        }
      }
      return { upsertedCount, modifiedCount };
    },
    find(f) {
      let out = match(f);
      const query = {
        sort: () => query,
        skip: (n) => ((out = out.slice(n)), query),
        limit: (n) => ((out = out.slice(0, n)), query),
        lean: async () => out,
      };
      return query;
    },
    async countDocuments(f) { return match(f).length; },
    findOne(f) { return { lean: async () => docs.get(f.student_id) || null }; },
  };
}

/** A stand-in whose every read/write throws the given error. */
function brokenStudents(err) {
  const fail = () => { throw err; };
  return { bulkWrite: fail, find: fail, countDocuments: fail, findOne: fail };
}

async function withServer(fn, db = fakeStudents()) {
  for (const name of ['bulkWrite', 'find', 'countDocuments', 'findOne']) mock.method(Student, name, db[name]);
  const server = app.listen(0);
  const url = `http://localhost:${server.address().port}`;
  const upload = (text, name = 'x.csv') => {
    const fd = new FormData();
    fd.append('file', new Blob([text]), name);
    return fetch(url + '/api/imports', { method: 'POST', body: fd });
  };
  try { await fn({ upload, db, url }); } finally { server.close(); mock.restoreAll(); }
}

const statusAndCode = async (res) => [res.status, (await res.json()).code];

const HEADER = 'student_id,full_name,email,date_of_birth,grade_level,section,maths,science,english,social_studies,second_language';
const row = (id, maths = 50) => `${id},Aarav Sharma,a@example.edu,2012-03-14,9,B,${maths},50,50,50,50`;

test('re-uploading the same file creates nothing new; a changed mark counts as updated', () =>
  withServer(async ({ upload, db }) => {
    let r = await (await upload([HEADER, row('S01'), row('S02')].join('\n'))).json();
    assert.deepEqual([r.created, r.updated, r.unchanged], [2, 0, 0]);
    r = await (await upload([HEADER, row('S01'), row('S02')].join('\n'))).json();
    assert.deepEqual([r.created, r.updated, r.unchanged], [0, 0, 2]);
    r = await (await upload([HEADER, row('s01', 90), row('S03')].join('\n'))).json();
    assert.deepEqual([r.created, r.updated, r.unchanged], [1, 1, 0]);
    assert.equal(db.docs.get('S01').marks.maths, 90);
    assert.equal(db.docs.size, 3);
  }));

test('bad files get a 4xx with a readable message, and the server keeps serving', () =>
  withServer(async ({ upload, url }) => {
    // Every kind of bad file is covered in validate.test.js; here we only check it maps to 422.
    assert.deepEqual(await statusAndCode(await upload('not,a,csv\n1,2,3')), [422, 'MISSING_COLUMNS']);
    const none = await fetch(url + '/api/imports', { method: 'POST' });
    assert.deepEqual(await statusAndCode(none), [400, 'NO_FILE']);
    const fd = new FormData();
    fd.append('upload', new Blob(['x']), 'x.csv'); // wrong form field name
    const wrong = await fetch(url + '/api/imports', { method: 'POST', body: fd });
    assert.deepEqual(await statusAndCode(wrong), [400, 'INVALID_UPLOAD']);
    const ok = await upload([HEADER, row('S01')].join('\n'));
    assert.equal(ok.status, 200);
  }));

test('oversized upload is refused with 413', () =>
  withServer(async ({ upload }) => {
    const res = await upload('x'.repeat(11 * 1024 * 1024));
    assert.deepEqual(await statusAndCode(res), [413, 'FILE_TOO_LARGE']);
  }));

test('search treats regex characters literally and the page size is capped', () =>
  withServer(async ({ upload, url }) => {
    await upload([HEADER, row('S01'), row('S02')].join('\n'));
    const get = async (qs) => { const r = await fetch(`${url}/api/students?${qs}`); return [r.status, await r.json()]; };

    let [status, body] = await get('q=(');
    assert.equal(status, 200); // unescaped, "(" is an invalid RegExp and would 500
    assert.equal(body.total, 0);

    [, body] = await get('q=s0');
    assert.equal(body.total, 2); // case-insensitive ID match

    [, body] = await get('q=.*');
    assert.equal(body.total, 0); // ".*" is text, not "match everything"

    [, body] = await get('limit=5000&page=abc');
    assert.deepEqual([body.limit, body.page], [100, 1]);
  }));

test('client mistakes get specific 4xx codes, not 500', () =>
  withServer(async ({ url }) => {
    assert.deepEqual(await statusAndCode(await fetch(`${url}/api/students/nope`)), [404, 'STUDENT_NOT_FOUND']);
    assert.deepEqual(await statusAndCode(await fetch(`${url}/api/nothing-here`)), [404, 'NOT_FOUND']);
    // Malformed percent-encoding: Express raises a 400 http-error, which used to come out as 500.
    assert.deepEqual(await statusAndCode(await fetch(`${url}/api/students/%E0%A4%A`)), [400, 'BAD_REQUEST']);
  }));

test('database down -> 503 with Retry-After', () =>
  withServer(async ({ url }) => {
    const res = await fetch(`${url}/api/students`);
    assert.equal(res.headers.get('retry-after'), '5');
    assert.deepEqual(await statusAndCode(res), [503, 'DB_UNAVAILABLE']);
  }, brokenStudents(new MongoNetworkError('connection refused'))));

// Seen against real MongoDB: bulkWrite wraps "getaddrinfo ENOTFOUND" in MongoBulkWriteError (was a 500).
// Tests never connect Mongoose, so its connection state is "disconnected", as it is during an outage.
test('import while DB is down -> 503 even when the driver wraps the network error', () =>
  withServer(async ({ upload }) => {
    assert.deepEqual(await statusAndCode(await upload([HEADER, row('S01')].join('\n'))), [503, 'DB_UNAVAILABLE']);
  }, brokenStudents(new mongoose.mongo.MongoBulkWriteError({ message: 'getaddrinfo ENOTFOUND mongo' }, {}))));

test('duplicate key from Mongo -> 409', () =>
  withServer(async ({ upload }) => {
    assert.deepEqual(await statusAndCode(await upload([HEADER, row('S01')].join('\n'))), [409, 'DUPLICATE_KEY']);
  }, brokenStudents(new MongoServerError({ code: 11000, errmsg: 'E11000 duplicate key' }))));

test('unexpected errors -> generic 500 that does not leak internals', () =>
  withServer(async ({ url }) => {
    const orig = console.error;
    console.error = () => {}; // the handler logs 500s; keep test output clean
    try {
      const res = await fetch(`${url}/api/students/S01`);
      const body = await res.json();
      assert.deepEqual([res.status, body.code], [500, 'INTERNAL_ERROR']);
      assert.doesNotMatch(body.error, /secret/);
    } finally { console.error = orig; }
  }, brokenStudents(new Error('secret connection string mongodb://admin:pw@db'))));
