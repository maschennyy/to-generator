"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Bell, CheckCircle2, Upload, Sparkles, ShieldCheck, Users, Trash2, KeyRound, LogIn } from "lucide-react"
import Link from "next/link"

interface LogItem {
  id: string
  aksi: string
  detail: string | null
  createdAt: string
  user: { nama: string; username: string; role: string }
}

const AKSI_CONFIG: Record<string, { icon: typeof Bell; color: string; label: string }> = {
  BULK_IMPORT_PELANGGAN: { icon: Upload, color: "text-blue-500", label: "Import Pelanggan" },
  GENERATE_TO:           { icon: Sparkles, color: "text-purple-500", label: "Generate TO" },
  CREATE_USER:           { icon: Users, color: "text-green-500", label: "Tambah User" },
  UPDATE_USER:           { icon: ShieldCheck, color: "text-amber-500", label: "Update User" },
  DELETE_USER:           { icon: Trash2, color: "text-red-500", label: "Hapus User" },
  RESET_PASSWORD:        { icon: KeyRound, color: "text-amber-500", label: "Reset Password" },
  DELETE_ALL_TO:         { icon: Trash2, color: "text-red-500", label: "Hapus Semua TO" },
  BULK_DELETE_TO:        { icon: Trash2, color: "text-red-400", label: "Hapus TO" },
  LOGIN:                 { icon: LogIn, color: "text-slate-400", label: "Login" },
}

function getConfig(aksi: string) {
  return AKSI_CONFIG[aksi] ?? { icon: Bell, color: "text-slate-400", label: aksi }
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "Baru saja"
  if (minutes < 60) return `${minutes} mnt lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  return `${days} hari lalu`
}

interface Props {
  isAdmin: boolean
}

export function NotificationBell({ isAdmin }: Props) {
  const [open, setOpen] = useState(false)
  const [logs, setLogs] = useState<LogItem[]>([])
  const [unread, setUnread] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchNotif = useCallback(async () => {
    try {
      const res = await fetch("/api/notifikasi")
      if (!res.ok) return
      const data = await res.json()
      setLogs(data.logs ?? [])
      setUnread(data.unreadCount ?? 0)
    } catch {
      // silent
    }
  }, [])

  // Poll setiap 30 detik
  useEffect(() => {
    setIsLoading(true)
    fetchNotif().finally(() => setIsLoading(false))

    function schedule() {
      timerRef.current = setTimeout(async () => {
        await fetchNotif()
        schedule()
      }, 30000)
    }
    schedule()

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [fetchNotif])

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function handleOpen() {
    setOpen((v) => !v)
    if (!open) setUnread(0) // reset badge saat dibuka
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative h-9 w-9 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-label="Notifikasi"
      >
        <Bell className={`h-5 w-5 ${isLoading ? "animate-pulse" : ""}`} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-11 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <p className="text-sm font-semibold">Aktivitas Terbaru</p>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Belum ada aktivitas</p>
              </div>
            ) : (
              logs.map((log) => {
                const cfg = getConfig(log.aksi)
                const Icon = cfg.icon
                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-50 dark:border-slate-800/50 last:border-0"
                  >
                    <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className={`h-4 w-4 ${cfg.color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{cfg.label}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {log.detail || "-"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <span className="font-medium text-slate-500 dark:text-slate-400">
                          {log.user.nama}
                        </span>
                        - {timeAgo(log.createdAt)}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer — hanya admin bisa lihat log lengkap */}
          {isAdmin && (
            <div className="border-t border-slate-100 dark:border-slate-800 p-2">
              <Link
                href="/admin/log"
                onClick={() => setOpen(false)}
                className="block w-full text-center text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 py-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
              >
                Lihat semua log aktivitas →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
