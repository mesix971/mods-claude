// La conso du tour, en direct : les tokens de chaque réponse de l'API (sous-
// agents compris) et ce que ça coûterait au tarif de l'API, en euros. Le coût
// vient de /cost quand le moteur le tient, sinon de la grille de prix.ts.
//
// La pastille passe à l'ambre quand chaque réponse relit plus de 400 k tokens :
// au-delà, une conversation neuve (/clear) coûte bien moins, en quota comme en
// euros.

import type { AtelierConso, AtelierTokens } from '../types'
import { DATE_TARIFS, DATE_TAUX, DOLLARS_PAR_EURO, coutReponse, dollarsTexte, euros, tokensCourts, tokensLongs } from './prix'

export const ZERO: AtelierTokens = { entree: 0, lu: 0, ecrit: 0, sortie: 0 }
export const PROMPT_LOURD = 400_000

const plus = (a: AtelierTokens, b: AtelierTokens): AtelierTokens => ({
  entree: a.entree + b.entree,
  lu: a.lu + b.lu,
  ecrit: a.ecrit + b.ecrit,
  sortie: a.sortie + b.sortie,
})
export const total = (t: AtelierTokens) => t.entree + t.lu + t.ecrit + t.sortie

const nombre = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0)

/** Les tokens d'une réponse, depuis l'usage que rapporte le moteur */
export const tokensDe = (u: Record<string, unknown>): AtelierTokens => ({
  entree: nombre(u.input_tokens),
  lu: nombre(u.cache_read_input_tokens),
  ecrit: nombre(u.cache_creation_input_tokens),
  sortie: nombre(u.output_tokens),
})

const VIDE: AtelierConso = { tour: null, session: { tokens: ZERO, dollars: 0, estime: true }, coutDebut: null, estimeTour: 0 }

/** Un tour de la conversation principale commence : ses compteurs repartent de zéro */
export function debutTour(c: AtelierConso | null, coutSession: number | null): AtelierConso {
  // la taille du prompt reste celle du tour d'avant jusqu'à la première réponse : l'ambre ne clignote pas
  const dernierPrompt = c?.tour?.dernierPrompt ?? 0
  return { ...(c ?? VIDE), tour: { tokens: ZERO, dollars: 0, estime: coutSession === null, enCours: true, dernierPrompt, relu: 0, requetes: 0 }, coutDebut: coutSession, estimeTour: 0 }
}

/**
 * Une réponse de l'API est arrivée, dans n'importe quelle boucle : ses tokens
 * s'ajoutent à la session, et au tour s'il est en cours. `principale` : la
 * réponse vient de la conversation principale (sa taille de prompt dit si la
 * conversation est devenue lourde).
 */
export function ajouteReponse(c: AtelierConso | null, modele: string, tokens: AtelierTokens, principale: boolean, coutSession: number | null): AtelierConso {
  const base = c ?? VIDE
  const estimation = coutReponse(modele, tokens) ?? 0
  const session = {
    tokens: plus(base.session.tokens, tokens),
    dollars: coutSession ?? base.session.dollars + estimation,
    estime: coutSession === null,
  }
  if (!base.tour?.enCours) return { ...base, session }
  const estimeTour = base.estimeTour + estimation
  const exact = coutSession !== null && base.coutDebut !== null
  return {
    ...base,
    session,
    estimeTour,
    tour: {
      ...base.tour,
      tokens: plus(base.tour.tokens, tokens),
      dollars: exact ? Math.max(0, (coutSession as number) - (base.coutDebut as number)) : estimeTour,
      estime: !exact,
      dernierPrompt: principale ? tokens.entree + tokens.lu + tokens.ecrit : base.tour.dernierPrompt,
      // ce que la conversation principale relit à chaque requête : ce qu'une conversation neuve économiserait
      relu: (base.tour.relu ?? 0) + (principale ? tokens.entree + tokens.lu + tokens.ecrit : 0),
      requetes: (base.tour.requetes ?? 0) + (principale ? 1 : 0),
    },
  }
}

/** Le tour principal est fini : ses chiffres restent jusqu'au suivant */
export function finTour(c: AtelierConso | null, coutSession: number | null): AtelierConso | null {
  if (!c?.tour) return c
  const exact = coutSession !== null && c.coutDebut !== null
  return {
    ...c,
    session: coutSession !== null ? { ...c.session, dollars: coutSession, estime: false } : c.session,
    tour: { ...c.tour, enCours: false, ...(exact ? { dollars: Math.max(0, (coutSession as number) - (c.coutDebut as number)), estime: false } : {}) },
  }
}

/**
 * Le moteur a mesuré la session (après chaque tour principal) : son coût
 * total fait foi, pour la session comme pour le tour.
 */
export function mesureCout(c: AtelierConso | null, coutSession: number): AtelierConso | null {
  if (!c) return c
  const tour = c.tour && c.coutDebut !== null ? { ...c.tour, dollars: Math.max(0, coutSession - c.coutDebut), estime: false } : c.tour
  return { ...c, tour, session: { ...c.session, dollars: coutSession, estime: false } }
}

/** Chaque réponse relit tant de contexte qu'une conversation neuve coûterait bien moins */
export const estLourde = (c: AtelierConso | null) => (c?.tour?.dernierPrompt ?? 0) >= PROMPT_LOURD

/** Le texte de la pastille : « tour 1,3 M · 0,38 € », ou rien tant qu'aucun tour n'a eu lieu */
export function texteConso(c: AtelierConso | null): string | null {
  if (!c?.tour) return null
  return `tour ${tokensCourts(total(c.tour.tokens))} · ${euros(c.tour.dollars)}`
}

/** L'infobulle de la pastille : le détail du tour, la session, la provenance du chiffre */
export function titreConso(c: AtelierConso | null): string {
  if (!c?.tour) return ''
  const t = c.tour.tokens
  const source = c.tour.estime ? 'estimation d’après les tarifs API' : 'd’après /cost'
  const lignes = [
    `Ce tour (${c.tour.enCours ? 'en cours' : 'terminé'}) : ${tokensLongs(total(t))} tokens`,
    `${tokensLongs(t.lu)} relus du cache · ${tokensLongs(t.ecrit)} écrits en cache · ${tokensLongs(t.entree)} en entrée · ${tokensLongs(t.sortie)} générés`,
    `Au tarif API : ${euros(c.tour.dollars)} (${dollarsTexte(c.tour.dollars)}), ${source}`,
    `Session : ${euros(c.session.dollars)} (${dollarsTexte(c.session.dollars)}) · ${tokensCourts(total(c.session.tokens))} tokens vus par le bandeau`,
  ]
  if (estLourde(c)) {
    lignes.push(`⚠ Chaque réponse relit ${tokensCourts(c.tour.dernierPrompt)} tokens : une conversation neuve (/clear) coûterait bien moins.`)
  }
  lignes.push(`Tarifs du ${DATE_TARIFS} · 1 € = ${String(DOLLARS_PAR_EURO).replace('.', ',')} $ (BCE, ${DATE_TAUX})`)
  return lignes.join('\n')
}
