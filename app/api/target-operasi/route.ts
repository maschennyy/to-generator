import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { detectAnomaly, getPeriode, type AnomalyHit } from "@/lib/anomali/detector"

type HasilOperasiRow = {
  targetOperasiId: string
  hasil: "BELUM_DIPERIKSA" | "NORMAL" | "PELANGGARAN" | "TIDAK_DITEMUKAN"
  tanggalOperasi: Date | null
  kategoriTemuan: string | null
  catatan: string | null
}
type TableCheckRow = { exists: boolean }
type NalarFeatureRow = {
  pelanggan_id: string
  rata_kwh_3bln: number | null
  rata_kwh_6bln: number | null
  rata_kwh_12bln: number | null
  tren_kwh: number | null
  volatilitas_kwh: number | null
  penurunan_tiba2: number
  bulan_data: number
  is_violation: number
}

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
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100)
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

    const targetIds = rows.map((row) => row.id)
    const hasilTableRows = await prisma.$queryRaw<TableCheckRow[]>`
      SELECT to_regclass('public.hasil_operasi') IS NOT NULL AS "exists"
    `
    const hasHasilTable = hasilTableRows[0]?.exists ?? false
    const hasilRows = hasHasilTable && targetIds.length > 0
      ? await prisma.$queryRaw<HasilOperasiRow[]>`
          SELECT
            "targetOperasiId",
            "hasil",
            "tanggalOperasi",
            "kategoriTemuan",
            "catatan"
          FROM "hasil_operasi"
          WHERE "targetOperasiId" = ANY(${targetIds})
        `
      : []
    const hasilByTargetId = new Map(
      hasilRows.map((row) => [row.targetOperasiId, {
        hasil: row.hasil,
        tanggalOperasi: row.tanggalOperasi,
        kategoriTemuan: row.kategoriTemuan,
        catatan: row.catatan,
      }])
    )
    const data = rows.map((row) => ({
      ...row,
      hasilOperasi: hasilByTargetId.get(row.id) ?? null,
    }))

    return NextResponse.json({
      data,
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
const NALAR_REASON_PREFIX = "Sinyal NALAR"

async function runGenerateTO(
  jobId: string,
  userId: string,
  replaceExistingPending: boolean
) {
  let processed = 0
  let detected = 0
  let created = 0
  let skipped = 0
  let nalarPrioritized = 0

  // Ambil semua pelanggan yang punya data pemakaian
  const pelangganList = await prisma.pelanggan.findMany({
    where: { pemakaian: { some: {} } },
    include: {
      pemakaian: {
        orderBy: [{ tahun: "asc" }, { bulan: "asc" }],
      },
    },
  })
  const hasNalarFeatures = await hasNalarFeatureTable()

  for (let i = 0; i < pelangganList.length; i += BATCH_SIZE) {
    const batch = pelangganList.slice(i, i + BATCH_SIZE)
    const nalarFeatureByPelangganId = hasNalarFeatures
      ? await loadNalarFeatureMap(batch.map((pelanggan) => pelanggan.id))
      : new Map<string, NalarFeatureRow>()

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
      const prioritizedHit = applyNalarPriority(hit, nalarFeatureByPelangganId.get(pelanggan.id))
      if (prioritizedHit.skor > hit.skor) {
        nalarPrioritized++
      }

      const existing = await prisma.targetOperasi.findFirst({
        where: { pelangganId: pelanggan.id, periode },
      })

      if (existing) {
        if (replaceExistingPending && existing.status === "PENDING") {
          await prisma.targetOperasi.update({
            where: { id: existing.id },
            data: {
              tipeAnomali: prioritizedHit.tipeAnomali,
              alasan: prioritizedHit.alasan,
              skor: prioritizedHit.skor,
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
          tipeAnomali: prioritizedHit.tipeAnomali,
          alasan: prioritizedHit.alasan,
          skor: prioritizedHit.skor,
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
      detail: `Background Generate TO: ${pelangganList.length} dianalisis, ${detected} anomali, ${created} TO dibuat/diperbarui, ${nalarPrioritized} diprioritaskan sinyal NALAR.`,
    },
  })
}

async function hasNalarFeatureTable() {
  const [featuresTable] = await prisma.$queryRaw<TableCheckRow[]>`
    SELECT to_regclass('public.ml_customer_features') IS NOT NULL AS "exists"
  `
  return featuresTable?.exists ?? false
}

async function loadNalarFeatureMap(pelangganIds: string[]) {
  if (pelangganIds.length === 0) return new Map<string, NalarFeatureRow>()

  const rows = await prisma.$queryRaw<NalarFeatureRow[]>`
    SELECT
      "pelanggan_id",
      "rata_kwh_3bln",
      "rata_kwh_6bln",
      "rata_kwh_12bln",
      "tren_kwh",
      "volatilitas_kwh",
      "penurunan_tiba2",
      "bulan_data",
      "is_violation"
    FROM "ml_customer_features"
    WHERE "pelanggan_id" = ANY(${pelangganIds})
  `

  return new Map(rows.map((row) => [row.pelanggan_id, row]))
}

function applyNalarPriority(hit: AnomalyHit, feature?: NalarFeatureRow): AnomalyHit {
  if (!feature || feature.bulan_data <= 0) return hit

  const reasons: string[] = []
  let boost = 0

  if (feature.is_violation === 1) {
    boost += 0.08
    reasons.push("pelanggan punya label historis/operasional pelanggaran")
  }

  if (feature.penurunan_tiba2 === 1) {
    boost += 0.07
    reasons.push("ada penurunan kWh tiba-tiba lebih dari 30%")
  }

  const recentAvg = numberOrNull(feature.rata_kwh_3bln)
  const trend = numberOrNull(feature.tren_kwh)
  if (recentAvg !== null && trend !== null && trend < 0) {
    const previousAvg = recentAvg - trend
    if (previousAvg > 0) {
      const dropRatio = Math.abs(trend) / previousAvg
      if (dropRatio >= 0.3) {
        boost += Math.min(0.12, dropRatio * 0.16)
        reasons.push(`rata-rata 3 bulan terbaru turun ${Math.round(dropRatio * 100)}%`)
      }
    }
  }

  const volatility = numberOrNull(feature.volatilitas_kwh)
  const yearlyAvg = numberOrNull(feature.rata_kwh_12bln)
  if (volatility !== null && yearlyAvg !== null && yearlyAvg > 0) {
    const volatilityRatio = volatility / yearlyAvg
    if (volatilityRatio >= 0.5) {
      boost += Math.min(0.08, volatilityRatio * 0.06)
      reasons.push("pemakaian 12 bulan sangat tidak stabil")
    }
  }

  if (boost <= 0 || reasons.length === 0) return hit

  return {
    ...hit,
    skor: Math.min(1, Number((hit.skor + boost).toFixed(4))),
    alasan: `${hit.alasan} ${NALAR_REASON_PREFIX}: ${reasons.join("; ")}.`,
  }
}

function numberOrNull(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}
