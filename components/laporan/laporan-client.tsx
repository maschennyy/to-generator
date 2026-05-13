"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { toast } from "sonner"
import {
  Loader2,
  FileText,
  Target as TargetIcon,
  CheckCircle2,
  Activity,
  Clock,
  Users,
  TrendingUp,
  AlertTriangle,
  Download,
  FileSpreadsheet,
  Calendar,
  RefreshCw,
  BarChart3,
} from "lucide-react"
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RTooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type StatusTO = "PENDING" | "DIPROSES" | "SELESAI" | "DIBATALKAN"
type TipeAnomali =
  | "TURUN_DRASTIS"
  | "STAGNAN"
  | "NOL_PEMAKAIAN"
  | "LONJAKAN"
  | "POLA_TIDAK_WAJAR"

interface LaporanData {
  range: { from: string; to: string }
  kpi: {
    totalInRange: number
    pending: number
    diproses: number
    selesai: number
    dibatalkan: number
    successRate: number
    totalAllTime: number
    totalPelanggan: number
    totalPemakaian: number
    totalToHistoris: number
  }
  breakdown: {
    status: Record<StatusTO, number>
    tipe: Record<TipeAnomali, number>
  }
  series: Array<{ date: string; total: number; selesai: number }>
  table: Array<{
    id: string
    tipeAnomali: TipeAnomali
    alasan: string
    skor: number
    status: StatusTO
    periode: string
    catatan: string | null
    createdAt: string
    pelanggan: {
      id: string
      idPelanggan: string
      nama: string
      tarif: string
      daya: number
      lokasi: string
      isToHistory: boolean
    }
  }>
}

const STATUS_LABEL: Record<StatusTO, string> = {
  PENDING: "Pending",
  DIPROSES: "Diproses",
  SELESAI: "Selesai",
  DIBATALKAN: "Dibatalkan",
}

const STATUS_BADGE: Record<StatusTO, string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  DIPROSES: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  SELESAI: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  DIBATALKAN:
    "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
}

const STATUS_COLORS: Record<StatusTO, string> = {
  PENDING: "#f59e0b",
  DIPROSES: "#3b82f6",
  SELESAI: "#10b981",
  DIBATALKAN: "#94a3b8",
}

const TIPE_LABEL: Record<TipeAnomali, string> = {
  TURUN_DRASTIS: "Turun Drastis",
  STAGNAN: "Stagnan",
  NOL_PEMAKAIAN: "Nol Pemakaian",
  LONJAKAN: "Lonjakan",
  POLA_TIDAK_WAJAR: "Pola Tidak Wajar",
}

const TIPE_COLORS: Record<TipeAnomali, string> = {
  TURUN_DRASTIS: "#f59e0b",
  STAGNAN: "#6366f1",
  NOL_PEMAKAIAN: "#ef4444",
  LONJAKAN: "#a855f7",
  POLA_TIDAK_WAJAR: "#64748b",
}

interface Props {
  userName: string
}

type PresetKey =
  | "today"
  | "this-week"
  | "this-month"
  | "last-month"
  | "this-year"
  | "custom"

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function getPresetRange(preset: PresetKey): { from: string; to: string } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  switch (preset) {
    case "today":
      return { from: toDateInput(today), to: toDateInput(today) }
    case "this-week": {
      const day = today.getDay() // 0=Sun .. 6=Sat
      const diffToMon = (day + 6) % 7
      const start = new Date(today)
      start.setDate(today.getDate() - diffToMon)
      return { from: toDateInput(start), to: toDateInput(today) }
    }
    case "this-month": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      return { from: toDateInput(start), to: toDateInput(end) }
    }
    case "last-month": {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const end = new Date(today.getFullYear(), today.getMonth(), 0)
      return { from: toDateInput(start), to: toDateInput(end) }
    }
    case "this-year": {
      const start = new Date(today.getFullYear(), 0, 1)
      const end = new Date(today.getFullYear(), 11, 31)
      return { from: toDateInput(start), to: toDateInput(end) }
    }
    default: {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      return { from: toDateInput(start), to: toDateInput(today) }
    }
  }
}

export function LaporanClient({ userName }: Props) {
  const initial = getPresetRange("this-month")
  const [preset, setPreset] = useState<PresetKey>("this-month")
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [data, setData] = useState<LaporanData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [isExportingExcel, setIsExportingExcel] = useState(false)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ from, to })
      const res = await fetch(`/api/laporan?${params}`)
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || "Gagal memuat laporan")
      setData(result)
    } catch (err) {
      console.error(err)
      toast.error("Gagal memuat laporan", {
        description: err instanceof Error ? err.message : "Error",
      })
    } finally {
      setIsLoading(false)
    }
  }, [from, to])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function applyPreset(p: PresetKey) {
    setPreset(p)
    if (p !== "custom") {
      const r = getPresetRange(p)
      setFrom(r.from)
      setTo(r.to)
    }
  }

  const statusPie = useMemo(() => {
    if (!data) return []
    return (Object.keys(data.breakdown.status) as StatusTO[])
      .map((k) => ({
        name: STATUS_LABEL[k],
        key: k,
        value: data.breakdown.status[k],
      }))
      .filter((d) => d.value > 0)
  }, [data])

  const tipeBar = useMemo(() => {
    if (!data) return []
    return (Object.keys(data.breakdown.tipe) as TipeAnomali[]).map((k) => ({
      name: TIPE_LABEL[k],
      key: k,
      jumlah: data.breakdown.tipe[k],
    }))
  }, [data])

  async function handleExportPdf() {
    if (!data) return
    setIsExporting(true)
    try {
      const [{ jsPDF }, autoTableMod] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ])

      const autoTable = autoTableMod.default

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const pageW = doc.internal.pageSize.getWidth()
      const marginX = 14

      // Header banner
      doc.setFillColor(37, 99, 235) // blue-600
      doc.rect(0, 0, pageW, 26, "F")
      doc.setTextColor(255, 255, 255)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(16)
      doc.text("Laporan Target Operasi", marginX, 12)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(10)
      doc.text("Sistem TO Generator — PLN ICON+", marginX, 19)

      // Meta box
      doc.setTextColor(15, 23, 42)
      doc.setFontSize(10)
      let y = 36
      const periodeStr = `${new Date(data.range.from).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })} — ${new Date(data.range.to).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })}`
      doc.setFont("helvetica", "bold")
      doc.text("Periode Laporan:", marginX, y)
      doc.setFont("helvetica", "normal")
      doc.text(periodeStr, marginX + 38, y)

      y += 6
      doc.setFont("helvetica", "bold")
      doc.text("Dicetak oleh:", marginX, y)
      doc.setFont("helvetica", "normal")
      doc.text(
        `${userName} — ${new Date().toLocaleString("id-ID")}`,
        marginX + 38,
        y
      )

      // KPI block
      y += 10
      doc.setFont("helvetica", "bold")
      doc.setFontSize(12)
      doc.text("Ringkasan KPI", marginX, y)
      y += 4

      autoTable(doc, {
        startY: y,
        head: [["Indikator", "Nilai"]],
        body: [
          ["Total TO (periode)", data.kpi.totalInRange.toString()],
          ["Pending", data.kpi.pending.toString()],
          ["Diproses", data.kpi.diproses.toString()],
          ["Selesai", data.kpi.selesai.toString()],
          ["Dibatalkan", data.kpi.dibatalkan.toString()],
          ["Success Rate", `${data.kpi.successRate}%`],
          ["Total TO (sepanjang waktu)", data.kpi.totalAllTime.toString()],
          ["Total Pelanggan", data.kpi.totalPelanggan.toString()],
          ["Data Pemakaian", data.kpi.totalPemakaian.toString()],
          ["TO Historis", data.kpi.totalToHistoris.toString()],
        ],
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: {
          fillColor: [37, 99, 235],
          textColor: 255,
          halign: "left",
        },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { halign: "right", cellWidth: 30 },
        },
        margin: { left: marginX, right: marginX },
      })

      // Breakdown by tipe
      type AutoTableDoc = typeof doc & { lastAutoTable?: { finalY: number } }
      const doc2 = doc as AutoTableDoc
      let nextY = (doc2.lastAutoTable?.finalY ?? y) + 10

      doc.setFont("helvetica", "bold")
      doc.setFontSize(12)
      doc.text("Breakdown per Tipe Anomali", marginX, nextY)
      nextY += 4
      autoTable(doc, {
        startY: nextY,
        head: [["Tipe Anomali", "Jumlah"]],
        body: (Object.keys(data.breakdown.tipe) as TipeAnomali[]).map((k) => [
          TIPE_LABEL[k],
          data.breakdown.tipe[k].toString(),
        ]),
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: {
          fillColor: [37, 99, 235],
          textColor: 255,
          halign: "left",
        },
        columnStyles: { 1: { halign: "right", cellWidth: 30 } },
        margin: { left: marginX, right: marginX },
      })

      // Detail table
      nextY = (doc2.lastAutoTable?.finalY ?? nextY) + 10
      if (nextY > 250) {
        doc.addPage()
        nextY = 20
      }
      doc.setFont("helvetica", "bold")
      doc.setFontSize(12)
      doc.text(`Detail Target Operasi (${data.table.length})`, marginX, nextY)
      nextY += 4

      autoTable(doc, {
        startY: nextY,
        head: [["No", "IDPEL", "Nama", "Tipe", "Skor", "Status", "Periode"]],
        body: data.table.map((t, i) => [
          (i + 1).toString(),
          t.pelanggan.idPelanggan,
          t.pelanggan.nama || "(kosong)",
          TIPE_LABEL[t.tipeAnomali],
          `${Math.round(t.skor * 100)}%`,
          STATUS_LABEL[t.status],
          t.periode,
        ]),
        theme: "striped",
        styles: { fontSize: 8, cellPadding: 1.5 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, halign: "left" },
        columnStyles: {
          0: { halign: "center", cellWidth: 10 },
          4: { halign: "center", cellWidth: 14 },
          5: { halign: "center", cellWidth: 22 },
          6: { halign: "center", cellWidth: 22 },
        },
        margin: { left: marginX, right: marginX },
        didDrawPage: () => {
          const page = doc.getNumberOfPages()
          doc.setFontSize(8)
          doc.setTextColor(120, 120, 120)
          doc.text(
            `Halaman ${page}`,
            pageW - marginX,
            doc.internal.pageSize.getHeight() - 6,
            { align: "right" }
          )
        },
      })

      const filename = `laporan-TO-${data.range.from.slice(0, 10)}_to_${data.range.to.slice(0, 10)}.pdf`
      doc.save(filename)

      toast.success("Laporan PDF berhasil diunduh")
    } catch (err) {
      console.error(err)
      toast.error("Gagal mengekspor PDF", {
        description: err instanceof Error ? err.message : "Error",
      })
    } finally {
      setIsExporting(false)
    }
  }

  async function handleExportExcel() {
    if (!data) return
    setIsExportingExcel(true)
    try {
      const XLSX = await import("xlsx")
 
      const wb = XLSX.utils.book_new()
 
      // ── Sheet 1: Ringkasan KPI ──────────────────────────────────────────────
      const kpiRows = [
        ["Laporan Target Operasi — TO Generator PLN ICON+"],
        [],
        [
          "Periode",
          `${new Date(data.range.from).toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })} — ${new Date(data.range.to).toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}`,
        ],
        [
          "Dicetak oleh",
          `${userName} — ${new Date().toLocaleString("id-ID")}`,
        ],
        [],
        ["RINGKASAN KPI", ""],
        ["Total TO (periode)", data.kpi.totalInRange],
        ["Pending", data.kpi.pending],
        ["Diproses", data.kpi.diproses],
        ["Selesai", data.kpi.selesai],
        ["Dibatalkan", data.kpi.dibatalkan],
        ["Success Rate (%)", data.kpi.successRate],
        ["Total TO (sepanjang waktu)", data.kpi.totalAllTime],
        ["Total Pelanggan", data.kpi.totalPelanggan],
        ["Data Pemakaian", data.kpi.totalPemakaian],
        ["TO Historis", data.kpi.totalToHistoris],
      ]
      const wsKpi = XLSX.utils.aoa_to_sheet(kpiRows)
      wsKpi["!cols"] = [{ wch: 34 }, { wch: 50 }]
      XLSX.utils.book_append_sheet(wb, wsKpi, "Ringkasan")
 
      // ── Sheet 2: Breakdown Tipe Anomali ─────────────────────────────────────
      const tipeLabel: Record<string, string> = {
        TURUN_DRASTIS: "Turun Drastis",
        STAGNAN: "Stagnan",
        NOL_PEMAKAIAN: "Nol Pemakaian",
        LONJAKAN: "Lonjakan",
        POLA_TIDAK_WAJAR: "Pola Tidak Wajar",
      }
      const tipeRows: (string | number)[][] = [
        ["Tipe Anomali", "Jumlah TO"],
        ...Object.entries(data.breakdown.tipe).map(([k, v]) => [
          tipeLabel[k] ?? k,
          v,
        ]),
      ]
      const wsTipe = XLSX.utils.aoa_to_sheet(tipeRows)
      wsTipe["!cols"] = [{ wch: 24 }, { wch: 14 }]
      XLSX.utils.book_append_sheet(wb, wsTipe, "Breakdown Tipe")
 
      // ── Sheet 3: Tren Harian ─────────────────────────────────────────────────
      const seriesRows: (string | number)[][] = [
        ["Tanggal", "TO Dibuat", "TO Selesai"],
        ...data.series.map((s) => [s.date, s.total, s.selesai]),
      ]
      const wsSeries = XLSX.utils.aoa_to_sheet(seriesRows)
      wsSeries["!cols"] = [{ wch: 14 }, { wch: 14 }, { wch: 14 }]
      XLSX.utils.book_append_sheet(wb, wsSeries, "Tren Harian")
 
      // ── Sheet 4: Detail TO ────────────────────────────────────────────────────
      const statusLabel: Record<string, string> = {
        PENDING: "Pending",
        DIPROSES: "Diproses",
        SELESAI: "Selesai",
        DIBATALKAN: "Dibatalkan",
      }
      const detailRows: (string | number)[][] = [
        [
          "No",
          "IDPEL",
          "Nama Pelanggan",
          "Tarif",
          "Daya (VA)",
          "Lokasi",
          "Tipe Anomali",
          "Alasan",
          "Skor (%)",
          "Status",
          "Periode",
          "Tanggal Dibuat",
        ],
        ...data.table.map((t, i) => [
          i + 1,
          t.pelanggan.idPelanggan,
          t.pelanggan.nama || "",
          t.pelanggan.tarif,
          t.pelanggan.daya,
          t.pelanggan.lokasi,
          tipeLabel[t.tipeAnomali] ?? t.tipeAnomali,
          t.alasan,
          Math.round(t.skor * 100),
          statusLabel[t.status] ?? t.status,
          t.periode,
          new Date(t.createdAt).toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }),
        ]),
      ]
      const wsDetail = XLSX.utils.aoa_to_sheet(detailRows)
      wsDetail["!cols"] = [
        { wch: 5 },   // No
        { wch: 16 },  // IDPEL
        { wch: 30 },  // Nama
        { wch: 8 },   // Tarif
        { wch: 10 },  // Daya
        { wch: 30 },  // Lokasi
        { wch: 20 },  // Tipe
        { wch: 60 },  // Alasan
        { wch: 10 },  // Skor
        { wch: 12 },  // Status
        { wch: 12 },  // Periode
        { wch: 16 },  // Tanggal
      ]
      XLSX.utils.book_append_sheet(wb, wsDetail, "Detail TO")
 
      const filename = `laporan-TO-${data.range.from.slice(0, 10)}_sd_${data.range.to.slice(0, 10)}.xlsx`
      XLSX.writeFile(wb, filename)
 
      toast.success("Laporan Excel berhasil diunduh", {
        description: `${data.table.length} TO diekspor ke 4 sheet`,
      })
    } catch (err) {
      console.error(err)
      toast.error("Gagal mengekspor Excel", {
        description: err instanceof Error ? err.message : "Error",
      })
    } finally {
      setIsExportingExcel(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <Card data-testid="laporan-filter">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                Pilih periode
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { key: "today", label: "Hari Ini" },
                    { key: "this-week", label: "Minggu Ini" },
                    { key: "this-month", label: "Bulan Ini" },
                    { key: "last-month", label: "Bulan Lalu" },
                    { key: "this-year", label: "Tahun Ini" },
                    { key: "custom", label: "Custom" },
                  ] as Array<{ key: PresetKey; label: string }>
                ).map((p) => (
                  <Button
                    key={p.key}
                    size="sm"
                    variant={preset === p.key ? "default" : "outline"}
                    onClick={() => applyPreset(p.key)}
                    className={
                      preset === p.key ? "bg-blue-600 hover:bg-blue-700" : ""
                    }
                    data-testid={`preset-${p.key}`}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  Dari
                </label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value)
                    setPreset("custom")
                  }}
                  className="h-9 px-3 rounded-md border border-input bg-background text-sm"
                  data-testid="from-date"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  Sampai
                </label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value)
                    setPreset("custom")
                  }}
                  className="h-9 px-3 rounded-md border border-input bg-background text-sm"
                  data-testid="to-date"
                />
              </div>
              <Button
                onClick={fetchData}
                variant="outline"
                size="sm"
                disabled={isLoading}
                data-testid="refresh-laporan"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`}
                />
                Muat ulang
              </Button>
              <Button
                onClick={handleExportExcel}
                size="sm"
                disabled={!data || isExportingExcel || isLoading}
                className="bg-green-600 hover:bg-green-700 text-white"
                data-testid="export-excel-button"
              >
                {isExportingExcel ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Menyiapkan...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="h-4 w-4 mr-1" />
                    Export Excel
                  </>
                )}
              </Button>
              <Button
                onClick={handleExportPdf}
                size="sm"
                disabled={!data || isExporting || isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="export-pdf-button"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Menyiapkan...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-1" />
                    Export PDF
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading && !data ? (
        <Card>
          <CardContent className="p-12 flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-sm text-muted-foreground">Memuat laporan...</p>
          </CardContent>
        </Card>
      ) : data ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Kpi
              label="Total TO"
              value={data.kpi.totalInRange}
              icon={TargetIcon}
              color="blue"
              testid="kpi-total"
            />
            <Kpi
              label="Pending"
              value={data.kpi.pending}
              icon={Clock}
              color="amber"
              testid="kpi-pending"
            />
            <Kpi
              label="Diproses"
              value={data.kpi.diproses}
              icon={Activity}
              color="purple"
              testid="kpi-diproses"
            />
            <Kpi
              label="Selesai"
              value={data.kpi.selesai}
              icon={CheckCircle2}
              color="green"
              testid="kpi-selesai"
            />
            <Kpi
              label="Success Rate"
              value={data.kpi.successRate}
              suffix="%"
              icon={TrendingUp}
              color="cyan"
              testid="kpi-success-rate"
            />
            <Kpi
              label="Dibatalkan"
              value={data.kpi.dibatalkan}
              icon={AlertTriangle}
              color="slate"
              testid="kpi-dibatalkan"
            />
          </div>

          {/* Global stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniStat
              label="Total Pelanggan"
              value={data.kpi.totalPelanggan}
              icon={Users}
            />
            <MiniStat
              label="Data Pemakaian"
              value={data.kpi.totalPemakaian}
              icon={BarChart3}
            />
            <MiniStat
              label="TO Historis"
              value={data.kpi.totalToHistoris}
              icon={AlertTriangle}
            />
            <MiniStat
              label="TO Sepanjang Waktu"
              value={data.kpi.totalAllTime}
              icon={FileText}
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card data-testid="chart-status">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-blue-600" />
                  Distribusi Status TO
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statusPie.length === 0 ? (
                  <EmptyChart message="Belum ada TO di periode ini" />
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusPie}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {statusPie.map((entry) => (
                            <Cell
                              key={entry.key}
                              fill={STATUS_COLORS[entry.key as StatusTO]}
                            />
                          ))}
                        </Pie>
                        <RTooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="chart-tipe">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-blue-600" />
                  TO per Tipe Anomali
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tipeBar.every((d) => d.jumlah === 0) ? (
                  <EmptyChart message="Belum ada anomali terdeteksi" />
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={tipeBar}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10 }}
                          interval={0}
                          angle={-15}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <RTooltip />
                        <Bar dataKey="jumlah" radius={[4, 4, 0, 0]}>
                          {tipeBar.map((entry) => (
                            <Cell
                              key={entry.key}
                              fill={TIPE_COLORS[entry.key as TipeAnomali]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Time series */}
          <Card data-testid="chart-series">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                Tren Harian
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.series.every((d) => d.total === 0) ? (
                <EmptyChart message="Belum ada aktivitas TO di periode ini" />
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.series}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(d) => d.slice(5)}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <RTooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="total"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        name="TO Dibuat"
                      />
                      <Line
                        type="monotone"
                        dataKey="selesai"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        name="TO Selesai"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Detail table */}
          <Card data-testid="laporan-table">
            <CardHeader>
              <CardTitle className="text-base">
                Detail Target Operasi ({data.table.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.table.length === 0 ? (
                <div className="p-12 text-center">
                  <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Tidak ada TO pada periode ini
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 border-y">
                      <tr>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold w-12">
                          No
                        </th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold">
                          IDPEL
                        </th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold">
                          Nama
                        </th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold">
                          Tipe
                        </th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold">
                          Skor
                        </th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold">
                          Status
                        </th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold">
                          Periode
                        </th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold">
                          Tanggal
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.table.map((t, i) => (
                        <tr
                          key={t.id}
                          className="border-b hover:bg-slate-50 dark:hover:bg-slate-800/30"
                        >
                          <td className="px-3 py-2.5 text-sm text-muted-foreground">
                            {i + 1}
                          </td>
                          <td className="px-3 py-2.5 text-sm font-mono">
                            {t.pelanggan.idPelanggan}
                          </td>
                          <td className="px-3 py-2.5 text-sm">
                            {t.pelanggan.nama || (
                              <span className="italic text-muted-foreground">
                                (kosong)
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-xs">
                            <span
                              className="inline-flex px-2 py-0.5 rounded-md font-medium"
                              style={{
                                backgroundColor:
                                  TIPE_COLORS[t.tipeAnomali] + "22",
                                color: TIPE_COLORS[t.tipeAnomali],
                              }}
                            >
                              {TIPE_LABEL[t.tipeAnomali]}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center text-sm font-semibold">
                            {Math.round(t.skor * 100)}%
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${STATUS_BADGE[t.status]}`}
                            >
                              {STATUS_LABEL[t.status]}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">
                            {t.periode}
                          </td>
                          <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">
                            {new Date(t.createdAt).toLocaleDateString("id-ID", {
                              day: "2-digit",
                              month: "short",
                              year: "2-digit",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}

function Kpi({
  label,
  value,
  icon: Icon,
  color,
  suffix,
  testid,
}: {
  label: string
  value: number
  icon: typeof TargetIcon
  color: "blue" | "amber" | "green" | "purple" | "cyan" | "slate"
  suffix?: string
  testid: string
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
    amber: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
    green: "bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400",
    purple:
      "bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
    cyan: "bg-cyan-100 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400",
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  }

  return (
    <Card data-testid={testid}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <div
            className={`h-8 w-8 rounded-lg flex items-center justify-center ${colorMap[color]}`}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="text-2xl font-bold">
          {value.toLocaleString("id-ID")}
          {suffix ? (
            <span className="text-sm text-muted-foreground ml-0.5">
              {suffix}
            </span>
          ) : null}
        </p>
      </CardContent>
    </Card>
  )
}

function MiniStat({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: typeof TargetIcon
}) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <div className="h-9 w-9 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-base font-semibold">
            {value.toLocaleString("id-ID")}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-72 flex items-center justify-center text-center">
      <div>
        <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}
