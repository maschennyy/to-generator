"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, CheckCircle2, XCircle, X } from "lucide-react"
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

const TYPE_LABEL: Record<string, string> = {
  PELANGGAN: "Pelanggan",
  PEMAKAIAN: "Pemakaian",
  TO_HISTORIS: "TO Historis",
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
        // Ambil job aktif (PENDING/PROCESSING)
        const res = await fetch("/api/import-jobs")
        if (!res.ok) return

        const data = await res.json()
        const activeJobs: ImportJob[] = data.jobs ?? []

        setJobs((prev) => {
          const next = new Map(prev)

          for (const job of activeJobs) {
            next.set(job.id, job)
          }

          // Untuk job yang sudah tidak aktif tapi masih ditampilkan,
          // fetch status finalnya sekali
          return next
        })

        // Fetch status final untuk job yang sebelumnya PROCESSING tapi sudah hilang dari list aktif
        const prevJobs = prevStatusRef.current
        for (const [id, status] of prevJobs) {
          if (status === "PROCESSING" && !activeJobs.find((j) => j.id === id)) {
            // Job selesai — ambil data finalnya
            fetch(`/api/import-jobs?jobId=${id}`)
              .then((r) => r.json())
              .then((job: ImportJob) => {
                if (!active) return
                setJobs((prev) => {
                  const next = new Map(prev)
                  next.set(job.id, job)
                  return next
                })
                // Toast notifikasi
                if (job.status === "DONE") {
                  toast.success(`Import ${TYPE_LABEL[job.type] ?? job.type} selesai!`, {
                    description: `${job.created} baru · ${job.updated} update${job.errors > 0 ? ` · ${job.errors} error` : ""}`,
                  })
                } else if (job.status === "FAILED") {
                  toast.error(`Import ${TYPE_LABEL[job.type] ?? job.type} gagal`)
                }
              })
              .catch(() => null)
          }
        }

        // Simpan status saat ini untuk perbandingan di poll berikutnya
        const newPrev = new Map<string, string>()
        for (const job of activeJobs) {
          newPrev.set(job.id, job.status)
        }
        prevStatusRef.current = newPrev

      } catch {
        // silent fail — jangan ganggu UI
      } finally {
        if (active) {
          // Poll lebih lambat saat ada job aktif (5 detik), lebih jarang kalau tidak ada (15 detik)
          // Ini drastis mengurangi beban server saat upload sedang berjalan
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
      (j.status === "PROCESSING" || j.status === "PENDING" || j.status === "DONE" || j.status === "FAILED")
  )

  if (visibleJobs.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {visibleJobs.map((job) => {
        const pct = job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0
        const label = TYPE_LABEL[job.type] ?? job.type
        const isDone = job.status === "DONE"
        const isFailed = job.status === "FAILED"
        const isRunning = job.status === "PROCESSING" || job.status === "PENDING"

        return (
          <div
            key={job.id}
            className={`rounded-lg border shadow-lg p-4 bg-white dark:bg-slate-900 ${
              isDone
                ? "border-green-300 dark:border-green-800"
                : isFailed
                ? "border-red-300 dark:border-red-800"
                : "border-blue-300 dark:border-blue-800"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {isRunning && <Loader2 className="h-4 w-4 animate-spin text-blue-600 shrink-0" />}
                {isDone && <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />}
                {isFailed && <XCircle className="h-4 w-4 text-red-600 shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {isRunning
                      ? `Mengimport ${label}...`
                      : isDone
                      ? `Import ${label} selesai`
                      : `Import ${label} gagal`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isRunning
                      ? `${job.processed.toLocaleString()} / ${job.total.toLocaleString()} data`
                      : isDone
                      ? `${job.created.toLocaleString()} baru · ${job.updated.toLocaleString()} update${job.errors > 0 ? ` · ${job.errors} error` : ""}`
                      : "Terjadi kesalahan"}
                  </p>
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
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-1000"
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
