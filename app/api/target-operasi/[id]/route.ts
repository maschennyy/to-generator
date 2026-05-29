import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import type { StatusTO } from "@prisma/client"

const VALID_STATUS: StatusTO[] = [
  "PENDING",
  "DIPROSES",
  "SELESAI",
  "DIBATALKAN",
]

// PATCH /api/target-operasi/[id]
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role === "USER") {
      return NextResponse.json(
        { error: "Forbidden: Hanya Admin atau SPV" },
        { status: 403 }
      )
    }

    const { id } = await context.params
    const body = await request.json()
    const { status, catatan } = body as {
      status?: StatusTO
      catatan?: string | null
    }

    const update: { status?: StatusTO; catatan?: string | null } = {}
    if (status !== undefined) {
      if (!VALID_STATUS.includes(status)) {
        return NextResponse.json(
          { error: "Status tidak valid" },
          { status: 400 }
        )
      }
      update.status = status
    }
    if (catatan !== undefined) update.catatan = catatan

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Tidak ada perubahan" }, { status: 400 })
    }

    const existing = await prisma.targetOperasi.findUnique({
      where: { id },
      include: { pelanggan: { select: { idPelanggan: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: "TO tidak ditemukan" }, { status: 404 })
    }

    const updated = await prisma.targetOperasi.update({
      where: { id },
      data: update,
    })

    await prisma.logAktivitas.create({
      data: {
        userId: session.user.id,
        aksi: "UPDATE_TO",
        detail: `Update TO ${existing.pelanggan.idPelanggan}: ${
          update.status ? `status -> ${update.status}` : ""
        }${update.catatan !== undefined ? " (catatan diperbarui)" : ""}`.trim(),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("PATCH /api/target-operasi/[id] error:", error)
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    )
  }
}

// DELETE /api/target-operasi/[id]
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Hanya Admin" },
        { status: 403 }
      )
    }

    const { id } = await context.params
    await prisma.targetOperasi.delete({ where: { id } })

    await prisma.logAktivitas.create({
      data: {
        userId: session.user.id,
        aksi: "DELETE_TO",
        detail: `Hapus TO ${id}`,
      },
    })

    return NextResponse.json({ message: "TO dihapus" })
  } catch (error) {
    console.error("DELETE /api/target-operasi/[id] error:", error)
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    )
  }
}
