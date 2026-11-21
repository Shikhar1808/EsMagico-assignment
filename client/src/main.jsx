import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom';
import OverviewPage from './pages/OverviewPage.jsx';
import ImportPage from './pages/ImportPage.jsx';
import StudentsPage from './pages/StudentsPage.jsx';
import StudentReport from './pages/StudentReport.jsx';
import './styles.css';

const NAV = [
  { to: '/', label: 'Overview', end: true, icon: 'M3 13h4v8H3zM10 8h4v13h-4zM17 3h4v18h-4z' },
  { to: '/students', label: 'Students', icon: 'M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21c0-4 3.6-6 8-6s8 2 8 6' },
  { to: '/import', label: 'Import results', icon: 'M12 3v12m0 0-4-4m4 4 4-4M4 17v3h16v-3' },
];

function Icon({ d }) {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

function Sidebar() {
  return (
    <aside className="no-print flex shrink-0 flex-col bg-sidebar text-white md:sticky md:top-0 md:h-screen md:w-60">
      <Link to="/" className="flex items-center gap-3 px-5 py-4 md:py-6">
        {/* Mark: a results register, three ruled lines with a tick. */}
        <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
          <rect width="32" height="32" rx="7" fill="#2445a8" />
          <path d="M9 11h9M9 16h9M9 21h6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          <path d="m19.5 20.5 2.2 2.2 4.3-5" stroke="#9fb5f0" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="leading-tight">
          <span className="block text-[0.95rem] font-bold">Results Portal</span>
          <span className="block text-xs text-white/55">Term results office</span>
        </span>
      </Link>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0" aria-label="Main">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `flex items-center gap-3 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-white/12 text-white' : 'text-white/65 hover:bg-white/6 hover:text-white'
              }`
            }
          >
            <Icon d={n.icon} />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

function App() {
  return (
    <div className="min-h-screen md:flex">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 pb-16 pt-6 sm:px-8 md:pt-8 print:p-0">
        <div className="mx-auto max-w-6xl">
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/students" element={<StudentsPage />} />
            <Route path="/students/:id" element={<StudentReport />} />
            <Route path="*" element={<div className="state"><h2 className="mb-3">Page not found</h2><Link className="btn" to="/">Go to overview</Link></div>} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter><App /></BrowserRouter>
  </React.StrictMode>,
);
