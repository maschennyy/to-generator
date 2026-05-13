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

    // Buat job record dulu
    const job = await prisma.importJob.create({
      data: {
        userId: session.user.id,
        type,
        status: "PROCESSING",
        total: data.length,
        processed: 0,
      },
    })

    // Jalankan proses di background (tidak await — langsung return)
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

// GET /api/import-jobs?jobId=xxx — cek status job (polling dari frontend)
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get("jobId")

    if (jobId) {
      // Cek job spesifik
      const job = await prisma.importJob.findUnique({ where: { id: jobId } })
      if (!job) {
        return NextResponse.json({ error: "Job tidak ditemukan" }, { status: 404 })
      }
      return NextResponse.json(job)
    }

    // Ambil semua job aktif milik user (PENDING atau PROCESSING)
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
// BACKGROUND PROCESSOR — tidak di-await, jalan mandiri
// ============================================================

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

  const BATCH_SIZE = 100 // proses per 100 baris, update progress tiap batch

  if (type === "PELANGGAN") {
    // Preload TO Historis sekali saja
    const allTO = await prisma.tOHistoris.findMany({ select: { idPelanggan: true } })
    const toSet = new Set(allTO.map((t) => t.idPelanggan))

    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE)

      for (const item of batch) {
        try {
          const cleanId = cleanIdPelanggan(String(item.idPelanggan ?? ""))
          if (!cleanId) { errors++; processed++; continue }

          const namaFinal = String(item.nama ?? "").trim()
          const alamatFinal = String(item.alamat ?? item.lokasi ?? "").trim()
          const tarifFinal = String(item.tarif ?? "R1").trim()
          const dayaFinal = parseInt(String(item.daya ?? "900")) || 900
          const dataLengkap = !!(namaFinal && alamatFinal)
          const isTO = toSet.has(cleanId)

          const existing = await prisma.pelanggan.findUnique({
            where: { idPelanggan: cleanId },
          })

          if (existing) {
            const updateData: Record<string, unknown> = {}
            if (namaFinal) updateData.nama = namaFinal
            if (alamatFinal) updateData.lokasi = alamatFinal
            if (tarifFinal) updateData.tarif = tarifFinal
            if (dayaFinal > 0) updateData.daya = dayaFinal
            if (isTO) updateData.isToHistory = true
            const finalNama = namaFinal || existing.nama
            const finalLokasi = alamatFinal || existing.lokasi
            if (finalNama && finalLokasi) updateData.dataLengkap = true

            if (Object.keys(updateData).length > 0) {
              await prisma.pelanggan.update({ where: { idPelanggan: cleanId }, data: updateData })
              updated++
            }
          } else {
            await prisma.pelanggan.create({
              data: {
                idPelanggan: cleanId,
                nama: namaFinal || "",
                tarif: tarifFinal,
                daya: dayaFinal,
                lokasi: alamatFinal || "",
                isToHistory: isTO,
                dataLengkap,
              },
            })
            created++
          }
          processed++
        } catch {
          errors++
          processed++
        }
      }

      // Update progress di DB tiap batch
      await prisma.importJob.update({
        where: { id: jobId },
        data: { processed, created, updated, errors },
      })
    }
  }

  // Selesai
  await prisma.importJob.update({
    where: { id: jobId },
    data: {
      status: "DONE",
      processed,
      created,
      updated,
      errors,
    },
  })

  // Catat log
  await prisma.logAktivitas.create({
    data: {
      userId,
      aksi: "BULK_IMPORT_PELANGGAN",
      detail: `Background import: ${created} baru, ${updated} update, ${errors} error`,
    },
  })
}
