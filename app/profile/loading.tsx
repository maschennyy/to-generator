import { SkeletonBlock, SkeletonCard } from "@/components/ui/skeleton-utils"

export default function ProfileLoading() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="space-y-2">
        <SkeletonBlock className="h-8 w-40" />
        <SkeletonBlock className="h-4 w-64" />
      </div>

      {/* Info akun card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <SkeletonBlock className="h-4 w-32" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5">
              <SkeletonBlock className="h-3 w-20" />
              <SkeletonBlock className="h-10 w-full rounded-md" />
            </div>
          ))}
        </div>
      </div>

      {/* Data diri card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <SkeletonBlock className="h-4 w-24" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1.5">
              <SkeletonBlock className="h-3 w-24" />
              <SkeletonBlock className="h-10 w-full rounded-md" />
            </div>
          ))}
        </div>
        <div className="flex justify-end pt-2">
          <SkeletonBlock className="h-9 w-36 rounded-md" />
        </div>
      </div>

      {/* Password card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <SkeletonBlock className="h-4 w-28" />
        <SkeletonBlock className="h-10 w-full rounded-md" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SkeletonBlock className="h-10 w-full rounded-md" />
          <SkeletonBlock className="h-10 w-full rounded-md" />
        </div>
        <div className="flex justify-end pt-2">
          <SkeletonBlock className="h-9 w-36 rounded-md" />
        </div>
      </div>
    </div>
  )
}