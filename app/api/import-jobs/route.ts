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

    if (!["PELANGGAN", "PEMAKAIAN", "TO_HISTORIS"].includes(type)) {
      return NextResponse.json({ error: "Tipe import tidak dikenali" }, { status: 400 })
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
// BACKGROUND PROCESSOR
// ============================================================

type ValidPelangganRow = {
  idPelanggan: string
  nama: string
  lokasi: string
  tarif: string
  daya: number
  isToHistory: boolean
  dataLengkap: boolean
}

type ValidPemakaianRow = {
  idPelanggan: string
  bulan: number
  tahun: number
  kwh: number
}

async function processImportInBackground(
  jobId: string,
  type: string,
  data: Record<string, unknown>[],
  userId: string
) {
  if (type === "PELANGGAN") {
    await processPelanggan(jobId, data, userId)
  } else if (type === "PEMAKAIAN") {
    await processPemakaian(jobId, data, userId)
  }
}

// ── PELANGGAN ─────────────────────────────────────────────────────────────────

async function processPelanggan(
  jobId: string,
  data: Record<string, unknown>[],
  userId: string
) {
  let processed = 0
  let created = 0
  let updated = 0
  let errors = 0

  const BATCH_SIZE = 500

  const allTO = await prisma.tOHistoris.findMany({ select: { idPelanggan: true } })
  const toSet = new Set(allTO.map((t) => t.idPelanggan))

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE)
    const validRows: ValidPelangganRow[] = []

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
      const existingIds = await prisma.pelanggan.findMany({
        where: { idPelanggan: { in: validRows.map((r) => r.idPelanggan) } },
        select: { idPelanggan: true },
      })
      const existingSet = new Set(existingIds.map((e) => e.idPelanggan))

      created += validRows.filter((r) => !existingSet.has(r.idPelanggan)).length
      updated += validRows.filter((r) => existingSet.has(r.idPelanggan)).length

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
        )
      )
    }

    await prisma.importJob.update({
      where: { id: jobId },
      data: { processed, created, updated, errors },
    })
  }

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

// ── PEMAKAIAN ─────────────────────────────────────────────────────────────────

async function processPemakaian(
  jobId: string,
  data: Record<string, unknown>[],
  userId: string
) {
  let processed = 0
  let created = 0
  let updated = 0
  let errors = 0

  const BATCH_SIZE = 300

  // Preload TO Historis dan semua pelanggan yang ada
  const [allTO, allPelanggan] = await Promise.all([
    prisma.tOHistoris.findMany({ select: { idPelanggan: true } }),
    prisma.pelanggan.findMany({ select: { id: true, idPelanggan: true } }),
  ])

  const toSet = new Set(allTO.map((t) => t.idPelanggan))
  const pelangganMap = new Map(allPelanggan.map((p) => [p.idPelanggan, p.id]))

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE)
    const validRows: ValidPemakaianRow[] = []

    for (const item of batch) {
      try {
        const cleanId = cleanIdPelanggan(String(item.idPelanggan ?? ""))
        if (!cleanId) { errors++; processed++; continue }

        const bulan = parseInt(String(item.bulan ?? "0"))
        const tahun = parseInt(String(item.tahun ?? "0"))
        const kwh = parseFloat(String(item.kwh ?? "0")) || 0

        if (!bulan || bulan < 1 || bulan > 12 || !tahun || tahun < 2000) {
          errors++; processed++; continue
        }

        validRows.push({ idPelanggan: cleanId, bulan, tahun, kwh })
        processed++
      } catch {
        errors++
        processed++
      }
    }

    if (validRows.length > 0) {
      // Auto-create pelanggan yang belum ada
      const missingIds = validRows
        .map((r) => r.idPelanggan)
        .filter((id) => !pelangganMap.has(id))
      const uniqueMissing = [...new Set(missingIds)]

      if (uniqueMissing.length > 0) {
        await prisma.$transaction(
          uniqueMissing.map((idPelanggan) =>
            prisma.pelanggan.upsert({
              where: { idPelanggan },
              create: {
                idPelanggan,
                nama: "",
                tarif: "R1",
                daya: 900,
                lokasi: "",
                isToHistory: toSet.has(idPelanggan),
                dataLengkap: false,
              },
              update: {},
            })
          )
        )

        // Refresh pelanggan map
        const newPelanggan = await prisma.pelanggan.findMany({
          where: { idPelanggan: { in: uniqueMissing } },
          select: { id: true, idPelanggan: true },
        })
        for (const p of newPelanggan) {
          pelangganMap.set(p.idPelanggan, p.id)
        }
      }

      // Upsert pemakaian
      const upsertOps = validRows.flatMap((row) => {
        const pelangganId = pelangganMap.get(row.idPelanggan)

        if (!pelangganId) {
          return []
        }

        return [
          prisma.pemakaian.upsert({
            where: {
              pelangganId_bulan_tahun: {
                pelangganId,
                bulan: row.bulan,
                tahun: row.tahun,
              },
            },
            create: {
              pelangganId,
              bulan: row.bulan,
              tahun: row.tahun,
              kwh: row.kwh,
            },
            update: {
              kwh: row.kwh,
            },
          }),
        ]
      })

      // Hitung created vs updated
      const existingPemakaian = await prisma.pemakaian.findMany({
        where: {
          OR: validRows.map((r) => {
            const pelangganId = pelangganMap.get(r.idPelanggan)
            return pelangganId
              ? { pelangganId, bulan: r.bulan, tahun: r.tahun }
              : { pelangganId: "" }
          }),
        },
        select: { pelangganId: true, bulan: true, tahun: true },
      })

      const existingKeys = new Set(
        existingPemakaian.map((p) => `${p.pelangganId}-${p.bulan}-${p.tahun}`)
      )

      for (const row of validRows) {
        const pelangganId = pelangganMap.get(row.idPelanggan)
        if (!pelangganId) continue
        const key = `${pelangganId}-${row.bulan}-${row.tahun}`
        if (existingKeys.has(key)) updated++
        else created++
      }

      if (upsertOps.length > 0) {
        await prisma.$transaction(upsertOps)
      }
    }

    await prisma.importJob.update({
      where: { id: jobId },
      data: { processed, created, updated, errors },
    })
  }

  await prisma.importJob.update({
    where: { id: jobId },
    data: { status: "DONE", processed, created, updated, errors },
  })

  await prisma.logAktivitas.create({
    data: {
      userId,
      aksi: "BULK_IMPORT_PEMAKAIAN",
      detail: `Background import pemakaian: ${created} baru, ${updated} update, ${errors} error`,
    },
  })
}
