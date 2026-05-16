"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function ProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error("[Profile Error]", error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="max-w-sm space-y-5">
        <div className="flex justify-center">
          <div className="h-14 w-14 rounded-2xl bg-red-100 dark:bg-red-950/50 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-red-600 dark:text-red-400" />
          </div>
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold">Gagal Memuat Profil</h2>
          <p className="text-sm text-muted-foreground">
            Terjadi kesalahan saat memuat halaman profil.
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <Button onClick={reset} variant="default" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Coba Lagi
          </Button>
          <Button onClick={() => router.push("/dashboard")} variant="outline" size="sm">
            <Home className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}
