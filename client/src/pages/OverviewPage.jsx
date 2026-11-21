import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import PageHeader from '../components/PageHeader.jsx';
import { ChartPanel, ColumnChart, BarList } from '../components/charts.jsx';
import { SUBJECT_LABEL, num } from '../labels.js';

export default function OverviewPage() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setError('');
    api('/api/stats', { signal: ctrl.signal })
      .then(setStats)
      .catch((e) => e.name !== 'AbortError' && setError(e.message));
    return () => ctrl.abort();
  }, [retry]);

  const actions = (
    <>
      <Link className="btn" to="/students">Find a student</Link>
      <Link className="btn btn-primary" to="/import">Import results</Link>
    </>
  );

  if (error)
    return (
      <>
        <PageHeader title="Overview" actions={actions} />
        <div className="state">
          <h2>The overview couldn't load</h2>
          <p className="mb-5 mt-1 text-ink-2">{error}</p>
          <button className="btn" onClick={() => setRetry((r) => r + 1)}>Try again</button>
        </div>
      </>
    );

  if (!stats) return <OverviewSkeleton />;

  if (stats.students === 0)
    return (
      <>
        <PageHeader title="Overview" />
        <div className="state">
          <h2>No results yet</h2>
          <p className="mx-auto mb-5 mt-1 max-w-md text-ink-2">Import the CSV your teachers exported. Valid rows are added and every problem is listed so you can fix it.</p>
          <Link className="btn btn-primary" to="/import">Import results</Link>
        </div>
      </>
    );

  const failing = stats.students - stats.passed;
  const topGrade = stats.grades.reduce((a, b) => (b.students > a.students ? b : a));
  const weakest = stats.by_class.reduce((a, b) => (b.pass_rate < a.pass_rate ? b : a));

  return (
    <>
      <PageHeader
        title="Overview"
        description={`Term results for ${num(stats.students)} students across ${stats.classes} classes.`}
        actions={actions}
      />

      {/* Summary: one hero figure, three supporting ones, in a single panel. */}
      <section className="panel mb-6 grid sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]" aria-label="Summary">
        <div className="border-b border-rule p-6 sm:col-span-2 lg:col-span-1 lg:border-b-0 lg:border-r">
          <p className="text-sm text-ink-2">Pass rate</p>
          <p className="mt-1 text-5xl font-bold tracking-tight">{stats.pass_rate}%</p>
          <div className="mt-4 flex h-2 overflow-hidden rounded-full" role="img" aria-label={`${num(stats.passed)} passed, ${num(failing)} failed`}>
            <span className="bg-brand" style={{ width: `${stats.pass_rate}%` }} />
            <span className="ml-0.5 flex-1 bg-pen" />
          </div>
          <p className="mt-2 text-sm text-ink-2">{num(stats.passed)} passed, {num(failing)} failed</p>
        </div>
        <Figure label="Students" value={num(stats.students)} note={`${stats.classes} classes`} />
        <Figure label="Average score" value={`${stats.avg_percentage}%`} note="across all subjects" />
        <Figure label="Failed a subject" value={num(failing)} note="below 35 in at least one" tone="text-pen" last />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartPanel
          title="Grade distribution"
          subtitle={`Most students got ${topGrade.grade}`}
          table={{ columns: ['Grade', 'Students', 'Share'], rows: stats.grades.map((g) => [g.grade, num(g.students), `${share(g.students, stats.students)}%`]) }}
        >
          <ColumnChart
            ariaLabel="Students per grade"
            integer
            data={stats.grades.map((g) => ({
              key: g.grade,
              label: g.grade,
              title: `Grade ${g.grade}`,
              value: g.students,
              tip: `${num(g.students)} students, ${share(g.students, stats.students)}%`,
              capLabel: g.grade === topGrade.grade ? num(g.students) : null,
            }))}
            format={(v) => num(v)}
          />
        </ChartPanel>

        <ChartPanel
          title="Pass rate by class"
          subtitle={`Lowest is class ${weakest.grade_level} at ${weakest.pass_rate}%`}
          table={{
            columns: ['Class', 'Students', 'Pass rate', 'Average'],
            rows: stats.by_class.map((c) => [c.grade_level, num(c.students), `${c.pass_rate}%`, `${c.avg_percentage}%`]),
          }}
        >
          <ColumnChart
            ariaLabel="Pass rate per class"
            max={100}
            format={(v) => `${v}%`}
            data={stats.by_class.map((c) => ({
              key: c.grade_level,
              label: c.grade_level,
              title: `Class ${c.grade_level}`,
              value: c.pass_rate,
              tip: `${c.pass_rate}% passed, ${num(c.students)} students, average ${c.avg_percentage}%`,
              capLabel: c.grade_level === weakest.grade_level ? `${c.pass_rate}%` : null,
            }))}
          />
        </ChartPanel>

        <ChartPanel
          className="lg:col-span-2"
          title="Subject averages"
          subtitle="The black line is the pass mark of 35"
          table={{
            columns: ['Subject', 'Average mark', 'Below pass mark'],
            rows: stats.subjects.map((s) => [SUBJECT_LABEL[s.subject], s.avg_mark.toFixed(1), num(s.below_pass)]),
          }}
        >
          <BarList
            max={100}
            reference={35}
            referenceLabel="Pass mark: 35"
            tone={(d) => (d.value < 35 ? 'bg-pen' : 'bg-brand')}
            data={stats.subjects.map((s) => ({
              key: s.subject,
              label: SUBJECT_LABEL[s.subject],
              note: `${num(s.below_pass)} below pass mark`,
              value: s.avg_mark,
              valueLabel: s.avg_mark.toFixed(1),
              title: `${SUBJECT_LABEL[s.subject]}: average ${s.avg_mark}, ${num(s.below_pass)} students below 35`,
            }))}
          />
        </ChartPanel>
      </div>
    </>
  );
}

const share = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);

function Figure({ label, value, note, tone = '', last = false }) {
  return (
    <div className={`border-rule p-6 ${last ? '' : 'border-b sm:border-r lg:border-b-0'}`}>
      <p className="text-sm text-ink-2">{label}</p>
      <p className={`mt-1 text-3xl font-bold tracking-tight ${tone}`}>{value}</p>
      <p className="mt-1 text-sm text-ink-3">{note}</p>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading overview">
      <div className="skeleton mb-3 h-8 w-48" />
      <div className="skeleton mb-6 h-5 w-80" />
      <div className="skeleton mb-6 h-40" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="skeleton h-72" />
        <div className="skeleton h-72" />
      </div>
    </div>
  );
}
