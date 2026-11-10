// Sa conscience : ce qui se passe dans sa tête, au-delà de son humeur
// (humeur.ts : énergie, ennui, joie). Quatre choses, toutes calculées ici,
// sans rien dessiner :
//
// - ses besoins (faim, soif, envie de bouger, curiosité) montent avec le
//   temps ; pressant, un besoin décide de son activité (il y pense, puis il
//   la fait) et retombe une fois comblé : il mange parce qu'il a faim ;
// - ses émotions durent : fier après un push, une délivrance ou un niveau ;
//   inquiet quand les échecs s'enchaînent ; vexé quand tu le zappes trois
//   fois de suite. Elles colorent ses choix pendant plusieurs minutes ;
// - ton rythme : tes heures d'arrivée et de départ, jour après jour ; il te
//   guette à ton heure, et bâille quand tu t'arrêtes d'habitude ;
// - ses pensées : une phrase qui dit tout ça (/clawd, sa carte, son 💭).

import type { ClawdAnim } from '../types'
import type { Humeur } from './humeur'

const MIN = 60_000
const borne = (v: number) => Math.max(0, Math.min(1, v))
const fini = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

// ------------------------------------------------------------ ses besoins

export const BESOINS = ['faim', 'soif', 'bouger', 'curiosite'] as const
export type Besoin = (typeof BESOINS)[number]
export type Besoins = Record<Besoin, number>

/** Éveillé, chaque besoin est à son comble en ce temps */
const PLEIN_MS: Besoins = { faim: 50 * MIN, soif: 35 * MIN, bouger: 25 * MIN, curiosite: 40 * MIN }
/** Endormi, seules sa faim et sa soif montent, et bien plus lentement */
const RALENTI = 5
/** À partir de là, un besoin peut décider de son activité ; à 1, il ne pense plus qu'à ça */
export const ENVIE_DES = 0.6
/** Ce qu'une activité doit combler d'un besoin pour qu'il la choisisse exprès */
const ASSEZ = 0.4

/** Ce que chaque activité comble, et de combien */
const COMBLE: Partial<Record<ClawdAnim, Partial<Besoins>>> = {
  cookie: { faim: 0.7 },
  glace: { faim: 0.6 },
  guimauve: { faim: 0.5 },
  cafe: { soif: 0.9 },
  danse: { bouger: 0.8 },
  floss: { bouger: 0.8 },
  orange: { bouger: 0.8 },
  defaut: { bouger: 0.8 },
  griddy: { bouger: 0.8 },
  takel: { bouger: 0.8 },
  sixseven: { bouger: 0.8 },
  corde: { bouger: 0.8 },
  ballon: { bouger: 0.7 },
  pirouette: { bouger: 0.6 },
  jongle: { bouger: 0.5 },
  etirement: { bouger: 0.5 },
  yoyo: { bouger: 0.4 },
  lecture: { curiosite: 0.8 },
  papillon: { curiosite: 0.5, bouger: 0.2 },
  peche: { curiosite: 0.4 },
  gratte: { curiosite: 0.3 },
}

// ----------------------------------------------------------- ses émotions

export type Sentiment = 'fier' | 'inquiet' | 'vexe'
export type Cause = 'push' | 'delivrance' | 'niveau' | 'echecs' | 'zaps'
/** Une émotion, sa cause et le temps qu'elle dure (`n` : combien d'échecs d'affilée l'inquiètent) */
export type Emotion = { nom: Sentiment; cause: Cause; depuis: number; jusqua: number; n?: number }

const DUREE: Record<Sentiment, number> = { fier: 10 * MIN, inquiet: 15 * MIN, vexe: 4 * MIN }
/** Trois zaps (🎲) en ce temps : il se vexe */
const ZAPS_MS = 2 * MIN
const ZAPS_DE_TROP = 3
/** Ce que regarder ton travail nourrit de sa curiosité, à chaque outil lancé */
const VU_TRAVAILLER = 0.02

/** Son esprit : ses besoins, son émotion du moment, tes derniers zaps */
export type Esprit = { besoins: Besoins; emotion: Emotion | null; zaps: number[] }

export const ESPRIT_DEPART: Esprit = { besoins: { faim: 0.3, soif: 0.2, bouger: 0.2, curiosite: 0.3 }, emotion: null, zaps: [] }

const SENTIMENTS: readonly Sentiment[] = ['fier', 'inquiet', 'vexe']
const CAUSES: readonly Cause[] = ['push', 'delivrance', 'niveau', 'echecs', 'zaps']

/** Son esprit tel qu'il a été gardé (d'une session à l'autre), ou null s'il n'a pas cette forme */
export function espritDe(v: unknown): Esprit | null {
  if (typeof v !== 'object' || v === null) return null
  const b = (v as { besoins?: unknown }).besoins
  if (typeof b !== 'object' || b === null || !BESOINS.every(k => fini((b as Besoins)[k]))) return null
  const besoins = Object.fromEntries(BESOINS.map(k => [k, borne((b as Besoins)[k])])) as Besoins
  const e = (v as { emotion?: unknown }).emotion as Partial<Emotion> | null | undefined
  const emotion: Emotion | null =
    e && SENTIMENTS.includes(e.nom as Sentiment) && CAUSES.includes(e.cause as Cause) && fini(e.depuis) && fini(e.jusqua)
      ? { nom: e.nom!, cause: e.cause!, depuis: e.depuis, jusqua: e.jusqua, ...(fini(e.n) ? { n: e.n } : {}) }
      : null
  return { besoins, emotion, zaps: [] }
}

/** Son émotion à cet instant (null : aucune, ou passée ; une horloge qui a reculé l'efface aussi) */
export const emotionDe = (e: Esprit, maintenant: number): Emotion | null =>
  e.emotion && maintenant >= e.emotion.depuis && maintenant < e.emotion.jusqua ? e.emotion : null

/**
 * Le temps passe (`dt` ms) : éveillé, ses besoins montent ; endormi, seules sa
 * faim et sa soif, lentement (il se réveille avec une petite faim). Une
 * émotion passée s'efface.
 */
export function vieillit(e: Esprit, dt: number, o: { dort: boolean }, maintenant: number): Esprit {
  const d = Math.max(0, dt)
  const besoins = Object.fromEntries(
    BESOINS.map(k => {
      const monte = o.dort ? (k === 'faim' || k === 'soif' ? d / PLEIN_MS[k] / RALENTI : 0) : d / PLEIN_MS[k]
      return [k, borne(e.besoins[k] + monte)]
    }),
  ) as Besoins
  return { besoins, emotion: emotionDe(e, maintenant), zaps: e.zaps.filter(t => maintenant - t < ZAPS_MS && t <= maintenant) }
}

/**
 * Ce qu'il ne fait que par besoin : manger et boire. Il ne grignote pas sans
 * faim, ne boit pas sans soif (sinon, à force de cookies tirés au sort, sa
 * faim n'aurait jamais le temps de monter) ; bouger ou lire, il le fait aussi
 * pour le plaisir.
 */
export const parBesoinSeulement = (anim: ClawdAnim): boolean => (COMBLE[anim]?.faim ?? 0) >= ASSEZ || (COMBLE[anim]?.soif ?? 0) >= ASSEZ

/** L'activité qu'il joue comble ce qu'elle comble (un cookie, sa faim) */
export function comble(e: Esprit, anim: ClawdAnim): Esprit {
  const c = COMBLE[anim]
  if (!c) return e
  return { ...e, besoins: Object.fromEntries(BESOINS.map(k => [k, borne(e.besoins[k] - (c[k] ?? 0))])) as Besoins }
}

/** Son besoin le plus fort, et à quel point */
export function besoinFort(e: Esprit): { besoin: Besoin; force: number } {
  const besoin = [...BESOINS].sort((a, b) => e.besoins[b] - e.besoins[a])[0]!
  return { besoin, force: e.besoins[besoin] }
}

/**
 * Un besoin pressant décide de son activité, parmi `activites` (jamais deux
 * fois la même d'affilée) : de plus en plus sûrement à mesure qu'il monte.
 * Inquiet, il n'a pas le cœur à bouger. Null : rien ne presse, son humeur
 * décide.
 */
export function envie(e: Esprit, activites: readonly ClawdAnim[], avant: ClawdAnim | null, maintenant: number, hasard: () => number = Math.random): { besoin: Besoin; anim: ClawdAnim } | null {
  const inquiet = emotionDe(e, maintenant)?.nom === 'inquiet'
  const besoin = BESOINS.filter(b => !(inquiet && b === 'bouger')).sort((a, b) => e.besoins[b] - e.besoins[a])[0]
  if (!besoin || e.besoins[besoin] < ENVIE_DES) return null
  if (hasard() >= (e.besoins[besoin] - ENVIE_DES) / (1 - ENVIE_DES) + 0.15) return null
  const choix = activites.filter(a => a !== avant && (COMBLE[a]?.[besoin] ?? 0) >= ASSEZ)
  if (!choix.length) return null
  return { besoin, anim: choix[Math.min(choix.length - 1, Math.floor(hasard() * choix.length))]! }
}

/** Ce qui lui arrive */
export type Vecu =
  | { quoi: 'push' | 'delivrance' | 'niveau' | 'reussite' | 'zappe' | 'caresse' | 'outil' }
  | { quoi: 'echec'; serie: number }

/**
 * Ce qu'il en ressent. Un push, une délivrance, un niveau : il en est fier un
 * bon moment. Deux échecs d'affilée ou plus : il s'inquiète, jusqu'à ce que ça
 * passe. Trois zaps de suite : il se vexe (pas s'il est inquiet : il a autre
 * chose en tête) ; ta caresse le lui fait oublier. Te regarder travailler
 * nourrit sa curiosité.
 */
export function ressent(e: Esprit, v: Vecu, maintenant: number): Esprit {
  const emotion = (nom: Sentiment, cause: Cause, n?: number): Emotion => ({ nom, cause, depuis: maintenant, jusqua: maintenant + DUREE[nom], ...(n === undefined ? {} : { n }) })
  const actuelle = emotionDe(e, maintenant)
  switch (v.quoi) {
    case 'push':
    case 'delivrance':
    case 'niveau':
      return { ...e, emotion: emotion('fier', v.quoi) }
    case 'echec':
      return v.serie >= 2 ? { ...e, emotion: emotion('inquiet', 'echecs', v.serie) } : e
    case 'reussite':
      return actuelle?.nom === 'inquiet' ? { ...e, emotion: null } : e
    case 'caresse':
      return { ...e, zaps: [], emotion: actuelle?.nom === 'vexe' ? null : actuelle }
    case 'zappe': {
      const zaps = [...e.zaps.filter(t => maintenant - t < ZAPS_MS && t <= maintenant), maintenant]
      if (zaps.length < ZAPS_DE_TROP || actuelle?.nom === 'inquiet') return { ...e, zaps }
      return { ...e, zaps: [], emotion: emotion('vexe', 'zaps') }
    }
    case 'outil':
      return { ...e, besoins: { ...e.besoins, curiosite: borne(e.besoins.curiosite - VU_TRAVAILLER) } }
  }
}

/**
 * Son humeur telle que son émotion la colore, pour choisir ce qu'il fait :
 * fier, il a envie de bouger ; inquiet, il cherche le calme ; vexé, il ne
 * vient pas te chercher.
 */
export function colore(h: Humeur, e: Esprit, maintenant: number): Humeur {
  const emotion = emotionDe(e, maintenant)
  if (emotion?.nom === 'fier') return { ...h, joie: Math.max(h.joie, 0.9) }
  if (emotion?.nom === 'inquiet') return { ...h, energie: Math.min(h.energie, 0.3) }
  if (emotion?.nom === 'vexe') return { ...h, ennui: 0 }
  return h
}

/** Ce par quoi il vient te chercher (coucou, une question, il t'attend) : vexé, il s'en passe */
export const APPELS_A_TOI: readonly ClawdAnim[] = ['coucou', 'question', 'attend']

/** La petite scène où il pense à ce besoin, à cette émotion */
export const SCENE_BESOIN: Record<Besoin, ClawdAnim> = { faim: 'faim', soif: 'soif', bouger: 'bougeotte', curiosite: 'curieux' }
export const SCENE_EMOTION: Record<Sentiment, ClawdAnim> = { fier: 'fier', inquiet: 'inquiet', vexe: 'boude' }

// ------------------------------------------------------------- ton rythme

/**
 * Un jour où il t'a vu : ton premier et ton dernier signe de vie, en minutes
 * depuis 5 h (sa journée commence à 5 h : une nuit blanche compte pour la
 * veille, et ton heure de fin ne repasse jamais par zéro à minuit).
 */
export type JourVu = { jour: string; debut: number; fin: number }
export type Rythme = JourVu[]

const DECALAGE_MS = 5 * 3_600_000
/** Les jours qu'il garde en tête, et ceux qu'il lui faut pour connaître tes habitudes */
const JOURS_GARDES = 14
const JOURS_QU_IL_FAUT = 3
const deux = (n: number) => String(n).padStart(2, '0')

/** Sa journée (commencée à 5 h), triable : AAAA-MM-JJ */
export function jourDe(ms: number): string {
  const d = new Date(ms - DECALAGE_MS)
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`
}
/** Les minutes écoulées depuis 5 h */
export function minuteDuJour(ms: number): number {
  const d = new Date(ms - DECALAGE_MS)
  return d.getHours() * 60 + d.getMinutes()
}

export const estRythme = (v: unknown): v is Rythme =>
  Array.isArray(v) &&
  v.every(j => typeof j === 'object' && j !== null && typeof (j as JourVu).jour === 'string' && /^\d{4}-\d{2}-\d{2}$/.test((j as JourVu).jour) && fini((j as JourVu).debut) && fini((j as JourVu).fin))

/** Deux mémoires de ton rythme (deux sessions ouvertes) n'en font qu'une : par jour, ton premier signe et ton dernier */
export function fusionne(a: Rythme, b: Rythme): Rythme {
  const jours = new Map<string, JourVu>()
  for (const j of [...a, ...b]) {
    const vu = jours.get(j.jour)
    jours.set(j.jour, vu ? { jour: j.jour, debut: Math.min(vu.debut, j.debut), fin: Math.max(vu.fin, j.fin) } : { jour: j.jour, debut: j.debut, fin: j.fin })
  }
  return [...jours.values()].sort((x, y) => (x.jour < y.jour ? -1 : 1)).slice(-JOURS_GARDES)
}

/** Tu es là, à cet instant : il le note */
export const noteVu = (r: Rythme, maintenant: number): Rythme => {
  const m = minuteDuJour(maintenant)
  return fusionne(r, [{ jour: jourDe(maintenant), debut: m, fin: m }])
}

const mediane = (l: number[]) => [...l].sort((a, b) => a - b)[Math.floor((l.length - 1) / 2)]!

/**
 * Tes habitudes : l'heure où tu arrives et celle où tu t'arrêtes (médianes
 * des jours passés, sans aujourd'hui), en minutes depuis 5 h. Null tant qu'il
 * ne t'a pas vu assez de jours.
 */
export function habitudes(r: Rythme, aujourdhui: string): { arrivee: number; depart: number } | null {
  const passes = r.filter(j => j.jour !== aujourdhui)
  if (passes.length < JOURS_QU_IL_FAUT) return null
  return { arrivee: mediane(passes.map(j => j.debut)), depart: mediane(passes.map(j => j.fin)) }
}

/** Une heure (en minutes depuis 5 h), dite comme on la dit : au quart d'heure près */
export function heureDite(minutes: number): string {
  const m = (((Math.round(minutes / 15) * 15 + 300) % 1440) + 1440) % 1440
  return `${Math.floor(m / 60)} h${m % 60 ? ` ${deux(m % 60)}` : ''}`
}

/** Il te guette (ton heure approche), tu es en retard sur ton heure, ou il se fait tard pour vous deux */
export type Moment = 'bientot' | 'retard' | 'tard'
/** Il te guette de dix minutes avant ton heure à vingt minutes après ; au-delà (trois heures au plus), tu es en retard */
const GUET_AVANT = 10
const GUET_APRES = 20
const RETARD_MAX = 180
/** Une vraie journée (deux heures au moins entre ton arrivée et ton départ) a une heure de fin */
const JOURNEE_MIN = 120

/**
 * Où en est ta journée par rapport à tes habitudes : pas encore vu
 * aujourd'hui autour de ton heure d'arrivée (`bientot`, puis `retard`) ; déjà
 * vu, passé ton heure de départ (`tard`). Null : rien à en dire, ou il ne te
 * connaît pas encore assez.
 */
export function moment(r: Rythme, maintenant: number): { quoi: Moment; heure: number } | null {
  const jour = jourDe(maintenant)
  const h = habitudes(r, jour)
  if (!h) return null
  const m = minuteDuJour(maintenant)
  if (!r.some(j => j.jour === jour)) {
    if (m >= h.arrivee - GUET_AVANT && m <= h.arrivee + GUET_APRES) return { quoi: 'bientot', heure: h.arrivee }
    if (m > h.arrivee + GUET_APRES && m <= h.arrivee + RETARD_MAX) return { quoi: 'retard', heure: h.arrivee }
    return null
  }
  return h.depart - h.arrivee >= JOURNEE_MIN && m >= h.depart - GUET_AVANT ? { quoi: 'tard', heure: h.depart } : null
}

/** Tu arrives bien plus tard que d'habitude (il t'attendait), ou bien plus tôt (tu es matinal) */
const ECART_NOTABLE = 45

/**
 * Ton premier signe de vie de la journée, comparé à tes habitudes (à lire
 * avant de le noter) : en retard ou matinal de trois quarts d'heure au moins.
 * Null : à ton heure, déjà vu aujourd'hui, ou il ne te connaît pas assez.
 */
export function arrivee(r: Rythme, maintenant: number): { quoi: 'retard' | 'matinal'; heure: number } | null {
  const jour = jourDe(maintenant)
  const h = habitudes(r, jour)
  if (!h || r.some(j => j.jour === jour)) return null
  const m = minuteDuJour(maintenant)
  if (m >= h.arrivee + ECART_NOTABLE) return { quoi: 'retard', heure: h.arrivee }
  if (m <= h.arrivee - ECART_NOTABLE) return { quoi: 'matinal', heure: h.arrivee }
  return null
}

// ------------------------------------------------------------ ses pensées

/** Ce qu'il lui faut savoir du moment pour dire ce qu'il pense */
export type Contexte = {
  maintenant: number
  dort: boolean
  /** Claude travaille ; avec combien de sous-agents */
  auTravail: boolean
  equipe: number
  humeur: Humeur
  rythme: Rythme
  /** Le besoin qui lui a fait choisir ce qu'il fait en ce moment, s'il y en a un */
  raison?: { besoin: Besoin; anim: ClawdAnim } | null
  /** Ton arrivée du jour, si elle sort de tes habitudes (il y pense encore un moment) */
  arrivee?: { quoi: 'retard' | 'matinal'; heure: number } | null
}

/** (par pas de cinq minutes : sa pensée ne change pas à chaque minute qui passe) */
const ilYA = (ms: number) => (ms < 3 * MIN ? 'à l’instant' : `il y a ${Math.round(ms / (5 * MIN)) * 5} min`)

const REVE: Record<Besoin, string> = { faim: 'd’un cookie', soif: 'd’un café bien chaud', bouger: 'qu’il danse', curiosite: 'd’un gros livre' }
const PRESSE: Record<Besoin, string> = { faim: 'il a faim', soif: 'il a soif', bouger: 'il a des fourmis dans les pattes', curiosite: 'il brûle d’apprendre quelque chose' }
const TITILLE: Record<Besoin, string> = { faim: 'il a une petite faim', soif: 'il boirait bien un café', bouger: 'il a envie de bouger', curiosite: 'il a envie de découvrir quelque chose' }
const COMBLE_DIT: Record<Besoin, string> = { faim: 'il avait faim : il se régale', soif: 'il avait soif : il boit son café', bouger: 'il avait besoin de bouger : il se dépense', curiosite: 'il était curieux : il s’instruit' }

function emotionDite(em: Emotion, maintenant: number): string {
  if (em.nom === 'inquiet') return `tes ${em.n ?? 2} échecs d’affilée l’inquiètent`
  if (em.nom === 'vexe') return 'il boude un peu : tu l’as zappé trois fois de suite (une caresse arrangerait ça)'
  const quand = ilYA(maintenant - em.depuis)
  if (em.cause === 'delivrance') return `il est fier de vous deux : la galère est passée (${quand})`
  if (em.cause === 'niveau') return `il est fier de son nouveau niveau (${quand})`
  return `il est encore fier de ton push (${quand})`
}

function momentDit(m: { quoi: Moment; heure: number }): string {
  const h = heureDite(m.heure)
  if (m.quoi === 'bientot') return `il te guette : d’habitude tu arrives vers ${h}`
  if (m.quoi === 'retard') return `il t’attend : d’habitude tu es là vers ${h}`
  return `il se fait tard pour vous deux : d’habitude tu t’arrêtes vers ${h}`
}

function fond(c: Contexte): string {
  if (c.auTravail) return c.equipe > 0 ? 'il dirige ses minis au travail' : 'il suit ton travail, un carton après l’autre'
  if (c.humeur.energie < 0.2) return 'il pique du nez'
  if (c.humeur.ennui > 0.6) return 'il s’ennuie de toi'
  if (c.humeur.joie > 0.7) return 'il est de très bonne humeur'
  return 'il est tranquille'
}

/**
 * Ce qu'il pense, en une phrase (trois idées au plus, de la plus forte à la
 * moins forte) : son émotion et sa cause, le besoin qui le travaille, ton
 * heure, et sinon ce qu'il vit. Endormi, ce dont il rêve.
 */
export function pense(e: Esprit, c: Contexte): string {
  const fort = besoinFort(e)
  if (c.dort) return fort.force >= 0.5 ? `Il dort ; il rêve ${REVE[fort.besoin]}.` : 'Il dort à poings fermés.'
  const idees: string[] = []
  const em = emotionDe(e, c.maintenant)
  if (em) idees.push(emotionDite(em, c.maintenant))
  if (c.raison) idees.push(COMBLE_DIT[c.raison.besoin])
  else if (fort.force >= 0.75) idees.push(PRESSE[fort.besoin])
  else if (fort.force >= 0.5) idees.push(TITILLE[fort.besoin])
  const m = moment(c.rythme, c.maintenant)
  if (m) idees.push(momentDit(m))
  else if (c.arrivee?.quoi === 'retard') idees.push(`tu es arrivé plus tard que d’habitude (${heureDite(c.arrivee.heure)}) : il t’attendait`)
  else if (c.arrivee?.quoi === 'matinal') idees.push(`tu es matinal aujourd’hui (d’habitude, ${heureDite(c.arrivee.heure)})`)
  if (idees.length < 2) idees.push(fond(c))
  const phrase = idees.slice(0, 3).join(' ; ')
  return `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)}.`
}
