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
  CheckSquare,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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

  // ── Bulk selection state ────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBulkDialog, setShowBulkDialog] = useState(false)
  const [bulkStatus, setBulkStatus] = useState<string>("DIPROSES")
  const [bulkCatatan, setBulkCatatan] = useState("")
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)

  const allPageIds = data.map((d) => d.id)
  const allSelected =
    allPageIds.length > 0 && allPageIds.every((id) => selectedIds.has(id))
  const someSelected = selectedIds.size > 0

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

  // Reset selection saat data berubah (filter/page)
  useEffect(() => {
    setSelectedIds(new Set())
  }, [search, page, filterStatus, filterTipe])

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (allSelected) {
      // Deselect semua di halaman ini
      setSelectedIds((prev) => {
        const next = new Set(prev)
        allPageIds.forEach((id) => next.delete(id))
        return next
      })
    } else {
      // Select semua di halaman ini
      setSelectedIds((prev) => {
        const next = new Set(prev)
        allPageIds.forEach((id) => next.add(id))
        return next
      })
    }
  }

  async function handleBulkUpdate() {
    if (selectedIds.size === 0) return
    setIsBulkUpdating(true)
    try {
      const res = await fetch("/api/target-operasi/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          status: bulkStatus,
          catatan: bulkCatatan.trim() || null,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)

      toast.success(`${result.updated} TO berhasil diperbarui`, {
        description: `Status diubah menjadi ${STATUS_LABEL[bulkStatus]}`,
      })
      setShowBulkDialog(false)
      setSelectedIds(new Set())
      setBulkCatatan("")
      fetchData()
    } catch (err) {
      toast.error("Gagal update massal", {
        description: err instanceof Error ? err.message : "Error",
      })
    } finally {
      setIsBulkUpdating(false)
    }
  }

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

      toast.success("Generate TO dimulai di latar belakang", {
        description: `${result.total.toLocaleString("id-ID")} pelanggan sedang dianalisis.`,
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
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (filterStatus) params.set("status", filterStatus)
      if (filterTipe) params.set("tipe", filterTipe)

      const response = await fetch(`/api/target-operasi/export?${params}`)
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || "Gagal mengekspor")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      document.body.appendChild(a)
      a.href = url
      a.download = `TO_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast.success("Export Excel berhasil")
    } catch (err) {
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
            />
          </div>
          <Button type="submit" variant="secondary">Cari</Button>
        </form>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={handleExportExcel}
            disabled={isExporting || total === 0}
            className="border-green-600 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950/30"
          >
            {isExporting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyiapkan...</>
            ) : (
              <><FileSpreadsheet className="mr-2 h-4 w-4" />Export Excel</>
            )}
          </Button>

          {canGenerate && (
            <Button
              onClick={() => setShowGenerateConfirm(true)}
              disabled={isGenerating}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
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
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={filterTipe}
          onChange={(e) => { setFilterTipe(e.target.value); setPage(1) }}
          className="h-9 px-3 rounded-md border border-input bg-background text-sm"
        >
          {TIPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={resetFilters}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Reset
          </Button>
        )}

        <span className="ml-auto text-sm text-muted-foreground">
          {total.toLocaleString("id-ID")} TO
        </span>
      </div>

      {/* ── Bulk action toolbar — muncul saat ada yang dipilih ── */}
      {canGenerate && someSelected && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
          <CheckSquare className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {selectedIds.size} TO dipilih
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedIds(new Set())}
              className="text-slate-600"
            >
              Batal Pilih
            </Button>
            <Button
              size="sm"
              onClick={() => setShowBulkDialog(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Update Status Terpilih
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Memuat...</span>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center p-16">
            <TargetIcon className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">Belum ada Target Operasi</p>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              {hasActiveFilters
                ? "Tidak ada TO yang cocok. Coba ubah atau reset filter."
                : canGenerate
                ? "Klik tombol Generate TO untuk menjalankan deteksi anomali otomatis."
                : "Hubungi Admin atau SPV untuk men-generate Target Operasi."}
            </p>
            {canGenerate && !hasActiveFilters && (
              <Button
                className="mt-4 bg-blue-600 hover:bg-blue-700"
                onClick={() => setShowGenerateConfirm(true)}
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
                  {/* Checkbox select all */}
                  {canGenerate && (
                    <th className="px-3 py-3 w-10">
                      <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Pilih semua di halaman ini"
                    />
                    </th>
                  )}
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
                    selected={selectedIds.has(item.id)}
                    onToggleSelect={toggleSelect}
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
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4" />
              Sebelumnya
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page === totalPages}>
              Berikutnya
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Bulk Update Dialog ───────────────────────────────────────────── */}
      <AlertDialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-blue-600" />
              Update {selectedIds.size} Target Operasi
            </AlertDialogTitle>
            <AlertDialogDescription>
              Semua TO yang dipilih akan diubah statusnya sekaligus.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Status Baru <span className="text-red-500">*</span>
              </label>
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="PENDING">Pending</option>
                <option value="DIPROSES">Diproses</option>
                <option value="SELESAI">Selesai</option>
                <option value="DIBATALKAN">Dibatalkan</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Catatan (opsional — berlaku untuk semua TO terpilih)
              </label>
              <textarea
                value={bulkCatatan}
                onChange={(e) => setBulkCatatan(e.target.value)}
                placeholder="Catatan hasil tindak lanjut..."
                className="w-full min-h-[80px] p-3 rounded-md border border-input bg-background text-sm"
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkUpdating}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkUpdate}
              disabled={isBulkUpdating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isBulkUpdating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyimpan...</>
              ) : (
                `Update ${selectedIds.size} TO`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Generate Confirm Dialog */}
      <AlertDialog open={showGenerateConfirm} onOpenChange={setShowGenerateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              Jalankan Deteksi Target Operasi?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Sistem akan menganalisis seluruh data pemakaian pelanggan dan mendeteksi 5 pola anomali secara otomatis.
            </AlertDialogDescription>
            <div className="space-y-2 text-sm text-muted-foreground mt-2">
              <ul className="list-disc pl-5 space-y-1">
                <li>Turun drastis &lt; 50% rata-rata 6 bulan</li>
                <li>Stagnan 3 bulan berturut-turut</li>
                <li>0 kWh selama 2 bulan</li>
                <li>Lonjakan &gt; 300% dari bulan sebelumnya</li>
                <li>Pola tidak wajar (zigzag, meter statis, penurunan bertahap)</li>
              </ul>
              <p className="text-xs pt-1">
                Proses berjalan di <strong>latar belakang</strong> — kamu bebas navigasi ke halaman lain.
              </p>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isGenerating}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleGenerate}
              disabled={isGenerating}
              className="bg-blue-600 hover:bg-blue-700"
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
