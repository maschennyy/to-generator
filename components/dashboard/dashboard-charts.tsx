"use client"

import { useState, useEffect } from "react"
import { Loader2, TrendingUp, PieChart, Target, ShieldCheck } from "lucide-react"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

interface TrendPoint {
  key: string
  label: string
  total: number
  selesai: number
}

interface TipePoint {
  tipe: string
  label: string
  total: number
}

interface ChartData {
  trendData: TrendPoint[]
  tipeData: TipePoint[]
  operational?: {
    funnel: Array<{ key: string; label: string; total: number }>
    checked: number
    violations: number
    hitRate: number | null
  }
  riskDistribution?: Array<{
    band: "high" | "medium" | "low"
    label: string
    range: string
    total: number
  }>
}

// Warna per tipe anomali — konsisten dengan badge di halaman TO
const TIPE_COLORS: Record<string, string> = {
  TURUN_DRASTIS:   "#f59e0b",
  STAGNAN:         "#6366f1",
  NOL_PEMAKAIAN:   "#ef4444",
  LONJAKAN:        "#a855f7",
  POLA_TIDAK_WAJAR:"#64748b",
}

// Custom tooltip untuk area chart
function TrendTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-medium">{p.value.toLocaleString("id-ID")}</span>
        </p>
      ))}
    </div>
  )
}

// Custom tooltip untuk bar chart
function TipeTooltip({ active, payload }: {
  active?: boolean
  payload?: Array<{ value: number; payload: TipePoint }>
}) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold">{d.payload.label}</p>
      <p className="text-muted-foreground">
        Jumlah: <span className="font-medium text-foreground">{d.value.toLocaleString("id-ID")} TO</span>
      </p>
    </div>
  )
}

export function DashboardCharts() {
  const [data, setData] = useState<ChartData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/dashboard-charts")
        if (res.ok) {
          const result = await res.json()
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardContent className="h-72 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!data) return null

  const totalTO = data.tipeData.reduce((a, b) => a + b.total, 0)
  const hasData = totalTO > 0
  const hasTrend = data.trendData.some((d) => d.total > 0)
  const maxFunnel = Math.max(...(data.operational?.funnel.map((item) => item.total) ?? [1]), 1)
  const totalRisk = data.riskDistribution?.reduce((sum, item) => sum + item.total, 0) ?? 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-red-600" />
              <CardTitle className="text-sm font-semibold">Funnel Operasi P2TL</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Alur target dari dibuat sampai terbukti pelanggaran
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {(data.operational?.funnel ?? []).map((item) => (
                <div key={item.key} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-2xl font-semibold">{item.total.toLocaleString("id-ID")}</p>
                  <div className="mt-3 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-2 rounded-full bg-red-600"
                      style={{ width: `${Math.max((item.total / maxFunnel) * 100, item.total > 0 ? 8 : 0)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <CardTitle className="text-sm font-semibold">Hit Rate Lapangan</CardTitle>
            </div>
            <CardDescription className="text-xs">Efektivitas hasil operasi tercatat</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">
              {data.operational?.hitRate === null || data.operational?.hitRate === undefined
                ? "-"
                : `${Math.round(data.operational.hitRate * 100)}%`}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {data.operational?.checked?.toLocaleString("id-ID") ?? 0} diperiksa,{" "}
              {data.operational?.violations?.toLocaleString("id-ID") ?? 0} terbukti pelanggaran.
            </p>
            <div className="mt-4 space-y-2">
              {(data.riskDistribution ?? []).map((item) => {
                const pct = totalRisk > 0 ? Math.round((item.total / totalRisk) * 100) : 0
                return (
                  <div key={item.band} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{item.label}</span>
                      <span className="text-muted-foreground">{item.total.toLocaleString("id-ID")} ({pct}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className={`h-2 rounded-full ${riskBandColor(item.band)}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

      {/* ── Tren TO per bulan — lebih lebar ────────────────────────────────── */}
      <Card className="lg:col-span-3">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <CardTitle className="text-sm font-semibold">Tren Target Operasi</CardTitle>
          </div>
          <CardDescription className="text-xs">
            TO dibuat & diselesaikan dalam 12 bulan terakhir
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!hasTrend ? (
            <EmptyChart label="Belum ada data TO dalam 12 bulan terakhir" />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradSelesai" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<TrendTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                    formatter={(value) => value === "total" ? "Dibuat" : "Diselesaikan"}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="total"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#gradTotal)"
                    dot={{ r: 2.5, fill: "#3b82f6" }}
                    activeDot={{ r: 5 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="selesai"
                    name="selesai"
                    stroke="#22c55e"
                    strokeWidth={2}
                    fill="url(#gradSelesai)"
                    dot={{ r: 2.5, fill: "#22c55e" }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Distribusi tipe anomali — lebih sempit ──────────────────────────── */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <PieChart className="h-4 w-4 text-purple-600" />
            <CardTitle className="text-sm font-semibold">Distribusi Tipe Anomali</CardTitle>
          </div>
          <CardDescription className="text-xs">
            {hasData ? `${totalTO.toLocaleString("id-ID")} TO keseluruhan` : "Belum ada data"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!hasData ? (
            <EmptyChart label="Belum ada Target Operasi" />
          ) : (
            <div className="space-y-3">
              {/* Bar chart horizontal */}
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.tipeData}
                    layout="vertical"
                    margin={{ top: 0, right: 8, left: 4, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.15} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      width={90}
                    />
                    <Tooltip content={<TipeTooltip />} />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={20}>
                      {data.tipeData.map((entry) => (
                        <Cell
                          key={entry.tipe}
                          fill={TIPE_COLORS[entry.tipe] ?? "#94a3b8"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Legend dengan persentase */}
              <div className="space-y-1.5 pt-1 border-t border-border">
                {data.tipeData.map((item) => {
                  const pct = totalTO > 0 ? Math.round((item.total / totalTO) * 100) : 0
                  return (
                    <div key={item.tipe} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: TIPE_COLORS[item.tipe] ?? "#94a3b8" }}
                        />
                        <span className="text-muted-foreground">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-2 text-right">
                        <span className="font-medium">{item.total.toLocaleString("id-ID")}</span>
                        <span className="text-muted-foreground w-8">{pct}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </div>
  )
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-56 flex flex-col items-center justify-center text-center gap-2">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
        <TrendingUp className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground max-w-[180px]">{label}</p>
    </div>
  )
}

function riskBandColor(band: "high" | "medium" | "low") {
  if (band === "high") return "bg-red-600"
  if (band === "medium") return "bg-amber-500"
  return "bg-slate-500"
}
