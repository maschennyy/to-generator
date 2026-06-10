import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 12 bulan ke belakang dari sekarang
    const now = new Date()
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)

    const [
      toPerBulan,
      toPerTipe,
      statusCounts,
      highRisk,
      mediumRisk,
      lowRisk,
      hasilTableRows,
    ] = await Promise.all([
      // Tren TO per bulan — groupBy createdAt
      prisma.targetOperasi.findMany({
        where: { createdAt: { gte: twelveMonthsAgo } },
        select: { createdAt: true, status: true },
      }),

      // Distribusi per tipe anomali
      prisma.targetOperasi.groupBy({
        by: ["tipeAnomali"],
        _count: { _all: true },
        orderBy: { _count: { tipeAnomali: "desc" } },
      }),
      prisma.targetOperasi.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.targetOperasi.count({ where: { skor: { gte: 70 } } }),
      prisma.targetOperasi.count({ where: { skor: { gte: 40, lt: 70 } } }),
      prisma.targetOperasi.count({ where: { skor: { lt: 40 } } }),
      prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT to_regclass('public.hasil_operasi') IS NOT NULL AS "exists"
      `,
    ])

    // Bangun data tren per bulan
    const monthMap = new Map<string, { total: number; selesai: number }>()

    // Isi semua 12 bulan dengan 0 dulu agar tidak ada gap
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      monthMap.set(key, { total: 0, selesai: 0 })
    }

    // Isi dengan data nyata
    for (const to of toPerBulan) {
      const d = new Date(to.createdAt)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const entry = monthMap.get(key)
      if (entry) {
        entry.total++
        if (to.status === "SELESAI") entry.selesai++
      }
    }

    const trendData = Array.from(monthMap.entries()).map(([key, val]) => {
      const [year, month] = key.split("-")
      const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(
        "id-ID",
        { month: "short", year: "2-digit" }
      )
      return { key, label, total: val.total, selesai: val.selesai }
    })

    // Label tipe anomali
    const TIPE_LABEL: Record<string, string> = {
      TURUN_DRASTIS: "Turun Drastis",
      STAGNAN: "Stagnan",
      NOL_PEMAKAIAN: "Nol Pemakaian",
      LONJAKAN: "Lonjakan",
      POLA_TIDAK_WAJAR: "Pola Tidak Wajar",
    }

    const tipeData = toPerTipe.map((row) => ({
      tipe: row.tipeAnomali,
      label: TIPE_LABEL[row.tipeAnomali] ?? row.tipeAnomali,
      total: row._count._all,
    }))

    const statusMap = new Map(statusCounts.map((row) => [row.status, row._count._all]))
    const totalCreated = Array.from(statusMap.values()).reduce((sum, total) => sum + total, 0)
    const diproses = statusMap.get("DIPROSES") ?? 0
    const selesai = statusMap.get("SELESAI") ?? 0
    const dibatalkan = statusMap.get("DIBATALKAN") ?? 0
    const pending = statusMap.get("PENDING") ?? 0
    const hasHasilTable = hasilTableRows[0]?.exists ?? false
    const hasilRows = hasHasilTable
      ? await prisma.hasilOperasi.groupBy({
          by: ["hasil"],
          _count: { _all: true },
        })
      : []
    const hasilMap = new Map(hasilRows.map((row) => [row.hasil, row._count._all]))
    const checked = (hasilMap.get("NORMAL") ?? 0)
      + (hasilMap.get("PELANGGARAN") ?? 0)
      + (hasilMap.get("TIDAK_DITEMUKAN") ?? 0)
    const violations = hasilMap.get("PELANGGARAN") ?? 0
    const hitRate = checked > 0 ? violations / checked : null

    return NextResponse.json({
      trendData,
      tipeData,
      operational: {
        funnel: [
          { key: "created", label: "TO Dibuat", total: totalCreated },
          { key: "pending", label: "Pending", total: pending },
          { key: "process", label: "Diproses", total: diproses },
          { key: "done", label: "Selesai", total: selesai },
          { key: "violation", label: "Terbukti", total: violations },
        ],
        status: { pending, diproses, selesai, dibatalkan },
        hitRate,
        checked,
        violations,
      },
      riskDistribution: [
        { band: "high", label: "Risiko Tinggi", range: "70-100", total: highRisk },
        { band: "medium", label: "Risiko Menengah", range: "40-69", total: mediumRisk },
        { band: "low", label: "Risiko Rendah", range: "0-39", total: lowRisk },
      ],
    })
  } catch (error) {
    console.error("GET /api/dashboard-charts error:", error)
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 })
  }
}
