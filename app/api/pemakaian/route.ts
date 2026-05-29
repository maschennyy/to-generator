import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import {
  pemakaianSchema,
  getRolling12Months,
  generateMonthRange,
} from "@/lib/validations/pemakaian"
import { cleanIdPelanggan } from "@/lib/validations/master-dil"

// GET /api/pemakaian - Format pivot, default rolling 12 bulan termasuk bulan ini
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100)
    const isExport = searchParams.get("export") === "true"
    const skip = (page - 1) * limit

    // Parameter rentang bulan opsional
    const dariBulan = parseInt(searchParams.get("dariBulan") || "0")
    const dariTahun = parseInt(searchParams.get("dariTahun") || "0")
    const sampaiBulan = parseInt(searchParams.get("sampaiBulan") || "0")
    const sampaiTahun = parseInt(searchParams.get("sampaiTahun") || "0")

    // Tentukan daftar bulan yang ditampilkan
    let months: { bulan: number; tahun: number }[]

    const hasCustomRange =
      dariBulan >= 1 && dariBulan <= 12 &&
      dariTahun >= 2020 &&
      sampaiBulan >= 1 && sampaiBulan <= 12 &&
      sampaiTahun >= 2020 &&
      (dariTahun < sampaiTahun || (dariTahun === sampaiTahun && dariBulan <= sampaiBulan))

    if (hasCustomRange) {
      months = generateMonthRange(dariBulan, dariTahun, sampaiBulan, sampaiTahun)
      // Batasi maksimal 24 bulan untuk performa
      if (months.length > 24) {
        months = months.slice(months.length - 24)
      }
    } else {
      months = getRolling12Months()
    }

    const whereClause: {
      OR?: Array<{ [key: string]: { contains: string; mode: "insensitive" } }>
      pemakaian?: { some: object }
    } = {
      pemakaian: { some: {} },
    }

    if (search) {
      whereClause.OR = [
        { idPelanggan: { contains: search, mode: "insensitive" } },
        { nama: { contains: search, mode: "insensitive" } },
      ]
    }

    const [pelanggan, total] = await Promise.all([
      prisma.pelanggan.findMany({
        where: whereClause,
        skip: isExport ? undefined : skip,
        take: isExport ? undefined : limit,
        orderBy: { createdAt: "desc" },
        include: {
          pemakaian: {
            where: {
              OR: months.map((m) => ({
                AND: [{ bulan: m.bulan }, { tahun: m.tahun }],
              })),
            },
            orderBy: [{ tahun: "asc" }, { bulan: "asc" }],
          },
        },
      }),
      prisma.pelanggan.count({ where: whereClause }),
    ])

    const data = pelanggan.map((p) => {
      const pemakaianMap = new Map<string, number>()
      p.pemakaian.forEach((pm) => {
        pemakaianMap.set(`${pm.tahun}-${pm.bulan}`, pm.kwh)
      })

      const pemakaianArray = months.map((m) => ({
        bulan: m.bulan,
        tahun: m.tahun,
        kwh: pemakaianMap.get(`${m.tahun}-${m.bulan}`) ?? null,
      }))

      const validKwh = pemakaianArray
        .filter((p) => p.kwh !== null)
        .map((p) => p.kwh as number)
      const rataRata =
        validKwh.length > 0
          ? validKwh.reduce((a, b) => a + b, 0) / validKwh.length
          : 0

      return {
        id: p.id,
        idPelanggan: p.idPelanggan,
        nama: p.nama,
        tarif: p.tarif,
        daya: p.daya,
        lokasi: p.lokasi,
        isToHistory: p.isToHistory,
        dataLengkap: p.dataLengkap,
        pemakaian: pemakaianArray,
        rataRata: Math.round(rataRata * 100) / 100,
      }
    })

    return NextResponse.json({
      data,
      months,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("GET /api/pemakaian error:", error)
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    )
  }
}


// POST /api/pemakaian - Input pemakaian dengan AUTO-CREATE pelanggan
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
      const items = body.data

      const results = {
        inserted: 0,
        updated: 0,
        pelangganAutoCreated: 0,
        flaggedAsTO: 0,
        errors: [] as Array<{ index: number; error: string }>,
      }

      // Preload TO Historis
      const allTO = await prisma.tOHistoris.findMany()
      const toSet = new Set(allTO.map((t) => t.idPelanggan))

      for (let i = 0; i < items.length; i++) {
        try {
          const item = items[i]
          const cleanId = cleanIdPelanggan(item.idPelanggan)

                    if (!cleanId || !item.bulan || !item.tahun || item.kwh === undefined) {
            results.errors.push({
              index: i,
              error: "Data tidak lengkap",
            })
            continue
          }

          // Cek apakah pelanggan sudah ada
          let pelanggan = await prisma.pelanggan.findUnique({
            where: { idPelanggan: cleanId },
          })

          if (!pelanggan) {
            // AUTO-CREATE pelanggan dengan data dari file pemakaian
            const isTO = toSet.has(cleanId)

            pelanggan = await prisma.pelanggan.create({
              data: {
                idPelanggan: cleanId,
                nama: "",                          // Kosong, perlu diisi manual
                tarif: item.tarif || "R1",
                daya: parseInt(item.daya) || 900,
                lokasi: "",                        // Kosong, perlu diisi manual
                isToHistory: isTO,
                dataLengkap: false,                // Flag: perlu dilengkapi
              },
            })

            results.pelangganAutoCreated++
            if (isTO) results.flaggedAsTO++
          }

          // Upsert pemakaian
          const existing = await prisma.pemakaian.findFirst({
            where: {
              pelangganId: pelanggan.id,
              bulan: parseInt(item.bulan),
              tahun: parseInt(item.tahun),
            },
          })

          if (existing) {
            await prisma.pemakaian.update({
              where: { id: existing.id },
              data: {
                kwh: parseFloat(item.kwh) || 0,
                keterangan: item.keterangan || null,
              },
            })
            results.updated++
          } else {
            await prisma.pemakaian.create({
              data: {
                pelangganId: pelanggan.id,
                bulan: parseInt(item.bulan),
                tahun: parseInt(item.tahun),
                kwh: parseFloat(item.kwh) || 0,
                keterangan: item.keterangan || null,
              },
            })
            results.inserted++
          }
        } catch (err) {
          results.errors.push({
            index: i,
            error: err instanceof Error ? err.message : "Error tak terduga",
          })
        }
      }

      await prisma.logAktivitas.create({
        data: {
          userId: session.user.id,
          aksi: "BULK_IMPORT_PEMAKAIAN",
          detail: `Import: ${results.inserted + results.updated} data, ${results.pelangganAutoCreated} pelanggan baru, ${results.flaggedAsTO} di-flag TO`,
        },
      })

      return NextResponse.json({
        message: "Import pemakaian selesai",
        ...results,
      })
    } else {
      // === SINGLE INPUT ===
      const validation = pemakaianSchema.safeParse(body)
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

      const pelanggan = await prisma.pelanggan.findUnique({
        where: { id: data.pelangganId },
      })

      if (!pelanggan) {
        return NextResponse.json(
          { error: "Pelanggan tidak ditemukan" },
          { status: 404 }
        )
      }

      const existing = await prisma.pemakaian.findFirst({
        where: {
          pelangganId: data.pelangganId,
          bulan: data.bulan,
          tahun: data.tahun,
        },
      })

      let pemakaian
      if (existing) {
        pemakaian = await prisma.pemakaian.update({
          where: { id: existing.id },
          data: {
            kwh: data.kwh,
            keterangan: data.keterangan,
          },
        })
      } else {
        pemakaian = await prisma.pemakaian.create({
          data: {
            pelangganId: data.pelangganId,
            bulan: data.bulan,
            tahun: data.tahun,
            kwh: data.kwh,
            keterangan: data.keterangan,
          },
        })
      }

      await prisma.logAktivitas.create({
        data: {
          userId: session.user.id,
          aksi: "INPUT_PEMAKAIAN",
          detail: `Input pemakaian ${pelanggan.nama} periode ${data.bulan}/${data.tahun}: ${data.kwh} kWh`,
        },
      })

      return NextResponse.json(pemakaian, { status: 201 })
    }
  } catch (error) {
    console.error("POST /api/pemakaian error:", error)
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    )
  }
}
