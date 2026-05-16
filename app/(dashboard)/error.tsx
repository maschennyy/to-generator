"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, RefreshCw, Home, ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    // Log error ke console untuk debugging
    console.error("[Dashboard Error]", error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="max-w-md space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-2xl bg-red-100 dark:bg-red-950/50 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
        </div>

        {/* Pesan */}
        <div className="space-y-2">
          <h2 className="text-xl font-bold">Terjadi Kesalahan</h2>
          <p className="text-sm text-muted-foreground">
            Halaman ini mengalami error yang tidak terduga. Kamu bisa mencoba
            muat ulang halaman atau kembali ke dashboard.
          </p>
        </div>

        {/* Detail error — hanya di development */}
        {process.env.NODE_ENV === "development" && error.message && (
          <div className="text-left rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-4">
            <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">
              Detail Error (development only):
            </p>
            <p className="text-xs text-red-600 dark:text-red-500 font-mono break-words">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-xs text-red-500 mt-1 font-mono">
                Digest: {error.digest}
              </p>
            )}
          </div>
        )}

        {/* Tombol aksi */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={reset} variant="default">
            <RefreshCw className="h-4 w-4 mr-2" />
            Coba Lagi
          </Button>
          <Button onClick={() => router.back()} variant="outline">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>
          <Button onClick={() => router.push("/dashboard")} variant="outline">
            <Home className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}
