export default function PageHeader({ title, description, actions }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h1>{title}</h1>
        {description && <p className="mt-1.5 text-ink-2">{description}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
