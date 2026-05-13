"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Users,
  Pencil,
  Trash2,
  AlertCircle,
  AlertTriangle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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

interface Pelanggan {
  id: string
  idPelanggan: string
  nama: string
  tarif: string
  daya: number
  lokasi: string
  isToHistory: boolean
  dataLengkap: boolean
  createdAt: string
}

interface PelangganTableProps {
  isAdmin: boolean
}

export function PelangganTable({ isAdmin }: PelangganTableProps) {
  const [data, setData] = useState<Pelanggan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [filter, setFilter] = useState<"all" | "incomplete" | "to-history">("all")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalIncomplete, setTotalIncomplete] = useState(0)
  const [totalToHistory, setTotalToHistory] = useState(0)
  
  // Bulk delete states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteMode, setDeleteMode] = useState<"selected" | "all">("selected")

  async function fetchData() {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        search,
        page: page.toString(),
        limit: "20",
      })
      if (filter !== "all") {
        params.append("filter", filter)
      }

      const response = await fetch(`/api/pelanggan?${params}`)
      const result = await response.json()

      if (!response.ok) throw new Error(result.error)

      setData(result.data)
      setTotalPages(result.pagination.totalPages)
      setTotal(result.pagination.total)
      setTotalIncomplete(result.totalIncomplete || 0)
      setTotalToHistory(result.totalToHistory || 0)
      setSelectedIds(new Set()) // Reset selection saat data berubah
    } catch (error) {
      console.error(error)
      toast.error("Gagal memuat data pelanggan")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page, filter])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput)
  }

  function toggleSelectAll() {
    if (selectedIds.size === data.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(data.map((p) => p.id)))
    }
  }

  function toggleSelectOne(id: string) {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  function handleDeleteSelected() {
    if (selectedIds.size === 0) {
      toast.error("Pilih minimal 1 pelanggan untuk dihapus")
      return
    }
    setDeleteMode("selected")
    setShowDeleteDialog(true)
  }

  function handleDeleteAll() {
    setDeleteMode("all")
    setShowDeleteDialog(true)
  }

  async function confirmDelete() {
    setIsDeleting(true)
    try {
      const payload = deleteMode === "all"
        ? { deleteAll: true }
        : { ids: Array.from(selectedIds) }

      const response = await fetch("/api/pelanggan", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Gagal hapus")
      }

      toast.success(
        deleteMode === "all"
          ? `Semua pelanggan dihapus (${result.deleted} data)`
          : `${result.deleted} pelanggan berhasil dihapus`
      )

      setShowDeleteDialog(false)
      setSelectedIds(new Set())
      fetchData()
    } catch (error) {
      console.error(error)
      toast.error("Gagal hapus data", {
        description: error instanceof Error ? error.message : "Error",
      })
    } finally {
      setIsDeleting(false)
    }
  }

    return (
    <div className="space-y-4">
      {/* Warning Banner untuk Data Tidak Lengkap */}
      {totalIncomplete > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900">
          <div className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-amber-900 dark:text-amber-300">
                {totalIncomplete} pelanggan dengan data belum lengkap
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                Pelanggan ini otomatis dibuat saat import pemakaian. Lengkapi
                nama dan alamat untuk data yang ditandai.
              </p>
            </div>
            {filter !== "incomplete" && (
              <Button
                size="sm"
                variant="outline"
                className="border-amber-300 text-amber-900 hover:bg-amber-100"
                onClick={() => {
                  setFilter("incomplete")
                  setPage(1)
                }}
              >
                Lihat Data
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-2">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Cari IDPEL, nama, atau lokasi..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button type="submit" variant="secondary">
            Cari
          </Button>
        </form>

        <div className="flex gap-2 flex-wrap">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => {
              setFilter("all")
              setPage(1)
            }}
            size="sm"
          >
            Semua ({total})
          </Button>
          <Button
            variant={filter === "incomplete" ? "default" : "outline"}
            onClick={() => {
              setFilter("incomplete")
              setPage(1)
            }}
            size="sm"
            className={filter === "incomplete" ? "bg-amber-600 hover:bg-amber-700" : ""}
          >
            Belum Lengkap ({totalIncomplete})
          </Button>
          <Button
            variant={filter === "to-history" ? "default" : "outline"}
            onClick={() => {
              setFilter("to-history")
              setPage(1)
            }}
            size="sm"
            className={filter === "to-history" ? "bg-red-600 hover:bg-red-700" : ""}
          >
            <AlertTriangle className="h-3 w-3 mr-1" />
            TO Historis ({totalToHistory})
          </Button>
          {(search || filter !== "all") && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearchInput("")
                setSearch("")
                setFilter("all")
                setPage(1)
              }}
              size="sm"
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Info & Bulk Actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Menampilkan {data.length} dari {total} pelanggan
          {selectedIds.size > 0 && (
            <span className="ml-2 font-medium text-blue-600 dark:text-blue-400">
              ({selectedIds.size} terpilih)
            </span>
          )}
        </p>

        {isAdmin && data.length > 0 && (
          <div className="flex gap-2">
            {selectedIds.size > 0 && (
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDeleteSelected}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Hapus Terpilih ({selectedIds.size})
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleDeleteAll}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Hapus Semua
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Memuat...</span>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center p-12">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              {search || filter !== "all"
                ? "Tidak ada pelanggan yang cocok"
                : "Belum ada data pelanggan"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b">
                <tr>
                  {isAdmin && (
                    <th className="px-3 py-3 w-12">
                      <Checkbox
                        checked={
                          data.length > 0 && selectedIds.size === data.length
                        }
                        onCheckedChange={toggleSelectAll}
                      />
                    </th>
                  )}
                  <th className="px-3 py-3 text-left text-xs font-semibold w-12">No</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold">IDPEL</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold">Nama</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold">Lokasi</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold">Tarif</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold">Daya</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold">Status</th>
                  {isAdmin && (
                    <th className="px-3 py-3 text-center text-xs font-semibold w-20">Aksi</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.map((item, index) => (
                  <tr
                    key={item.id}
                    className={`border-b hover:bg-slate-50 dark:hover:bg-slate-800/30 ${
                      !item.dataLengkap ? "bg-amber-50/40 dark:bg-amber-950/10" : ""
                    } ${
                      selectedIds.has(item.id) ? "bg-blue-50 dark:bg-blue-950/20" : ""
                    }`}
                  >
                    {isAdmin && (
                      <td className="px-3 py-3">
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={() => toggleSelectOne(item.id)}
                        />
                      </td>
                    )}
                    <td className="px-3 py-3 text-sm text-muted-foreground">
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
                    <td className="px-3 py-3 text-sm">
                      {item.nama ? (
                        <span className="font-medium">{item.nama}</span>
                      ) : (
                        <span className="italic text-amber-600 dark:text-amber-400">
                          ⚠️ Belum diisi
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm max-w-xs truncate">
                      {item.lokasi ? (
                        item.lokasi
                      ) : (
                        <span className="italic text-amber-600 dark:text-amber-400">
                          ⚠️ Belum diisi
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                        {item.tarif}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-right font-mono">
                      {item.daya.toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex flex-col gap-1 items-center">
                        {!item.dataLengkap && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            Perlu Update
                          </span>
                        )}
                        {item.isToHistory && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                            TO
                          </span>
                        )}
                        {item.dataLengkap && !item.isToHistory && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
                            ✓ OK
                          </span>
                        )}
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="px-3 py-3 text-center">
                        <Link href={`/pelanggan/${item.id}/edit`}>
                          <Button size="sm" variant="ghost">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                      </td>
                    )}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
                        <AlertDialogTitle>
              {deleteMode === "all"
                ? "⚠️ Hapus SEMUA Pelanggan?"
                : `Hapus ${selectedIds.size} Pelanggan?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteMode === "all" ? (
                <>
                  Anda akan menghapus <strong>SEMUA ({total}) pelanggan</strong>{" "}
                  beserta data pemakaian terkait. Tindakan ini{" "}
                  <strong className="text-red-600">TIDAK DAPAT DIBATALKAN</strong>.
                  <br />
                  <br />
                  Apakah Anda yakin ingin melanjutkan?
                </>
              ) : (
                <>
                  Anda akan menghapus <strong>{selectedIds.size} pelanggan</strong>{" "}
                  yang terpilih beserta data pemakaiannya. Tindakan ini tidak
                  dapat dibatalkan.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menghapus...
                </>
              ) : deleteMode === "all" ? (
                "Ya, Hapus Semua"
              ) : (
                "Ya, Hapus"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}