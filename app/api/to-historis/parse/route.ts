import { NextRequest, NextResponse } from "next/server"
import ExcelJS from "exceljs"

import { cleanIdPelanggan } from "@/lib/validations/master-dil"

interface ParsedRow {
  row: number
  idPelanggan: string
  nama: string
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

    const buffer = Buffer.from(arrayBuffer)
    
    const workbook = new ExcelJS.Workbook()

    // @ts-expect-error: Mengabaikan mismatch tipe Buffer Node.js terbaru dengan ExcelJS
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0]

    const parsedData: ParsedRow[] = []

    worksheet.eachRow((row, rowNumber) => {
      // skip header
      if (rowNumber === 1) return

      const idPelanggan = cleanIdPelanggan(
        String(row.getCell(1).value ?? "")
      )

      const nama = String(
        row.getCell(2).value ?? ""
      ).trim()

      let status: "valid" | "invalid" = "valid"

      let error: string | undefined

      if (!idPelanggan) {
        status = "invalid"
        error = "IDPEL kosong"
      } else if (!/^\d+$/.test(idPelanggan)) {
        status = "invalid"
        error = "IDPEL harus angka"
      }

      parsedData.push({
        row: rowNumber,
        idPelanggan,
        nama,
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