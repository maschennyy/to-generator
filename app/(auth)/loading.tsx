import { SkeletonBlock } from "@/components/ui/skeleton-utils"

export default function AuthLoading() {
  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo area */}
        <div className="flex flex-col items-center space-y-3">
          <SkeletonBlock className="h-16 w-16 rounded-2xl bg-white/10" />
          <SkeletonBlock className="h-9 w-36 bg-white/10" />
          <SkeletonBlock className="h-3 w-52 bg-white/10" />
        </div>
        {/* Form card */}
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-8 space-y-5">
          <div className="space-y-1.5">
            <SkeletonBlock className="h-3 w-20 bg-white/10" />
            <SkeletonBlock className="h-10 w-full rounded-xl bg-white/5" />
          </div>
          <div className="space-y-1.5">
            <SkeletonBlock className="h-3 w-20 bg-white/10" />
            <SkeletonBlock className="h-10 w-full rounded-xl bg-white/5" />
          </div>
          <SkeletonBlock className="h-11 w-full rounded-xl bg-white/10" />
        </div>
      </div>
    </div>
  )
}