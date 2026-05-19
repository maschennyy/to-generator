import { SkeletonBlock, SkeletonTable } from "@/components/ui/skeleton-utils"

export default function PelangganDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <SkeletonBlock className="h-9 w-9 rounded-lg mt-1" />
          <div className="space-y-2">
            <SkeletonBlock className="h-7 w-56" />
            <SkeletonBlock className="h-4 w-36" />
          </div>
        </div>
        <SkeletonBlock className="h-9 w-20 rounded-md" />
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-start gap-3"
          >
            <SkeletonBlock className="h-8 w-8 rounded-md shrink-0" />
            <div className="space-y-1.5 flex-1">
              <SkeletonBlock className="h-3 w-12" />
              <SkeletonBlock className="h-4 w-full" />
            </div>
          </div>
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2"
          >
            <SkeletonBlock className="h-3 w-16" />
            <SkeletonBlock className="h-7 w-20" />
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
        <SkeletonBlock className="h-4 w-44" />
        <SkeletonBlock className="h-64 w-full rounded-lg" />
      </div>

      {/* TO history table */}
      <SkeletonTable rows={5} cols={6} />
    </div>
  )
}