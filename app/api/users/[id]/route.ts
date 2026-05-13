import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

// PATCH /api/users/[id] — edit user atau reset password
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id } = params
    const body = await request.json()
    const { nama, role, aktif, newPassword } = body

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 })

    // Cegah admin menonaktifkan dirinya sendiri
    if (id === session.user.id && aktif === false) {
      return NextResponse.json({ error: "Tidak bisa menonaktifkan akun sendiri" }, { status: 400 })
    }

    // Cegah admin mengubah role dirinya sendiri
    if (id === session.user.id && role && role !== existing.role) {
      return NextResponse.json({ error: "Tidak bisa mengubah role akun sendiri" }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (nama !== undefined) updateData.nama = nama
    if (role !== undefined) updateData.role = role
    if (aktif !== undefined) updateData.aktif = aktif
    if (newPassword) {
      if (newPassword.length < 6) {
        return NextResponse.json({ error: "Password minimal 6 karakter" }, { status: 400 })
      }
      updateData.password = await bcrypt.hash(newPassword, 10)
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, username: true, nama: true, role: true, aktif: true, createdAt: true },
    })

    await prisma.logAktivitas.create({
      data: {
        userId: session.user.id,
        aksi: "UPDATE_USER",
        detail: newPassword
          ? `Reset password user: ${existing.username}`
          : `Update user: ${existing.username} — ${Object.keys(updateData).join(", ")}`,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("PATCH /api/users/[id] error:", error)
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 })
  }
}

// DELETE /api/users/[id] — hapus user
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id } = params

    if (id === session.user.id) {
      return NextResponse.json({ error: "Tidak bisa menghapus akun sendiri" }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 })

    await prisma.user.delete({ where: { id } })

    await prisma.logAktivitas.create({
      data: {
        userId: session.user.id,
        aksi: "DELETE_USER",
        detail: `Hapus user: ${existing.nama} (${existing.username})`,
      },
    })

    return NextResponse.json({ message: "User berhasil dihapus" })
  } catch (error) {
    console.error("DELETE /api/users/[id] error:", error)
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 })
  }
}
