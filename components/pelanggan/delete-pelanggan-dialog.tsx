"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface DeletePelangganDialogProps {
  id: string
  nama: string
  onClose: () => void
  onSuccess: () => void
}

export function DeletePelangganDialog({
  id,
  nama,
  onClose,
  onSuccess,
}: DeletePelangganDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete() {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/pelanggan/${id}`, {
        method: "DELETE",
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Gagal menghapus pelanggan")
      }

      // Cek apakah ada data terkait yang ikut terhapus
      const deletedInfo = result.deletedItems
      let description = `${nama} telah dihapus dari sistem`

      if (deletedInfo && (deletedInfo.pemakaian > 0 || deletedInfo.targetOperasi > 0)) {
        const parts = []
        if (deletedInfo.pemakaian > 0) parts.push(`${deletedInfo.pemakaian} data pemakaian`)
        if (deletedInfo.targetOperasi > 0) parts.push(`${deletedInfo.targetOperasi} TO`)
        description += ` beserta ${parts.join(" dan ")}`
      }

      toast.success("Pelanggan berhasil dihapus", {
        description,
      })

      onSuccess()
    } catch (error) {
      console.error(error)
      toast.error("Gagal menghapus pelanggan", {
        description:
          error instanceof Error ? error.message : "Terjadi kesalahan",
      })
      setIsDeleting(false)
    }
  }

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => !open && !isDeleting && onClose()}
    >
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <DialogTitle>Hapus Pelanggan?</DialogTitle>
              <DialogDescription className="mt-1">
                Tindakan ini tidak dapat dibatalkan
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-2">
          <p className="text-sm text-muted-foreground">
            Anda akan menghapus pelanggan:
          </p>
          <p className="font-semibold mt-1">{nama}</p>
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-md">
            <p className="text-sm text-red-800 dark:text-red-300">
              <strong>Peringatan:</strong> Semua data terkait pelanggan ini
              (data pemakaian & target operasi) akan ikut terhapus secara permanen.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Menghapus...
              </>
            ) : (
              "Ya, Hapus"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
