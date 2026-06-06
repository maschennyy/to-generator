"use client"

import Link from "next/link"
import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import {
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Download,
  CalendarRange,
  X,
  SlidersHorizontal,
  ArrowUpDown,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { NAMA_BULAN_PENDEK, formatBulanTahun } from "@/lib/validations/pemakaian"
import { DAFTAR_TARIF } from "@/lib/validations/pelanggan"

interface PemakaianData {
  id: string
  idPelanggan: string
  nama: string
  tarif: string
  daya: number
  lokasi: string
  isToHistory: boolean
  dataLengkap: boolean
  pemakaian: Array<{ bulan: number; tahun: number; kwh: number | null }>
  rataRata: number
}

interface Month {
  bulan: number
  tahun: number
}

// Generate daftar tahun untuk dropdown (5 tahun ke belakang s.d. sekarang)
function getYearOptions() {
  const now = new Date()
  const years: number[] = []
  for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) {
    years.push(y)
  }
  return years
}

const YEAR_OPTIONS = getYearOptions()
const BULAN_OPTIONS = NAMA_BULAN_PENDEK.map((label, i) => ({
  value: i + 1,
  label,
}))

const STATUS_OPTIONS = [
  { value: "", label: "Semua status data" },
  { value: "to_historis", label: "Pernah TO historis" },
  { value: "belum_lengkap", label: "Data pelanggan belum lengkap" },
  { value: "lengkap", label: "Data pelanggan lengkap" },
]

const KWH_FILTER_OPTIONS = [
  { value: "", label: "Semua kondisi kWh" },
  { value: "ada_kwh_rentang", label: "Ada kWh di rentang tampil" },
  { value: "tanpa_kwh_rentang", label: "Tidak ada kWh di rentang tampil" },
  { value: "nol_kwh", label: "Ada 0 kWh di rentang tampil" },
]

const SORT_OPTIONS = [
  { value: "createdAt_desc", label: "Terbaru diinput" },
  { value: "idPelanggan_asc", label: "IDPEL A-Z" },
  { value: "idPelanggan_desc", label: "IDPEL Z-A" },
  { value: "nama_asc", label: "Nama A-Z" },
  { value: "nama_desc", label: "Nama Z-A" },
  { value: "tarif_asc", label: "Tarif A-Z" },
  { value: "daya_asc", label: "Daya terkecil" },
  { value: "daya_desc", label: "Daya terbesar" },
]

export function PemakaianTable() {
  const [data, setData] = useState<PemakaianData[]>([])
  const [months, setMonths] = useState<Month[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [isDownloading, setIsDownloading] = useState(false)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [tarifFilter, setTarifFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [kwhFilter, setKwhFilter] = useState("")
  const [dayaMin, setDayaMin] = useState("")
  const [dayaMax, setDayaMax] = useState("")
  const [sort, setSort] = useState("createdAt_desc")

  // Range filter — default kosong (pakai rolling 12 bulan otomatis)
  const now = new Date()
  const [dariBulan, setDariBulan] = useState<number>(0)
  const [dariTahun, setDariTahun] = useState<number>(0)
  const [sampaiBulan, setSampaiBulan] = useState<number>(0)
  const [sampaiTahun, setSampaiTahun] = useState<number>(0)
  const [showRangeFilter, setShowRangeFilter] = useState(false)

  const hasCustomRange =
    dariBulan > 0 && dariTahun > 0 && sampaiBulan > 0 && sampaiTahun > 0
  const hasAdvancedFilters =
    Boolean(tarifFilter || statusFilter || kwhFilter || dayaMin || dayaMax || sort !== "createdAt_desc")

  const appendFilterParams = useCallback((params: URLSearchParams) => {
    if (tarifFilter) params.set("tarif", tarifFilter)
    if (statusFilter) params.set("status", statusFilter)
    if (kwhFilter) params.set("kwhFilter", kwhFilter)
    if (dayaMin) params.set("dayaMin", dayaMin)
    if (dayaMax) params.set("dayaMax", dayaMax)
    if (sort) params.set("sort", sort)
  }, [tarifFilter, statusFilter, kwhFilter, dayaMin, dayaMax, sort])

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        search,
        page: page.toString(),
        limit: "20",
      })
      appendFilterParams(params)
      if (hasCustomRange) {
        params.set("dariBulan", dariBulan.toString())
        params.set("dariTahun", dariTahun.toString())
        params.set("sampaiBulan", sampaiBulan.toString())
        params.set("sampaiTahun", sampaiTahun.toString())
      }

      const response = await fetch(`/api/pemakaian?${params}`)
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)

      setData(result.data)
      setMonths(result.months)
      setTotalPages(result.pagination.totalPages)
      setTotal(result.pagination.total)
    } catch (error) {
      console.error(error)
      toast.error("Gagal memuat data pemakaian")
    } finally {
      setIsLoading(false)
    }
  }, [
    search,
    page,
    appendFilterParams,
    dariBulan,
    dariTahun,
    sampaiBulan,
    sampaiTahun,
    hasCustomRange,
  ])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput)
  }

  function applyRange() {
    if (!dariBulan || !dariTahun || !sampaiBulan || !sampaiTahun) {
      toast.error("Lengkapi semua field rentang bulan")
      return
    }
    const dariNum = dariTahun * 100 + dariBulan
    const sampaiNum = sampaiTahun * 100 + sampaiBulan
    if (dariNum > sampaiNum) {
      toast.error("Bulan awal tidak boleh lebih dari bulan akhir")
      return
    }
    setPage(1)
    setShowRangeFilter(false)
  }

  function resetRange() {
    setDariBulan(0)
    setDariTahun(0)
    setSampaiBulan(0)
    setSampaiTahun(0)
    setPage(1)
  }

  function applyAdvancedFilters() {
    if (dayaMin && dayaMax && Number(dayaMin) > Number(dayaMax)) {
      toast.error("Daya minimal tidak boleh lebih besar dari daya maksimal")
      return
    }
    setPage(1)
    setShowAdvancedFilters(false)
  }

  function resetAdvancedFilters() {
    setTarifFilter("")
    setStatusFilter("")
    setKwhFilter("")
    setDayaMin("")
    setDayaMax("")
    setSort("createdAt_desc")
    setPage(1)
  }

  // Set default range ke 1 tahun terakhir saat panel filter dibuka
  function openRangeFilter() {
    if (!hasCustomRange) {
      const end = new Date(now.getFullYear(), now.getMonth(), 1)
      const start = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1)
      setDariBulan(start.getMonth() + 1)
      setDariTahun(start.getFullYear())
      setSampaiBulan(end.getMonth() + 1)
      setSampaiTahun(end.getFullYear())
    }
    setShowRangeFilter((v) => !v)
  }

  async function handleDownload() {
    if (isDownloading) return
    setIsDownloading(true)

    const toastId = toast.loading("Menyiapkan export...")
    try {
      const params = new URLSearchParams({ search })
      appendFilterParams(params)
      if (hasCustomRange) {
        params.set("dariBulan", dariBulan.toString())
        params.set("dariTahun", dariTahun.toString())
        params.set("sampaiBulan", sampaiBulan.toString())
        params.set("sampaiTahun", sampaiTahun.toString())
      }

      const response = await fetch(`/api/pemakaian/export?${params}`)
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || "Gagal mengunduh")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      const today = new Date().toISOString().slice(0, 10)
      document.body.appendChild(a)
      a.href = url
      a.download = `data-pemakaian-${today}.xlsx`
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast.success("Data berhasil diunduh", { id: toastId })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal mengunduh",
        { id: toastId }
      )
    } finally {
      setIsDownloading(false)
    }
  }

  function getCellClass(kwh: number | null): string {
    if (kwh === null) return "text-muted-foreground text-center"
    if (kwh === 0) return "bg-red-50 text-red-700 font-semibold dark:bg-red-950/30 dark:text-red-400 text-right"
    return "text-right font-mono"
  }

  // Label rentang bulan yang aktif
  const rangeLabel = hasCustomRange
    ? `${NAMA_BULAN_PENDEK[dariBulan - 1]} ${dariTahun} – ${NAMA_BULAN_PENDEK[sampaiBulan - 1]} ${sampaiTahun}`
    : "12 bulan terakhir (otomatis)"

  return (
    <div className="space-y-4">
      {/* Search & Actions */}
      <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Cari ID pelanggan atau nama..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button type="submit" variant="secondary">Cari</Button>
      </form>

      {/* Range filter toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={openRangeFilter}
          className={hasCustomRange ? "border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400" : ""}
        >
          <CalendarRange className="h-4 w-4 mr-2" />
          {rangeLabel}
        </Button>
        {hasCustomRange && (
          <Button type="button" variant="ghost" size="sm" onClick={resetRange} className="text-muted-foreground">
            <X className="h-4 w-4 mr-1" />
            Reset ke otomatis
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowAdvancedFilters((v) => !v)}
          className={hasAdvancedFilters ? "border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400" : ""}
        >
          <SlidersHorizontal className="h-4 w-4 mr-2" />
          Filter & Urutkan
        </Button>
        {hasAdvancedFilters && (
          <Button type="button" variant="ghost" size="sm" onClick={resetAdvancedFilters} className="text-muted-foreground">
            <X className="h-4 w-4 mr-1" />
            Reset filter
          </Button>
        )}
      </div>

      {/* Range filter panel */}
      {showRangeFilter && (
        <div className="p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 space-y-3">
          <p className="text-sm font-medium">Pilih Rentang Bulan</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Dari Bulan</label>
              <div className="flex gap-2">
                <select
                  value={dariBulan}
                  onChange={(e) => setDariBulan(Number(e.target.value))}
                  className="flex-1 h-9 px-2 rounded-md border border-input bg-background text-sm"
                >
                  <option value={0}>Bulan</option>
                  {BULAN_OPTIONS.map((b) => (
                    <option key={b.value} value={b.value}>{b.label}</option>
                  ))}
                </select>
                <select
                  value={dariTahun}
                  onChange={(e) => setDariTahun(Number(e.target.value))}
                  className="flex-1 h-9 px-2 rounded-md border border-input bg-background text-sm"
                >
                  <option value={0}>Tahun</option>
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Sampai Bulan</label>
              <div className="flex gap-2">
                <select
                  value={sampaiBulan}
                  onChange={(e) => setSampaiBulan(Number(e.target.value))}
                  className="flex-1 h-9 px-2 rounded-md border border-input bg-background text-sm"
                >
                  <option value={0}>Bulan</option>
                  {BULAN_OPTIONS.map((b) => (
                    <option key={b.value} value={b.value}>{b.label}</option>
                  ))}
                </select>
                <select
                  value={sampaiTahun}
                  onChange={(e) => setSampaiTahun(Number(e.target.value))}
                  className="flex-1 h-9 px-2 rounded-md border border-input bg-background text-sm"
                >
                  <option value={0}>Tahun</option>
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowRangeFilter(false)}>
              Tutup
            </Button>
            <Button type="button" size="sm" onClick={applyRange}>
              Terapkan
            </Button>
          </div>
        </div>
      )}

      {showAdvancedFilters && (
        <div className="p-4 rounded-lg border bg-slate-50 dark:bg-slate-900/40 space-y-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-blue-600" />
            <p className="text-sm font-medium">Filter dan Urutkan Tabel</p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Tarif</label>
              <select
                value={tarifFilter}
                onChange={(e) => setTarifFilter(e.target.value)}
                className="w-full h-9 px-2 rounded-md border border-input bg-background text-sm"
              >
                <option value="">Semua tarif</option>
                {DAFTAR_TARIF.map((tarif) => (
                  <option key={tarif} value={tarif}>{tarif}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Status data</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full h-9 px-2 rounded-md border border-input bg-background text-sm"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Kondisi kWh</label>
              <select
                value={kwhFilter}
                onChange={(e) => setKwhFilter(e.target.value)}
                className="w-full h-9 px-2 rounded-md border border-input bg-background text-sm"
              >
                {KWH_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Daya min</label>
              <Input
                type="number"
                min="0"
                inputMode="numeric"
                value={dayaMin}
                onChange={(e) => setDayaMin(e.target.value)}
                placeholder="VA"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Daya max</label>
              <Input
                type="number"
                min="0"
                inputMode="numeric"
                value={dayaMax}
                onChange={(e) => setDayaMax(e.target.value)}
                placeholder="VA"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Urutkan</label>
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value)
                  setPage(1)
                }}
                className="w-full h-9 px-2 rounded-md border border-input bg-background text-sm"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={resetAdvancedFilters}>
              Reset
            </Button>
            <Button type="button" size="sm" onClick={applyAdvancedFilters}>
              Terapkan
            </Button>
          </div>
        </div>
      )}

      {/* Info + Download */}
      {!isLoading && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString("id-ID")} pelanggan · {months.length} bulan ditampilkan
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleDownload}
            disabled={isDownloading || total === 0}
            className="text-green-600 border-green-200 hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-950/30"
          >
            {isDownloading ? (
              <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Menyiapkan...</>
            ) : (
              <><Download className="h-4 w-4 mr-1" />Download Excel</>
            )}
          </Button>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-900" />
          <span className="text-muted-foreground">0 kWh (potensi anomali)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">—</span>
          <span className="text-muted-foreground">Data belum diinput</span>
        </div>
      </div>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Memuat data...</span>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center p-12">
            <p className="text-muted-foreground">Belum ada data pelanggan</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="px-3 py-3 text-left text-xs font-semibold sticky left-0 bg-slate-50 dark:bg-slate-800/50 z-10 min-w-[50px]">No</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold min-w-[140px]">
                    <SortableLabel label="ID Pelanggan" active={sort.startsWith("idPelanggan")} />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold min-w-[200px]">
                    <SortableLabel label="Nama" active={sort.startsWith("nama")} />
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold min-w-[70px]">Tarif</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold min-w-[90px]">
                    <SortableLabel label="Daya (VA)" active={sort.startsWith("daya")} align="right" />
                  </th>
                  {months.map((m) => (
                    <th
                      key={`${m.tahun}-${m.bulan}`}
                      className="px-3 py-3 text-right text-xs font-semibold min-w-[100px] whitespace-nowrap"
                    >
                      {formatBulanTahun(m.bulan, m.tahun)}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-right text-xs font-semibold text-blue-700 dark:text-blue-400 min-w-[100px] bg-blue-50 dark:bg-blue-950/30 whitespace-nowrap">
                    Rata²
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, index) => (
                  <tr
                    key={item.id}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-3 py-3 text-sm text-muted-foreground sticky left-0 bg-background z-10">
                      {(page - 1) * 20 + index + 1}
                    </td>
                    <td className="px-3 py-3 text-sm font-mono">
                      <Link
                        href={`/pelanggan/${item.id}`}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:underline"
                      >
                        {item.idPelanggan}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-sm font-medium">
                      {item.nama || <span className="text-muted-foreground italic">—</span>}
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.isToHistory && (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                            TO Historis
                          </span>
                        )}
                        {!item.dataLengkap && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                            Belum lengkap
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                        {item.tarif}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-right font-mono text-muted-foreground">
                      {item.daya.toLocaleString("id-ID")}
                    </td>
                    {item.pemakaian.map((p) => (
                      <td
                        key={`${p.tahun}-${p.bulan}`}
                        className={`px-3 py-3 text-sm ${getCellClass(p.kwh)}`}
                      >
                        {p.kwh === null ? "-" : p.kwh.toLocaleString("id-ID")}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-sm text-right font-semibold bg-blue-50 dark:bg-blue-950/30">
                      {item.rataRata.toLocaleString("id-ID")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Halaman {page} dari {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4" />
              Sebelumnya
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page === totalPages}>
              Berikutnya
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function SortableLabel({
  label,
  active,
  align = "left",
}: {
  label: string
  active: boolean
  align?: "left" | "right"
}) {
  return (
    <span className={`inline-flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`}>
      {label}
      <ArrowUpDown className={`h-3 w-3 ${active ? "text-blue-600" : "text-muted-foreground"}`} />
    </span>
  )
}
