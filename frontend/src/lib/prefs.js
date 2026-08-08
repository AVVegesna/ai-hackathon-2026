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
