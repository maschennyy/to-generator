"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  Users,
  TrendingUp,
  AlertTriangle,
  Database,
  Loader2,
  Clock,
  Activity,
} from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"

interface Stats {
  totalPelanggan: number
  totalDIL: number
  totalToHistoris: number
  totalPemakaian: number
  totalTO: number
  toPending: number
  toDiproses: number
  toSelesai: number
}

export function DashboardStats() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/dashboard-warning")
        if (response.ok) {
          const result = await response.json()
          setStats(result.stats)
        }
      } catch (error) {
        console.error(error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!stats) return null

  const cards = [
    {
      title: "Total Pelanggan",
      value: stats.totalPelanggan,
      icon: Users,
      color: "blue",
      description: "Pelanggan terdaftar",
      href: "/pelanggan",
    },
    {
      title: "Data Pemakaian",
      value: stats.totalPemakaian,
      icon: TrendingUp,
      color: "purple",
      description: "Total record pemakaian",
      href: "/pemakaian",
    },
    {
      title: "TO Historis",
      value: stats.totalToHistoris,
      icon: Database,
      color: "slate",
      description: "Pelanggan pernah TO",
      href: "/master-data/to-historis",
    },
    {
      title: "TO Pending",
      value: stats.toPending,
      icon: Clock,
      color: "amber",
      description: "Menunggu tindak lanjut",
      href: "/target-operasi?status=PENDING",
    },
    {
      title: "Sedang Diproses",
      value: stats.toDiproses,
      icon: Activity,
      color: "blue",
      description: "Sedang ditindaklanjuti",
      href: "/target-operasi?status=DIPROSES",
    },
    {
      title: "TO Selesai",
      value: stats.toSelesai,
      icon: AlertTriangle,
      color: "green",
      description: "Sudah diselesaikan",
      href: "/target-operasi?status=SELESAI",
    },
  ]

  const colorClasses: Record<string, string> = {
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
    green: "bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400",
    amber: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
    purple: "bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <Link key={card.title} href={card.href}>
            <Card className="hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800 transition-all cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">{card.title}</p>
                  <div
                    className={`h-8 w-8 rounded-lg flex items-center justify-center ${colorClasses[card.color]}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-2xl font-bold">{card.value.toLocaleString("id-ID")}</p>
                <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
