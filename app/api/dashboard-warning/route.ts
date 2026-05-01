import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Hitung pelanggan dengan data tidak lengkap
    const pelangganTidakLengkap = await prisma.pelanggan.count({
      where: { dataLengkap: false },
    })

    // Ambil sample pelanggan yang tidak lengkap
    const samplePelanggan = await prisma.pelanggan.findMany({
      where: { dataLengkap: false },
      select: {
        id: true,
        idPelanggan: true,
        nama: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    })

    // Hitung total
    const [totalPelanggan, totalTO, totalPemakaian] = await Promise.all([
      prisma.pelanggan.count(),
      prisma.tOHistoris.count(),
      prisma.pemakaian.count(),
    ])

    return NextResponse.json({
      stats: {
        totalPelanggan,
        totalDIL: 0,
        totalTO,
        totalPemakaian,
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