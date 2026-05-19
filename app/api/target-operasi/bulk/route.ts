import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const VALID_STATUS = ["PENDING", "DIPROSES", "SELESAI", "DIBATALKAN"]

// PATCH /api/target-operasi/bulk — update status banyak TO sekaligus
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role === "USER") {
      return NextResponse.json({ error: "Forbidden: Hanya Admin atau SPV" }, { status: 403 })
    }

    const body = await request.json()
    const { ids, status, catatan } = body as {
      ids: string[]
      status: string
      catatan?: string | null
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Pilih minimal 1 TO" }, { status: 400 })
    }

    if (!status || !VALID_STATUS.includes(status)) {
      return NextResponse.json({ error: "Status tidak valid" }, { status: 400 })
    }

    const updateData: Record<string, unknown> = { status }
    if (catatan !== undefined) updateData.catatan = catatan ?? null

    const result = await prisma.targetOperasi.updateMany({
      where: { id: { in: ids } },
      data: updateData,
    })

    await prisma.logAktivitas.create({
      data: {
        userId: session.user.id,
        aksi: "BULK_UPDATE_TO",
        detail: `Update massal ${result.count} TO → status ${status}${catatan ? ` (catatan: ${catatan.slice(0, 50)})` : ""}`,
      },
    })

    return NextResponse.json({
      updated: result.count,
      message: `${result.count} Target Operasi berhasil diperbarui`,
    })
  } catch (error) {
    console.error("PATCH /api/target-operasi/bulk error:", error)
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 })
  }
}