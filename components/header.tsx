"use client"

import { useState, useRef, useEffect } from "react"
import { signOut } from "next-auth/react"
import { LogOut, User, Shield, UserCog, ChevronDown } from "lucide-react"
import type { Role } from "@/lib/generated/prisma/enums"

interface HeaderProps {
  user: {
    nama: string
    username: string
    role: Role
  }
}

export function Header({ user }: HeaderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const initial = user.nama.charAt(0).toUpperCase()

  const roleIcon = {
    ADMIN: <Shield className="h-3 w-3" />,
    SPV: <UserCog className="h-3 w-3" />,
    USER: <User className="h-3 w-3" />,
  }

  const roleBadge = {
    ADMIN: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
    SPV: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
    USER: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  }

  // Close dropdown saat klik di luar
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  async function handleLogout() {
    setIsOpen(false)
    await signOut({ redirectTo: "/login" })
  }

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      {/* Info User Kiri */}
      <div className="flex items-center gap-3">
        <div>
          <p className="text-sm font-medium">{user.nama}</p>
          <div className="flex items-center gap-1">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${roleBadge[user.role]}`}
            >
              {roleIcon[user.role]}
              {user.role}
            </span>
          </div>
        </div>
      </div>

      {/* Dropdown Avatar Kanan */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <div className="h-9 w-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold">
            {initial}
          </div>
          <ChevronDown
            className={`h-4 w-4 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-56 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden z-20">
            {/* User Info */}
            <div className="p-3 border-b border-slate-200 dark:border-slate-800">
              <p className="font-semibold text-sm">{user.nama}</p>
              <p className="text-xs text-muted-foreground">@{user.username}</p>
            </div>

            {/* Menu Items */}
            <div className="py-1">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}