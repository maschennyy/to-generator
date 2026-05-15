-- CreateIndex
CREATE INDEX "import_jobs_userId_status_idx" ON "import_jobs"("userId", "status");

-- CreateIndex
CREATE INDEX "log_aktivitas_userId_idx" ON "log_aktivitas"("userId");

-- CreateIndex
CREATE INDEX "log_aktivitas_createdAt_idx" ON "log_aktivitas"("createdAt");

-- CreateIndex
CREATE INDEX "log_aktivitas_userId_createdAt_idx" ON "log_aktivitas"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "pelanggan_dataLengkap_idx" ON "pelanggan"("dataLengkap");

-- CreateIndex
CREATE INDEX "pelanggan_isToHistory_idx" ON "pelanggan"("isToHistory");

-- CreateIndex
CREATE INDEX "pemakaian_tahun_bulan_idx" ON "pemakaian"("tahun", "bulan");

-- CreateIndex
CREATE INDEX "pemakaian_pelangganId_idx" ON "pemakaian"("pelangganId");

-- CreateIndex
CREATE INDEX "target_operasi_status_idx" ON "target_operasi"("status");

-- CreateIndex
CREATE INDEX "target_operasi_tipeAnomali_idx" ON "target_operasi"("tipeAnomali");

-- CreateIndex
CREATE INDEX "target_operasi_periode_idx" ON "target_operasi"("periode");

-- CreateIndex
CREATE INDEX "target_operasi_pelangganId_idx" ON "target_operasi"("pelangganId");

-- CreateIndex
CREATE INDEX "target_operasi_createdAt_idx" ON "target_operasi"("createdAt");

-- CreateIndex
CREATE INDEX "target_operasi_status_tipeAnomali_idx" ON "target_operasi"("status", "tipeAnomali");
