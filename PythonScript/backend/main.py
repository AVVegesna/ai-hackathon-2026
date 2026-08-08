import os
import sys
import uuid
import json
import shutil
from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Ensure we can import from backend no matter how we run the server
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.detector import process_video_frames

app = FastAPI(title="Aquatic Vision API", version="1.0.0")

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
RESULTS_DIR = os.path.join(BASE_DIR, "results")

# Ensure folders exist
os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)
os.makedirs(RESULTS_DIR, exist_ok=True)

import sqlite3

def get_db_connection():
    # Try finding portal.db in various candidate locations
    candidates = [
        os.path.join(BASE_DIR, "data", "portal.db"),
        os.path.join(os.path.dirname(BASE_DIR), "data", "portal.db"),
        os.path.join(os.path.dirname(BASE_DIR), "ai-hackathon-2026", "data", "portal.db")
    ]
    for path in candidates:
        if os.path.exists(path):
            return sqlite3.connect(path)
    # Default: create in BASE_DIR/data/portal.db
    db_dir = os.path.join(BASE_DIR, "data")
    os.makedirs(db_dir, exist_ok=True)
    return sqlite3.connect(os.path.join(db_dir, "portal.db"))

def record_detection_in_database(video_id: str, results_meta: dict):
    """Saves dolphin detection results and auto-generates Bycatch species flags in SQLite DB."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Ensure flags table exists
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS flags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recording_id INTEGER NOT NULL DEFAULT 1,
                flag_type TEXT NOT NULL,
                severity TEXT NOT NULL,
                timestamp_seconds INTEGER NOT NULL,
                description TEXT,
                camera_id INTEGER,
                resolved BOOLEAN DEFAULT 0,
                resolved_by TEXT,
                resolution TEXT,
                resolved_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        if results_meta.get("has_dolphin"):
            events = results_meta.get("dolphin_events", [])
            # Store up to 5 representative dolphin flags per video
            sampled_events = events[::max(1, len(events) // 5)] if events else []
            for ev in sampled_events:
                timestamp_sec = int(ev.get("timestamp", 0))
                cnt = ev.get("count", 1)
                desc = f"Dolphin detected in video feed (Count: {cnt}) at {timestamp_sec}s"
                cursor.execute("""
                    INSERT INTO flags (recording_id, flag_type, severity, timestamp_seconds, description, camera_id, resolved)
                    VALUES (1, 'Bycatch species', 'High', ?, ?, 1, 0)
                """, (timestamp_sec, desc))
            conn.commit()
            print(f"✓ Recorded {len(sampled_events)} dolphin bycatch flags in SQLite database for video {video_id}.")
        conn.close()
    except Exception as e:
        print(f"Error persisting detection to SQLite database: {e}")

def run_detection_task(video_id: str, input_path: str, output_path: str, model_name: str, confidence: float):
    active_tasks[video_id] = {
        "status": "starting",
        "progress": 0,
        "message": "Initializing model...",
        "current_count": 0
    }
    
    def progress_callback(percent: int, status: str, message: str, current_count: int = 0):
        active_tasks[video_id]["status"] = status
        active_tasks[video_id]["progress"] = percent
        active_tasks[video_id]["message"] = message
        active_tasks[video_id]["current_count"] = current_count

    try:
        results_meta = process_video_frames(
            input_path=input_path,
            output_path=output_path,
            model_name=model_name,
            confidence=confidence,
            progress_callback=progress_callback
        )
        
        # Save results metadata to disk
        meta_path = os.path.join(RESULTS_DIR, f"{video_id}_meta.json")
        with open(meta_path, "w") as f:
            json.dump(results_meta, f, indent=4)
            
        # Record flags into database
        record_detection_in_database(video_id, results_meta)

        active_tasks[video_id]["status"] = "completed"
        active_tasks[video_id]["progress"] = 100
        active_tasks[video_id]["message"] = "Processing completed!"
        active_tasks[video_id]["result"] = results_meta
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        active_tasks[video_id]["status"] = "failed"
        active_tasks[video_id]["progress"] = 100
        active_tasks[video_id]["message"] = f"Processing failed: {str(e)}"

@app.post("/api/upload")
async def upload_video(file: UploadFile = File(...)):
    # Generate unique ID
    video_id = str(uuid.uuid4())
    _, ext = os.path.splitext(file.filename)
    if not ext:
        ext = ".mp4"  # Default to mp4 extension
        
    filename = f"{video_id}{ext}"
    input_path = os.path.join(UPLOADS_DIR, filename)
    
    # Save uploaded file
    try:
        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {str(e)}")
        
    return {
        "video_id": video_id,
        "original_filename": file.filename,
        "filename": filename,
        "url": f"/uploads/{filename}"
    }

@app.post("/api/detect/{video_id}")
async def start_detection(
    video_id: str,
    background_tasks: BackgroundTasks,
    model_name: str = Form("tilapia"),
    confidence: float = Form(0.25)
):
    # Find the uploaded video file
    video_file = None
    for f in os.listdir(UPLOADS_DIR):
        if f.startswith(video_id):
            video_file = f
            break
            
    if not video_file:
        raise HTTPException(status_code=404, detail="Video file not found")
        
    input_path = os.path.join(UPLOADS_DIR, video_file)
    output_filename = f"{video_id}_processed.mp4"
    output_path = os.path.join(RESULTS_DIR, output_filename)
    
    # Run the processing task in the background
    background_tasks.add_task(
        run_detection_task,
        video_id=video_id,
        input_path=input_path,
        output_path=output_path,
        model_name=model_name,
        confidence=confidence
    )
    
    return {"status": "started", "video_id": video_id}

@app.get("/api/status/{video_id}")
async def get_status(video_id: str):
    # Check memory tasks first
    if video_id in active_tasks:
        return active_tasks[video_id]
        
    # Check if it was already completed and saved on disk
    meta_path = os.path.join(RESULTS_DIR, f"{video_id}_meta.json")
    if os.path.exists(meta_path):
        with open(meta_path, "r") as f:
            result = json.load(f)
        return {
            "status": "completed",
            "progress": 100,
            "message": "Processing completed!",
            "result": result
        }
        
    return {
        "status": "idle",
        "progress": 0,
        "message": "Video uploaded, waiting to start detection."
    }

@app.get("/api/results/{video_id}")
async def get_results(video_id: str):
    meta_path = os.path.join(RESULTS_DIR, f"{video_id}_meta.json")
    if not os.path.exists(meta_path):
        raise HTTPException(status_code=404, detail="Results not ready or not found")
        
    with open(meta_path, "r") as f:
        meta_data = json.load(f)
        
    processed_video = f"{video_id}_processed.mp4"
    processed_video_path = os.path.join(RESULTS_DIR, processed_video)
    
    if not os.path.exists(processed_video_path):
         raise HTTPException(status_code=404, detail="Processed video file not found")
         
    meta_data["processed_video_url"] = f"/results/{processed_video}"
    return meta_data

@app.get("/api/videos")
async def list_videos():
    videos = []
    for filename in os.listdir(UPLOADS_DIR):
        video_id, _ = os.path.splitext(filename)
        # Check if meta file exists
        meta_path = os.path.join(RESULTS_DIR, f"{video_id}_meta.json")
        has_meta = os.path.exists(meta_path)
        
        status = "uploaded"
        has_dolphin = False
        peak_dolphin_count = 0
        if video_id in active_tasks:
            status = active_tasks[video_id]["status"]
            if "result" in active_tasks[video_id]:
                has_dolphin = active_tasks[video_id]["result"].get("has_dolphin", False)
                peak_dolphin_count = active_tasks[video_id]["result"].get("peak_dolphin_count", 0)
        elif has_meta:
            status = "completed"
            try:
                with open(meta_path, "r") as f:
                    meta_data = json.load(f)
                    has_dolphin = meta_data.get("has_dolphin", False)
                    peak_dolphin_count = meta_data.get("peak_dolphin_count", 0)
            except Exception:
                pass
            
        videos.append({
            "video_id": video_id,
            "filename": filename,
            "url": f"/uploads/{filename}",
            "status": status,
            "has_results": has_meta,
            "has_dolphin": has_dolphin,
            "peak_dolphin_count": peak_dolphin_count
        })
    return videos

# Mount media static directories
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")
app.mount("/results", StaticFiles(directory=RESULTS_DIR), name="results")

# Serve React static app
# Catch-all route to serve index.html for react routes
@app.get("/{path_name:path}")
async def catch_all(path_name: str):
    # If the static file exists, serve it
    file_path = os.path.join(STATIC_DIR, path_name)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)
    
    # Otherwise fall back to serving index.html (useful for React Router SPA)
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
        
    # Return basic placeholder if frontend hasn't been built yet
    return {
        "message": "Aquatic Vision API is running. The React frontend is not yet built. Run npm run build in the frontend directory."
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
