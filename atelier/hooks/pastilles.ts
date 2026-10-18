// Les pastilles du bandeau, quelle que soit leur source (tâches de Claude,
// sous-agents, build) : un rond en pointillé qui attend, l'orbe qui respire
// pendant que ça avance, une coche une fois fait, une croix rouge en cas
// d'échec. Le survol d'une pastille montre son infobulle (`<title>`) : à
// dessiner avec `isInteractive`.

import { CSS_ORBE, svgOrbe } from './orbe'

export type Forme = 'attente' | 'encours' | 'faite' | 'echec'
export type Pastille = {
  /** Son nom dans la bande partagée (`tache-plan-2`, `agent-a1`, `build`) : un autre mod (Clawd) peut la viser */
  id?: string
  /** L'infobulle du survol */
  titre: string
  forme: Forme
  /** Une couleur propre (celle du modèle d'un sous-agent), sinon les couleurs du thème */
  teinte?: string
  /** Le sonar : l'âge (ms) des dernières ondes, chacune émise quand un sous-agent a lancé un outil */
  ondes?: number[]
}

/** Où une pastille nommée est dessinée : en px depuis le bord gauche de son SVG */
export type PlacePastille = { id: string; x: number; largeur: number; forme: Forme; titre: string; teinte?: string }

/** La durée d'une onde du sonar */
export const DUREE_ONDE = 1_200

const VERT = '#4cc38a'
const ROUGE = '#ef5b5f'
const HAUTEUR = 18
const PAS = 17
const R = 5.5
/** Entre deux groupes de pastilles (les tâches, puis les sous-agents) */
const ECART = 10
/** L'orbe de l'étape en cours : son carré, et combien au plus (chacun pèse ~24 Ko de SVG) */
const COTE_ORBE = 16
export const MAX_ORBES = 3

/** Un texte sûr dans le SVG : échappé, sans séquence de couleur ni caractère de contrôle (interdit en XML, il casserait tout le dessin) */
const echappe = (s: string) =>
  s
    .replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ufffe\uffff]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
/** Une couleur sûre à écrire dans le SVG (#rgb ou #rrggbb), sinon rien */
const couleur = (c: string | undefined) => (c && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(c) ? c : undefined)

/**
 * Les groupes de pastilles en un SVG, séparés d'un trait discret. `tourne` :
 * Claude travaille, les orbes s'animent ; sinon ils restent immobiles. Au-delà
 * de trois orbes à la fois, les suivants gardent un simple anneau, plus léger.
 * `caches` : les pastilles qu'un autre mod tient en ce moment (Clawd qui joue
 * avec) ; leur place reste, vide, jusqu'à ce qu'il les rende.
 */
export function svgPastilles(
  groupes: readonly (readonly Pastille[])[],
  tourne = true,
  caches: ReadonlySet<string> = new Set(),
): { svg: string; largeur: number; places: PlacePastille[] } {
  const cy = HAUTEUR / 2
  let corps = ''
  let orbes = 0
  let x = 0
  const places: PlacePastille[] = []
  const pleins = groupes.filter(g => g.length > 0)
  pleins.forEach((groupe, ig) => {
    if (ig > 0) {
      corps += `<rect class="sep" x="${x + ECART / 2 - 0.5}" y="4" width="1" height="10" rx=".5"/>`
      x += ECART
    }
    for (const p of groupe) {
      const cx = x + PAS / 2
      const teinte = couleur(p.teinte)
      if (p.id) places.push({ id: p.id, x, largeur: PAS, forme: p.forme, titre: p.titre, ...(teinte ? { teinte } : {}) })
      if (p.id && caches.has(p.id)) {
        x += PAS
        continue
      }
      corps += `<g class="t"><title>${echappe(p.titre)}</title>`
      // une zone de survol pleine (invisible) : le rond en pointillé seul serait dur à viser
      corps += `<circle class="zone" cx="${cx}" cy="${cy}" r="${PAS / 2}"/>`
      // les ondes, recalées sur leur heure réelle : un redessin ne relance pas une onde déjà passée
      for (const age of (p.ondes ?? []).filter(a => a >= 0 && a < DUREE_ONDE)) {
        corps += `<circle class="onde" cx="${cx}" cy="${cy}" r="${R + 0.5}" style="animation-delay:-${Math.round(age)}ms${teinte ? `;stroke:${teinte}` : ''}"/>`
      }
      if (p.forme === 'faite' || p.forme === 'echec') {
        corps += `<circle cx="${cx}" cy="${cy}" r="${R + 0.5}" fill="${p.forme === 'echec' ? ROUGE : (teinte ?? VERT)}"/>`
        corps +=
          p.forme === 'faite'
            ? `<path class="coche" d="M${cx - 2.8} ${cy + 0.1} l1.9 1.9 l3.7 -3.9"/>`
            : `<path class="coche" d="M${cx - 2.3} ${cy - 2.3} l4.6 4.6 M${cx + 2.3} ${cy - 2.3} l-4.6 4.6"/>`
      } else if (p.forme === 'encours' && orbes < MAX_ORBES) {
        orbes++
        corps += svgOrbe(cx, cy, COTE_ORBE, tourne, teinte)
      } else if (p.forme === 'encours') {
        corps += `<circle class="piste" cx="${cx}" cy="${cy}" r="${R}"/>`
        corps += `<path class="arc" d="M${cx} ${cy - R} A${R} ${R} 0 0 1 ${cx + R} ${cy}"${teinte ? ` style="stroke:${teinte}"` : ''}>`
        if (tourne) corps += `<animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="0.9s" repeatCount="indefinite"/>`
        corps += '</path>'
      } else {
        corps += `<circle class="attente" cx="${cx}" cy="${cy}" r="${R}"${teinte ? ` style="stroke:${teinte}"` : ''}/>`
      }
      corps += '</g>'
      x += PAS
    }
  })
  const largeur = Math.max(1, x)
  const css =
    `.zone{fill:transparent}.t:hover .zone{fill:#ffffff14}.sep{fill:#ffffff24}` +
    `.attente{fill:none;stroke:#8b9097;stroke-width:1.4;stroke-dasharray:2.2 2.1}` +
    `.piste{fill:none;stroke:#ffffff2e;stroke-width:1.6}.arc{fill:none;stroke:#e6e6e6;stroke-width:1.8;stroke-linecap:round}` +
    `.coche{fill:none;stroke:#fff;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}` +
    `@media (prefers-color-scheme: light){.t:hover .zone{fill:#0000000f}.sep{fill:#0000001f}.attente{stroke:#9aa0a6}.piste{stroke:#0000001f}.arc{stroke:#3a3d42}}` +
    (corps.includes('class="onde"')
      ? `.onde{fill:none;stroke:#e6e6e6;stroke-width:1.2;opacity:0;transform-box:fill-box;transform-origin:center;animation:onde ${DUREE_ONDE}ms ease-out forwards}` +
        `@keyframes onde{from{opacity:.9;transform:scale(1)}to{opacity:0;transform:scale(1.45)}}` +
        `@media (prefers-color-scheme: light){.onde{stroke:#3a3d42}}@media (prefers-reduced-motion: reduce){.onde{display:none}}`
      : '') +
    (orbes ? CSS_ORBE : '')
  return {
    largeur,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largeur} ${HAUTEUR}"><style>${css}</style>${corps}</svg>`,
    places,
  }
}
