import hmac
import json
import os
from datetime import datetime, timezone
from threading import Lock

from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException
from sqlalchemy import text

from model import MLServiceError, RiskModelService

app = FastAPI(
    title="NALAR Risk Engine",
    description="Service analitik risiko pelanggan berdasarkan pola kWh.",
    version="0.1.0",
)

model_service = RiskModelService()
training_lock = Lock()
training_status = {
    "state": "idle",
    "running": False,
    "pending_retrain": False,
    "last_error": None,
    "last_summary": None,
    "started_at": None,
    "finished_at": None,
    "duration_seconds": None,
}


def verify_internal_token(x_ml_service_token: str | None = Header(default=None)):
    expected_token = (
        os.getenv("NALAR_SERVICE_TOKEN", "").strip()
        or os.getenv("ML_SERVICE_TOKEN", "").strip()
    )
    if not expected_token:
        raise HTTPException(
            status_code=500,
            detail="NALAR_SERVICE_TOKEN atau ML_SERVICE_TOKEN belum diatur di NALAR service.",
        )
    if not x_ml_service_token or not hmac.compare_digest(x_ml_service_token, expected_token):
        raise HTTPException(status_code=401, detail="Token NALAR service tidak valid.")


def _ensure_training_status_table() -> None:
    with model_service.engine.begin() as conn:
        conn.execute(
            text(
                """
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
                """
            )
        )
        conn.execute(
            text(
                """
                INSERT INTO "nalar_training_status" (
                  "id",
                  "updated_at"
                )
                VALUES (1, :updated_at)
                ON CONFLICT ("id") DO NOTHING;
                """
            ),
            {"updated_at": _utc_now()},
        )


def _row_to_training_status(row) -> dict:
    summary = row["last_summary"]
    if isinstance(summary, str):
        try:
            summary = json.loads(summary)
        except json.JSONDecodeError:
            summary = None

    return {
        "state": row["state"],
        "running": bool(row["running"]),
        "pending_retrain": bool(row["pending_retrain"]),
        "last_error": row["last_error"],
        "last_summary": summary,
        "started_at": row["started_at"],
        "finished_at": row["finished_at"],
        "duration_seconds": row["duration_seconds"],
        "updated_at": row["updated_at"],
    }


def _is_stale_running_status(status: dict) -> bool:
    if not status.get("running"):
        return False

    started_at = status.get("started_at")
    if not started_at:
        return False

    try:
        started = datetime.fromisoformat(started_at)
    except ValueError:
        return False

    stale_minutes = _int_env("NALAR_TRAINING_STALE_MINUTES", 120)
    age_seconds = (datetime.now(timezone.utc) - started).total_seconds()
    return age_seconds > stale_minutes * 60


def _sync_training_status(recover_stale: bool = False) -> dict:
    _ensure_training_status_table()
    with model_service.engine.begin() as conn:
        row = conn.execute(
            text(
                """
                SELECT
                  "state",
                  "running",
                  "pending_retrain",
                  "last_error",
                  "last_summary",
                  "started_at",
                  "finished_at",
                  "duration_seconds",
                  "updated_at"
                FROM "nalar_training_status"
                WHERE "id" = 1;
                """
            )
        ).mappings().one()

    status = _row_to_training_status(row)
    training_status.update(status)
    if recover_stale and _is_stale_running_status(status):
        finished_at = _utc_now()
        status = _persist_training_status(
            state="failed",
            running=False,
            pending_retrain=False,
            last_error="NALAR service restart saat training berjalan. Jalankan training ulang.",
            finished_at=finished_at,
            duration_seconds=_duration_seconds(status["started_at"], finished_at),
        )

    return dict(training_status)


def _persist_training_status(**updates) -> dict:
    next_status = {
        "state": "idle",
        "running": False,
        "pending_retrain": False,
        "last_error": None,
        "last_summary": None,
        "started_at": None,
        "finished_at": None,
        "duration_seconds": None,
        "updated_at": None,
    }
    next_status.update(training_status)
    next_status.update(updates)
    updated_at = _utc_now()
    next_status["updated_at"] = updated_at
    summary_json = (
        json.dumps(next_status["last_summary"], default=str)
        if next_status["last_summary"] is not None
        else None
    )

    _ensure_training_status_table()
    with model_service.engine.begin() as conn:
        conn.execute(
            text(
                """
                UPDATE "nalar_training_status"
                SET
                  "state" = :state,
                  "running" = :running,
                  "pending_retrain" = :pending_retrain,
                  "last_error" = :last_error,
                  "last_summary" = CAST(:last_summary AS jsonb),
                  "started_at" = :started_at,
                  "finished_at" = :finished_at,
                  "duration_seconds" = :duration_seconds,
                  "updated_at" = :updated_at
                WHERE "id" = 1;
                """
            ),
            {
                **next_status,
                "last_summary": summary_json,
                "updated_at": updated_at,
            },
        )

    training_status.update(next_status)
    return dict(training_status)


def _mark_training_started() -> dict:
    return _persist_training_status(
        state="running",
        running=True,
        pending_retrain=False,
        last_error=None,
        started_at=_utc_now(),
        finished_at=None,
        duration_seconds=None,
    )


@app.get("/health")
def health(x_ml_service_token: str | None = Header(default=None)):
    expected_token = (
        os.getenv("NALAR_SERVICE_TOKEN", "").strip()
        or os.getenv("ML_SERVICE_TOKEN", "").strip()
    )
    if not expected_token or not x_ml_service_token or not hmac.compare_digest(x_ml_service_token, expected_token):
        return {"status": "ok"}

    data = model_service.health()
    data["training_status"] = _sync_training_status(recover_stale=True)
    return data


@app.post("/train")
def train(background_tasks: BackgroundTasks, _auth: None = Depends(verify_internal_token)):
    with training_lock:
        latest_status = _sync_training_status(recover_stale=True)
        if latest_status["running"]:
            queued_status = _persist_training_status(pending_retrain=True)
            return {
                "message": "Training NALAR sedang berjalan. Permintaan baru masuk antrean.",
                "status": "queued_pending",
                "training_status": queued_status,
            }
        current_status = _mark_training_started()

    background_tasks.add_task(_run_training_loop)
    return {
        "message": "Training NALAR dimulai di background.",
        "status": "queued",
        "training_status": current_status,
    }


@app.get("/training-status")
def get_training_status(_auth: None = Depends(verify_internal_token)):
    return _sync_training_status(recover_stale=True)


@app.get("/scores")
def scores(
    page: int = 1,
    limit: int = 5000,
    _auth: None = Depends(verify_internal_token),
):
    try:
        safe_page = max(1, page)
        safe_limit = min(max(1, limit), 10000)
        offset = (safe_page - 1) * safe_limit
        result = model_service.score_all(limit=safe_limit, offset=offset)
        return {
            "data": result["data"],
            "model_version": model_service.model_version,
            "pagination": {
                "total": result["total"],
                "page": safe_page,
                "limit": safe_limit,
                "totalPages": max(1, (result["total"] + safe_limit - 1) // safe_limit),
            },
        }
    except MLServiceError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Terjadi error saat menghitung skor: {error}",
        ) from error


@app.get("/scores/{pelanggan_id}")
def score_one(pelanggan_id: str, _auth: None = Depends(verify_internal_token)):
    try:
        return model_service.score_one(pelanggan_id)
    except MLServiceError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Terjadi error saat menghitung skor pelanggan: {error}",
        ) from error


@app.get("/model-history")
def model_history(limit: int = 50, _auth: None = Depends(verify_internal_token)):
    try:
        return {"data": model_service.model_history(limit)}
    except MLServiceError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Terjadi error saat membaca riwayat model: {error}",
        ) from error


@app.get("/feature-importance")
def feature_importance(_auth: None = Depends(verify_internal_token)):
    try:
        return {
            "data": model_service.feature_importance(),
            "model_version": model_service.model_version,
        }
    except MLServiceError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Terjadi error saat membaca feature importance: {error}",
        ) from error


def _run_training_loop():
    while True:
        _run_training_once()
        with training_lock:
            latest_status = _sync_training_status()
            if latest_status.get("pending_retrain"):
                _mark_training_started()
                continue
        break


def _run_training_once():
    try:
        summary = model_service.train()
        with training_lock:
            _persist_training_status(
                state="succeeded" if summary.accepted else "rejected",
                last_summary=summary.__dict__,
                last_error=summary.rejection_reason,
            )
    except MLServiceError as error:
        message = str(error)
        with training_lock:
            _persist_training_status(
                state=(
                    "skipped"
                    if "sedang berjalan di instance lain" in message
                    else "failed"
                ),
                last_error=message,
            )
    except Exception as error:
        with training_lock:
            _persist_training_status(state="failed", last_error=str(error))
    finally:
        with training_lock:
            finished_at = _utc_now()
            _persist_training_status(
                finished_at=finished_at,
                duration_seconds=_duration_seconds(
                    training_status["started_at"],
                    finished_at,
                ),
                running=False,
            )


def _utc_now():
    return datetime.now(timezone.utc).isoformat()


def _duration_seconds(started_at: str | None, finished_at: str | None):
    if not started_at or not finished_at:
        return None
    try:
        started = datetime.fromisoformat(started_at)
        finished = datetime.fromisoformat(finished_at)
    except ValueError:
        return None
    return round((finished - started).total_seconds(), 2)


def _int_env(name: str, default: int) -> int:
    raw = os.getenv(name, str(default))
    try:
        return int(raw)
    except ValueError:
        return default
