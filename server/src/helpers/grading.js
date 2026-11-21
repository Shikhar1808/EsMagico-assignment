// Grading scheme (also documented in NOTES.md):
//   A >= 80%, B >= 65%, C >= 50%, D >= 35%, F below 35%.
//   Pass = at least 35 in EVERY subject (a strong average cannot hide a failed subject).
export const PASS_MARK = 35;
const BANDS = [[80, 'A'], [65, 'B'], [50, 'C'], [35, 'D'], [0, 'F']];

export function computeResult(marks) {
  const values = Object.values(marks);
  const total = Math.round(values.reduce((a, b) => a + b, 0) * 10) / 10;
  const max = values.length * 100;
  const percentage = Math.round((total / max) * 1000) / 10;
  const grade = BANDS.find(([min]) => percentage >= min)[1];
  const passed = values.every((v) => v >= PASS_MARK);
  return { total, max_total: max, percentage, grade, passed, pass_mark: PASS_MARK };
}

