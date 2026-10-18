// La liste de tâches de Claude en pastilles, sous les jauges : un rond par
// étape, en pointillé tant qu'elle attend, l'orbe qui respire pendant qu'elle
// avance, vert et coché une fois faite. Son nom et sa durée s'affichent au
// survol.
//
// Trois sources selon la session : la liste de l'app desktop
// (mcp__ccd_turn__update_plan), les tâches de Claude Code (TaskCreate,
// TaskUpdate, TaskList) et l'ancien TodoWrite.

import type { AtelierTache } from '../types'
import { type Pastille, svgPastilles } from './pastilles'
import { duree, dureeCourte, heure } from './temps'

type Etat = AtelierTache['etat']

/** Au-delà, les pastilles ne tiendraient plus sur la ligne : on garde les plus récentes */
export const MAX_TACHES = 40

const etatDe = (status: unknown): Etat => (status === 'completed' ? 'faite' : status === 'in_progress' ? 'encours' : 'attente')
/** Un nom sûr à dessiner : sans caractère de contrôle (interdit en XML), 200 caractères entiers au plus */
const nomDe = (v: unknown) =>
  typeof v === 'string'
    ? Array.from(v.replace(/[\u0000-\u001f\u007f-\u009f\ufffe\uffff]/g, ' ').replace(/\s+/g, ' ').trim())
        .slice(0, 200)
        .join('')
    : ''
const objets = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null).slice(-MAX_TACHES) : []
/** Les tâches de Claude Code ne se mêlent pas aux restes d'une autre liste */
const seulesTaches = (l: readonly AtelierTache[]) => l.filter(t => t.id.startsWith('task-'))

/**
 * La liste de l'app desktop : `items` la remplace en entier ; `advance` finit
 * l'étape en cours et commence la suivante ; `done` (numéros à partir de 1)
 * finit des étapes, `start` en commence une autre que celle en cours.
 */
export function suitPlan(avant: readonly AtelierTache[], e: Record<string, unknown>): AtelierTache[] {
  let l = Array.isArray(e.items) ? objets(e.items).map((it, i) => ({ id: `plan-${i + 1}`, nom: nomDe(it.content), etat: etatDe(it.status) })) : [...avant]
  if (e.advance === true) {
    const i = l.findIndex(t => t.etat === 'encours')
    const j = l.findIndex((t, k) => k > i && t.etat === 'attente')
    l = l.map((t, k) => (k === i ? { ...t, etat: 'faite' } : k === j ? { ...t, etat: 'encours' } : t))
  }
  const faites = new Set(Array.isArray(e.done) ? e.done.filter((n): n is number => Number.isInteger(n)).map(n => n - 1) : [])
  const debut = Number.isInteger(e.start) ? (e.start as number) - 1 : -1
  const commence = debut >= 0 && debut < l.length
  if (faites.size || commence) {
    l = l.map((t, k): AtelierTache => {
      if (faites.has(k)) return { ...t, etat: 'faite' }
      if (commence && k === debut) return { ...t, etat: 'encours' }
      // une seule étape en cours à la fois
      return commence && t.etat === 'encours' ? { ...t, etat: 'attente' } : t
    })
  }
  return l
}

/** TaskCreate a répondu : une tâche de plus, en attente */
export function ajouteTache(avant: readonly AtelierTache[], id: unknown, sujet: unknown): AtelierTache[] {
  if (typeof id !== 'string' && typeof id !== 'number') return [...avant]
  const cle = `task-${id}`
  return [...seulesTaches(avant).filter(t => t.id !== cle), { id: cle, nom: nomDe(sujet), etat: 'attente' as const }].slice(-MAX_TACHES)
}

/**
 * TaskUpdate : nouvel état, nouveau nom, ou tâche supprimée. Une tâche qu'on
 * n'a pas vue naître (session reprise, liste vidée) apparaît quand même.
 */
export function majTache(avant: readonly AtelierTache[], e: Record<string, unknown>): AtelierTache[] {
  if (typeof e.taskId !== 'string' && typeof e.taskId !== 'number') return [...avant]
  const cle = `task-${e.taskId}`
  const l = seulesTaches(avant)
  if (e.status === 'deleted') return l.filter(t => t.id !== cle)
  const nom = nomDe(e.subject)
  const connue = l.some(t => t.id === cle)
  const base = connue ? l : [...l, { id: cle, nom: `Tâche ${e.taskId}`, etat: 'attente' as const }].slice(-MAX_TACHES)
  return base.map(t => (t.id !== cle ? t : { ...t, ...(nom ? { nom } : {}), ...(typeof e.status === 'string' ? { etat: etatDe(e.status) } : {}) }))
}

/** TaskList : la liste complète, pour se recaler (après un rechargement du mod, par exemple) */
export const depuisTaskList = (tasks: unknown): AtelierTache[] =>
  objets(tasks).map(t => ({ id: `task-${String(t.id)}`, nom: nomDe(t.subject), etat: etatDe(t.status) }))

/** TodoWrite : la liste entière à chaque appel */
export const depuisTodos = (todos: unknown): AtelierTache[] =>
  objets(todos).map((t, i) => ({ id: `todo-${i + 1}`, nom: nomDe(t.content), etat: etatDe(t.status) }))

/**
 * Claude clôt son travail sans rien laisser en suspens (wrap_up de l'app
 * desktop, sans question) : le plan est fini, même s'il a oublié de cocher ses
 * dernières étapes. Les tâches des autres sources gardent leur état.
 */
export const planFini = (l: readonly AtelierTache[]): AtelierTache[] => l.map(t => (t.id.startsWith('plan-') ? { ...t, etat: 'faite' } : t))

/** Tour interrompu : l'étape en cours n'avance plus, elle repasse en attente */
export const interrompue = (l: readonly AtelierTache[]): AtelierTache[] => l.map(t => (t.etat === 'encours' ? { ...t, etat: 'attente' } : t))

/** Un plan entièrement fait n'a plus rien à montrer au message suivant */
export const toutFait = (l: readonly AtelierTache[]) => l.length > 0 && l.every(t => t.etat === 'faite')

const LIBELLE: Record<Etat, string> = { attente: 'à faire', encours: 'en cours', faite: 'faite' }

/** Ce que disent les pastilles, en clair (texte alternatif) */
export const resumeTaches = (l: readonly AtelierTache[]) =>
  `Tâches ${l.filter(t => t.etat === 'faite').length}/${l.length} : ` + l.map((t, i) => `${t.nom || `étape ${i + 1}`} (${LIBELLE[t.etat]})`).join(', ')

/**
 * Les heures de début et de fin, d'une liste à la suivante. Une étape qui
 * commence prend l'heure, une étape qui finit aussi. Une même étape (même nom)
 * garde les siennes, même renvoyée dans une nouvelle liste.
 */
export function horodate(avant: readonly AtelierTache[], apres: readonly AtelierTache[], maintenant: number): AtelierTache[] {
  return apres.map(t => {
    // la même étape : même id et même nom, sinon même nom (renvoyée dans une nouvelle liste),
    // sinon même id si elle avance encore (renommée en cours de route)
    const source = t.id.split('-')[0]
    const ancien =
      avant.find(a => a.id === t.id && a.nom === t.nom) ??
      avant.find(a => a.nom === t.nom && a.id.split('-')[0] === source) ??
      (t.etat === 'encours' ? avant.find(a => a.id === t.id && a.etat === 'encours') : undefined)
    const { debut: _d, fin: _f, ...base } = t
    if (t.etat === 'encours') return { ...base, debut: ancien?.etat === 'encours' && ancien.debut !== undefined ? ancien.debut : maintenant }
    if (t.etat === 'faite') {
      const fin = ancien?.etat === 'faite' && ancien.fin !== undefined ? ancien.fin : maintenant
      return { ...base, ...(ancien?.debut !== undefined ? { debut: ancien.debut } : {}), fin }
    }
    return base
  })
}

/**
 * Les tâches en pastilles : le survol dit le nom de l'étape, et depuis quand
 * elle avance ou en combien de temps elle s'est faite.
 */
export function pastillesTaches(l: readonly AtelierTache[], maintenant: number): Pastille[] {
  return l.map((t, i) => {
    const nom = t.nom || `Étape ${i + 1}`
    const quand =
      t.etat === 'encours'
        ? t.debut !== undefined
          ? ` — en cours depuis ${heure(t.debut)} (${dureeCourte(maintenant - t.debut)})`
          : ' — en cours'
        : t.etat === 'faite'
          ? t.debut !== undefined && t.fin !== undefined
            ? ` — faite en ${duree(t.fin - t.debut)}`
            : t.fin !== undefined
              ? ` — faite à ${heure(t.fin)}`
              : ' — faite'
          : ' — à faire'
    return { id: `tache-${t.id}`, titre: nom + quand, forme: t.etat }
  })
}

/** Les tâches seules en SVG (voir pastilles.ts) */
export const svgTaches = (l: readonly AtelierTache[], tourne = true, maintenant = 0) => svgPastilles([pastillesTaches(l, maintenant)], tourne)

/** La même chose en texte, pour le terminal : ◌ à faire, ◐ en cours, ✔ faite */
export const texteTaches = (l: readonly AtelierTache[]) =>
  l.map(t => ({ etat: t.etat, texte: t.etat === 'faite' ? '✔' : t.etat === 'encours' ? '◐' : '◌' }))
