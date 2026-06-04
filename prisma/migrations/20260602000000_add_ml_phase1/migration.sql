-- FASE 1 Machine Learning
-- Tambahan ini tidak mengubah tabel aplikasi yang sudah ada.
-- Objek baru:
--   1. View "ml_training_data"
--   2. Table "ml_customer_features"
--   3. Function "refresh_ml_customer_features" untuk menghitung ulang fitur

CREATE OR REPLACE VIEW "ml_training_data" AS
SELECT
  p."id" AS "pelanggan_id",
  p."idPelanggan" AS "id_pelanggan",
  p."nama",
  p."tarif",
  p."daya",
  p."lokasi",
  pm."bulan",
  pm."tahun",
  CASE
    WHEN pm."tahun" BETWEEN 1 AND 9999 AND pm."bulan" BETWEEN 1 AND 12
      THEN make_date(pm."tahun", pm."bulan", 1)
    ELSE NULL
  END AS "periode_tanggal",
  pm."kwh",
  pm."keterangan",
  CASE
    WHEN th."idPelanggan" IS NOT NULL THEN 1
    ELSE 0
  END AS "is_violation",
  th."tanggalTemuan" AS "tanggal_temuan",
  th."kategori" AS "kategori_temuan"
FROM "pelanggan" p
JOIN "pemakaian" pm
  ON pm."pelangganId" = p."id"
LEFT JOIN "to_historis" th
  ON th."idPelanggan" = p."idPelanggan";

CREATE TABLE IF NOT EXISTS "ml_customer_features" (
  "pelanggan_id" TEXT PRIMARY KEY,
  "id_pelanggan" TEXT NOT NULL UNIQUE,
  "nama" TEXT,
  "tarif" TEXT,
  "daya" INTEGER,
  "latest_bulan" INTEGER,
  "latest_tahun" INTEGER,
  "rata_kwh_3bln" DOUBLE PRECISION,
  "rata_kwh_6bln" DOUBLE PRECISION,
  "rata_kwh_12bln" DOUBLE PRECISION,
  "tren_kwh" DOUBLE PRECISION,
  "volatilitas_kwh" DOUBLE PRECISION,
  "penurunan_tiba2" INTEGER NOT NULL DEFAULT 0,
  "bulan_data" INTEGER NOT NULL DEFAULT 0,
  "is_violation" INTEGER NOT NULL DEFAULT 0,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ml_customer_features_pelanggan_id_fkey"
    FOREIGN KEY ("pelanggan_id") REFERENCES "pelanggan"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ml_customer_features_penurunan_tiba2_check"
    CHECK ("penurunan_tiba2" IN (0, 1)),
  CONSTRAINT "ml_customer_features_is_violation_check"
    CHECK ("is_violation" IN (0, 1))
);

CREATE INDEX IF NOT EXISTS "ml_customer_features_is_violation_idx"
  ON "ml_customer_features"("is_violation");

CREATE INDEX IF NOT EXISTS "ml_customer_features_computedAt_idx"
  ON "ml_customer_features"("computedAt");

CREATE OR REPLACE FUNCTION "refresh_ml_customer_features"()
RETURNS void
LANGUAGE sql
AS $$
  WITH ordered_usage AS (
    SELECT
      p."id" AS "pelanggan_id",
      p."idPelanggan" AS "id_pelanggan",
      p."nama",
      p."tarif",
      p."daya",
      pm."bulan",
      pm."tahun",
      pm."kwh",
      CASE
        WHEN pm."id" IS NULL THEN NULL
        ELSE (pm."tahun" * 12 + pm."bulan")
      END AS "month_index",
      ROW_NUMBER() OVER (
        PARTITION BY p."id"
        ORDER BY pm."tahun" DESC NULLS LAST, pm."bulan" DESC NULLS LAST
      ) AS "rn_desc",
      LAG(pm."kwh") OVER (
        PARTITION BY p."id"
        ORDER BY pm."tahun" ASC NULLS LAST, pm."bulan" ASC NULLS LAST
      ) AS "prev_kwh"
    FROM "pelanggan" p
    LEFT JOIN "pemakaian" pm
      ON pm."pelangganId" = p."id"
  ),
  aggregated AS (
    SELECT
      ou."pelanggan_id",
      ou."id_pelanggan",
      MAX(ou."nama") AS "nama",
      MAX(ou."tarif") AS "tarif",
      MAX(ou."daya") AS "daya",
      MAX(ou."month_index") AS "latest_month_index",
      AVG(ou."kwh") FILTER (WHERE ou."rn_desc" BETWEEN 1 AND 3) AS "rata_kwh_3bln",
      AVG(ou."kwh") FILTER (WHERE ou."rn_desc" BETWEEN 1 AND 6) AS "rata_kwh_6bln",
      AVG(ou."kwh") FILTER (WHERE ou."rn_desc" BETWEEN 1 AND 12) AS "rata_kwh_12bln",
      (
        AVG(ou."kwh") FILTER (WHERE ou."rn_desc" BETWEEN 1 AND 3)
        -
        AVG(ou."kwh") FILTER (WHERE ou."rn_desc" BETWEEN 4 AND 6)
      ) AS "tren_kwh",
      COALESCE(
        STDDEV_SAMP(ou."kwh") FILTER (WHERE ou."rn_desc" BETWEEN 1 AND 12),
        0
      ) AS "volatilitas_kwh",
      COALESCE(
        MAX(
          CASE
            WHEN ou."prev_kwh" > 0 AND ou."kwh" < (ou."prev_kwh" * 0.70) THEN 1
            ELSE 0
          END
        ),
        0
      ) AS "penurunan_tiba2",
      COUNT(ou."kwh") AS "bulan_data"
    FROM ordered_usage ou
    GROUP BY ou."pelanggan_id", ou."id_pelanggan"
  ),
  labeled AS (
    SELECT
      a.*,
      CASE
        WHEN th."idPelanggan" IS NOT NULL THEN 1
        ELSE 0
      END AS "is_violation"
    FROM aggregated a
    LEFT JOIN "to_historis" th
      ON th."idPelanggan" = a."id_pelanggan"
  )
  INSERT INTO "ml_customer_features" (
    "pelanggan_id",
    "id_pelanggan",
    "nama",
    "tarif",
    "daya",
    "latest_bulan",
    "latest_tahun",
    "rata_kwh_3bln",
    "rata_kwh_6bln",
    "rata_kwh_12bln",
    "tren_kwh",
    "volatilitas_kwh",
    "penurunan_tiba2",
    "bulan_data",
    "is_violation",
    "computedAt"
  )
  SELECT
    l."pelanggan_id",
    l."id_pelanggan",
    l."nama",
    l."tarif",
    l."daya",
    CASE
      WHEN l."latest_month_index" IS NULL THEN NULL
      ELSE ((l."latest_month_index" - 1) % 12) + 1
    END AS "latest_bulan",
    CASE
      WHEN l."latest_month_index" IS NULL THEN NULL
      ELSE ((l."latest_month_index" - 1) / 12)::INTEGER
    END AS "latest_tahun",
    l."rata_kwh_3bln",
    l."rata_kwh_6bln",
    l."rata_kwh_12bln",
    l."tren_kwh",
    l."volatilitas_kwh",
    l."penurunan_tiba2",
    l."bulan_data",
    l."is_violation",
    CURRENT_TIMESTAMP
  FROM labeled l
  ON CONFLICT ("pelanggan_id") DO UPDATE SET
    "id_pelanggan" = EXCLUDED."id_pelanggan",
    "nama" = EXCLUDED."nama",
    "tarif" = EXCLUDED."tarif",
    "daya" = EXCLUDED."daya",
    "latest_bulan" = EXCLUDED."latest_bulan",
    "latest_tahun" = EXCLUDED."latest_tahun",
    "rata_kwh_3bln" = EXCLUDED."rata_kwh_3bln",
    "rata_kwh_6bln" = EXCLUDED."rata_kwh_6bln",
    "rata_kwh_12bln" = EXCLUDED."rata_kwh_12bln",
    "tren_kwh" = EXCLUDED."tren_kwh",
    "volatilitas_kwh" = EXCLUDED."volatilitas_kwh",
    "penurunan_tiba2" = EXCLUDED."penurunan_tiba2",
    "bulan_data" = EXCLUDED."bulan_data",
    "is_violation" = EXCLUDED."is_violation",
    "computedAt" = EXCLUDED."computedAt";
$$;

SELECT "refresh_ml_customer_features"();
