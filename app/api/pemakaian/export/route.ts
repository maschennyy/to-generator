import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { formatBulanTahun } from "@/lib/validations/pemakaian"
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

    // Filter dasar: hanya pelanggan yang punya data pemakaian
    const baseWhere = {
      pemakaian: { some: {} },
      ...(search
        ? {
            OR: [
              { idPelanggan: { contains: search, mode: "insensitive" as const } },
              { nama: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
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
          orderBy: [{ tahun: "asc" }, { bulan: "asc" }],
        },
      },
      orderBy: { idPelanggan: "asc" },
    })

    // Kumpulkan semua bulan unik
    const monthSet = new Set<string>()
    for (const p of pelanggan) {
      for (const pm of p.pemakaian) {
        monthSet.add(`${pm.tahun}-${String(pm.bulan).padStart(2, "0")}`)
      }
    }
    const months = Array.from(monthSet)
      .sort()
      .map((key) => {
        const [tahun, bulan] = key.split("-").map(Number)
        return { tahun, bulan }
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
