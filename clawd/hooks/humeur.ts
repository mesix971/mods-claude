// Son humeur : une petite vie intérieure, qui décide de ce qu'il fait quand
// personne ne lui demande rien. Trois jauges, de 0 à 1, gardées d'une
// session à l'autre :
//
// - l'énergie baisse pendant qu'il est éveillé, remonte en dormant : le jour,
//   à plat, il fait une sieste et se réveille tout seul ; la nuit, il dort
//   jusqu'à ton retour ;
// - l'ennui monte quand tu ne dis rien, retombe dès que tu es là : il cherche
//   alors ton attention (coucou, une question, un numéro sur la bande) ;
// - la joie monte quand tu lui parles ou le caresses, et retombe doucement.
//
// Ses activités au repos sont tirées selon elle : fatigué, il choisit le
// calme ; joyeux, il bouge ; seul trop longtemps, il vient te chercher.

import type { ClawdAnim } from '../types'

export type Humeur = { energie: number; ennui: number; joie: number }

export const HUMEUR_DEPART: Humeur = { energie: 1, ennui: 0, joie: 0.5 }

const borne = (v: number) => Math.max(0, Math.min(1, v))
const MIN = 60_000

export const estHumeur = (v: unknown): v is Humeur =>
  typeof v === 'object' &&
  v !== null &&
  (['energie', 'ennui', 'joie'] as const).every(k => typeof (v as Humeur)[k] === 'number' && Number.isFinite((v as Humeur)[k]))

/** Éveillé, il tient environ ce temps avant d'être à plat ; endormi, il se recharge en ce temps */
export const AUTONOMIE_MS = 25 * MIN
const RECHARGE_MS = 5 * MIN
/** Seul, il s'ennuie tout à fait en ce temps ; avec toi, l'ennui retombe en celui-ci */
const ENNUI_MS = 12 * MIN
const COMPAGNIE_MS = 2 * MIN
/** Sa joie revient vers le milieu en ce temps */
const APAISE_MS = 30 * MIN

/**
 * Le temps passe (`dt` ms) : éveillé, il se fatigue ; endormi, il se repose ;
 * `seul` (tu n'as rien fait depuis un moment), il s'ennuie ; et sa joie
 * revient doucement vers le milieu.
 */
export function vit(h: Humeur, dt: number, o: { dort: boolean; seul: boolean }): Humeur {
  const d = Math.max(0, Math.min(dt, 10 * MIN))
  return {
    energie: borne(h.energie + (o.dort ? d / RECHARGE_MS : -d / AUTONOMIE_MS)),
    ennui: borne(o.dort ? h.ennui : o.seul ? h.ennui + d / ENNUI_MS : h.ennui - d / COMPAGNIE_MS),
    joie: borne(h.joie + (0.5 - h.joie) * Math.min(1, d / APAISE_MS)),
  }
}

/** Ce qui le touche : tu lui parles (ou travailles avec lui), tu le caresses, quelque chose réussit */
export function vecu(h: Humeur, quoi: 'parle' | 'caresse' | 'reussite'): Humeur {
  if (quoi === 'caresse') return { ...h, ennui: 0, joie: borne(h.joie + 0.3) }
  if (quoi === 'reussite') return { ...h, joie: borne(h.joie + 0.15) }
  return { ...h, ennui: borne(h.ennui - 0.5), joie: borne(h.joie + 0.05) }
}

/** La nuit (22 h – 7 h) : il dort pour de bon quand tu n'es plus là */
export const estNuit = (heure: number) => heure >= 22 || heure < 7

const CALMES: readonly ClawdAnim[] = ['lecture', 'meditation', 'cafe', 'peche', 'arrosage', 'bulles', 'cookie', 'glace', 'gratte']
const VIVES: readonly ClawdAnim[] = ['danse', 'floss', 'orange', 'defaut', 'griddy', 'takel', 'sixseven', 'corde', 'ballon', 'pirouette', 'yoyo', 'jongle', 'guitare', 'papillon', 'etirement']
/** Pour attirer ton attention : il te fait signe, se demande où tu es, t'attend */
const APPELS: readonly ClawdAnim[] = ['coucou', 'question', 'attend']

/**
 * Son activité au repos, tirée selon son humeur (jamais deux fois la même
 * d'affilée) : le calme quand il est fatigué, le mouvement quand il est
 * joyeux et en forme, les appels quand il s'ennuie.
 */
export function choisit(h: Humeur, activites: readonly ClawdAnim[], avant: ClawdAnim | null, hasard: () => number = Math.random): ClawdAnim {
  const poids = (a: ClawdAnim) => {
    let p = 1
    if (CALMES.includes(a)) p *= h.energie < 0.35 ? 3 : 1
    if (VIVES.includes(a)) p *= h.energie < 0.35 ? 0.3 : 1 + h.joie * 1.5
    if (APPELS.includes(a)) p *= 1 + h.ennui * 6
    return p
  }
  const choix = [...new Set([...activites, ...APPELS])].filter(a => a !== avant)
  const total = choix.reduce((s, a) => s + poids(a), 0)
  let r = hasard() * total
  for (const a of choix) {
    r -= poids(a)
    if (r < 0) return a
  }
  return choix[choix.length - 1]!
}

/** Au repos, l'écart entre deux numéros sur la bande : 6 min, jusqu'à 3 min quand il s'ennuie */
export const ecartRepos = (h: Humeur) => Math.round(6 * MIN * (1 - 0.5 * h.ennui))

/** Ce qu'il dit de lui, pour /clawd */
export function decrit(h: Humeur, dort: boolean): string {
  const pc = (v: number) => `${Math.round(v * 100)} %`
  const etat = dort ? 'il dort' : h.energie < 0.2 ? 'il pique du nez' : h.ennui > 0.6 ? 'il s’ennuie de toi' : h.joie > 0.7 ? 'il est de très bonne humeur' : 'il vaque à ses occupations'
  return `${etat} (énergie ${pc(h.energie)}, ennui ${pc(h.ennui)}, joie ${pc(h.joie)})`
}
