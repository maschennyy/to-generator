import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

// GET /api/users — daftar semua user (ADMIN only)
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const users = await prisma.user.findMany({
      select: { id: true, username: true, nama: true, role: true, aktif: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error("GET /api/users error:", error)
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 })
  }
}

// POST /api/users — tambah user baru (ADMIN only)
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json()
    const { username, nama, password, role } = body

    if (!username || !nama || !password || !role) {
      return NextResponse.json({ error: "Semua field wajib diisi" }, { status: 400 })
    }

    if (!["ADMIN", "SPV", "USER"].includes(role)) {
      return NextResponse.json({ error: "Role tidak valid" }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password minimal 6 karakter" }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { username } })
    if (existing) {
      return NextResponse.json({ error: "Username sudah digunakan" }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: { username, nama, password: hashedPassword, role, aktif: true },
      select: { id: true, username: true, nama: true, role: true, aktif: true, createdAt: true },
    })

    await prisma.logAktivitas.create({
      data: {
        userId: session.user.id,
        aksi: "CREATE_USER",
        detail: `Tambah user: ${nama} (${username}) role ${role}`,
      },
    })

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    console.error("POST /api/users error:", error)
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 })
  }
}