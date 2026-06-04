"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import { AlertCircle, BarChart3, Brain, CheckCircle2, RefreshCw, Target } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type DashboardData = {
  training: {
    total: number
    violation: number
    normal: number
  }
  latestHistory: null | {
    tanggal_train: string
    jumlah_data: number
    jumlah_temuan: number
    jumlah_normal: number
    precision: number | null
    recall: number | null
    f1_score: number | null
    status?: string
    accepted?: boolean
    rejection_reason?: string | null
    f1_delta?: number | null
    precision_delta?: number | null
  }
  monthlyFindings: Array<{
    month: string
    total: number
  }>
  operational?: {
    total_checked: number
    violations: number
    normal: number
    not_found: number
    hit_rate: number | null
  }
  operationalLabels?: {
    operational_violations: number
    operational_normal: number
  }
  dataQuality?: {
    pelanggan_without_usage: number
    to_historis_without_usage: number
    features_without_usage: number
    invalid_usage_rows: number
    duplicate_usage_periods: number
  }
  setup?: {
    ready: boolean
    missingTables: string[]
    message: string | null
  }
}

type FeatureImportance = {
  feature: string
  label: string
  importance: number
}

type TrainingStatus = {
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
    accepted?: boolean
    status?: string
    rejection_reason?: string | null
    f1_delta?: number | null
    precision_delta?: number | null
  }
}

export function MlDashboardClient() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [features, setFeatures] = useState<FeatureImportance[]>([])
  const [trainingStatus, setTrainingStatus] = useState<TrainingStatus | null>(null)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  async function fetchDashboard() {
    setIsLoading(true)
    setError("")
    try {
      const [dashboardRes, featureRes, statusRes] = await Promise.all([
        fetch("/api/nalar/dashboard"),
        fetch("/api/nalar/feature-importance"),
        fetch("/api/nalar/training-status"),
      ])
      const dashboardJson = await dashboardRes.json()
      if (!dashboardRes.ok) {
        throw new Error(dashboardJson.detail || dashboardJson.error || "Dashboard NALAR tidak tersedia")
      }

      setDashboard(dashboardJson)

      if (featureRes.ok) {
        const featureJson = await featureRes.json()
        setFeatures((featureJson.data ?? []).slice(0, 5))
      } else {
        setFeatures([])
      }

      if (statusRes.ok) {
        setTrainingStatus(await statusRes.json())
      } else {
        setTrainingStatus(null)
      }
    } catch (err) {
      setDashboard(null)
      setFeatures([])
      setTrainingStatus(null)
      setError(err instanceof Error ? err.message : "Dashboard NALAR tidak tersedia")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
  }, [])

  const latest = dashboard?.latestHistory
  const plainMetrics = useMemo(() => {
    const precision = latest?.precision ?? 0
    const recall = latest?.recall ?? 0
    const f1 = latest?.f1_score ?? 0

    return {
      precision: `Dari 10 pelanggan yang diprediksi berisiko tinggi, sekitar ${Math.round(precision * 10)} biasanya benar terbukti melanggar.`,
      recall: `Dari 10 pelanggan yang benar melanggar, model dapat menemukan sekitar ${Math.round(recall * 10)} pelanggan.`,
      f1: `Skor keseimbangan model saat ini ${Math.round(f1 * 100)} dari 100.`,
    }
  }, [latest])

  const maxMonthly = Math.max(...(dashboard?.monthlyFindings.map((item) => item.total) ?? [1]), 1)
  const maxFeature = Math.max(...features.map((item) => item.importance), 0.001)

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Ringkasan NALAR</h2>
          <p className="text-sm text-muted-foreground">
            Pantau data training, performa NALAR, dan pola temuan terbaru.
          </p>
        </div>
        <Button variant="outline" onClick={fetchDashboard} disabled={isLoading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {dashboard?.setup && !dashboard.setup.ready && (
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">{dashboard.setup.message}</p>
            <p className="mt-1">
              Tabel belum ada: {dashboard.setup.missingTables.join(", ")}. Jalankan migration Prisma lalu latih ulang NALAR.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <MetricCard
          label="Total Data Training"
          value={formatNumber(dashboard?.training.total)}
          icon={<Brain className="h-4 w-4" />}
        />
        <MetricCard
          label="Berlabel Pelanggaran"
          value={formatNumber(dashboard?.training.violation)}
          icon={<Target className="h-4 w-4" />}
        />
        <MetricCard
          label="Berlabel Normal"
          value={formatNumber(dashboard?.training.normal)}
          icon={<BarChart3 className="h-4 w-4" />}
        />
        <MetricCard
          label="Terakhir Dilatih"
          value={latest?.tanggal_train ? formatDate(latest.tanggal_train) : "-"}
          icon={<RefreshCw className="h-4 w-4" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status Training</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${getStatusColor(trainingStatus?.state)}`}>
                {trainingStatus?.state === "failed" ? (
                  <AlertCircle className="h-5 w-5" />
                ) : trainingStatus?.state === "rejected" ? (
                  <AlertCircle className="h-5 w-5" />
                ) : trainingStatus?.state === "skipped" ? (
                  <AlertCircle className="h-5 w-5" />
                ) : trainingStatus?.running ? (
                  <RefreshCw className="h-5 w-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-5 w-5" />
                )}
              </div>
              <div>
                <p className="font-semibold">{getStatusLabel(trainingStatus?.state)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {trainingStatus?.running
                    ? trainingStatus.pending_retrain
                      ? "NALAR sedang dilatih. Satu training ulang berikutnya sudah masuk antrean."
                      : "NALAR sedang dilatih dari data terbaru."
                    : trainingStatus?.last_error
                      ? trainingStatus.last_error
                      : "Tidak ada training yang sedang berjalan."}
                </p>
              </div>
            </div>
            <div className="grid min-w-64 grid-cols-1 gap-2 text-sm">
              <StatusLine label="Mulai" value={trainingStatus?.started_at ? formatDate(trainingStatus.started_at) : "-"} />
              <StatusLine label="Selesai" value={trainingStatus?.finished_at ? formatDate(trainingStatus.finished_at) : "-"} />
              <StatusLine label="Durasi" value={trainingStatus?.duration_seconds ? `${trainingStatus.duration_seconds} detik` : "-"} />
              <StatusLine label="Antrean" value={trainingStatus?.pending_retrain ? "Ada retrain menunggu" : "-"} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kualitas Data NALAR</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <MetricCard
              label="Pelanggan tanpa kWh"
              value={formatNumber(dashboard?.dataQuality?.pelanggan_without_usage)}
              icon={<AlertCircle className="h-4 w-4" />}
            />
            <MetricCard
              label="TO tanpa kWh"
              value={formatNumber(dashboard?.dataQuality?.to_historis_without_usage)}
              icon={<Target className="h-4 w-4" />}
            />
            <MetricCard
              label="Fitur tanpa histori"
              value={formatNumber(dashboard?.dataQuality?.features_without_usage)}
              icon={<Brain className="h-4 w-4" />}
            />
            <MetricCard
              label="Pemakaian invalid"
              value={formatNumber(dashboard?.dataQuality?.invalid_usage_rows)}
              icon={<AlertCircle className="h-4 w-4" />}
            />
            <MetricCard
              label="Duplikat periode"
              value={formatNumber(dashboard?.dataQuality?.duplicate_usage_periods)}
              icon={<BarChart3 className="h-4 w-4" />}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Prioritas perbaikan data: lengkapi pemakaian pelanggan TO historis, bersihkan nilai pemakaian invalid, lalu latih ulang NALAR.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Performa Model</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {latest?.accepted === false && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
              Model kandidat NALAR terakhir ditolak dan model lama tetap aktif. {latest.rejection_reason}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <PerformanceCard title="Precision" score={latest?.precision} delta={latest?.precision_delta} text={plainMetrics.precision} />
            <PerformanceCard title="Recall" score={latest?.recall} text={plainMetrics.recall} />
            <PerformanceCard title="F1-score" score={latest?.f1_score} delta={latest?.f1_delta} text={plainMetrics.f1} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Metrik Lapangan</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <MetricCard
            label="Sudah Dioperasi"
            value={formatNumber(dashboard?.operational?.total_checked)}
            icon={<Target className="h-4 w-4" />}
          />
          <MetricCard
            label="Terbukti Pelanggaran"
            value={formatNumber(dashboard?.operational?.violations)}
            icon={<AlertCircle className="h-4 w-4" />}
          />
          <MetricCard
            label="Normal"
            value={formatNumber(dashboard?.operational?.normal)}
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
          <MetricCard
            label="Hit Rate Operasi"
            value={formatPercentValue(dashboard?.operational?.hit_rate)}
            icon={<BarChart3 className="h-4 w-4" />}
          />
          <p className="md:col-span-4 text-sm text-muted-foreground">
            Dari operasi yang hasilnya sudah dicatat, sekitar {formatPercentValue(dashboard?.operational?.hit_rate)} terbukti pelanggaran.
          </p>
          <div className="md:col-span-4 rounded-lg border bg-slate-50 p-4 text-sm dark:bg-slate-900">
            <p className="font-medium">Label operasional untuk training</p>
            <p className="mt-1 text-muted-foreground">
              {formatNumber(dashboard?.operationalLabels?.operational_violations)} pelanggan berlabel pelanggaran dari hasil lapangan dan{" "}
              {formatNumber(dashboard?.operationalLabels?.operational_normal)} pelanggan berlabel normal dari hasil lapangan.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tren Temuan per Bulan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-64 items-end gap-3 overflow-x-auto border-b pb-2">
              {(dashboard?.monthlyFindings ?? []).map((item) => (
                <div key={item.month} className="flex min-w-14 flex-1 flex-col items-center gap-2">
                  <div className="text-xs font-medium">{item.total}</div>
                  <div
                    className="w-full rounded-t bg-blue-600"
                    style={{ height: `${Math.max((item.total / maxMonthly) * 190, 8)}px` }}
                    title={`${item.month}: ${item.total} temuan`}
                  />
                  <div className="text-[11px] text-muted-foreground">{formatMonth(item.month)}</div>
                </div>
              ))}
              {!dashboard?.monthlyFindings.length && (
                <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                  Belum ada data temuan bulanan.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 5 Fitur Berpengaruh</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {features.map((item) => (
              <div key={item.feature} className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-muted-foreground">{Math.round(item.importance * 100)}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-2 rounded-full bg-emerald-600"
                    style={{ width: `${Math.max((item.importance / maxFeature) * 100, 4)}%` }}
                  />
                </div>
              </div>
            ))}
            {features.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Feature importance belum tersedia. Jalankan training NALAR terlebih dahulu.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{label}</p>
          <div className="text-muted-foreground">{icon}</div>
        </div>
        <p className="mt-2 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  )
}

function PerformanceCard({
  title,
  score,
  delta,
  text,
}: {
  title: string
  score?: number | null
  delta?: number | null
  text: string
}) {
  const percent = Math.round((score ?? 0) * 100)
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">{title}</p>
        <div className="text-right">
          <p className="text-lg font-semibold">{percent}%</p>
          {typeof delta === "number" && (
            <p className={delta < 0 ? "text-xs text-red-600" : "text-xs text-emerald-600"}>
              {delta >= 0 ? "+" : ""}{Math.round(delta * 100)}%
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-2 rounded-full bg-blue-600" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{text}</p>
    </div>
  )
}

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function getStatusLabel(state?: TrainingStatus["state"]) {
  if (state === "running") return "Training berjalan"
  if (state === "succeeded") return "Training terakhir berhasil"
  if (state === "rejected") return "Model kandidat ditolak"
  if (state === "skipped") return "Training dilewati"
  if (state === "failed") return "Training terakhir gagal"
  return "Belum ada aktivitas training"
}

function getStatusColor(state?: TrainingStatus["state"]) {
  if (state === "running") return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
  if (state === "failed") return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
  if (state === "rejected") return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
  if (state === "skipped") return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
  return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
}

function formatNumber(value?: number) {
  return (value ?? 0).toLocaleString("id-ID")
}

function formatPercentValue(value?: number | null) {
  if (value === null || value === undefined) return "-"
  return `${Math.round(value * 100)}%`
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("id-ID")
}

function formatMonth(value: string) {
  const [year, month] = value.split("-").map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString("id-ID", {
    month: "short",
    year: "2-digit",
  })
}
