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
 * La police du texte de la bande sur le bureau : Segoe UI 13 px, espaces
 * conservées (pas une chasse fixe). Relevé le 2026-10-24 sur une capture de
 * la ligne git, à 2 px près par morceau. Largeurs en dixièmes de px, de
 * l'espace (32) à ÿ (255), mesurées dans Chromium.
 */
const LARGEURS = '36,37,51,77,70,106,104,30,39,39,54,89,28,52,28,51,70,70,70,70,70,70,70,70,70,70,28,28,89,89,89,58,124,84,75,81,91,66,64,89,92,35,46,75,61,117,97,98,73,98,78,69,68,89,81,121,77,72,74,39,49,39,89,54,35,66,76,60,77,68,41,77,74,32,32,65,32,112,74,76,76,77,45,55,44,74,62,94,60,63,59,39,31,39,89,70,84,84,84,84,84,84,84,84,84,84,84,84,84,84,84,84,84,84,84,84,84,84,84,84,84,84,84,84,84,84,84,84,36,37,70,70,72,70,31,58,54,116,51,66,89,0,116,54,49,89,48,48,37,75,60,28,27,46,56,66,118,121,124,58,84,84,84,84,84,84,112,81,66,66,66,66,35,35,35,35,91,97,98,98,98,98,98,89,98,89,89,89,89,72,73,71,66,66,66,66,66,66,108,60,68,68,68,68,32,32,32,32,73,74,76,76,76,76,76,89,76,74,74,74,74,63,76,63'
  .split(',')
  .map(n => Number(n) / 10)
const AUTRES: Record<string, number> = { '·': 2.8, '→': 11.2, '⚠': 11.2, '…': 9.5, '↻': 10, '€': 7, '’': 3, '«': 6.6, '»': 6.6 }

/** La largeur (px) d'un texte de la bande sur le bureau (un emoji : 17,9 px ; un caractère inconnu : 8 px, plutôt trop que pas assez) */
export function largeurTexte(texte: string): number {
  let l = 0
  for (const ch of texte) {
    const c = ch.codePointAt(0) ?? 0
    l += c >= 32 && c <= 255 ? LARGEURS[c - 32]! : (AUTRES[ch] ?? (/\p{Extended_Pictographic}/u.test(ch) ? 17.9 : 8))
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

/** La largeur (px) d'un bouton natif de l'app : son libellé, plus ses bords (8 à 12 px sur la capture : 12, plutôt trop que pas assez) */
export function largeurBouton(texte: string): number {
  return +(largeurTexte(texte) + 12).toFixed(1)
}
