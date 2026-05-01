import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// DELETE /api/pemakaian/[id] - Hapus 1 record pemakaian
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Hanya Admin yang bisa hapus data" },
        { status: 403 }
      )
    }

    const { id } = await params

    const existing = await prisma.pemakaian.findUnique({
      where: { id },
      include: { pelanggan: true },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Data pemakaian tidak ditemukan" },
        { status: 404 }
      )
    }

    await prisma.pemakaian.delete({ where: { id } })

    await prisma.logAktivitas.create({
      data: {
        userId: session.user.id,
        aksi: "DELETE_PEMAKAIAN",
        detail: `Hapus pemakaian ${existing.pelanggan.nama} periode ${existing.bulan}/${existing.tahun}`,
      },
    })

    return NextResponse.json({ message: "Data pemakaian berhasil dihapus" })
  } catch (error) {
    console.error("DELETE /api/pemakaian/[id] error:", error)
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    )
  }
}