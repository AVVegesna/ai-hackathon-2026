import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

export default function UploadView({ onRefreshFleet }) {
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  
  // Upload State
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  
  // Detection Config
  const [modelName, setModelName] = useState('dolphin');
  const [confidence, setConfidence] = useState(0.15);
  
  // Status and Polling State
  const [processing, setProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState({
    status: 'idle',
    progress: 0,
    message: '',
    current_count: 0
  });
  
  // Result details
  const [results, setResults] = useState(null);
  const [hoveredFrameData, setHoveredFrameData] = useState(null);
  const [error, setError] = useState('');
  
  // Video sync references
  const originalVideoRef = useRef(null);
  const processedVideoRef = useRef(null);
  const isSyncingRef = useRef(false);
  const pollIntervalRef = useRef(null);

  useEffect(() => {
    fetchVideos();
    return () => clearInterval(pollIntervalRef.current);
  }, []);

  useEffect(() => {
    if (processing && selectedVideo) {
      pollIntervalRef.current = setInterval(() => {
        checkStatus(selectedVideo.video_id);
      }, 800);
    } else {
      clearInterval(pollIntervalRef.current);
    }
    return () => clearInterval(pollIntervalRef.current);
  }, [processing, selectedVideo]);

  const fetchVideos = async () => {
    try {
      const response = await axios.get(`${API_URL}/videos`);
      setVideos(response.data || []);
    } catch (err) {
      console.error('Failed to fetch videos:', err);
    }
  };

  const checkStatus = async (videoId) => {
    try {
      const response = await axios.get(`${API_URL}/status/${videoId}`);
      const data = response.data;
      setProcessStatus(data);
      
      if (data.status === 'completed') {
        setProcessing(false);
        fetchResults(videoId);
        fetchVideos();
        if (onRefreshFleet) onRefreshFleet();
      } else if (data.status === 'failed') {
        setProcessing(false);
        setError(data.message);
        fetchVideos();
      }
    } catch (err) {
      console.error('Error polling status:', err);
    }
  };

  const fetchResults = async (videoId) => {
    try {
      const response = await axios.get(`${API_URL}/results/${videoId}`);
      setResults(response.data);
    } catch (err) {
      console.error('Failed to load results:', err);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  const uploadFile = async (file) => {
    setUploading(true);
    setUploadProgress(20);
    setError('');
    setResults(null);
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await axios.post(`${API_URL}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });
      
      const data = response.data;
      setSelectedVideo({
        video_id: data.video_id,
        filename: data.filename,
        url: data.url,
        status: 'uploaded',
        has_results: false
      });
      setProcessStatus({
        status: 'idle',
        progress: 0,
        message: 'Video uploaded. Ready for Dolphin & AI detection.',
        current_count: 0
      });
      fetchVideos();
    } catch (err) {
      setError('File upload failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
    }
  };

  const startDetection = async () => {
    if (!selectedVideo) return;
    
    setProcessing(true);
    setError('');
    setResults(null);
    setProcessStatus({
      status: 'starting',
      progress: 0,
      message: 'Initiating Dolphin detection pipeline...',
      current_count: 0
    });
    
    try {
      await axios.post(`${API_URL}/detect/${selectedVideo.video_id}`, {
        model_name: modelName,
        confidence: confidence
      });
    } catch (err) {
      setProcessing(false);
      setError('Failed to trigger detection task: ' + (err.response?.data?.error || err.message));
    }
  };

  const selectVideoFromList = (vid) => {
    if (processing) return;
    setSelectedVideo(vid);
    setError('');
    setResults(null);
    
    if (vid.status === 'completed' || vid.has_results) {
      setProcessStatus({
        status: 'completed',
        progress: 100,
        message: 'Analysis loaded from database.'
      });
      fetchResults(vid.video_id);
    } else {
      setProcessStatus({
        status: 'idle',
        progress: 0,
        message: 'Video uploaded, ready to analyze.'
      });
    }
  };

  const handleSyncPlay = () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    if (originalVideoRef.current && processedVideoRef.current) {
      if (processedVideoRef.current.paused) processedVideoRef.current.play().catch(() => {});
      if (originalVideoRef.current.paused) originalVideoRef.current.play().catch(() => {});
    }
    isSyncingRef.current = false;
  };

  const handleSyncPause = () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    if (originalVideoRef.current && processedVideoRef.current) {
      if (!processedVideoRef.current.paused) processedVideoRef.current.pause();
      if (!originalVideoRef.current.paused) originalVideoRef.current.pause();
    }
    isSyncingRef.current = false;
  };

  const handleSyncSeek = (e) => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    const targetTime = e.target.currentTime;
    
    if (e.target === originalVideoRef.current && processedVideoRef.current) {
      if (Math.abs(processedVideoRef.current.currentTime - targetTime) > 0.1) {
        processedVideoRef.current.currentTime = targetTime;
      }
    } else if (e.target === processedVideoRef.current && originalVideoRef.current) {
      if (Math.abs(originalVideoRef.current.currentTime - targetTime) > 0.1) {
        originalVideoRef.current.currentTime = targetTime;
      }
    }
    isSyncingRef.current = false;
  };

  return (
    <div style={{ padding: 'var(--space-4)', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Header Banner */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 'var(--space-4)',
        background: 'color-mix(in srgb, var(--color-surface, #1e293b) 80%, transparent)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--color-divider)',
        marginBottom: 'var(--space-4)'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', letterSpacing: '0.04em' }}>
            📹 VIDEO UPLOADER & AI DOLPHIN DETECTOR
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', opacity: 0.7 }}>
            Upload vessel footage to run real-time YOLO marine life analysis and auto-record dolphin bycatch flags in SQLite database.
          </p>
        </div>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: '20px',
          background: 'rgba(52, 211, 153, 0.15)',
          color: '#34d399',
          fontSize: '11px',
          fontWeight: '600'
        }}>
          ● EXPRESS.JS SERVER ACTIVE
        </span>
      </div>

      {error && (
        <div style={{
          padding: 'var(--space-3)',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid #ef4444',
          color: '#fca5a5',
          borderRadius: 'var(--radius)',
          marginBottom: 'var(--space-4)',
          fontSize: '13px'
        }}>
          {error}
        </div>
      )}

      {/* Main 2-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 'var(--space-4)' }}>
        
        {/* Left Control Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          
          {/* File Upload Box */}
          <div style={{
            padding: 'var(--space-4)',
            background: 'var(--color-bg)',
            border: '1px solid var(--color-divider)',
            borderRadius: 'var(--radius)'
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7 }}>
              Upload Footage
            </h3>

            <div 
              onDragEnter={handleDrag} 
              onDragOver={handleDrag} 
              onDragLeave={handleDrag} 
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${dragActive ? '#38bdf8' : 'var(--color-divider)'}`,
                borderRadius: 'var(--radius)',
                padding: 'var(--space-4)',
                textAlign: 'center',
                background: dragActive ? 'rgba(56, 189, 248, 0.05)' : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <input 
                type="file" 
                id="express-video-input" 
                style={{ display: 'none' }} 
                accept="video/*" 
                onChange={handleFileChange}
                disabled={uploading || processing}
              />
              <label htmlFor="express-video-input" style={{ cursor: 'pointer', display: 'block' }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>📤</div>
                {uploading ? (
                  <div>
                    <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: '600' }}>Uploading... {uploadProgress}%</span>
                    <div style={{ height: '4px', background: '#334155', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: '#38bdf8', width: `${uploadProgress}%` }}></div>
                    </div>
                  </div>
                ) : (
                  <>
                    <span style={{ fontSize: '12px', fontWeight: '600', display: 'block' }}>Drop video file here</span>
                    <span style={{ fontSize: '10px', opacity: 0.5, display: 'block', marginTop: '4px' }}>or click to choose MP4 / AVI</span>
                  </>
                )}
              </label>
            </div>
          </div>

          {/* Model Pipeline Settings */}
          <div style={{
            padding: 'var(--space-4)',
            background: 'var(--color-bg)',
            border: '1px solid var(--color-divider)',
            borderRadius: 'var(--radius)'
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7 }}>
              Detection Model
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px', opacity: 0.8 }}>Target Model</label>
                <select 
                  value={modelName} 
                  onChange={(e) => setModelName(e.target.value)}
                  disabled={processing}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: 'var(--radius)',
                    background: 'var(--color-surface, #0f172a)',
                    border: '1px solid var(--color-divider)',
                    color: 'inherit',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}
                >
                  <option value="dolphin">🐬 Dolphin & Marine Species (YOLO-World)</option>
                  <option value="tilapia">Tilapia Count Detector</option>
                  <option value="grayscale">Underwater Grayscale Model</option>
                  <option value="coco">Standard COCO YOLOv8</option>
                </select>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                  <span>Confidence Threshold</span>
                  <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{confidence.toFixed(2)}</span>
                </div>
                <input 
                  type="range" 
                  min="0.1" 
                  max="0.9" 
                  step="0.05"
                  value={confidence} 
                  onChange={(e) => setConfidence(parseFloat(e.target.value))}
                  disabled={processing}
                  style={{ width: '100%' }}
                />
              </div>

              <button
                onClick={startDetection}
                disabled={!selectedVideo || processing || uploading}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: 'var(--radius)',
                  border: 'none',
                  background: selectedVideo && !processing ? 'linear-gradient(135deg, #0ea5e9, #2563eb)' : '#334155',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: selectedVideo && !processing ? 'pointer' : 'not-allowed',
                  marginTop: '8px'
                }}
              >
                {processing ? `Analyzing (${processStatus.progress}%)...` : 'Run Dolphin Detection'}
              </button>
            </div>
          </div>

          {/* Uploaded Catalog */}
          <div style={{
            padding: 'var(--space-4)',
            background: 'var(--color-bg)',
            border: '1px solid var(--color-divider)',
            borderRadius: 'var(--radius)'
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7 }}>
              Recent Video Catalog ({videos.length})
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
              {videos.length === 0 ? (
                <div style={{ fontSize: '11px', opacity: 0.5, fontStyle: 'italic', textAlign: 'center', padding: '12px' }}>No uploaded videos yet</div>
              ) : (
                videos.map(vid => (
                  <div
                    key={vid.video_id}
                    onClick={() => selectVideoFromList(vid)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 'var(--radius)',
                      border: `1px solid ${selectedVideo?.video_id === vid.video_id ? '#38bdf8' : 'var(--color-divider)'}`,
                      background: selectedVideo?.video_id === vid.video_id ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    <div style={{ fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {vid.filename}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '10px', opacity: 0.7 }}>
                      <span>Status: {vid.status.toUpperCase()}</span>
                      {vid.has_dolphin && <span style={{ color: '#d946ef', fontWeight: 'bold' }}>🐬 Dolphin</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Right Stage & Analytics Main Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          
          {!selectedVideo ? (
            <div style={{
              padding: '60px 20px',
              textAlign: 'center',
              background: 'var(--color-bg)',
              border: '1px solid var(--color-divider)',
              borderRadius: 'var(--radius)'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🐬</div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '700' }}>No Active Video Selected</h3>
              <p style={{ margin: 0, fontSize: '13px', opacity: 0.6, maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
                Upload raw vessel footage using the drop zone on the left to run Dolphin & Marine life AI analysis.
              </p>
            </div>
          ) : (
            <>
              {/* Selected Video Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: 'var(--color-bg)',
                border: '1px solid var(--color-divider)',
                borderRadius: 'var(--radius)'
              }}>
                <div>
                  <span style={{ fontSize: '10px', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Selected Feed</span>
                  <div style={{ fontWeight: '700', fontSize: '14px' }}>{selectedVideo.filename}</div>
                </div>

                <span style={{
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '700',
                  background: processStatus.status === 'completed' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                  color: processStatus.status === 'completed' ? '#34d399' : '#38bdf8'
                }}>
                  {processStatus.status.toUpperCase()}
                </span>
              </div>

              {/* Synchronized Video Players */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 'var(--space-4)',
                background: 'var(--color-bg)',
                padding: 'var(--space-4)',
                border: '1px solid var(--color-divider)',
                borderRadius: 'var(--radius)'
              }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', marginBottom: '6px', opacity: 0.6, letterSpacing: '0.05em' }}>RAW INPUT STREAM</div>
                  <video 
                    ref={originalVideoRef}
                    src={`http://localhost:3000${selectedVideo.url}`}
                    controls
                    style={{ width: '100%', aspectRatio: '16/9', background: '#000', borderRadius: 'var(--radius)' }}
                    onPlay={handleSyncPlay}
                    onPause={handleSyncPause}
                    onTimeUpdate={handleSyncSeek}
                  />
                </div>

                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', marginBottom: '6px', opacity: 0.6, letterSpacing: '0.05em' }}>AQUATIC VISION HUD TRACKING</div>
                  {results ? (
                    <video 
                      ref={processedVideoRef}
                      src={`http://localhost:3000${results.processed_video_url}`}
                      controls
                      style={{ width: '100%', aspectRatio: '16/9', background: '#000', borderRadius: 'var(--radius)' }}
                      onPlay={handleSyncPlay}
                      onPause={handleSyncPause}
                      onTimeUpdate={handleSyncSeek}
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      aspectRatio: '16/9',
                      background: '#0a0f1d',
                      borderRadius: 'var(--radius)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      {processing ? (
                        <>
                          <div style={{ fontSize: '14px', color: '#38bdf8', fontWeight: 'bold' }}>{processStatus.progress}%</div>
                          <div style={{ fontSize: '11px', opacity: 0.7 }}>{processStatus.message}</div>
                        </>
                      ) : (
                        <span style={{ fontSize: '12px', opacity: 0.5 }}>Click "Run Dolphin Detection" to render tracking video feed</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Protected Species Dolphin Alert Banner */}
              {results && (results.has_dolphin || results.peak_dolphin_count > 0) && (
                <div style={{
                  padding: '16px',
                  borderRadius: 'var(--radius)',
                  background: 'linear-gradient(135deg, rgba(217, 70, 239, 0.15), rgba(168, 85, 247, 0.1))',
                  border: '1px solid #d946ef',
                  color: '#f5d0fe',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ fontSize: '28px' }}>🐬</div>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#f0abfc' }}>
                        PROTECTED SPECIES ALERT: DOLPHIN DETECTED
                      </div>
                      <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '2px' }}>
                        Identified in {results.total_dolphin_frames || 1} frame(s) (Peak Count: {results.peak_dolphin_count}). Auto-flagged as <strong style={{ color: '#fde047' }}>Bycatch species (High Severity)</strong> in SQLite database.
                      </div>
                    </div>
                  </div>

                  {results.dolphin_events && results.dolphin_events.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '10px', opacity: 0.8 }}>Skip to:</span>
                      {results.dolphin_events.slice(0, 4).map((ev, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            if (originalVideoRef.current) originalVideoRef.current.currentTime = ev.timestamp;
                            if (processedVideoRef.current) processedVideoRef.current.currentTime = ev.timestamp;
                          }}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            background: '#701a75',
                            border: '1px solid #d946ef',
                            color: '#ffffff',
                            fontSize: '11px',
                            cursor: 'pointer'
                          }}
                        >
                          {ev.timestamp}s
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Stats Metrics Grid */}
              {results && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: results.has_dolphin ? 'repeat(5, 1fr)' : 'repeat(4, 1fr)',
                  gap: 'var(--space-3)'
                }}>
                  {results.has_dolphin && (
                    <div style={{
                      padding: '12px',
                      background: 'rgba(217, 70, 239, 0.1)',
                      border: '1px solid #d946ef',
                      borderRadius: 'var(--radius)',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.8, color: '#f0abfc' }}>🐬 Dolphin Peak</div>
                      <div style={{ fontSize: '22px', fontWeight: '900', color: '#f5d0fe', marginTop: '2px' }}>{results.peak_dolphin_count || 1}</div>
                      <div style={{ fontSize: '9px', color: '#f0abfc', marginTop: '2px' }}>Protected Species</div>
                    </div>
                  )}

                  <div style={{ padding: '12px', background: 'var(--color-bg)', border: '1px solid var(--color-divider)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.6 }}>Peak Objects</div>
                    <div style={{ fontSize: '22px', fontWeight: '900', color: '#34d399', marginTop: '2px' }}>{results.peak_count}</div>
                    <div style={{ fontSize: '9px', opacity: 0.5, marginTop: '2px' }}>Max objects in frame</div>
                  </div>

                  <div style={{ padding: '12px', background: 'var(--color-bg)', border: '1px solid var(--color-divider)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.6 }}>Average Count</div>
                    <div style={{ fontSize: '22px', fontWeight: '900', color: '#38bdf8', marginTop: '2px' }}>{results.average_count}</div>
                    <div style={{ fontSize: '9px', opacity: 0.5, marginTop: '2px' }}>Avg per frame</div>
                  </div>

                  <div style={{ padding: '12px', background: 'var(--color-bg)', border: '1px solid var(--color-divider)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.6 }}>Compute Time</div>
                    <div style={{ fontSize: '22px', fontWeight: '900', color: '#818cf8', marginTop: '2px' }}>{results.duration_seconds.toFixed(1)}s</div>
                    <div style={{ fontSize: '9px', opacity: 0.5, marginTop: '2px' }}>YOLO inference runtime</div>
                  </div>

                  <div style={{ padding: '12px', background: 'var(--color-bg)', border: '1px solid var(--color-divider)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.6 }}>Frame Coverage</div>
                    <div style={{ fontSize: '22px', fontWeight: '900', marginTop: '2px' }}>{results.total_frames}</div>
                    <div style={{ fontSize: '9px', opacity: 0.5, marginTop: '2px' }}>Total video frames</div>
                  </div>
                </div>
              )}

            </>
          )}

        </div>
      </div>

    </div>
  );
}
