CREATE TABLE IF NOT EXISTS "ml_model_history" (
  "id" BIGSERIAL PRIMARY KEY,
  "tanggal_train" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "jumlah_data" INTEGER NOT NULL,
  "jumlah_temuan" INTEGER NOT NULL DEFAULT 0,
  "jumlah_normal" INTEGER NOT NULL DEFAULT 0,
  "precision" DOUBLE PRECISION,
  "recall" DOUBLE PRECISION,
  "f1_score" DOUBLE PRECISION,
  "model_version" INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "ml_model_history_tanggal_train_idx"
ON "ml_model_history" ("tanggal_train");
