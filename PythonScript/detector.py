import os
import sys
import time
import urllib.request
import cv2
import numpy as np
import imageio
from ultralytics import YOLO

MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
os.makedirs(MODELS_DIR, exist_ok=True)

MODEL_CONFIGS = {
    "tilapia": {
        "url": "https://huggingface.co/Raniahossam33/fish-feeding/resolve/main/Fish-Counting-yolov8.pt",
        "filename": "Fish-Counting-yolov8.pt",
        "label": "Tilapia Detector",
        "classes": {0: "Fish"}
    },
    "grayscale": {
        "url": "https://huggingface.co/akridge/yolo8-fish-detector-grayscale/resolve/main/yolov8n_fish_trained.pt",
        "filename": "yolov8n_fish_trained.pt",
        "label": "Grayscale Fish Detector",
        "classes": {0: "Fish"}
    },
    "dolphin": {
        "url": "https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8s-worldv2.pt",
        "filename": "yolov8s-worldv2.pt",
        "label": "Dolphin & Marine Mammal (YOLO-World)",
        "classes": {0: "Dolphin", 1: "Dolphin", 2: "Dolphin", 3: "Dolphin", 4: "Dolphin", 5: "Fish"}
    },
    "coco": {
        "url": "https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8n.pt",
        "filename": "yolov8n.pt",
        "label": "Standard YOLOv8 (COCO)",
        "classes": None
    }
}

# Global dictionary to store model instances so we don't reload them every time
_loaded_models = {}

def get_model_path(model_name: str, progress_callback=None) -> str:
    """Gets the path to the model, downloading it if not present."""
    if model_name not in MODEL_CONFIGS:
        model_name = "tilapia"
        
    cfg = MODEL_CONFIGS[model_name]
    save_path = os.path.join(MODELS_DIR, cfg["filename"])
    
    if not os.path.exists(save_path):
        if progress_callback:
            progress_callback(0, "downloading", f"Downloading {cfg['label']} weights...")
        print(f"Downloading model {model_name} from {cfg['url']}...")
        
        def _reporthook(blocknum, blocksize, totalsize):
            if totalsize > 0 and progress_callback:
                percent = min(100, int(blocknum * blocksize * 100 / totalsize))
                progress_callback(percent, "downloading", f"Downloading weights: {percent}%")
                
        urllib.request.urlretrieve(cfg["url"], save_path, reporthook=_reporthook)
        print(f"Downloaded model to {save_path}")
        
    return save_path

def load_yolo_model(model_name: str, progress_callback=None):
    """Loads and caches the YOLO model."""
    if model_name in _loaded_models:
        return _loaded_models[model_name]
    
    model_path = get_model_path(model_name, progress_callback)
    if progress_callback:
        progress_callback(100, "loading", "Loading model into memory...")
        
    if model_name == "dolphin":
        from ultralytics import YOLOWorld
        model = YOLOWorld(model_path)
        # Exclusively target dolphins and marine mammals
        model.set_classes(["dolphin", "bottlenose dolphin", "porpoise", "marine mammal", "sea mammal"])
    else:
        model = YOLO(model_path)
        
    _loaded_models[model_name] = model
    return model

def draw_cyberpunk_box(img, x1, y1, x2, y2, label, confidence, color=(0, 255, 170)):
    """Draws a premium cyberpunk-style corner bracket bounding box with glow."""
    x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
    w, h = x2 - x1, y2 - y1
    
    overlay = img.copy()
    cv2.rectangle(overlay, (x1, y1), (x2, y2), color, -1)
    cv2.addWeighted(overlay, 0.1, img, 0.9, 0, img)
    
    cv2.rectangle(img, (x1, y1), (x2, y2), color, 1)
    
    corner_len = min(20, w // 4, h // 4)
    cv2.line(img, (x1, y1), (x1 + corner_len, y1), color, 3)
    cv2.line(img, (x1, y1), (x1, y1 + corner_len), color, 3)
    cv2.line(img, (x2, y1), (x2 - corner_len, y1), color, 3)
    cv2.line(img, (x2, y1), (x2, y1 + corner_len), color, 3)
    cv2.line(img, (x1, y2), (x1 + corner_len, y2), color, 3)
    cv2.line(img, (x1, y2), (x1, y2 - corner_len), color, 3)
    cv2.line(img, (x2, y2), (x2 - corner_len, y2), color, 3)
    cv2.line(img, (x2, y2), (x2, y2 - corner_len), color, 3)
    
    txt = f"{label} {confidence:.0%}"
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.4
    thickness = 1
    
    (txt_w, txt_h), baseline = cv2.getTextSize(txt, font, font_scale, thickness)
    
    badge_x1 = x1
    badge_y1 = y1 - txt_h - 8 if y1 - txt_h - 8 > 0 else y1 + 5
    badge_x2 = x1 + txt_w + 10
    badge_y2 = badge_y1 + txt_h + 6
    
    cv2.rectangle(img, (badge_x1, badge_y1), (badge_x2, badge_y2), color, -1)
    cv2.putText(img, txt, (badge_x1 + 5, badge_y2 - 4), font, font_scale, (20, 20, 20), thickness, cv2.LINE_AA)

def draw_hud_overlay(img, frame_idx, total_frames, count_value, fps_processing, model_label, count_label="DOLPHIN COUNT", dolphin_count=0):
    """Draws a professional sci-fi HUD card on the top left of the video frame."""
    h, w, _ = img.shape
    
    card_w, card_h = 260, 125 if dolphin_count > 0 else 110
    card_x, card_y = 20, 20
    
    overlay = img.copy()
    card_bg_color = (45, 10, 55) if dolphin_count > 0 else (15, 23, 42)
    cv2.rectangle(overlay, (card_x, card_y), (card_x + card_w, card_y + card_h), card_bg_color, -1)
    cv2.addWeighted(overlay, 0.85, img, 0.15, 0, img)
    
    border_color = (255, 0, 255) if dolphin_count > 0 else (0, 255, 170)
    cv2.rectangle(img, (card_x, card_y), (card_x + card_w, card_y + card_h), border_color, 1)
    cv2.line(img, (card_x, card_y), (card_x + 30, card_y), border_color, 3)
    cv2.line(img, (card_x, card_y), (card_x, card_y + 30), border_color, 3)
    
    font = cv2.FONT_HERSHEY_SIMPLEX
    
    cv2.putText(img, "AQUATIC VISION HUD", (card_x + 12, card_y + 20), font, 0.45, border_color, 1, cv2.LINE_AA)
    cv2.line(img, (card_x + 12, card_y + 25), (card_x + card_w - 12, card_y + 25), border_color, 1)
    
    cv2.putText(img, f"MODEL: {model_label}", (card_x + 12, card_y + 42), font, 0.36, (200, 220, 220), 1, cv2.LINE_AA)
    
    progress_pct = (frame_idx / total_frames) if total_frames > 0 else 0
    cv2.putText(img, f"FRAME: {frame_idx}/{total_frames} ({progress_pct:.0%})", (card_x + 12, card_y + 58), font, 0.36, (200, 220, 220), 1, cv2.LINE_AA)
    
    cv2.putText(img, f"SPEED: {fps_processing:.1f} FPS", (card_x + 12, card_y + 74), font, 0.36, (200, 220, 220), 1, cv2.LINE_AA)
    
    count_text_color = (255, 0, 255) if "DOLPHIN" in count_label else (52, 211, 153)
    cv2.putText(img, f"{count_label}: {count_value}", (card_x + 12, card_y + 95), font, 0.45, count_text_color, 2, cv2.LINE_AA)

    if dolphin_count > 0 and "DOLPHIN" not in count_label:
        cv2.putText(img, f"DOLPHIN ALERT: {dolphin_count}", (card_x + 12, card_y + 115), font, 0.45, (255, 0, 255), 2, cv2.LINE_AA)

def process_video_frames(input_path: str, output_path: str, model_name: str, confidence: float, progress_callback):
    """Processes a video frame-by-frame, runs YOLOv8 fish/dolphin detection, overlays graphics, and encodes H.264 video."""
    start_time = time.time()
    
    model = load_yolo_model(model_name, progress_callback)
    model_cfg = MODEL_CONFIGS[model_name]
    model_label = model_cfg["label"]
    
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        raise ValueError(f"Could not open input video: {input_path}")
        
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    if fps <= 0:
        fps = 30.0
    if total_frames <= 0:
        total_frames = 100
        
    try:
        writer = imageio.get_writer(
            output_path, 
            fps=fps, 
            codec='libx264', 
            pixelformat='yuv420p',
            quality=8
        )
    except Exception as e:
        print(f"Failed to create imageio writer with libx264: {e}. Falling back to default writer.")
        writer = imageio.get_writer(output_path, fps=fps)
        
    frame_idx = 0
    frame_counts = []
    dolphin_frame_counts = []
    fish_frame_counts = []
    dolphin_events = []
    
    print(f"Starting processing: {width}x{height} @ {fps}fps, {total_frames} frames.")
    
    color_fish = (170, 255, 0)
    color_dolphin = (255, 0, 255)
    color_default = (0, 215, 255)
    
    frame_stride = 2 if total_frames > 300 else 1
    
    last_detections = []
    last_fish_in_frame = 0
    last_dolphin_in_frame = 0
    last_total_in_frame = 0
    
    try:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
                
            frame_idx += 1
            frame_start = time.time()
            timestamp_sec = round((frame_idx - 1) / fps, 2)
            
            should_infer = (frame_idx % frame_stride == 1) or (frame_stride == 1)
            
            if should_infer:
                results = model.predict(frame, conf=confidence, imgsz=640, verbose=False)
                
                detections = []
                fish_in_frame = 0
                dolphin_in_frame = 0
                total_in_frame = 0
                
                if len(results) > 0:
                    boxes = results[0].boxes
                    for box in boxes:
                        cls_id = int(box.cls[0])
                        conf = float(box.conf[0])
                        
                        label = "Dolphin" if model_name == "dolphin" else "Fish"
                        if model_cfg["classes"] is not None:
                            label = model_cfg["classes"].get(cls_id, label)
                        else:
                            cls_name = model.names.get(cls_id, "object")
                            label = cls_name.capitalize()
                            
                        label_lower = label.lower()
                        if model_name == "dolphin" or any(kw in label_lower for kw in ["dolphin", "porpoise", "mammal", "whale"]):
                            dolphin_in_frame += 1
                            total_in_frame += 1
                            box_color = color_dolphin
                            display_label = "🐬 DOLPHIN"
                        elif "fish" in label_lower:
                            fish_in_frame += 1
                            total_in_frame += 1
                            box_color = color_fish
                            display_label = label
                        else:
                            fish_in_frame += 1
                            total_in_frame += 1
                            box_color = color_default
                            display_label = label
                        
                        xyxy = box.xyxy[0].tolist()
                        detections.append({
                            "box": xyxy,
                            "class_id": cls_id,
                            "label": label,
                            "confidence": conf,
                            "display_label": display_label,
                            "color": box_color
                        })
                
                last_detections = detections
                last_fish_in_frame = fish_in_frame
                last_dolphin_in_frame = dolphin_in_frame
                last_total_in_frame = total_in_frame
            else:
                detections = last_detections
                fish_in_frame = last_fish_in_frame
                dolphin_in_frame = last_dolphin_in_frame
                total_in_frame = last_total_in_frame

            for det in detections:
                xyxy = det["box"]
                draw_cyberpunk_box(frame, xyxy[0], xyxy[1], xyxy[2], xyxy[3], det["display_label"], det["confidence"], det["color"])

            frame_counts.append(total_in_frame)
            dolphin_frame_counts.append(dolphin_in_frame)
            fish_frame_counts.append(fish_in_frame)

            if dolphin_in_frame > 0:
                dolphin_events.append({
                    "frame": frame_idx,
                    "timestamp": timestamp_sec,
                    "count": dolphin_in_frame
                })
            
            frame_dur = time.time() - frame_start
            fps_processing = 1.0 / frame_dur if frame_dur > 0 else 30.0
            
            if model_name == "dolphin":
                count_label = "🐬 DOLPHIN COUNT"
                main_count_value = dolphin_in_frame
            elif model_name == "coco":
                count_label = "OBJECT COUNT"
                main_count_value = total_in_frame
            else:
                count_label = "FISH COUNT"
                main_count_value = fish_in_frame
                
            draw_hud_overlay(
                frame, 
                frame_idx, 
                total_frames, 
                main_count_value, 
                fps_processing, 
                model_label, 
                count_label, 
                dolphin_count=dolphin_in_frame
            )
            
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            writer.append_data(frame_rgb)
            
            if progress_callback:
                pct = int((frame_idx / total_frames) * 100)
                progress_callback(
                    pct, 
                    "processing", 
                    f"Processing frame {frame_idx}/{total_frames} ({pct}%)",
                    current_count=total_in_frame
                )
                
    finally:
        cap.release()
        writer.close()
        
    duration = time.time() - start_time
    peak_count = max(frame_counts) if frame_counts else 0
    avg_count = sum(frame_counts) / len(frame_counts) if frame_counts else 0
    
    peak_dolphin_count = max(dolphin_frame_counts) if dolphin_frame_counts else 0
    total_dolphin_frames = sum(1 for c in dolphin_frame_counts if c > 0)
    has_dolphin = peak_dolphin_count > 0

    results_meta = {
        "processed": True,
        "total_frames": total_frames,
        "duration_seconds": duration,
        "fps": fps,
        "peak_count": peak_count,
        "average_count": round(avg_count, 2),
        "frame_counts": frame_counts,
        "dolphin_frame_counts": dolphin_frame_counts,
        "fish_frame_counts": fish_frame_counts,
        "peak_dolphin_count": peak_dolphin_count,
        "total_dolphin_frames": total_dolphin_frames,
        "has_dolphin": has_dolphin,
        "dolphin_events": dolphin_events
    }
    
    print(f"Finished processing in {duration:.1f}s. Peak objects: {peak_count}, Peak dolphins: {peak_dolphin_count}, Avg: {avg_count:.2f}")
    return results_meta
