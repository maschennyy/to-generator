import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// GET /api/pelanggan-list - Ambil semua pelanggan (untuk dropdown)
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const pelanggan = await prisma.pelanggan.findMany({
      select: {
        id: true,
        idPelanggan: true,
        nama: true,
        tarif: true,
        daya: true,
      },
      orderBy: { nama: "asc" },
    })

    return NextResponse.json({ data: pelanggan })
  } catch (error) {
    console.error("GET /api/pelanggan-list error:", error)
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    )
  }
}