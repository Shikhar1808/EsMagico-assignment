import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import PageHeader from '../components/PageHeader.jsx';
import { num } from '../labels.js';

export default function StudentsPage() {
  // All list state lives in the URL so back/forward and shared links work.
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const grade = params.get('grade_level') || '';
  const page = Math.max(+params.get('page') || 1, 1);
  const limit = +params.get('limit') || 25;

  const [search, setSearch] = useState(q);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) v ? next.set(k, v) : next.delete(k);
    setParams(next, { replace: 'q' in changes });
  };

  // Debounce typing into the URL.
  useEffect(() => {
    if (search === q) return;
    const t = setTimeout(() => update({ q: search.trim(), page: '' }), 300);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync box from URL (back button, Clear) without stripping a trailing space the user just typed.
  useEffect(() => {
    if (q !== search.trim()) setSearch(q);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  // A stale link past the last page: go back to page 1 instead of showing an empty table.
  useEffect(() => {
    if (data && data.items.length === 0 && data.total > 0 && page > 1) update({ page: '' });
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError('');
    const qs = new URLSearchParams({ q, grade_level: grade, page, limit });
    api(`/api/students?${qs}`, { signal: ctrl.signal })
      .then(setData)
      .catch((e) => e.name !== 'AbortError' && setError(e.message))
      .finally(() => !ctrl.signal.aborted && setLoading(false));
    return () => ctrl.abort();
  }, [q, grade, page, limit, retry]);

  const pages = data ? Math.max(Math.ceil(data.total / data.limit), 1) : 1;
  const filtered = q || grade;

  return (
    <>
      <PageHeader
        title="Students"
        description="Search by name or student ID, or narrow the list to one class."
        actions={<Link className="btn" to="/import">Import results</Link>}
      />

      <section className="panel">
        <div className="flex flex-wrap items-center gap-3 border-b border-rule px-5 py-3.5">
          <label className="relative min-w-0 flex-1 basis-64">
            <span className="sr-only">Search students</span>
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
            </svg>
            <input type="search" className="field w-full max-w-md pl-9" placeholder="Name or student ID" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-2">
            Class
            <select className="field" value={grade} onChange={(e) => update({ grade_level: e.target.value, page: '' })}>
              <option value="">All</option>
              {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
            </select>
          </label>
          {data && !error && (
            <p className="ml-auto flex items-center gap-2 text-sm text-ink-3" aria-live="polite">
              {loading && <span className="spinner text-brand" />}
              {data.total === 0 ? 'No students' : `${num((data.page - 1) * data.limit + 1)}–${num(Math.min(data.page * data.limit, data.total))} of ${num(data.total)}`}
            </p>
          )}
        </div>

        {error ? (
          <div className="px-6 py-14 text-center">
            <h2>The student list couldn't load</h2>
            <p className="mb-5 mt-1 text-ink-2">{error}</p>
            <button className="btn" onClick={() => setRetry((r) => r + 1)}>Try again</button>
          </div>
        ) : !data ? (
          <SkeletonRows />
        ) : data.total === 0 ? (
          filtered ? (
            <div className="px-6 py-14 text-center">
              <h2>No students match{q ? ` “${q}”` : ''}{grade ? ` in class ${grade}` : ''}</h2>
              <p className="mb-5 mt-1 text-ink-2">Check the spelling, or search by student ID instead.</p>
              <button className="btn" onClick={() => { setSearch(''); setParams({}); }}>Clear search</button>
            </div>
          ) : (
            <div className="px-6 py-14 text-center">
              <h2>No students yet</h2>
              <p className="mb-5 mt-1 text-ink-2">Import a CSV of results and the students appear here.</p>
              <Link className="btn btn-primary" to="/import">Import results</Link>
            </div>
          )
        ) : (
          <>
            <div className={`overflow-x-auto transition-opacity ${loading ? 'opacity-60' : ''}`}>
              <table className="data-table">
                <thead>
                  <tr><th>Student</th><th>ID</th><th className="num">Class</th><th>Score</th><th>Grade</th><th>Result</th></tr>
                </thead>
                <tbody>
                  {data.items.map((s) => (
                    <tr key={s.student_id} className="hover:bg-paper/70">
                      <td>
                        <Link className="font-semibold text-ink hover:text-brand hover:underline" to={`/students/${encodeURIComponent(s.student_id)}`}>{s.full_name}</Link>
                      </td>
                      <td className="tabular-nums text-ink-2">{s.student_id}</td>
                      <td className="num text-ink-2">{s.grade_level}{s.section}</td>
                      <td>
                        <span className="flex items-center gap-2.5">
                          <span className="h-1.5 w-20 rounded-full bg-paper" aria-hidden>
                            <span className={`block h-full rounded-full ${s.passed ? 'bg-brand' : 'bg-pen'}`} style={{ width: `${s.percentage}%` }} />
                          </span>
                          <span className="tabular-nums">{s.percentage.toFixed(1)}%</span>
                        </span>
                      </td>
                      <td className="font-semibold">{s.grade}</td>
                      <td><span className={`result ${s.passed ? 'result-pass' : 'result-fail'}`}>{s.passed ? 'Pass' : 'Fail'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-rule px-5 py-3">
              <button className="btn" disabled={page <= 1} onClick={() => update({ page: page - 1 })}>Previous</button>
              <span className="text-sm text-ink-2">Page {data.page} of {num(pages)}</span>
              <button className="btn" disabled={page >= pages} onClick={() => update({ page: page + 1 })}>Next</button>
              <label className="ml-auto flex items-center gap-2 text-sm text-ink-2">
                Rows per page
                <select className="field py-1.5" value={limit} onChange={(e) => update({ limit: e.target.value, page: '' })}>
                  {[25, 50, 100].map((n) => <option key={n}>{n}</option>)}
                </select>
              </label>
            </div>
          </>
        )}
      </section>
    </>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-3 p-5" aria-busy="true" aria-label="Loading students">
      {Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-5" />)}
    </div>
  );
}
