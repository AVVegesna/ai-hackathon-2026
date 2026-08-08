// Single place the app talks to the API. Requests go through the Vite proxy
// on a relative path, so there is no hardcoded localhost:3000 to break when
// this is served from anywhere other than a dev machine.
//
// apiBase keeps that relative default but allows VITE_API_BASE_URL to point at
// a different origin, for a deployment that hosts the frontend apart from the
// API. mediaUrl is re-exported here so components have one import for both.

import { API_URL, mediaUrl } from '../apiBase';

const BASE = API_URL;

export { mediaUrl };

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    // A fetch rejection is a transport failure, not an API response — say so
    // plainly rather than surfacing "Failed to fetch" to a reviewer.
    throw new ApiError('Cannot reach the server. Check that the API is running.', 0);
  }

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) detail = body.error;
    } catch {
      /* non-JSON error body — keep the status-based message */
    }
    throw new ApiError(detail, res.status);
  }

  if (res.status === 204) return null;
  return res.json();
}

const qs = (params) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null || v === '') continue;
    sp.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
};

export const api = {
  queue: (params) => request(`/queue${qs(params)}`),
  queueStats: () => request('/queue/stats'),
  queueFacets: () => request('/queue/facets'),

  flag: (id) => request(`/flags/${id}`),
  resolveFlag: (id, body) =>
    request(`/flags/${id}/resolve`, { method: 'PUT', body: JSON.stringify(body) }),
  createFlag: (body) => request('/flags', { method: 'POST', body: JSON.stringify(body) }),
  recordingFlags: (recordingId) => request(`/recordings/${recordingId}/flags`),

  vessels: () => request('/vessels'),
  vessel: (id) => request(`/vessels/${id}`),
  vesselRecordings: (id) => request(`/vessels/${id}/recordings`),
  vesselReviews: (id) => request(`/vessels/${id}/reviews`),
  createReview: (body) => request('/reviews', { method: 'POST', body: JSON.stringify(body) }),

  audit: (params) => request(`/audit${qs(params)}`),

  fleetOverview: () => request('/fleet/overview'),

  videos: () => request('/videos'),
  detectionStatus: (videoId) => request(`/status/${videoId}`),
  detectionResults: (videoId) => request(`/results/${videoId}`),
  startDetection: (videoId, body) =>
    request(`/detect/${videoId}`, { method: 'POST', body: JSON.stringify(body || {}) }),
};

export { ApiError };
