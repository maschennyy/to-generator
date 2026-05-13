-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SPV', 'USER');

-- CreateEnum
CREATE TYPE "StatusTO" AS ENUM ('PENDING', 'DIPROSES', 'SELESAI', 'DIBATALKAN');

-- CreateEnum
CREATE TYPE "TipeAnomali" AS ENUM ('TURUN_DRASTIS', 'STAGNAN', 'NOL_PEMAKAIAN', 'LONJAKAN', 'POLA_TIDAK_WAJAR');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pelanggan" (
    "id" TEXT NOT NULL,
    "idPelanggan" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "tarif" TEXT NOT NULL,
    "daya" INTEGER NOT NULL,
    "lokasi" TEXT NOT NULL,
    "isToHistory" BOOLEAN NOT NULL DEFAULT false,
    "dataLengkap" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pelanggan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pemakaian" (
    "id" TEXT NOT NULL,
    "pelangganId" TEXT NOT NULL,
    "bulan" INTEGER NOT NULL,
    "tahun" INTEGER NOT NULL,
    "kwh" DOUBLE PRECISION NOT NULL,
    "keterangan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pemakaian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "target_operasi" (
    "id" TEXT NOT NULL,
    "pelangganId" TEXT NOT NULL,
    "tipeAnomali" "TipeAnomali" NOT NULL,
    "alasan" TEXT NOT NULL,
    "skor" DOUBLE PRECISION NOT NULL,
    "status" "StatusTO" NOT NULL DEFAULT 'PENDING',
    "periode" TEXT NOT NULL,
    "catatan" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "target_operasi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "temuan" (
    "id" TEXT NOT NULL,
    "namaPola" TEXT NOT NULL,
    "deskripsi" TEXT NOT NULL,
    "kriteria" JSONB NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "temuan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_aktivitas" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "aksi" TEXT NOT NULL,
    "detail" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_aktivitas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "to_historis" (
    "id" TEXT NOT NULL,
    "idPelanggan" TEXT NOT NULL,
    "tanggalTemuan" TIMESTAMP(3),
    "kategori" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "to_historis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "total" INTEGER NOT NULL DEFAULT 0,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "errorDetail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "pelanggan_idPelanggan_key" ON "pelanggan"("idPelanggan");

-- CreateIndex
CREATE UNIQUE INDEX "pemakaian_pelangganId_bulan_tahun_key" ON "pemakaian"("pelangganId", "bulan", "tahun");

-- CreateIndex
CREATE UNIQUE INDEX "temuan_namaPola_key" ON "temuan"("namaPola");

-- CreateIndex
CREATE UNIQUE INDEX "to_historis_idPelanggan_key" ON "to_historis"("idPelanggan");

-- AddForeignKey
ALTER TABLE "pemakaian" ADD CONSTRAINT "pemakaian_pelangganId_fkey" FOREIGN KEY ("pelangganId") REFERENCES "pelanggan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "target_operasi" ADD CONSTRAINT "target_operasi_pelangganId_fkey" FOREIGN KEY ("pelangganId") REFERENCES "pelanggan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "target_operasi" ADD CONSTRAINT "target_operasi_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_aktivitas" ADD CONSTRAINT "log_aktivitas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
