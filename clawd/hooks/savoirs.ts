// Tout ce qu'il sait faire, pour l'onglet 🎓 de sa carte : rangé par
// famille, et à part de ses leçons du soir (la version perso, qui apprend
// chaque nuit). Les deux listes ci-dessous sont celles de la version
// publique : une scène ou un numéro qui n'y est pas a été appris le soir.

import type { ClawdAnim } from '../types'
import { NUMEROS } from './bande'
import { ACTIVITES, AU_FEU, DANSES, EMOJI, JEUX_CARTONS, PENSEES } from './sprite'

/** Ses scènes et ses numéros d'origine (la version publique) : à tenir à jour quand elle en gagne */
export const SCENES_D_ICI: readonly string[] = [
  'repos', 'coucou', 'danse', 'jongle', 'cafe', 'lecture', 'etirement', 'corde', 'bulles', 'peche', 'yoyo', 'guitare', 'arrosage', 'ballon',
  'papillon', 'promenade', 'pirouette', 'gratte', 'meditation', 'cookie', 'glace', 'balade', 'boulot', 'ecoute', 'marche', 'ecrit', 'cherche',
  'build', 'tests', 'push', 'tel', 'copain', 'chef', 'sifflet', 'fete', 'triste', 'alerte', 'surpris', 'dodo', 'fatigue', 'vertige', 'coeur',
  'nuit', 'reveil', 'tasse', 'paquet', 'attend', 'question', 'deballe', 'decourage', 'delivrance', 'colis', 'gigogne', 'tambour', 'podium',
  'pause', 'rapport', 'bonbon', 'detente', 'baille', 'cache', 'soulage', 'souvenir', 'revanche', 'attendu', 'livraison', 'drapeau', 'ceremonie',
  'retrouvailles', 'chat', 'filante', 'clawdette', 'floss', 'orange', 'defaut', 'griddy', 'takel', 'sixseven', 'niveau', 'flambe', 'buche',
  'rechauffe', 'guimauve', 'faim', 'soif', 'bougeotte', 'curieux', 'fier', 'inquiet', 'boude', 'guette',
]
export const NUMEROS_D_ICI: readonly string[] = [
  'chipe', 'tournee', 'bousculade', 'popcorn', 'echange', 'lilliput', 'geant', 'funambule', 'sieste', 'equipe', 'mouton', 'pyramide', 'passe',
  'bravo', 'repare', 'retient', 'controle', 'ouf', 'poches', 'console', 'inspection', 'rappel', 'installe', 'presse', 'cadre',
]

/** Une chose qu'il sait faire : une scène de son coin, ou un numéro sur toute la bande ; `duSoir` : apprise la nuit, sans fiche de leçon */
export type Savoir = { id: string; nom: string; emoji: string; famille: string; scene?: ClawdAnim; numero?: string; duSoir: boolean }

/** Ses familles, dans l'ordre où sa carte les montre */
export const FAMILLES = ['Au repos', 'Ses danses', 'Autour du feu', 'Dans sa tête', 'Ses cartons', 'Avec toi et Claude', 'Sur toute la bande'] as const

function familleDe(anim: ClawdAnim): string {
  if (DANSES.includes(anim)) return 'Ses danses'
  if (AU_FEU.includes(anim)) return 'Autour du feu'
  if (PENSEES.includes(anim)) return 'Dans sa tête'
  if (JEUX_CARTONS.includes(anim) || anim === 'boulot') return 'Ses cartons'
  if (ACTIVITES.includes(anim) || ['repos', 'balade', 'promenade', 'detente', 'baille', 'dodo'].includes(anim)) return 'Au repos'
  return 'Avec toi et Claude'
}

/**
 * Tout ce qu'il sait faire, sauf ce que ses leçons du soir montrent déjà
 * (`deLecons` : leurs scènes et leurs numéros), rangé par famille.
 */
export function sesSavoirs(deLecons: ReadonlySet<string> = new Set()): Savoir[] {
  const scenes = (Object.keys(EMOJI) as ClawdAnim[])
    .filter(a => !deLecons.has(a))
    .map((a): Savoir => ({ id: `s-${a}`, nom: a, emoji: EMOJI[a] || '🧍', famille: familleDe(a), scene: a, duSoir: !SCENES_D_ICI.includes(a) }))
  const numeros = Object.keys(NUMEROS)
    .filter(n => !deLecons.has(n))
    .map((n): Savoir => ({ id: `n-${n}`, nom: n, emoji: '🎪', famille: 'Sur toute la bande', numero: n, duSoir: !NUMEROS_D_ICI.includes(n) }))
  const rang = (s: Savoir) => (FAMILLES as readonly string[]).indexOf(s.famille)
  return [...scenes, ...numeros].sort((a, b) => rang(a) - rang(b))
}
