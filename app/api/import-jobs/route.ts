import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { cleanIdPelanggan } from "@/lib/validations/master-dil"

// POST /api/import-jobs — buat job baru, langsung return jobId, proses di background
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Hanya Admin" }, { status: 403 })
    }

    const body = await request.json()
    const { type, data } = body

    if (!type || !Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 })
    }

    const job = await prisma.importJob.create({
      data: {
        userId: session.user.id,
        type,
        status: "PROCESSING",
        total: data.length,
        processed: 0,
      },
    })

    // Jalankan di background — tidak di-await
    processImportInBackground(job.id, type, data, session.user.id).catch(
      async (err) => {
        console.error(`Import job ${job.id} failed:`, err)
        await prisma.importJob.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            errorDetail: err instanceof Error ? err.message : "Error tak terduga",
          },
        })
      }
    )

    return NextResponse.json({ jobId: job.id, total: data.length }, { status: 202 })
  } catch (error) {
    console.error("POST /api/import-jobs error:", error)
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 })
  }
}

// GET /api/import-jobs?jobId=xxx — cek status job
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get("jobId")

    if (jobId) {
      const job = await prisma.importJob.findUnique({ where: { id: jobId } })
      if (!job) {
        return NextResponse.json({ error: "Job tidak ditemukan" }, { status: 404 })
      }
      return NextResponse.json(job)
    }

    const activeJobs = await prisma.importJob.findMany({
      where: {
        userId: session.user.id,
        status: { in: ["PENDING", "PROCESSING"] },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ jobs: activeJobs })
  } catch (error) {
    console.error("GET /api/import-jobs error:", error)
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 })
  }
}

// ============================================================
// BACKGROUND PROCESSOR — batch upsert, jauh lebih cepat
// ============================================================

type ValidRow = {
  idPelanggan: string
  nama: string
  lokasi: string
  tarif: string
  daya: number
  isToHistory: boolean
  dataLengkap: boolean
}

async function processImportInBackground(
  jobId: string,
  type: string,
  data: Record<string, unknown>[],
  userId: string
) {
  let processed = 0
  let created = 0
  let updated = 0
  let errors = 0

  // Batch lebih besar = lebih cepat (500 upsert per transaksi)
  const BATCH_SIZE = 500

  if (type === "PELANGGAN") {
    // Preload TO Historis sekali — lookup O(1)
    const allTO = await prisma.tOHistoris.findMany({ select: { idPelanggan: true } })
    const toSet = new Set(allTO.map((t) => t.idPelanggan))

    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE)
      const validRows: ValidRow[] = []

      for (const item of batch) {
        try {
          const cleanId = cleanIdPelanggan(String(item.idPelanggan ?? ""))
          if (!cleanId) { errors++; processed++; continue }

          const nama = String(item.nama ?? "").trim()
          const lokasi = String(item.alamat ?? item.lokasi ?? "").trim()
          const tarif = String(item.tarif ?? "R1").trim()
          const daya = parseInt(String(item.daya ?? "900")) || 900

          validRows.push({
            idPelanggan: cleanId,
            nama,
            lokasi,
            tarif,
            daya,
            isToHistory: toSet.has(cleanId),
            dataLengkap: !!(nama && lokasi),
          })
          processed++
        } catch {
          errors++
          processed++
        }
      }

      if (validRows.length > 0) {
        // Cek existing untuk hitung statistik created vs updated
        const existingIds = await prisma.pelanggan.findMany({
          where: { idPelanggan: { in: validRows.map((r) => r.idPelanggan) } },
          select: { idPelanggan: true },
        })
        const existingSet = new Set(existingIds.map((e) => e.idPelanggan))

        created += validRows.filter((r) => !existingSet.has(r.idPelanggan)).length
        updated += validRows.filter((r) => existingSet.has(r.idPelanggan)).length

        // Upsert seluruh batch dalam SATU transaksi
        await prisma.$transaction(
          validRows.map((row) =>
            prisma.pelanggan.upsert({
              where: { idPelanggan: row.idPelanggan },
              create: {
                idPelanggan: row.idPelanggan,
                nama: row.nama || "",
                tarif: row.tarif,
                daya: row.daya,
                lokasi: row.lokasi || "",
                isToHistory: row.isToHistory,
                dataLengkap: row.dataLengkap,
              },
              update: {
                ...(row.nama && { nama: row.nama }),
                ...(row.lokasi && { lokasi: row.lokasi }),
                ...(row.tarif && { tarif: row.tarif }),
                ...(row.daya > 0 && { daya: row.daya }),
                ...(row.isToHistory && { isToHistory: true }),
                dataLengkap: row.dataLengkap,
              },
            })
          ),
          // Timeout transaksi 60 detik untuk batch besar
          { timeout: 60000 }
        )
      }

      // Update progress tiap batch
      await prisma.importJob.update({
        where: { id: jobId },
        data: { processed, created, updated, errors },
      })
    }
  }

  // Selesai
  await prisma.importJob.update({
    where: { id: jobId },
    data: { status: "DONE", processed, created, updated, errors },
  })

  await prisma.logAktivitas.create({
    data: {
      userId,
      aksi: "BULK_IMPORT_PELANGGAN",
      detail: `Background import: ${created} baru, ${updated} update, ${errors} error`,
    },
  })
}
