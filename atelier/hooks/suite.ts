// Le bouton « Nouvelle conversation » de la bande : il ouvre une conversation
// neuve (la commande `/suite` si tu en as une, sinon `/clear`). Il ne clignote
// pas : il s'écrit toujours « New conv », et se signale quand continuer ici coûte trop : à chaque requête, Claude relit toute la
// conversation ; une conversation neuve, repartie d'une note de passation, en
// relirait bien moins. Ce que le dernier tour aurait économisé, c'est le gâchis.

import type { AtelierConso, AtelierUsage } from '../types'
import { tokensCourts } from './prix'

/** Le libellé du bouton, toujours le même (il ne clignote pas) */
export const LIBELLE_NOUVELLE = '🆕 New conv'

/** Au-delà de ce contexte (en tokens), une conversation devient lourde : il est temps d'en ouvrir une neuve */
export const SEUIL_TOKENS = 250_000
/** Une petite fenêtre se remplit avant : au-delà de cette part de la fenêtre, c'est lourd aussi (%) */
export const SEUIL_POURCENT = 75

/** Le contexte est-il assez lourd pour passer à une nouvelle conversation ? */
export function contexteLourd(u: AtelierUsage | null): boolean {
  if (!u) return false
  if (typeof u.contextTokens === 'number' && u.contextTokens >= SEUIL_TOKENS) return true
  return typeof u.contextPercent === 'number' && u.contextPercent >= SEUIL_POURCENT
}

/** Le contexte en court (« 312 k », ou « 82 % » quand le moteur ne donne pas les tokens) */
export function contexteCourt(u: AtelierUsage | null): string {
  if (typeof u?.contextTokens === 'number') return tokensCourts(u.contextTokens)
  return `${Math.round(u?.contextPercent ?? 0)} %`
}

/** La commande qui ouvre une conversation neuve : ta `/suite` (avec une note de passation) si elle existe, sinon `/clear` */
export function commandeSuite(noms: readonly string[]): string {
  return noms.includes('suite') ? 'suite' : 'clear'
}

/**
 * Ce qu'une conversation neuve relit à chaque requête : instructions, outils,
 * mémoire (relevé sur de vraies sessions parties de zéro, le 2026-10-22 : 74 à
 * 80 k au premier tour), plus la note de passation
 */
export const PROMPT_NEUF = 80_000
/** Au-delà de ce gâchis sur un tour, continuer ici coûte trop */
export const SEUIL_GACHIS = 4_000_000
/** En dessous de ce contexte, une conversation neuve ne vaut pas ce qu'elle fait perdre */
export const CONTEXTE_MIN = 300_000
/** Au-delà de ce prompt, même un tour court gâche beaucoup (chaque requête relit tout) */
export const PROMPT_TROP = 400_000

/** Ce que le dernier tour a relu de trop, par rapport à une conversation neuve (en tokens) */
export function gachisTour(c: AtelierConso | null): number {
  const t = c?.tour
  if (!t?.requetes) return 0
  return Math.max(0, (t.relu ?? 0) - t.requetes * PROMPT_NEUF)
}

/** Ce tour-ci dit-il qu'il est temps : il a gâché beaucoup (beaucoup de requêtes sur un gros contexte), ou chaque requête relit déjà énormément */
export function tourTropCher(t: NonNullable<AtelierConso['tour']>): boolean {
  if (!t.requetes) return false
  const gachis = Math.max(0, (t.relu ?? 0) - t.requetes * PROMPT_NEUF)
  return t.dernierPrompt >= PROMPT_TROP || (t.dernierPrompt >= CONTEXTE_MIN && gachis >= SEUIL_GACHIS)
}

/**
 * Est-ce le moment de passer à une nouvelle conversation ? Allumé par un tour
 * trop cher, ça reste allumé tant que le contexte reste gros (`signale`, posé
 * par la conso) : le bouton ne s'allume et ne s'éteint pas d'un tour à l'autre.
 * Sans tour mesuré, la taille du contexte.
 */
export function aChanger(u: AtelierUsage | null, c: AtelierConso | null): boolean {
  if (c?.signale) return true
  const t = c?.tour
  // pas encore de tour mesuré (le mod vient de se charger) : la taille du contexte ; un tour qui commence (0 requête) n'allume rien
  return t ? tourTropCher(t) : contexteLourd(u)
}

/** Ce que le bouton dit quand il clignote : ce que chaque requête relit (« 384 k/req », stable d'un tour à l'autre), sinon la taille du contexte */
export function texteGachis(u: AtelierUsage | null, c: AtelierConso | null): string {
  const p = c?.tour?.dernierPrompt ?? 0
  return p > 0 ? `${tokensCourts(p)}/req` : contexteCourt(u)
}

/**
 * Le libellé du bouton quand il est temps de changer, sinon null. Court : il
 * doit tenir après les jauges (l'app de bureau dessine un bouton natif avec ce
 * libellé seul ; ce que relit chaque requête est déjà dans la pastille de la conso)
 */
export function texteNouvelle(u: AtelierUsage | null, c: AtelierConso | null): string | null {
  return aChanger(u, c) ? LIBELLE_NOUVELLE : null
}

/** Combien de cases de texte occupe un libellé (un emoji en prend deux) */
export function cases(texte: string): number {
  return [...texte].reduce((n, ch) => n + (/\p{Extended_Pictographic}/u.test(ch) ? 2 : 1), 0)
}

/** Le coin de Clawd, au bout à droite de la bande (px) : rien ne doit s'y poser */
export const COIN_CLAWD = 116

/**
 * Le bouton tient-il juste après les jauges, sur la même rangée, sans passer
 * à la ligne ni mordre sur le coin de Clawd ? (largeurs en px ; la bande
 * inconnue : on suppose que oui)
 */
export function tientApresJauges(jaugesPx: number, texte: string, cellule: number, bandePx: number | null): boolean {
  if (!bandePx) return true
  return jaugesPx + largeurBouton(texte, cellule) <= bandePx - COIN_CLAWD
}

/** La largeur (px) d'un bouton natif de l'app : son libellé, plus ses bords (environ trois cases) */
export function largeurBouton(texte: string, cellule: number): number {
  return +((cases(texte) + 3) * cellule).toFixed(1)
}

/**
 * Où poser le bouton quand il est temps (là où sa place se connaît au px près,
 * pour que Clawd puisse le montrer) : après les pastilles de la ligne du bas
 * (presque vide, à la hauteur de Clawd), sinon après les jauges, s'il y tient ;
 * null : nulle part sans passer à la ligne, il reste avec ↻ et Masquer.
 * Largeurs en px ; null : la rangée n'existe pas.
 */
export function placeBouton(texte: string, cellule: number, bandePx: number | null, pastillesPx: number | null, jaugesPx: number | null): 'pastilles' | 'jauges' | null {
  if (pastillesPx !== null && tientApresJauges(pastillesPx, texte, cellule, bandePx)) return 'pastilles'
  if (jaugesPx !== null && tientApresJauges(jaugesPx, texte, cellule, bandePx)) return 'jauges'
  return null
}
