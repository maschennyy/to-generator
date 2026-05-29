import { NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { auth } from "@/auth"
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
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ success: false, message: "Forbidden: Hanya Admin" }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ success: false, message: "File tidak ditemukan" }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: "array" })
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<unknown>(worksheet, { header: 1, defval: "" }) as unknown[][]

    const parsedData: ParsedRow[] = []

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      const idPelanggan = cleanIdPelanggan(String(row[0] ?? ""))
      const nama = String(row[1] ?? "").trim()

      let status: "valid" | "invalid" = "valid"
      let error: string | undefined

      if (!idPelanggan) {
        status = "invalid"; error = "IDPEL kosong"
      } else if (!/^\d+$/.test(idPelanggan)) {
        status = "invalid"; error = "IDPEL harus angka"
      }

      parsedData.push({ row: i + 1, idPelanggan, nama, status, error })
    }

    return NextResponse.json({ success: true, data: parsedData })
  } catch (error) {
    console.error("to-historis/parse error:", error)
    return NextResponse.json({ success: false, message: "Gagal membaca file Excel" }, { status: 500 })
  }
}
