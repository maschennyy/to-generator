"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  Activity,
  Target,
  FileText,
  History,
  Settings,
} from "lucide-react"
import type { Role } from "@/lib/generated/prisma/enums"

interface SidebarProps {
  userRole: Role
}

const menuItems = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
    roles: ["ADMIN", "SPV", "USER"],
  },
  {
    title: "Pelanggan",
    icon: Users,
    href: "/pelanggan",
    roles: ["ADMIN", "SPV", "USER"],
  },
  {
    title: "Pemakaian",
    icon: Activity,
    href: "/pemakaian",
    roles: ["ADMIN", "SPV", "USER"],
  },
  {
    title: "Target Operasi",
    icon: Target,
    href: "/target-operasi",
    roles: ["ADMIN", "SPV", "USER"],
  },
  {
    title: "Laporan",
    icon: FileText,
    href: "/laporan",
    roles: ["ADMIN", "SPV", "USER"],
  },
  {
    title: "Log Aktivitas",
    icon: History,
    href: "/log-aktivitas",
    roles: ["ADMIN"],
  },
  {
    title: "Pengaturan",
    icon: Settings,
    href: "/pengaturan",
    roles: ["ADMIN"],
  },
]

export function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname()

  const visibleMenu = menuItems.filter((item) => item.roles.includes(userRole))

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-screen sticky top-0">
      {/* Logo */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-800">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
            TO
          </div>
          <div>
            <h2 className="font-bold text-sm">TO Generator</h2>
            <p className="text-xs text-muted-foreground">v1.0.0</p>
          </div>
        </Link>
      </div>

      {/* Menu */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {visibleMenu.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800">
        <div className="text-xs text-muted-foreground text-center">
          © 2025 TO Generator
        </div>
      </div>
    </aside>
  )
}