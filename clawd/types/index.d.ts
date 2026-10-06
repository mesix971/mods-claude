// Contrat d'état du mod clawd : ce que le dessin lit.

/** Toutes les scènes que Clawd sait jouer. */
export type ClawdAnim =
  // au repos : sa balade chorégraphiée, et les activités tirées au sort
  | 'repos'
  | 'balade'
  | 'coucou'
  | 'danse'
  | 'jongle'
  | 'cafe'
  | 'lecture'
  | 'etirement'
  | 'corde'
  | 'bulles'
  | 'peche'
  | 'yoyo'
  | 'guitare'
  | 'arrosage'
  | 'ballon'
  | 'papillon'
  | 'promenade'
  | 'pirouette'
  | 'gratte'
  | 'meditation'
  | 'cookie'
  // en réaction à la session
  | 'ecoute'
  | 'boulot'
  | 'marche'
  | 'ecrit'
  | 'cherche'
  | 'build'
  | 'tests'
  | 'push'
  | 'tel'
  | 'copain'
  | 'chef'
  | 'fete'
  | 'triste'
  | 'alerte'
  | 'surpris'
  | 'dodo'
  | 'fatigue'
  | 'vertige'
  | 'coeur'
  | 'nuit'

/** Une scène jouée par Clawd. */
export type ClawdScene = { anim: ClawdAnim }

/** Réaction passagère : elle s'efface toute seule au bout de quelques secondes. */
export type ClawdPassage = ClawdScene & { id: number }

/** Un sous-agent en cours, représenté par un mini-Clawd qui mime ce qu'il fait. */
export type ClawdCopain = { id: string; type: string; fait: 'marche' | 'cherche' | 'ecrit' | 'build' }

declare module 'claude-code' {
  interface PluginState {
    clawd: {
      passage: ClawdPassage | null
      /** Activité tirée au sort quand rien ne se passe */
      activite: ClawdScene | null
      dort: boolean
      fatigue: boolean
      caresses: number
      /** Sous-agents en cours (un mini-Clawd chacun) */
      copains: ClawdCopain[]
    }
  }
}
