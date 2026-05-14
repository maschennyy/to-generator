"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import {
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { formatBulanTahun } from "@/lib/validations/pemakaian"

interface PemakaianData {
  id: string
  idPelanggan: string
  nama: string
  tarif: string
  daya: number
  lokasi: string
  pemakaian: Array<{
    bulan: number
    tahun: number
    kwh: number | null
  }>
  rataRata: number
}

interface Month {
  bulan: number
  tahun: number
}

interface PemakaianTableProps {
  isAdmin: boolean
}

export function PemakaianTable({ isAdmin }: PemakaianTableProps) {
  const [data, setData] = useState<PemakaianData[]>([])
  const [months, setMonths] = useState<Month[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  async function fetchData() {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        search,
        page: page.toString(),
        limit: "20",
      })
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
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page]) // ← useEffect ditutup dengan benar di sini

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput)
  }

  function resetFilters() {
    setSearchInput("")
    setSearch("")
    setPage(1)
  }

  async function handleDownload() {
  try {
    toast.info("Menyiapkan data...")

    const params = new URLSearchParams({ search })
    const response = await fetch(`/api/pemakaian/export?${params}`)

    if (!response.ok) throw new Error("Gagal mengunduh")

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    const today = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `data-pemakaian-${today}.xlsx`
    a.click()
    window.URL.revokeObjectURL(url)

    toast.success("Data berhasil diunduh")
  } catch (error) {
    console.error(error)
    toast.error("Gagal mengunduh data")
  }
}

  function getCellClass(kwh: number | null): string {
    if (kwh === null) return "text-muted-foreground italic text-center"
    if (kwh === 0)
      return "bg-red-50 text-red-700 font-semibold dark:bg-red-950/30 dark:text-red-400 text-right"
    return "text-right font-mono"
  }

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
        <Button type="submit" variant="secondary">
          Cari
        </Button>
        {search && (
          <Button type="button" variant="outline" onClick={resetFilters}>
            Reset
          </Button>
        )}
      </form>

      {/* Info */}
      {!isLoading && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Menampilkan {data.length} pelanggan dari total {total}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleDownload}
            disabled={isLoading}
            className="text-green-600 border-green-200 hover:bg-green-50"
          >
            <Download className="h-4 w-4 mr-1" />
            Download Excel
          </Button>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-900"></div>
          <span className="text-muted-foreground">0 kWh (potensi anomali)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground italic">-</span>
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
            <p className="text-muted-foreground">
              Belum ada data pelanggan untuk ditampilkan
            </p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 sticky left-0 bg-slate-50 dark:bg-slate-800/50 z-10 min-w-[50px]">
                    No
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 min-w-[140px]">
                    ID Pelanggan
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 min-w-[200px]">
                    Nama
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-700 dark:text-slate-300 min-w-[90px]">
                    Tarif
                  </th>
                  {months.map((m) => (
                    <th
                      key={`${m.tahun}-${m.bulan}`}
                      className="px-3 py-3 text-right text-xs font-semibold text-slate-700 dark:text-slate-300 min-w-[100px] whitespace-nowrap"
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
                      {item.nama}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                        {item.tarif}
                      </span>
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
          <p className="text-sm text-muted-foreground">
            Halaman {page} dari {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
            >
              Berikutnya
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}