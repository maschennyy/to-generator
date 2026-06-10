"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import {
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Trash2,
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

interface ToHistoris {
  id: string
  idPelanggan: string
  tanggalTemuan: string | null
  kategori: string | null
  createdAt: string
}

interface ToHistorisTableProps {
  isAdmin: boolean
}

export function ToHistorisTable({ isAdmin }: ToHistorisTableProps) {
  const [data, setData] = useState<ToHistoris[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

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
      const response = await fetch(`/api/to-historis?${params}`)
      const result = await response.json()

      if (!response.ok) throw new Error(result.error)

      setData(result.data)
      setTotalPages(result.pagination.totalPages)
            setTotal(result.pagination.total)
      setSelectedIds(new Set()) // Reset selection saat data berubah
    } catch (error) {
      console.error(error)
      toast.error("Gagal memuat data TO Historis")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput)
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "-"
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString("id-ID", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    } catch {
      return "-"
    }
  }

  function toggleSelectAll() {
    if (selectedIds.size === data.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(data.map((t) => t.id)))
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
      toast.error("Pilih minimal 1 data untuk dihapus")
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
      const payload =
        deleteMode === "all"
          ? { deleteAll: true }
          : { ids: Array.from(selectedIds) }

      const response = await fetch("/api/to-historis", {
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
          ? `Semua TO Historis dihapus (${result.deleted} data)`
          : `${result.deleted} TO Historis berhasil dihapus`
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
      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Cari IDPEL atau kategori..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button type="submit" variant="secondary">
          Cari
        </Button>
        {search && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSearchInput("")
              setSearch("")
              setPage(1)
            }}
          >
            Reset
          </Button>
        )}
      </form>

      {/* Info & Bulk Actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Total: {total} data TO Historis
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
            <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              {search ? "Tidak ada data yang cocok" : "Belum ada data TO Historis"}
            </p>
            {!search && isAdmin && (
              <p className="text-sm text-muted-foreground mt-2">
                Klik &quot;Import TO Historis&quot; untuk mengisi data
              </p>
            )}
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
                  <th className="px-3 py-3 text-left text-xs font-semibold w-12">
                    No
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold">
                    IDPEL
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold">
                    Tanggal Temuan
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold">
                    Kategori
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, index) => (
                  <tr
                    key={item.id}
                    className={`border-b hover:bg-slate-50 dark:hover:bg-slate-800/30 ${
                      selectedIds.has(item.id)
                        ? "bg-blue-50 dark:bg-blue-950/20"
                        : ""
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
                      {item.idPelanggan}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      {formatDate(item.tanggalTemuan)}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      {item.kategori ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          {item.kategori}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">-</span>
                      )}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteMode === "all"
                ? "Hapus SEMUA TO Historis?"
                : `Hapus ${selectedIds.size} TO Historis?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteMode === "all" ? (
                <>
                  Anda akan menghapus <strong>SEMUA ({total}) data TO Historis</strong>.
                  Flag &quot;TO&quot; pada pelanggan juga akan dihapus otomatis.
                  <br />
                  <br />
                  Tindakan ini{" "}
                  <strong className="text-red-600">TIDAK DAPAT DIBATALKAN</strong>.
                </>
              ) : (
                <>
                  Anda akan menghapus <strong>{selectedIds.size} data TO Historis</strong>{" "}
                  yang terpilih. Flag &quot;TO&quot; pada pelanggan terkait juga akan
                  dihapus otomatis.
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
