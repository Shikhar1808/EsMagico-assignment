import Student from '../models/Student.js';
import { SUBJECTS } from '../helpers/csvValidator.js';
import { PASS_MARK } from '../helpers/grading.js';

const GRADES = ['A', 'B', 'C', 'D', 'F'];
const round1 = (n) => Math.round(n * 10) / 10;
const rate = (part, whole) => (whole ? round1((part / whole) * 100) : 0);

/** Everything the overview dashboard shows, computed in one aggregation. */
export async function getStats() {
  const [facets] = await Student.aggregate([
    {
      $facet: {
        summary: [
          {
            $group: {
              _id: null,
              students: { $sum: 1 },
              passed: { $sum: { $cond: ['$passed', 1, 0] } },
              avg_percentage: { $avg: '$percentage' },
              classes: { $addToSet: '$grade_level' },
            },
          },
        ],
        grades: [{ $group: { _id: '$grade', students: { $sum: 1 } } }],
        classes: [
          {
            $group: {
              _id: '$grade_level',
              students: { $sum: 1 },
              passed: { $sum: { $cond: ['$passed', 1, 0] } },
              avg_percentage: { $avg: '$percentage' },
            },
          },
          { $sort: { _id: 1 } },
        ],
        subjects: [
          {
            $group: Object.fromEntries([
              ['_id', null],
              ...SUBJECTS.flatMap((s) => [
                [`${s}_avg`, { $avg: `$marks.${s}` }],
                [`${s}_below`, { $sum: { $cond: [{ $lt: [`$marks.${s}`, PASS_MARK] }, 1, 0] } }],
              ]),
            ]),
          },
        ],
      },
    },
  ]);
  return shapeStats(facets);
}

/** Turn the raw $facet output into the API shape. Exported for tests. */
export function shapeStats({ summary, grades, classes, subjects }) {
  const s = summary[0];
  if (!s) return { students: 0, passed: 0, pass_rate: 0, avg_percentage: 0, classes: 0, grades: [], by_class: [], subjects: [] };

  const gradeCount = Object.fromEntries(grades.map((g) => [g._id, g.students]));
  return {
    students: s.students,
    passed: s.passed,
    pass_rate: rate(s.passed, s.students),
    avg_percentage: round1(s.avg_percentage),
    classes: s.classes.length,
    grades: GRADES.map((grade) => ({ grade, students: gradeCount[grade] || 0 })),
    by_class: classes.map((c) => ({
      grade_level: c._id,
      students: c.students,
      pass_rate: rate(c.passed, c.students),
      avg_percentage: round1(c.avg_percentage),
    })),
    subjects: SUBJECTS.map((key) => ({
      subject: key,
      avg_mark: round1(subjects[0][`${key}_avg`]),
      below_pass: subjects[0][`${key}_below`],
    })),
  };
}
