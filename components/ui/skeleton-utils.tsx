// lib/components/skeleton.tsx — komponen skeleton yang dipakai ulang
// Salin ke: components/ui/skeleton-utils.tsx

export function SkeletonBlock({
  className = "",
}: {
  className?: string
}) {
  return (
    <div
      className={`animate-pulse rounded-md bg-slate-200 dark:bg-slate-700 ${className}`}
    />
  )
}

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
      <SkeletonBlock className="h-4 w-1/3" />
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonBlock key={i} className="h-3 w-full" />
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="flex gap-4 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonBlock key={i} className={`h-3 ${i === 0 ? "w-8" : i === 1 ? "w-32" : "flex-1"}`} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, row) => (
        <div
          key={row}
          className="flex gap-4 px-4 py-3 border-b border-slate-100 dark:border-slate-800/50 last:border-0"
        >
          {Array.from({ length: cols }).map((_, col) => (
            <SkeletonBlock
              key={col}
              className={`h-3 ${col === 0 ? "w-8" : col === 1 ? "w-28" : "flex-1"}`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonStatCards({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-${count} gap-3`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="h-9 w-9 rounded-lg" />
          </div>
          <SkeletonBlock className="h-7 w-16" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonPageHeader() {
  return (
    <div className="space-y-2">
      <SkeletonBlock className="h-8 w-48" />
      <SkeletonBlock className="h-4 w-72" />
    </div>
  )
}