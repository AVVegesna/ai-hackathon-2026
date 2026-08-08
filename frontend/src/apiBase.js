// In production the Express server serves this bundle and the API from the same
// origin, so a relative base works everywhere. In dev, Vite proxies /api,
// /uploads and /results to the backend (see vite.config.js).
// Set VITE_API_BASE_URL only when the frontend is hosted apart from the API.
const SERVER_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')

export const API_URL = `${SERVER_URL}/api`

// Videos and processed results are served as static files, not under /api.
export const mediaUrl = (pathname) => `${SERVER_URL}${pathname}`
