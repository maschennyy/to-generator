"use client"

import { useState, useRef, useEffect } from "react"
import { LogOut, User, UserCircle, ChevronDown } from "lucide-react"
import { signOut } from "next-auth/react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { NotificationBell } from "@/components/notification-bell"
import { ThemeToggle } from "@/components/theme-toggle"

interface TopbarProps {
  userName: string
  userRole: string
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrator",
  SPV: "Supervisor",
  USER: "Pengguna",
}

export function Topbar({ userName, userRole }: TopbarProps) {
  const isAdmin = userRole === "ADMIN"
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Tutup menu saat klik di luar
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Inisial nama untuk avatar
  const initials = userName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()

  return (
    <header className="bg-white dark:bg-black border-b border-slate-200 dark:border-neutral-800 px-6 py-3 sticky top-0 z-20 shadow-sm">
  <div className="flex items-center justify-between">
    <div />
    <div className="flex items-center gap-2">
      <NotificationBell isAdmin={isAdmin} />
      <ThemeToggle />

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-900 transition-colors"
        >
          <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {initials || <User className="h-4 w-4" />}
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-sm font-medium leading-tight">{userName}</p>
            <p className="text-xs text-muted-foreground leading-tight">
              {ROLE_LABEL[userRole] ?? userRole}
            </p>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${menuOpen ? "rotate-180" : ""}`} />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-12 w-52 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-neutral-800">
              <p className="text-sm font-semibold truncate">{userName}</p>
              <p className="text-xs text-muted-foreground">
                {ROLE_LABEL[userRole] ?? userRole}
              </p>
            </div>
            <div className="p-1.5">
              <Link
                href="/profile"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <UserCircle className="h-4 w-4 text-muted-foreground" />
                Profil Saya
              </Link>
            </div>
            <div className="p-1.5 border-t border-slate-100 dark:border-neutral-800">
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors w-full"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
</header>
  )
}
