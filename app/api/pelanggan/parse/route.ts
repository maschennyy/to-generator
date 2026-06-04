import { NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { auth } from "@/auth"
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

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
}

function findColumn(headers: unknown[], candidates: string[]) {
  const normalizedCandidates = new Set(candidates.map(normalizeHeader))
  return headers.findIndex((header) => normalizedCandidates.has(normalizeHeader(header)))
}

function parseNumber(value: unknown) {
  if (typeof value === "number") return value

  const raw = String(value ?? "").trim()
  if (!raw) return Number.NaN

  const normalized =
    raw.includes(",") && raw.includes(".")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.replace(",", ".")

  return Number(normalized)
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

    if (rows.length < 2) {
      return NextResponse.json({ success: true, data: [] })
    }

    const headers = rows[0] ?? []
    const idCol = findColumn(headers, ["IDPEL", "ID PELANGGAN", "ID_PELANGGAN"])
    const namaCol = findColumn(headers, ["NAMA", "NAMA PELANGGAN"])
    const alamatCol = findColumn(headers, ["ALAMAT", "LOKASI"])
    const tarifCol = findColumn(headers, ["TARIF", "TRF"])
    const dayaCol = findColumn(headers, ["DAYA"])

    if (idCol < 0 || namaCol < 0 || alamatCol < 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Header wajib tidak ditemukan. Pastikan ada kolom IDPEL, NAMA, dan ALAMAT.",
        },
        { status: 400 }
      )
    }

    const parsedData: ParsedRow[] = []

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      if (row.every((cell) => String(cell ?? "").trim() === "")) continue

      const idPelanggan = cleanIdPelanggan(String(row[idCol] ?? ""))
      const nama = String(row[namaCol] ?? "").trim()
      const alamat = String(row[alamatCol] ?? "").trim()
      const tarif = tarifCol >= 0 ? String(row[tarifCol] ?? "R1").trim() || "R1" : "R1"
      const dayaRaw = dayaCol >= 0 ? parseNumber(row[dayaCol]) : Number.NaN
      const daya = Number.isFinite(dayaRaw) && dayaRaw > 0 ? Math.trunc(dayaRaw) : 900

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
