"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import {
  Loader2,
  Search,
  Upload,
  Sparkles,
  ShieldCheck,
  Users,
  Trash2,
  KeyRound,
  LogIn,
  Bell,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface LogItem {
  id: string
  aksi: string
  detail: string | null
  ipAddress: string | null
  createdAt: string
  user: { id: string; nama: string; username: string; role: string }
}

interface FilterUser {
  id: string
  nama: string
  username: string
}

const AKSI_CONFIG: Record<string, { icon: typeof Bell; color: string; label: string; bg: string }> = {
  BULK_IMPORT_PELANGGAN: { icon: Upload,      color: "text-blue-600",   bg: "bg-blue-100 dark:bg-blue-950",   label: "Import Pelanggan" },
  GENERATE_TO:           { icon: Sparkles,    color: "text-purple-600", bg: "bg-purple-100 dark:bg-purple-950", label: "Generate TO" },
  CREATE_USER:           { icon: Users,       color: "text-green-600",  bg: "bg-green-100 dark:bg-green-950", label: "Tambah User" },
  UPDATE_USER:           { icon: ShieldCheck, color: "text-amber-600",  bg: "bg-amber-100 dark:bg-amber-950", label: "Update User" },
  DELETE_USER:           { icon: Trash2,      color: "text-red-600",    bg: "bg-red-100 dark:bg-red-950",     label: "Hapus User" },
  RESET_PASSWORD:        { icon: KeyRound,    color: "text-amber-600",  bg: "bg-amber-100 dark:bg-amber-950", label: "Reset Password" },
  DELETE_ALL_TO:         { icon: Trash2,      color: "text-red-600",    bg: "bg-red-100 dark:bg-red-950",     label: "Hapus Semua TO" },
  BULK_DELETE_TO:        { icon: Trash2,      color: "text-red-500",    bg: "bg-red-50 dark:bg-red-950/50",   label: "Hapus TO" },
  LOGIN:                 { icon: LogIn,       color: "text-slate-500",  bg: "bg-slate-100 dark:bg-slate-800", label: "Login" },
}

function getConfig(aksi: string) {
  return AKSI_CONFIG[aksi] ?? { icon: Bell, color: "text-slate-500", bg: "bg-slate-100 dark:bg-slate-800", label: aksi }
}

const ROLE_BADGE: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  SPV:   "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  USER:  "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
}

export function LogAktivitasClient() {
  const [logs, setLogs] = useState<LogItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [aksiFilter, setAksiFilter] = useState("ALL")
  const [userFilter, setUserFilter] = useState("ALL")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [filterUsers, setFilterUsers] = useState<FilterUser[]>([])
  const [aksiList, setAksiList] = useState<string[]>([])

  const fetchLogs = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "50",
        ...(search && { search }),
        ...(aksiFilter !== "ALL" && { aksi: aksiFilter }),
        ...(userFilter !== "ALL" && { userId: userFilter }),
      })
      const res = await fetch(`/api/log-aktivitas?${params}`)
      if (!res.ok) throw new Error("Gagal memuat log")
      const data = await res.json()
      setLogs(data.logs ?? [])
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
      if (data.filters.users.length > 0) setFilterUsers(data.filters.users)
      if (data.filters.aksiList.length > 0) setAksiList(data.filters.aksiList)
    } catch (err) {
      toast.error("Gagal memuat log aktivitas")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [page, search, aksiFilter, userFilter])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Reset page saat filter berubah
  useEffect(() => {
    setPage(1)
  }, [search, aksiFilter, userFilter])

  function handleClearFilters() {
    setSearch("")
    setAksiFilter("ALL")
    setUserFilter("ALL")
    setPage(1)
  }

  const hasActiveFilters = search || aksiFilter !== "ALL" || userFilter !== "ALL"

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari aksi atau detail..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={aksiFilter} onValueChange={setAksiFilter}>
              <SelectTrigger className="w-full md:w-48">
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Semua Aksi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Aksi</SelectItem>
                {aksiList.map((a) => (
                  <SelectItem key={a} value={a}>
                    {getConfig(a).label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Semua User" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua User</SelectItem>
                {filterUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nama} ({u.username})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={handleClearFilters} className="shrink-0">
                <X className="h-4 w-4 mr-1" />
                Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats bar */}
      <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
        <span>
          {isLoading ? "Memuat..." : `${total.toLocaleString("id-ID")} log ditemukan`}
        </span>
        {totalPages > 1 && (
          <span>Halaman {page} / {totalPages}</span>
        )}
      </div>

      {/* Table */}
      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <div className="flex items-center justify-center p-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
            <span className="text-muted-foreground">Memuat log...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center p-16">
            <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">Tidak ada log ditemukan</p>
            {hasActiveFilters && (
              <p className="text-sm text-muted-foreground mt-1">Coba ubah filter pencarian</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold w-10">No</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">Aksi</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">Detail</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">User</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold w-40">Waktu</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, index) => {
                  const cfg = getConfig(log.aksi)
                  const Icon = cfg.icon
                  return (
                    <tr
                      key={log.id}
                      className="border-b hover:bg-slate-50 dark:hover:bg-slate-800/30"
                    >
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {(page - 1) * 50 + index + 1}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                          <Icon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground max-w-xs">
                        <p className="truncate" title={log.detail ?? "-"}>
                          {log.detail || "-"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{log.user.nama}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ROLE_BADGE[log.user.role] ?? ROLE_BADGE.USER}`}>
                            {log.user.role}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">{log.user.username}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <p className="text-xs text-muted-foreground">
                          {new Date(log.createdAt).toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(log.createdAt).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </p>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || isLoading}
          >
            <ChevronLeft className="h-4 w-4" />
            Sebelumnya
          </Button>
          <span className="text-sm text-muted-foreground px-2">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || isLoading}
          >
            Berikutnya
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  )
}
