import { NextRequest, NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { auth } from "@/auth"

const TIPE_LABEL: Record<string, string> = {
  TURUN_DRASTIS: "Turun Drastis",
  STAGNAN: "Stagnan",
  NOL_PEMAKAIAN: "Nol Pemakaian",
  LONJAKAN: "Lonjakan",
  POLA_TIDAK_WAJAR: "Pola Tidak Wajar",
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  DIPROSES: "Diproses",
  SELESAI: "Selesai",
  DIBATALKAN: "Dibatalkan",
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { allData, search, filterTipe, filterStatus } = body

  if (!allData || allData.length === 0) {
    return NextResponse.json({ error: "Tidak ada data" }, { status: 400 })
  }

  const workbook = new ExcelJS.Workbook()
  const now = new Date()

  // ── Sheet 1: Daftar TO ──────────────────────────────────────────────────
  const wsTO = workbook.addWorksheet("Daftar TO")
  wsTO.columns = [
    { header: "No", key: "no", width: 6 },
    { header: "IDPEL", key: "idpel", width: 18 },
    { header: "Nama Pelanggan", key: "nama", width: 30 },
    { header: "Tarif", key: "tarif", width: 10 },
    { header: "Daya (VA)", key: "daya", width: 12 },
    { header: "Lokasi", key: "lokasi", width: 30 },
    { header: "Tipe Anomali", key: "tipe", width: 22 },
    { header: "Alasan", key: "alasan", width: 60 },
    { header: "Skor (%)", key: "skor", width: 12 },
    { header: "Status", key: "status", width: 14 },
    { header: "Periode", key: "periode", width: 14 },
    { header: "TO Historis", key: "historis", width: 14 },
    { header: "Tanggal Generate", key: "tanggal", width: 18 },
  ]
  wsTO.getRow(1).font = { bold: true }
  wsTO.getRow(1).fill = {
    type: "pattern", pattern: "solid", fgColor: { argb: "FFE2EFDA" },
  }

  allData.forEach((item: {
    pelanggan: { idPelanggan: string; nama: string; tarif: string; daya: number; lokasi: string; isToHistory: boolean }
    tipeAnomali: string; alasan: string; skor: number; status: string
    periode: string; createdAt: string
  }, i: number) => {
    wsTO.addRow({
      no: i + 1,
      idpel: item.pelanggan.idPelanggan,
      nama: item.pelanggan.nama || "",
      tarif: item.pelanggan.tarif,
      daya: item.pelanggan.daya,
      lokasi: item.pelanggan.lokasi,
      tipe: TIPE_LABEL[item.tipeAnomali] ?? item.tipeAnomali,
      alasan: item.alasan,
      skor: Math.round(item.skor * 100),
      status: STATUS_LABEL[item.status] ?? item.status,
      periode: item.periode,
      historis: item.pelanggan.isToHistory ? "Ya" : "Tidak",
      tanggal: new Date(item.createdAt).toLocaleDateString("id-ID", {
        day: "2-digit", month: "short", year: "numeric",
      }),
    })
  })

  // ── Sheet 2: Rekap per Tipe ──────────────────────────────────────────────
  const rekapTipe = new Map<string, number>()
  for (const item of allData) {
    rekapTipe.set(item.tipeAnomali, (rekapTipe.get(item.tipeAnomali) ?? 0) + 1)
  }

  const wsTipe = workbook.addWorksheet("Rekap Tipe")
  wsTipe.columns = [
    { header: "Tipe Anomali", key: "tipe", width: 26 },
    { header: "Jumlah TO", key: "jumlah", width: 14 },
    { header: "Persentase (%)", key: "persen", width: 18 },
  ]
  wsTipe.getRow(1).font = { bold: true }
  rekapTipe.forEach((count, tipe) => {
    wsTipe.addRow({
      tipe: TIPE_LABEL[tipe] ?? tipe,
      jumlah: count,
      persen: Math.round((count / allData.length) * 100),
    })
  })
  wsTipe.addRow({ tipe: "TOTAL", jumlah: allData.length, persen: 100 })

  // ── Sheet 3: Rekap per Status ────────────────────────────────────────────
  const rekapStatus = new Map<string, number>()
  for (const item of allData) {
    rekapStatus.set(item.status, (rekapStatus.get(item.status) ?? 0) + 1)
  }

  const wsStatus = workbook.addWorksheet("Rekap Status")
  wsStatus.columns = [
    { header: "Status", key: "status", width: 18 },
    { header: "Jumlah TO", key: "jumlah", width: 14 },
    { header: "Persentase (%)", key: "persen", width: 18 },
  ]
  wsStatus.getRow(1).font = { bold: true }
  rekapStatus.forEach((count, status) => {
    wsStatus.addRow({
      status: STATUS_LABEL[status] ?? status,
      jumlah: count,
      persen: Math.round((count / allData.length) * 100),
    })
  })
  wsStatus.addRow({ status: "TOTAL", jumlah: allData.length, persen: 100 })

  const buffer = await workbook.xlsx.writeBuffer()

  const parts = ["TO"]
  if (filterTipe) parts.push(TIPE_LABEL[filterTipe]?.replace(/\s/g, "-") ?? filterTipe)
  if (filterStatus) parts.push(STATUS_LABEL[filterStatus] ?? filterStatus)
  if (search) parts.push(`cari-${search.slice(0, 10)}`)
  const filename = `${parts.join("_")}_${now.toISOString().slice(0, 10)}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}