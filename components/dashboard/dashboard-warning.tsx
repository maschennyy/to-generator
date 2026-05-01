"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, Database, ArrowRight, Loader2 } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface WarningData {
  stats: {
    totalPelanggan: number
    totalDIL: number
    totalTO: number
    totalPemakaian: number
  }
  warnings: {
    pelangganTidakLengkap: number
    tidakAdaDiDIL: number
  }
  samplePelanggan: Array<{
    id: string
    idPelanggan: string
    nama: string
    createdAt: string
  }>
}

export function DashboardWarning() {
  const [data, setData] = useState<WarningData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/dashboard-warning")
        if (response.ok) {
          const result = await response.json()
          setData(result)
        }
      } catch (error) {
        console.error(error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Memuat status data...</p>
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  const hasWarning = data.warnings.pelangganTidakLengkap > 0

  if (!hasWarning) {
    return (
      <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-900">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
            <Database className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-green-900 dark:text-green-300">
              ✓ Semua data pelanggan lengkap
            </p>
            <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
              Tidak ada warning, sistem siap digunakan
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-amber-900 dark:text-amber-300">
              ⚠️ Ada data pelanggan yang belum lengkap
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
              <strong>{data.warnings.pelangganTidakLengkap} pelanggan</strong>{" "}
              memiliki data yang belum lengkap (nama atau alamat kosong).
              Silakan lengkapi data melalui halaman Pelanggan.
            </p>

            {data.samplePelanggan.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-xs font-medium text-amber-900 dark:text-amber-300">
                  Pelanggan yang perlu dilengkapi:
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.samplePelanggan.slice(0, 5).map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-amber-100 dark:bg-amber-950/50 text-amber-900 dark:text-amber-300 font-mono"
                    >
                      {p.idPelanggan}
                    </span>
                  ))}
                  {data.samplePelanggan.length > 5 && (
                    <span className="text-xs text-amber-700 dark:text-amber-500">
                      +{data.samplePelanggan.length - 5} lainnya
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <Link href="/pelanggan?filter=incomplete">
                <Button
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <Database className="mr-2 h-4 w-4" />
                  Lengkapi Data
                </Button>
              </Link>
              <Link href="/pelanggan/import">
                <Button size="sm" variant="outline">
                  Import DIL
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}