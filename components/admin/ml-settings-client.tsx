"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Brain, Loader2, RefreshCw, ServerCrash } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type MlHealth = {
  status: string
  database_connected: boolean
  trained: boolean
  model_version: number
  last_training_summary: null | {
    total_rows: number
    violation_rows: number
    non_violation_rows: number
    model_version: number
    precision?: number
    recall?: number
    f1_score?: number
  }
  training_status?: {
    state: "idle" | "running" | "succeeded" | "failed" | "rejected" | "skipped"
    running: boolean
    pending_retrain?: boolean
    last_error: string | null
    started_at: string | null
    finished_at: string | null
    duration_seconds: number | null
    updated_at?: string | null
    last_summary: null | {
      total_rows: number
      violation_rows: number
      non_violation_rows: number
      model_version: number
      precision?: number
      recall?: number
      f1_score?: number
      accepted?: boolean
      status?: string
      rejection_reason?: string | null
    }
  }
}

export function MlSettingsClient() {
  const [health, setHealth] = useState<MlHealth | null>(null)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isTraining, setIsTraining] = useState(false)

  async function fetchHealth(options: { showLoading?: boolean } = {}) {
    const showLoading = options.showLoading ?? true
    if (showLoading) setIsLoading(true)
    setError("")
    try {
      const res = await fetch("/api/nalar/health")
      const result = await res.json()
      if (!res.ok) throw new Error(result.detail || result.error || "NALAR service tidak tersedia")
      setHealth(result)
    } catch (err) {
      setHealth(null)
      setError(err instanceof Error ? err.message : "Skor NALAR tidak tersedia")
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }

  async function fetchTrainingStatus() {
    const res = await fetch("/api/nalar/training-status")
    const result = await res.json()
    if (!res.ok) throw new Error(result.detail || result.error || "Status training NALAR tidak tersedia")
    return result as NonNullable<MlHealth["training_status"]>
  }

  async function pollTrainingStatus() {
    for (let attempt = 0; attempt < 40; attempt++) {
      await wait(3000)
      const status = await fetchTrainingStatus()
      setHealth((current) => (current ? { ...current, training_status: status } : current))

      if (!status.running) {
        await fetchHealth({ showLoading: false })
        if (status.state === "succeeded") {
          toast.success("Training NALAR selesai")
        } else if (status.state === "rejected") {
          toast.warning("Model kandidat NALAR ditolak", {
            description: status.last_error || "Model lama tetap digunakan.",
          })
        } else if (status.last_error) {
          toast.error("Training NALAR gagal", { description: status.last_error })
        }
        return
      }
    }

    await fetchHealth({ showLoading: false })
  }

  async function trainModel() {
    setIsTraining(true)
    setError("")
    try {
      const res = await fetch("/api/nalar/train", { method: "POST" })
      const result = await res.json()
      if (!res.ok) throw new Error(result.detail || result.error || "Training gagal")
      setHealth((current) =>
        current && result.training_status
          ? { ...current, training_status: result.training_status }
          : current
      )
      toast.success(result.message || "Training NALAR dimulai di background")
      await pollTrainingStatus()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Training gagal"
      setError(message)
      toast.error("Gagal melatih ulang NALAR", { description: message })
    } finally {
      setIsTraining(false)
    }
  }

  useEffect(() => {
    fetchHealth()
  }, [])

  const summary = health?.last_training_summary
  const trainingStatus = health?.training_status

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 flex items-center justify-center">
                <Brain className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">NALAR Risk Engine</h2>
                <p className="text-sm text-muted-foreground">
                  Latih ulang model dari data pelanggan dan hasil operasi terbaru.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => fetchHealth()} disabled={isLoading || isTraining}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Button onClick={trainModel} disabled={isTraining || trainingStatus?.running}>
                {isTraining || trainingStatus?.running ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Melatih...</>
                ) : (
                  <><Brain className="mr-2 h-4 w-4" />Latih Ulang NALAR</>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300 flex gap-2">
          <ServerCrash className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <InfoCard label="Status Service" value={isLoading ? "Memuat..." : health?.status ?? "Tidak tersedia"} />
        <InfoCard label="Database NALAR" value={health?.database_connected ? "Terhubung" : "Tidak tersedia"} />
        <InfoCard label="Model" value={trainingStatus?.running ? "Training berjalan" : health?.trained ? `Versi ${health.model_version}` : "Belum dilatih"} />
        <InfoCard label="Training Terakhir" value={trainingStatus?.finished_at ? new Date(trainingStatus.finished_at).toLocaleString("id-ID") : "-"} />
        <InfoCard label="Antrean Retrain" value={trainingStatus?.pending_retrain ? "Ada" : "Kosong"} />
      </div>

      {trainingStatus?.last_error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300 flex gap-2">
          <ServerCrash className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            {trainingStatus.state === "rejected"
              ? "Model kandidat ditolak: "
              : trainingStatus.state === "skipped"
                ? "Training dilewati: "
                : "Training terakhir gagal: "}
            {trainingStatus.last_error}
          </span>
        </div>
      )}

      <Card>
        <CardContent className="p-5">
          <h3 className="font-semibold mb-3">Data Training</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <InfoCard label="Total Pelanggan" value={(summary?.total_rows ?? 0).toLocaleString("id-ID")} />
            <InfoCard label="Pelanggan Temuan" value={(summary?.violation_rows ?? 0).toLocaleString("id-ID")} />
            <InfoCard label="Non Temuan" value={(summary?.non_violation_rows ?? 0).toLocaleString("id-ID")} />
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Jika training gagal karena data temuan kurang dari 10, tambahkan data historis temuan atau hasil operasi terlebih dahulu.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white dark:bg-slate-900 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold">{value}</p>
    </div>
  )
}
