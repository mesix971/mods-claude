// Jauges de quotas (5 h, 7 j) et de contexte, à lire d'un coup d'œil.
//
// La couleur dit le niveau. Sur les quotas, un petit trait vertical marque le
// temps déjà écoulé dans la fenêtre : si la barre dépasse le trait, tu
// consommes plus vite que le temps ne passe, et la jauge vire à l'ambre même à
// bas pourcentage, parce qu'à ce rythme la limite tombe avant le reset.

import type { AtelierUsage } from '../types'

export type Niveau = 'ok' | 'attention' | 'critique'
export type Jauge = {
  nom: string
  pct: number
  /** part de la fenêtre déjà écoulée (0 à 1), null si on ne la connaît pas */
  ecoule: number | null
  niveau: Niveau
  /** heure du reset (ms), null si inconnue */
  reset: number | null
}

const CINQ_H = 5 * 3600_000
const SEPT_J = 7 * 24 * 3600_000

function partEcoulee(resetsAt: string | undefined, fenetre: number, maintenant: number) {
  const fin = resetsAt ? Date.parse(resetsAt) : NaN
  if (Number.isNaN(fin)) return null
  return Math.min(1, Math.max(0, 1 - (fin - maintenant) / fenetre))
}

function niveauQuota(pct: number, ecoule: number | null): Niveau {
  if (pct >= 90) return 'critique'
  if (pct >= 75) return 'attention'
  // rythme : à ce train-là, atteint-on 100 % avant le reset ? (pas trop tôt
  // dans la fenêtre, ni sur des miettes, pour éviter les fausses alertes)
  if (ecoule !== null && ecoule >= 0.1 && pct >= 20 && pct / (ecoule * 100) > 1.05) return 'attention'
  return 'ok'
}

export function jauges(u: AtelierUsage, maintenant: number): Jauge[] {
  const l: Jauge[] = []
  const quota = (nom: string, w: { percent: number; resetsAt?: string } | null, fenetre: number) => {
    if (!w) return
    const ecoule = partEcoulee(w.resetsAt, fenetre, maintenant)
    const reset = w.resetsAt ? Date.parse(w.resetsAt) : NaN
    l.push({ nom, pct: w.percent, ecoule, niveau: niveauQuota(w.percent, ecoule), reset: Number.isNaN(reset) ? null : reset })
  }
  quota('5 h', u.fiveHour, CINQ_H)
  quota('7 j', u.sevenDay, SEPT_J)
  if (u.contextPercent !== null) {
    const p = u.contextPercent
    l.push({ nom: 'ctx', pct: p, ecoule: null, niveau: p >= 90 ? 'critique' : p >= 75 ? 'attention' : 'ok', reset: null })
  }
  return l
}

/** Le texte qui suit une barre : le pourcentage, et l'heure du reset quand ça devient serré. */
const legende = (j: Jauge, hhmm: (ms: number) => string) =>
  `${Math.round(j.pct)} %` + (j.reset !== null && j.niveau !== 'ok' ? ` → ${hhmm(j.reset)}` : '')

export const COULEURS: Record<Niveau, string> = { ok: '#4cc38a', attention: '#f2b33d', critique: '#ef5b5f' }

const HAUTEUR = 18
const ETIQUETTE = 22
const BARRE = 56
// largeur approximative d'un caractère à 10,5 px (police système)
const CAR = 6.1

/** Les jauges en SVG (fond transparent, couleurs du texte selon le thème). */
export function svgJauges(l: readonly Jauge[], hhmm: (ms: number) => string): { svg: string; largeur: number } {
  let x = 0
  let corps = ''
  for (const j of l) {
    const bx = x + ETIQUETTE
    const plein = (Math.max(0, Math.min(100, j.pct)) / 100) * BARRE
    const texte = legende(j, hhmm)
    corps += `<text class="lab" x="${x}" y="13">${j.nom}</text>`
    corps += `<rect class="piste" x="${bx}" y="6" width="${BARRE}" height="6" rx="3"/>`
    if (plein > 0) {
      corps += `<rect class="${j.niveau === 'critique' ? 'pulse' : ''}" x="${bx}" y="6" width="${Math.max(3, plein).toFixed(1)}" height="6" rx="3" fill="${COULEURS[j.niveau]}"/>`
    }
    if (j.ecoule !== null) {
      corps += `<rect class="tic" x="${(bx + j.ecoule * BARRE - 1).toFixed(1)}" y="3" width="2" height="12" rx="1"/>`
    }
    corps += `<text class="pc ${j.niveau}" x="${bx + BARRE + 5}" y="13">${texte}</text>`
    x = bx + BARRE + 5 + Math.ceil(texte.length * CAR) + 14
  }
  const largeur = Math.max(1, x - 14)
  const css =
    `.lab{font:600 10.5px "Segoe UI",system-ui,sans-serif;fill:#a3a7ad}` +
    `.pc{font:10.5px "Segoe UI",system-ui,sans-serif;fill:#a3a7ad;font-variant-numeric:tabular-nums}` +
    `.pc.attention{fill:#f2b33d}.pc.critique{fill:#ef5b5f;font-weight:700}` +
    `.piste{fill:#ffffff24}.tic{fill:#f2f2f2;opacity:.9}` +
    `.pulse{animation:pulse 1.2s ease-in-out infinite}@keyframes pulse{50%{opacity:.45}}` +
    `@media (prefers-color-scheme: light){.lab,.pc{fill:#5f646b}.pc.attention{fill:#b7791f}.piste{fill:#0000001f}.tic{fill:#2b2b2b}}`
  return {
    largeur,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largeur} ${HAUTEUR}"><style>${css}</style>${corps}</svg>`,
  }
}

/** La même chose en texte, pour le terminal : ▰▰▰▱▱▱▱▱ */
export function texteJauges(l: readonly Jauge[], hhmm: (ms: number) => string) {
  return l.map(j => {
    const plein = Math.round((Math.max(0, Math.min(100, j.pct)) / 100) * 8)
    return { niveau: j.niveau, texte: `${j.nom} ${'▰'.repeat(plein)}${'▱'.repeat(8 - plein)} ${legende(j, hhmm)}` }
  })
}

/** Ce que disent les jauges, en clair (texte alternatif). */
export const resumeJauges = (l: readonly Jauge[], hhmm: (ms: number) => string) =>
  'Quotas : ' + l.map(j => `${j.nom === 'ctx' ? 'contexte' : j.nom} ${legende(j, hhmm)}${j.niveau !== 'ok' ? ` (${j.niveau})` : ''}`).join(', ')
