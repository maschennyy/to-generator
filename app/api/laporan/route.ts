import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import type { StatusTO, TipeAnomali } from "@/lib/generated/prisma/enums"

/**
 * GET /api/laporan
 *
 * Aggregates everything the report page needs in one call:
 *   - Date range (from..to)
 *   - KPI cards: total TO, completed, in-progress, pending, success rate
 *   - Breakdown: by status, by tipe anomali
 *   - Time series: TO created per day in the range
 *   - Table data: target operasi list filtered by range
 *   - Global stats: total pelanggan, pemakaian, TO historis
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const fromStr = searchParams.get("from")
    const toStr = searchParams.get("to")

    const now = new Date()
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1)
    const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    const from = fromStr ? new Date(fromStr) : defaultFrom
    const to = toStr ? new Date(`${toStr}T23:59:59.999Z`) : defaultTo

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json(
        { error: "Tanggal tidak valid" },
        { status: 400 }
      )
    }

    const range = { gte: from, lte: to }

    // ============================================================
    // Run aggregations in parallel
    // ============================================================
    const [
      totalPelanggan,
      totalPemakaian,
      totalToHistoris,
      toInRange,
      toAllTime,
      byStatus,
      byTipe,
    ] = await Promise.all([
      prisma.pelanggan.count(),
      prisma.pemakaian.count(),
      prisma.tOHistoris.count(),
      prisma.targetOperasi.findMany({
        where: { createdAt: range },
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
        },
      }),
      prisma.targetOperasi.count(),
      prisma.targetOperasi.groupBy({
        by: ["status"],
        where: { createdAt: range },
        _count: { _all: true },
      }),
      prisma.targetOperasi.groupBy({
        by: ["tipeAnomali"],
        where: { createdAt: range },
        _count: { _all: true },
      }),
    ])

    // Status counts (zero-filled)
    const statusCounts: Record<StatusTO, number> = {
      PENDING: 0,
      DIPROSES: 0,
      SELESAI: 0,
      DIBATALKAN: 0,
    }
    for (const row of byStatus) statusCounts[row.status] = row._count._all

    // Tipe counts (zero-filled)
    const tipeCounts: Record<TipeAnomali, number> = {
      TURUN_DRASTIS: 0,
      STAGNAN: 0,
      NOL_PEMAKAIAN: 0,
      LONJAKAN: 0,
      POLA_TIDAK_WAJAR: 0,
    }
    for (const row of byTipe) tipeCounts[row.tipeAnomali] = row._count._all

    const totalInRange = toInRange.length
    const successRate =
      totalInRange === 0
        ? 0
        : Math.round((statusCounts.SELESAI / totalInRange) * 100)

    // ============================================================
    // Time series (per day) — group TO creation by date within range
    // ============================================================
    const series = buildTimeSeries(toInRange, from, to)

    return NextResponse.json({
      range: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      kpi: {
        totalInRange,
        pending: statusCounts.PENDING,
        diproses: statusCounts.DIPROSES,
        selesai: statusCounts.SELESAI,
        dibatalkan: statusCounts.DIBATALKAN,
        successRate,
        totalAllTime: toAllTime,
        totalPelanggan,
        totalPemakaian,
        totalToHistoris,
      },
      breakdown: {
        status: statusCounts,
        tipe: tipeCounts,
      },
      series,
      table: toInRange.map((t) => ({
        id: t.id,
        tipeAnomali: t.tipeAnomali,
        alasan: t.alasan,
        skor: t.skor,
        status: t.status,
        periode: t.periode,
        catatan: t.catatan,
        createdAt: t.createdAt.toISOString(),
        pelanggan: t.pelanggan,
      })),
    })
  } catch (error) {
    console.error("GET /api/laporan error:", error)
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    )
  }
}

function buildTimeSeries(
  rows: Array<{ createdAt: Date; status: StatusTO }>,
  from: Date,
  to: Date
): Array<{ date: string; total: number; selesai: number }> {
  // Bucket by YYYY-MM-DD
  const buckets = new Map<string, { total: number; selesai: number }>()

  // Pre-fill the range with zeros so the chart doesn't have gaps.
  const cursor = new Date(from)
  cursor.setHours(0, 0, 0, 0)
  const endDay = new Date(to)
  endDay.setHours(0, 0, 0, 0)
  while (cursor <= endDay) {
    const key = cursor.toISOString().slice(0, 10)
    buckets.set(key, { total: 0, selesai: 0 })
    cursor.setDate(cursor.getDate() + 1)
  }

  for (const r of rows) {
    const key = r.createdAt.toISOString().slice(0, 10)
    const bucket = buckets.get(key) ?? { total: 0, selesai: 0 }
    bucket.total += 1
    if (r.status === "SELESAI") bucket.selesai += 1
    buckets.set(key, bucket)
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, v]) => ({ date, total: v.total, selesai: v.selesai }))
}
