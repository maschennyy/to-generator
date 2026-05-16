"use client"

import { useEffect } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[Auth Error]", error)
  }, [error])

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center p-4">
      <div className="text-center space-y-5 max-w-sm">
        <div className="flex justify-center">
          <div className="h-14 w-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-red-400" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white">Terjadi Kesalahan</h2>
          <p className="text-sm text-slate-400">
            Halaman login mengalami error. Silakan coba lagi.
          </p>
        </div>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Coba Lagi
        </button>
      </div>
    </div>
  )
}
