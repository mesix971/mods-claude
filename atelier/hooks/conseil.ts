// Le conseil de modèle : à chaque demande, Haiku (rapide, presque gratuit) lit
// ce que tu demandes, avec le contexte du projet, et dit quel modèle et quel
// effort suffisent. Le bandeau ne le montre que quand ce n'est pas ce qui
// tourne : « 💡 Sonnet · Moyen », la raison au survol. Il ne change rien
// lui-même : c'est toi qui choisis.

import { nomModele } from './prix'

export type Famille = 'haiku' | 'sonnet' | 'opus' | 'fable'
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'
export type Conseil = { modele: Famille; effort: Effort; raison: string }
/** Ce qui tourne : le modèle de la session et l'effort des requêtes, quand on les connaît */
export type Reglage = { modele: string | null; effort: string | null }

const FAMILLES: readonly Famille[] = ['haiku', 'sonnet', 'opus', 'fable']
const EFFORTS: readonly Effort[] = ['low', 'medium', 'high', 'xhigh', 'max']
const NOMS: Record<Famille, string> = { haiku: 'Haiku 5.5', sonnet: 'Sonnet 5.5', opus: 'Opus 5.5', fable: 'Fable 5.1' }
/** Les niveaux tels que le sélecteur d'effort de l'app les nomme, dans le même ordre */
const NOMS_EFFORT: Record<Effort, string> = { low: 'Faible', medium: 'Moyen', high: 'Élevé', xhigh: 'Extra', max: 'Max' }
export const nomEffort = (effort: string) => NOMS_EFFORT[effort as Effort] ?? effort

export const familleDe = (modele: string | null | undefined): Famille | null => {
  const m = (modele ?? '').toLowerCase()
  // Mythos : l'autre nom de Fable (prix.ts)
  return m.includes('mythos') ? 'fable' : (FAMILLES.find(f => m.includes(f)) ?? null)
}

/** Une demande trop courte pour être jugée seule (« oui », « vas-y ») continue la précédente : le conseil reste */
export function aJuger(texte: string) {
  const t = texte.trim()
  return t.length >= 25 && !t.startsWith('/')
}

/**
 * Ce que tu as écrit toi-même, au clavier ou par Remote Control : pas une
 * routine, une autre session, un plugin (le bouton « Commit + push »), ni
 * `claude -p`, où il n'y a pas de bandeau
 */
export const deToi = (origine: { kind: string } | undefined) => origine?.kind === 'composer' || origine?.kind === 'bridge'

/** La demande tenue à `max` caractères : son début et sa fin (une demande écrite après un long collage reste lue) */
export function coupe(texte: string, max = 2000): string {
  // au-delà de 2 × max unités UTF-16, il y a forcément plus de max caractères : un énorme collage n'est pas découpé en entier
  if (texte.length <= max || (texte.length <= 2 * max && Array.from(texte).length <= max)) return texte
  const debut = Array.from(texte.slice(0, max)).slice(0, max / 2).join('')
  const fin = Array.from(texte.slice(-max)).slice(-max / 2).join('')
  return `${debut}\n[…]\n${fin}`
}

/** Ce que Haiku sait du travail en cours, en plus de la demande */
export type Contexte = { projet: string; etapes: number; buildRate: boolean; sousAgents: number; quotaSerre: boolean }

export function promptConseil(texte: string, c: Contexte): string {
  return [
    "Tu conseilles quel modèle Claude utiliser pour une demande faite à Claude Code (un agent qui code), et avec quel effort de réflexion.",
    "Modèles, du plus léger au plus fort : haiku (question simple, recherche, courte explication) ; sonnet (modification courante, doc, petite fonction, retouche d'interface) ; opus (fonctionnalité complète, débogage, plusieurs fichiers, architecture) ; fable (problème vraiment très dur seulement, il coûte 2,5 fois opus).",
    "Efforts : low, medium, high, xhigh, max. max est très coûteux : seulement pour un débogage ou un audit vraiment difficile.",
    c.quotaSerre ? 'Le quota est serré : choisis le plus léger qui suffit.' : 'Le quota va bien : choisis ce qui donne un bon résultat sans gaspiller.',
    `Contexte : projet ${c.projet} ; plan en cours : ${c.etapes} étape(s) ; dernier build ${c.buildRate ? 'raté' : 'sans échec'} ; sous-agents au travail : ${c.sousAgents}.`,
    `La demande, entre les balises :\n<demande>\n${coupe(texte)}\n</demande>`,
    'Réponds seulement avec un objet JSON : {"modele":"haiku|sonnet|opus|fable","effort":"low|medium|high|xhigh|max","raison":"8 mots au plus, en français"}',
  ].join('\n')
}

const propre = (s: string, max: number) =>
  Array.from(s.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim())
    .slice(0, max)
    .join('')

/** Le conseil dans la réponse de Haiku (un objet JSON, même entouré de texte ou d'un bloc ```json), ou null */
export function lisConseil(reponse: string): Conseil | null {
  // du premier « { » au dernier « } » (une raison peut contenir une accolade), sinon le premier objet sans imbrication
  const candidats = [reponse.slice(reponse.indexOf('{'), reponse.lastIndexOf('}') + 1), /\{[^{}]*\}/.exec(reponse)?.[0] ?? '']
  for (const json of candidats) {
    try {
      const o = JSON.parse(json) as Record<string, unknown>
      // « Opus 5.5 » se lit aussi
      const modele = typeof o.modele === 'string' ? familleDe(o.modele) : null
      const effort = typeof o.effort === 'string' ? o.effort.trim().toLowerCase() : ''
      if (!modele || !(EFFORTS as readonly string[]).includes(effort)) continue
      return { modele, effort: effort as Effort, raison: typeof o.raison === 'string' ? propre(o.raison, 80) : '' }
    } catch {
      // le candidat suivant
    }
  }
  return null
}

/** Le conseil n'est pas ce qui tourne : un autre modèle, ou un autre effort quand on connaît le sien */
export const differe = (c: Conseil, r: Reglage) => familleDe(r.modele) !== c.modele || (r.effort !== null && r.effort !== c.effort)

/**
 * Ce que le bandeau en montre : un mot sur la ligne des quotas, le détail au
 * survol. Rien quand c'est déjà ce qui tourne, ni quand on ne sait pas ce qui
 * tourne (un modèle inconnu : la puce resterait là pour rien). Haiku répond
 * pendant que le tour est parti : le conseil vaut pour la suite.
 */
export function conseilAffiche(c: Conseil | null, r: Reglage): { texte: string; titre: string } | null {
  if (!c || familleDe(r.modele) === null || !differe(c, r)) return null
  const actuel = `${nomModele(r.modele!)}${r.effort ? ` · ${nomEffort(r.effort)}` : ''}`
  return {
    texte: `💡 ${NOMS[c.modele].split(' ')[0]} · ${nomEffort(c.effort)}`,
    titre: `Conseil pour la suite : ${NOMS[c.modele]}, effort ${nomEffort(c.effort)}${c.raison ? ` (${c.raison})` : ''}\nEn ce moment : ${actuel}`,
  }
}
