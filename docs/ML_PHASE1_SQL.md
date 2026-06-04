# FASE 1 NALAR SQL

File ini berisi query manual untuk memahami data, mengecek kualitas data, dan menjalankan ulang refresh fitur NALAR.

Jalankan di Neon SQL Editor atau psql yang tersambung ke database aplikasi.

## 1. Cek Struktur Tabel

```sql
-- Daftar tabel/view public
SELECT table_schema, table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Daftar kolom, tipe data, nullable
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- Index yang tersedia
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

## 2. Cek Contoh Data

```sql
SELECT *
FROM "pelanggan"
ORDER BY "createdAt" DESC
LIMIT 10;

SELECT
  p."idPelanggan",
  p."nama",
  pm."bulan",
  pm."tahun",
  pm."kwh"
FROM "pemakaian" pm
JOIN "pelanggan" p ON p."id" = pm."pelangganId"
ORDER BY p."idPelanggan", pm."tahun" DESC, pm."bulan" DESC
LIMIT 50;

SELECT *
FROM "to_historis"
ORDER BY "createdAt" DESC
LIMIT 20;
```

## 3. Cek Kualitas Data

```sql
-- Ringkasan jumlah data utama
SELECT 'pelanggan' AS tabel, COUNT(*) AS jumlah FROM "pelanggan"
UNION ALL
SELECT 'pemakaian', COUNT(*) FROM "pemakaian"
UNION ALL
SELECT 'to_historis', COUNT(*) FROM "to_historis"
UNION ALL
SELECT 'target_operasi', COUNT(*) FROM "target_operasi";

-- Pelanggan dengan field penting kosong
SELECT
  COUNT(*) FILTER (WHERE "idPelanggan" IS NULL OR trim("idPelanggan") = '') AS idpel_kosong,
  COUNT(*) FILTER (WHERE "nama" IS NULL OR trim("nama") = '') AS nama_kosong,
  COUNT(*) FILTER (WHERE "tarif" IS NULL OR trim("tarif") = '') AS tarif_kosong,
  COUNT(*) FILTER (WHERE "lokasi" IS NULL OR trim("lokasi") = '') AS lokasi_kosong,
  COUNT(*) FILTER (WHERE "daya" IS NULL OR "daya" <= 0) AS daya_tidak_valid
FROM "pelanggan";

-- Duplikat ID pelanggan, seharusnya 0 karena ada unique index
SELECT "idPelanggan", COUNT(*) AS jumlah
FROM "pelanggan"
GROUP BY "idPelanggan"
HAVING COUNT(*) > 1;

-- Pemakaian dengan bulan/tahun/kWh tidak valid
SELECT *
FROM "pemakaian"
WHERE "bulan" NOT BETWEEN 1 AND 12
   OR "tahun" < 2000
   OR "kwh" IS NULL
   OR "kwh" < 0;

-- Duplikat pemakaian per pelanggan/bulan/tahun, seharusnya 0 karena ada unique index
SELECT "pelangganId", "bulan", "tahun", COUNT(*) AS jumlah
FROM "pemakaian"
GROUP BY "pelangganId", "bulan", "tahun"
HAVING COUNT(*) > 1;

-- Pelanggan tanpa data pemakaian
SELECT p."id", p."idPelanggan", p."nama"
FROM "pelanggan" p
LEFT JOIN "pemakaian" pm ON pm."pelangganId" = p."id"
WHERE pm."id" IS NULL
ORDER BY p."createdAt" DESC;

-- TO historis yang belum cocok dengan master pelanggan
SELECT th.*
FROM "to_historis" th
LEFT JOIN "pelanggan" p ON p."idPelanggan" = th."idPelanggan"
WHERE p."id" IS NULL
ORDER BY th."createdAt" DESC;

-- Gap bulan pemakaian per pelanggan
WITH usage_span AS (
  SELECT
    p."idPelanggan",
    COUNT(pm."id") AS bulan_data,
    MIN(pm."tahun" * 12 + pm."bulan") AS min_month_index,
    MAX(pm."tahun" * 12 + pm."bulan") AS max_month_index
  FROM "pelanggan" p
  LEFT JOIN "pemakaian" pm ON pm."pelangganId" = p."id"
  GROUP BY p."idPelanggan"
)
SELECT
  "idPelanggan",
  bulan_data,
  (max_month_index - min_month_index + 1) AS rentang_bulan,
  (max_month_index - min_month_index + 1) - bulan_data AS jumlah_gap
FROM usage_span
WHERE bulan_data > 0
  AND (max_month_index - min_month_index + 1) > bulan_data
ORDER BY jumlah_gap DESC, bulan_data ASC;

-- Nilai kWh ekstrem sederhana: lebih besar dari 5x rata-rata pelanggan tersebut
WITH stats AS (
  SELECT
    pm.*,
    AVG(pm."kwh") OVER (PARTITION BY pm."pelangganId") AS avg_kwh
  FROM "pemakaian" pm
)
SELECT
  p."idPelanggan",
  p."nama",
  s."bulan",
  s."tahun",
  s."kwh",
  s.avg_kwh
FROM stats s
JOIN "pelanggan" p ON p."id" = s."pelangganId"
WHERE s.avg_kwh > 0
  AND s."kwh" > s.avg_kwh * 5
ORDER BY s."kwh" DESC;
```

## 4. View Training Data

Migration `20260602000000_add_ml_phase1` membuat view:

```sql
SELECT *
FROM "ml_training_data"
LIMIT 100;
```

Kolom `is_violation` bernilai:

- `1`: pelanggan ada di `"to_historis"`
- `0`: pelanggan tidak ada di `"to_historis"`

## 5. Tabel Fitur Pelanggan

Migration juga membuat tabel:

```sql
SELECT *
FROM "ml_customer_features"
ORDER BY "computedAt" DESC
LIMIT 100;
```

Refresh ulang fitur setelah import data baru:

```sql
SELECT "refresh_ml_customer_features"();
```

Ringkasan label:

```sql
SELECT
  "is_violation",
  COUNT(*) AS jumlah_pelanggan,
  AVG("rata_kwh_12bln") AS avg_rata_kwh_12bln,
  AVG("volatilitas_kwh") AS avg_volatilitas_kwh,
  AVG("penurunan_tiba2") AS rasio_penurunan_tiba2
FROM "ml_customer_features"
GROUP BY "is_violation"
ORDER BY "is_violation" DESC;
```
