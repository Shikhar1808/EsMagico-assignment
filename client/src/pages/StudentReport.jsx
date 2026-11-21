import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { SUBJECTS } from '../labels.js';

const formatDate = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** The grade circled the way a teacher marks a paper: blue ink for a pass, red pen for a fail. */
function CircledGrade({ grade, passed }) {
  const ink = passed ? 'var(--color-brand)' : 'var(--color-pen)';
  return (
    <div className="relative grid size-28 shrink-0 place-items-center" role="img" aria-label={`Grade ${grade}`}>
      <span className="text-6xl font-extrabold leading-none" style={{ color: ink }} aria-hidden>{grade}</span>
      <svg viewBox="0 0 120 120" className="absolute inset-0 size-full -rotate-6 overflow-visible" fill="none" aria-hidden>
        {/* Slightly uneven loop that overshoots its start, like a pen stroke. */}
        <path
          className="pen-stroke"
          d="M64 12C34 10 13 31 14 60c1 30 24 49 51 47 28-2 44-24 42-50C105 30 86 13 58 15c-9 1-15 3-20 7"
          stroke={ink}
          strokeWidth="3.2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export default function StudentReport() {
  const { id } = useParams();
  const [s, setS] = useState(null);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setS(null);
    setError(null);
    api(`/api/students/${encodeURIComponent(id)}`, { signal: ctrl.signal })
      .then(setS)
      .catch((e) => e.name !== 'AbortError' && setError(e));
    return () => ctrl.abort();
  }, [id, retry]);

  const back = <Link to="/students" className="no-print mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">Back to students</Link>;

  if (error?.status === 404)
    return (
      <>{back}
        <div className="state">
          <h2>Student not found</h2>
          <p className="mx-auto mb-5 mt-1 max-w-md text-ink-2">No student has the ID <strong>{id}</strong>. They may not have been imported yet, or their row was rejected.</p>
          <Link className="btn" to="/students">Search students</Link>
        </div>
      </>
    );
  if (error)
    return (
      <>{back}
        <div className="state">
          <h2>This report couldn't load</h2>
          <p className="mb-5 mt-1 text-ink-2">{error.message}</p>
          <button className="btn" onClick={() => setRetry((r) => r + 1)}>Try again</button>
        </div>
      </>
    );
  if (!s)
    return (
      <>{back}
        <div className="skeleton mb-6 h-44" aria-busy="true" aria-label="Loading report" />
        <div className="skeleton h-72" />
      </>
    );

  const failed = SUBJECTS.filter(([key]) => s.marks[key] < s.pass_mark).map(([, label]) => label);

  return (
    <>
      {back}
      <article className="panel overflow-hidden">
        <header className="flex flex-wrap items-center gap-x-10 gap-y-6 border-b border-rule p-6 sm:p-8">
          <div className="min-w-0 flex-1 basis-72">
            <p className="text-sm text-ink-3">Term report</p>
            <h1 className="mt-1 text-3xl">{s.full_name}</h1>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
              <dt className="text-ink-3">Student ID</dt><dd className="m-0 tabular-nums">{s.student_id}</dd>
              <dt className="text-ink-3">Class</dt><dd className="m-0">{s.grade_level}, section {s.section}</dd>
              <dt className="text-ink-3">Date of birth</dt><dd className="m-0">{formatDate(s.date_of_birth)}</dd>
              <dt className="text-ink-3">Email</dt><dd className="m-0 break-all">{s.email}</dd>
            </dl>
          </div>

          <div className="flex items-center gap-6">
            <CircledGrade grade={s.grade} passed={s.passed} />
            <div>
              <p className="text-4xl font-bold tracking-tight">{s.percentage.toFixed(1)}%</p>
              <p className="mt-1 text-sm text-ink-2">{s.total} of {s.max_total} marks</p>
              <p className={`mt-3 text-sm font-semibold ${s.passed ? 'text-pass' : 'text-pen'}`}>
                {s.passed ? 'Passed every subject' : `Failed ${new Intl.ListFormat('en', { type: 'conjunction' }).format(failed)}`}
              </p>
            </div>
          </div>
        </header>

        <div className="p-6 sm:p-8">
          <h2 className="mb-4">Marks by subject</h2>
          <table className="data-table">
            <thead>
              <tr><th>Subject</th><th className="num">Mark</th><th className="hidden w-1/2 sm:table-cell"><span className="sr-only">Mark out of 100, with the pass mark</span></th></tr>
            </thead>
            <tbody>
              {SUBJECTS.map(([key, label]) => {
                const m = s.marks[key];
                const low = m < s.pass_mark;
                return (
                  <tr key={key}>
                    <td>{label}</td>
                    <td className={`num font-semibold ${low ? 'text-pen' : ''}`}>
                      {low ? <span className="red-pen">{m}</span> : m}
                      <span className="sr-only">{low ? ', below the pass mark' : ''}</span>
                    </td>
                    <td className="hidden sm:table-cell">
                      <span className="relative block h-2 rounded-full bg-paper">
                        <span className={`absolute inset-y-0 left-0 rounded-full ${low ? 'bg-pen' : 'bg-brand'}`} style={{ width: `${m}%` }} />
                        <span className="absolute -inset-y-1 w-px bg-ink" style={{ left: `${s.pass_mark}%` }} title={`Pass mark: ${s.pass_mark}`} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold"><td className="border-t border-rule px-4 py-2.5">Total</td><td className="num border-t border-rule px-4 py-2.5">{s.total} / {s.max_total}</td><td className="hidden border-t border-rule sm:table-cell" /></tr>
            </tfoot>
          </table>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-rule bg-paper/50 px-6 py-4 sm:px-8">
          <p className="text-sm text-ink-3">Grades: A from 80%, B from 65%, C from 50%, D from 35%. A pass needs at least {s.pass_mark} in every subject. The black line on each bar is the pass mark.</p>
          <button className="btn no-print" onClick={() => window.print()}>Print report</button>
        </footer>
      </article>
    </>
  );
}
