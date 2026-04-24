import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { pelangganSchema } from "@/lib/validations/pelanggan"

// GET /api/pelanggan/[id] - Ambil detail 1 pelanggan
export async function GET(
  request: NextRequest,
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
        pemakaian: {
          orderBy: [{ tahun: "desc" }, { bulan: "desc" }],
          take: 12,
        },
        _count: {
          select: {
            pemakaian: true,
            targetOperasi: true,
          },
        },
      },
    })

    if (!pelanggan) {
      return NextResponse.json(
        { error: "Pelanggan tidak ditemukan" },
        { status: 404 }
      )
    }

    return NextResponse.json(pelanggan)
  } catch (error) {
    console.error("GET /api/pelanggan/[id] error:", error)
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    )
  }
}

// PATCH /api/pelanggan/[id] - Update pelanggan
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Hanya ADMIN yang bisa edit
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Hanya Admin yang bisa mengedit pelanggan" },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()

    // Validate dengan Zod
    const validation = pelangganSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validasi gagal",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const data = validation.data

    // Cek pelanggan ada
    const existing = await prisma.pelanggan.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: "Pelanggan tidak ditemukan" },
        { status: 404 }
      )
    }

    // Kalau idPelanggan diubah, cek jangan duplikat
    if (data.idPelanggan !== existing.idPelanggan) {
      const duplicate = await prisma.pelanggan.findUnique({
        where: { idPelanggan: data.idPelanggan },
      })
      if (duplicate) {
        return NextResponse.json(
          { error: `ID Pelanggan ${data.idPelanggan} sudah dipakai` },
          { status: 400 }
        )
      }
    }

    // Update
    const pelanggan = await prisma.pelanggan.update({
      where: { id },
      data,
    })

    // Log aktivitas
    await prisma.logAktivitas.create({
      data: {
        userId: session.user.id,
        aksi: "UPDATE_PELANGGAN",
        detail: `Update pelanggan: ${data.nama} (${data.idPelanggan})`,
      },
    })

    return NextResponse.json(pelanggan)
  } catch (error) {
    console.error("PATCH /api/pelanggan/[id] error:", error)
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    )
  }
}

// DELETE /api/pelanggan/[id] - Hapus pelanggan
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Hanya ADMIN yang bisa hapus
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Hanya Admin yang bisa menghapus pelanggan" },
        { status: 403 }
      )
    }

    const { id } = await params

    // Cek pelanggan ada
    const existing = await prisma.pelanggan.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            pemakaian: true,
            targetOperasi: true,
          },
        },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Pelanggan tidak ditemukan" },
        { status: 404 }
      )
    }

    // Delete pelanggan (cascade akan otomatis hapus pemakaian & TO)
    await prisma.pelanggan.delete({ where: { id } })

    // Log aktivitas
    await prisma.logAktivitas.create({
      data: {
        userId: session.user.id,
        aksi: "DELETE_PELANGGAN",
        detail: `Hapus pelanggan: ${existing.nama} (${existing.idPelanggan})`,
      },
    })

    return NextResponse.json({
      message: "Pelanggan berhasil dihapus",
      deletedItems: {
        pemakaian: existing._count.pemakaian,
        targetOperasi: existing._count.targetOperasi,
      },
    })
  } catch (error) {
    console.error("DELETE /api/pelanggan/[id] error:", error)
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    )
  }
}