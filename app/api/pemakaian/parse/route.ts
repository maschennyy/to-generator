import { NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { cleanIdPelanggan } from "@/lib/validations/master-dil"
import { validateSpreadsheetFile } from "@/lib/api/request-helpers"

interface ParsedRow {
  row: number
  idPelanggan: string
  nama?: string
  tarif: string
  daya: number
  bulan: number
  tahun: number
  kwh: number
  isToHistory: boolean
  dataLengkap: boolean
  status: "valid" | "invalid"
  error?: string
}

const MONTH_MAP: Record<string, number> = {
  jan: 1,
  januari: 1,
  feb: 2,
  februari: 2,
  mar: 3,
  maret: 3,
  apr: 4,
  april: 4,
  may: 5,
  mei: 5,
  jun: 6,
  juni: 6,
  jul: 7,
  juli: 7,
  aug: 8,
  agu: 8,
  ags: 8,
  agustus: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  okt: 10,
  oktober: 10,
  nov: 11,
  november: 11,
  dec: 12,
  des: 12,
  desember: 12,
}

const MAX_IMPORT_ROWS = 50000

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

function normalizeYear(value: number) {
  if (value < 100) return value >= 70 ? 1900 + value : 2000 + value
  return value
}

function parseExcelDate(value: number) {
  const parsed = XLSX.SSF.parse_date_code(value)
  if (!parsed || !parsed.m || !parsed.y) return null
  return { bulan: parsed.m, tahun: parsed.y }
}

function parsePeriod(value: unknown): { bulan: number; tahun: number } | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { bulan: value.getMonth() + 1, tahun: value.getFullYear() }
  }

  if (typeof value === "number") {
    if (value > 20000) return parseExcelDate(value)

    const numeric = String(Math.trunc(value))
    if (/^\d{6}$/.test(numeric)) {
      const tahun = Number(numeric.slice(0, 4))
      const bulan = Number(numeric.slice(4, 6))
      return bulan >= 1 && bulan <= 12 ? { bulan, tahun } : null
    }
  }

  const raw = String(value ?? "").trim()
  if (!raw) return null

  const compact = raw.replace(/\s+/g, " ")
  const numericOnly = compact.replace(/\D/g, "")
  if (/^\d{6}$/.test(numericOnly)) {
    const firstFour = Number(numericOnly.slice(0, 4))
    const lastTwo = Number(numericOnly.slice(4, 6))
    if (firstFour >= 1900 && lastTwo >= 1 && lastTwo <= 12) {
      return { bulan: lastTwo, tahun: firstFour }
    }

    const firstTwo = Number(numericOnly.slice(0, 2))
    const lastFour = Number(numericOnly.slice(2, 6))
    if (firstTwo >= 1 && firstTwo <= 12 && lastFour >= 1900) {
      return { bulan: firstTwo, tahun: lastFour }
    }
  }

  const monthNameMatch = compact.match(/^([a-zA-Z]+)[\s\-/.]+(\d{2,4})$/)
  if (monthNameMatch) {
    const bulan = MONTH_MAP[monthNameMatch[1].toLowerCase()]
    const tahun = normalizeYear(Number(monthNameMatch[2]))
    return bulan ? { bulan, tahun } : null
  }

  const monthNumberMatch = compact.match(/^(\d{1,2})[\s\-/.]+(\d{2,4})$/)
  if (monthNumberMatch) {
    const bulan = Number(monthNumberMatch[1])
    const tahun = normalizeYear(Number(monthNumberMatch[2]))
    return bulan >= 1 && bulan <= 12 ? { bulan, tahun } : null
  }

  const yearFirstMatch = compact.match(/^(\d{4})[\s\-/.]+(\d{1,2})$/)
  if (yearFirstMatch) {
    const tahun = Number(yearFirstMatch[1])
    const bulan = Number(yearFirstMatch[2])
    return bulan >= 1 && bulan <= 12 ? { bulan, tahun } : null
  }

  return null
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

    const headers = rows[0] ?? []
    const idCol = findColumn(headers, ["IDPEL", "ID PELANGGAN", "ID_PELANGGAN"])
    const tarifCol = findColumn(headers, ["TRF", "TARIF"])
    const dayaCol = findColumn(headers, ["DAYA"])
    const periodeCol = findColumn(headers, ["BLTH REK", "BLTH", "BULAN", "PERIODE", "BULAN TAHUN"])
    const kwhCol = findColumn(headers, ["PEMKWH", "KWH", "PEMAKAIAN KWH", "PEMAKAIAN"])

    if (idCol < 0 || periodeCol < 0 || kwhCol < 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Header wajib tidak ditemukan. Pastikan ada kolom IDPEL, BLTH REK, dan PEMKWH.",
        },
        { status: 400 }
      )
    }

    const idPelangganList = [
      ...new Set(rows.slice(1).map((row) => cleanIdPelanggan(String(row[idCol] ?? ""))).filter(Boolean)),
    ]

    const [pelangganRows, toHistorisRows] = await Promise.all([
      prisma.pelanggan.findMany({
        where: { idPelanggan: { in: idPelangganList } },
        select: {
          idPelanggan: true,
          nama: true,
          tarif: true,
          daya: true,
          dataLengkap: true,
          isToHistory: true,
        },
      }),
      prisma.tOHistoris.findMany({
        where: { idPelanggan: { in: idPelangganList } },
        select: { idPelanggan: true },
      }),
    ])

    const pelangganMap = new Map(pelangganRows.map((pelanggan) => [pelanggan.idPelanggan, pelanggan]))
    const toHistorisSet = new Set(toHistorisRows.map((row) => row.idPelanggan))
    const parsedData: ParsedRow[] = []

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      if (row.every((cell) => String(cell ?? "").trim() === "")) continue

      const idPelanggan = cleanIdPelanggan(String(row[idCol] ?? ""))
      const pelanggan = pelangganMap.get(idPelanggan)
      const periode = parsePeriod(row[periodeCol])
      const kwh = parseNumber(row[kwhCol])
      const tarifFile = tarifCol >= 0 ? String(row[tarifCol] ?? "").trim() : ""
      const dayaFile = dayaCol >= 0 ? parseNumber(row[dayaCol]) : Number.NaN
      const tarif = pelanggan?.tarif || tarifFile || "R1"
      const daya = pelanggan?.daya || (Number.isFinite(dayaFile) ? Math.trunc(dayaFile) : 900)
      const isToHistory = Boolean(pelanggan?.isToHistory || toHistorisSet.has(idPelanggan))
      const dataLengkap = pelanggan?.dataLengkap ?? false

      let status: "valid" | "invalid" = "valid"
      let error: string | undefined

      if (!idPelanggan) {
        status = "invalid"
        error = "IDPEL kosong"
      } else if (!/^\d+$/.test(idPelanggan)) {
        status = "invalid"
        error = "IDPEL harus angka"
      } else if (!periode) {
        status = "invalid"
        error = "BLTH REK tidak terbaca"
      } else if (!Number.isFinite(kwh) || kwh < 0) {
        status = "invalid"
        error = "PEMKWH tidak valid"
      }

      parsedData.push({
        row: i + 1,
        idPelanggan,
        nama: pelanggan?.nama || undefined,
        tarif,
        daya,
        bulan: periode?.bulan ?? 0,
        tahun: periode?.tahun ?? 0,
        kwh: Number.isFinite(kwh) ? kwh : Number.NaN,
        isToHistory,
        dataLengkap,
        status,
        error,
      })
    }

    return NextResponse.json({ success: true, data: parsedData })
  } catch (error) {
    console.error("pemakaian/parse error:", error)
    return NextResponse.json({ success: false, message: "Gagal membaca file Excel" }, { status: 500 })
  }
}
