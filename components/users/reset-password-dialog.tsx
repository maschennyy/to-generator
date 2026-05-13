"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, KeyRound, Eye, EyeOff } from "lucide-react"

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

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  user: { id: string; username: string; nama: string }
}

export function ResetPasswordDialog({ open, onClose, onSuccess, user }: Props) {
  const [isLoading, setIsLoading] = useState(false)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState("")

  function handleClose() {
    setPassword("")
    setConfirm("")
    setError("")
    onClose()
  }

  async function handleSubmit() {
    setError("")
    if (password.length < 6) {
      setError("Password minimal 6 karakter")
      return
    }
    if (password !== confirm) {
      setError("Konfirmasi password tidak cocok")
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: password }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)

      toast.success(`Password ${user.nama} berhasil direset`)
      handleClose()
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal reset password")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-amber-500" />
            Reset Password
          </DialogTitle>
          <DialogDescription>
            Atur password baru untuk <strong>{user.nama}</strong> ({user.username})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-password">Password Baru</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPw ? "text" : "password"}
                placeholder="Minimal 6 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Konfirmasi Password</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Ulangi password baru"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose} disabled={isLoading}>
              Batal
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading || !password || !confirm}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyimpan...</>
              ) : (
                <><KeyRound className="mr-2 h-4 w-4" />Reset Password</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
