import { NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"
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

type LaporanData = {
  range: { from: string; to: string }
  kpi: {
    totalInRange: number
    pending: number
    diproses: number
    selesai: number
    dibatalkan: number
    successRate: number
    totalAllTime: number
    totalPelanggan: number
    totalPemakaian: number
    totalToHistoris: number
  }
  breakdown: { tipe: Record<string, number> }
  series: Array<{ date: string; total: number; selesai: number }>
  table: Array<{
    pelanggan: { idPelanggan: string; nama: string; tarif: string; daya: number; lokasi: string }
    tipeAnomali: string
    alasan: string
    skor: number
    status: string
    periode: string
    createdAt: string
  }>
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { data, userName } = body as { data: LaporanData; userName: string }

  if (!data) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 })
  }

  const wb = XLSX.utils.book_new()

  // ── Sheet 1: Ringkasan KPI ────────────────────────────────────────────────
  const periodeStr = `${new Date(data.range.from).toLocaleDateString("id-ID", {
    day: "2-digit", month: "long", year: "numeric",
  })} - ${new Date(data.range.to).toLocaleDateString("id-ID", {
    day: "2-digit", month: "long", year: "numeric",
  })}`

  const kpiRows: (string | number)[][] = [
    ["Laporan Target Operasi - TO Generator PLN ICON+"],
    [],
    ["Periode", periodeStr],
    ["Dicetak oleh", `${userName} - ${new Date().toLocaleString("id-ID")}`],
    [],
    ["RINGKASAN KPI", ""],
    ["Total TO (periode)", data.kpi.totalInRange],
    ["Pending", data.kpi.pending],
    ["Diproses", data.kpi.diproses],
    ["Selesai", data.kpi.selesai],
    ["Dibatalkan", data.kpi.dibatalkan],
    ["Success Rate (%)", data.kpi.successRate],
    ["Total TO (sepanjang waktu)", data.kpi.totalAllTime],
    ["Total Pelanggan", data.kpi.totalPelanggan],
    ["Data Pemakaian", data.kpi.totalPemakaian],
    ["TO Historis", data.kpi.totalToHistoris],
  ]
  const wsKpi = XLSX.utils.aoa_to_sheet(kpiRows)
  wsKpi["!cols"] = [{ wch: 34 }, { wch: 52 }]
  XLSX.utils.book_append_sheet(wb, wsKpi, "Ringkasan")

  // ── Sheet 2: Breakdown Tipe ───────────────────────────────────────────────
  const tipeRows: (string | number)[][] = [
    ["Tipe Anomali", "Jumlah TO"],
    ...Object.entries(data.breakdown.tipe).map(([k, v]) => [TIPE_LABEL[k] ?? k, v]),
  ]
  const wsTipe = XLSX.utils.aoa_to_sheet(tipeRows)
  wsTipe["!cols"] = [{ wch: 26 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, wsTipe, "Breakdown Tipe")

  // ── Sheet 3: Tren Harian ──────────────────────────────────────────────────
  const seriesRows: (string | number)[][] = [
    ["Tanggal", "TO Dibuat", "TO Selesai"],
    ...data.series.map((s) => [s.date, s.total, s.selesai]),
  ]
  const wsSeries = XLSX.utils.aoa_to_sheet(seriesRows)
  wsSeries["!cols"] = [{ wch: 14 }, { wch: 14 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, wsSeries, "Tren Harian")

  // ── Sheet 4: Detail TO ────────────────────────────────────────────────────
  const detailHeader = [
    "No", "IDPEL", "Nama Pelanggan", "Tarif", "Daya (VA)", "Lokasi",
    "Tipe Anomali", "Alasan", "Skor (%)", "Status", "Periode", "Tanggal Dibuat",
  ]
  const detailRows = data.table.map((t, i) => [
    i + 1,
    t.pelanggan.idPelanggan,
    t.pelanggan.nama || "",
    t.pelanggan.tarif,
    t.pelanggan.daya,
    t.pelanggan.lokasi,
    TIPE_LABEL[t.tipeAnomali] ?? t.tipeAnomali,
    t.alasan,
    Math.round(t.skor * 100),
    STATUS_LABEL[t.status] ?? t.status,
    t.periode,
    new Date(t.createdAt).toLocaleDateString("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
    }),
  ])

  const wsDetail = XLSX.utils.aoa_to_sheet([detailHeader, ...detailRows])
  wsDetail["!cols"] = [
    { wch: 5 }, { wch: 16 }, { wch: 28 }, { wch: 8 }, { wch: 10 },
    { wch: 28 }, { wch: 20 }, { wch: 60 }, { wch: 10 },
    { wch: 12 }, { wch: 12 }, { wch: 16 },
  ]
  XLSX.utils.book_append_sheet(wb, wsDetail, "Detail TO")

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
  const filename = `laporan-TO-${data.range.from.slice(0, 10)}_sd_${data.range.to.slice(0, 10)}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": buffer.byteLength.toString(),
    },
  })
}
