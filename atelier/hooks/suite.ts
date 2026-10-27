// Le bouton « Nouvelle conversation » de la bande : il ouvre une conversation
// neuve (la commande `/suite` si tu en as une, sinon `/clear`). Il ne change
// jamais, ni de place ni d'allure : quand continuer ici coûte trop, la bande
// partagée dit où il est, et c'est Clawd qui vient le montrer. À chaque
// requête, Claude relit toute la conversation ; une conversation neuve,
// repartie d'une note de passation, en relirait bien moins. Ce que le dernier
// tour aurait économisé, c'est le gâchis.

import type { AtelierConso, AtelierUsage } from '../types'
import { tokensCourts } from './prix'

/** Le libellé du bouton, toujours le même (court : l'app dessine ses boutons en 14 px, avec 10 px de bord de chaque côté) */
export const LIBELLE_NOUVELLE = '🆕 New'

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
 * La taille du texte de la bande (`size` de `Text`) : « footnote », 13 px.
 * Depuis une mise à jour de l'app (fin octobre 2026), la zone du prompt est en
 * densité « confortable » : sans taille, un texte y fait 14 px ; « footnote »
 * le ramène aux 13 px d'avant, sur 17 px de haut (lu dans son code le
 * 2026-10-27). Le terminal n'a qu'une taille et l'ignore.
 */
export const TAILLE_TEXTE = 'footnote'

/**
 * La police du texte de la bande sur le bureau : Segoe UI 13 px (`TAILLE_TEXTE`),
 * espaces conservées (pas une chasse fixe). Largeurs en centièmes de px, de
 * l'espace (32) à ÿ (255), mesurées dans Chromium (Edge sans fenêtre, à
 * l'échelle 250 % de l'écran) ; en 14 px, tout est 14/13 plus large (à 0,01 px
 * près). Vérifié sur une capture du 2026-10-26, en 14 px : à 1 px près sur 250.
 */
const LARGEURS = '356,369,510,768,701,1064,1040,299,392,392,542,889,282,520,282,507,701,701,701,701,701,701,701,701,701,701,282,282,889,889,889,583,1242,839,745,770,912,658,635,892,923,346,414,754,612,1167,972,980,728,980,778,691,706,893,807,1214,767,719,741,392,493,392,889,540,348,661,764,600,766,680,407,766,736,315,315,646,315,1120,736,762,764,766,452,552,441,736,623,939,597,629,588,392,311,392,889,650,839,839,839,839,839,839,839,839,839,839,839,839,839,839,839,839,839,839,839,839,839,839,839,839,839,839,839,839,839,839,839,839,356,369,701,701,722,701,311,583,538,1157,510,658,889,0,1157,540,490,889,476,476,367,750,595,282,267,456,560,658,1178,1210,1238,583,839,839,839,839,839,839,1118,770,658,658,658,658,346,346,346,346,912,972,980,980,980,980,980,889,980,893,893,893,893,719,728,707,661,661,661,661,661,661,1082,600,680,680,680,680,315,315,315,315,727,736,762,762,762,762,762,889,762,736,736,736,736,629,764,629'
  .split(',')
  .map(n => Number(n) / 100)
const AUTRES: Record<string, number> = { '·': 2.82, '→': 11.22, '⚠': 11.2, '…': 9.53, '↻': 10.17, '€': 7.01, '’': 2.98, '«': 6.58, '»': 6.58 }

/** Ce que fait un texte en 13 px, sans arrondi (un emoji : 17,9 px ; un caractère inconnu : 8 px, plutôt trop que pas assez) */
function largeur13(texte: string): number {
  let l = 0
  for (const ch of texte) {
    const c = ch.codePointAt(0) ?? 0
    l += c >= 32 && c <= 255 ? LARGEURS[c - 32]! : (AUTRES[ch] ?? (/\p{Extended_Pictographic}/u.test(ch) ? 17.9 : 8))
  }
  return l
}

/** La largeur (px) d'un texte de la bande sur le bureau */
export function largeurTexte(texte: string): number {
  return +largeur13(texte).toFixed(1)
}

/** Le coin de Clawd, au bout à droite de la bande (px) : rien ne doit s'y poser */
export const COIN_CLAWD = 116

/**
 * Le bouton, posé à `xPx` sur sa rangée, y tient-il sans passer à la ligne ni
 * mordre sur le coin de Clawd ? (en px ; la bande inconnue : on suppose que oui)
 */
export function tient(xPx: number, texte: string, bandePx: number | null): boolean {
  if (!bandePx) return true
  return xPx + largeurNouvelle(texte) <= bandePx - COIN_CLAWD
}

/**
 * Le cadre de nos boutons sur le bureau (px de bordure, de chaque côté) : une
 * boîte à bordure fine, aux couleurs du thème, autour d'un bouton sans cadre
 * natif (`plain`), celui de l'app étant plus large et plus foncé
 */
export const BORD_CADRE = 1

/** La largeur (px) d'un bouton dans son cadre fin, sur le bureau */
export function largeurEncadre(texte: string): number {
  return +(largeurBouton(texte) + 2 * BORD_CADRE).toFixed(1)
}

/** La largeur (px) du bouton 🆕 sur le bureau, son cadre compris */
export function largeurNouvelle(texte: string = LIBELLE_NOUVELLE): number {
  return largeurEncadre(texte)
}

/**
 * La largeur (px) d'un bouton natif de l'app : son libellé en Segoe UI 14 px
 * (la taille des boutons de la bande, qui ne suit pas `TAILLE_TEXTE`), plus
 * ses bords (10 px de chaque côté), avec ou sans cadre (`plain`). Relevé sur
 * la capture du 2026-10-26, après la mise à jour de l'app qui les a agrandis :
 * « 🆕 New conv » y faisait 104 px de large (87 avant), Masquer 74.
 */
export function largeurBouton(texte: string): number {
  return +((largeur13(texte) * 14) / 13 + 20).toFixed(1)
}
