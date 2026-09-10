// The CSS display-mode: standalone media feature is the general/spec way
// to detect this, but it isn't reliable on every real iOS Safari home-
// screen PWA in practice. navigator.standalone is iOS Safari's own
// long-standing, purpose-built property for exactly this ("was this page
// launched from a home-screen icon"), so check that first and treat the
// media feature as a fallback for other platforms (Android/desktop
// installed PWAs) that don't expose navigator.standalone at all.
export function isStandalonePwa(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone
  if (typeof iosStandalone === 'boolean') return iosStandalone
  return window.matchMedia('(display-mode: standalone)').matches
}
