"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowLeft,
  Pencil,
  MapPin,
  Zap,
  Tag,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Target,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
} from "lucide-react"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// ── Types ─────────────────────────────────────────────────────────────────────

interface PemakaianItem {
  id: string
  bulan: number
  tahun: number
  kwh: number
  keterangan: string | null
  label: string
}

interface TOItem {
  id: string
  tipeAnomali: string
  alasan: string
  skor: number
  status: string
  periode: string
  catatan: string | null
  createdAt: string
  createdBy: { nama: string; username: string }
}

interface DetailData {
  pelanggan: {
    id: string
    idPelanggan: string
    nama: string
    tarif: string
    daya: number
    lokasi: string
    isToHistory: boolean
    dataLengkap: boolean
    createdAt: string
    updatedAt: string
  }
  pemakaian: PemakaianItem[]
  targetOperasi: TOItem[]
  stats: {
    totalBulanData: number
    totalKwh: number
    avgKwh: number
    maxKwh: number
    minKwh: number
    tren: "naik" | "turun" | "stabil"
    totalTO: number
    toAktif: number
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TIPE_LABEL: Record<string, string> = {
  TURUN_DRASTIS: "Turun Drastis",
  STAGNAN: "Stagnan",
  NOL_PEMAKAIAN: "Nol Pemakaian",
  LONJAKAN: "Lonjakan",
  POLA_TIDAK_WAJAR: "Pola Tidak Wajar",
}

const TIPE_COLOR: Record<string, string> = {
  TURUN_DRASTIS: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  STAGNAN: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
  NOL_PEMAKAIAN: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  LONJAKAN: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
  POLA_TIDAK_WAJAR: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  PENDING: { label: "Pending", icon: Clock, className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  DIPROSES: { label: "Diproses", icon: Target, className: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" },
  SELESAI: { label: "Selesai", icon: CheckCircle2, className: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" },
  DIBATALKAN: { label: "Dibatalkan", icon: XCircle, className: "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  id: string
  isAdmin: boolean
}

export function PelangganDetailClient({ id, isAdmin }: Props) {
  const router = useRouter()
  const [data, setData] = useState<DetailData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchDetail() {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/pelanggan/${id}/detail`)
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || "Gagal memuat detail")
        }
        const result = await res.json()
        setData(result)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal memuat detail pelanggan")
        router.push("/pelanggan")
      } finally {
        setIsLoading(false)
      }
    }
    fetchDetail()
  }, [id, router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mr-3" />
        <span className="text-muted-foreground">Memuat detail pelanggan...</span>
      </div>
    )
  }

  if (!data) return null

  const { pelanggan, pemakaian, targetOperasi, stats } = data
  const chartData = pemakaian.slice(-24) // Tampilkan max 24 bulan di chart

  const TrenIcon = stats.tren === "naik" ? TrendingUp : stats.tren === "turun" ? TrendingDown : Minus
  const trenColor = stats.tren === "naik" ? "text-green-600" : stats.tren === "turun" ? "text-red-600" : "text-slate-500"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="mt-1 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{pelanggan.nama || "(Nama kosong)"}</h1>
              {pelanggan.isToHistory && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">
                  <AlertTriangle className="h-3 w-3" />
                  TO Historis
                </span>
              )}
              {!pelanggan.dataLengkap && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                  Data Belum Lengkap
                </span>
              )}
            </div>
            <p className="text-muted-foreground font-mono text-sm mt-0.5">{pelanggan.idPelanggan}</p>
          </div>
        </div>
        {isAdmin && (
          <Link href={`/pelanggan/${pelanggan.id}/edit`}>
            <Button variant="outline" size="sm" className="shrink-0">
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
        )}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <InfoCard icon={Tag} label="Tarif" value={pelanggan.tarif} />
        <InfoCard icon={Zap} label="Daya" value={`${pelanggan.daya.toLocaleString("id-ID")} VA`} />
        <InfoCard icon={MapPin} label="Lokasi" value={pelanggan.lokasi || "-"} truncate />
        <InfoCard
          icon={Calendar}
          label="Terdaftar"
          value={new Date(pelanggan.createdAt).toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        />
      </div>

      {/* Statistik Pemakaian */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Bulan Data" value={stats.totalBulanData} suffix="bln" />
        <StatCard label="Rata-rata" value={stats.avgKwh.toFixed(0)} suffix="kWh" />
        <StatCard label="Tertinggi" value={stats.maxKwh.toFixed(0)} suffix="kWh" colorClass="text-green-600" />
        <StatCard label="Terendah" value={stats.minKwh.toFixed(0)} suffix="kWh" colorClass="text-red-600" />
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Tren 3 Bln</p>
            <div className={`flex items-center gap-1 font-semibold ${trenColor}`}>
              <TrenIcon className="h-4 w-4" />
              <span className="capitalize">{stats.tren}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grafik Pemakaian */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-600" />
            Grafik Pemakaian kWh
            <span className="text-xs font-normal text-muted-foreground ml-1">
              ({chartData.length} bulan terakhir)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pemakaian.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-center">
              <div>
                <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Belum ada data pemakaian</p>
              </div>
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="kwhGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    interval={Math.floor(chartData.length / 8)}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    allowDecimals={false}
                    tickFormatter={(v) => v.toLocaleString("id-ID")}
                  />
                  <Tooltip
                    formatter={(value) => [
                      Number(value ?? 0).toLocaleString("id-ID"),
                      "kWh",
                    ]}
                    labelFormatter={(l) => `Periode: ${l}`}
                  />
                  <ReferenceLine
                    y={stats.avgKwh}
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    label={{ value: "Avg", position: "right", fontSize: 10 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="kwh"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#kwhGrad)"
                    dot={{ r: 2 }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabel Pemakaian Lengkap */}
      {pemakaian.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Riwayat Pemakaian ({pemakaian.length} bulan)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold">Periode</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold">kWh</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold">Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {[...pemakaian].reverse().map((p) => (
                    <tr key={p.id} className="border-b hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-2 text-sm font-mono">{p.label}</td>
                      <td className={`px-4 py-2 text-sm text-right font-semibold ${
                        p.kwh === 0 ? "text-red-600" : p.kwh < stats.avgKwh * 0.5 ? "text-amber-600" : ""
                      }`}>
                        {p.kwh.toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{p.keterangan || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Riwayat Target Operasi */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-600" />
              Riwayat Target Operasi ({stats.totalTO})
            </CardTitle>
            {stats.toAktif > 0 && (
              <span className="text-xs px-2 py-1 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 font-medium">
                {stats.toAktif} aktif
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {targetOperasi.length === 0 ? (
            <div className="p-10 text-center">
              <Target className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Belum pernah masuk Target Operasi</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold">Tipe</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold">Alasan</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold">Skor</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold">Status</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold">Periode</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold">Oleh</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold">Tanggal</th>
                  </tr>
                </thead>
                <tbody>
                  {targetOperasi.map((t) => {
                    const statusConf = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.PENDING
                    const StatusIcon = statusConf.icon
                    return (
                      <tr key={t.id} className="border-b hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${TIPE_COLOR[t.tipeAnomali] ?? ""}`}>
                            {TIPE_LABEL[t.tipeAnomali] ?? t.tipeAnomali}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-xs">
                          <p className="line-clamp-2" title={t.alasan}>{t.alasan}</p>
                        </td>
                        <td className="px-4 py-2.5 text-center text-sm font-semibold">
                          {Math.round(t.skor * 100)}%
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusConf.className}`}>
                            <StatusIcon className="h-3 w-3" />
                            {statusConf.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center text-xs font-mono text-muted-foreground">
                          {t.periode}
                        </td>
                        <td className="px-4 py-2.5 text-center text-xs text-muted-foreground">
                          {t.createdBy.nama}
                        </td>
                        <td className="px-4 py-2.5 text-center text-xs text-muted-foreground">
                          {new Date(t.createdAt).toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoCard({
  icon: Icon,
  label,
  value,
  truncate,
}: {
  icon: typeof MapPin
  label: string
  value: string
  truncate?: boolean
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-start gap-3">
        <div className="h-8 w-8 rounded-md bg-blue-50 dark:bg-blue-950 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-blue-600" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-sm font-medium mt-0.5 ${truncate ? "truncate" : ""}`} title={value}>
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function StatCard({
  label,
  value,
  suffix,
  colorClass,
}: {
  label: string
  value: string | number
  suffix?: string
  colorClass?: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className={`text-xl font-bold ${colorClass ?? ""}`}>
          {value}
          {suffix && <span className="text-xs font-normal text-muted-foreground ml-1">{suffix}</span>}
        </p>
      </CardContent>
    </Card>
  )
}
