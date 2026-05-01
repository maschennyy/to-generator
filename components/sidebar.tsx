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
  ChevronLeft,
  ChevronRight,
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

  // Load preferensi dari localStorage saat mount
  useEffect(() => {
    setIsMounted(true)
    const saved = localStorage.getItem("sidebar-collapsed")
    if (saved === "true") {
      setIsCollapsed(true)
    }
  }, [])

  // Save preferensi ke localStorage saat berubah
  function toggleCollapsed() {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem("sidebar-collapsed", String(newState))
  }

  const menuItems = [
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      href: "/pelanggan",
      label: "Pelanggan",
      icon: Users,
    },
    {
      href: "/pemakaian",
      label: "Pemakaian",
      icon: TrendingUp,
    },
    {
      href: "/master-data/to-historis",
      label: "TO Historis",
      icon: AlertTriangle,
    },
    {
      href: "/target-operasi",
      label: "Target Operasi",
      icon: Target,
    },
    {
      href: "/laporan",
      label: "Laporan",
      icon: FileText,
    },
  ]

  function isActive(href: string): boolean {
    return pathname === href || pathname.startsWith(href + "/")
  }

  // Hindari hydration mismatch
  if (!isMounted) {
    return (
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-shrink-0 h-screen sticky top-0" />
    )
  }

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={`${
          isCollapsed ? "w-20" : "w-64"
        } bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-shrink-0 flex flex-col h-screen sticky top-0 transition-all duration-300 ease-in-out`}
      >
        {/* Logo + Toggle Button */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div
            className={`flex items-center gap-2 overflow-hidden ${
              isCollapsed ? "justify-center w-full" : ""
            }`}
          >
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              TO
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden">
                <h1 className="text-base font-bold whitespace-nowrap">
                  TO Generator
                </h1>
                <p className="text-xs text-muted-foreground whitespace-nowrap">
                  PLN ICON+
                </p>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleCollapsed}
              className="h-8 w-8 p-0 flex-shrink-0"
              title="Minimize sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Expand Button saat collapsed */}
        {isCollapsed && (
          <div className="p-2 border-b border-slate-200 dark:border-slate-800 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleCollapsed}
              className="h-8 w-8 p-0"
              title="Expand sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Menu Items - Scrollable */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)

            const linkContent = (
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isCollapsed ? "justify-center" : ""
                } ${
                  active
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </Link>
            )

            // Wrap dengan tooltip kalau collapsed
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
          })}
        </nav>

        {/* Footer */}
        <div
          className={`p-4 border-t border-slate-200 dark:border-slate-800 ${
            isCollapsed ? "text-center" : ""
          }`}
        >
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-center">
                  <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-300">
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
                Role:{" "}
                <span className="text-blue-600 dark:text-blue-400">
                  {userRole}
                </span>
              </p>
              <p className="mt-1">v1.0.0 - Dev Build</p>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  )
}