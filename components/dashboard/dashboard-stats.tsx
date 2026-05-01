"use client"

import { useState, useEffect } from "react"
import {
  Users,
  TrendingUp,
  Target,
  AlertTriangle,
  Database,
  Loader2,
} from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"

interface Stats {
  totalPelanggan: number
  totalDIL: number
  totalTO: number
  totalPemakaian: number
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
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
    },
    {
      title: "Master DIL",
      value: stats.totalDIL,
      icon: Database,
      color: "green",
      description: "Data induk pelanggan",
    },
    {
      title: "TO Historis",
      value: stats.totalTO,
      icon: AlertTriangle,
      color: "amber",
      description: "Pelanggan pernah TO",
    },
    {
      title: "Data Pemakaian",
      value: stats.totalPemakaian,
      icon: TrendingUp,
      color: "purple",
      description: "Total record pemakaian",
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon
        const colorClasses = {
          blue: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
          green: "bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400",
          amber: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
          purple: "bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
        }

        return (
          <Card key={card.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">{card.title}</p>
                <div
                  className={`h-10 w-10 rounded-lg flex items-center justify-center ${colorClasses[card.color as keyof typeof colorClasses]}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className="text-3xl font-bold">{card.value.toLocaleString("id-ID")}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {card.description}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}