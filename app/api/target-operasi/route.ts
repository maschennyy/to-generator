import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { detectAnomaly, getPeriode } from "@/lib/anomali/detector"

// GET /api/target-operasi — tidak berubah, tetap sama
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status") || ""
    const tipe = searchParams.get("tipe") || ""
    const periode = searchParams.get("periode") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (tipe) where.tipeAnomali = tipe
    if (periode) where.periode = periode
    if (search) {
      where.pelanggan = {
        OR: [
          { idPelanggan: { contains: search, mode: "insensitive" } },
          { nama: { contains: search, mode: "insensitive" } },
          { lokasi: { contains: search, mode: "insensitive" } },
        ],
      }
    }

    const [rows, total, statusCounts] = await Promise.all([
      prisma.targetOperasi.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ skor: "desc" }, { createdAt: "desc" }],
        include: {
          pelanggan: {
            select: {
              id: true,
              idPelanggan: true,
              nama: true,
              tarif: true,
              daya: true,
              lokasi: true,
              isToHistory: true,
            },
          },
          createdBy: { select: { id: true, nama: true, username: true } },
        },
      }),
      prisma.targetOperasi.count({ where }),
      prisma.targetOperasi.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ])

    const counts = { PENDING: 0, DIPROSES: 0, SELESAI: 0, DIBATALKAN: 0 } as Record<string, number>
    for (const c of statusCounts) {
      counts[c.status] = c._count._all
    }

    return NextResponse.json({
      data: rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      stats: {
        total: Object.values(counts).reduce((a, b) => a + b, 0),
        counts,
      },
    })
  } catch (error) {
    console.error("GET /api/target-operasi error:", error)
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 })
  }
}

// POST /api/target-operasi — generate TO sebagai background job
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role === "USER") {
      return NextResponse.json({ error: "Forbidden: Hanya Admin atau SPV" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const replaceExistingPending: boolean = body?.replaceExistingPending !== false

    // Cek apakah sudah ada job GENERATE_TO yang sedang berjalan
    const runningJob = await prisma.importJob.findFirst({
      where: {
        type: "GENERATE_TO",
        status: { in: ["PENDING", "PROCESSING"] },
      },
    })

    if (runningJob) {
      return NextResponse.json(
        { error: "Generate TO sedang berjalan. Tunggu hingga selesai sebelum menjalankan ulang." },
        { status: 409 }
      )
    }

    // Hitung total pelanggan yang punya data pemakaian sebagai estimasi
    const totalPelanggan = await prisma.pelanggan.count({
      where: { pemakaian: { some: {} } },
    })

    // Buat job record
    const job = await prisma.importJob.create({
      data: {
        userId: session.user.id,
        type: "GENERATE_TO",
        status: "PROCESSING",
        total: totalPelanggan,
        processed: 0,
      },
    })

    // Jalankan di background — tidak di-await
    runGenerateTO(job.id, session.user.id, replaceExistingPending).catch(async (err) => {
      console.error(`Generate TO job ${job.id} failed:`, err)
      await prisma.importJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          errorDetail: err instanceof Error ? err.message : "Error tak terduga",
        },
      })
    })

    return NextResponse.json(
      { jobId: job.id, total: totalPelanggan, message: "Generate TO dimulai di latar belakang" },
      { status: 202 }
    )
  } catch (error) {
    console.error("POST /api/target-operasi error:", error)
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 })
  }
}

// DELETE /api/target-operasi — tidak berubah
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Hanya Admin" }, { status: 403 })
    }

    const body = await request.json()
    const { ids, deleteAll } = body

    if (deleteAll) {
      const deleted = await prisma.targetOperasi.deleteMany({})
      await prisma.logAktivitas.create({
        data: {
          userId: session.user.id,
          aksi: "DELETE_ALL_TO",
          detail: `Hapus SEMUA Target Operasi: ${deleted.count} data`,
        },
      })
      return NextResponse.json({ message: "Semua Target Operasi dihapus", deleted: deleted.count })
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Pilih minimal 1 TO untuk dihapus" }, { status: 400 })
    }

    const deleted = await prisma.targetOperasi.deleteMany({ where: { id: { in: ids } } })
    await prisma.logAktivitas.create({
      data: {
        userId: session.user.id,
        aksi: "BULK_DELETE_TO",
        detail: `Hapus ${deleted.count} Target Operasi`,
      },
    })

    return NextResponse.json({ message: `${deleted.count} Target Operasi dihapus`, deleted: deleted.count })
  } catch (error) {
    console.error("DELETE /api/target-operasi error:", error)
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 })
  }
}

// ============================================================
// BACKGROUND PROCESSOR
// ============================================================

const BATCH_SIZE = 200

async function runGenerateTO(
  jobId: string,
  userId: string,
  replaceExistingPending: boolean
) {
  let processed = 0
  let detected = 0
  let created = 0
  let skipped = 0

  // Ambil semua pelanggan yang punya data pemakaian
  const pelangganList = await prisma.pelanggan.findMany({
    where: { pemakaian: { some: {} } },
    include: {
      pemakaian: {
        orderBy: [{ tahun: "asc" }, { bulan: "asc" }],
      },
    },
  })

  for (let i = 0; i < pelangganList.length; i += BATCH_SIZE) {
    const batch = pelangganList.slice(i, i + BATCH_SIZE)

    for (const pelanggan of batch) {
      const samples = pelanggan.pemakaian.map((p) => ({
        bulan: p.bulan,
        tahun: p.tahun,
        kwh: p.kwh,
      }))

      const hit = detectAnomaly(samples)
      processed++

      if (!hit) {
        skipped++
        continue
      }

      detected++
      const periode = getPeriode(samples)

      const existing = await prisma.targetOperasi.findFirst({
        where: { pelangganId: pelanggan.id, periode },
      })

      if (existing) {
        if (replaceExistingPending && existing.status === "PENDING") {
          await prisma.targetOperasi.update({
            where: { id: existing.id },
            data: {
              tipeAnomali: hit.tipeAnomali,
              alasan: hit.alasan,
              skor: hit.skor,
            },
          })
          created++
        } else {
          skipped++
        }
        continue
      }

      await prisma.targetOperasi.create({
        data: {
          pelangganId: pelanggan.id,
          tipeAnomali: hit.tipeAnomali,
          alasan: hit.alasan,
          skor: hit.skor,
          periode,
          status: "PENDING",
          createdById: userId,
        },
      })
      created++
    }

    // Update progress tiap batch
    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        processed,
        // Pakai field "created" untuk TO dibuat, "updated" untuk anomali terdeteksi
        created,
        updated: detected,
        errors: skipped,
      },
    })
  }

  // Selesai
  await prisma.importJob.update({
    where: { id: jobId },
    data: { status: "DONE", processed, created, updated: detected, errors: skipped },
  })

  await prisma.logAktivitas.create({
    data: {
      userId,
      aksi: "GENERATE_TO",
      detail: `Background Generate TO: ${pelangganList.length} dianalisis, ${detected} anomali, ${created} TO dibuat/diperbarui.`,
    },
  })
}
