"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Loader2, Save, UserPlus, Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface UserItem {
  id: string
  username: string
  nama: string
  role: "ADMIN" | "SPV" | "USER"
  aktif: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  mode: "create" | "edit"
  user?: UserItem
}

export function UserFormDialog({ open, onClose, onSuccess, mode, user }: Props) {
  const [isLoading, setIsLoading] = useState(false)
  const [form, setForm] = useState({
    username: "",
    nama: "",
    password: "",
    role: "USER" as "ADMIN" | "SPV" | "USER",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      setErrors({})
      if (mode === "edit" && user) {
        setForm({ username: user.username, nama: user.nama, password: "", role: user.role })
      } else {
        setForm({ username: "", nama: "", password: "", role: "USER" })
      }
    }
  }, [open, mode, user])

  function validate() {
    const e: Record<string, string> = {}
    if (!form.nama.trim()) e.nama = "Nama wajib diisi"
    if (mode === "create") {
      if (!form.username.trim()) e.username = "Username wajib diisi"
      if (!/^[a-zA-Z0-9_]+$/.test(form.username)) e.username = "Hanya huruf, angka, dan underscore"
      if (!form.password) e.password = "Password wajib diisi"
      if (form.password.length < 6) e.password = "Minimal 6 karakter"
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setIsLoading(true)

    try {
      const url = mode === "create" ? "/api/users" : `/api/users/${user?.id}`
      const method = mode === "create" ? "POST" : "PATCH"
      const body = mode === "create"
        ? { username: form.username.trim(), nama: form.nama.trim(), password: form.password, role: form.role }
        : { nama: form.nama.trim(), role: form.role }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || "Gagal menyimpan")

      toast.success(mode === "create" ? "User berhasil ditambahkan" : "User berhasil diupdate", {
        description: `${form.nama} (${form.username || user?.username})`,
      })
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "create" ? (
              <><UserPlus className="h-5 w-5 text-blue-600" /> Tambah User Baru</>
            ) : (
              <><Pencil className="h-5 w-5 text-blue-600" /> Edit User</>
            )}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Isi data untuk membuat akun pengguna baru"
              : `Edit data akun ${user?.username}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Username — hanya saat create */}
          {mode === "create" && (
            <div className="space-y-1.5">
              <Label htmlFor="username">
                Username <span className="text-red-500">*</span>
              </Label>
              <Input
                id="username"
                placeholder="contoh: budi_spv"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
                disabled={isLoading}
              />
              {errors.username && <p className="text-xs text-red-500">{errors.username}</p>}
              <p className="text-xs text-muted-foreground">Hanya huruf kecil, angka, dan underscore</p>
            </div>
          )}

          {/* Nama */}
          <div className="space-y-1.5">
            <Label htmlFor="nama">
              Nama Lengkap <span className="text-red-500">*</span>
            </Label>
            <Input
              id="nama"
              placeholder="contoh: Budi Santoso"
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
              disabled={isLoading}
            />
            {errors.nama && <p className="text-xs text-red-500">{errors.nama}</p>}
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <Label htmlFor="role">Role</Label>
            <Select
              value={form.role}
              onValueChange={(v) => setForm({ ...form, role: v as "ADMIN" | "SPV" | "USER" })}
              disabled={isLoading}
            >
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">User - Hanya lihat & input data</SelectItem>
                <SelectItem value="SPV">Supervisor - Bisa generate & update TO</SelectItem>
                <SelectItem value="ADMIN">Admin - Akses penuh</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Password — hanya saat create */}
          {mode === "create" && (
            <div className="space-y-1.5">
              <Label htmlFor="password">
                Password <span className="text-red-500">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Minimal 6 karakter"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                disabled={isLoading}
              />
              {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Batal
            </Button>
            <Button onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyimpan...</>
              ) : (
                <><Save className="mr-2 h-4 w-4" />{mode === "create" ? "Tambah" : "Simpan"}</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
