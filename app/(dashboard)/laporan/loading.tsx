import {
  SkeletonPageHeader,
  SkeletonStatCards,
  SkeletonBlock,
} from "@/components/ui/skeleton-utils"

export default function LaporanLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SkeletonPageHeader />
        <div className="flex gap-2">
          <SkeletonBlock className="h-9 w-32 rounded-md" />
          <SkeletonBlock className="h-9 w-32 rounded-md" />
        </div>
      </div>
      {/* Preset filter bar */}
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonBlock key={i} className="h-8 w-24 rounded-md" />
        ))}
      </div>
      <SkeletonStatCards count={4} />
      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <SkeletonBlock className="h-4 w-36" />
          <SkeletonBlock className="h-48 w-full rounded-lg" />
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <SkeletonBlock className="h-4 w-36" />
          <SkeletonBlock className="h-48 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}