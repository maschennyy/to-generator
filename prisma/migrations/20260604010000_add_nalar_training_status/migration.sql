CREATE TABLE IF NOT EXISTS "nalar_training_status" (
  "id" INTEGER PRIMARY KEY,
  "state" TEXT NOT NULL DEFAULT 'idle',
  "running" BOOLEAN NOT NULL DEFAULT FALSE,
  "pending_retrain" BOOLEAN NOT NULL DEFAULT FALSE,
  "last_error" TEXT,
  "last_summary" JSONB,
  "started_at" TEXT,
  "finished_at" TEXT,
  "duration_seconds" DOUBLE PRECISION,
  "updated_at" TEXT NOT NULL DEFAULT ''
);

INSERT INTO "nalar_training_status" ("id", "updated_at")
VALUES (1, '')
ON CONFLICT ("id") DO NOTHING;
