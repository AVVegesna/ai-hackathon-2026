import { useCallback, useEffect, useState } from 'react'

// Theme and density are stamped on <html> so CSS resolves them, and persisted
// so a reviewer's choice survives a reload. Three theme states, not two:
// 'system' deliberately stamps nothing and lets prefers-color-scheme decide.

const THEME_KEY = 'fmrp.theme'
const DENSITY_KEY = 'fmrp.density'

function read(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* private browsing — the in-memory value still applies for this session */
  }
}

export function useTheme() {
  const [theme, setTheme] = useState(() => read(THEME_KEY, 'system'))

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
    write(THEME_KEY, theme)
  }, [theme])

  const cycle = useCallback(() => {
    setTheme((t) => (t === 'system' ? 'light' : t === 'light' ? 'dark' : 'system'))
  }, [])

  return { theme, setTheme, cycle }
}

export function useDensity() {
  const [density, setDensity] = useState(() => read(DENSITY_KEY, 'compact'))

  useEffect(() => {
    document.documentElement.setAttribute('data-density', density)
    write(DENSITY_KEY, density)
  }, [density])

  const toggle = useCallback(() => {
    setDensity((d) => (d === 'compact' ? 'comfortable' : 'compact'))
  }, [])

  return { density, setDensity, toggle }
}

// The signed-in reviewer. Hardcoded for now, but read from one place so that
// every determination is attributed through a single seam — when real auth
// lands, only this function changes.
export function useSession() {
  return {
    name: 'M. Okafor',
    role: 'Observer Grade 2',
    // Grade 2 may determine flags but not sign off a vessel review; the UI
    // disables what the role cannot do and says why, rather than hiding it.
    can: { determineFlags: true, submitVesselReview: false, export: true },
  }
}
