// Le rangement : 5 minutes après que tout est fini (plus de tour, de build ni
// de sous-agent en cours), les pastilles finies s'en vont, pour ne pas rester
// là indéfiniment : le verdict d'un build (même une croix rouge), les
// sous-agents, la liste de tâches faite. Une liste qui t'attend encore reste.

import type { AtelierAgent, AtelierBuild, AtelierTache } from '../types'
import { toutFait } from './taches'

export const DELAI_RANGEMENT = 5 * 60_000

/** Ce que le rangement enlève */
export type Rangement = { build: boolean; agents: boolean; taches: boolean }

/** Ce qu'il faut ranger maintenant, ou null tant que quelque chose tourne ou que c'est trop tôt */
export function aRanger(
  maintenant: number,
  finDuTour: number | null,
  b: AtelierBuild | null,
  agents: readonly AtelierAgent[],
  taches: readonly AtelierTache[],
): Rangement | null {
  // un tour, un build ou un sous-agent en cours : rien n'est fini
  if (finDuTour === null || b?.etat === 'encours' || agents.some(a => a.etat === 'encours')) return null
  const listeFaite = toutFait(taches)
  // le délai part de la dernière fin, celle du tour ou celle d'un sous-agent qui a fini après lui
  const derniere = Math.max(finDuTour, ...(b ? [b.fin ?? b.debut] : []), ...agents.map(a => a.fin ?? a.debut), ...(listeFaite ? taches.map(t => t.fin ?? 0) : []))
  if (maintenant - derniere < DELAI_RANGEMENT) return null
  const r = { build: b !== null, agents: agents.length > 0, taches: listeFaite }
  return r.build || r.agents || r.taches ? r : null
}
