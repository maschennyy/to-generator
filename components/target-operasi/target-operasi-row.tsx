"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Minus,
  Zap,
  CheckCircle2,
  PlayCircle,
  XCircle,
  Loader2,
  Trash2,
  Pencil,
} from "lucide-react"

import { Button } from "@/components/ui/button"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type TargetOperasiItem = {
  id: string
  tipeAnomali:
    | "TURUN_DRASTIS"
    | "STAGNAN"
    | "NOL_PEMAKAIAN"
    | "LONJAKAN"
    | "POLA_TIDAK_WAJAR"
  alasan: string
  skor: number
  status: "PENDING" | "DIPROSES" | "SELESAI" | "DIBATALKAN"
  periode: string
  catatan: string | null
  hasilOperasi: {
    hasil: "BELUM_DIPERIKSA" | "NORMAL" | "PELANGGARAN" | "TIDAK_DITEMUKAN"
    tanggalOperasi: string | null
    kategoriTemuan: string | null
    catatan: string | null
  } | null
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
  createdBy: { id: string; nama: string; username: string }
}

interface RowProps {
  item: TargetOperasiItem
  index: number
  canEdit: boolean
  isAdmin: boolean
  onChange: () => void
  mlScore?: MlScore | null
  onOpenMlPanel: (item: TargetOperasiItem) => void
  // Checkbox props
  selected: boolean
  onToggleSelect: (id: string) => void
}

export type MlScore = {
  pelanggan_id: string
  id_pelanggan: string
  risk_score: number | null
  rf_score?: number | null
  anomaly_score?: number | null
  top_reason?: string | null
  is_anomaly?: boolean
}

const TIPE_INFO = {
  TURUN_DRASTIS: { label: "Turun Drastis", icon: TrendingDown, color: "amber" },
  STAGNAN: { label: "Stagnan", icon: Minus, color: "blue" },
  NOL_PEMAKAIAN: { label: "Nol Pemakaian", icon: AlertTriangle, color: "red" },
  LONJAKAN: { label: "Lonjakan", icon: TrendingUp, color: "purple" },
  POLA_TIDAK_WAJAR: { label: "Pola Tidak Wajar", icon: Zap, color: "slate" },
} as const

const STATUS_INFO = {
  PENDING: {
    label: "Pending",
    bg: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  DIPROSES: {
    label: "Diproses",
    bg: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  },
  SELESAI: {
    label: "Selesai",
    bg: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  },
  DIBATALKAN: {
    label: "Dibatalkan",
    bg: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
} as const

const HASIL_LABEL = {
  BELUM_DIPERIKSA: "Belum diperiksa",
  NORMAL: "Normal",
  PELANGGARAN: "Pelanggaran",
  TIDAK_DITEMUKAN: "Tidak ditemukan",
} as const

export function TargetOperasiRow({
  item,
  index,
  canEdit,
  isAdmin,
  onChange,
  mlScore,
  onOpenMlPanel,
  selected,
  onToggleSelect,
}: RowProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [editStatus, setEditStatus] = useState(item.status)
  const [editCatatan, setEditCatatan] = useState(item.catatan ?? "")
  const [editHasil, setEditHasil] = useState(item.hasilOperasi?.hasil ?? "BELUM_DIPERIKSA")
  const [editTanggalOperasi, setEditTanggalOperasi] = useState(
    item.hasilOperasi?.tanggalOperasi?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)
  )
  const [editKategoriTemuan, setEditKategoriTemuan] = useState(item.hasilOperasi?.kategoriTemuan ?? "")

  const tipeInfo = TIPE_INFO[item.tipeAnomali]
  const statusInfo = STATUS_INFO[item.status]
  const TipeIcon = tipeInfo.icon

  const tipeColors: Record<string, string> = {
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    red: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    purple: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
    slate: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  }

  async function updateStatus(status: TargetOperasiItem["status"]) {
    setIsUpdating(true)
    try {
      const res = await fetch(`/api/target-operasi/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Gagal update")
      }
      toast.success(`Status diubah menjadi ${STATUS_INFO[status].label}`)
      onChange()
    } catch (err) {
      toast.error("Gagal update status", {
        description: err instanceof Error ? err.message : "Error",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  async function saveEdit() {
    setIsUpdating(true)
    try {
      const res = await fetch(`/api/target-operasi/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editStatus,
          catatan: editCatatan.trim() || null,
          ...(editStatus === "SELESAI"
            ? {
                hasilOperasi: {
                  hasil: editHasil,
                  tanggalOperasi: editTanggalOperasi || null,
                  kategoriTemuan: editKategoriTemuan.trim() || null,
                  catatan: editCatatan.trim() || null,
                },
              }
            : {}),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Gagal update")
      }
      toast.success("Target Operasi diperbarui")
      setShowEdit(false)
      onChange()
    } catch (err) {
      toast.error("Gagal menyimpan", {
        description: err instanceof Error ? err.message : "Error",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  async function confirmDelete() {
    setIsUpdating(true)
    try {
      const res = await fetch(`/api/target-operasi/${item.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Gagal hapus")
      }
      toast.success("Target Operasi dihapus")
      setShowDelete(false)
      onChange()
    } catch (err) {
      toast.error("Gagal hapus", {
        description: err instanceof Error ? err.message : "Error",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const skorPercent = Math.round(item.skor * 100)
  const skorColor =
    item.skor >= 0.8
      ? "text-red-600"
      : item.skor >= 0.5
        ? "text-amber-600"
        : "text-slate-600"

  return (
    <>
      <tr
        className={`border-b transition-colors ${
          selected
            ? "bg-blue-50 dark:bg-blue-950/20"
            : "hover:bg-slate-50 dark:hover:bg-slate-800/30"
        }`}
        data-testid={`to-row-${item.id}`}
      >
        {/* Checkbox */}
        {canEdit && (
          <td className="px-3 py-3 w-10">
            <Checkbox
              checked={selected}
              onCheckedChange={() => onToggleSelect(item.id)}
              aria-label={`Pilih TO ${item.pelanggan.idPelanggan}`}
            />
          </td>
        )}

        <td className="px-3 py-3 text-sm text-muted-foreground">{index + 1}</td>
        <td className="px-3 py-3 text-sm font-mono">
          {item.pelanggan.idPelanggan}
        </td>
        <td className="px-3 py-3 text-sm">
          <div className="font-medium">
            <button
              type="button"
              onClick={() => onOpenMlPanel(item)}
              className="text-left hover:text-blue-600 hover:underline"
            >
              {item.pelanggan.nama || (
                <span className="italic text-muted-foreground">(belum diisi)</span>
              )}
            </button>
          </div>
          <div className="text-xs text-muted-foreground truncate max-w-[200px]">
            {item.pelanggan.lokasi || "-"}
          </div>
          {item.pelanggan.isToHistory && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 mt-1">
              Pernah TO
            </span>
          )}
        </td>
        <td className="px-3 py-3 text-sm">
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${tipeColors[tipeInfo.color]}`}
          >
            <TipeIcon className="h-3 w-3" />
            {tipeInfo.label}
          </span>
        </td>
        <td className="px-3 py-3 text-xs text-muted-foreground max-w-md">
          <span className="line-clamp-2">{item.alasan}</span>
        </td>
        <td className="px-3 py-3 text-center">
          <span className={`text-sm font-semibold ${skorColor}`}>
            {skorPercent}%
          </span>
        </td>
        <td className="px-3 py-3 text-center">
          <RiskScoreBadge score={mlScore?.risk_score} onClick={() => onOpenMlPanel(item)} />
        </td>
        <td className="px-3 py-3 text-center text-xs text-muted-foreground">
          {item.periode}
        </td>
        <td className="px-3 py-3 text-center">
          <span
            className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${statusInfo.bg}`}
            data-testid={`to-status-${item.id}`}
          >
            {statusInfo.label}
          </span>
          {item.hasilOperasi?.hasil && item.hasilOperasi.hasil !== "BELUM_DIPERIKSA" && (
            <div className="mt-1 text-[10px] text-muted-foreground">
              {HASIL_LABEL[item.hasilOperasi.hasil]}
            </div>
          )}
        </td>
        <td className="px-3 py-3">
          <div className="flex items-center justify-center gap-1">
            {canEdit && item.status === "PENDING" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => updateStatus("DIPROSES")}
                disabled={isUpdating}
                title="Mulai proses"
                data-testid={`btn-process-${item.id}`}
              >
                <PlayCircle className="h-4 w-4 text-blue-600" />
              </Button>
            )}
            {canEdit && item.status === "DIPROSES" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditStatus("SELESAI")
                  setShowEdit(true)
                }}
                disabled={isUpdating}
                title="Input hasil operasi"
                data-testid={`btn-done-${item.id}`}
              >
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </Button>
            )}
            {canEdit && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowEdit(true)}
                disabled={isUpdating}
                title="Edit detail"
                data-testid={`btn-edit-${item.id}`}
              >
                <Pencil className="h-4 w-4 text-slate-600" />
              </Button>
            )}
            {isAdmin && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowDelete(true)}
                disabled={isUpdating}
                title="Hapus"
                data-testid={`btn-delete-${item.id}`}
              >
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            )}
          </div>
        </td>
      </tr>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent data-testid="edit-to-dialog">
          <DialogHeader>
            <DialogTitle>Update Target Operasi</DialogTitle>
            <DialogDescription>
              IDPEL: <span className="font-mono">{item.pelanggan.idPelanggan}</span>{" "}
              - {item.pelanggan.nama || "(nama kosong)"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Status</label>
              <select
                value={editStatus}
                onChange={(e) =>
                  setEditStatus(e.target.value as TargetOperasiItem["status"])
                }
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
                data-testid="edit-status-select"
              >
                <option value="PENDING">Pending</option>
                <option value="DIPROSES">Diproses</option>
                <option value="SELESAI">Selesai</option>
                <option value="DIBATALKAN">Dibatalkan</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Catatan (opsional)
              </label>
              <textarea
                value={editCatatan}
                onChange={(e) => setEditCatatan(e.target.value)}
                placeholder="Catatan hasil tindak lanjut..."
                className="w-full min-h-[100px] p-3 rounded-md border border-input bg-background text-sm"
                data-testid="edit-catatan-textarea"
              />
            </div>

            {editStatus === "SELESAI" && (
              <div className="space-y-4 rounded-md border p-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    Hasil Operasi <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={editHasil}
                    onChange={(e) => setEditHasil(e.target.value as typeof editHasil)}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  >
                    <option value="BELUM_DIPERIKSA">Belum diperiksa</option>
                    <option value="NORMAL">Normal</option>
                    <option value="PELANGGARAN">Pelanggaran</option>
                    <option value="TIDAK_DITEMUKAN">Tidak ditemukan</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    Tanggal Operasi
                  </label>
                  <input
                    type="date"
                    value={editTanggalOperasi}
                    onChange={(e) => setEditTanggalOperasi(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    Kategori Temuan
                  </label>
                  <input
                    type="text"
                    value={editKategoriTemuan}
                    onChange={(e) => setEditKategoriTemuan(e.target.value)}
                    placeholder="Contoh: P2TL, Meter rusak, Pelanggaran P3"
                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  />
                </div>
              </div>
            )}

            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-md p-3 text-sm">
              <p className="font-medium text-xs text-muted-foreground mb-1">
                Alasan deteksi:
              </p>
              <p className="text-xs">{item.alasan}</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEdit(false)}
              disabled={isUpdating}
            >
              Batal
            </Button>
            <Button
              onClick={saveEdit}
              disabled={isUpdating}
              data-testid="save-edit-button"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Simpan Perubahan"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              Hapus Target Operasi?
            </AlertDialogTitle>
            <AlertDialogDescription>
              TO untuk pelanggan{" "}
              <strong className="font-mono">{item.pelanggan.idPelanggan}</strong>{" "}
              ({item.pelanggan.nama || "-"}) akan dihapus permanen. Tindakan
              ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isUpdating}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirm-delete-to-button"
            >
              {isUpdating ? "Menghapus..." : "Ya, Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function RiskScoreBadge({
  score,
  onClick,
}: {
  score: number | null | undefined
  onClick: () => void
}) {
  if (score === null || score === undefined) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400"
      >
        Tidak tersedia
      </button>
    )
  }

  const rounded = Math.round(score)
  const className =
    rounded >= 70
      ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
      : rounded >= 40
        ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
  const label = rounded >= 70 ? "Tinggi" : rounded >= 40 ? "Menengah" : "Rendah"

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${className}`}
      title="Klik untuk melihat detail skor NALAR"
    >
      {rounded}
      <span className="font-medium">{label}</span>
    </button>
  )
}
