// La bande partagée : ce qu'atelier dessine au-dessus du prompt, et où. Un
// autre mod du dépôt (Clawd) la lit pour jouer avec : marcher jusqu'à une
// pastille, la prendre, la rendre. Tant qu'il tient un élément (son état
// `clawd.emprunts`, chacun avec son échéance), atelier ne le dessine plus : sa
// place reste, vide. Et son numéro (son état `clawd.grandeScene`), atelier le
// pose par-dessus toute la bande : sa rangée est la seule à la couvrir.
//
// Les positions sont celles du dessin desktop : x et largeur en px CSS depuis
// le bord gauche du bandeau, la ligne comptée depuis le bas (0 : la dernière).
// Le plan sert aussi au dessin : les deux ne peuvent pas se contredire.

import type { AtelierAgent, AtelierAndroid, AtelierBuild, AtelierConso, AtelierElement, AtelierGit, AtelierScene, AtelierTache, AtelierUsage } from '../types'
import { pastillesAgents } from './agents'
import { buildVisible, pastilleBuild } from './build'
import { estLourde, texteConso, titreConso } from './conso'
import { idJauge, jauges, svgJauges } from './jauges'
import type { Jauge } from './jauges'
import { svgPastilles } from './pastilles'
import { COIN_CLAWD, LIBELLE_NOUVELLE, largeurBouton, largeurTexte, texteNouvelle, tient } from './suite'
import type { Pastille } from './pastilles'
import { pastillesTaches } from './taches'
import { heure } from './temps'

/** Ce que le bandeau sait au moment de se dessiner */
export type EtatBandeau = {
  android: AtelierAndroid | null
  git: AtelierGit | null
  usage: AtelierUsage | null
  taches: readonly AtelierTache[]
  conso: AtelierConso | null
  build: AtelierBuild | null
  agents: readonly AtelierAgent[]
  busy: string | null
  /** Le conseil de modèle tel que le bandeau le montre (null : rien à dire) */
  conseil?: { texte: string; titre: string } | null
}

/** Ce que le bandeau dessine, ligne par ligne */
export type Plan = {
  lignes: AtelierScene['lignes']
  jauges: Jauge[]
  /** La conso du tour, après les jauges */
  conso: { texte: string; titre: string; lourde: boolean } | null
  /** Le conseil de modèle, après la conso */
  conseil: { texte: string; titre: string } | null
  /** Le build à montrer (un réussi s'efface au bout de 10 min) */
  build: AtelierBuild | null
  /** Les pastilles de la ligne du bas : le build (sans projet Android : sinon il est sur la ligne 📱), les tâches, les sous-agents */
  groupes: Pastille[][]
  /** Le bouton « Nouvelle conversation » quand il est temps d'en changer (Clawd vient le montrer), sinon null */
  nouvelle: string | null
  /** La ligne git (le bouton 🆕 est au bout : sa place en dépend) */
  git: AtelierGit | null
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

/**
 * Les textes de la ligne git, dans l'ordre, tels que le bandeau les écrit
 * (distant : null sans remote ; alerte : le distant est à regarder, en jaune)
 */
export function textesGit(g: AtelierGit): { branche: string; modifs: string; distant: string | null; alerte: boolean; alertes: string[] } {
  const retard = g.behind ?? 0
  const distant = !g.hasRemote
    ? null
    : g.detached
      ? '  · HEAD détachée '
      : g.gone
        ? '  · branche supprimée sur GitHub '
        : !g.hasUpstream
          ? '  · branche jamais poussée '
          : g.ahead > 0 && retard > 0
            ? `  · ${pluriel(g.ahead, 'commit')} non poussé${g.ahead > 1 ? 's' : ''}, ${retard} en retard `
            : g.ahead > 0
              ? `  · ${pluriel(g.ahead, 'commit')} non poussé${g.ahead > 1 ? 's' : ''} `
              : retard > 0
                ? `  · ${pluriel(retard, 'commit')} en retard sur GitHub `
                : '  · à jour avec GitHub '
  return {
    branche: `🌿 ${g.detached ? 'HEAD' : g.branch}`,
    modifs: `  · ${pluriel(g.changed, 'modif')}`,
    distant,
    alerte: distant !== null && distant !== '  · à jour avec GitHub ',
    alertes: g.warnings.map(w => `  · ⚠ ${w}`),
  }
}

/**
 * Le bouton de la ligne git, s'il y a de quoi : « Commit + push » (des
 * modifs), « Commit » (des modifs, sans remote : pas de push impossible),
 * « Push » (des commits à pousser, vers une branche qui existe encore) ; sinon null
 */
export function libelleCommit(g: AtelierGit): 'Commit + push' | 'Commit' | 'Push' | null {
  if (g.changed > 0) return g.hasRemote ? 'Commit + push' : 'Commit'
  return g.ahead > 0 && g.hasRemote && !g.gone && !g.detached ? 'Push' : null
}

/** La case vide posée devant 🆕 (`<Text> </Text>`) : une espace de la bande */
const ESPACE = largeurTexte(' ')

/** Ce qu'occupent les textes de la ligne git (px) */
export function largeurGit(g: AtelierGit): number {
  const t = textesGit(g)
  return +[t.branche, t.modifs, t.distant ?? '', ...t.alertes].reduce((n, s) => n + largeurTexte(s), 0).toFixed(1)
}

const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']
/**
 * La largeur d'une case de la bande en px CSS, sur desktop : la bande ne se
 * mesure qu'en cases (`bodyColumns`), un dessin qui doit la couvrir se règle
 * en px. Relevée le 2026-10-18 sur une capture du cadre : 95 colonnes, une
 * rangée de 751 px.
 */
export const CELLULE = 7.9

/** L'heure d'un reset, avec le jour quand il est loin (fenêtre de 7 j) */
export const quandDe = (maintenant: number) => (ms: number) => (ms - maintenant > 20 * 3600_000 ? `${JOURS[new Date(ms).getDay()]} ` : '') + heure(ms)

/** L'heure d'un moment passé (un APK, une installation), avec le jour quand ce n'était pas aujourd'hui */
export const quandPasse = (maintenant: number) => (ms: number) =>
  (new Date(ms).toDateString() !== new Date(maintenant).toDateString() ? `${JOURS[new Date(ms).getDay()]} ` : '') + heure(ms)

export function planBandeau(x: EtatBandeau, maintenant: number): Plan {
  const lj = x.usage ? jauges(x.usage, maintenant) : []
  const texte = texteConso(x.conso)
  const conso = texte ? { texte, titre: titreConso(x.conso), lourde: estLourde(x.conso) } : null
  const bv = buildVisible(x.build, maintenant) ? x.build : null
  const groupes = [...(bv && !x.android ? [[pastilleBuild(bv, maintenant)]] : []), pastillesTaches(x.taches, maintenant), pastillesAgents(x.agents, maintenant)].filter(
    g => g.length > 0,
  )
  const lignes: AtelierScene['lignes'] = [
    ...(x.android ? (['android'] as const) : []),
    ...(x.git ? (['git'] as const) : []),
    ...(lj.length > 0 || conso || x.conseil ? (['quotas'] as const) : []),
    ...(groupes.length > 0 ? (['pastilles'] as const) : []),
    ...(x.busy ? (['occupe'] as const) : []),
  ]
  return { lignes, jauges: lj, conso, conseil: x.conseil ?? null, build: bv, groupes, nouvelle: texteNouvelle(x.usage, x.conso), git: x.git }
}

const genreDe = (id: string): AtelierElement['genre'] => (id.startsWith('agent-') ? 'agent' : id === 'build' ? 'build' : 'tache')

/** La bande partagée d'après le plan : chaque élément à la place où le dessin le met */
/**
 * La hauteur (px CSS) à laquelle le bandeau pose ses dessins (jauges,
 * pastilles), tous dessinés sur 18 unités de haut. L'app ne les laisse pas
 * dépasser la hauteur d'une ligne de texte (~17,2 px, relevé sur des
 * captures du cadre : tout était réduit de 4,4 %, et les places publiées
 * glissaient d'autant) : posés à 17 px, ils ne sont jamais réduits par
 * l'app, et leur échelle est connue au juste.
 */
export const HAUTEUR_DESSIN = 17
/** Les px CSS d'une unité de ces dessins : les places publiées sont celles qu'on voit */
export const ECHELLE = HAUTEUR_DESSIN / 18
const aLEchelle = (v: number) => +(v * ECHELLE).toFixed(1)

/** Un dessin d'élément sans son infobulle : Clawd le promène dans une image, où elle ne servirait pas */
const sansTitre = (svg: string) => svg.replace(/<title>[\s\S]*?<\/title>/g, '')

/** Le jeu laissé au moins entre le dessin des jauges et le coin de Clawd (px) : une estimation des largeurs de texte n'y pousse pas Clawd */
const MARGE_QUOTAS = 16
/**
 * La conso comptée à cette longueur au moins (« tour 999 k · 12,34 € ») pour
 * choisir les rangées : le choix ne dépend pas de ses chiffres, remis à zéro
 * à chaque tour (sinon la bande changerait de forme deux fois par tour)
 */
const CONSO_RESERVEE = 20
const consoReservee = (c: Plan['conso']) => (c ? { ...c, texte: c.texte.padEnd(CONSO_RESERVEE) } : null)

/** La largeur (px) d'un dessin des quotas pour choisir les rangées : la conso à sa longueur réservée */
const largeurQuotas = (j: readonly Jauge[], quand: (ms: number) => string, p: Plan) =>
  aLEchelle(svgJauges(j, quand, { conso: consoReservee(p.conso), conseil: p.conseil }).largeur)

/**
 * La conso et le conseil passent-ils sur la rangée du dessous (`suite`) ?
 * Oui quand, à la suite des jauges, ils pousseraient le coin de Clawd hors de
 * la bande : un dessin ne passe pas à la ligne. Largeur de la bande inconnue : non.
 */
export function quotasCoupes(p: Plan, quand: (ms: number) => string, bandePx: number | null): boolean {
  if (!bandePx || !p.lignes.includes('quotas') || p.jauges.length === 0 || !(p.conso || p.conseil)) return false
  return largeurQuotas(p.jauges, quand, p) > bandePx - COIN_CLAWD - MARGE_QUOTAS
}

/**
 * Ce que prennent les commandes derrière leur case vide (px) : 🆕, Commit, ↻
 * et Masquer. Commit est compté dès qu'il peut s'afficher, même pendant un
 * tour (où il se cache) : la rangée ne change pas à chaque tour. Masquer est
 * dans la rangée sur le bureau (vu sur une capture du 2026-10-22, malgré
 * `role="dismiss"`) : s'il passait seul à la ligne, la rangée de 🆕 en
 * ferait deux, et sa ligne publiée serait fausse.
 */
export function largeurCommandes(git: AtelierGit | null): number {
  const commit = git ? libelleCommit(git) : null
  return (
    // (les boutons sont séparés par un petit écart, ~6 px sur la capture)
    ESPACE + largeurBouton(LIBELLE_NOUVELLE) + ESPACE + (commit ? largeurBouton(commit) + 6 : 0) + largeurBouton('↻') + 6 + largeurBouton('Masquer')
  )
}

/**
 * Les commandes (🆕, Commit, ↻, Masquer) ont-elles leur propre rangée ? Oui
 * quand elles ne tiendraient pas au bout de la leur (la ligne git, sinon le
 * dernier dessin des quotas) : elles y passeraient à la ligne, et la bande
 * partagée annoncerait 🆕 sur la mauvaise rangée (Clawd montrerait un endroit
 * vide). Oui aussi sans ligne git ni quotas : elles ne seraient nulle part.
 * Largeur de la bande inconnue : non.
 */
export function commandesAPart(p: Plan, quand: (ms: number) => string, bandePx: number | null): boolean {
  const surGit = p.git !== null && p.lignes.includes('git')
  if (!surGit && !p.lignes.includes('quotas')) return true
  if (!bandePx) return false
  const debut = surGit && p.git ? largeurGit(p.git) : quotasCoupes(p, quand, bandePx) ? largeurQuotas([], quand, p) : largeurQuotas(p.jauges, quand, p)
  return debut + largeurCommandes(p.git) > bandePx - COIN_CLAWD
}

/**
 * Les lignes telles qu'elles sont dessinées : coupées, la conso et le conseil
 * ont la leur (`suite`), sous les jauges ; à part, les commandes aussi
 * (`commandes`), sous la ligne git, sinon sous les quotas
 */
export function lignesDessinees(p: Plan, coupe: boolean, aPart = false): AtelierScene['lignes'] {
  const l: AtelierScene['lignes'] = coupe ? p.lignes.flatMap(x => (x === 'quotas' ? (['quotas', 'suite'] as const) : [x])) : [...p.lignes]
  if (!aPart) return l
  const i = l.includes('git') ? l.indexOf('git') + 1 : l.findIndex(x => x === 'pastilles' || x === 'occupe')
  const ou = i < 0 ? l.length : i
  return [...l.slice(0, ou), 'commandes', ...l.slice(ou)]
}

/**
 * La hauteur des rangées (px CSS), relevée sur une capture desktop à 250 % :
 * une rangée de dessins (jauges, conso, pastilles) fait ~16,5 px, celle qui
 * porte les boutons natifs (🆕, ↻, Masquer) ~20 px ; une rangée de texte seul,
 * la hauteur d'une ligne de Segoe UI 13 px (×1,33, non relevée)
 */
export const RANGEE_DESSINS = 16.5
export const RANGEE_BOUTONS = 20
export const RANGEE_TEXTE = 17.3
/** Le jeu sous la dernière rangée, jusqu'au bas du bandeau (même relevé) */
export const MARGE_BAS = 1.2

/** La rangée qui porte les commandes : la leur, sinon la ligne git, sinon le dernier dessin des quotas */
function rangeeDesCommandes(p: Plan, lignes: AtelierScene['lignes']): AtelierScene['lignes'][number] | null {
  if (lignes.includes('commandes')) return 'commandes'
  if (p.git !== null && lignes.includes('git')) return 'git'
  return lignes.includes('suite') ? 'suite' : lignes.includes('quotas') ? 'quotas' : null
}

/** Où est chaque rangée, depuis le bas du bandeau : `bas` et `rangee` (px CSS), de haut en bas comme `lignes` */
export function rangeesDe(p: Plan, lignes: AtelierScene['lignes']): { bas: number; rangee: number }[] {
  const boutons = rangeeDesCommandes(p, lignes)
  const hauteurs = lignes.map(l =>
    l === boutons ? RANGEE_BOUTONS : l === 'quotas' || l === 'suite' || l === 'pastilles' ? RANGEE_DESSINS : RANGEE_TEXTE,
  )
  let bas = MARGE_BAS
  const r: { bas: number; rangee: number }[] = []
  for (let i = hauteurs.length - 1; i >= 0; i--) {
    r[i] = { bas: +bas.toFixed(1), rangee: hauteurs[i]! }
    bas += hauteurs[i]!
  }
  return r
}

/** `bandePx` : la largeur de la bande en px, quand on la connaît (les rangées en dépendent, et ce qui est publié doit être visible) */
export function sceneDuBandeau(p: Plan, quand: (ms: number) => string, bandePx: number | null = null): AtelierScene {
  const coupe = quotasCoupes(p, quand, bandePx)
  const aPart = commandesAPart(p, quand, bandePx)
  const lignes = lignesDessinees(p, coupe, aPart)
  const ligne = (nom: AtelierScene['lignes'][number]) => lignes.length - 1 - lignes.indexOf(nom)
  const elements: AtelierElement[] = []
  // les dessins des quotas, chacun sur sa rangée : les jauges, la conso et le conseil ensemble, ou coupés en deux
  const quotas: { d: ReturnType<typeof svgJauges>; rangee: 'quotas' | 'suite' }[] = !p.lignes.includes('quotas')
    ? []
    : coupe
      ? [
          { d: svgJauges(p.jauges, quand), rangee: 'quotas' },
          { d: svgJauges([], quand, { conso: p.conso, conseil: p.conseil }), rangee: 'suite' },
        ]
      : [{ d: svgJauges(p.jauges, quand, { conso: p.conso, conseil: p.conseil }), rangee: 'quotas' }]
  const dernier = quotas.at(-1)
  // le bouton 🆕 quand il est temps (Clawd vient le montrer) : là où il est toujours, en tête des commandes, derrière
  // une case vide ; sur leur rangée à elles, au bout de la ligne git, sinon au bout du dernier dessin des quotas
  if (p.nouvelle) {
    const surGit = p.git !== null && p.lignes.includes('git')
    const x = aPart ? 0 : surGit && p.git ? largeurGit(p.git) : dernier ? aLEchelle(dernier.d.largeur) : null
    if (x !== null && tient(x + ESPACE, p.nouvelle, bandePx)) {
      const rangee = aPart ? 'commandes' : surGit ? 'git' : (dernier?.rangee ?? 'quotas')
      elements.push({ id: 'nouvelle', genre: 'bouton', etat: 'a-montrer', x: +(x + ESPACE).toFixed(1), largeur: largeurBouton(p.nouvelle), hauteur: HAUTEUR_DESSIN, ligne: ligne(rangee) })
    }
  }
  for (const { d, rangee } of quotas) {
    for (const pl of d.places) {
      // son dessin seul, à l'identique : la même fonction, avec lui seul
      const j = p.jauges.find(j => idJauge(j) === pl.id)
      const seul = j
        ? svgJauges([j], quand)
        : pl.id === 'conso' && p.conso
          ? svgJauges([], quand, { conso: p.conso })
          : pl.id === 'conseil' && p.conseil
            ? svgJauges([], quand, { conseil: p.conseil })
            : null
      elements.push({ id: pl.id, genre: pl.genre, etat: pl.etat, x: aLEchelle(pl.x), largeur: aLEchelle(pl.largeur), hauteur: HAUTEUR_DESSIN, ligne: ligne(rangee), ...(seul ? { dessin: sansTitre(seul.svg) } : {}) })
    }
  }
  if (p.lignes.includes('pastilles')) {
    const toutes = p.groupes.flat()
    for (const pl of svgPastilles(p.groupes, false).places) {
      // l'orbe en cours pèse ~24 Ko : Clawd en dessine une à lui
      const pa = pl.forme === 'encours' ? undefined : toutes.find(x => x.id === pl.id)
      elements.push({
        id: pl.id,
        genre: genreDe(pl.id),
        etat: pl.forme,
        x: aLEchelle(pl.x),
        largeur: aLEchelle(pl.largeur),
        hauteur: HAUTEUR_DESSIN,
        ligne: ligne('pastilles'),
        ...(pl.teinte ? { teinte: pl.teinte } : {}),
        ...(pa ? { dessin: sansTitre(svgPastilles([[{ ...pa, ondes: undefined }]], false).svg) } : {}),
      })
    }
  }
  // un dessin trop large pour la bande est coupé au bord du coin de Clawd : ce qui ne se voit pas n'est pas publié
  // (Clawd ne joue pas avec un élément invisible)
  // chacun avec sa rangée en px : Clawd y pose ses copies au juste (à pas fixe, elles glissaient d'une rangée à l'autre)
  const rangees = rangeesDe(p, lignes)
  for (const e of elements) Object.assign(e, rangees[lignes.length - 1 - e.ligne])
  return { lignes, elements: bandePx ? elements.filter(e => e.x + e.largeur <= bandePx - COIN_CLAWD + 0.5) : elements }
}

type Emprunt = { id: string; jusqua: number }
const estEmprunt = (x: unknown): x is Emprunt =>
  typeof x === 'object' && x !== null && typeof (x as Emprunt).id === 'string' && typeof (x as Emprunt).jusqua === 'number'

/** Ce que Clawd tient encore, d'après son état : ses emprunts pas encore échus (un Clawd planté ne cache rien longtemps) */
export const empruntsDe = (v: unknown, maintenant: number): ReadonlySet<string> =>
  new Set(Array.isArray(v) ? v.filter(estEmprunt).filter(x => x.jusqua > maintenant).map(x => x.id) : [])

/** Le numéro que Clawd joue sur toute la bande, d'après son état, s'il n'est pas fini : son dessin et sa hauteur */
export function grandeSceneDe(v: unknown, maintenant: number): { svg: string; hauteur: number } | null {
  if (typeof v !== 'object' || v === null) return null
  const { svg, hauteur, fin } = v as Record<string, unknown>
  if (typeof svg !== 'string' || !svg.startsWith('<svg') || svg.length > 131_072) return null
  if (typeof hauteur !== 'number' || !(hauteur >= 1 && hauteur <= 200) || typeof fin !== 'number' || !(fin > maintenant)) return null
  return { svg, hauteur: Math.round(hauteur) }
}
