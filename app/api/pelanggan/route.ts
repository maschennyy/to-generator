import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { pelangganSchema } from "@/lib/validations/pelanggan"

// GET /api/pelanggan - Ambil list semua pelanggan
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const skip = (page - 1) * limit

    // Build where clause untuk search
    const where = search
      ? {
          OR: [
            { idPelanggan: { contains: search, mode: "insensitive" as const } },
            { nama: { contains: search, mode: "insensitive" as const } },
            { lokasi: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}

    // Fetch data & total count secara paralel
    const [pelanggan, total] = await Promise.all([
      prisma.pelanggan.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.pelanggan.count({ where }),
    ])

    return NextResponse.json({
      data: pelanggan,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("GET /api/pelanggan error:", error)
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    )
  }
}

// POST /api/pelanggan - Tambah pelanggan baru
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Hanya ADMIN yang bisa tambah pelanggan
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Hanya Admin yang bisa menambah pelanggan" },
        { status: 403 }
      )
    }

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

    // Cek apakah idPelanggan sudah ada
    const existing = await prisma.pelanggan.findUnique({
      where: { idPelanggan: data.idPelanggan },
    })

    if (existing) {
      return NextResponse.json(
        { error: `ID Pelanggan ${data.idPelanggan} sudah terdaftar` },
        { status: 400 }
      )
    }

    // Create pelanggan
    const pelanggan = await prisma.pelanggan.create({
      data,
    })

    // Log aktivitas
    await prisma.logAktivitas.create({
      data: {
        userId: session.user.id,
        aksi: "CREATE_PELANGGAN",
        detail: `Menambah pelanggan: ${data.nama} (${data.idPelanggan})`,
      },
    })

    return NextResponse.json(pelanggan, { status: 201 })
  } catch (error) {
    console.error("POST /api/pelanggan error:", error)
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    )
  }
}