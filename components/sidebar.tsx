"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  Target,
  FileText,
  AlertTriangle,
  Brain,
  ChevronLeft,
  ShieldCheck,
  History,
  Settings,
} from "lucide-react"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"

interface SidebarProps {
  userRole: string
}

export function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    const saved = localStorage.getItem("sidebar-collapsed")
    if (saved === "true") setIsCollapsed(true)
  }, [])

  function toggleCollapsed() {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem("sidebar-collapsed", String(newState))
  }

  const menuItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/pelanggan", label: "Pelanggan", icon: Users },
    { href: "/pemakaian", label: "Pemakaian", icon: TrendingUp },
    { href: "/master-data/to-historis", label: "TO Historis", icon: AlertTriangle },
    { href: "/target-operasi", label: "Target Operasi", icon: Target },
    { href: "/laporan", label: "Laporan", icon: FileText },
  ]

  const adminMenuItems = [
    { href: "/admin/nalar-dashboard", label: "NALAR Dashboard", icon: Brain },
    { href: "/admin/pengaturan", label: "Pengaturan", icon: Settings },
    { href: "/admin/users", label: "Manajemen User", icon: ShieldCheck },
    { href: "/admin/log", label: "Log Aktivitas", icon: History },
  ]

  function isActive(href: string): boolean {
    return pathname === href || pathname.startsWith(href + "/")
  }

  if (!isMounted) {
    return (
      <aside className="w-64 bg-white dark:bg-black border-r border-slate-200 dark:border-neutral-800 flex-shrink-0 h-screen sticky top-0" />
    )
  }

  const renderLink = (item: { href: string; label: string; icon: typeof LayoutDashboard }) => {
    const Icon = item.icon
    const active = isActive(item.href)

    const linkContent = (
      <Link
        href={item.href}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isCollapsed ? "justify-center" : ""
        } ${
          active
            ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
            : "text-slate-700 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-900 dark:hover:text-neutral-200"
        }`}
      >
        <Icon className="h-5 w-5 flex-shrink-0" />
        {!isCollapsed && <span className="truncate">{item.label}</span>}
      </Link>
    )

    if (isCollapsed) {
      return (
        <Tooltip key={item.href}>
          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            <p className="font-medium">{item.label}</p>
          </TooltipContent>
        </Tooltip>
      )
    }

    return <div key={item.href}>{linkContent}</div>
  }

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={`${
          isCollapsed ? "w-20" : "w-64"
        } bg-white dark:bg-black border-r border-slate-200 dark:border-neutral-800 flex-shrink-0 flex flex-col h-screen sticky top-0 transition-all duration-300 ease-in-out`}
      >
        {/* Header: Logo + Toggle — satu baris, tidak ada yang hilang */}
        <div className="p-3.5 border-b border-slate-200 dark:border-neutral-800 flex items-center justify-between">
          {isCollapsed ? (
            /* Collapsed: hanya logo "TO" yang juga berfungsi sebagai tombol expand */
            <button
              onClick={toggleCollapsed}
              className="h-10 w-10 rounded-lg bg-gradient-to-br from-neutral-700 to-black flex items-center justify-center text-white font-bold text-sm flex-shrink-0 mx-auto hover:scale-105 transition-transform"
              title="Buka sidebar"
            >
              N
            </button>
          ) : (
            /* Expanded: logo + teks + tombol collapse */
            <>
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-neutral-700 to-black flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  N
                </div>
                <div className="overflow-hidden">
                  <h1 className="text-base font-bold dark:text-white whitespace-nowrap">NALAR P2TL</h1>
                  <p className="text-xs text-muted-foreground whitespace-nowrap">Risk Operation System</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleCollapsed}
                className="h-8 w-8 p-0 flex-shrink-0 text-slate-700 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-900"
                title="Tutup sidebar"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        {/* Tidak ada baris tambahan di sini — langsung menu */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {menuItems.map(renderLink)}

          {userRole === "ADMIN" && (
            <>
              <div className={`pt-3 pb-1 ${isCollapsed ? "hidden" : ""}`}>
                <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Admin
                </p>
              </div>
              {isCollapsed && <div className="border-t border-slate-200 dark:border-neutral-800 my-2" />}
              {adminMenuItems.map(renderLink)}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className={`p-4 border-t border-slate-200 dark:border-neutral-800 ${isCollapsed ? "text-center" : ""}`}>
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-center">
                  <div className="h-8 w-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    {userRole.charAt(0).toUpperCase()}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                <p className="font-medium">Role: {userRole}</p>
                <p className="text-xs text-muted-foreground">v1.0.0</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="text-xs text-muted-foreground">
              <p className="font-medium">
                Role: <span className="text-neutral-600 dark:text-neutral-400">{userRole}</span>
              </p>
              <p className="mt-1">v1.0.0</p>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  )
}
