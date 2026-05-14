import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [
      pelangganTidakLengkap,
      samplePelanggan,
      totalPelanggan,
      totalToHistoris,
      totalPemakaian,
      toStatusCounts,
    ] = await Promise.all([
      prisma.pelanggan.count({ where: { dataLengkap: false } }),
      prisma.pelanggan.findMany({
        where: { dataLengkap: false },
        select: { id: true, idPelanggan: true, nama: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.pelanggan.count(),
      prisma.tOHistoris.count(),
      prisma.pemakaian.count(),
      prisma.targetOperasi.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ])

    // Susun counts TO per status
    const toCounts: Record<string, number> = {
      PENDING: 0,
      DIPROSES: 0,
      SELESAI: 0,
      DIBATALKAN: 0,
    }
    for (const row of toStatusCounts) {
      toCounts[row.status] = row._count._all
    }

    const totalTO = Object.values(toCounts).reduce((a, b) => a + b, 0)

    return NextResponse.json({
      stats: {
        totalPelanggan,
        totalDIL: 0,
        totalToHistoris,
        totalPemakaian,
        totalTO,
        toPending: toCounts.PENDING,
        toDiproses: toCounts.DIPROSES,
        toSelesai: toCounts.SELESAI,
      },
      warnings: {
        pelangganTidakLengkap,
        tidakAdaDiDIL: 0,
      },
      samplePelanggan,
    })
  } catch (error) {
    console.error("GET /api/dashboard-warning error:", error)
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    )
  }
}
