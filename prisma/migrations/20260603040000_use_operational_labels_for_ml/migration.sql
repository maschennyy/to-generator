CREATE OR REPLACE VIEW "ml_training_data" AS
WITH latest_operational_label AS (
  SELECT DISTINCT ON (ho."pelangganId")
    ho."pelangganId",
    ho."hasil",
    ho."tanggalOperasi",
    ho."kategoriTemuan"
  FROM "hasil_operasi" ho
  WHERE ho."hasil" IN ('NORMAL', 'PELANGGARAN')
  ORDER BY ho."pelangganId", ho."tanggalOperasi" DESC NULLS LAST, ho."updatedAt" DESC
)
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
    WHEN lol."hasil" = 'PELANGGARAN' THEN 1
    WHEN lol."hasil" = 'NORMAL' THEN 0
    WHEN th."idPelanggan" IS NOT NULL THEN 1
    ELSE 0
  END AS "is_violation",
  COALESCE(lol."tanggalOperasi", th."tanggalTemuan") AS "tanggal_temuan",
  COALESCE(lol."kategoriTemuan", th."kategori") AS "kategori_temuan"
FROM "pelanggan" p
JOIN "pemakaian" pm
  ON pm."pelangganId" = p."id"
LEFT JOIN latest_operational_label lol
  ON lol."pelangganId" = p."id"
LEFT JOIN "to_historis" th
  ON th."idPelanggan" = p."idPelanggan"
WHERE
  (
    lol."hasil" IS NULL
    OR lol."hasil" = 'NORMAL'
    OR lol."tanggalOperasi" IS NULL
    OR (
      pm."tahun" BETWEEN 1 AND 9999
      AND pm."bulan" BETWEEN 1 AND 12
      AND make_date(pm."tahun", pm."bulan", 1) < date_trunc('month', lol."tanggalOperasi")::date
    )
  )
  AND (
    lol."hasil" IS NOT NULL
    OR th."idPelanggan" IS NULL
    OR th."tanggalTemuan" IS NULL
    OR (
      pm."tahun" BETWEEN 1 AND 9999
      AND pm."bulan" BETWEEN 1 AND 12
      AND make_date(pm."tahun", pm."bulan", 1) < date_trunc('month', th."tanggalTemuan")::date
    )
  );

CREATE OR REPLACE FUNCTION "refresh_ml_customer_features"()
RETURNS void
LANGUAGE sql
AS $$
  WITH latest_operational_label AS (
    SELECT DISTINCT ON (ho."pelangganId")
      ho."pelangganId",
      ho."hasil",
      ho."tanggalOperasi",
      ho."kategoriTemuan"
    FROM "hasil_operasi" ho
    WHERE ho."hasil" IN ('NORMAL', 'PELANGGARAN')
    ORDER BY ho."pelangganId", ho."tanggalOperasi" DESC NULLS LAST, ho."updatedAt" DESC
  ),
  eligible_usage AS (
    SELECT
      p."id" AS "pelanggan_id",
      p."idPelanggan" AS "id_pelanggan",
      p."nama",
      p."tarif",
      p."daya",
      pm."bulan",
      pm."tahun",
      pm."kwh",
      COALESCE(lol."tanggalOperasi", th."tanggalTemuan") AS "label_date",
      CASE
        WHEN pm."tahun" BETWEEN 1 AND 9999 AND pm."bulan" BETWEEN 1 AND 12
          THEN make_date(pm."tahun", pm."bulan", 1)
        ELSE NULL
      END AS "periode_tanggal",
      CASE
        WHEN lol."hasil" = 'PELANGGARAN' THEN 1
        WHEN lol."hasil" = 'NORMAL' THEN 0
        WHEN th."idPelanggan" IS NOT NULL THEN 1
        ELSE 0
      END AS "is_violation"
    FROM "pelanggan" p
    LEFT JOIN latest_operational_label lol
      ON lol."pelangganId" = p."id"
    LEFT JOIN "to_historis" th
      ON th."idPelanggan" = p."idPelanggan"
    LEFT JOIN "pemakaian" pm
      ON pm."pelangganId" = p."id"
  ),
  ordered_usage AS (
    SELECT
      eu."pelanggan_id",
      eu."id_pelanggan",
      eu."nama",
      eu."tarif",
      eu."daya",
      eu."bulan",
      eu."tahun",
      eu."kwh",
      eu."is_violation",
      CASE
        WHEN eu."bulan" IS NULL OR eu."tahun" IS NULL THEN NULL
        ELSE (eu."tahun" * 12 + eu."bulan")
      END AS "month_index",
      ROW_NUMBER() OVER (
        PARTITION BY eu."pelanggan_id"
        ORDER BY eu."tahun" DESC NULLS LAST, eu."bulan" DESC NULLS LAST
      ) AS "rn_desc",
      LAG(eu."kwh") OVER (
        PARTITION BY eu."pelanggan_id"
        ORDER BY eu."tahun" ASC NULLS LAST, eu."bulan" ASC NULLS LAST
      ) AS "prev_kwh"
    FROM eligible_usage eu
    WHERE
      eu."kwh" IS NULL
      OR eu."is_violation" = 0
      OR eu."label_date" IS NULL
      OR (
        eu."periode_tanggal" IS NOT NULL
        AND eu."periode_tanggal" < date_trunc('month', eu."label_date")::date
      )
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
      COUNT(ou."kwh") AS "bulan_data",
      MAX(ou."is_violation") AS "is_violation"
    FROM ordered_usage ou
    GROUP BY ou."pelanggan_id", ou."id_pelanggan"
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
    a."pelanggan_id",
    a."id_pelanggan",
    a."nama",
    a."tarif",
    a."daya",
    CASE
      WHEN a."latest_month_index" IS NULL THEN NULL
      ELSE ((a."latest_month_index" - 1) % 12) + 1
    END AS "latest_bulan",
    CASE
      WHEN a."latest_month_index" IS NULL THEN NULL
      ELSE ((a."latest_month_index" - 1) / 12)::INTEGER
    END AS "latest_tahun",
    a."rata_kwh_3bln",
    a."rata_kwh_6bln",
    a."rata_kwh_12bln",
    a."tren_kwh",
    a."volatilitas_kwh",
    a."penurunan_tiba2",
    a."bulan_data",
    COALESCE(a."is_violation", 0),
    CURRENT_TIMESTAMP
  FROM aggregated a
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
