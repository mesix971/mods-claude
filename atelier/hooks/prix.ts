// Ce que coûteraient les tokens au tarif de l'API, en dollars puis en euros :
// de quoi chiffrer une session Claude Code faite avec un abonnement comme si
// elle passait par une clé API.
//
// Tarifs relevés le 2026-10-17 sur platform.claude.com/docs/en/about-claude/pricing
// (au million de tokens). L'écriture de cache est comptée au tarif 5 min, celui
// de l'API par défaut. Taux de change : 1 € = 1,1253 $ (référence BCE du
// 2026-10-16). À revoir quand les tarifs ou le taux bougent.

import type { AtelierTokens } from '../types'

type Tarif = { entree: number; ecriture: number; lecture: number; sortie: number }

/** $ par million de tokens */
const TARIFS: readonly { famille: RegExp; nom: string; tarif: Tarif; long?: { seuil: number; tarif: Tarif } }[] = [
  { famille: /(fable|mythos)-5-1/, nom: 'Fable 5.1', tarif: { entree: 10, ecriture: 12.5, lecture: 0.25, sortie: 50 } },
  { famille: /opus-5-5/, nom: 'Opus 5.5', tarif: { entree: 4, ecriture: 5, lecture: 0.2, sortie: 20 } },
  { famille: /sonnet-5-5/, nom: 'Sonnet 5.5', tarif: { entree: 2, ecriture: 2.5, lecture: 0.1, sortie: 10 } },
  {
    famille: /haiku-5-5/,
    nom: 'Haiku 5.5',
    tarif: { entree: 0.1, ecriture: 0.125, lecture: 0.01, sortie: 0.5 },
    // au-delà de 100 000 tokens de prompt (cache compris), la requête entière passe au tarif long
    long: { seuil: 100_000, tarif: { entree: 0.5, ecriture: 0.625, lecture: 0.05, sortie: 2.5 } },
  },
]

export const DOLLARS_PAR_EURO = 1.1253
export const DATE_TARIFS = '17/10/2026'
export const DATE_TAUX = '16/10/2026'

/** Le nom lisible d'un modèle (« Opus 5.5 »), ou son identifiant s'il n'est pas dans la grille */
export const nomModele = (modele: string) => TARIFS.find(t => t.famille.test(modele))?.nom ?? modele

/**
 * Le coût en dollars d'UNE réponse de l'API (une requête : le seuil de prompt
 * long de Haiku s'y juge requête par requête), ou null pour un modèle inconnu.
 */
export function coutReponse(modele: string, u: AtelierTokens): number | null {
  const ligne = TARIFS.find(t => t.famille.test(modele))
  if (!ligne) return null
  const prompt = u.entree + u.lu + u.ecrit
  const t = ligne.long && prompt > ligne.long.seuil ? ligne.long.tarif : ligne.tarif
  return (u.entree * t.entree + u.ecrit * t.ecriture + u.lu * t.lecture + u.sortie * t.sortie) / 1_000_000
}

const groupes = (n: number) => String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

/** 1 284 512 → « 1,3 M », 9 400 → « 9,4 k », 9 999 → « 10 k », 850 → « 850 » */
export function tokensCourts(n: number): string {
  const un = (x: number) => (x >= 9.95 ? String(Math.round(x)) : x.toFixed(1).replace('.', ',').replace(/,0$/, ''))
  if (n >= 999_500) return `${un(n / 1_000_000)} M`
  if (n >= 1_000) return `${un(n / 1_000)} k`
  return String(Math.round(n))
}

/** 1 284 512 → « 1 284 512 » (espaces fines, à la française) */
export const tokensLongs = (n: number) => groupes(n)

/** 0,4237 $ → « 0,38 € » ; sous le centime, « < 0,01 € » */
export function euros(dollars: number): string {
  const e = dollars / DOLLARS_PAR_EURO
  if (e > 0 && e < 0.01) return '< 0,01 €'
  return `${e >= 100 ? groupes(Math.round(e)) : e.toFixed(2).replace('.', ',')} €`
}

export const dollarsTexte = (d: number) => `${d < 0.01 && d > 0 ? '< 0,01' : d.toFixed(2).replace('.', ',')} $`
