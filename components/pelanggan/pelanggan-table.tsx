"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  Search,
  Edit,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card } from "@/components/ui/card"
import { DeletePelangganDialog } from "@/components/pelanggan/delete-pelanggan-dialog"

interface Pelanggan {
  id: string
  idPelanggan: string
  nama: string
  tarif: string
  daya: number
  lokasi: string
  createdAt: string
}

interface PelangganTableProps {
  isAdmin: boolean
}

export function PelangganTable({ isAdmin }: PelangganTableProps) {
  const [pelanggan, setPelanggan] = useState<Pelanggan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteNama, setDeleteNama] = useState<string>("")

  async function fetchPelanggan() {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        search,
        page: page.toString(),
        limit: "10",
      })
      const response = await fetch(`/api/pelanggan?${params}`)
      const result = await response.json()

      if (!response.ok) throw new Error(result.error)

      setPelanggan(result.data)
      setTotalPages(result.pagination.totalPages)
      setTotal(result.pagination.total)
    } catch (error) {
      console.error(error)
      toast.error("Gagal memuat data pelanggan")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPelanggan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput)
  }

  function handleDeleteClick(id: string, nama: string) {
    setDeleteId(id)
    setDeleteNama(nama)
  }

  function handleDeleteSuccess() {
    setDeleteId(null)
    setDeleteNama("")
    fetchPelanggan()
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Cari ID pelanggan, nama, atau lokasi..."
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

      {/* Info Total */}
      {!isLoading && (
        <p className="text-sm text-muted-foreground">
          {search
            ? `Menampilkan ${pelanggan.length} hasil dari pencarian "${search}" (Total: ${total})`
            : `Total: ${total} pelanggan`}
        </p>
      )}

      {/* Table */}
      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Memuat data...</span>
          </div>
        ) : pelanggan.length === 0 ? (
          <div className="text-center p-12">
            <p className="text-muted-foreground">
              {search
                ? "Tidak ada pelanggan yang ditemukan"
                : "Belum ada data pelanggan"}
            </p>
            {isAdmin && !search && (
              <Link
                href="/pelanggan/new"
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-md border border-slate-200 dark:border-slate-700 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Tambah Pelanggan Pertama
              </Link>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">No</TableHead>
                <TableHead>ID Pelanggan</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Tarif</TableHead>
                <TableHead className="text-right">Daya (VA)</TableHead>
                <TableHead>Lokasi</TableHead>
                {isAdmin && (
                  <TableHead className="text-right">Aksi</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pelanggan.map((item, index) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-muted-foreground">
                    {(page - 1) * 10 + index + 1}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {item.idPelanggan}
                  </TableCell>
                  <TableCell className="font-medium">{item.nama}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                      {item.tarif}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {item.daya.toLocaleString("id-ID")}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {item.lokasi}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/pelanggan/${item.id}/edit`}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                          onClick={() => handleDeleteClick(item.id, item.nama)}
                          title="Hapus"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
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

      {/* Delete Dialog */}
      {deleteId && (
        <DeletePelangganDialog
          id={deleteId}
          nama={deleteNama}
          onClose={() => {
            setDeleteId(null)
            setDeleteNama("")
          }}
          onSuccess={handleDeleteSuccess}
        />
      )}
    </div>
  )
}