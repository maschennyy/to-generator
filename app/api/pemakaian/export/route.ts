import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import {
  formatBulanTahun,
  generateMonthRange,
  getRolling12Months,
} from "@/lib/validations/pemakaian"
import { parseOptionalPositiveInt } from "@/lib/api/request-helpers"
import * as XLSX from "xlsx"

const MAX_EXPORT_ROWS = 10000

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") ?? ""
    const tarif = searchParams.get("tarif") || ""
    const status = searchParams.get("status") || ""
    const kwhFilter = searchParams.get("kwhFilter") || ""
    const dayaMin = parseOptionalPositiveInt(searchParams.get("dayaMin"))
    const dayaMax = parseOptionalPositiveInt(searchParams.get("dayaMax"))
    const sort = searchParams.get("sort") || "idPelanggan_asc"

    const dariBulan = parseOptionalPositiveInt(searchParams.get("dariBulan"))
    const dariTahun = parseOptionalPositiveInt(searchParams.get("dariTahun"))
    const sampaiBulan = parseOptionalPositiveInt(searchParams.get("sampaiBulan"))
    const sampaiTahun = parseOptionalPositiveInt(searchParams.get("sampaiTahun"))

    let months: { bulan: number; tahun: number }[]
    const hasCustomRange =
      dariBulan >= 1 && dariBulan <= 12 &&
      dariTahun >= 2020 &&
      sampaiBulan >= 1 && sampaiBulan <= 12 &&
      sampaiTahun >= 2020 &&
      (dariTahun < sampaiTahun || (dariTahun === sampaiTahun && dariBulan <= sampaiBulan))

    if (hasCustomRange) {
      months = generateMonthRange(dariBulan, dariTahun, sampaiBulan, sampaiTahun)
      if (months.length > 24) months = months.slice(months.length - 24)
    } else {
      months = getRolling12Months()
    }

    const monthWhere: Prisma.PemakaianWhereInput = {
      OR: months.map((m) => ({
        AND: [{ bulan: m.bulan }, { tahun: m.tahun }],
      })),
    }

    // Filter dasar: hanya pelanggan yang punya data pemakaian
    const baseWhere: Prisma.PelangganWhereInput = {
      pemakaian: { some: {} },
      ...(search
        ? {
            OR: [
              { idPelanggan: { contains: search, mode: "insensitive" as const } },
              { nama: { contains: search, mode: "insensitive" as const } },
              { lokasi: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    }

    if (tarif) baseWhere.tarif = tarif
    if (dayaMin > 0 || dayaMax > 0) {
      baseWhere.daya = {
        ...(dayaMin > 0 ? { gte: dayaMin } : {}),
        ...(dayaMax > 0 ? { lte: dayaMax } : {}),
      }
    }
    if (status === "to_historis") baseWhere.isToHistory = true
    if (status === "belum_lengkap") baseWhere.dataLengkap = false
    if (status === "lengkap") baseWhere.dataLengkap = true

    if (kwhFilter === "ada_kwh_rentang") {
      baseWhere.pemakaian = { some: monthWhere }
    } else if (kwhFilter === "tanpa_kwh_rentang") {
      baseWhere.AND = [
        ...(Array.isArray(baseWhere.AND) ? baseWhere.AND : []),
        { pemakaian: { none: monthWhere } },
      ]
    } else if (kwhFilter === "nol_kwh") {
      baseWhere.pemakaian = { some: { ...monthWhere, kwh: 0 } }
    }

    // Hitung dulu — hanya pelanggan yang punya pemakaian
    const totalCount = await prisma.pelanggan.count({ where: baseWhere })

    if (totalCount > MAX_EXPORT_ROWS) {
      return NextResponse.json(
        {
          error: `Data terlalu besar (${totalCount.toLocaleString("id-ID")} pelanggan). Gunakan filter pencarian untuk mempersempit data (maks. ${MAX_EXPORT_ROWS.toLocaleString("id-ID")} baris).`,
        },
        { status: 400 }
      )
    }

    if (totalCount === 0) {
      return NextResponse.json(
        { error: "Tidak ada data pemakaian untuk diekspor" },
        { status: 404 }
      )
    }

    // Ambil data
    const pelanggan = await prisma.pelanggan.findMany({
      where: baseWhere,
      include: {
        pemakaian: {
          where: monthWhere,
          orderBy: [{ tahun: "asc" }, { bulan: "asc" }],
        },
      },
      orderBy: getPemakaianOrderBy(sort),
    })

    // Header
    const headerRow: string[] = [
      "No",
      "ID Pelanggan",
      "Nama",
      "Tarif",
      "Daya (VA)",
      ...months.map((m) => formatBulanTahun(m.bulan, m.tahun)),
      "Rata-rata (kWh)",
    ]

    // Baris data
    const dataRows: (string | number)[][] = pelanggan.map((item, index) => {
      const pemakaianMap = new Map(
        item.pemakaian.map((p) => [`${p.tahun}-${p.bulan}`, p.kwh])
      )

      const kwhValues = item.pemakaian
        .filter((p) => p.kwh !== null)
        .map((p) => p.kwh ?? 0)
      const rataRata =
        kwhValues.length > 0
          ? Math.round(kwhValues.reduce((a, b) => a + b, 0) / kwhValues.length)
          : 0

      const monthCols = months.map((m) => {
        const kwh = pemakaianMap.get(`${m.tahun}-${m.bulan}`)
        return kwh !== undefined && kwh !== null ? kwh : "-"
      })

      return [
        index + 1,
        item.idPelanggan,
        item.nama || "",
        item.tarif,
        item.daya,
        ...monthCols,
        rataRata,
      ]
    })

    // Buat workbook
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows])

    ws["!cols"] = [
      { wch: 5 },
      { wch: 16 },
      { wch: 28 },
      { wch: 8 },
      { wch: 10 },
      ...months.map(() => ({ wch: 11 })),
      { wch: 14 },
    ]

    XLSX.utils.book_append_sheet(wb, ws, "Data Pemakaian")

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

    const today = new Date().toISOString().slice(0, 10)
    const filename = search
      ? `data-pemakaian-${search.slice(0, 20)}-${today}.xlsx`
      : `data-pemakaian-${today}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.byteLength.toString(),
      },
    })
  } catch (error) {
    console.error("GET /api/pemakaian/export error:", error)
    return NextResponse.json(
      { error: "Terjadi kesalahan saat mengekspor data" },
      { status: 500 }
    )
  }
}

function getPemakaianOrderBy(sort: string): Prisma.PelangganOrderByWithRelationInput {
  const sortMap: Record<string, Prisma.PelangganOrderByWithRelationInput> = {
    createdAt_desc: { createdAt: "desc" },
    idPelanggan_asc: { idPelanggan: "asc" },
    idPelanggan_desc: { idPelanggan: "desc" },
    nama_asc: { nama: "asc" },
    nama_desc: { nama: "desc" },
    tarif_asc: { tarif: "asc" },
    daya_asc: { daya: "asc" },
    daya_desc: { daya: "desc" },
  }

  return sortMap[sort] ?? sortMap.idPelanggan_asc
}
