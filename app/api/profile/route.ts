import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

// GET /api/profile — ambil data profil user yang sedang login
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        username: true,
        nama: true,
        nip: true,
        jabatan: true,
        email: true,
        role: true,
        createdAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error("GET /api/profile error:", error)
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 })
  }
}

// PATCH /api/profile — update data diri atau ganti password
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { nama, nip, jabatan, email, currentPassword, newPassword } = body

    // Validasi nama wajib ada
    if (nama !== undefined && !nama.trim()) {
      return NextResponse.json({ error: "Nama tidak boleh kosong" }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}

    // Update data diri
    if (nama !== undefined) updateData.nama = nama.trim()
    if (nip !== undefined) updateData.nip = nip.trim() || null
    if (jabatan !== undefined) updateData.jabatan = jabatan.trim() || null
    if (email !== undefined) updateData.email = email.trim() || null

    // Ganti password (opsional — hanya jika newPassword diisi)
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Password lama wajib diisi untuk mengganti password" },
          { status: 400 }
        )
      }

      if (newPassword.length < 6) {
        return NextResponse.json(
          { error: "Password baru minimal 6 karakter" },
          { status: 400 }
        )
      }

      // Verifikasi password lama
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { password: true },
      })

      if (!user) {
        return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 })
      }

      const isValid = await bcrypt.compare(currentPassword, user.password)
      if (!isValid) {
        return NextResponse.json(
          { error: "Password lama tidak sesuai" },
          { status: 400 }
        )
      }

      updateData.password = await bcrypt.hash(newPassword, 10)
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Tidak ada data yang diubah" }, { status: 400 })
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        username: true,
        nama: true,
        nip: true,
        jabatan: true,
        email: true,
        role: true,
      },
    })

    await prisma.logAktivitas.create({
      data: {
        userId: session.user.id,
        aksi: newPassword ? "GANTI_PASSWORD" : "UPDATE_PROFIL",
        detail: newPassword
          ? "Mengganti password sendiri"
          : `Update profil: ${Object.keys(updateData).filter(k => k !== "password").join(", ")}`,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("PATCH /api/profile error:", error)
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 })
  }
}