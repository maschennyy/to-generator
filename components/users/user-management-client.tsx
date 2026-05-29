"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import {
  Plus,
  Loader2,
  ShieldCheck,
  Shield,
  User as UserIcon,
  Pencil,
  Trash2,
  KeyRound,
  CheckCircle2,
  XCircle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
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
import { UserFormDialog } from "./user-form-dialog"
import { ResetPasswordDialog } from "./reset-password-dialog"

interface UserItem {
  id: string
  username: string
  nama: string
  role: "ADMIN" | "SPV" | "USER"
  aktif: boolean
  createdAt: string
}

const ROLE_CONFIG = {
  ADMIN: {
    label: "Admin",
    icon: ShieldCheck,
    className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  },
  SPV: {
    label: "Supervisor",
    icon: Shield,
    className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  },
  USER: {
    label: "User",
    icon: UserIcon,
    className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
}

interface Props {
  currentUserId: string
}

export function UserManagementClient({ currentUserId }: Props) {
  const [users, setUsers] = useState<UserItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Dialog state
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editTarget, setEditTarget] = useState<UserItem | null>(null)
  const [resetTarget, setResetTarget] = useState<UserItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchUsers = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/users")
      if (!res.ok) throw new Error("Gagal memuat data")
      const data = await res.json()
      setUsers(data)
    } catch (err) {
      toast.error("Gagal memuat daftar user")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  async function handleToggleAktif(user: UserItem) {
    if (user.id === currentUserId) {
      toast.error("Tidak bisa menonaktifkan akun sendiri")
      return
    }
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktif: !user.aktif }),
      })
      if (!res.ok) {
        const r = await res.json()
        throw new Error(r.error)
      }
      toast.success(`User ${user.nama} ${!user.aktif ? "diaktifkan" : "dinonaktifkan"}`)
      fetchUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah status user")
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/users/${deleteTarget.id}`, { method: "DELETE" })
      if (!res.ok) {
        const r = await res.json()
        throw new Error(r.error)
      }
      toast.success(`User ${deleteTarget.nama} berhasil dihapus`)
      setDeleteTarget(null)
      fetchUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus user")
    } finally {
      setIsDeleting(false)
    }
  }

  const totalAdmin = users.filter((u) => u.role === "ADMIN").length
  const totalSpv = users.filter((u) => u.role === "SPV").length
  const totalUser = users.filter((u) => u.role === "USER").length
  const totalAktif = users.filter((u) => u.aktif).length

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Total User" value={users.length} color="blue" />
        <SummaryCard label="Admin" value={totalAdmin} color="red" />
        <SummaryCard label="Supervisor" value={totalSpv} color="purple" />
        <SummaryCard label="Aktif" value={totalAktif} color="green" />
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {users.length} user terdaftar · {totalAktif} aktif · {totalUser} pengguna
        </p>
        <Button
          onClick={() => setShowAddDialog(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="mr-2 h-4 w-4" />
          Tambah User
        </Button>
      </div>

      {/* Table */}
      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <div className="flex items-center justify-center p-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
            <span className="text-muted-foreground">Memuat...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center p-16">
            <UserIcon className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">Belum ada user</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold">No</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">Username</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">Nama</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">Role</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold">Dibuat</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold w-44">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, index) => {
                  const roleConf = ROLE_CONFIG[user.role]
                  const RoleIcon = roleConf.icon
                  const isSelf = user.id === currentUserId

                  return (
                    <tr
                      key={user.id}
                      className="border-b hover:bg-slate-50 dark:hover:bg-slate-800/30"
                    >
                      <td className="px-4 py-3 text-sm text-muted-foreground">{index + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-medium">{user.username}</span>
                          {isSelf && (
                            <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-1.5 py-0.5 rounded">
                              Kamu
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">{user.nama}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${roleConf.className}`}
                        >
                          <RoleIcon className="h-3 w-3" />
                          {roleConf.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleAktif(user)}
                          disabled={isSelf}
                          className="inline-flex items-center gap-1 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                          title={isSelf ? "Tidak bisa mengubah status akun sendiri" : user.aktif ? "Klik untuk nonaktifkan" : "Klik untuk aktifkan"}
                        >
                          {user.aktif ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-slate-400" />
                          )}
                          <span className={user.aktif ? "text-green-700 dark:text-green-400" : "text-slate-500"}>
                            {user.aktif ? "Aktif" : "Nonaktif"}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Edit user"
                            onClick={() => setEditTarget(user)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Reset password"
                            onClick={() => setResetTarget(user)}
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                            title="Hapus user"
                            disabled={isSelf}
                            onClick={() => setDeleteTarget(user)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Tambah User Dialog */}
      <UserFormDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onSuccess={() => { setShowAddDialog(false); fetchUsers() }}
        mode="create"
      />

      {/* Edit User Dialog */}
      {editTarget && (
        <UserFormDialog
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={() => { setEditTarget(null); fetchUsers() }}
          mode="edit"
          user={editTarget}
        />
      )}

      {/* Reset Password Dialog */}
      {resetTarget && (
        <ResetPasswordDialog
          open={!!resetTarget}
          onClose={() => setResetTarget(null)}
          onSuccess={() => { setResetTarget(null); fetchUsers() }}
          user={resetTarget}
        />
      )}

      {/* Delete Confirm Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Hapus User?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Akun <strong>{deleteTarget?.nama}</strong> ({deleteTarget?.username}) akan dihapus
              permanen. Semua log aktivitas user ini juga akan terhapus. Tindakan ini tidak bisa
              dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menghapus...</>
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

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: "blue" | "red" | "purple" | "green"
}) {
  const colorMap = {
    blue: "text-blue-600",
    red: "text-red-600",
    purple: "text-purple-600",
    green: "text-green-600",
  }
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className={`text-2xl font-bold ${colorMap[color]}`}>{value}</p>
      </CardContent>
    </Card>
  )
}
