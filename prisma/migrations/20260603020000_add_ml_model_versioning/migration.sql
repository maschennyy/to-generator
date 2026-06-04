ALTER TABLE "ml_model_history"
ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'accepted',
ADD COLUMN IF NOT EXISTS "accepted" BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS "model_path" TEXT,
ADD COLUMN IF NOT EXISTS "active_model_path" TEXT,
ADD COLUMN IF NOT EXISTS "previous_model_version" INTEGER,
ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT,
ADD COLUMN IF NOT EXISTS "f1_delta" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "precision_delta" DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS "ml_model_history_status_idx"
ON "ml_model_history" ("status");

CREATE INDEX IF NOT EXISTS "ml_model_history_accepted_idx"
ON "ml_model_history" ("accepted");
