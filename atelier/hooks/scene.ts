// La bande partagée : ce qu'atelier dessine au-dessus du prompt, et où. Un
// autre mod du dépôt (Clawd) la lit pour jouer avec : marcher jusqu'à une
// pastille, la prendre, la rendre. Tant qu'il tient un élément (son état
// `clawd.emprunts`, chacun avec son échéance), atelier ne le dessine plus : sa
// place reste, vide. Et son numéro (son état `clawd.grandeScene`), atelier le
// pose par-dessus toute la bande : sa rangée est la seule à la couvrir.
//
// Les positions sont celles du dessin desktop : x et largeur en px CSS depuis
// le bord gauche du bandeau, la ligne comptée depuis le bas (0 : la dernière).
// Le plan sert aussi au dessin : les deux ne peuvent pas se contredire.

import type { AtelierAgent, AtelierAndroid, AtelierBuild, AtelierConso, AtelierElement, AtelierGit, AtelierScene, AtelierTache, AtelierUsage } from '../types'
import { pastillesAgents } from './agents'
import { buildVisible, pastilleBuild } from './build'
import { estLourde, texteConso, titreConso } from './conso'
import { idJauge, jauges, svgJauges } from './jauges'
import type { Jauge } from './jauges'
import { svgPastilles } from './pastilles'
import { largeurBouton, placeBouton, texteNouvelle } from './suite'
import type { Pastille } from './pastilles'
import { pastillesTaches } from './taches'
import { heure } from './temps'

/** Ce que le bandeau sait au moment de se dessiner */
export type EtatBandeau = {
  android: AtelierAndroid | null
  git: AtelierGit | null
  usage: AtelierUsage | null
  taches: readonly AtelierTache[]
  conso: AtelierConso | null
  build: AtelierBuild | null
  agents: readonly AtelierAgent[]
  busy: string | null
  /** Le conseil de modèle tel que le bandeau le montre (null : rien à dire) */
  conseil?: { texte: string; titre: string } | null
}

/** Ce que le bandeau dessine, ligne par ligne */
export type Plan = {
  lignes: AtelierScene['lignes']
  jauges: Jauge[]
  /** La conso du tour, après les jauges */
  conso: { texte: string; titre: string; lourde: boolean } | null
  /** Le conseil de modèle, après la conso */
  conseil: { texte: string; titre: string } | null
  /** Le build à montrer (un réussi s'efface au bout de 10 min) */
  build: AtelierBuild | null
  /** Les pastilles de la ligne du bas : le build (sans projet Android : sinon il est sur la ligne 📱), les tâches, les sous-agents */
  groupes: Pastille[][]
  /** Le bouton « Nouvelle conversation » quand il est temps d'en changer (posé juste après les jauges), sinon null */
  nouvelle: string | null
}

const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']
/**
 * La largeur d'une case de la bande en px CSS, sur desktop : la bande ne se
 * mesure qu'en cases (`bodyColumns`), un dessin qui doit la couvrir se règle
 * en px. Relevée le 2026-10-18 sur une capture du cadre : 95 colonnes, une
 * rangée de 751 px.
 */
export const CELLULE = 7.9

/** L'heure d'un reset, avec le jour quand il est loin (fenêtre de 7 j) */
export const quandDe = (maintenant: number) => (ms: number) => (ms - maintenant > 20 * 3600_000 ? `${JOURS[new Date(ms).getDay()]} ` : '') + heure(ms)

export function planBandeau(x: EtatBandeau, maintenant: number): Plan {
  const lj = x.usage ? jauges(x.usage, maintenant) : []
  const texte = texteConso(x.conso)
  const conso = texte ? { texte, titre: titreConso(x.conso), lourde: estLourde(x.conso) } : null
  const bv = buildVisible(x.build, maintenant) ? x.build : null
  const groupes = [...(bv && !x.android ? [[pastilleBuild(bv, maintenant)]] : []), pastillesTaches(x.taches, maintenant), pastillesAgents(x.agents, maintenant)].filter(
    g => g.length > 0,
  )
  const lignes: AtelierScene['lignes'] = [
    ...(x.android ? (['android'] as const) : []),
    ...(x.git ? (['git'] as const) : []),
    ...(lj.length > 0 || conso || x.conseil ? (['quotas'] as const) : []),
    ...(groupes.length > 0 ? (['pastilles'] as const) : []),
    ...(x.busy ? (['occupe'] as const) : []),
  ]
  return { lignes, jauges: lj, conso, conseil: x.conseil ?? null, build: bv, groupes, nouvelle: texteNouvelle(x.usage, x.conso) }
}

const genreDe = (id: string): AtelierElement['genre'] => (id.startsWith('agent-') ? 'agent' : id === 'build' ? 'build' : 'tache')

/** La bande partagée d'après le plan : chaque élément à la place où le dessin le met */
/**
 * La hauteur (px CSS) à laquelle le bandeau pose ses dessins (jauges,
 * pastilles), tous dessinés sur 18 unités de haut. L'app ne les laisse pas
 * dépasser la hauteur d'une ligne de texte (~17,2 px, relevé sur des
 * captures du cadre : tout était réduit de 4,4 %, et les places publiées
 * glissaient d'autant) : posés à 17 px, ils ne sont jamais réduits par
 * l'app, et leur échelle est connue au juste.
 */
export const HAUTEUR_DESSIN = 17
/** Les px CSS d'une unité de ces dessins : les places publiées sont celles qu'on voit */
export const ECHELLE = HAUTEUR_DESSIN / 18
const aLEchelle = (v: number) => +(v * ECHELLE).toFixed(1)

/** Un dessin d'élément sans son infobulle : Clawd le promène dans une image, où elle ne servirait pas */
const sansTitre = (svg: string) => svg.replace(/<title>[\s\S]*?<\/title>/g, '')

/** `bandePx` : la largeur de la bande en px, quand on la connaît (pour savoir si le bouton 🆕 tient après les jauges) */
export function sceneDuBandeau(p: Plan, quand: (ms: number) => string, bandePx: number | null = null): AtelierScene {
  const ligne = (nom: AtelierScene['lignes'][number]) => p.lignes.length - 1 - p.lignes.indexOf(nom)
  const elements: AtelierElement[] = []
  const quotas = p.lignes.includes('quotas') ? svgJauges(p.jauges, quand, { conso: p.conso, conseil: p.conseil }) : null
  // le bouton 🆕 quand il est temps : là où le rendu le pose (même règle), sa place au px près pour son début,
  // à quelques px près pour sa largeur (un bouton natif se mesure en cases de texte)
  const pastillesPx = p.lignes.includes('pastilles') ? aLEchelle(svgPastilles(p.groupes, false).largeur) : null
  const jaugesPx = quotas ? aLEchelle(quotas.largeur) : null
  const place = p.nouvelle ? placeBouton(p.nouvelle, CELLULE, bandePx, pastillesPx, jaugesPx) : null
  if (p.nouvelle && place) {
    elements.push({ id: 'nouvelle', genre: 'bouton', etat: 'clignote', x: (place === 'pastilles' ? pastillesPx : jaugesPx) ?? 0, largeur: largeurBouton(p.nouvelle, CELLULE), hauteur: HAUTEUR_DESSIN, ligne: ligne(place === 'pastilles' ? 'pastilles' : 'quotas') })
  }
  if (quotas) {
    for (const pl of quotas.places) {
      // son dessin seul, à l'identique : la même fonction, avec lui seul
      const j = p.jauges.find(j => idJauge(j) === pl.id)
      const seul = j
        ? svgJauges([j], quand)
        : pl.id === 'conso' && p.conso
          ? svgJauges([], quand, { conso: p.conso })
          : pl.id === 'conseil' && p.conseil
            ? svgJauges([], quand, { conseil: p.conseil })
            : null
      elements.push({ id: pl.id, genre: pl.genre, etat: pl.etat, x: aLEchelle(pl.x), largeur: aLEchelle(pl.largeur), hauteur: HAUTEUR_DESSIN, ligne: ligne('quotas'), ...(seul ? { dessin: sansTitre(seul.svg) } : {}) })
    }
  }
  if (p.lignes.includes('pastilles')) {
    const toutes = p.groupes.flat()
    for (const pl of svgPastilles(p.groupes, false).places) {
      // l'orbe en cours pèse ~24 Ko : Clawd en dessine une à lui
      const pa = pl.forme === 'encours' ? undefined : toutes.find(x => x.id === pl.id)
      elements.push({
        id: pl.id,
        genre: genreDe(pl.id),
        etat: pl.forme,
        x: aLEchelle(pl.x),
        largeur: aLEchelle(pl.largeur),
        hauteur: HAUTEUR_DESSIN,
        ligne: ligne('pastilles'),
        ...(pl.teinte ? { teinte: pl.teinte } : {}),
        ...(pa ? { dessin: sansTitre(svgPastilles([[{ ...pa, ondes: undefined }]], false).svg) } : {}),
      })
    }
  }
  return { lignes: p.lignes, elements }
}

type Emprunt = { id: string; jusqua: number }
const estEmprunt = (x: unknown): x is Emprunt =>
  typeof x === 'object' && x !== null && typeof (x as Emprunt).id === 'string' && typeof (x as Emprunt).jusqua === 'number'

/** Ce que Clawd tient encore, d'après son état : ses emprunts pas encore échus (un Clawd planté ne cache rien longtemps) */
export const empruntsDe = (v: unknown, maintenant: number): ReadonlySet<string> =>
  new Set(Array.isArray(v) ? v.filter(estEmprunt).filter(x => x.jusqua > maintenant).map(x => x.id) : [])

/** Le numéro que Clawd joue sur toute la bande, d'après son état, s'il n'est pas fini : son dessin et sa hauteur */
export function grandeSceneDe(v: unknown, maintenant: number): { svg: string; hauteur: number } | null {
  if (typeof v !== 'object' || v === null) return null
  const { svg, hauteur, fin } = v as Record<string, unknown>
  if (typeof svg !== 'string' || !svg.startsWith('<svg') || svg.length > 131_072) return null
  if (typeof hauteur !== 'number' || !(hauteur >= 1 && hauteur <= 200) || typeof fin !== 'number' || !(fin > maintenant)) return null
  return { svg, hauteur: Math.round(hauteur) }
}
