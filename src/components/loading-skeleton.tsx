export function PageLoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="page-header">
        <div className="w-full">
          <div className="h-5 w-48 rounded bg-slate-200" />
          <div className="mt-2 h-3 w-72 rounded bg-slate-100" />
        </div>
      </div>
      <div className="card">
        <div className="space-y-3">
          <div className="h-9 w-full rounded bg-slate-100" />
          <div className="h-9 w-full rounded bg-slate-100" />
          <div className="h-9 w-2/3 rounded bg-slate-100" />
        </div>
      </div>
      <div className="table-shell mt-6">
        <div className="space-y-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 w-full rounded bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function DashboardLoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="page-header">
        <div className="w-full">
          <div className="h-5 w-32 rounded bg-slate-200" />
          <div className="mt-2 h-3 w-56 rounded bg-slate-100" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="stat-card">
            <div className="h-3 w-24 rounded bg-slate-100" />
            <div className="mt-3 h-6 w-16 rounded bg-slate-200" />
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card">
            <div className="h-3 w-24 rounded bg-slate-100" />
            <div className="mt-3 h-6 w-16 rounded bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
