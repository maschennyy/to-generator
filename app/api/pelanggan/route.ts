import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { pelangganSchema } from "@/lib/validations/pelanggan"
import { cleanIdPelanggan } from "@/lib/validations/master-dil"

// GET /api/pelanggan
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const tarif = searchParams.get("tarif") || ""
    const filter = searchParams.get("filter") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const skip = (page - 1) * limit

    const where: {
      OR?: Array<{ [key: string]: { contains: string; mode: "insensitive" } }>
      tarif?: string
      dataLengkap?: boolean
      isToHistory?: boolean
    } = {}

    if (search) {
      where.OR = [
        { idPelanggan: { contains: search, mode: "insensitive" } },
        { nama: { contains: search, mode: "insensitive" } },
        { lokasi: { contains: search, mode: "insensitive" } },
      ]
    }

    if (tarif) {
      where.tarif = tarif
    }

    if (filter === "incomplete") {
      where.dataLengkap = false
    } else if (filter === "to-history") {
      where.isToHistory = true
    }

    const [data, total, totalIncomplete, totalToHistory] = await Promise.all([
      prisma.pelanggan.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.pelanggan.count({ where }),
      prisma.pelanggan.count({ where: { dataLengkap: false } }),
      prisma.pelanggan.count({ where: { isToHistory: true } }),
    ])

    return NextResponse.json({
      data,
      totalIncomplete,
      totalToHistory,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("GET /api/pelanggan error:", error)
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 })
  }
}

// POST /api/pelanggan - Single add OR Bulk import
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
    const isBulk = Array.isArray(body.data)

    if (isBulk) {
      // === BULK IMPORT ===
      const items = body.data

      const results = {
        created: 0,
        updated: 0,
        dataLengkapUpdated: 0,
        errors: [] as Array<{ idPelanggan: string; error: string }>,
      }

      // Preload TO Historis
      const allTO = await prisma.tOHistoris.findMany()
      const toSet = new Set(allTO.map((t) => t.idPelanggan))

      for (const item of items) {
        try {
          const cleanId = cleanIdPelanggan(item.idPelanggan)

          if (!cleanId) {
            results.errors.push({
              idPelanggan: String(item.idPelanggan),
              error: "IDPEL kosong",
            })
            continue
          }

          const namaFinal = String(item.nama || "").trim()
          const alamatFinal = String(item.alamat || item.lokasi || "").trim()
          const tarifFinal = String(item.tarif || "R1").trim()
          const dayaFinal = parseInt(item.daya) || 900
          const dataLengkap = !!(namaFinal && alamatFinal)
          const isTO = toSet.has(cleanId)

          const existing = await prisma.pelanggan.findUnique({
            where: { idPelanggan: cleanId },
          })

          if (existing) {
            // UPDATE existing (hanya field yang tidak kosong)
            const updateData: {
              nama?: string
              lokasi?: string
              tarif?: string
              daya?: number
              dataLengkap?: boolean
              isToHistory?: boolean
            } = {}

            if (namaFinal) updateData.nama = namaFinal
            if (alamatFinal) updateData.lokasi = alamatFinal
            if (tarifFinal) updateData.tarif = tarifFinal
            if (dayaFinal > 0) updateData.daya = dayaFinal
            if (isTO) updateData.isToHistory = true

            // Update dataLengkap jika semua field terisi
            const finalNama = namaFinal || existing.nama
            const finalLokasi = alamatFinal || existing.lokasi
            if (finalNama && finalLokasi) {
              updateData.dataLengkap = true
            }

            if (Object.keys(updateData).length > 0) {
              await prisma.pelanggan.update({
                where: { idPelanggan: cleanId },
                data: updateData,
              })

              if (!existing.dataLengkap && updateData.dataLengkap) {
                results.dataLengkapUpdated++
              }
              results.updated++
            }
          } else {
            // CREATE baru
            await prisma.pelanggan.create({
              data: {
                idPelanggan: cleanId,
                nama: namaFinal || "",
                tarif: tarifFinal,
                daya: dayaFinal,
                lokasi: alamatFinal || "",
                isToHistory: isTO,
                dataLengkap,
              },
            })
            results.created++
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
          aksi: "BULK_IMPORT_PELANGGAN",
                    detail: `Import pelanggan: ${results.created} baru, ${results.updated} update, ${results.dataLengkapUpdated} jadi lengkap`,
        },
      })

      return NextResponse.json({
        message: "Import pelanggan selesai",
        ...results,
      })
    } else {
      // === SINGLE ADD ===
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
      const cleanId = cleanIdPelanggan(data.idPelanggan)

      const existing = await prisma.pelanggan.findUnique({
        where: { idPelanggan: cleanId },
      })

      if (existing) {
        return NextResponse.json(
          { error: "IDPEL sudah terdaftar" },
          { status: 400 }
        )
      }

      // Cek TO Historis
      const toHistoris = await prisma.tOHistoris.findUnique({
        where: { idPelanggan: cleanId },
      })

      const pelanggan = await prisma.pelanggan.create({
        data: {
          idPelanggan: cleanId,
          nama: data.nama,
          tarif: data.tarif,
          daya: data.daya,
          lokasi: data.lokasi,
          isToHistory: !!toHistoris,
          dataLengkap: true,
        },
      })

      await prisma.logAktivitas.create({
        data: {
          userId: session.user.id,
          aksi: "CREATE_PELANGGAN",
          detail: `Tambah pelanggan: ${data.nama} (${cleanId})`,
        },
      })

      return NextResponse.json(pelanggan, { status: 201 })
    }
  } catch (error) {
    console.error("POST /api/pelanggan error:", error)
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    )
  }
}

// DELETE /api/pelanggan - Bulk delete
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
      // Hapus SEMUA pelanggan
      const deleted = await prisma.pelanggan.deleteMany({})

      await prisma.logAktivitas.create({
        data: {
          userId: session.user.id,
          aksi: "DELETE_ALL_PELANGGAN",
          detail: `Hapus SEMUA pelanggan: ${deleted.count} data`,
        },
      })

      return NextResponse.json({
        message: "Semua pelanggan berhasil dihapus",
        deleted: deleted.count,
      })
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "Pilih minimal 1 pelanggan" },
        { status: 400 }
      )
    }

    const deleted = await prisma.pelanggan.deleteMany({
      where: { id: { in: ids } },
    })

    await prisma.logAktivitas.create({
      data: {
        userId: session.user.id,
        aksi: "BULK_DELETE_PELANGGAN",
        detail: `Hapus ${deleted.count} pelanggan`,
      },
    })

    return NextResponse.json({
      message: `${deleted.count} pelanggan berhasil dihapus`,
      deleted: deleted.count,
    })
  } catch (error) {
    console.error("DELETE /api/pelanggan error:", error)
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    )
  }
}