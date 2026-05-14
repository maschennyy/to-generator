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
  const { data, userName } = body

  const workbook = new ExcelJS.Workbook()

  // ── Sheet 1: Ringkasan KPI ──────────────────────────────────────────────
  const wsKpi = workbook.addWorksheet("Ringkasan")
  wsKpi.columns = [
    { header: "", key: "label", width: 36 },
    { header: "", key: "value", width: 52 },
  ]

  const periodeStr = `${new Date(data.range.from).toLocaleDateString("id-ID", {
    day: "2-digit", month: "long", year: "numeric",
  })} — ${new Date(data.range.to).toLocaleDateString("id-ID", {
    day: "2-digit", month: "long", year: "numeric",
  })}`

  wsKpi.addRow(["Laporan Target Operasi — TO Generator PLN ICON+"])
  wsKpi.addRow([])
  wsKpi.addRow(["Periode", periodeStr])
  wsKpi.addRow(["Dicetak oleh", `${userName} — ${new Date().toLocaleString("id-ID")}`])
  wsKpi.addRow([])
  wsKpi.addRow(["RINGKASAN KPI", ""])
  wsKpi.addRow(["Total TO (periode)", data.kpi.totalInRange])
  wsKpi.addRow(["Pending", data.kpi.pending])
  wsKpi.addRow(["Diproses", data.kpi.diproses])
  wsKpi.addRow(["Selesai", data.kpi.selesai])
  wsKpi.addRow(["Dibatalkan", data.kpi.dibatalkan])
  wsKpi.addRow(["Success Rate (%)", data.kpi.successRate])
  wsKpi.addRow(["Total TO (sepanjang waktu)", data.kpi.totalAllTime])
  wsKpi.addRow(["Total Pelanggan", data.kpi.totalPelanggan])
  wsKpi.addRow(["Data Pemakaian", data.kpi.totalPemakaian])
  wsKpi.addRow(["TO Historis", data.kpi.totalToHistoris])

  // ── Sheet 2: Breakdown Tipe Anomali ─────────────────────────────────────
  const wsTipe = workbook.addWorksheet("Breakdown Tipe")
  wsTipe.columns = [
    { header: "Tipe Anomali", key: "tipe", width: 26 },
    { header: "Jumlah TO", key: "jumlah", width: 14 },
  ]
  wsTipe.getRow(1).font = { bold: true }
  Object.entries(data.breakdown.tipe).forEach(([k, v]) => {
    wsTipe.addRow({ tipe: TIPE_LABEL[k] ?? k, jumlah: v })
  })

  // ── Sheet 3: Tren Harian ─────────────────────────────────────────────────
  const wsSeries = workbook.addWorksheet("Tren Harian")
  wsSeries.columns = [
    { header: "Tanggal", key: "date", width: 14 },
    { header: "TO Dibuat", key: "total", width: 14 },
    { header: "TO Selesai", key: "selesai", width: 14 },
  ]
  wsSeries.getRow(1).font = { bold: true }
  data.series.forEach((s: { date: string; total: number; selesai: number }) => {
    wsSeries.addRow(s)
  })

  // ── Sheet 4: Detail TO ────────────────────────────────────────────────────
  const wsDetail = workbook.addWorksheet("Detail TO")
  wsDetail.columns = [
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
    { header: "Tanggal Dibuat", key: "tanggal", width: 18 },
  ]
  wsDetail.getRow(1).font = { bold: true }
  wsDetail.getRow(1).fill = {
    type: "pattern", pattern: "solid", fgColor: { argb: "FFE2EFDA" },
  }
  data.table.forEach((t: {
    pelanggan: { idPelanggan: string; nama: string; tarif: string; daya: number; lokasi: string }
    tipeAnomali: string; alasan: string; skor: number; status: string
    periode: string; createdAt: string
  }, i: number) => {
    wsDetail.addRow({
      no: i + 1,
      idpel: t.pelanggan.idPelanggan,
      nama: t.pelanggan.nama || "",
      tarif: t.pelanggan.tarif,
      daya: t.pelanggan.daya,
      lokasi: t.pelanggan.lokasi,
      tipe: TIPE_LABEL[t.tipeAnomali] ?? t.tipeAnomali,
      alasan: t.alasan,
      skor: Math.round(t.skor * 100),
      status: STATUS_LABEL[t.status] ?? t.status,
      periode: t.periode,
      tanggal: new Date(t.createdAt).toLocaleDateString("id-ID", {
        day: "2-digit", month: "short", year: "numeric",
      }),
    })
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const filename = `laporan-TO-${data.range.from.slice(0, 10)}_sd_${data.range.to.slice(0, 10)}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}