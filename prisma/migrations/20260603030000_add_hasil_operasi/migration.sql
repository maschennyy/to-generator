DO $$ BEGIN
  CREATE TYPE "HasilOperasiStatus" AS ENUM (
    'BELUM_DIPERIKSA',
    'NORMAL',
    'PELANGGARAN',
    'TIDAK_DITEMUKAN'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "hasil_operasi" (
  "id" TEXT NOT NULL,
  "targetOperasiId" TEXT NOT NULL,
  "pelangganId" TEXT NOT NULL,
  "hasil" "HasilOperasiStatus" NOT NULL DEFAULT 'BELUM_DIPERIKSA',
  "tanggalOperasi" TIMESTAMP(3),
  "kategoriTemuan" TEXT,
  "catatan" TEXT,
  "petugasId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "hasil_operasi_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "hasil_operasi_targetOperasiId_key"
ON "hasil_operasi" ("targetOperasiId");

CREATE INDEX IF NOT EXISTS "hasil_operasi_hasil_idx"
ON "hasil_operasi" ("hasil");

CREATE INDEX IF NOT EXISTS "hasil_operasi_tanggalOperasi_idx"
ON "hasil_operasi" ("tanggalOperasi");

CREATE INDEX IF NOT EXISTS "hasil_operasi_pelangganId_idx"
ON "hasil_operasi" ("pelangganId");

DO $$ BEGIN
  ALTER TABLE "hasil_operasi"
  ADD CONSTRAINT "hasil_operasi_targetOperasiId_fkey"
  FOREIGN KEY ("targetOperasiId") REFERENCES "target_operasi"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "hasil_operasi"
  ADD CONSTRAINT "hasil_operasi_pelangganId_fkey"
  FOREIGN KEY ("pelangganId") REFERENCES "pelanggan"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "hasil_operasi"
  ADD CONSTRAINT "hasil_operasi_petugasId_fkey"
  FOREIGN KEY ("petugasId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
