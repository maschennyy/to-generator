import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// GET /api/log-aktivitas?page=1&limit=50&search=&aksi=&userId=
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const limit = Math.min(100, parseInt(searchParams.get("limit") || "50"))
    const search = searchParams.get("search") || ""
    const aksiFilter = searchParams.get("aksi") || ""
    const userIdFilter = searchParams.get("userId") || ""
    const skip = (page - 1) * limit

    type WhereClause = {
      userId?: string
      aksi?: string
      OR?: Array<{ aksi?: { contains: string; mode: "insensitive" }; detail?: { contains: string; mode: "insensitive" } }>
    }

    const where: WhereClause = {}
    if (userIdFilter) where.userId = userIdFilter
    if (aksiFilter) where.aksi = aksiFilter
    if (search) {
      where.OR = [
        { aksi: { contains: search, mode: "insensitive" } },
        { detail: { contains: search, mode: "insensitive" } },
      ]
    }

    const [logs, total, allUsers, allAksi] = await Promise.all([
      prisma.logAktivitas.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, nama: true, username: true, role: true } },
        },
      }),
      prisma.logAktivitas.count({ where }),
      // Untuk filter dropdown
      prisma.user.findMany({
        select: { id: true, nama: true, username: true },
        orderBy: { nama: "asc" },
      }),
      prisma.logAktivitas.findMany({
        select: { aksi: true },
        distinct: ["aksi"],
        orderBy: { aksi: "asc" },
      }),
    ])

    return NextResponse.json({
      logs: logs.map((l) => ({
        id: l.id,
        aksi: l.aksi,
        detail: l.detail,
        ipAddress: l.ipAddress,
        createdAt: l.createdAt.toISOString(),
        user: l.user,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      filters: {
        users: allUsers,
        aksiList: allAksi.map((a) => a.aksi),
      },
    })
  } catch (error) {
    console.error("GET /api/log-aktivitas error:", error)
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 })
  }
}
