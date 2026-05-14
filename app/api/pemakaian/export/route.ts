import { NextRequest, NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { formatBulanTahun } from "@/lib/validations/pemakaian"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search") ?? ""

  // Ambil semua data (tanpa pagination)
  const pelanggan = await prisma.pelanggan.findMany({
    where: search
      ? {
          OR: [
            { idPelanggan: { contains: search, mode: "insensitive" } },
            { nama: { contains: search, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: {
      pemakaian: {
        orderBy: [{ tahun: "asc" }, { bulan: "asc" }],
      },
    },
    orderBy: { idPelanggan: "asc" },
  })

  // Kumpulkan semua bulan yang ada
  const monthSet = new Set<string>()
  pelanggan.forEach((p) =>
    p.pemakaian.forEach((pm) => monthSet.add(`${pm.tahun}-${pm.bulan}`))
  )
  const months = Array.from(monthSet)
    .sort()
    .map((key) => {
      const [tahun, bulan] = key.split("-").map(Number)
      return { tahun, bulan }
    })

  // Buat workbook
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet("Data Pemakaian")

  // Header
  worksheet.columns = [
    { header: "No", key: "no", width: 6 },
    { header: "ID Pelanggan", key: "idPelanggan", width: 16 },
    { header: "Nama", key: "nama", width: 26 },
    { header: "Tarif", key: "tarif", width: 10 },
    { header: "Daya (VA)", key: "daya", width: 12 },
    ...months.map((m) => ({
      header: formatBulanTahun(m.bulan, m.tahun),
      key: `${m.tahun}-${m.bulan}`,
      width: 13,
    })),
    { header: "Rata-rata", key: "rataRata", width: 12 },
  ]

  // Style header
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true }
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE2EFDA" },
    }
  })

  // Isi baris data
  pelanggan.forEach((item, index) => {
    const pemakaianMap = new Map(
      item.pemakaian.map((p) => [`${p.tahun}-${p.bulan}`, p.kwh])
    )

    const totalKwh = item.pemakaian
      .filter((p) => p.kwh !== null)
      .reduce((sum, p) => sum + (p.kwh ?? 0), 0)
    const jumlahBulan = item.pemakaian.filter((p) => p.kwh !== null).length
    const rataRata =
      jumlahBulan > 0 ? Math.round(totalKwh / jumlahBulan) : 0

    const row: Record<string, string | number> = {
      no: index + 1,
      idPelanggan: item.idPelanggan,
      nama: item.nama,
      tarif: item.tarif,
      daya: item.daya,
      rataRata,
    }

    months.forEach((m) => {
      const key = `${m.tahun}-${m.bulan}`
      const kwh = pemakaianMap.get(key)
      row[key] = kwh !== undefined && kwh !== null ? kwh : "-"
    })

    worksheet.addRow(row)
  })

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer()

  const today = new Date().toISOString().slice(0, 10)
  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="data-pemakaian-${today}.xlsx"`,
    },
  })
}