import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// GET /api/target-operasi
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status") || ""
    const tipe = searchParams.get("tipe") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const skip = (page - 1) * limit

    const whereClause: Record<string, unknown> = {}

    if (search) {
      whereClause.OR = [
        { pelanggan: { idPelanggan: { contains: search, mode: "insensitive" } } },
        { pelanggan: { nama: { contains: search, mode: "insensitive" } } },
      ]
    }

    if (status) whereClause.status = status
    if (tipe) whereClause.tipeAnomali = tipe

    const [targetOperasi, total] = await Promise.all([
      prisma.targetOperasi.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: [{ skor: "desc" }, { createdAt: "desc" }],
        include: {
          pelanggan: {
            include: {
              pemakaian: {
                orderBy: [{ tahun: "asc" }, { bulan: "asc" }],
              },
            },
          },
          createdBy: {
            select: { nama: true, username: true },
          },
        },
      }),
      prisma.targetOperasi.count({ where: whereClause }),
    ])

    const data = targetOperasi.map((to) => ({
      id: to.id,
      pelangganId: to.pelangganId,
      idPelanggan: to.pelanggan.idPelanggan,
      nama: to.pelanggan.nama,
      tarif: to.pelanggan.tarif,
      daya: to.pelanggan.daya,
      lokasi: to.pelanggan.lokasi,
      tipeAnomali: to.tipeAnomali,
      alasan: to.alasan,
      skor: to.skor,
      status: to.status,
      periode: to.periode,
      catatan: to.catatan,
      createdAt: to.createdAt,
      createdBy: to.createdBy.nama,
      pemakaian: to.pelanggan.pemakaian.map((p) => ({
        bulan: p.bulan,
        tahun: p.tahun,
        kwh: p.kwh,
      })),
    }))

    // Statistik per status
    const stats = await prisma.targetOperasi.groupBy({
      by: ["status"],
      _count: { id: true },
    })

    const statusCount = { PENDING: 0, DIPROSES: 0, SELESAI: 0, DIBATALKAN: 0 }
    stats.forEach((s) => {
      statusCount[s.status as keyof typeof statusCount] = s._count.id
    })

    return NextResponse.json({
      data,
      stats: statusCount,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("GET /api/target-operasi error:", error)
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 })
  }
}

// PATCH /api/target-operasi - Update status (ADMIN & SPV)
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["ADMIN", "SPV"].includes(session.user.role ?? "")) {
      return NextResponse.json(
        { error: "Forbidden: Hanya Admin dan SPV" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { id, status, catatan } = body

    if (!id || !status) {
      return NextResponse.json({ error: "ID dan status wajib diisi" }, { status: 400 })
    }

    const validStatus = ["PENDING", "DIPROSES", "SELESAI", "DIBATALKAN"]
    if (!validStatus.includes(status)) {
      return NextResponse.json({ error: "Status tidak valid" }, { status: 400 })
    }

    const existing = await prisma.targetOperasi.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Target Operasi tidak ditemukan" }, { status: 404 })
    }

    const updated = await prisma.targetOperasi.update({
      where: { id },
      data: {
        status,
        catatan: catatan !== undefined ? catatan : existing.catatan,
      },
      include: {
        pelanggan: { select: { nama: true, idPelanggan: true } },
      },
    })

    await prisma.logAktivitas.create({
      data: {
        userId: session.user.id,
        aksi: "UPDATE_STATUS_TO",
        detail: `Update status TO ${updated.pelanggan.nama} (${updated.pelanggan.idPelanggan}): ${existing.status} → ${status}`,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("PATCH /api/target-operasi error:", error)
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 })
  }
}

// DELETE /api/target-operasi - Hapus TO (ADMIN only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Hanya Admin" }, { status: 403 })
    }

    const body = await request.json()
    const { ids } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "IDs wajib diisi" }, { status: 400 })
    }

    const deleted = await prisma.targetOperasi.deleteMany({
      where: { id: { in: ids } },
    })

    await prisma.logAktivitas.create({
      data: {
        userId: session.user.id,
        aksi: "DELETE_TARGET_OPERASI",
        detail: `Hapus ${deleted.count} Target Operasi`,
      },
    })

    return NextResponse.json({ deleted: deleted.count })
  } catch (error) {
    console.error("DELETE /api/target-operasi error:", error)
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 })
  }
}
