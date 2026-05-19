import {
  SkeletonPageHeader,
  SkeletonStatCards,
  SkeletonTable,
  SkeletonBlock,
} from "@/components/ui/skeleton-utils"

// Loading default untuk semua halaman di (dashboard)
// Ditimpa oleh loading.tsx yang lebih spesifik di sub-folder
export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonStatCards count={4} />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <SkeletonBlock className="h-4 w-40" />
          <SkeletonBlock className="h-56 w-full rounded-lg" />
        </div>
        <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <SkeletonBlock className="h-4 w-32" />
          <SkeletonBlock className="h-44 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}