import {
  SkeletonPageHeader,
  SkeletonStatCards,
  SkeletonTable,
  SkeletonBlock,
} from "@/components/ui/skeleton-utils"

export default function PelangganLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SkeletonPageHeader />
        <SkeletonBlock className="h-9 w-32 rounded-md" />
      </div>
      <SkeletonStatCards count={4} />
      <div className="flex gap-2">
        <SkeletonBlock className="h-9 flex-1 max-w-sm rounded-md" />
        <SkeletonBlock className="h-9 w-20 rounded-md" />
      </div>
      <SkeletonTable rows={10} cols={6} />
    </div>
  )
}