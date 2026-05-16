"use client"

import { useEffect } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"

// global-error.tsx menangkap error di root layout
// Harus menyertakan <html> dan <body> sendiri
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[Global Error]", error)
  }, [error])

  return (
    <html lang="id">
      <body className="bg-slate-950 text-white">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center space-y-5 max-w-sm">
            <div className="flex justify-center">
              <div className="h-14 w-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <AlertTriangle className="h-7 w-7 text-red-400" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold">Sistem Mengalami Error</h2>
              <p className="text-sm text-slate-400">
                Terjadi kesalahan kritis. Silakan muat ulang halaman.
              </p>
              {process.env.NODE_ENV === "development" && error.message && (
                <p className="text-xs font-mono text-red-400 mt-2 break-words">
                  {error.message}
                </p>
              )}
            </div>
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Muat Ulang
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
