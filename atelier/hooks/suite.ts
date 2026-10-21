// Le bouton « Nouvelle conversation » de la bande : il ouvre une conversation
// neuve (la commande `/suite` si tu en as une, sinon `/clear`), et clignote
// quand continuer ici coûte trop : à chaque requête, Claude relit toute la
// conversation ; une conversation neuve, repartie d'une note de passation, en
// relirait bien moins. Ce que le dernier tour aurait économisé, c'est le gâchis.

import type { AtelierConso, AtelierUsage } from '../types'
import { tokensCourts } from './prix'

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

/** Ce qu'une conversation neuve relit à chaque requête (instructions, outils, mémoire, note de passation) : une estimation */
export const PROMPT_NEUF = 40_000
/** Au-delà de ce gâchis sur un tour, continuer ici coûte trop */
export const SEUIL_GACHIS = 1_500_000
/** En dessous de ce contexte, une conversation neuve ne vaut pas ce qu'elle fait perdre */
export const CONTEXTE_MIN = 150_000
/** Au-delà de ce prompt, même un tour court gâche beaucoup (chaque requête relit tout) */
export const PROMPT_TROP = 400_000

/** Ce que le dernier tour a relu de trop, par rapport à une conversation neuve (en tokens) */
export function gachisTour(c: AtelierConso | null): number {
  const t = c?.tour
  if (!t?.requetes) return 0
  return Math.max(0, (t.relu ?? 0) - t.requetes * PROMPT_NEUF)
}

/**
 * Est-ce le moment de passer à une nouvelle conversation ? D'après le dernier
 * tour : il a gâché beaucoup (beaucoup de requêtes sur un gros contexte), ou
 * chaque requête relit déjà énormément. Sans tour mesuré, la taille du contexte.
 */
export function aChanger(u: AtelierUsage | null, c: AtelierConso | null): boolean {
  const t = c?.tour
  if (!t?.requetes) return contexteLourd(u)
  return t.dernierPrompt >= PROMPT_TROP || (t.dernierPrompt >= CONTEXTE_MIN && gachisTour(c) >= SEUIL_GACHIS)
}

/** Ce que le bouton dit quand il clignote : le gâchis par tour (« −1,8 M/tour »), sinon la taille du contexte */
export function texteGachis(u: AtelierUsage | null, c: AtelierConso | null): string {
  const g = gachisTour(c)
  return g > 0 ? `−${tokensCourts(g)}/tour` : contexteCourt(u)
}

/** Le texte du bouton quand il est temps de changer (« 🆕 Nouvelle conversation (−2,1 M/tour) »), sinon null */
export function texteNouvelle(u: AtelierUsage | null, c: AtelierConso | null): string | null {
  return aChanger(u, c) ? `🆕 Nouvelle conversation (${texteGachis(u, c)})` : null
}

/** Combien de cases de texte occupe un libellé (un emoji en prend deux) */
export function cases(texte: string): number {
  return [...texte].reduce((n, ch) => n + (/\p{Extended_Pictographic}/u.test(ch) ? 2 : 1), 0)
}
