// Le bouton « Nouvelle conversation » de la bande : il ouvre une conversation
// neuve (la commande `/suite` si tu en as une, sinon `/clear`). Il ne change
// jamais, ni de place ni d'allure : quand continuer ici coûte trop, la bande
// partagée dit où il est, et c'est Clawd qui vient le montrer. À chaque
// requête, Claude relit toute la conversation ; une conversation neuve,
// repartie d'une note de passation, en relirait bien moins. Ce que le dernier
// tour aurait économisé, c'est le gâchis.

import type { AtelierConso, AtelierUsage } from '../types'
import { tokensCourts } from './prix'

/** Le libellé du bouton, toujours le même */
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

/** Le libellé du bouton quand il est temps de changer (Clawd vient le montrer), sinon null */
export function texteNouvelle(u: AtelierUsage | null, c: AtelierConso | null): string | null {
  return aChanger(u, c) ? LIBELLE_NOUVELLE : null
}

/**
 * La police du texte de la bande sur le bureau : Segoe UI 14 px, espaces
 * conservées (pas une chasse fixe). 13 px avant une mise à jour de l'app, fin
 * octobre 2026 : relevé le 2026-10-26 sur une capture de la ligne git (à 1 px
 * près sur 250). Largeurs en centièmes de px, de l'espace (32) à ÿ (255),
 * mesurées dans Chromium (Edge sans fenêtre, à l'échelle 250 % de l'écran).
 */
const LARGEURS = '384,398,549,827,755,1146,1120,322,422,422,584,958,304,560,304,546,755,755,755,755,755,755,755,755,755,755,304,304,958,958,958,628,1337,903,803,830,982,708,684,960,994,373,446,812,659,1257,1047,1055,784,1055,837,744,761,962,870,1308,826,774,798,422,530,422,958,581,375,712,823,647,824,732,438,824,792,339,339,696,339,1206,792,820,823,824,487,594,474,792,671,1012,643,677,633,422,335,422,958,700,904,904,904,904,904,904,904,904,904,904,904,904,904,904,904,904,904,904,904,904,904,904,904,904,904,904,904,904,904,904,904,904,384,398,755,755,778,755,335,628,580,1246,549,708,958,0,1246,581,528,958,513,513,395,808,641,304,287,492,603,708,1269,1303,1333,628,903,903,903,903,903,903,1204,830,708,708,708,708,373,373,373,373,982,1047,1055,1055,1055,1055,1055,958,1055,962,962,962,962,774,784,762,712,712,712,712,712,712,1165,647,732,732,732,732,339,339,339,339,783,792,820,820,820,820,820,958,820,792,792,792,792,677,823,677'
  .split(',')
  .map(n => Number(n) / 100)
const AUTRES: Record<string, number> = { '·': 3.04, '→': 12.09, '⚠': 12.06, '…': 10.27, '↻': 10.95, '€': 7.55, '’': 3.22, '«': 7.08, '»': 7.08 }

/** La largeur (px) d'un texte de la bande sur le bureau (un emoji : 19,2 px ; un caractère inconnu : 8,6 px, plutôt trop que pas assez) */
export function largeurTexte(texte: string): number {
  let l = 0
  for (const ch of texte) {
    const c = ch.codePointAt(0) ?? 0
    l += c >= 32 && c <= 255 ? LARGEURS[c - 32]! : (AUTRES[ch] ?? (/\p{Extended_Pictographic}/u.test(ch) ? 19.2 : 8.6))
  }
  return +l.toFixed(1)
}

/** Le coin de Clawd, au bout à droite de la bande (px) : rien ne doit s'y poser */
export const COIN_CLAWD = 116

/**
 * Le bouton, posé à `xPx` sur sa rangée, y tient-il sans passer à la ligne ni
 * mordre sur le coin de Clawd ? (en px ; la bande inconnue : on suppose que oui)
 */
export function tient(xPx: number, texte: string, bandePx: number | null): boolean {
  if (!bandePx) return true
  return xPx + largeurBouton(texte) <= bandePx - COIN_CLAWD
}

/**
 * La largeur (px) d'un bouton natif de l'app : son libellé, dans la police de
 * la bande, plus ses bords (10 px de chaque côté). Relevé sur la capture du
 * 2026-10-26, après la mise à jour de l'app qui les a agrandis : New conv y
 * fait 104 px de large (87 avant), Masquer 74.
 */
export function largeurBouton(texte: string): number {
  return +(largeurTexte(texte) + 20).toFixed(1)
}
