import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

type TrainingStatsRow = {
  total: number
  violation: number
  normal: number
}

type LatestHistoryRow = {
  tanggal_train: Date
  jumlah_data: number
  jumlah_temuan: number
  jumlah_normal: number
  precision: number | null
  recall: number | null
  f1_score: number | null
  status: string
  accepted: boolean
  rejection_reason: string | null
  f1_delta: number | null
  precision_delta: number | null
}

type MonthlyFindingRow = {
  month: string
  total: number
}

type OperationalMetricRow = {
  total_checked: number
  violations: number
  normal: number
  not_found: number
  hit_rate: number | null
}

type OperationalLabelRow = {
  operational_violations: number
  operational_normal: number
}

type DataQualityRow = {
  pelanggan_without_usage: number
  to_historis_without_usage: number
  features_without_usage: number
  invalid_usage_rows: number
  duplicate_usage_periods: number
}

type TableCheckRow = {
  exists: boolean
}

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Hanya Admin" }, { status: 403 })
    }

    const [featuresTableRows, historyTableRows, statusTableRows] = await Promise.all([
      prisma.$queryRaw<TableCheckRow[]>`
        SELECT to_regclass('public.ml_customer_features') IS NOT NULL AS "exists"
      `,
      prisma.$queryRaw<TableCheckRow[]>`
        SELECT to_regclass('public.ml_model_history') IS NOT NULL AS "exists"
      `,
      prisma.$queryRaw<TableCheckRow[]>`
        SELECT to_regclass('public.nalar_training_status') IS NOT NULL AS "exists"
      `,
    ])

    const hasFeaturesTable = featuresTableRows[0]?.exists ?? false
    const hasHistoryTable = historyTableRows[0]?.exists ?? false
    const hasStatusTable = statusTableRows[0]?.exists ?? false
    const hasilTableRows = await prisma.$queryRaw<TableCheckRow[]>`
      SELECT to_regclass('public.hasil_operasi') IS NOT NULL AS "exists"
    `
    const hasHasilTable = hasilTableRows[0]?.exists ?? false

    const [trainingRows, latestHistoryRows, monthlyFindings, operationalRows, operationalLabelRows, dataQualityRows] = await Promise.all([
      hasFeaturesTable
        ? prisma.$queryRaw<TrainingStatsRow[]>`
            SELECT
              COUNT(*)::int AS "total",
              COALESCE(SUM(CASE WHEN "is_violation" = 1 THEN 1 ELSE 0 END), 0)::int AS "violation",
              COALESCE(SUM(CASE WHEN "is_violation" = 0 THEN 1 ELSE 0 END), 0)::int AS "normal"
            FROM "ml_customer_features"
          `
        : Promise.resolve([]),
      hasHistoryTable
        ? prisma.$queryRaw<LatestHistoryRow[]>`
            SELECT
              "tanggal_train",
              "jumlah_data",
              "jumlah_temuan",
              "jumlah_normal",
              "precision",
              "recall",
              "f1_score",
              "status",
              "accepted",
              "rejection_reason",
              "f1_delta",
              "precision_delta"
            FROM "ml_model_history"
            ORDER BY "tanggal_train" DESC
            LIMIT 1
          `
        : Promise.resolve([]),
      prisma.$queryRaw<MonthlyFindingRow[]>`
        SELECT
          TO_CHAR(DATE_TRUNC('month', COALESCE("tanggalTemuan", "createdAt")), 'YYYY-MM') AS "month",
          COUNT(*)::int AS "total"
        FROM "to_historis"
        GROUP BY DATE_TRUNC('month', COALESCE("tanggalTemuan", "createdAt"))
        ORDER BY "month" DESC
        LIMIT 12
      `,
      hasHasilTable
        ? prisma.$queryRaw<OperationalMetricRow[]>`
            SELECT
              COUNT(*) FILTER (WHERE "hasil" IN ('NORMAL', 'PELANGGARAN', 'TIDAK_DITEMUKAN'))::int AS "total_checked",
              COUNT(*) FILTER (WHERE "hasil" = 'PELANGGARAN')::int AS "violations",
              COUNT(*) FILTER (WHERE "hasil" = 'NORMAL')::int AS "normal",
              COUNT(*) FILTER (WHERE "hasil" = 'TIDAK_DITEMUKAN')::int AS "not_found",
              CASE
                WHEN COUNT(*) FILTER (WHERE "hasil" IN ('NORMAL', 'PELANGGARAN')) = 0 THEN NULL
                ELSE (
                  COUNT(*) FILTER (WHERE "hasil" = 'PELANGGARAN')::double precision
                  / COUNT(*) FILTER (WHERE "hasil" IN ('NORMAL', 'PELANGGARAN'))::double precision
                )
              END AS "hit_rate"
            FROM "hasil_operasi"
          `
        : Promise.resolve([]),
      hasHasilTable
        ? prisma.$queryRaw<OperationalLabelRow[]>`
            SELECT
              COUNT(DISTINCT "pelangganId") FILTER (WHERE "hasil" = 'PELANGGARAN')::int AS "operational_violations",
              COUNT(DISTINCT "pelangganId") FILTER (WHERE "hasil" = 'NORMAL')::int AS "operational_normal"
            FROM "hasil_operasi"
          `
        : Promise.resolve([]),
      hasFeaturesTable
        ? prisma.$queryRaw<DataQualityRow[]>`
            WITH duplicate_usage AS (
              SELECT
                "pelangganId",
                "bulan",
                "tahun",
                COUNT(*) AS "row_count"
              FROM "pemakaian"
              GROUP BY "pelangganId", "bulan", "tahun"
              HAVING COUNT(*) > 1
            )
            SELECT
              (
                SELECT COUNT(*)::int
                FROM "pelanggan" p
                WHERE NOT EXISTS (
                  SELECT 1
                  FROM "pemakaian" pm
                  WHERE pm."pelangganId" = p."id"
                )
              ) AS "pelanggan_without_usage",
              (
                SELECT COUNT(*)::int
                FROM "to_historis" th
                LEFT JOIN "pelanggan" p
                  ON p."idPelanggan" = th."idPelanggan"
                WHERE p."id" IS NULL
                  OR NOT EXISTS (
                    SELECT 1
                    FROM "pemakaian" pm
                    WHERE pm."pelangganId" = p."id"
                  )
              ) AS "to_historis_without_usage",
              (
                SELECT COUNT(*)::int
                FROM "ml_customer_features"
                WHERE "bulan_data" = 0
              ) AS "features_without_usage",
              (
                SELECT COUNT(*)::int
                FROM "pemakaian"
                WHERE "kwh" < 0
                  OR "bulan" NOT BETWEEN 1 AND 12
                  OR "tahun" < 2000
              ) AS "invalid_usage_rows",
              (
                SELECT COALESCE(SUM("row_count" - 1), 0)::int
                FROM duplicate_usage
              ) AS "duplicate_usage_periods"
          `
        : prisma.$queryRaw<DataQualityRow[]>`
            WITH duplicate_usage AS (
              SELECT
                "pelangganId",
                "bulan",
                "tahun",
                COUNT(*) AS "row_count"
              FROM "pemakaian"
              GROUP BY "pelangganId", "bulan", "tahun"
              HAVING COUNT(*) > 1
            )
            SELECT
              (
                SELECT COUNT(*)::int
                FROM "pelanggan" p
                WHERE NOT EXISTS (
                  SELECT 1
                  FROM "pemakaian" pm
                  WHERE pm."pelangganId" = p."id"
                )
              ) AS "pelanggan_without_usage",
              (
                SELECT COUNT(*)::int
                FROM "to_historis" th
                LEFT JOIN "pelanggan" p
                  ON p."idPelanggan" = th."idPelanggan"
                WHERE p."id" IS NULL
                  OR NOT EXISTS (
                    SELECT 1
                    FROM "pemakaian" pm
                    WHERE pm."pelangganId" = p."id"
                  )
              ) AS "to_historis_without_usage",
              0 AS "features_without_usage",
              (
                SELECT COUNT(*)::int
                FROM "pemakaian"
                WHERE "kwh" < 0
                  OR "bulan" NOT BETWEEN 1 AND 12
                  OR "tahun" < 2000
              ) AS "invalid_usage_rows",
              (
                SELECT COALESCE(SUM("row_count" - 1), 0)::int
                FROM duplicate_usage
              ) AS "duplicate_usage_periods"
          `,
    ])

    return NextResponse.json({
      training: trainingRows[0] ?? { total: 0, violation: 0, normal: 0 },
      latestHistory: latestHistoryRows[0] ?? null,
      monthlyFindings: monthlyFindings.reverse(),
      operational: operationalRows[0] ?? {
        total_checked: 0,
        violations: 0,
        normal: 0,
        not_found: 0,
        hit_rate: null,
      },
      operationalLabels: operationalLabelRows[0] ?? {
        operational_violations: 0,
        operational_normal: 0,
      },
      dataQuality: dataQualityRows[0] ?? {
        pelanggan_without_usage: 0,
        to_historis_without_usage: 0,
        features_without_usage: 0,
        invalid_usage_rows: 0,
        duplicate_usage_periods: 0,
      },
      setup: {
        ready: hasFeaturesTable && hasHistoryTable && hasHasilTable && hasStatusTable,
        missingTables: [
          ...(!hasFeaturesTable ? ["ml_customer_features"] : []),
          ...(!hasHistoryTable ? ["ml_model_history"] : []),
          ...(!hasHasilTable ? ["hasil_operasi"] : []),
          ...(!hasStatusTable ? ["nalar_training_status"] : []),
        ],
        message:
          hasFeaturesTable && hasHistoryTable && hasStatusTable
            ? null
            : "Migration NALAR belum dijalankan di database aktif.",
      },
    })
  } catch (error) {
    console.error("GET /api/ml/dashboard error:", error)
    return NextResponse.json(
      {
        error: "Dashboard NALAR tidak tersedia",
        detail: error instanceof Error ? error.message : "Terjadi kesalahan server",
      },
      { status: 503 }
    )
  }
}
