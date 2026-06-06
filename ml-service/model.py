import os
from dataclasses import dataclass
from typing import Any

import joblib
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import precision_recall_fscore_support
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

load_dotenv()

FEATURE_COLUMNS = [
    "rata_kwh_3bln",
    "rata_kwh_6bln",
    "rata_kwh_12bln",
    "tren_kwh",
    "volatilitas_kwh",
    "penurunan_tiba2",
    "bulan_data",
]

FEATURE_LABELS = {
    "rata_kwh_3bln": "rata-rata kWh 3 bulan terakhir",
    "rata_kwh_6bln": "rata-rata kWh 6 bulan terakhir",
    "rata_kwh_12bln": "rata-rata kWh 12 bulan terakhir",
    "tren_kwh": "tren kWh berubah tajam",
    "volatilitas_kwh": "pemakaian kWh tidak stabil",
    "penurunan_tiba2": "terdapat penurunan tiba-tiba > 30%",
    "bulan_data": "jumlah data bulan terbatas",
}


class MLServiceError(Exception):
    """Human-readable error for API responses."""


@dataclass
class TrainingSummary:
    total_rows: int
    violation_rows: int
    non_violation_rows: int
    model_version: int
    precision: float
    recall: float
    f1_score: float
    accepted: bool = True
    status: str = "accepted"
    model_path: str | None = None
    active_model_path: str | None = None
    previous_model_version: int | None = None
    rejection_reason: str | None = None
    f1_delta: float | None = None
    precision_delta: float | None = None


class RiskModelService:
    def __init__(self) -> None:
        self.engine = self._create_engine()
        self.model_path = os.getenv("ML_MODEL_PATH", "/app/models/risk-model.joblib")
        self.rf_pipeline: Pipeline | None = None
        self.iso_pipeline: Pipeline | None = None
        self.feature_medians: pd.Series | None = None
        self.rf_importances: dict[str, float] = {}
        self.model_version = 0
        self.last_training_summary: TrainingSummary | None = None
        self.load_model()

    def _create_engine(self) -> Engine:
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            raise MLServiceError(
                "DATABASE_URL belum diatur. Salin ml-service/.env.example menjadi .env dan isi DATABASE_URL."
            )
        if database_url.startswith("postgresql://"):
            database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)
        return create_engine(database_url, pool_pre_ping=True)

    def refresh_features(self) -> None:
        with self.engine.begin() as conn:
            conn.execute(text('SELECT "refresh_ml_customer_features"();'))

    def load_features(self, training_only: bool = False) -> pd.DataFrame:
        where_clause = 'WHERE "bulan_data" > 0' if training_only else ""
        query = text(
            f"""
            SELECT
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
            FROM "ml_customer_features"
            {where_clause}
            ORDER BY "id_pelanggan"
            """
        )
        return pd.read_sql_query(query, self.engine)

    def ensure_history_table(self) -> None:
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
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
                    """
                )
            )
            conn.execute(text('ALTER TABLE "ml_model_history" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT \'accepted\';'))
            conn.execute(text('ALTER TABLE "ml_model_history" ADD COLUMN IF NOT EXISTS "accepted" BOOLEAN NOT NULL DEFAULT TRUE;'))
            conn.execute(text('ALTER TABLE "ml_model_history" ADD COLUMN IF NOT EXISTS "model_path" TEXT;'))
            conn.execute(text('ALTER TABLE "ml_model_history" ADD COLUMN IF NOT EXISTS "active_model_path" TEXT;'))
            conn.execute(text('ALTER TABLE "ml_model_history" ADD COLUMN IF NOT EXISTS "previous_model_version" INTEGER;'))
            conn.execute(text('ALTER TABLE "ml_model_history" ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT;'))
            conn.execute(text('ALTER TABLE "ml_model_history" ADD COLUMN IF NOT EXISTS "f1_delta" DOUBLE PRECISION;'))
            conn.execute(text('ALTER TABLE "ml_model_history" ADD COLUMN IF NOT EXISTS "precision_delta" DOUBLE PRECISION;'))
            conn.execute(
                text(
                    """
                    CREATE INDEX IF NOT EXISTS "ml_model_history_tanggal_train_idx"
                    ON "ml_model_history" ("tanggal_train");
                    """
                )
            )

    def train(self) -> TrainingSummary:
        with self.engine.connect() as lock_conn:
            if not self._try_acquire_training_lock(lock_conn):
                raise MLServiceError(
                    "Training model sedang berjalan di instance lain. "
                    "Permintaan ini dilewati agar model tidak dilatih bersamaan."
                )
            try:
                return self._train_unlocked()
            finally:
                self._release_training_lock(lock_conn)

    def _train_unlocked(self) -> TrainingSummary:
        self.refresh_features()
        df = self.load_features(training_only=True)

        if df.empty:
            raise MLServiceError(
                "Data fitur NALAR masih kosong. Pastikan tabel pemakaian pelanggan sudah berisi data kWh."
            )

        violation_rows = int((df["is_violation"] == 1).sum())
        non_violation_rows = int((df["is_violation"] == 0).sum())

        if violation_rows < 10:
            raise MLServiceError(
                f"Data training terlalu sedikit: hanya ada {violation_rows} pelanggan temuan. "
                "Minimal dibutuhkan 10 temuan agar Random Forest bisa belajar pola pelanggaran."
            )
        if non_violation_rows < 10:
            raise MLServiceError(
                f"Data pembanding terlalu sedikit: hanya ada {non_violation_rows} pelanggan non-temuan. "
                "Minimal dibutuhkan 10 pelanggan non-temuan."
            )

        x = df[FEATURE_COLUMNS].copy()
        y = df["is_violation"].astype(int)

        candidate_feature_medians = x.median(numeric_only=True)

        rf_pipeline = self._build_rf_pipeline()
        x_train, x_test, y_train, y_test = train_test_split(
            x,
            y,
            test_size=0.25,
            stratify=y,
            random_state=self._random_state(),
        )
        rf_pipeline.fit(x_train, y_train)
        predicted = rf_pipeline.predict(x_test)
        precision, recall, f1_score, _ = precision_recall_fscore_support(
            y_test,
            predicted,
            average="binary",
            zero_division=0,
        )

        candidate_rf_pipeline = self._build_rf_pipeline()
        candidate_rf_pipeline.fit(x, y)

        contamination = self._contamination()
        candidate_iso_pipeline = Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="median")),
                ("scaler", StandardScaler()),
                (
                    "model",
                    IsolationForest(
                        n_estimators=250,
                        contamination=contamination,
                        random_state=self._random_state(),
                    ),
                ),
            ]
        )
        candidate_iso_pipeline.fit(x)

        rf_model = candidate_rf_pipeline.named_steps["model"]
        candidate_rf_importances = {
            feature: float(importance)
            for feature, importance in zip(FEATURE_COLUMNS, rf_model.feature_importances_)
        }

        candidate_version = self._next_model_version()
        candidate_path = self._versioned_model_path(candidate_version)
        active_path = self.model_path
        previous_summary = self.last_training_summary
        previous_model_version = self.model_version if self.model_version > 0 else None

        summary = TrainingSummary(
            total_rows=len(df),
            violation_rows=violation_rows,
            non_violation_rows=non_violation_rows,
            model_version=candidate_version,
            precision=round(float(precision), 4),
            recall=round(float(recall), 4),
            f1_score=round(float(f1_score), 4),
            model_path=candidate_path,
            active_model_path=active_path,
            previous_model_version=previous_model_version,
        )

        self._apply_acceptance_policy(summary, previous_summary)
        candidate_payload = self._model_payload(
            candidate_rf_pipeline,
            candidate_iso_pipeline,
            candidate_feature_medians,
            candidate_rf_importances,
            candidate_version,
            summary,
        )
        self._save_payload(candidate_path, candidate_payload)

        if summary.accepted:
            self.rf_pipeline = candidate_rf_pipeline
            self.iso_pipeline = candidate_iso_pipeline
            self.feature_medians = candidate_feature_medians
            self.rf_importances = candidate_rf_importances
            self.model_version = candidate_version
            self.last_training_summary = summary
            self._save_payload(active_path, candidate_payload)

        self.save_model_history(summary)
        return summary

    def _save_payload(self, path: str, payload: dict[str, Any]) -> None:
        model_dir = os.path.dirname(path)
        if model_dir:
            os.makedirs(model_dir, exist_ok=True)

        joblib.dump(payload, path)

    def load_model(self) -> None:
        if not os.path.exists(self.model_path):
            return

        try:
            payload = joblib.load(self.model_path)
            self.rf_pipeline = payload.get("rf_pipeline")
            self.iso_pipeline = payload.get("iso_pipeline")
            self.feature_medians = payload.get("feature_medians")
            self.rf_importances = payload.get("rf_importances") or {}
            self.model_version = int(payload.get("model_version") or 0)
            self.last_training_summary = payload.get("last_training_summary")
        except Exception:
            self.rf_pipeline = None
            self.iso_pipeline = None
            self.feature_medians = None
            self.rf_importances = {}
            self.model_version = 0
            self.last_training_summary = None

    def save_model_history(self, summary: TrainingSummary) -> None:
        self.ensure_history_table()
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO "ml_model_history" (
                      "jumlah_data",
                      "jumlah_temuan",
                      "jumlah_normal",
                      "precision",
                      "recall",
                      "f1_score",
                      "model_version",
                      "status",
                      "accepted",
                      "model_path",
                      "active_model_path",
                      "previous_model_version",
                      "rejection_reason",
                      "f1_delta",
                      "precision_delta"
                    )
                    VALUES (
                      :jumlah_data,
                      :jumlah_temuan,
                      :jumlah_normal,
                      :precision,
                      :recall,
                      :f1_score,
                      :model_version,
                      :status,
                      :accepted,
                      :model_path,
                      :active_model_path,
                      :previous_model_version,
                      :rejection_reason,
                      :f1_delta,
                      :precision_delta
                    )
                    """
                ),
                {
                    "jumlah_data": summary.total_rows,
                    "jumlah_temuan": summary.violation_rows,
                    "jumlah_normal": summary.non_violation_rows,
                    "precision": summary.precision,
                    "recall": summary.recall,
                    "f1_score": summary.f1_score,
                    "model_version": summary.model_version,
                    "status": summary.status,
                    "accepted": summary.accepted,
                    "model_path": summary.model_path,
                    "active_model_path": summary.active_model_path,
                    "previous_model_version": summary.previous_model_version,
                    "rejection_reason": summary.rejection_reason,
                    "f1_delta": summary.f1_delta,
                    "precision_delta": summary.precision_delta,
                },
            )

    def model_history(self, limit: int = 50) -> list[dict[str, Any]]:
        self.ensure_history_table()
        safe_limit = min(max(limit, 1), 100)
        query = text(
            """
            SELECT
              "id",
              "tanggal_train",
              "jumlah_data",
              "jumlah_temuan",
              "jumlah_normal",
              "precision",
              "recall",
              "f1_score",
              "model_version",
              "status",
              "accepted",
              "rejection_reason",
              "f1_delta",
              "precision_delta"
            FROM "ml_model_history"
            ORDER BY "tanggal_train" DESC
            LIMIT :limit
            """
        )
        df = pd.read_sql_query(query, self.engine, params={"limit": safe_limit})
        return [
            {
                "id": int(row["id"]),
                "tanggal_train": row["tanggal_train"].isoformat()
                if hasattr(row["tanggal_train"], "isoformat")
                else row["tanggal_train"],
                "jumlah_data": self._none_if_nan(row["jumlah_data"]),
                "jumlah_temuan": self._none_if_nan(row["jumlah_temuan"]),
                "jumlah_normal": self._none_if_nan(row["jumlah_normal"]),
                "precision": self._none_if_nan(row["precision"]),
                "recall": self._none_if_nan(row["recall"]),
                "f1_score": self._none_if_nan(row["f1_score"]),
                "model_version": self._none_if_nan(row["model_version"]),
                "status": row.get("status"),
                "accepted": bool(row.get("accepted")),
                "rejection_reason": self._none_if_nan(row.get("rejection_reason")),
                "f1_delta": self._none_if_nan(row.get("f1_delta")),
                "precision_delta": self._none_if_nan(row.get("precision_delta")),
            }
            for _, row in df.iterrows()
        ]

    def _next_model_version(self) -> int:
        self.ensure_history_table()
        with self.engine.connect() as conn:
            max_version = conn.execute(
                text('SELECT COALESCE(MAX("model_version"), 0) FROM "ml_model_history";')
            ).scalar()
        return max(int(max_version or 0), self.model_version) + 1

    def _try_acquire_training_lock(self, conn) -> bool:
        acquired = conn.execute(
            text("SELECT pg_try_advisory_lock(:lock_key);"),
            {"lock_key": self._training_lock_key()},
        ).scalar()
        return bool(acquired)

    def _release_training_lock(self, conn) -> None:
        conn.execute(
            text("SELECT pg_advisory_unlock(:lock_key);"),
            {"lock_key": self._training_lock_key()},
        )

    def _training_lock_key(self) -> int:
        raw = os.getenv("ML_TRAINING_LOCK_KEY", "70220260603")
        try:
            return int(raw)
        except ValueError:
            return 70220260603

    def feature_importance(self) -> list[dict[str, Any]]:
        if not self.rf_importances:
            return []
        importances = sorted(
            self.rf_importances.items(),
            key=lambda item: item[1],
            reverse=True,
        )
        return [
            {
                "feature": feature,
                "label": FEATURE_LABELS.get(feature, feature),
                "importance": round(float(importance), 6),
            }
            for feature, importance in importances
        ]

    def score_all(self, limit: int | None = None, offset: int = 0) -> dict[str, Any]:
        self._ensure_trained()
        df = self.load_features()
        if df.empty:
            return {"data": [], "total": 0, "limit": limit or 0, "offset": offset}

        scored = self._score_dataframe(df)
        scored = scored.sort_values("risk_score", ascending=False)
        total = int(len(scored))
        if limit is not None:
            scored = scored.iloc[offset:offset + limit]
        elif offset > 0:
            scored = scored.iloc[offset:]

        return {
            "data": [self._row_to_response(row) for _, row in scored.iterrows()],
            "total": total,
            "limit": limit or total,
            "offset": offset,
        }

    def score_one(self, pelanggan_id: str) -> dict[str, Any]:
        self._ensure_trained()
        df = self.load_features()
        scored = self._score_dataframe(df)
        match = scored[
            (scored["pelanggan_id"] == pelanggan_id)
            | (scored["id_pelanggan"] == pelanggan_id)
        ]
        if match.empty:
            raise MLServiceError(
                f"Pelanggan '{pelanggan_id}' tidak ditemukan di ml_customer_features."
            )

        return self._row_to_response(match.iloc[0])

    def health(self) -> dict[str, Any]:
        try:
            with self.engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            db_ok = True
        except Exception:
            db_ok = False

        return {
            "status": "ok" if db_ok else "degraded",
            "database_connected": db_ok,
            "trained": self.rf_pipeline is not None and self.iso_pipeline is not None,
            "model_version": self.model_version,
            "model_path": self.model_path,
            "last_training_summary": (
                self.last_training_summary.__dict__
                if self.last_training_summary
                else None
            ),
        }

    def _score_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        if self.rf_pipeline is None or self.iso_pipeline is None:
            raise MLServiceError("Model belum dilatih. Jalankan POST /train terlebih dahulu.")

        x = df[FEATURE_COLUMNS].copy()

        rf_proba = self.rf_pipeline.predict_proba(x)[:, 1]

        iso_model = self.iso_pipeline.named_steps["model"]
        iso_raw = self.iso_pipeline.decision_function(x)
        iso_scores = -iso_raw
        iso_min = float(np.min(iso_scores))
        iso_max = float(np.max(iso_scores))
        if iso_max > iso_min:
            iso_normalized = (iso_scores - iso_min) / (iso_max - iso_min)
        else:
            iso_normalized = np.zeros_like(iso_scores)

        risk_score = (0.70 * rf_proba + 0.30 * iso_normalized) * 100

        result = df.copy()
        result["rf_score"] = np.round(rf_proba * 100, 2)
        result["anomaly_score"] = np.round(iso_normalized * 100, 2)
        result["risk_score"] = np.round(np.clip(risk_score, 0, 100), 2)
        top_factors = [self._top_factors(row) for _, row in result.iterrows()]
        result["top_factors"] = top_factors
        result["top_reason"] = [
            factors[0]["reason"] if factors else "Model menemukan pola kWh yang perlu ditinjau lebih lanjut."
            for factors in top_factors
        ]
        result["is_anomaly"] = self.iso_pipeline.predict(x)
        result["is_anomaly"] = result["is_anomaly"].map({-1: True, 1: False})
        return result

    def _top_factors(self, row: pd.Series, limit: int = 3) -> list[dict[str, Any]]:
        if self.feature_medians is None:
            return []

        contributions: list[dict[str, Any]] = []
        for feature in FEATURE_COLUMNS:
            value = row.get(feature)
            median = self.feature_medians.get(feature, 0)
            if pd.isna(value) or pd.isna(median):
                distance = 0.0
            else:
                scale = abs(float(median)) + 1.0
                distance = abs(float(value) - float(median)) / scale

            importance = self.rf_importances.get(feature, 0.05)
            contribution = distance * (importance + 0.05)
            contributions.append(
                {
                    "feature": feature,
                    "label": FEATURE_LABELS.get(feature, feature),
                    "value": self._none_if_nan(value),
                    "baseline": self._none_if_nan(median),
                    "importance": round(float(importance), 6),
                    "contribution": round(float(contribution), 6),
                    "reason": self._feature_reason(feature, value, median, row),
                }
            )

        contributions.sort(key=lambda item: item["contribution"], reverse=True)
        return contributions[:limit]

    def _feature_reason(self, feature: str, value: Any, median: Any, row: pd.Series | None = None) -> str:
        if feature == "penurunan_tiba2" and int(value or 0) == 1:
            return "Ada minimal satu bulan pemakaian yang turun lebih dari 30% dibanding bulan sebelumnya."

        if feature == "tren_kwh" and pd.notna(value):
            amount = abs(round(float(value)))
            direction = "turun" if float(value) < 0 else "naik"
            percent_text = ""
            if row is not None:
                recent_avg = row.get("rata_kwh_3bln")
                if pd.notna(recent_avg):
                    previous_avg = float(recent_avg) - float(value)
                    if previous_avg > 0:
                        percent = abs(float(value)) / previous_avg * 100
                        percent_text = f" {round(percent)}%"
            return (
                f"Rata-rata kWh 3 bulan terbaru {direction}{percent_text}, sekitar "
                f"{self._format_number(amount)} kWh dibanding 3 bulan sebelumnya."
            )

        if feature == "volatilitas_kwh" and pd.notna(value):
            percent_text = ""
            if pd.notna(median) and float(median) > 0:
                percent = (float(value) - float(median)) / float(median) * 100
                if percent > 0:
                    percent_text = f", sekitar {round(percent)}% di atas baseline"
            return f"Pemakaian 12 bulan tidak stabil dengan deviasi sekitar {self._format_number(round(float(value)))} kWh{percent_text}."

        if feature == "bulan_data" and pd.notna(value):
            return f"Data pemakaian tersedia {int(value)} bulan, sehingga keyakinan model perlu ditinjau manual."

        if feature.startswith("rata_kwh") and pd.notna(value) and pd.notna(median):
            diff = float(value) - float(median)
            direction = "lebih tinggi" if diff > 0 else "lebih rendah"
            percent_text = ""
            if float(median) > 0:
                percent_text = f" ({round(abs(diff) / float(median) * 100)}%)"
            return (
                f"{FEATURE_LABELS.get(feature, feature)} {direction}{percent_text}, sekitar "
                f"{self._format_number(abs(round(diff)))} kWh dari baseline pelanggan lain."
            )

        return FEATURE_LABELS.get(feature, feature)

    def _row_to_response(self, row: pd.Series) -> dict[str, Any]:
        return {
            "pelanggan_id": row["pelanggan_id"],
            "id_pelanggan": row["id_pelanggan"],
            "nama": row.get("nama"),
            "tarif": row.get("tarif"),
            "daya": self._none_if_nan(row.get("daya")),
            "latest_bulan": self._none_if_nan(row.get("latest_bulan")),
            "latest_tahun": self._none_if_nan(row.get("latest_tahun")),
            "risk_score": self._none_if_nan(row.get("risk_score")),
            "rf_score": self._none_if_nan(row.get("rf_score")),
            "anomaly_score": self._none_if_nan(row.get("anomaly_score")),
            "is_anomaly": bool(row.get("is_anomaly")),
            "is_violation": int(row.get("is_violation") or 0),
            "top_reason": row.get("top_reason"),
            "top_factors": row.get("top_factors") or [],
            "features": {
                feature: self._none_if_nan(row.get(feature))
                for feature in FEATURE_COLUMNS
            },
        }

    def _ensure_trained(self) -> None:
        if self.rf_pipeline is None or self.iso_pipeline is None:
            raise MLServiceError(
                "Model belum siap. Jalankan POST /train dan tunggu training background selesai."
            )

    def _build_rf_pipeline(self) -> Pipeline:
        return Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="median")),
                (
                    "model",
                    RandomForestClassifier(
                        n_estimators=300,
                        max_depth=8,
                        min_samples_leaf=2,
                        class_weight="balanced",
                        random_state=self._random_state(),
                    ),
                ),
            ]
        )

    def _model_payload(
        self,
        rf_pipeline: Pipeline,
        iso_pipeline: Pipeline,
        feature_medians: pd.Series,
        rf_importances: dict[str, float],
        model_version: int,
        summary: TrainingSummary,
    ) -> dict[str, Any]:
        return {
            "rf_pipeline": rf_pipeline,
            "iso_pipeline": iso_pipeline,
            "feature_medians": feature_medians,
            "rf_importances": rf_importances,
            "model_version": model_version,
            "last_training_summary": summary,
        }

    def _apply_acceptance_policy(
        self,
        summary: TrainingSummary,
        previous_summary: TrainingSummary | None,
    ) -> None:
        if previous_summary is None:
            return

        summary.f1_delta = round(summary.f1_score - previous_summary.f1_score, 4)
        summary.precision_delta = round(summary.precision - previous_summary.precision, 4)

        if summary.f1_delta < -self._max_f1_drop():
            summary.accepted = False
            summary.status = "rejected"
            summary.rejection_reason = (
                f"F1-score turun {abs(summary.f1_delta):.2f}, melebihi batas "
                f"{self._max_f1_drop():.2f}. Model aktif tetap versi {previous_summary.model_version}."
            )
            return

        if summary.precision_delta < -self._max_precision_drop():
            summary.accepted = False
            summary.status = "rejected"
            summary.rejection_reason = (
                f"Precision turun {abs(summary.precision_delta):.2f}, melebihi batas "
                f"{self._max_precision_drop():.2f}. Model aktif tetap versi {previous_summary.model_version}."
            )

    def _versioned_model_path(self, model_version: int) -> str:
        model_dir = os.path.dirname(self.model_path) or "."
        base_name = os.path.basename(self.model_path)
        stem, extension = os.path.splitext(base_name)
        safe_extension = extension or ".joblib"
        return os.path.join(model_dir, f"{stem}-v{model_version}{safe_extension}")

    def _max_f1_drop(self) -> float:
        return self._bounded_float_env("ML_MAX_F1_DROP", 0.05, 0.0, 1.0)

    def _max_precision_drop(self) -> float:
        return self._bounded_float_env("ML_MAX_PRECISION_DROP", 0.10, 0.0, 1.0)

    def _bounded_float_env(
        self,
        name: str,
        default: float,
        minimum: float,
        maximum: float,
    ) -> float:
        raw = os.getenv(name, str(default))
        try:
            value = float(raw)
        except ValueError:
            return default
        return min(max(value, minimum), maximum)

    def _contamination(self) -> float:
        raw = os.getenv("ML_CONTAMINATION", "0.10")
        try:
            value = float(raw)
        except ValueError:
            return 0.10
        return min(max(value, 0.01), 0.50)

    def _random_state(self) -> int:
        raw = os.getenv("ML_RANDOM_STATE", "42")
        try:
            return int(raw)
        except ValueError:
            return 42

    @staticmethod
    def _none_if_nan(value: Any) -> Any:
        if pd.isna(value):
            return None
        if isinstance(value, np.integer):
            return int(value)
        if isinstance(value, np.floating):
            return float(value)
        return value

    @staticmethod
    def _format_number(value: int | float) -> str:
        return f"{value:,.0f}".replace(",", ".")
