import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { cleanIdPelanggan } from "@/lib/validations/master-dil"
import { parsePaginationParams } from "@/lib/api/request-helpers"

// GET /api/to-historis
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const { page, limit, skip } = parsePaginationParams(searchParams)

    const where: {
      OR?: Array<{ [key: string]: { contains: string; mode: "insensitive" } }>
    } = {}

    if (search) {
      where.OR = [
        { idPelanggan: { contains: search, mode: "insensitive" } },
        { kategori: { contains: search, mode: "insensitive" } },
      ]
    }

    const [data, total] = await Promise.all([
      prisma.tOHistoris.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.tOHistoris.count({ where }),
    ])

    return NextResponse.json({
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("GET /api/to-historis error:", error)
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    )
  }
}

// POST /api/to-historis - Bulk import
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { data } = body

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { error: "Data TO Historis tidak valid" },
        { status: 400 }
      )
    }

    const results = {
      created: 0,
      updated: 0,
      pelangganUpdated: 0,
      errors: [] as Array<{ idPelanggan: string; error: string }>,
    }

    for (const item of data) {
      try {
        const cleanId = cleanIdPelanggan(item.idPelanggan)

        if (!cleanId) {
          results.errors.push({
            idPelanggan: String(item.idPelanggan),
            error: "IDPEL kosong",
          })
          continue
        }

        const existing = await prisma.tOHistoris.findUnique({
          where: { idPelanggan: cleanId },
        })

        if (existing) {
          await prisma.tOHistoris.update({
            where: { idPelanggan: cleanId },
            data: {
              tanggalTemuan: item.tanggalTemuan
                ? new Date(item.tanggalTemuan)
                : existing.tanggalTemuan,
              kategori: item.kategori || existing.kategori,
            },
          })
          results.updated++
        } else {
          await prisma.tOHistoris.create({
            data: {
              idPelanggan: cleanId,
              tanggalTemuan: item.tanggalTemuan
                ? new Date(item.tanggalTemuan)
                : null,
              kategori: item.kategori || null,
            },
          })
          results.created++
        }

        // Update flag isToHistory di pelanggan
        const pelanggan = await prisma.pelanggan.findUnique({
          where: { idPelanggan: cleanId },
        })

        if (pelanggan && !pelanggan.isToHistory) {
          await prisma.pelanggan.update({
            where: { idPelanggan: cleanId },
            data: { isToHistory: true },
          })
          results.pelangganUpdated++
        }
      } catch (err) {
        results.errors.push({
          idPelanggan: String(item.idPelanggan),
          error: err instanceof Error ? err.message : "Error tak terduga",
        })
      }
    }

    await prisma.logAktivitas.create({
      data: {
        userId: session.user.id,
        aksi: "IMPORT_TO_HISTORIS",
        detail: `Import TO: ${results.created} baru, ${results.updated} update, ${results.pelangganUpdated} pelanggan di-flag`,
      },
    })

    return NextResponse.json({
      message: "Import TO Historis selesai",
      ...results,
    })
  } catch (error) {
    console.error("POST /api/to-historis error:", error)
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    )
  }
}

// DELETE /api/to-historis - Bulk delete (selected atau all)
export async function DELETE(request: NextRequest) {
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

    const body = await request.json()
    const { ids, deleteAll } = body

    if (deleteAll) {
      // Ambil semua IDPEL dulu untuk unflag pelanggan
      const allTO = await prisma.tOHistoris.findMany({
        select: { idPelanggan: true },
      })
      const idPelangganList = allTO.map((t) => t.idPelanggan)

      // Hapus semua TO Historis
      const deleted = await prisma.tOHistoris.deleteMany({})

      // Unflag semua pelanggan yang tadinya TO
      await prisma.pelanggan.updateMany({
        where: { idPelanggan: { in: idPelangganList } },
        data: { isToHistory: false },
      })

      await prisma.logAktivitas.create({
        data: {
          userId: session.user.id,
          aksi: "DELETE_ALL_TO_HISTORIS",
          detail: `Hapus SEMUA TO Historis: ${deleted.count} data, ${idPelangganList.length} pelanggan di-unflag`,
        },
      })

      return NextResponse.json({
        message: "Semua TO Historis berhasil dihapus",
        deleted: deleted.count,
      })
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "Pilih minimal 1 data untuk dihapus" },
        { status: 400 }
      )
    }

    // Ambil IDPEL dari TO yang akan dihapus (untuk unflag pelanggan)
    const toToDelete = await prisma.tOHistoris.findMany({
      where: { id: { in: ids } },
      select: { idPelanggan: true },
    })
    const idPelangganList = toToDelete.map((t) => t.idPelanggan)

    // Hapus TO Historis
    const deleted = await prisma.tOHistoris.deleteMany({
      where: { id: { in: ids } },
    })

    // Unflag pelanggan (hanya yang tidak ada lagi di TO Historis lain)
    for (const idPel of idPelangganList) {
      const stillExists = await prisma.tOHistoris.findUnique({
        where: { idPelanggan: idPel },
      })
      if (!stillExists) {
        await prisma.pelanggan.updateMany({
          where: { idPelanggan: idPel },
          data: { isToHistory: false },
        })
      }
    }

    await prisma.logAktivitas.create({
      data: {
        userId: session.user.id,
        aksi: "BULK_DELETE_TO_HISTORIS",
        detail: `Hapus ${deleted.count} TO Historis`,
      },
    })

    return NextResponse.json({
      message: `${deleted.count} TO Historis berhasil dihapus`,
      deleted: deleted.count,
    })
  } catch (error) {
    console.error("DELETE /api/to-historis error:", error)
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    )
  }
}
