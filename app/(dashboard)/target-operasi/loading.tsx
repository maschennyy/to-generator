import {
  SkeletonPageHeader,
  SkeletonStatCards,
  SkeletonTable,
  SkeletonBlock,
} from "@/components/ui/skeleton-utils"

export default function TargetOperasiLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SkeletonPageHeader />
        <div className="flex gap-2">
          <SkeletonBlock className="h-9 w-32 rounded-md" />
          <SkeletonBlock className="h-9 w-32 rounded-md" />
        </div>
      </div>
      <SkeletonStatCards count={4} />
      <div className="flex gap-2">
        <SkeletonBlock className="h-9 flex-1 max-w-md rounded-md" />
        <SkeletonBlock className="h-9 w-32 rounded-md" />
        <SkeletonBlock className="h-9 w-32 rounded-md" />
      </div>
      <SkeletonTable rows={10} cols={8} />
    </div>
  )
}