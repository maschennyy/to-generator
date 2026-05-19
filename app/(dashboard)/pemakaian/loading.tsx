import {
  SkeletonPageHeader,
  SkeletonTable,
  SkeletonBlock,
} from "@/components/ui/skeleton-utils"

export default function PemakaianLoading() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <div className="flex gap-2">
        <SkeletonBlock className="h-9 flex-1 max-w-sm rounded-md" />
        <SkeletonBlock className="h-9 w-20 rounded-md" />
        <SkeletonBlock className="h-9 w-40 rounded-md" />
      </div>
      <div className="flex items-center justify-between">
        <SkeletonBlock className="h-4 w-48" />
        <SkeletonBlock className="h-9 w-36 rounded-md" />
      </div>
      {/* Tabel pemakaian lebih banyak kolom */}
      <SkeletonTable rows={10} cols={16} />
    </div>
  )
}