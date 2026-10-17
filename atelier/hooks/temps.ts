// L'heure et les durées, écrites à la française pour les infobulles du bandeau.

/** 14:32 (heure locale) */
export function heure(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Pour ce qui dure encore (redessiné chaque minute) : < 1 min · 3 min · 1 h 05 */
export function dureeCourte(ms: number): string {
  const min = Math.floor(Math.max(0, ms) / 60_000)
  if (min < 1) return '< 1 min'
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`
}

/** 45 s · 3 min 12 s · 1 h 05 */
export function duree(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s} s`
  const min = Math.floor(s / 60)
  if (min < 60) return `${min} min${s % 60 ? ` ${String(s % 60).padStart(2, '0')} s` : ''}`
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`
}
