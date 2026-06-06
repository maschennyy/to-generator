import { NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { auth } from "@/auth"
import { cleanIdPelanggan } from "@/lib/validations/master-dil"
import { validateSpreadsheetFile } from "@/lib/api/request-helpers"

interface ParsedRow {
  row: number
  idPelanggan: string
  tanggalTemuan: string | null
  kategori: string | null
  status: "valid" | "invalid"
  error?: string
}

const MAX_IMPORT_ROWS = 50000

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

    const fileError = validateSpreadsheetFile(file)
    if (fileError) {
      return NextResponse.json({ success: false, message: fileError }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true })
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<unknown>(worksheet, { header: 1, defval: "" }) as unknown[][]

    if (rows.length < 2) {
      return NextResponse.json({ success: true, data: [] })
    }

    if (rows.length - 1 > MAX_IMPORT_ROWS) {
      return NextResponse.json(
        {
          success: false,
          message: `Jumlah baris terlalu besar. Maksimal ${MAX_IMPORT_ROWS.toLocaleString("id-ID")} baris per import.`,
        },
        { status: 400 }
      )
    }

    const headerRow = rows[0] ?? []
    const headerMap = createHeaderMap(headerRow)

    if (headerMap.idPelanggan < 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Header wajib tidak ditemukan. Pastikan ada kolom IDPEL.",
        },
        { status: 400 }
      )
    }

    const parsedData: ParsedRow[] = []

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      if (row.every((cell) => String(cell ?? "").trim() === "")) continue

      const idPelanggan = cleanIdPelanggan(String(row[headerMap.idPelanggan] ?? ""))
      const tanggalTemuan =
        headerMap.tanggalTemuan >= 0 ? parseExcelDate(row[headerMap.tanggalTemuan]) : null
      const kategori =
        headerMap.kategori >= 0 ? String(row[headerMap.kategori] ?? "").trim() || null : null

      let status: "valid" | "invalid" = "valid"
      let error: string | undefined

      if (!idPelanggan) {
        status = "invalid"; error = "IDPEL kosong"
      } else if (!/^\d+$/.test(idPelanggan)) {
        status = "invalid"; error = "IDPEL harus angka"
      }

      parsedData.push({ row: i + 1, idPelanggan, tanggalTemuan, kategori, status, error })
    }

    return NextResponse.json({ success: true, data: parsedData })
  } catch (error) {
    console.error("to-historis/parse error:", error)
    return NextResponse.json({ success: false, message: "Gagal membaca file Excel" }, { status: 500 })
  }
}

function createHeaderMap(headerRow: unknown[]) {
  const normalizedHeaders = headerRow.map((header) => normalizeHeader(header))

  return {
    idPelanggan: findHeaderIndex(normalizedHeaders, ["idpel", "id pelanggan", "idpelanggan"]),
    tanggalTemuan: findHeaderIndex(normalizedHeaders, ["tanggal temuan", "tgl temuan", "tanggal", "tanggaltemuan"]),
    kategori: findHeaderIndex(normalizedHeaders, ["kategori", "kategori to", "kategorito"]),
  }
}

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
}

function findHeaderIndex(headers: string[], names: string[]) {
  const index = headers.findIndex((header) => names.includes(header))
  return index >= 0 ? index : -1
}

function parseExcelDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDate(value)
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (!parsed) return null
    return formatDate(new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)))
  }

  const raw = String(value).trim()
  if (!raw) return null

  const slashDate = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (slashDate) {
    const day = Number(slashDate[1])
    const month = Number(slashDate[2])
    const year = normalizeYear(Number(slashDate[3]))
    const date = new Date(Date.UTC(year, month - 1, day))
    if (isValidDateParts(date, year, month, day)) {
      return formatDate(date)
    }
  }

  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) {
    return formatDate(parsed)
  }

  return null
}

function normalizeYear(year: number) {
  return year < 100 ? 2000 + year : year
}

function isValidDateParts(date: Date, year: number, month: number, day: number) {
  return (
    date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
  )
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10)
}
