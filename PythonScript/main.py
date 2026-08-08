import os
import sqlite3
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from detector import process_video_frames

app = FastAPI(title="Fisheries AI Video Analytics")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "..", "data", "portal.db")

class VideoProcessRequest(BaseModel):
    video_id: str
    model_name: str = "dolphin"
    confidence: float = 0.15

@app.get("/")
def read_root():
    return {"message": "Fisheries AI Processing API Running"}

@app.post("/api/process")
def process_video_endpoint(req: VideoProcessRequest):
    input_path = os.path.join(BASE_DIR, "..", "uploads", f"{req.video_id}.mp4")
    output_path = os.path.join(BASE_DIR, "..", "results", f"{req.video_id}_processed.mp4")

    if not os.path.exists(input_path):
        raise HTTPException(status_code=404, detail=f"Input video not found: {input_path}")

    def progress_cb(pct, status, msg, current_count=0):
        print(f"[{pct}%] {status}: {msg} (count: {current_count})")

    try:
        results = process_video_frames(
            input_path=input_path,
            output_path=output_path,
            model_name=req.model_name,
            confidence=req.confidence,
            progress_callback=progress_cb
        )

        if results.get("has_dolphin") and os.path.exists(DB_PATH):
            try:
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO flags (recording_id, camera_id, timestamp, flag_type, severity, description, status)
                    VALUES (1, 1, '00:00:05', 'Bycatch species', 'High', ?, 'unresolved')
                """, (f"Dolphin detected in video feed (Count: {results.get('peak_dolphin_count', 1)})",))
                conn.commit()
                conn.close()
                print("Auto-inserted dolphin flag into SQLite database.")
            except Exception as db_err:
                print(f"Failed to insert DB flag: {db_err}")

        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
