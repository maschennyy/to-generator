import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// GET /api/notifikasi — ambil log aktivitas terbaru untuk dropdown notifikasi
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const isAdmin = session.user.role === "ADMIN"

    // Admin lihat semua aktivitas, user biasa hanya milik sendiri
    const logs = await prisma.logAktivitas.findMany({
      where: isAdmin ? {} : { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: {
        user: { select: { nama: true, username: true, role: true } },
      },
    })

    // Hitung unread: log dalam 24 jam terakhir
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const unreadCount = await prisma.logAktivitas.count({
      where: {
        ...(isAdmin ? {} : { userId: session.user.id }),
        createdAt: { gte: since },
      },
    })

    return NextResponse.json({
      logs: logs.map((l) => ({
        id: l.id,
        aksi: l.aksi,
        detail: l.detail,
        createdAt: l.createdAt.toISOString(),
        user: l.user,
      })),
      unreadCount,
    })
  } catch (error) {
    console.error("GET /api/notifikasi error:", error)
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 })
  }
}
