import Link from "next/link"
import { AlertCircle, ArrowRight, Clock, Database, Target } from "lucide-react"

import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const ANOMALY_LABEL: Record<string, string> = {
  TURUN_DRASTIS: "Turun Drastis",
  STAGNAN: "Stagnan",
  NOL_PEMAKAIAN: "Nol Pemakaian",
  LONJAKAN: "Lonjakan",
  POLA_TIDAK_WAJAR: "Pola Tidak Wajar",
}

const JOB_LABEL: Record<string, string> = {
  PELANGGAN: "Import Pelanggan",
  PEMAKAIAN: "Import Pemakaian",
  TO_HISTORIS: "Import TO Historis",
  GENERATE_TO: "Generate TO",
}

export async function DashboardPriority() {
  const [topTargets, incompleteCustomers, failedJobs, activeJobs] = await Promise.all([
    prisma.targetOperasi.findMany({
      where: { status: "PENDING" },
      orderBy: [{ skor: "desc" }, { createdAt: "desc" }],
      take: 5,
      select: {
        id: true,
        skor: true,
        tipeAnomali: true,
        periode: true,
        pelanggan: {
          select: {
            id: true,
            idPelanggan: true,
            nama: true,
            tarif: true,
            daya: true,
          },
        },
      },
    }),
    prisma.pelanggan.findMany({
      where: { dataLengkap: false },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, idPelanggan: true, nama: true },
    }),
    prisma.importJob.findMany({
      where: { status: "FAILED" },
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: { id: true, type: true, errorDetail: true, updatedAt: true },
    }),
    prisma.importJob.findMany({
      where: { status: { in: ["PENDING", "PROCESSING"] } },
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: { id: true, type: true, processed: true, total: true, status: true },
    }),
  ])

  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-base">Prioritas Hari Ini</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Target pending dengan skor tertinggi untuk diproses lebih dulu.
            </p>
          </div>
          <Link href="/target-operasi?status=PENDING">
            <Button variant="outline" size="sm">
              Lihat TO
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {topTargets.length === 0 ? (
            <EmptyState
              icon={<Target className="h-5 w-5" />}
              title="Tidak ada TO pending"
              description="Semua target operasi sudah diproses atau belum ada hasil generate baru."
            />
          ) : (
            <div className="divide-y">
              {topTargets.map((item, index) => (
                <Link
                  key={item.id}
                  href="/target-operasi"
                  className="flex items-center gap-3 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-sm font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-sm font-semibold">{item.pelanggan.idPelanggan}</p>
                      <Badge variant="outline">{ANOMALY_LABEL[item.tipeAnomali] ?? item.tipeAnomali}</Badge>
                      <Badge className={getRiskBadgeClass(item.skor)}>{Math.round(item.skor)}%</Badge>
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {item.pelanggan.nama || "Nama belum diisi"} - {item.pelanggan.tarif}/{item.pelanggan.daya} VA - {item.periode}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Kebersihan Data</CardTitle>
          </CardHeader>
          <CardContent>
            {incompleteCustomers.length === 0 ? (
              <EmptyState
                icon={<Database className="h-5 w-5" />}
                title="Data pelanggan lengkap"
                description="Tidak ada pelanggan baru yang perlu dilengkapi."
              />
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Lengkapi data berikut agar analisis dan laporan lebih akurat.
                </p>
                <div className="space-y-2">
                  {incompleteCustomers.map((item) => (
                    <Link
                      key={item.id}
                      href={`/pelanggan/${item.id}/edit`}
                      className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-900"
                    >
                      <span className="font-mono">{item.idPelanggan}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Proses Sistem</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeJobs.length > 0 ? (
              activeJobs.map((job) => (
                <div key={job.id} className="flex items-start gap-3 rounded-lg border px-3 py-2">
                  <Clock className="mt-0.5 h-4 w-4 text-blue-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{JOB_LABEL[job.type] ?? job.type}</p>
                    <p className="text-xs text-muted-foreground">
                      {job.processed.toLocaleString("id-ID")} / {job.total.toLocaleString("id-ID")} diproses
                    </p>
                  </div>
                </div>
              ))
            ) : failedJobs.length > 0 ? (
              failedJobs.map((job) => (
                <div key={job.id} className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900 dark:bg-amber-950/30">
                  <AlertCircle className="mt-0.5 h-4 w-4 text-amber-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{JOB_LABEL[job.type] ?? job.type} gagal</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {job.errorDetail || "Tidak ada detail error."}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                icon={<Clock className="h-5 w-5" />}
                title="Tidak ada proses aktif"
                description="Import dan generate TO terakhir dalam kondisi tenang."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-dashed p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function getRiskBadgeClass(score: number) {
  if (score >= 70) return "bg-red-600 text-white hover:bg-red-600"
  if (score >= 40) return "bg-amber-500 text-white hover:bg-amber-500"
  return "bg-slate-500 text-white hover:bg-slate-500"
}
