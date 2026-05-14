import { NextRequest, NextResponse } from "next/server"
import ExcelJS from "exceljs"

import { cleanIdPelanggan } from "@/lib/validations/master-dil"
interface ParsedRow {
  row: number
  idPelanggan: string
  nama: string
  alamat: string
  tarif: string
  daya: number
  status: "valid" | "invalid"
  error?: string
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()

    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          message: "File tidak ditemukan",
        },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()

    const buffer = Uint8Array.from(new Uint8Array(arrayBuffer))

    const workbook = new ExcelJS.Workbook()

    await workbook.xlsx.load(buffer as any)

    const worksheet = workbook.worksheets[0]

    const parsedData: ParsedRow[] = []

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return

      const idPelanggan = cleanIdPelanggan(
        String(row.getCell(1).value ?? "")
      )

      const nama = String(row.getCell(2).value ?? "").trim()

      const alamat = String(row.getCell(3).value ?? "").trim()

      const tarif = String(row.getCell(4).value ?? "R1").trim()

      const daya = Number(row.getCell(5).value ?? 900)

      let status: "valid" | "invalid" = "valid"

      let error: string | undefined

      if (!idPelanggan) {
        status = "invalid"
        error = "IDPEL kosong"
      } else if (!/^\d+$/.test(idPelanggan)) {
        status = "invalid"
        error = "IDPEL harus angka"
      } else if (!nama) {
        status = "invalid"
        error = "Nama kosong"
      } else if (!alamat) {
        status = "invalid"
        error = "Alamat kosong"
      }

      parsedData.push({
        row: rowNumber,
        idPelanggan,
        nama,
        alamat,
        tarif,
        daya,
        status,
        error,
      })
    })

    return NextResponse.json({
      success: true,
      data: parsedData,
    })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      {
        success: false,
        message: "Gagal membaca file Excel",
      },
      { status: 500 }
    )
  }
}