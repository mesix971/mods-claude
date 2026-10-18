// Les sous-agents en pastilles, à la couleur de leur modèle (les mêmes que les
// mini-Clawds : Haiku pistache, Sonnet abricot, Opus terracotta, Fable corail).
// L'orbe pendant qu'il travaille, une coche quand il a fini ; au survol, son
// type, son modèle, sa mission et sa durée.

import type { AtelierAgent } from '../types'
import { DUREE_ONDE, type Pastille } from './pastilles'
import { nomModele } from './prix'
import { duree, dureeCourte, heure } from './temps'

const COULEURS: readonly (readonly [RegExp, string])[] = [
  [/haiku/i, '#9CB86A'],
  [/sonnet/i, '#E9A27F'],
  [/opus/i, '#D97758'],
  [/fable|mythos/i, '#E2604A'],
]
export const couleurModele = (modele: string) => COULEURS.find(([re]) => re.test(modele))?.[1]

/** Au-delà, les plus anciens s'effacent */
const MAX_AGENTS = 12

const texte = (v: unknown, max: number) => (typeof v === 'string' ? Array.from(v.replace(/[\u0000-\u001f\u007f-\u009f\ufffe\uffff]/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, max).join('') : '')

/** Un sous-agent part (agent.spawn a répondu) */
export function ajouteAgent(l: readonly AtelierAgent[], a: { id: unknown; type: unknown; mission: unknown; modele: unknown }, maintenant: number): AtelierAgent[] {
  if (typeof a.id !== 'string' || !a.id) return [...l]
  const agent: AtelierAgent = { id: a.id, type: texte(a.type, 60) || 'agent', mission: texte(a.mission, 160), modele: texte(a.modele, 80), debut: maintenant, etat: 'encours' }
  return [...l.filter(x => x.id !== a.id), agent].slice(-MAX_AGENTS)
}

/** Comment s'est fini son tour, d'après `turn.complete` : `answer`, ou ce qui l'a arrêté */
export const causeDe = (raison: unknown): AtelierAgent['cause'] =>
  raison === 'answer' ? undefined : raison === 'error' ? 'erreur' : raison === 'refusal' ? 'refus' : 'interruption'

/** Son tour est fini : fait, ou arrêté (interrompu, en erreur, refus) */
export const finAgent = (l: readonly AtelierAgent[], id: string, cause: AtelierAgent['cause'], maintenant: number): AtelierAgent[] =>
  l.map(a => (a.id === id && a.etat === 'encours' ? { ...a, etat: cause ? 'interrompu' : 'faite', ...(cause ? { cause } : {}), fin: maintenant } : a))

/** Le sonar : un sous-agent vient de lancer un outil (les deux dernières ondes suffisent) */
export const pingAgent = (l: readonly AtelierAgent[], id: string, maintenant: number, outil: string): AtelierAgent[] =>
  l.map(a =>
    a.id === id
      ? { ...a, appels: (a.appels ?? 0) + 1, pings: [...(a.pings ?? []).filter(t => maintenant - t < DUREE_ONDE), maintenant].slice(-2), dernierOutil: texte(outil, 100) }
      : a,
  )

/** Au message suivant, seuls restent ceux qui travaillent encore (en tâche de fond) */
export const nettoieAgents = (l: readonly AtelierAgent[]) => l.filter(a => a.etat === 'encours')

const libelle = (type: string) => (type === 'general-purpose' ? 'Agent' : type.charAt(0).toUpperCase() + type.slice(1))

export function pastillesAgents(l: readonly AtelierAgent[], maintenant: number): Pastille[] {
  return l.map(a => {
    const qui = `${libelle(a.type)}${a.modele ? ` · ${nomModele(a.modele)}` : ''}${a.mission ? ` — ${a.mission}` : ''}`
    const teinte = couleurModele(a.modele)
    const ondes = (a.pings ?? []).map(t => maintenant - t).filter(age => age >= 0 && age < DUREE_ONDE)
    const outils = a.appels ? `\n${a.appels} outil${a.appels > 1 ? 's' : ''} lancé${a.appels > 1 ? 's' : ''}${a.dernierOutil ? `, le dernier : ${a.dernierOutil}` : ''}` : ''
    if (a.etat === 'encours') return { titre: `${qui}\nEn cours depuis ${heure(a.debut)} (${dureeCourte(maintenant - a.debut)})${outils}`, forme: 'encours', teinte, ondes, id: `agent-${a.id}` }
    const temps = a.fin !== undefined ? ` en ${duree(a.fin - a.debut)}` : ''
    return a.etat === 'faite'
      ? { titre: `${qui}\nFini${temps}${outils}`, forme: 'faite', teinte, id: `agent-${a.id}` }
      : { titre: `${qui}\n${a.cause === 'erreur' ? 'Arrêté sur une erreur' : a.cause === 'refus' ? 'A refusé la tâche' : 'Interrompu'}${temps}${outils}`, forme: 'attente', teinte, id: `agent-${a.id}` }
  })
}

/** En clair, pour le texte alternatif */
export const resumeAgents = (l: readonly AtelierAgent[]) =>
  `Sous-agents : ${l.map(a => `${libelle(a.type)} (${a.etat === 'encours' ? 'en cours' : a.etat === 'faite' ? 'fini' : 'interrompu'})`).join(', ')}`
