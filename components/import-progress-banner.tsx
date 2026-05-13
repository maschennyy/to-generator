"use client"

import { useEffect, useState, useCallback } from "react"
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
  const [jobs, setJobs] = useState<ImportJob[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const fetchActiveJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/import-jobs")
      if (!res.ok) return
      const data = await res.json()
      setJobs(data.jobs ?? [])
    } catch {
      // silent fail
    }
  }, [])

  // Poll setiap 2 detik saat ada job aktif
  useEffect(() => {
    fetchActiveJobs()
    const interval = setInterval(fetchActiveJobs, 2000)
    return () => clearInterval(interval)
  }, [fetchActiveJobs])

  // Poll job yang sedang ditampilkan (termasuk DONE/FAILED untuk update terakhir)
  const [trackedJobs, setTrackedJobs] = useState<ImportJob[]>([])

  useEffect(() => {
    const allJobIds = [...jobs.map((j) => j.id), ...trackedJobs.map((j) => j.id)]
    const uniqueIds = [...new Set(allJobIds)]

    if (uniqueIds.length === 0) return

    const pollTracked = async () => {
      const updated: ImportJob[] = []
      for (const id of uniqueIds) {
        if (dismissed.has(id)) continue
        try {
          const res = await fetch(`/api/import-jobs?jobId=${id}`)
          if (!res.ok) continue
          const job = await res.json()
          updated.push(job)

          // Toast notifikasi saat selesai
          if (job.status === "DONE") {
            const prev = trackedJobs.find((j) => j.id === id)
            if (prev && prev.status !== "DONE") {
              toast.success(`Import ${TYPE_LABEL[job.type] ?? job.type} selesai!`, {
                description: `${job.created} baru, ${job.updated} update${job.errors > 0 ? `, ${job.errors} error` : ""}`,
              })
            }
          } else if (job.status === "FAILED") {
            const prev = trackedJobs.find((j) => j.id === id)
            if (prev && prev.status !== "FAILED") {
              toast.error(`Import ${TYPE_LABEL[job.type] ?? job.type} gagal!`)
            }
          }
        } catch {
          // ignore
        }
      }
      setTrackedJobs(updated)
    }

    const interval = setInterval(pollTracked, 2000)
    pollTracked()
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, dismissed])

  const visibleJobs = trackedJobs.filter(
    (j) => !dismissed.has(j.id) && (j.status === "PROCESSING" || j.status === "DONE" || j.status === "FAILED")
  )

  if (visibleJobs.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {visibleJobs.map((job) => {
        const pct = job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0
        const label = TYPE_LABEL[job.type] ?? job.type

        return (
          <div
            key={job.id}
            className={`rounded-lg border shadow-lg p-4 bg-white dark:bg-slate-900 ${
              job.status === "DONE"
                ? "border-green-300 dark:border-green-800"
                : job.status === "FAILED"
                ? "border-red-300 dark:border-red-800"
                : "border-blue-300 dark:border-blue-800"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {job.status === "PROCESSING" && (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600 shrink-0" />
                )}
                {job.status === "DONE" && (
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                )}
                {job.status === "FAILED" && (
                  <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {job.status === "PROCESSING"
                      ? `Mengimport ${label}...`
                      : job.status === "DONE"
                      ? `Import ${label} selesai`
                      : `Import ${label} gagal`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {job.status === "PROCESSING"
                      ? `${job.processed} / ${job.total} data`
                      : job.status === "DONE"
                      ? `${job.created} baru · ${job.updated} update${job.errors > 0 ? ` · ${job.errors} error` : ""}`
                      : "Terjadi kesalahan"}
                  </p>
                </div>
              </div>
              {(job.status === "DONE" || job.status === "FAILED") && (
                <button
                  onClick={() => setDismissed((prev) => new Set([...prev, job.id]))}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {job.status === "PROCESSING" && job.total > 0 && (
              <div className="mt-2">
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
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
