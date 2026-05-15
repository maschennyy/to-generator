import { NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"
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
      const alamat = String(row[2] ?? "").trim()
      const tarif = String(row[3] ?? "R1").trim()
      const daya = Number(row[4] ?? 900) || 900

      let status: "valid" | "invalid" = "valid"
      let error: string | undefined

      if (!idPelanggan) {
        status = "invalid"; error = "IDPEL kosong"
      } else if (!/^\d+$/.test(idPelanggan)) {
        status = "invalid"; error = "IDPEL harus angka"
      } else if (!nama) {
        status = "invalid"; error = "Nama kosong"
      } else if (!alamat) {
        status = "invalid"; error = "Alamat kosong"
      }

      parsedData.push({ row: i + 1, idPelanggan, nama, alamat, tarif, daya, status, error })
    }

    return NextResponse.json({ success: true, data: parsedData })
  } catch (error) {
    console.error("pelanggan/parse error:", error)
    return NextResponse.json({ success: false, message: "Gagal membaca file Excel" }, { status: 500 })
  }
}