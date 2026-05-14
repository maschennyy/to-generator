"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import {
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Target as TargetIcon,
  CheckCircle2,
  Clock,
  Activity,
  XCircle,
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { TargetOperasiRow, type TargetOperasiItem } from "./target-operasi-row"

interface Stats {
  total: number
  counts: {
    PENDING: number
    DIPROSES: number
    SELESAI: number
    DIBATALKAN: number
  }
}

interface Props {
  canGenerate: boolean
  isAdmin: boolean
}

const TIPE_OPTIONS = [
  { value: "", label: "Semua Tipe" },
  { value: "TURUN_DRASTIS", label: "Turun Drastis" },
  { value: "STAGNAN", label: "Stagnan" },
  { value: "NOL_PEMAKAIAN", label: "Nol Pemakaian" },
  { value: "LONJAKAN", label: "Lonjakan" },
  { value: "POLA_TIDAK_WAJAR", label: "Pola Tidak Wajar" },
]

const STATUS_OPTIONS = [
  { value: "", label: "Semua Status" },
  { value: "PENDING", label: "Pending" },
  { value: "DIPROSES", label: "Diproses" },
  { value: "SELESAI", label: "Selesai" },
  { value: "DIBATALKAN", label: "Dibatalkan" },
]

const TIPE_LABEL: Record<string, string> = {
  TURUN_DRASTIS: "Turun Drastis",
  STAGNAN: "Stagnan",
  NOL_PEMAKAIAN: "Nol Pemakaian",
  LONJAKAN: "Lonjakan",
  POLA_TIDAK_WAJAR: "Pola Tidak Wajar",
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  DIPROSES: "Diproses",
  SELESAI: "Selesai",
  DIBATALKAN: "Dibatalkan",
}

export function TargetOperasiClient({ canGenerate, isAdmin }: Props) {
  const [data, setData] = useState<TargetOperasiItem[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [filterTipe, setFilterTipe] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [isGenerating, setIsGenerating] = useState(false)
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        search,
        page: page.toString(),
        limit: "20",
      })
      if (filterStatus) params.append("status", filterStatus)
      if (filterTipe) params.append("tipe", filterTipe)

      const res = await fetch(`/api/target-operasi?${params}`)
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || "Gagal memuat")

      setData(result.data)
      setStats(result.stats)
      setTotalPages(result.pagination.totalPages)
      setTotal(result.pagination.total)
    } catch (err) {
      console.error(err)
      toast.error("Gagal memuat data Target Operasi")
    } finally {
      setIsLoading(false)
    }
  }, [search, page, filterStatus, filterTipe])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleGenerate() {
    setIsGenerating(true)
    try {
      const res = await fetch("/api/target-operasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replaceExistingPending: true }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || "Gagal generate")

      // Background job — langsung return 202
      toast.success("Generate TO dimulai di latar belakang", {
        description: `${result.total.toLocaleString("id-ID")} pelanggan sedang dianalisis. Kamu bebas navigasi ke halaman lain.`,
        duration: 5000,
      })
      setShowGenerateConfirm(false)
    } catch (err) {
      console.error(err)
      toast.error("Gagal memulai Generate TO", {
        description: err instanceof Error ? err.message : "Error",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleExportExcel() {
    setIsExporting(true)
    try {
      // Ambil SEMUA data sesuai filter aktif (tanpa pagination)
      const params = new URLSearchParams({ search, limit: "9999", page: "1" })
      if (filterStatus) params.append("status", filterStatus)
      if (filterTipe) params.append("tipe", filterTipe)

      const res = await fetch(`/api/target-operasi?${params}`)
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || "Gagal mengambil data")

      const allData: TargetOperasiItem[] = result.data

      if (allData.length === 0) {
        toast.error("Tidak ada data untuk diekspor")
        return
      }

      const XLSX = await import("xlsx")
      const wb = XLSX.utils.book_new()

      // ── Sheet 1: Daftar TO ──────────────────────────────────────────────────
      const now = new Date()
      const headerInfo = [
        ["Daftar Target Operasi — TO Generator PLN ICON+"],
        [
          "Diekspor pada:",
          now.toLocaleString("id-ID", {
            day: "2-digit",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
        ],
        [
          "Filter aktif:",
          [
            search ? `Pencarian: "${search}"` : "",
            filterTipe ? `Tipe: ${TIPE_LABEL[filterTipe]}` : "",
            filterStatus ? `Status: ${STATUS_LABEL[filterStatus]}` : "",
          ]
            .filter(Boolean)
            .join(", ") || "Semua data",
        ],
        ["Total baris:", allData.length],
        [],
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
          "TO Historis",
          "Tanggal Generate",
        ],
        ...allData.map((item, i) => [
          i + 1,
          item.pelanggan.idPelanggan,
          item.pelanggan.nama || "",
          item.pelanggan.tarif,
          item.pelanggan.daya,
          item.pelanggan.lokasi,
          TIPE_LABEL[item.tipeAnomali] ?? item.tipeAnomali,
          item.alasan,
          Math.round(item.skor * 100),
          STATUS_LABEL[item.status] ?? item.status,
          item.periode,
          item.pelanggan.isToHistory ? "Ya" : "Tidak",
          new Date(item.createdAt).toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }),
        ]),
      ]

      const wsTO = XLSX.utils.aoa_to_sheet(headerInfo)
      wsTO["!cols"] = [
        { wch: 5 },   // No
        { wch: 16 },  // IDPEL
        { wch: 28 },  // Nama
        { wch: 8 },   // Tarif
        { wch: 10 },  // Daya
        { wch: 28 },  // Lokasi
        { wch: 20 },  // Tipe
        { wch: 60 },  // Alasan
        { wch: 10 },  // Skor
        { wch: 12 },  // Status
        { wch: 12 },  // Periode
        { wch: 12 },  // TO Historis
        { wch: 16 },  // Tanggal
      ]
      XLSX.utils.book_append_sheet(wb, wsTO, "Daftar TO")

      // ── Sheet 2: Rekapitulasi per Tipe ──────────────────────────────────────
      const rekapTipe = new Map<string, number>()
      for (const item of allData) {
        rekapTipe.set(item.tipeAnomali, (rekapTipe.get(item.tipeAnomali) ?? 0) + 1)
      }

      const rekapRows: (string | number)[][] = [
        ["Rekapitulasi per Tipe Anomali"],
        [],
        ["Tipe Anomali", "Jumlah TO", "Persentase (%)"],
        ...Array.from(rekapTipe.entries()).map(([tipe, count]) => [
          TIPE_LABEL[tipe] ?? tipe,
          count,
          Math.round((count / allData.length) * 100),
        ]),
        [],
        ["TOTAL", allData.length, 100],
      ]

      const wsRekap = XLSX.utils.aoa_to_sheet(rekapRows)
      wsRekap["!cols"] = [{ wch: 24 }, { wch: 14 }, { wch: 18 }]
      XLSX.utils.book_append_sheet(wb, wsRekap, "Rekap Tipe")

      // ── Sheet 3: Rekapitulasi per Status ────────────────────────────────────
      const rekapStatus = new Map<string, number>()
      for (const item of allData) {
        rekapStatus.set(item.status, (rekapStatus.get(item.status) ?? 0) + 1)
      }

      const rekapStatusRows: (string | number)[][] = [
        ["Rekapitulasi per Status"],
        [],
        ["Status", "Jumlah TO", "Persentase (%)"],
        ...Array.from(rekapStatus.entries()).map(([status, count]) => [
          STATUS_LABEL[status] ?? status,
          count,
          Math.round((count / allData.length) * 100),
        ]),
        [],
        ["TOTAL", allData.length, 100],
      ]

      const wsStatus = XLSX.utils.aoa_to_sheet(rekapStatusRows)
      wsStatus["!cols"] = [{ wch: 16 }, { wch: 14 }, { wch: 18 }]
      XLSX.utils.book_append_sheet(wb, wsStatus, "Rekap Status")

      // ── Nama file ────────────────────────────────────────────────────────────
      const parts = ["TO"]
      if (filterTipe) parts.push(TIPE_LABEL[filterTipe].replace(/\s/g, "-"))
      if (filterStatus) parts.push(STATUS_LABEL[filterStatus])
      if (search) parts.push(`cari-${search.slice(0, 10)}`)
      const tgl = now.toISOString().slice(0, 10)
      const filename = `${parts.join("_")}_${tgl}.xlsx`

      XLSX.writeFile(wb, filename)

      toast.success("Export Excel berhasil", {
        description: `${allData.length.toLocaleString("id-ID")} TO diekspor ke 3 sheet`,
      })
    } catch (err) {
      console.error(err)
      toast.error("Gagal mengekspor Excel", {
        description: err instanceof Error ? err.message : "Error",
      })
    } finally {
      setIsExporting(false)
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput)
  }

  function resetFilters() {
    setSearchInput("")
    setSearch("")
    setFilterStatus("")
    setFilterTipe("")
    setPage(1)
  }

  const hasActiveFilters = search || filterStatus || filterTipe

  return (
    <div className="space-y-5">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total TO" value={stats?.total ?? 0} icon={TargetIcon} color="blue" testid="stat-total" />
        <StatCard label="Pending" value={stats?.counts.PENDING ?? 0} icon={Clock} color="amber" testid="stat-pending" />
        <StatCard label="Diproses" value={stats?.counts.DIPROSES ?? 0} icon={Activity} color="purple" testid="stat-diproses" />
        <StatCard label="Selesai" value={stats?.counts.SELESAI ?? 0} icon={CheckCircle2} color="green" testid="stat-selesai" />
      </div>

      {/* Action bar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <form onSubmit={handleSearchSubmit} className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Cari IDPEL, nama, atau lokasi..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
              data-testid="to-search-input"
            />
          </div>
          <Button type="submit" variant="secondary" data-testid="to-search-button">
            Cari
          </Button>
        </form>

        <div className="flex items-center gap-2 shrink-0">
          {/* Export Excel — selalu tampil jika ada data */}
          <Button
            variant="outline"
            onClick={handleExportExcel}
            disabled={isExporting || total === 0}
            className="border-green-600 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950/30"
          >
            {isExporting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyiapkan...</>
            ) : (
              <><FileSpreadsheet className="mr-2 h-4 w-4" />Export Excel{hasActiveFilters ? " (Terfilter)" : ""}</>
            )}
          </Button>

          {canGenerate && (
            <Button
              onClick={() => setShowGenerateConfirm(true)}
              disabled={isGenerating}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              data-testid="generate-to-button"
            >
              {isGenerating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menganalisis...</>
              ) : (
                <><Sparkles className="mr-2 h-4 w-4" />Generate TO</>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }}
          className="h-9 px-3 rounded-md border border-input bg-background text-sm"
          data-testid="filter-status"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={filterTipe}
          onChange={(e) => { setFilterTipe(e.target.value); setPage(1) }}
          className="h-9 px-3 rounded-md border border-input bg-background text-sm"
          data-testid="filter-tipe"
        >
          {TIPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={resetFilters} data-testid="reset-filters-button">
            <RefreshCw className="h-3 w-3 mr-1" />
            Reset
          </Button>
        )}

        <span className="ml-auto text-sm text-muted-foreground">
          {hasActiveFilters
            ? `${total.toLocaleString("id-ID")} TO (terfilter)`
            : `${total.toLocaleString("id-ID")} TO`}
        </span>
      </div>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Memuat...</span>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center p-16" data-testid="to-empty-state">
            <TargetIcon className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">Belum ada Target Operasi</p>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              {hasActiveFilters
                ? "Tidak ada TO yang cocok dengan filter ini. Coba ubah atau reset filter."
                : canGenerate
                ? "Klik tombol Generate TO untuk menjalankan deteksi anomali otomatis."
                : "Hubungi Admin atau SPV untuk men-generate Target Operasi."}
            </p>
            {canGenerate && !hasActiveFilters && (
              <Button
                className="mt-4 bg-blue-600 hover:bg-blue-700"
                onClick={() => setShowGenerateConfirm(true)}
                data-testid="generate-to-empty-button"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Generate TO Sekarang
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-semibold w-12">No</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold">IDPEL</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold">Nama</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold">Tipe Anomali</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold">Alasan</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold">Skor</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold">Periode</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold">Status</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold w-32">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, index) => (
                  <TargetOperasiRow
                    key={item.id}
                    item={item}
                    index={(page - 1) * 20 + index}
                    canEdit={canGenerate}
                    isAdmin={isAdmin}
                    onChange={fetchData}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Halaman {page} dari {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 1} data-testid="to-page-prev">
              <ChevronLeft className="h-4 w-4" />
              Sebelumnya
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page === totalPages} data-testid="to-page-next">
              Berikutnya
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Generate Confirm Dialog */}
      <AlertDialog open={showGenerateConfirm} onOpenChange={setShowGenerateConfirm}>
        <AlertDialogContent data-testid="generate-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              Jalankan Deteksi Target Operasi?
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-2">
                <span className="block">
                  Sistem akan menganalisis seluruh data pemakaian pelanggan dan mendeteksi pola anomali:
                </span>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  <li>Turun drastis &lt; 50% rata-rata 6 bulan</li>
                  <li>Stagnan 3 bulan berturut-turut</li>
                  <li>0 kWh selama 2 bulan</li>
                  <li>Lonjakan &gt; 300% dari bulan sebelumnya</li>
                  <li>Pola tidak wajar (zigzag, meter statis, penurunan bertahap)</li>
                </ul>
                <span className="block text-xs text-muted-foreground pt-2">
                  Proses berjalan di <strong>latar belakang</strong> — kamu bebas navigasi ke
                  halaman lain. Progress ditampilkan di banner bawah.
                </span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isGenerating}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleGenerate}
              disabled={isGenerating}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="confirm-generate-button"
            >
              {isGenerating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Memulai...</>
              ) : (
                <><Sparkles className="mr-2 h-4 w-4" />Jalankan Sekarang</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function StatCard({
  label, value, icon: Icon, color, testid,
}: {
  label: string
  value: number
  icon: typeof TargetIcon
  color: "blue" | "amber" | "purple" | "green"
  testid: string
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
    amber: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
    purple: "bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
    green: "bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400",
  }

  return (
    <Card data-testid={testid}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-muted-foreground">{label}</p>
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="text-2xl font-bold">{value.toLocaleString("id-ID")}</p>
      </CardContent>
    </Card>
  )
}

export { AlertTriangle, XCircle }
