import { NextRequest, NextResponse } from "next/server"
import ExcelJS from "exceljs"

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json(
        { success: false, message: "File tidak ditemukan" },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()

    const buffer = Uint8Array.from(new Uint8Array(arrayBuffer))

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as any)

    const worksheet = workbook.worksheets[0]

    const data: any[] = []

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return

      data.push({
        idPelanggan: row.getCell(1).value,
        nama: row.getCell(2).value,
      })
    })

    console.log(data)

    return NextResponse.json({
      success: true,
      message: "Import berhasil",
      data,
    })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      {
        success: false,
        message: "Gagal import",
      },
      { status: 500 }
    )
  }
}