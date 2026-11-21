import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import PageHeader from '../components/PageHeader.jsx';
import { FIELD_LABEL, num } from '../labels.js';

const PAGE = 50;
const REQUIRED = ['student_id', 'full_name', 'email', 'date_of_birth', 'grade_level', 'section', 'maths', 'science', 'english', 'social_studies', 'second_language'];
const PROBLEM_TYPES = {
  MISSING_REQUIRED: 'Missing value',
  INVALID_FORMAT: 'Wrong format',
  OUT_OF_RANGE: 'Out of range',
  DUPLICATE_ID: 'Duplicate student ID',
  WRONG_FIELD_COUNT: 'Wrong number of columns',
};

const size = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);

function downloadProblems(problems, fileName) {
  // Prefix cells that Excel would treat as formulas, since values come from the uploaded file.
  const cell = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [['row', 'student_id', 'field', 'value', 'code', 'problem'], ...problems.map((p) => [p.row, p.student_id, p.field, p.value, p.code, p.message])];
  const blob = new Blob(['﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: fileName.replace(/\.csv$/i, '') + '-problems.csv' });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export default function ImportPage() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | uploading | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const input = useRef();

  function choose(f) {
    if (!f) return;
    setResult(null);
    setError('');
    setStatus('idle');
    if (!/\.csv$/i.test(f.name)) {
      setFile(null);
      setError(`“${f.name}” is not a CSV file. In Excel, use Save As and choose “CSV UTF-8”.`);
      setStatus('error');
      return;
    }
    setFile(f);
  }

  async function submit() {
    setStatus('uploading');
    setResult(null); // a failed retry must not leave the previous run's numbers on screen
    setError('');
    const fd = new FormData();
    fd.append('file', file);
    try {
      setResult(await api('/api/imports', { method: 'POST', body: fd }));
      setStatus('done');
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  }

  return (
    <>
      <PageHeader
        title="Import results"
        description="Upload the CSV your teachers exported. Valid rows are added or updated; rows with problems are listed so you can fix them and upload again."
      />

      <div className="mb-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="panel p-5">
          <div
            className={`flex min-h-48 flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed px-4 text-center transition-colors ${
              dragging ? 'border-brand bg-brand-soft' : 'border-rule'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); choose(e.dataTransfer.files[0]); }}
          >
            <svg viewBox="0 0 24 24" className="size-8 text-ink-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" />
            </svg>
            {file ? (
              <p><strong>{file.name}</strong> <span className="text-ink-3">({size(file.size)})</span></p>
            ) : (
              <p className="text-ink-2">Drag a CSV file here, or</p>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" className="btn" onClick={() => input.current.click()}>{file ? 'Choose another file' : 'Choose file'}</button>
              {file && (
                <button className="btn btn-primary" disabled={status === 'uploading'} onClick={submit}>
                  {status === 'uploading' ? <><span className="spinner" /> Importing…</> : 'Import file'}
                </button>
              )}
            </div>
            <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(e) => { choose(e.target.files[0]); e.target.value = ''; }} />
          </div>
        </section>

        <section className="panel p-5 text-sm">
          <h2 className="mb-2">What the file needs</h2>
          <p className="mb-3 text-ink-2">A header row with these columns, in any order. Other columns are ignored. Up to 10 MB.</p>
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {REQUIRED.map((c) => <li key={c} className="rounded bg-paper px-2 py-0.5 text-ink-2">{FIELD_LABEL[c]}</li>)}
          </ul>
          <p className="mt-3 text-ink-3">Dates as YYYY-MM-DD or DD/MM/YYYY. Marks from 0 to 100.</p>
        </section>
      </div>

      {status === 'error' && (
        <div className="mb-6 rounded-lg border border-pen/30 bg-pen-soft px-5 py-4 text-pen" role="alert">
          <strong>Nothing was imported.</strong> {error}
        </div>
      )}

      {result && <ImportResult result={result} />}
    </>
  );
}

function ImportResult({ result }) {
  const [type, setType] = useState('');
  const [shown, setShown] = useState(PAGE);
  const byType = useMemo(() => {
    const counts = {};
    for (const p of result.problems) counts[p.code] = (counts[p.code] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [result]);
  const visible = type ? result.problems.filter((p) => p.code === type) : result.problems;
  const maxCount = byType[0]?.[1] || 1;
  const sameFile = result.unchanged > 0 && result.created === 0 && result.updated === 0;

  return (
    <>
      <section className="panel mb-6 grid sm:grid-cols-3" aria-label="Import summary">
        <div className="border-b border-rule p-6 sm:border-b-0 sm:border-r">
          <p className="text-sm text-ink-2">Rows read</p>
          <p className="mt-1 text-3xl font-bold">{num(result.rows_read)}</p>
          <p className="mt-1 truncate text-sm text-ink-3" title={result.file_name}>{result.file_name}</p>
        </div>
        <div className="border-b border-rule p-6 sm:border-b-0 sm:border-r">
          <p className="text-sm text-ink-2">Imported</p>
          <p className="mt-1 text-3xl font-bold text-pass">{num(result.imported)}</p>
          <p className="mt-1 text-sm text-ink-3">{num(result.created)} new, {num(result.updated)} updated, {num(result.unchanged)} unchanged</p>
        </div>
        <div className="p-6">
          <p className="text-sm text-ink-2">Rejected</p>
          <p className={`mt-1 text-3xl font-bold ${result.rejected ? 'text-pen' : ''}`}>{num(result.rejected)}</p>
          <p className="mt-1 text-sm text-ink-3">{result.rejected ? `${num(result.problems.length)} problems to fix` : 'Every row was valid'}</p>
        </div>
      </section>

      {sameFile && (
        <p className="mb-6 rounded-lg bg-brand-soft px-5 py-3.5 text-sm">
          Every valid row matches what is already stored, so this file was probably imported before. Nothing changed.
        </p>
      )}

      {result.problems.length === 0 ? (
        <div className="state">
          <h2>No problems found</h2>
          <p className="mb-5 mt-1 text-ink-2">All {num(result.imported)} rows are in.</p>
          <Link className="btn btn-primary" to="/students">View students</Link>
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[18rem_1fr]">
          <section className="panel">
            <div className="panel-head"><h2>Problems by type</h2></div>
            <ul className="m-0 list-none space-y-1 p-3">
              {byType.map(([code, count]) => (
                <li key={code}>
                  <button
                    type="button"
                    aria-pressed={type === code}
                    onClick={() => { setType(type === code ? '' : code); setShown(PAGE); }}
                    className={`w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm transition-colors ${type === code ? 'bg-pen-soft' : 'hover:bg-paper'}`}
                  >
                    <span className="flex justify-between gap-2"><span>{PROBLEM_TYPES[code] || code}</span><span className="font-semibold tabular-nums">{num(count)}</span></span>
                    <span className="mt-1.5 block h-1.5 rounded-full bg-paper">
                      <span className="block h-full rounded-full bg-pen" style={{ width: `${(count / maxCount) * 100}%` }} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel min-w-0">
            <div className="panel-head">
              <div>
                <h2>{type ? PROBLEM_TYPES[type] : 'All problems'}</h2>
                <p className="mt-0.5 text-sm text-ink-3">Showing {num(Math.min(shown, visible.length))} of {num(visible.length)}. Row numbers match the lines in your file.</p>
              </div>
              <button className="btn" onClick={() => downloadProblems(result.problems, result.file_name)}>Download problem list</button>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th className="num">Row</th><th>Student ID</th><th>Field</th><th>Value</th><th>What's wrong</th></tr></thead>
                <tbody>
                  {visible.slice(0, shown).map((p, i) => (
                    <tr key={i}>
                      <td className="num text-ink-2">{p.row}</td>
                      <td className="tabular-nums">{p.student_id || <span className="text-ink-3">blank</span>}</td>
                      <td className="whitespace-nowrap">{FIELD_LABEL[p.field] || 'Whole row'}</td>
                      <td>{p.value === undefined ? '' : p.value === '' ? <span className="text-ink-3">blank</span> : <span className="red-pen">{p.value}</span>}</td>
                      <td className="min-w-64">{p.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {shown < visible.length && (
              <div className="border-t border-rule px-5 py-3">
                <button className="btn" onClick={() => setShown(shown + PAGE)}>Show {Math.min(PAGE, visible.length - shown)} more</button>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
