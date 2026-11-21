import test from 'node:test';
import assert from 'node:assert/strict';
import { shapeStats } from '../src/services/stats.service.js';

const subjects = (avg, below) => [{
  _id: null,
  maths_avg: avg, maths_below: below, science_avg: avg, science_below: 0, english_avg: avg, english_below: 0,
  social_studies_avg: avg, social_studies_below: 0, second_language_avg: avg, second_language_below: 0,
}];

test('empty database gives zeros, not NaN or a crash', () => {
  const s = shapeStats({ summary: [], grades: [], classes: [], subjects: [] });
  assert.deepEqual([s.students, s.pass_rate, s.grades, s.by_class], [0, 0, [], []]);
});

test('rates are rounded to one decimal and every grade appears, even with 0 students', () => {
  const s = shapeStats({
    summary: [{ students: 3, passed: 2, avg_percentage: 61.234, classes: [9, 10] }],
    grades: [{ _id: 'B', students: 2 }, { _id: 'F', students: 1 }],
    classes: [{ _id: 9, students: 2, passed: 2, avg_percentage: 70 }, { _id: 10, students: 1, passed: 0, avg_percentage: 30 }],
    subjects: subjects(55.55, 1),
  });
  assert.equal(s.pass_rate, 66.7);
  assert.equal(s.avg_percentage, 61.2);
  assert.equal(s.classes, 2);
  assert.deepEqual(s.grades.map((g) => `${g.grade}:${g.students}`), ['A:0', 'B:2', 'C:0', 'D:0', 'F:1']);
  assert.deepEqual(s.by_class.map((c) => [c.grade_level, c.pass_rate]), [[9, 100], [10, 0]]);
  assert.deepEqual(s.subjects[0], { subject: 'maths', avg_mark: 55.6, below_pass: 1 });
});
