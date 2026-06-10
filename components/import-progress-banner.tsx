"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, CheckCircle2, XCircle, X, Sparkles, Upload } from "lucide-react"
import { toast } from "sonner"

interface ImportJob {
  id: string
  type: string
  status: string
  total: number
  processed: number
  created: number
  updated: number
  errors: number
}

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: typeof Upload; color: string }
> = {
  PELANGGAN: {
    label: "Import Pelanggan",
    icon: Upload,
    color: "border-blue-300 dark:border-blue-800",
  },
  PEMAKAIAN: {
    label: "Import Pemakaian",
    icon: Upload,
    color: "border-blue-300 dark:border-blue-800",
  },
  TO_HISTORIS: {
    label: "Import TO Historis",
    icon: Upload,
    color: "border-blue-300 dark:border-blue-800",
  },
  GENERATE_TO: {
    label: "Generate Target Operasi",
    icon: Sparkles,
    color: "border-purple-300 dark:border-purple-800",
  },
}

function getDescription(job: ImportJob): string {
  if (job.type === "GENERATE_TO") {
    if (job.status === "PROCESSING") {
      return `${job.processed.toLocaleString("id-ID")} / ${job.total.toLocaleString("id-ID")} pelanggan dianalisis`
    }
    if (job.status === "DONE") {
      return `${job.updated.toLocaleString("id-ID")} anomali - ${job.created.toLocaleString("id-ID")} TO dibuat`
    }
  }
  // Import jobs
  if (job.status === "PROCESSING") {
    return `${job.processed.toLocaleString("id-ID")} / ${job.total.toLocaleString("id-ID")} data`
  }
  if (job.status === "DONE") {
    return `${job.created.toLocaleString("id-ID")} baru - ${job.updated.toLocaleString("id-ID")} update${job.errors > 0 ? ` - ${job.errors} error` : ""}`
  }
  return "Terjadi kesalahan"
}

export function ImportProgressBanner() {
  const [jobs, setJobs] = useState<Map<string, ImportJob>>(new Map())
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const prevStatusRef = useRef<Map<string, string>>(new Map())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let active = true

    async function poll() {
      if (!active) return

      try {
        const res = await fetch("/api/import-jobs")
        if (!res.ok) return

        const data = await res.json()
        const activeJobs: ImportJob[] = data.jobs ?? []

        setJobs((prev) => {
          const next = new Map(prev)
          for (const job of activeJobs) {
            next.set(job.id, job)
          }
          return next
        })

        // Fetch status final untuk job yang baru saja selesai
        const prevJobs = prevStatusRef.current
        for (const [id, status] of prevJobs) {
          if (status === "PROCESSING" && !activeJobs.find((j) => j.id === id)) {
            fetch(`/api/import-jobs?jobId=${id}`)
              .then((r) => r.json())
              .then((job: ImportJob) => {
                if (!active) return
                setJobs((prev) => {
                  const next = new Map(prev)
                  next.set(job.id, job)
                  return next
                })

                const config = TYPE_CONFIG[job.type]
                const label = config?.label ?? job.type

                if (job.status === "DONE") {
                  toast.success(`${label} selesai!`, {
                    description: getDescription(job),
                  })
                } else if (job.status === "FAILED") {
                  toast.error(`${label} gagal`)
                }
              })
              .catch(() => null)
          }
        }

        const newPrev = new Map<string, string>()
        for (const job of activeJobs) {
          newPrev.set(job.id, job.status)
        }
        prevStatusRef.current = newPrev
      } catch {
        // silent fail
      } finally {
        if (active) {
          const hasActive = prevStatusRef.current.size > 0
          timerRef.current = setTimeout(poll, hasActive ? 5000 : 15000)
        }
      }
    }

    poll()

    return () => {
      active = false
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const visibleJobs = [...jobs.values()].filter(
    (j) =>
      !dismissed.has(j.id) &&
      (j.status === "PROCESSING" ||
        j.status === "PENDING" ||
        j.status === "DONE" ||
        j.status === "FAILED")
  )

  if (visibleJobs.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-80">
      {visibleJobs.map((job) => {
        const pct = job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0
        const config = TYPE_CONFIG[job.type] ?? TYPE_CONFIG["PELANGGAN"]
        const Icon = config.icon
        const isDone = job.status === "DONE"
        const isFailed = job.status === "FAILED"
        const isRunning = job.status === "PROCESSING" || job.status === "PENDING"

        const borderColor = isDone
          ? "border-green-300 dark:border-green-800"
          : isFailed
          ? "border-red-300 dark:border-red-800"
          : config.color

        return (
          <div
            key={job.id}
            className={`rounded-lg border shadow-lg p-4 bg-white dark:bg-slate-900 ${borderColor}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {isRunning && <Loader2 className="h-4 w-4 animate-spin text-blue-600 shrink-0" />}
                {isDone && <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />}
                {isFailed && <XCircle className="h-4 w-4 text-red-600 shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate flex items-center gap-1.5">
                    {isRunning && job.type === "GENERATE_TO" && (
                      <Icon className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                    )}
                    {isRunning
                      ? config.label + "..."
                      : isDone
                      ? config.label + " selesai"
                      : config.label + " gagal"}
                  </p>
                  <p className="text-xs text-muted-foreground">{getDescription(job)}</p>
                </div>
              </div>
              {(isDone || isFailed) && (
                <button
                  onClick={() => setDismissed((prev) => new Set([...prev, job.id]))}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {isRunning && job.total > 0 && (
              <div className="mt-2">
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-1000 ${
                      job.type === "GENERATE_TO" ? "bg-purple-600" : "bg-blue-600"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1 text-right">{pct}%</p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
