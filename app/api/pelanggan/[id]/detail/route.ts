import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// GET /api/pelanggan/[id]/detail
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id },
      include: {
        pemakaian: { orderBy: [{ tahun: "asc" }, { bulan: "asc" }] },
        targetOperasi: {
          orderBy: { createdAt: "desc" },
          include: { createdBy: { select: { nama: true, username: true } } },
        },
      },
    })

    if (!pelanggan) {
      return NextResponse.json({ error: "Pelanggan tidak ditemukan" }, { status: 404 })
    }

    const kwhs = pelanggan.pemakaian.map((p) => p.kwh)
    const totalKwh = kwhs.reduce((a, b) => a + b, 0)
    const avgKwh = kwhs.length > 0 ? totalKwh / kwhs.length : 0
    const maxKwh = kwhs.length > 0 ? Math.max(...kwhs) : 0
    const minKwh = kwhs.length > 0 ? Math.min(...kwhs) : 0

    let tren: "naik" | "turun" | "stabil" = "stabil"
    if (kwhs.length >= 6) {
      const recent3 = kwhs.slice(-3).reduce((a, b) => a + b, 0) / 3
      const prev3 = kwhs.slice(-6, -3).reduce((a, b) => a + b, 0) / 3
      if (prev3 > 0) {
        const diff = (recent3 - prev3) / prev3
        if (diff > 0.1) tren = "naik"
        else if (diff < -0.1) tren = "turun"
      }
    }

    return NextResponse.json({
      pelanggan: {
        id: pelanggan.id,
        idPelanggan: pelanggan.idPelanggan,
        nama: pelanggan.nama,
        tarif: pelanggan.tarif,
        daya: pelanggan.daya,
        lokasi: pelanggan.lokasi,
        isToHistory: pelanggan.isToHistory,
        dataLengkap: pelanggan.dataLengkap,
        createdAt: pelanggan.createdAt.toISOString(),
        updatedAt: pelanggan.updatedAt.toISOString(),
      },
      pemakaian: pelanggan.pemakaian.map((p) => ({
        id: p.id,
        bulan: p.bulan,
        tahun: p.tahun,
        kwh: p.kwh,
        keterangan: p.keterangan,
        label: `${String(p.bulan).padStart(2, "0")}/${p.tahun}`,
      })),
      targetOperasi: pelanggan.targetOperasi.map((t) => ({
        id: t.id,
        tipeAnomali: t.tipeAnomali,
        alasan: t.alasan,
        skor: t.skor,
        status: t.status,
        periode: t.periode,
        catatan: t.catatan,
        createdAt: t.createdAt.toISOString(),
        createdBy: t.createdBy,
      })),
      stats: {
        totalBulanData: kwhs.length,
        totalKwh,
        avgKwh,
        maxKwh,
        minKwh,
        tren,
        totalTO: pelanggan.targetOperasi.length,
        toAktif: pelanggan.targetOperasi.filter((t) =>
          ["PENDING", "DIPROSES"].includes(t.status)
        ).length,
      },
    })
  } catch (error) {
    console.error("GET /api/pelanggan/[id]/detail error:", error)
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 })
  }
}
