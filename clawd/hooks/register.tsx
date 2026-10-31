// clawd : le petit Claude orange qui vit à droite du bandeau, au-dessus du
// prompt. Pas un mot : tout passe par ses gestes.
//
// Au repos, il se balade sur sa petite scène, puis s'occupe (café, jonglage,
// pêche, guitare, lecture…). Au travail, il déménage ses cartons, et une
// bulle au-dessus de sa tête montre ce que je fais (loupe, crayon…) sans
// l'interrompre. Les grosses réactions ont leur scène : il tape au marteau
// pendant un build, fait la fête quand ça passe, s'assoit sous son nuage quand
// ça casse… Il s'endort quand tu ne fais rien. Chaque sous-agent
// arrive en mini-Clawd qui mime ce que fait son agent, sous l'œil de Clawd,
// chef de chantier. Survole-le : ♥ pour le caresser, 🎲 pour qu'il change
// d'activité.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ToolCallResult } from 'claude-code'

import type { ClawdAnim, ClawdCopain, ElementBande } from '../types'
import { CELLULE, COIN_VIDE, HAUTEUR as HAUTEUR_BANDE, LARGEUR_BANDE, MARGE, MAX_SVG, NUMEROS, RETENUE, departDe, diagnostic, estNumero, numerosAvecMinis, numerosJouables, prepareNumero, svgNumero } from './bande'
import { HUMEUR_DEPART, choisit, decrit as decritHumeur, ecartRepos, estHumeur, estNuit, vecu, vit } from './humeur'
import type { Humeur } from './humeur'
import { ACTIVITES, BAILLE_S, BONBON_S, CLAWD_TEXTE, DANSES, EMOJI, EN_BULLE, JEUX_CARTONS, RAPPORT_S, SORTIES, TAILLE, avecT0, bulleDedans, dureeBoulot, dureeRetour, dureeScene, estChoregraphie, etatBoulot, etatScene, minisAPart, svgBulle, svgDecor, svgMinis, svgScene, teinte, teinteConnue, tenueDe } from './sprite'
import type { Bulle, Deguisement, EnPlace, Insigne, Mini, Sortie, Tenue } from './sprite'


const passage = atom({ plugin: 'clawd', key: 'passage' } as const, null)
const activite = atom({ plugin: 'clawd', key: 'activite' } as const, null)
const dort = atom({ plugin: 'clawd', key: 'dort' } as const, false)
const fatigue = atom({ plugin: 'clawd', key: 'fatigue' } as const, false)
const caresses = atom({ plugin: 'clawd', key: 'caresses' } as const, 0)
const copains = atom({ plugin: 'clawd', key: 'copains' } as const, [])
const modele = atom({ plugin: 'clawd', key: 'modele' } as const, null)
const numero = atom({ plugin: 'clawd', key: 'numero' } as const, null)
const motNonLu = atom({ plugin: 'clawd', key: 'mot' } as const, null)
const emprunts = atom({ plugin: 'clawd', key: 'emprunts' } as const, [])
const grandeScene = atom({ plugin: 'clawd', key: 'grandeScene' } as const, null)
const pilote = atom({ plugin: 'clawd', key: 'pilote' } as const, false)
const transpire = atom({ plugin: 'clawd', key: 'sueur' } as const, 0)
const niveau = atom({ plugin: 'clawd', key: 'niveau' } as const, 0)
/** La bande partagée d'atelier : ce qu'il y dessine, et où */
const sceneAtelier = atom({ plugin: 'atelier', key: 'scene' } as const, null)
const atelierMasque = atom({ plugin: 'atelier', key: 'isHidden' } as const, false)

const SOMMEIL_MS = 10 * 60_000
const LONG_TOUR_MS = 2 * 60_000
const LONG = 15 * 60_000

let derniereActivite = 0
/**
 * Le tour en cours vient de toi (tu as écrit) : ses outils le réveillent et
 * comptent dans ta séance. Un tour lancé par une notification de tâche de
 * fond, une routine ou une autre session, non : la nuit, il dort ; le jour,
 * ta pause reste une pause.
 */
let tourDeToi = true
/** Un numéro tourne (miroir de l'atome `numero`, pour que son minuteur n'ait rien à lire quand il n'y en a pas) */
let numeroLance = false
/**
 * Les agents lancés par un workflow (`agent.spawn` le dit) : `$.agent.list`
 * ne les montre jamais (doc du moteur), leur mini attend son SubagentStop au
 * lieu d'être jugé parti au bout d'une minute
 */
const agentsWorkflow = new Set<string>()
/** Un mini jamais rendu (SubagentStop manqué) s'en va quand même au bout de deux heures */
const PLAFOND_MINI_MS = 2 * 3600_000
/** Quand le dernier numéro a été décidé : tant qu'il s'écrit, le minuteur ne le croit pas fini (sinon il effacerait son dessin) */
let numeroLanceA = 0
/** Un questionnaire de l'app tient la bande : personne n'y dessine la grande scène, pas de numéro */
let sondage = false
let tic = 0
/** Quand la fenêtre de 5 h se remet à zéro (ms), d'après la dernière mesure : passé ce moment, il n'est plus épuisé */
let resetCinqH: number | null = null
/** Sa dernière danse à ton bouton : jamais deux fois la même d'affilée */
let derniereDanse: ClawdAnim | null = null
/**
 * Son humeur (humeur.ts) : elle décide de ce qu'il fait quand personne ne
 * lui demande rien. Relue à chaque session, notée chaque minute.
 */
let humeur: Humeur = { ...HUMEUR_DEPART }
let humeurVecue = 0
/** Tu n'as rien fait depuis ce temps : il est seul, il commence à s'ennuyer */
const SEUL_MS = 3 * 60_000
/** La fin de sa sieste (de jour, il se réveille tout seul) ; null : pas de sieste, ou il dort pour la nuit */
let finSieste: number | null = null
export const humeurActuelle = () => ({ ...humeur })
let derniereScene: ClawdAnim | null = null
/** Au repos il alterne : sa balade entière, puis une activité, puis la balade… */
let finActivite = 0
let vertigeMontre = false
let couchePropose = false
/**
 * Temps déjà joué de son déménagement dans ce tour de Claude (ms). Interrompu
 * (une réaction, un numéro), il reprend pile où il en était, là où il était ;
 * au tour suivant, il recommence sa boucle au début : chez lui, les cartons
 * lui tombent du ciel (il s'y met sans sauter d'un bout à l'autre).
 */
let boulotJoue = 0
let boulotDepuis: number | null = null
/** Le temps de son trajet jusqu'à son déménagement (ms) : son horloge ne compte qu'une fois arrivé */
let boulotAttente = 0
/** Les tours de Claude finis dans cette session, et celui de son déménagement en cours */
let toursFinis = 0
let boulotTour = -1
/** À partir de combien de sous-agents en même temps le chef sort son sifflet */
const SIFFLE_DES = 3
/** Le modèle de chaque sous-agent lancé, par id (agent.spawn le dit, SubagentStart non) */
const modelesCopains = new Map<string, string>()
/**
 * Les mini-Clawds qui viennent rendre leur travail : celui qui le rend en ce
 * moment (son rapport se joue), et le dernier fini qui attend son tour (une
 * seule scène attend : la plus récente, donc lui).
 */
let rapportEnCours: Mini | null = null
let rapportSuivant: Mini | null = null
/** Comment le dernier mini est reparti : le suivant s'en va autrement */
let derniereSortie: Sortie | null = null
/** Au hasard dans `liste`, mais pas comme la dernière fois (`avant`) : la sortie d'un mini, un jeu de cartons */
export function autreQue<T>(liste: readonly T[], avant: T | null, hasard: () => number = Math.random): T {
  const choix = liste.filter(x => x !== avant)
  return choix[Math.floor(hasard() * choix.length)]!
}
/** La bulle affichée, et où en était sa scène quand elle est apparue (s) */
let bulleVue: { id: number; deja: number } | null = null
/**
 * Ce que son coin affiche en ce moment : de quoi son dessin dépend (scène,
 * couleur, équipe, déguisement, là où il la joue) et depuis quand. Chaque
 * rendu le recale sur l'instant où en est sa scène (`avecT0`) : l'app recrée
 * son image quand la bande change, et une image neuve repartait du début.
 */
let dessinAffiche: { cle: string; depuis: number; rentre?: EnPlace } | null = null
/** Le dessin de ses mini-Clawds affiché en ce moment (à part du sien, sans son décalage), et de quoi il dépend */
let minisAffiches: { cle: string; source: string | null } | null = null
/**
 * Ce que son coin montrait au dernier rendu hors numéro : sa scène, depuis
 * quand, son décalage (le trajet qui la précédait), et s'il la jouait sur
 * place (au milieu de ses cartons) : de quoi savoir où une scène coupée le
 * laisse
 */
let coinVu: { anim: ClawdAnim; depuis: number; decale: number; enPlace: EnPlace | null; passage: boolean } | null = null
/** Où il était quand son numéro a commencé : il y revient, et la scène suivante part de là */
let lieuNumero: EnPlace | null = null
/**
 * Son trajet à pied d'une scène à l'autre : d'où (et ce qu'il laisse là, qui
 * s'efface), vers où (le départ de la scène suivante), depuis quand. Une
 * scène qui commence pendant ce temps le reprend là où il en est (le rendu
 * « au repos » et la fin du tour arrivent dans un ordre ou dans l'autre)
 */
let retourChez: { etat: EnPlace; vers: number; debut: number } | null = null
const dureeTrajet = (r: { etat: EnPlace; vers: number }) => dureeRetour(r.etat.x, r.vers)
/** Il est en route d'une scène à l'autre ? */
const enRetour = (maintenant: number) => retourChez !== null && maintenant - retourChez.debut < dureeTrajet(retourChez) * 1000
/** La scène en cours (son passage), quand elle a commencé sur place : elle y reste jusqu'au bout, même si le tour finit */
let placeDuPassage: { id: number; place: EnPlace } | null = null
/** Les minis d'un rapport, tels qu'au début du rapport (son passage) : la scène dure 6 s, elle ne repart pas si un autre sous-agent change d'outil */
let minisDuRapport: { id: number; minis: Mini[] } | null = null

const pioche = <T,>(l: readonly T[]) => l[Math.floor(Math.random() * l.length)]!

/**
 * Ses scènes passagères vont au bout, l'une après l'autre. **Une action ne se
 * coupe jamais** (une scène qui se joue, une activité, un numéro) : la
 * priorité ne règle que l'ordre de la file. Sauf par toi : tes gestes (♥, 🕺,
 * 🎲) passent tout de suite, même par-dessus le précédent (`joueGeste`).
 * - 5, tes gestes (♥, 🕺) et la démo d'une leçon : les premiers servis ;
 * - 4, ce qui attend ton action ou la signale : la question, le refus ;
 * - 3, le verdict d'une commande (la fête, la tristesse, la délivrance, le
 *   découragement, le soulagement d'un conflit résolu), le rapport d'un
 *   mini, le vertige, le rappel de pause, ses retrouvailles quand tu
 *   reviens de loin ;
 * - 2, ce qui dure tant qu'une chose dure (un build, des tests, un push, un
 *   compactage, une permission en attente, un conflit git) ;
 * - 1, les petites réactions (un fichier lu, un mot de toi) ; 0, son coucou.
 * Seuls les états de fond (le 2, qui dure tant que sa chose dure) cèdent la
 * place à une scène plus importante, puis reprennent tant que leur chose dure.
 * Les petites qui attendent (quelques-unes, une par nature) passent par ordre
 * de priorité ; une qui a trop attendu ne dit plus rien de ce qui se passe :
 * elle tombe. Seuls tes gestes coupent.
 */
/** `prio` : l'ordre dans la file (jamais une raison de couper une action) */
type EnAttente = { anim: ClawdAnim; ms: number; depuis: number; fraiche: number; prio: number }
/**
 * La scène qui joue : seule source de vérité de la file (`passage` n'est que
 * ce qui s'affiche). Décidée et posée sans `await` entre les deux : deux
 * réactions parallèles (des outils lancés ensemble) ne se marchent pas dessus.
 */
let enScene: { id: number; anim: ClawdAnim; ms: number; fin: number; depuis: number } | null = null
/** Les petites scènes qui attendent leur tour (une par nature, quelques-unes au plus) : la plus prioritaire passe, puis la plus récente */
const enFile: EnAttente[] = []
const FILE_MAX = 4
/** Les scènes qui durent tant qu'une chose dure, passées devant : elles reprennent, une par nature */
const longues = new Map<ClawdAnim, EnAttente>()
/** Une petite scène qui a trop attendu ne dit plus rien de ce qui se passe */
const FRAICHE_MS = 6000
/** Un verdict, un rappel : il attend bien plus longtemps avant de se périmer */
const FRAICHE_IMPORTANT_MS = 60_000
/** Ce qu'il te répond (il t'écoute, se réveille, te dit d'aller dormir) : il attend la fin de ce qu'il fait, un peu plus longtemps qu'une réaction à un outil */
const FRAICHE_REPONSE_MS = 20_000
const REPONSES: readonly ClawdAnim[] = ['ecoute', 'nuit', 'reveil', 'coucou']
/** Ce qui dure encore parmi les scènes sans fin (build, question…) : une scène passée devant ne reprend que si sa chose dure */
const durent = new Set<ClawdAnim>()
const sansFin = (ms: number) => ms >= LONG

/** Les messages qui ne viennent pas de toi : une tâche de fond qui finit, une routine, une autre session */
const MESSAGES_MACHINE = ['task-notification', 'scheduled-trigger', 'peer', 'peer-send-message', 'projects-relay', 'coordinator', 'observer', 'observer-activity']
/** Ce message vient-il de toi (ou d'un plugin en ton nom), et pas d'une notification ou d'une routine ? */
export function deToi(e: { isMeta?: unknown; origin?: unknown }): boolean {
  return e.isMeta !== true && !MESSAGES_MACHINE.includes(String((e.origin as { kind?: unknown } | undefined)?.kind))
}

/** Cette scène se joue ou attend déjà son tour : inutile de la redire */
function dejaDit(anim: ClawdAnim, p: { anim: ClawdAnim } | null) {
  return p?.anim === anim || enScene?.anim === anim || enFile.some(s => s.anim === anim)
}

/** L'importance d'une scène (voir plus haut) */
export function priorite(anim: ClawdAnim): number {
  if (anim === 'alerte' || anim === 'question') return 4
  // (le rapport d'un mini aussi : son mini a déjà quitté l'équipe, une loupe ne doit pas le remplacer)
  if (['fete', 'triste', 'delivrance', 'decourage', 'gratte', 'paquet', 'pause', 'rapport', 'vertige', 'soulage', 'attendu', 'retrouvailles', 'niveau'].includes(anim)) return 3
  if (LONGUES.includes(anim) || anim === 'tasse' || anim === 'attend' || anim === 'nuit' || anim === 'cache') return 2
  return anim === 'coucou' ? 0 : 1
}

/** Retient une scène qui attend : une qui dure garde sa place (une par nature) ; une petite, la plus prioritaire puis la plus récente */
function retient(s: EnAttente) {
  if (sansFin(s.ms)) {
    longues.set(s.anim, s)
    return
  }
  // la même nature qui attendait : remplacée par la plus récente ; trop de monde : la moins importante (puis la plus vieille) tombe
  const i = enFile.findIndex(x => x.anim === s.anim)
  if (i >= 0) enFile.splice(i, 1)
  enFile.push(s)
  if (enFile.length > FILE_MAX) {
    const pire = enFile.reduce((a, b) => (b.prio < a.prio || (b.prio === a.prio && b.depuis < a.depuis) ? b : a))
    enFile.splice(enFile.indexOf(pire), 1)
  }
}

/**
 * Joue une scène passagère, effacée au bout de `ms`. **Une action ne se coupe
 * jamais** : une scène qui se joue, une activité (lecture, danse…), un numéro
 * sur la bande vont au bout ; la nouvelle attend son tour. Les priorités
 * (`urgent` : la démo d'une leçon) ne règlent que l'ordre de la file ; tes
 * gestes, eux, passent tout de suite (`joueGeste`). Seul un
 * état de fond (« un build tourne », « il attend ta permission »), qui dure
 * tant qu'une chose dure, cède la place à une scène plus importante, puis
 * reprend. `fraiche` : combien de temps elle peut attendre avant de tomber.
 * Renvoie son id, null si elle attend.
 */
export async function scene($: EngineInterface, anim: ClawdAnim, ms = 4000, urgent = false, fraiche?: number) {
  const prio = urgent ? 5 : priorite(anim)
  const f = fraiche ?? (urgent || prio >= 3 ? FRAICHE_IMPORTANT_MS : REPONSES.includes(anim) ? FRAICHE_REPONSE_MS : FRAICHE_MS)
  if (sansFin(ms)) durent.add(anim)
  const maintenant = await $.clock.now()
  const numeroPose = (await read($, numero)) !== null
  const activiteEnCours = (await read($, activite)) !== null && maintenant < finActivite
  // à partir d'ici, plus aucun await avant de poser la scène : la décision reste vraie
  const courante = enScene && maintenant < enScene.fin ? enScene : null
  // (un numéro décidé mais pas encore posé compte déjà ; une activité cachée sous un état de fond ne se voit pas : elle ne retient rien)
  const enAction = numeroPose || numeroLance || (activiteEnCours && !(courante && sansFin(courante.ms)))
  // une action en cours (numéro, activité, scène qui se joue) : jamais coupée
  if (enAction || (courante && !sansFin(courante.ms))) {
    retient({ anim, ms, depuis: maintenant, fraiche: f, prio })
    return null
  }
  // un état de fond (build, permission) : une scène moins importante attend, une plus importante passe, et il reprend après
  if (courante) {
    if (prio <= priorite(courante.anim)) {
      retient({ anim, ms, depuis: maintenant, fraiche: f, prio })
      return null
    }
    retient({ anim: courante.anim, ms: courante.ms, depuis: courante.depuis, fraiche: FRAICHE_MS, prio: priorite(courante.anim) })
  }
  return joueScene($, anim, ms, maintenant)
}

async function joueScene($: EngineInterface, anim: ClawdAnim, ms: number, maintenant: number) {
  // ce qui réussit le rend heureux (et lui rapporte de l'expérience, comme un mini qui lui rend son travail)
  if (anim === 'fete' || anim === 'delivrance') humeur = vecu(humeur, 'reussite')
  if (anim === 'fete' || anim === 'delivrance' || anim === 'rapport') void gagne($, anim === 'rapport' ? XP_RAPPORT : XP_REUSSITE).catch(() => {})
  // le mini qui rend son travail : le dernier fini ; il s'en va autrement que le précédent qu'on a vu partir (tiré ici,
  // quand il se joue : un fini qui en remplace un autre en attente ne compte pas)
  if (anim === 'rapport' && rapportSuivant) {
    const sortie = autreQue(SORTIES, derniereSortie)
    derniereSortie = sortie
    rapportEnCours = typeof rapportSuivant === 'string' ? { fait: rapportSuivant, sortie } : { ...rapportSuivant, sortie }
    rapportSuivant = null
  }
  const id = Math.random()
  enScene = { id, anim, ms, fin: maintenant + ms, depuis: maintenant }
  $.clock.after(ms, () => void finScene($, id).catch(() => {}))
  await update($, passage, () => ({ id, anim }))
  return id
}

/**
 * Une scène est finie : la suivante, si elle dit encore quelque chose. Elle
 * prend sa place d'un coup : effacer d'abord laissait voir une image du fond
 * entre les deux (ses cartons surgissaient le temps d'un éclair).
 */
async function finScene($: EngineInterface, id: number) {
  if (enScene?.id === id) enScene = null
  try {
    await suivanteScene($)
  } finally {
    await efface($, id)
  }
}

/** La scène `id` n'est plus affichée, si rien ne l'a remplacée ; la suivante passe */
async function efface($: EngineInterface, id: number | null) {
  if (id === null || (await read($, passage))?.id !== id) return
  await update($, passage, p => (p?.id === id ? null : p))
  await suivanteScene($)
}

/** La suivante : la plus importante entre la petite qui attend et les longues passées devant, encore valables */
async function suivanteScene($: EngineInterface) {
  const maintenant = await $.clock.now()
  const numeroActif = (await read($, numero)) !== null || numeroLance
  const activiteActive = (await read($, activite)) !== null && maintenant < finActivite
  // sans await jusqu'à la fin : rien ne vient s'intercaler ; jamais pendant une action
  const courante = enScene && maintenant < enScene.fin ? enScene : null
  // une scène finie dont le minuteur n'est pas encore passé : c'est lui qui relancera la file
  if (enScene && !courante) return
  // une scène qui se joue va au bout ; un état de fond (build, question…), lui, peut céder
  if (numeroActif || (courante && !sansFin(courante.ms))) return
  // une activité visible va au bout ; cachée sous un état de fond, elle ne retient rien
  if (activiteActive && !courante) return
  const candidates: EnAttente[] = []
  // la petite : encore fraîche ? (et sa chose, si elle en a une, dure toujours)
  // les petites : encore fraîches (les autres tombent)
  for (const s of [...enFile]) if (maintenant - s.depuis > s.fraiche) enFile.splice(enFile.indexOf(s), 1)
  // (la plus récente d'abord : à importance égale, c'est elle qui passe)
  candidates.push(...[...enFile].reverse())
  for (const l of longues.values()) if (durent.has(l.anim)) candidates.push(l)
  const s = candidates.sort((a, b) => b.prio - a.prio || (sansFin(b.ms) ? 1 : 0) - (sansFin(a.ms) ? 1 : 0) || b.depuis - a.depuis)[0]
  if (!s) return
  // sous un état de fond, seule une plus importante passe devant (comme dans scene()) ; il reprendra après
  if (courante) {
    if (s.prio <= priorite(courante.anim)) return
    enScene = null
    retient({ anim: courante.anim, ms: courante.ms, depuis: courante.depuis, fraiche: FRAICHE_MS, prio: priorite(courante.anim) })
  }
  if (enFile.includes(s)) enFile.splice(enFile.indexOf(s), 1)
  else longues.delete(s.anim)
  await joueScene($, s.anim, s.ms, maintenant)
}

/**
 * La chose que montrait une scène sans fin est finie (le build, la question…) :
 * elle s'arrête, en cours ou en attente. La suivante prend sa place d'un coup ;
 * `garde` : elle reste affichée jusqu'à ce que ce qui suit la remplace (le
 * verdict d'une commande), puis `efface` avec l'identifiant rendu.
 */
async function arrete($: EngineInterface, quoi: (anim: ClawdAnim) => boolean, garde = false): Promise<number | null> {
  for (const a of [...durent]) if (quoi(a)) durent.delete(a)
  for (const a of [...longues.keys()]) if (quoi(a)) longues.delete(a)
  for (const s of [...enFile]) if (quoi(s.anim)) enFile.splice(enFile.indexOf(s), 1)
  // la source de vérité d'abord : même si l'affichage a divergé, la scène en cours s'arrête
  if (enScene && quoi(enScene.anim)) enScene = null
  // par nature de scène (ce qui est affiché), pas par identifiant
  const p = await read($, passage)
  const affichee = p && quoi(p.anim) ? p.id : null
  try {
    await suivanteScene($)
  } finally {
    if (!garde) await efface($, affichee)
  }
  return affichee
}

/**
 * Ton geste 🎲 : la petite scène en cours et celles qui attendaient
 * s'arrêtent ; ce qui dure tant qu'une chose dure (une question posée, un
 * build) reprend aussitôt : tu zappes ses humeurs, pas ses informations.
 */
async function coupeScenes($: EngineInterface) {
  const c = enScene && sansFin(enScene.ms) ? enScene : null
  enFile.length = 0
  enScene = null
  if (c) retient({ anim: c.anim, ms: c.ms, depuis: c.depuis, fraiche: FRAICHE_MS, prio: priorite(c.anim) })
  await update($, passage, () => null)
  await suivanteScene($)
}

/**
 * Ton geste (♥, 🕺) passe tout de suite : ce qu'il fait s'arrête, une scène,
 * une activité, un numéro (il rend ce qu'il tenait), même ton geste d'avant
 * (un deuxième clic n'attend pas la fin du premier). Ce qui attendait son tour
 * attend encore ; ce qui dure tant qu'une chose dure (un build, une question)
 * reprend après lui. Son trajet depuis là où il était, lui, se fait (le rendu
 * n'a jamais de saut).
 */
async function joueGeste($: EngineInterface, anim: ClawdAnim, ms: number) {
  await finNumero($)
  // son activité s'arrête là (tu lui demandes autre chose) : son minuteur, périmé, n'y touchera plus
  if ((await read($, activite)) !== null) {
    finActivite = 0
    await update($, activite, () => null)
  }
  const maintenant = await $.clock.now()
  // sans await d'ici à la pose : la scène en cours s'arrête ; un état de fond attend derrière ton geste
  const c = enScene && maintenant < enScene.fin ? enScene : null
  enScene = null
  if (c && sansFin(c.ms)) retient({ anim: c.anim, ms: c.ms, depuis: c.depuis, fraiche: FRAICHE_MS, prio: priorite(c.anim) })
  return joueScene($, anim, ms, maintenant)
}

/** Un rechargement du mod, ou une nouvelle session : tout repart de zéro */
async function reinitialiseScenes($: EngineInterface) {
  enScene = null
  enFile.length = 0
  rapportEnCours = null
  rapportSuivant = null
  longues.clear()
  durent.clear()
  if (await read($, passage)) await update($, passage, () => null)
}

/**
 * Sa journée, qui commence à 5 h : une session à 1 h du matin compte encore
 * pour la veille (il n'a pas dormi entre-temps).
 */
function journee(ms: number) {
  const d = new Date(ms - 5 * 3_600_000)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

/**
 * Le premier signe de vie de la journée (une session, ou ton premier message
 * dans une session restée ouverte la nuit) : vrai si la dernière fois qu'il
 * t'a vu, c'était une autre journée. Retenu d'une session à l'autre.
 */
async function premierDuJour($: EngineInterface, maintenant: number) {
  const aujourdhui = journee(maintenant)
  const vu = await $.store.get('journee')
  if (vu === aujourdhui) return false
  await $.store.set('journee', aujourdhui)
  return typeof vu === 'string'
}

/** Plus de 8 h sans te voir : il t'a attendu ; plus d'un jour et demi : tu lui as manqué */
const ATTENDU_MS = 8 * 3_600_000
const MANQUE_MS = 36 * 3_600_000

/**
 * Tu es là (une session qui s'ouvre, un message de toi) : combien de temps il
 * ne t'avait pas vu, et la scène de retrouvailles qui va avec (ou null). Ta
 * dernière visite est retenue d'une session à l'autre ; la toute première fois,
 * il se souvient de ta dernière séance de travail.
 */
async function retrouvailles($: EngineInterface, maintenant: number): Promise<ClawdAnim | null> {
  let vu = await $.store.get('vuA').catch(() => undefined)
  if (typeof vu !== 'number') {
    const s = await $.store.get('enchaine').catch(() => undefined)
    vu = estEnchaine(s) ? s.dernier : undefined
  }
  await $.store.set('vuA', maintenant).catch(() => {})
  // (une horloge qui recule ne compte pas comme une absence)
  if (typeof vu !== 'number' || maintenant < vu) return null
  const absent = maintenant - vu
  return absent >= MANQUE_MS ? 'retrouvailles' : absent >= ATTENDU_MS ? 'attendu' : null
}

/**
 * Ce qu'il porte à cette heure (la tienne) : le 31 octobre, toute la journée,
 * son chapeau-citrouille ; le vendredi à partir de 17 h, ses lunettes de
 * soleil ; le lundi avant 10 h, ses cernes.
 */
export function deguisementDu(ms: number): Deguisement | undefined {
  const d = new Date(ms)
  if (d.getMonth() === 9 && d.getDate() === 31) return 'citrouille'
  if (d.getDay() === 5 && d.getHours() >= 17) return 'lunettes'
  if (d.getDay() === 1 && d.getHours() < 10) return 'cernes'
  return undefined
}

/** Ce que l'heure lui donne envie de faire au repos : se détendre le vendredi soir, bâiller le lundi matin */
const ENVIE_DU: Partial<Record<Deguisement, ClawdAnim>> = { lunettes: 'detente', cernes: 'baille' }
/** Il y cède à peu près une fois sur trois (jamais deux fois d'affilée) */
const ENVIE_P = 0.35

/** Il émerge : bâillement, étirement, bonnet jeté, café, et le voilà en forme. */
function emerge($: EngineInterface) {
  return scene($, 'reveil', dureeScene('reveil') * 1000)
}

/** Il a sommeil mais finit ce qu'il fait : il s'endort à la fin (nuit : pour de bon, sinon une sieste) */
let sommeilEnAttente: { nuit: boolean } | null = null

async function sEndort($: EngineInterface, maintenant: number, nuit: boolean) {
  sommeilEnAttente = null
  finSieste = nuit ? null : maintenant + (3 + Math.random() * 3) * 60_000
  await update($, activite, () => null)
  await update($, dort, () => true)
}

async function reveil($: EngineInterface) {
  derniereActivite = await $.clock.now()
  sommeilEnAttente = null
  finSieste = null
  humeur = vecu(humeur, 'parle')
  if (await read($, dort)) await update($, dort, () => false)
}

/** Le temps passe pour son humeur (appelé souvent : le pas de temps est mesuré) */
async function vitSonHumeur($: EngineInterface, maintenant: number) {
  const dt = humeurVecue ? maintenant - humeurVecue : 0
  humeurVecue = maintenant
  humeur = vit(humeur, dt, { dort: (await read($, dort)) === true, seul: maintenant - derniereActivite > SEUL_MS })
}

/**
 * Tire une activité au sort selon son humeur (jamais deux fois la même
 * d'affilée) ; le vendredi soir ou le lundi matin, l'envie du moment passe
 * souvent avant.
 */
function tirage(maintenant: number) {
  const d = deguisementDu(maintenant)
  const envie = d ? ENVIE_DU[d] : undefined
  const anim = envie && envie !== derniereScene && Math.random() < ENVIE_P ? envie : choisit(humeur, ACTIVITES, derniereScene)
  derniereScene = anim
  return { anim }
}

// ------------------------------------------------ sa tenue, son expérience

/** Les modes où Claude agit sans te demander : il met sa visière de pilote automatique */
const MODES_PILOTE: readonly string[] = ['auto', 'bypassPermissions']
/**
 * Le mode de permission du tour principal : chaque événement « classique » le
 * dit (Maj+Tab le change en cours de route) ; un sous-agent a celui de son
 * parent.
 */
async function notePilote($: EngineInterface, e: { permission_mode?: unknown; agent_id?: unknown }) {
  if (e.agent_id !== undefined || typeof e.permission_mode !== 'string') return
  const p = MODES_PILOTE.includes(e.permission_mode)
  if ((await read($, pilote)) !== p) await update($, pilote, () => p)
}

/** Le contexte se remplit (%) : une goutte de sueur à partir de la moitié, deux gouttes et les joues rouges passé 70 % */
export const sueurDe = (pourcent: number): 0 | 1 | 2 => (pourcent >= 70 ? 2 : pourcent >= 50 ? 1 : 0)

/**
 * Son expérience : chaque outil lancé (le sien ou celui d'un sous-agent) lui
 * rapporte 1 point, chaque réussite fêtée 5, chaque mini qui lui rend son
 * travail 3. Gardée d'une session à l'autre (`$.store`, clé `xp`) : chaque
 * session ajoute ce qu'elle a gagné au total, sans écraser celui des autres.
 */
const XP_OUTIL = 1
const XP_REUSSITE = 5
const XP_RAPPORT = 3
/** Ce qu'il faut pour le niveau `n` : 50, 150, 300, 500, 750… (chaque niveau demande 50 points de plus que le précédent) */
export const seuilNiveau = (n: number) => 25 * n * (n + 1)
/** Son niveau pour `xp` points */
export function niveauDe(points: number): number {
  let n = Math.max(0, Math.floor((Math.sqrt(1 + (4 * Math.max(0, points)) / 25) - 1) / 2))
  while (seuilNiveau(n + 1) <= points) n++
  while (n > 0 && seuilNiveau(n) > points) n--
  return n
}
/** L'insigne de son niveau : une médaille de bronze dès le 1, d'argent au 5, d'or au 10, l'étoile au 20 */
export const insigneDe = (n: number): Insigne | undefined => (n >= 20 ? 'etoile' : n >= 10 ? 'or' : n >= 5 ? 'argent' : n >= 1 ? 'bronze' : undefined)
let xp = 0
/** Ce qu'il a gagné depuis que c'est noté : ajouté au total gardé (relu), pas écrit par-dessus */
let xpANoter = 0
/** Le plus haut niveau vu par cette session : deux outils lancés ensemble ne le font pas monter deux fois */
let niveauVu = 0
/** Un niveau atteint qu'il n'a pas encore fêté : il attend qu'on le voie (une session en arrière-plan ne le fête pas) */
let niveauAFeter: number | null = null
/** Ce qui se note, l'un après l'autre : deux écritures du total qui se croisent en perdraient une */
let notes: Promise<void> = Promise.resolve()

/** Il gagne `n` points ; passé un seuil, son total est noté (avec celui des autres sessions) et il monte de niveau */
async function gagne($: EngineInterface, n: number) {
  xp += n
  xpANoter += n
  if (niveauDe(xp) > niveauVu) await noteXp($)
}

/** Ajoute ce qu'il a gagné au total gardé, une note après l'autre */
function noteXp($: EngineInterface): Promise<void> {
  notes = notes.then(() => note($)).catch(() => {})
  return notes
}

/**
 * Le total gardé, relu (une autre session a pu y ajouter le sien), plus ce
 * qu'il a gagné ici. Une lecture ou une écriture ratée ne perd rien : il
 * réessaiera. Puis son niveau suit, et un niveau franchi se fête.
 */
async function note($: EngineInterface) {
  if (!xpANoter) return
  let garde: unknown
  try {
    garde = await $.store.get('xp')
  } catch {
    return
  }
  const ajout = xpANoter
  const total = (typeof garde === 'number' && garde >= 0 ? garde : 0) + ajout
  try {
    await $.store.set('xp', total)
  } catch {
    return
  }
  xpANoter -= ajout
  xp = total + xpANoter
  const nv = niveauDe(xp)
  if ((await read($, niveau)) !== nv) await update($, niveau, () => nv)
  if (nv > niveauVu) {
    niveauVu = nv
    niveauAFeter = nv
  }
  if (niveauAFeter !== null && dessine) await feteNiveau($)
}

/** Il fête son nouveau niveau, une fois par niveau (même avec plusieurs sessions ouvertes) */
async function feteNiveau($: EngineInterface) {
  const nv = niveauAFeter
  if (nv === null) return
  niveauAFeter = null
  const fete = await $.store.get('niveauFete').catch(() => undefined)
  if (typeof fete === 'number' && fete >= nv) return
  await $.store.set('niveauFete', nv).catch(() => {})
  // (sa scène d'abord : un toast refusé ne la lui retire pas ; derrière une longue action, elle attend son tour sans
  // tomber : elle ne se rejouera pas)
  await scene($, 'niveau', dureeScene('niveau') * 1000, false, 5 * 60_000)
  try {
    $.ui.toast(`⭐ Clawd passe au niveau ${nv} !`, { timeoutMs: 6000 })
  } catch {
    // pas de toast ici : son étoile suffit
  }
}

/** Ce que la session lui fait porter (sa visière, sa sueur, son insigne) ; son déguisement du jour s'y ajoute */
async function tenueSession($: EngineInterface): Promise<Tenue> {
  const s = await read($, transpire)
  const i = insigneDe(await read($, niveau))
  return { visiere: (await read($, pilote)) === true, ...(s === 1 || s === 2 ? { sueur: s } : {}), ...(i ? { insigne: i } : {}) }
}

// ------------------------------------------------------ ses visiteurs

/** Une visite rare au repos : à peu près une activité sur 120 */
const VISITE_P = 1 / 120
/** Et pas deux visites à moins de deux heures d'écart (gardé d'une session à l'autre) */
const VISITE_ECART = 2 * 3_600_000
let derniereVisite = 0

/**
 * Le visiteur qui passe sur sa petite scène au lieu de son activité, s'il en
 * vient un : un chat le jour, une étoile filante le soir (de 20 h à 6 h).
 * Le hasard se décide ici, jamais dans le dessin.
 */
export function visiteur(maintenant: number, derniere: number, hasard: number): ClawdAnim | null {
  if (maintenant - derniere < VISITE_ECART || hasard >= VISITE_P) return null
  const heure = new Date(maintenant).getHours()
  return heure >= 20 || heure < 6 ? 'filante' : 'chat'
}

/** Son activité au repos : un visiteur, rarement (il s'en souvient d'une session à l'autre), sinon son tirage */
async function activiteAuRepos($: EngineInterface, maintenant: number) {
  const v = visiteur(maintenant, derniereVisite, Math.random())
  if (!v) return tirage(maintenant)
  derniereVisite = maintenant
  derniereScene = v
  await $.store.set('visiteA', maintenant).catch(() => {})
  return { anim: v }
}

/**
 * Compte le temps passé à déménager et dit où reprendre la scène (en
 * secondes) : ses cartons restent où il les a laissés.
 */
function reprise(anim: ClawdAnim | null, maintenant: number) {
  // l'horloge est repartie de zéro : on recommence au début
  if (boulotDepuis !== null && maintenant < boulotDepuis) {
    boulotDepuis = null
    boulotJoue = 0
    boulotAttente = 0
  }
  if (anim === 'boulot') {
    if (boulotDepuis === null) {
      // un nouveau tour : sa boucle repart du début (chez lui, les cartons lui tombent du ciel)
      if (boulotTour !== toursFinis) {
        boulotJoue = 0
        boulotTour = toursFinis
      }
      boulotDepuis = maintenant
    }
  } else if (boulotDepuis !== null) {
    boulotJoue += Math.max(0, maintenant - boulotDepuis - boulotAttente)
    boulotDepuis = null
    boulotAttente = 0
  }
  return boulotJoue / 1000
}

/** Où en est son déménagement à cet instant (s) */
const boulotEnCours = (maintenant: number) => (boulotJoue + (boulotDepuis === null ? 0 : Math.max(0, maintenant - boulotDepuis - boulotAttente))) / 1000

/**
 * Son déménagement de ce tour, s'il l'a laissé en route (pas au début de sa
 * boucle, où il est chez lui sans carton) : où il est et ses cartons, pour
 * jouer là ce qui l'interrompt. Null sinon (à son coin).
 */
function boulotEnPlace(maintenant: number): EnPlace | null {
  if (boulotTour !== toursFinis) return null
  const deja = boulotEnCours(maintenant)
  return deja % dureeBoulot() < 0.05 ? null : etatBoulot(deja)
}

/**
 * Où il est en ce moment dans son coin, et ce qui est posé autour de lui,
 * d'après ce que son coin montrait : en route d'une scène à l'autre, au
 * milieu de ses cartons, ou là où en est sa scène. Null avant le premier
 * dessin.
 */
function lieuActuel(maintenant: number, faitBoulot = boulotEnCours(maintenant)): EnPlace | null {
  if (retourChez && enRetour(maintenant)) {
    const u = (maintenant - retourChez.debut) / 1000 / dureeTrajet(retourChez)
    return { x: +(retourChez.etat.x + (retourChez.vers - retourChez.etat.x) * u).toFixed(1), decor: u < 0.5 ? retourChez.etat.decor : '' }
  }
  if (!coinVu) return null
  if (coinVu.enPlace) return coinVu.enPlace
  if (coinVu.anim === 'boulot') return etatBoulot(faitBoulot)
  const t = Math.max(0, (maintenant - coinVu.depuis) / 1000 - coinVu.decale)
  // une scène jouée une fois (un passage) le laisse là où elle finit ; une boucle (sa balade), là où elle en est
  return etatScene(coinVu.anim, coinVu.passage ? Math.min(t, dureeScene(coinVu.anim) - 0.001) : t)
}

/** Lance une activité (ou la balade si `null`) pour sa durée naturelle. */
async function occupe($: EngineInterface, prochaine: { anim: ClawdAnim } | null) {
  const ms = dureeScene(prochaine?.anim ?? 'balade') * 1000
  finActivite = (await $.clock.now()) + ms
  await update($, activite, () => prochaine)
  // l'activité va au bout : ce qui attendait passe alors, et l'affichage suit aussitôt (le rendu ne repasse
  // que si un état change) : au travail ou avec son équipe, ses cartons ou son chantier ; au repos, sa balade ;
  // s'il a sommeil, il s'endort
  if (prochaine) {
    const fin = finActivite
    $.clock.after(ms + 50, () =>
      void (async () => {
        if (finActivite === fin && (await read($, activite)) !== null) {
          const maintenant = await $.clock.now()
          if (sommeilEnAttente && !auTravail) await sEndort($, maintenant, sommeilEnAttente.nuit)
          else if (auTravail || (await read($, copains)).length) await update($, activite, () => null)
          else await occupe($, null)
        }
        await suivanteScene($)
      })().catch(() => {}),
    )
  }
}

// ------------------------------------------------------ ta pause

/** Au-delà de ce temps sans rien faire, tu as fait une pause */
const PAUSE_MS = 15 * 60_000
/** Après ce temps à enchaîner sans pause, il te rappelle d'en faire une */
const ENCHAINE_MS = 2 * 3_600_000
/**
 * Ta séance de travail : depuis quand tu enchaînes, ton dernier signe de vie,
 * et s'il t'a déjà proposé une pause. Gardée d'une session à l'autre : ouvrir
 * une nouvelle session n'est pas une pause.
 */
type Enchaine = { debut: number; dernier: number; rappel: boolean }
let enchaine: Enchaine | null = null

const estEnchaine = (v: unknown): v is Enchaine =>
  typeof v === 'object' && v !== null && typeof (v as Enchaine).debut === 'number' && typeof (v as Enchaine).dernier === 'number'

/**
 * Relit ta séance telle que toutes les sessions l'ont notée, et la fusionne
 * avec la sienne : tu travailles dans plusieurs sessions, c'est une seule
 * séance (sinon chacune te tendrait son verre d'eau, ou croirait à une pause
 * pendant que tu travaillais dans l'autre). Deux séances qui se touchent (pas
 * de vraie pause entre elles) n'en font qu'une : le début le plus ancien, ton
 * dernier signe le plus récent, le rappel s'il est déjà fait ; sinon la plus récente.
 */
async function relitEnchaine($: EngineInterface) {
  const sauve = await $.store.get('enchaine').catch(() => undefined)
  if (!estEnchaine(sauve)) return
  const s = { debut: sauve.debut, dernier: sauve.dernier, rappel: sauve.rappel === true }
  const actuelle = enchaine
  if (!actuelle) enchaine = s
  else if (s.debut <= actuelle.dernier + PAUSE_MS && actuelle.debut <= s.dernier + PAUSE_MS) {
    enchaine = { debut: Math.min(actuelle.debut, s.debut), dernier: Math.max(actuelle.dernier, s.dernier), rappel: actuelle.rappel || s.rappel }
  } else if (s.dernier > actuelle.dernier) enchaine = s
}

/** Tu travailles : après une pause (ou un retour en arrière de l'horloge), une nouvelle séance commence. */
function travaille(maintenant: number) {
  if (!enchaine || maintenant - enchaine.dernier > PAUSE_MS || maintenant < enchaine.dernier) {
    enchaine = { debut: maintenant, dernier: maintenant, rappel: false }
  } else enchaine.dernier = maintenant
}

/**
 * Fin d'un tour : vrai, une seule fois par séance, si tu enchaînes depuis
 * deux heures et qu'il peut te le montrer maintenant (sinon, au tour
 * suivant). La séance est notée pour la session suivante.
 */
async function pauseDue($: EngineInterface, maintenant: number, peutMontrer: boolean) {
  await relitEnchaine($)
  travaille(maintenant)
  const due = peutMontrer && !enchaine!.rappel && maintenant - enchaine!.debut >= ENCHAINE_MS
  if (due) enchaine!.rappel = true
  await $.store.set('enchaine', { ...enchaine! }).catch(() => {})
  return due
}

// ---------------------------------------------- ses numéros sur toute la bande

/** Claude travaille, tel que la bande le montre (`isWorking`, noté à chaque dessin) */
let auTravail = false
/** La bande se dessine sur desktop (noté à chaque dessin) : ailleurs, la grande scène ne se voit pas */
let bureau = false
export const surBureau = () => bureau
/** Claude est en plein tour (tel que la bande le montre) */
export const enTour = () => auTravail
/** Sa bande a été dessinée au moins une fois dans ce module (la session est affichée quelque part) */
let dessine = false
export const aEteDessine = () => dessine
/** La largeur de la bande, en cases (noté à chaque dessin) : le cadre la montre */
let colonnes = 0
/** La largeur de la bande en px, si on la connaît : ses trajets se mesurent dessus (ses durées en dépendent) */
const largeurBande = () => (colonnes > 0 ? Math.round(colonnes * CELLULE) : undefined)
/** Son dernier numéro (ms) : ils restent rares, pour surprendre */
let dernierNumero = 0
/** Son dernier rappel (« il est temps de changer de conversation ») : au plus un toutes les 10 min */
let dernierRappel = 0
const RAPPEL_MS = 10 * 60_000
/** La dernière fois qu'il t'a montré le bouton Installer (un nouvel APK attend) : au plus une fois toutes les 30 min */
let dernierInstalle = 0
const INSTALLE_MS = 30 * 60_000
/** Au repos, un numéro au plus toutes les 6 min ; pendant que Claude travaille, toutes les 20 min */
const ECART_REPOS = 6 * 60_000
/** Pendant que Claude travaille, un intermède sur la bande toutes les 4 min environ : ses cartons restent l'essentiel */
const ECART_TRAVAIL = 4 * 60_000
/** Son dernier jeu de cartons (ms), et lequel : au moins 1 min 30 entre deux, jamais deux fois le même de suite */
let dernierJeuCartons = 0
let jeuCartonsAvant: ClawdAnim | null = null
const ECART_CARTONS = 90_000
/** Passé cet écart, sa chance d'en jouer un à chaque coup d'œil (toutes les 4 s) : une fois toutes les 2 à 3 min environ */
const JEU_CARTONS_P = 1 / 12
/** Le temps de déménagement (s) dans un tour avant son premier jeu de cartons */
const BOULOT_AVANT_JEU = 60

/** Ce qu'atelier dessine sur la bande (rien quand atelier n'est pas là) */
/** Ce qu'il voit de la bande, pour /clawd voit : la bande partagée d'atelier (null s'il n'en publie pas), sa largeur, ce qu'il tient */
/** Ses derniers dessins (le rendu qui repasse) : un dessin sans image refaite, pendant qu'on le voit repartir, c'est l'app qui a remonté la bande */
const notesDessins: { t: number; anim: string; refaite: string | null; surface: string }[] = []
export const derniersDessins = () => [...notesDessins]
/** Ce qui a changé entre deux clés de dessin (scène | couleur | minis | rapport | tenue) */
function pourquoiRefaite(avant: string, apres: string) {
  const noms = ['scène', 'couleur', 'minis', 'rapport', 'tenue', 'place', 'passage']
  const a = avant.split('|')
  const b = apres.split('|')
  return noms.filter((_, i) => a[i] !== b[i]).join(', ') || 'autre'
}
/** Deux clés de dessin de la même scène, au même endroit, qui ne diffèrent que par sa couleur ou sa tenue */
function memeScene(avant: string, apres: string) {
  const a = avant.split('|')
  const b = apres.split('|')
  return a.length === b.length && a.every((v, i) => i === 1 || i === 4 || v === b[i])
}

export async function vueBande($: EngineInterface) {
  return { scene: await read($, sceneAtelier), masque: (await read($, atelierMasque)) === true, largeur: largeurBande(), tenus: await read($, emprunts), numero: await read($, numero), bureau, dort: (await read($, dort)) === true }
}

async function elementsBande($: EngineInterface) {
  const s = await read($, sceneAtelier)
  return Array.isArray(s?.elements) ? s.elements : []
}

/**
 * Il joue un numéro sur toute la bande (bande.ts), si ce qu'il vise est là :
 * il prend l'original au moment voulu (atelier ne le dessine plus) et le rend
 * toujours. Vrai s'il le joue.
 */
export async function joueNumero($: EngineInterface, nom: string, vise?: string): Promise<boolean> {
  refus = null
  try {
    // la grande scène ne se voit que sur desktop ; jamais deux numéros à la fois
    if (!bureau || sondage) return non('bureau')
    if (await read($, numero)) return non('occupe')
    // une scène ou une activité qui se joue va au bout : le numéro la cacherait
    const avant = await $.clock.now()
    if ((enScene && avant < enScene.fin && !sansFin(enScene.ms)) || ((await read($, activite)) !== null && avant < finActivite)) return non('occupe')
    const elements = await elementsBande($)
    const largeur = largeurBande()
    // sa variante, tirée une fois (ses pas en dépendent, le dessin aussi), et ses minis du coin, qui le regardent
    const variante = Math.random()
    const coin = (await read($, copains)).slice(0, 3)
    const figurants = coin.map(c => teinteConnue(c.modele)?.O ?? null)
    // (l'id du sous-agent de chacun : il va à sa pastille, `agent-<id>`)
    const minis = coin.map(c => c.id)
    const partie = { variante, ...(vise ? { vise } : {}), ...(figurants.length ? { figurants, minis } : {}) }
    // il est en route d'une scène à l'autre : le numéro attendra qu'il soit arrivé
    if (enRetour(avant)) return non('occupe')
    // (de quoi le jouer d'ici, d'abord)
    if (!prepareNumero(nom, elements, largeur, departDe((lieuActuel(avant) ?? { x: 0 }).x), partie)) return non('rien')
    // son dessin, une fois pour toutes : atelier le pose par-dessus la bande, et le recale à chaque dessin sur son début
    const couleur = teinte((await read($, modele)) ?? (await $.session.model().catch(() => null)))
    const porte = await tenueSession($)
    const maintenant = await $.clock.now()
    // sans await d'ici à son lancement : il part de là où il est à cet instant (en plein déménagement, au milieu de sa
    // balade…), y revient, et son déménagement s'arrête pile là ; ce qui est posé autour de lui (ses cartons) l'attend dans
    // son coin
    // (ton geste, cliqué pendant ces await, est passé devant : le numéro lui laisse la place)
    if (enRetour(maintenant) || (enScene && maintenant < enScene.fin && !sansFin(enScene.ms))) return non('occupe')
    const ici = lieuActuel(maintenant) ?? { x: 0, decor: '' }
    const depart = departDe(ici.x)
    const prep = prepareNumero(nom, elements, largeur, depart, partie)
    if (!prep) return non('rien')
    const id = Math.random()
    // son dessin reste un peu après la fin, au repos : l'animation, partie en retard, finit sans être coupée
    const fin = maintenant + (prep.duree + RETENUE) * 1000
    const n = { id, nom, elements, debut: maintenant, fin, cibles: prep.cibles, ...(largeur ? { largeur } : {}), ...(depart ? { depart } : {}), ...partie }
    // sa tenue le suit sur la bande : son déguisement du jour (lunettes, cernes, chapeau), sa visière, sa sueur, son insigne
    const svg = svgNumero({ ...n, colonnes }, couleur, tenueDe({ ...porte, deguise: deguisementDu(maintenant) }))
    // trop lourd pour le moteur (les dessins d'atelier qu'il promène) : il ne le joue pas, et n'y repense pas avant le prochain
    dernierNumero = maintenant
    if (svg.length > MAX_SVG) return non('lourd')
    // revérifié sans await avant de le poser : une scène a pu démarrer pendant qu'il préparait son dessin
    if (numeroLance || (enScene && maintenant < enScene.fin && !sansFin(enScene.ms))) return non('occupe')
    // dès maintenant, toute nouvelle scène attendra la fin du numéro
    numeroLance = true
    numeroLanceA = maintenant
    reprise(null, maintenant)
    lieuNumero = ici
    await update($, numero, () => n)
    await update($, grandeScene, () => ({ id, svg, hauteur: HAUTEUR_BANDE, debut: maintenant, fin }))
    // chaque cible empruntée dès que son dessin est là (sa copie, au repos dessus, la remplace : un texte et sa copie
    // l'un sur l'autre s'épaississaient), et rendue avec la fin du dessin seulement : jamais l'original ne revient
    // sous une copie qui bouge encore
    for (const emprunt of prep.emprunts) $.clock.after(Math.min(MARGE, Math.max(0, emprunt.de - MARGE)) * 1000, () => void prend($, id, emprunt.id, fin).catch(() => {}))
    $.clock.after((prep.duree + RETENUE) * 1000, () => void finNumero($, id).catch(() => {}))
    return true
  } catch {
    return non('rien')
  }
}

/** Pourquoi son dernier numéro demandé ne s'est pas joué (null : il s'est joué) */
export type Refus = 'bureau' | 'occupe' | 'rien' | 'lourd'
let refus: Refus | null = null
const non = (r: Refus) => ((refus = r), false)
export const dernierRefus = () => refus

/** Son mot de la nuit, à lire : il le pose (une bulle au-dessus de lui), ou l'efface une fois lu */
export async function poseMot($: EngineInterface, m: { id: string; date: string; message: string } | null) {
  const avant = await read($, motNonLu)
  if ((avant?.id ?? null) !== (m?.id ?? null)) await update($, motNonLu, () => m)
}

/** Tu as lu son mot (sa bulle, ou /clawd) : il ne le reposera plus */
export async function motLu($: EngineInterface) {
  const m = await read($, motNonLu)
  if (!m) return null
  await $.store.set('mot-vu', m.id)
  await update($, motNonLu, () => null)
  return m
}

/** Il joue déjà un numéro */
export async function joueDeja($: EngineInterface) {
  return (await read($, numero)) !== null
}

/** Les numéros qu'il peut jouer maintenant avec ce qu'il y a sur la bande (pas ceux réservés à la demande, comme le cadre) */
export async function numerosPossibles($: EngineInterface): Promise<string[]> {
  const els = await elementsBande($)
  return Object.entries(NUMEROS)
    .filter(([nom, n]) => n.quand !== 'demande' && prepareNumero(nom, els, largeurBande()) !== null)
    .map(([nom]) => nom)
}

// ------------------------------------------------------------------ /clawd

/** La commande /clawd de base (son niveau, montre, voit) ; la version perso la remplace par la sienne, qui la reprend */
export const commandePublique = { active: true }

/** Une scène de Clawd existe-t-elle sous ce nom ? */
export const estScene = (anim: unknown): anim is ClawdAnim => typeof anim === 'string' && Object.hasOwn(EMOJI, anim)

/** Il joue une scène devant toi, à ta demande : sa durée naturelle (entre 4 et 15 s ; une chorégraphie, en entier) */
export async function joueDevantToi($: EngineInterface, anim: ClawdAnim) {
  // dans la file de ses scènes : il finit celle en cours avant, puis elle passe la première
  const s = dureeScene(anim) * 1000
  await scene($, anim, estChoregraphie(anim) ? Math.min(45_000, s) : Math.min(15_000, Math.max(4000, s)), true, 60_000)
}

/**
 * /clawd montre <numéro | bande> : un numéro sur toute la bande (« bande » : au
 * hasard parmi ceux qu'il peut jouer), ou pourquoi pas ; null quand ce n'en
 * est pas un.
 */
export async function montreNumero($: EngineInterface, quoi: string): Promise<string | null> {
  const nom = quoi.trim().toLowerCase()
  if ((nom === 'bande' || estNumero(nom)) && !surBureau()) return 'La grande scène ne se voit que dans l’app de bureau.'
  if (nom === 'bande') {
    // au hasard, parmi ce qu'il peut jouer avec ce qu'il y a sur la bande (le tour de la bande, au moins)
    if (await joueDeja($)) return 'Il joue déjà un numéro : attends qu’il ait fini.'
    const choix = await numerosPossibles($)
    const pris = choix.length ? choix[Math.floor(Math.random() * choix.length)]! : 'tournee'
    if (await joueNumero($, pris)) return `👀 Regarde-le : son numéro « ${pris} ».`
    if (dernierRefus() === 'occupe') return 'Il finit d’abord ce qu’il fait (une scène, une activité ou un numéro) : réessaie dans quelques secondes.'
    return 'Pas maintenant : il ne trouve rien à jouer sur la bande.'
  }
  if (!nom || !estNumero(nom)) return null
  if (await joueNumero($, nom)) return nom === 'cadre' ? '📐 Le cadre, pendant 20 s : fais une capture de la bande.' : `👀 Regarde-le : son numéro « ${nom} ».`
  // pourquoi pas : il joue déjà, son dessin serait trop lourd, ou ce qu'il lui faut n'est pas là (et quoi)
  const r = dernierRefus()
  if (r === 'occupe') return 'Il finit d’abord ce qu’il fait (une scène, une activité ou un numéro) : réessaie dans quelques secondes.'
  if (r === 'lourd') return `Pas maintenant : avec ce qu’il y a sur la bande, « ${nom} » serait trop lourd à dessiner.`
  if ((await vueBande($)).masque) return `Rien à viser pour « ${nom} » : le bandeau d’atelier est masqué. Tape /atelier pour le ré-afficher.`
  const besoin = NUMEROS[nom]?.besoin
  const autres = (await numerosPossibles($)).filter(x => x !== nom)
  return `Rien à viser pour « ${nom} » en ce moment${besoin ? ` : il lui faut ${besoin}` : ''}.${autres.length ? ` Jouables maintenant : ${autres.join(', ')}.` : ''}`
}

/** /clawd voit : ce qu'il voit de la bande, et ce qu'il peut y jouer (et pourquoi pas) : pour comprendre un numéro qui ne se joue pas */
export async function voit($: EngineInterface) {
  const v = await vueBande($)
  const els = Array.isArray(v.scene?.elements) ? v.scene.elements : []
  const lignes = [
    v.bureau ? '🖥️ App de bureau : la grande scène peut se voir.' : '⚠️ Pas sur l’app de bureau (ou pas encore dessiné) : pas de grande scène.',
    // (atelier masqué ou sans rien à montrer publie une bande vide : il est là, mais rien n'est à viser)
    v.masque
      ? '📐 Le bandeau d’atelier est masqué : tape /atelier pour le ré-afficher, et il aura de quoi jouer.'
      : v.scene && (v.scene.lignes ?? []).length
        ? `📐 Bande d’atelier (largeur ${v.largeur ?? `~${LARGEUR_BANDE}`} px, lignes ${(v.scene.lignes ?? []).join(' / ')}) :`
        : v.scene
          ? '📐 La bande d’atelier est vide : rien à montrer pour l’instant (pas de git, pas encore de quotas).'
          : '📐 Atelier ne publie pas de bande : il n’est pas chargé (Clawd pose alors ses numéros lui-même).',
    ...els.map(e => `  · ${e.id} (${e.etat}) ligne ${e.ligne}, x ${Math.round(e.x)}, ${Math.round(e.largeur)} px${e.dessin ? ', dessin' : ''}`),
    '🎪 Numéros :',
    ...Object.keys(NUMEROS).map(nom => `  · ${nom} : ${diagnostic(nom, els, v.largeur)}`),
    v.numero ? `▶️ En cours : ${v.numero.nom}` : '▶️ Aucun numéro en cours.',
    '🎞️ Ses derniers dessins (« image refaite » : elle repart ; sans, l’image ne change pas) :',
    ...derniersDessins().map(d => `  · ${new Date(d.t).toLocaleTimeString('fr-FR')} ${d.anim} (${d.surface})${d.refaite ? ` — image refaite : ${d.refaite}` : ''}`),
    v.tenus.length ? `✋ Il tient : ${v.tenus.map(x => x.id).join(', ')}` : '✋ Il ne tient rien.',
  ]
  return lignes.join('\n')
}

/** Son niveau, et ce qui fait monter son expérience */
export async function sonNiveau($: EngineInterface) {
  const nv = await read($, niveau)
  return `⭐ Niveau ${nv} · ${xp} XP · encore ${Math.max(0, seuilNiveau(nv + 1) - xp)} pour le niveau ${nv + 1} (un outil lancé : 1, une réussite : 5, un mini qui rend son travail : 3)`
}

/** /clawd de base : son niveau et son humeur ; montre <numéro | bande | scène> ; voit */
async function commandeDeBase($: EngineInterface, args: string) {
  if (/^montre/i.test(args)) {
    const quoi = args.replace(/^montre\s*/i, '').trim().toLowerCase()
    const numero = await montreNumero($, quoi)
    if (numero !== null) return numero
    if (estScene(quoi)) {
      await joueDevantToi($, quoi)
      return `👀 Regarde-le : ${quoi} ${EMOJI[quoi]}`.trimEnd()
    }
    return `Dis-lui quoi montrer : « bande », un numéro (${Object.keys(NUMEROS).join(', ')}) ou une scène (${Object.keys(EMOJI).join(', ')}).`
  }
  if (/^voi[st]/i.test(args)) return voit($)
  return [`${await sonNiveau($)}`, `🧠 En ce moment, ${decritHumeur(humeurActuelle(), (await read($, dort)) === true)}.`, '/clawd montre <numéro | bande | scène> · /clawd voit'].join('\n')
}

/** Il prend l'original, si son numéro est toujours en cours : jusqu'à la fin du numéro au plus (atelier le redessine ensuite, quoi qu'il arrive) */
async function prend($: EngineInterface, id: number, el: string, fin: number) {
  if ((await read($, numero))?.id !== id) return
  await update($, emprunts, l => [...l.filter(x => x.id !== el), { id: el, jusqua: fin + 2000, numero: id }])
}

/**
 * La bande a-t-elle changé sous le numéro au point qu'il n'a plus de sens ?
 * Atelier masqué, ou une de ses cibles qui n'est plus sur la bande (un plan
 * vidé, le bouton 🆕 qui n'est plus à montrer : une conversation neuve) : sa
 * copie resterait dessinée à une place vide. Sans atelier (null), il pose son
 * numéro lui-même : rien à comparer.
 */
async function bandePartie($: EngineInterface, n: { cibles?: readonly { id: string }[] }) {
  if (!n.cibles?.length) return false
  const s = await read($, sceneAtelier)
  if (s === null) return false
  if ((await read($, atelierMasque)) === true) return true
  const ids = new Set((Array.isArray(s.elements) ? s.elements : []).filter(e => !auRepos(e)).map(e => e.id))
  return n.cibles.some(c => !ids.has(c.id))
}

/** Le bouton 🆕 d'atelier au repos : toujours publié, il n'y a rien à montrer tant qu'il n'est pas `a-montrer` */
const auRepos = (e: ElementBande) => e.genre === 'bouton' && e.etat !== 'a-montrer'

/** Le numéro `id` (ou celui en cours) est fini ou interrompu : il rend tout et rentre dans son coin */
async function finNumero($: EngineInterface, id?: number) {
  const n = await read($, numero)
  if (!n || (id !== undefined && n.id !== id)) return
  await update($, numero, () => null)
  numeroLance = false
  if (await read($, grandeScene)) await update($, grandeScene, g => (g && g.id !== n.id ? g : null))
  if ((await read($, emprunts)).length) await update($, emprunts, l => l.filter(x => x.numero !== n.id))
  // ce qui attendait la fin du numéro
  await suivanteScene($)
}

/**
 * De temps en temps, un numéro de lui-même : au repos à la fin d'une
 * activité, pendant que Claude travaille au hasard, jamais deux de suite.
 * Vrai s'il en joue un.
 */
async function surprise($: EngineInterface, maintenant: number) {
  const moment = auTravail ? 'travail' : 'repos'
  // au repos, pas de numéro dans la minute qui suit un de tes signes (il ne se lance pas pile quand tu écris)
  if (moment === 'repos' && maintenant - derniereActivite < 60_000) return false
  // une activité qui se joue va au bout
  if (maintenant < finActivite) return false
  // continuer la conversation coûte trop (atelier dit son bouton 🆕 « à montrer ») : il vient te le montrer, au plus toutes les 10 min
  if (maintenant - dernierRappel >= RAPPEL_MS && (await elementsBande($)).some(e => e.genre === 'bouton' && e.id === 'nouvelle' && e.etat === 'a-montrer')) {
    if (await joueNumero($, 'rappel')) {
      dernierRappel = maintenant
      return true
    }
  }
  // un nouvel APK attend (atelier dit son bouton Installer « à montrer ») : il vient te le montrer, au plus toutes les 30 min
  if (maintenant - dernierInstalle >= INSTALLE_MS && (await elementsBande($)).some(e => e.genre === 'bouton' && e.id === 'installer' && e.etat === 'a-montrer')) {
    if (await joueNumero($, 'installe')) {
      dernierInstalle = maintenant
      return true
    }
  }
  // au repos, plus il s'ennuie, plus il vient jouer sur la bande
  if (maintenant - dernierNumero < (auTravail ? ECART_TRAVAIL : Math.min(ECART_REPOS, ecartRepos(humeur)))) return false
  if (moment === 'repos' ? maintenant < finActivite || Math.random() < 0.5 * (1 - humeur.ennui) : Math.random() > 0.05) return false
  // rien à animer (atelier masqué ou absent, ou seulement son bouton 🆕 au repos) : il ne se lance pas dans un numéro pour rien
  const els = await elementsBande($)
  const choix = els.some(e => !auRepos(e)) ? numerosJouables(moment, els, largeurBande()) : []
  return choix.length > 0 && joueNumero($, pondere(choix))
}

/** Un numéro tiré au sort, certains plus souvent que d'autres (`poids`) : le petit, qui joue avec les pastilles */
const pondere = (choix: readonly string[]) => pioche(choix.flatMap(nom => Array.from({ length: NUMEROS[nom]?.poids ?? 1 }, () => nom)))

/** Le dernier jeu de ses minis sur la bande (ms) : au plus un toutes les 3 min, pendant que leurs sous-agents travaillent */
let dernierJeuMinis = 0
const ECART_MINIS = 3 * 60_000

/**
 * Pendant que ses sous-agents travaillent, de temps en temps, ses minis
 * sortent jouer sur la bande (l'équipe, saute-mouton, la pyramide, la passe).
 * Vrai s'ils en jouent un.
 */
async function jeuDeMinis($: EngineInterface, maintenant: number) {
  if (maintenant - dernierJeuMinis < ECART_MINIS || maintenant < finActivite || Math.random() > 0.15) return false
  const choix = numerosAvecMinis(await elementsBande($), largeurBande(), (await read($, copains)).slice(0, 3).map(c => c.id))
  if (!choix.length) return false
  const joue = await joueNumero($, pondere(choix))
  // (trop lourd à dessiner : il n'y repense pas avant le prochain écart, au lieu de le refaire à chaque coup d'œil)
  if (joue || dernierRefus() === 'lourd') dernierJeuMinis = maintenant
  return joue
}

/** Ce qu'il a vu de la bande au dernier coup d'œil : l'état de chaque élément (null : pas encore regardé) */
let dejaVu: Map<string, string> | null = null
/** Sa réaction en attente (il la joue dès qu'il est libre, avant qu'elle ne soit plus de saison) */
let reaction: { nom: string; vise: string; jusqua: number } | null = null
/** Sa dernière réaction (ms) : au plus une toutes les 90 s, il ne court pas après chaque coche */
let derniereReaction = 0
const ECART_REACTION = 90_000
/** Combien de temps une réaction attend qu'il soit libre (ms) : le rapport d'un mini passe d'abord */
const ATTENTE_REACTION = 40_000

/**
 * Son coup d'œil sur la bande, à chaque tic (même en pleine activité) : ce
 * qui vient de changer, et ce qu'il y fera : un build raté (il va taper
 * dessus), un quota au rouge (il le retient), un sous-agent fini (il contrôle
 * son travail), une étape faite (il la félicite), dans cet ordre de priorité.
 */
async function remarque($: EngineInterface, maintenant: number) {
  const els = await elementsBande($)
  const avant = dejaVu
  dejaVu = new Map(els.map(el => [el.id, el.etat]))
  if (avant && !reaction && maintenant - derniereReaction >= ECART_REACTION) {
    const devient = (el: ElementBande, etat: string) => el.etat === etat && avant.get(el.id) !== undefined && avant.get(el.id) !== etat
    const vue = (
      [
        ['repare', els.find(el => el.genre === 'build' && devient(el, 'echec'))],
        ['retient', els.find(el => el.genre === 'jauge' && devient(el, 'critique'))],
        ['controle', els.find(el => el.genre === 'agent' && devient(el, 'faite'))],
        ['bravo', els.find(el => el.genre === 'tache' && devient(el, 'faite'))],
      ] as const
    ).find(([, el]) => el)
    if (vue) reaction = { nom: vue[0], vise: vue[1]!.id, jusqua: maintenant + ATTENTE_REACTION }
  }
}

/** Sa réaction en attente, jouée dès qu'il est libre (avant qu'elle ne soit plus de saison). Vrai s'il la joue. */
async function reagit($: EngineInterface, maintenant: number) {
  await remarque($, maintenant)
  if (!reaction) return false
  if (maintenant > reaction.jusqua) {
    reaction = null
    return false
  }
  if (!(await joueNumero($, reaction.nom, reaction.vise))) {
    // ce qu'il venait voir n'est plus là (ou plus comme ça) : il oublie ; occupé : il réessaiera
    if (dernierRefus() !== 'occupe') reaction = null
    return false
  }
  reaction = null
  derniereReaction = maintenant
  return true
}

/**
 * De temps en temps pendant ses cartons, il en fait autre chose : il en ouvre
 * un, en joue comme d'un tambour, monte dessus… (`JEUX_CARTONS`), là où il en
 * est de son déménagement, qui reprend ensuite. Seulement quand on voit son
 * déménagement, et après une bonne minute de déménagement dans le tour (un
 * tour court reste à ses cartons ; un jeu n'arrive pas pile quand une
 * commande commence). Vrai s'il en joue un.
 */
async function jeuDeCartons($: EngineInterface, maintenant: number) {
  // (pas en chemin vers ses cartons : joué sur place, il sauterait au bout de son trajet)
  if (boulotDepuis === null || enRetour(maintenant) || boulotEnCours(maintenant) < BOULOT_AVANT_JEU) return false
  if (maintenant - dernierJeuCartons < ECART_CARTONS || Math.random() >= JEU_CARTONS_P) return false
  const jeu = autreQue(JEUX_CARTONS, jeuCartonsAvant)
  // maintenant ou jamais : s'il devait attendre son tour (une action vient de commencer), il tomberait au lieu de se
  // jouer en retard, hors de propos (sa fraîcheur : 0)
  if ((await scene($, jeu, dureeScene(jeu) * 1000, false, 0)) === null) return false
  jeuCartonsAvant = jeu
  dernierJeuCartons = maintenant
  return true
}

// ------------------------------------------------- réactions aux commandes

const BUILD = /^(?:\S*gradlew\S*\s+.*\b(assemble|bundle|build)\w*|flutter\s+build|\S*release\.ps1|cargo\s+build|npm\s+run\s+build|go\s+build)/i
const TESTS = /^(?:\S*gradlew\S*\s+.*\btest\w*|flutter\s+test|pytest|npm\s+(run\s+)?test|\S+\s+plugin\s+test|cargo\s+test|go\s+test)/i
/**
 * Les morceaux d'une commande (`cd x && ./gradlew build | tail`), chacun sans
 * ses variables d'environnement ni son lanceur (`npx`, `uv run`, `python -m`,
 * `pwsh -File`…) : une commande ne compte que là où un morceau commence.
 */
function morceaux(cmd: string): string[] {
  return cmd.split(/&&|\|\||;|\||\r?\n/).map(m =>
    m
      .trim()
      .replace(/^(\w+=\S*\s+)+/, '')
      .replace(/^(npx|bunx|uv\s+run|poetry\s+run|py(thon3?)?\s+-m|(powershell|pwsh)(\.exe)?(\s+-(ExecutionPolicy|ep)\s+\S+|\s+-\w+)*|&)\s+/i, '')
      // un chemin entre guillemets (souvent avec des espaces, sous Windows) : son dernier nom suffit
      .replace(/^"([^"]*)"/, (_, c: string) => c.split(/[\\/]/).pop() ?? c),
  )
}
/** La commande lance-t-elle ce genre d'outil (au début d'un de ses morceaux) ? */
const lance = (re: RegExp, cmd: string) => morceaux(cmd).some(m => re.test(m))
/** Un `git push`, un `git commit` (avec ou sans `-C dossier`), une installation sur le téléphone : au début d'un morceau */
const PUSH = /^git(\s+-C\s+("[^"]*"|\S+))?\s+push\b/i
const PULL = /^git(\s+-C\s+("[^"]*"|\S+))?\s+pull\b/i
const COMMIT = /^git(\s+-C\s+("[^"]*"|\S+))?\s+commit\b/i
const INSTALL_TEL = /^\S*adb(\.exe)?\b.*\sinstall(-multiple)?\b/i
/** Une commande git qui fusionne (merge, rebase, pull, cherry-pick, revert, am, stash pop ou apply) : elle peut tomber sur un conflit */
const FUSION = /^git(\s+-C\s+("[^"]*"|\S+))?\s+(merge|rebase|pull|cherry-pick|revert|am|stash\s+(pop|apply))\b/i
/** Sa sortie annonce un conflit */
const SORTIE_CONFLIT = /^CONFLICT \(|Automatic merge failed|^error: could not apply [0-9a-f]{7,}/m
/** On en sort : un commit, ou la fusion qui continue, saute ou abandonne */
const SORTIE_DE_CONFLIT = /^git(\s+-C\s+("[^"]*"|\S+))?\s+(commit\b|(merge|rebase|cherry-pick|revert|am)\s+--(continue|abort|skip|quit)\b)/i
/** Un conflit oublié (résolu hors de Claude) ne le soulage plus au bout d'un moment */
const CONFLIT_OUBLIE_MS = 3 * 60 * 60_000
/** Depuis quand un conflit git attend d'être résolu, s'il y en a un */
let conflitDepuis: number | null = null
/** La sortie d'un build ou de tests qui dit qu'ils ont échoué, même quand le code de sortie ne le dit pas (`| tail`) */
const SORTIE_ECHEC = /BUILD FAILED|FAILURE: Build failed|\b[1-9]\d* (failed|failing)\b|\bTests? failed\b|Some tests failed|npm ERR!|error: could not compile/i
const DEPENDANCES =
  /^(?:(npm|pnpm|bun)\s+(install|i|ci|add)\b|yarn(\s+(install|add)\b|\s*$)|(flutter|dart)\s+pub\s+(get|add|upgrade)\b|pip3?\s+install\b|uv\s+(sync|add|pip\s+install)\b|poetry\s+(install|add)\b)/i
/** Les scènes des commandes qui durent : une demande de permission ne les remplace pas */
const LONGUES: readonly ClawdAnim[] = ['build', 'tests', 'deballe', 'push', 'tel']
/** Ses grands moments : une loupe ou un crayon ne les interrompt pas */
const EMOTIONS: readonly ClawdAnim[] = ['decourage', 'delivrance']

/** Builds et tests ratés d'affilée : une réussite remet le compteur à zéro. */
let echecsDaffilee = 0

/**
 * Un build ou des tests viennent de finir. Ça casse : triste la première
 * fois, inquiet la deuxième (il se gratte la tête), découragé à partir de la
 * troisième. Ça passe : la fête, et après une série d'échecs, la délivrance.
 */
function verdict($: EngineInterface, ok: boolean) {
  if (ok) {
    const serie = echecsDaffilee
    echecsDaffilee = 0
    return serie >= 2 ? scene($, 'delivrance', dureeScene('delivrance') * 1000) : scene($, 'fete', 6000)
  }
  echecsDaffilee++
  if (echecsDaffilee >= 3) return scene($, 'decourage', dureeScene('decourage') * 1000)
  return echecsDaffilee === 2 ? scene($, 'gratte', 5000) : scene($, 'triste', 7000)
}

/** Une petite réaction (loupe, crayon), sauf s'il vit un grand moment. */
async function petiteScene($: EngineInterface, anim: ClawdAnim, ms: number) {
  const p = await read($, passage)
  if (p && EMOTIONS.includes(p.anim)) return
  // au travail, il finit son activité : pas de loupe ni de crayon par-dessus
  if (auTravail && (await read($, activite)) !== null && (await $.clock.now()) < finActivite) return
  await scene($, anim, ms)
}

/** La scène qui dure tant qu'une commande dure, s'il y en a une : et la durée qu'elle lui donne */
function sceneDe(cmd: string): { anim: ClawdAnim; ms: number } | null {
  if (lance(BUILD, cmd)) return { anim: 'build', ms: LONG }
  if (lance(TESTS, cmd)) return { anim: 'tests', ms: LONG }
  if (lance(PUSH, cmd)) return { anim: 'push', ms: LONG }
  if (lance(INSTALL_TEL, cmd)) return { anim: 'tel', ms: LONG }
  if (lance(DEPENDANCES, cmd)) return { anim: 'deballe', ms: LONG }
  return null
}

async function avantShell($: EngineInterface, cmd: string) {
  const s = sceneDe(cmd)
  if (s) await scene($, s.anim, s.ms)
}

/** L'action qu'il attendait est faite (ou refusée) : il baisse la patte. */
/** Les actions qui attendent ta permission, une par demande (outil + commande ou fichier) */
const permissions: string[] = []
const clePermission = (outil: string, entree: unknown) => {
  const champs = (entree ?? {}) as { command?: unknown; file_path?: unknown; url?: unknown }
  return `${outil}|${String(champs.command ?? champs.file_path ?? champs.url ?? '')}`
}

/** Une action est finie : si c'était une de celles qui attendaient, elle ne l'attend plus ; la patte se baisse quand plus aucune n'attend */
async function finAttente($: EngineInterface, cle?: string) {
  if (cle !== undefined) {
    const i = permissions.indexOf(cle)
    if (i >= 0) permissions.splice(i, 1)
    // une autre action attend toujours ta réponse : la patte reste levée
    if (permissions.length) return
  } else permissions.length = 0
  await arrete($, a => a === 'attend')
}

/** Sa commande est finie (ou a planté) : sa scène s'arrête, et elle seule */
async function finDeCommande($: EngineInterface, cmd: string) {
  const s = sceneDe(cmd)
  if (s) await arrete($, a => a === s.anim)
}

async function apresShell($: EngineInterface, cmd: string, r: ToolCallResult) {
  // la commande est finie : sa scène (build, tests…) aussi, pas celle d'une autre commande ; elle reste affichée
  // jusqu'à ce que son verdict la remplace (sinon une image de ses cartons s'intercalait entre les deux)
  const s = sceneDe(cmd)
  const affichee = s ? await arrete($, a => a === s.anim, true) : null
  try {
    return await verdictDe($, cmd, r)
  } finally {
    await efface($, affichee)
  }
}

/** Ce qu'il dit d'une commande finie : l'alerte d'un refus, sa cachette d'un conflit, la fête ou la tristesse… */
async function verdictDe($: EngineInterface, cmd: string, r: ToolCallResult) {
  if (r.deny !== undefined) return scene($, 'alerte', 5000)
  // interrompue (Échap) : ce n'est ni une réussite ni un échec, pas de verdict
  if (r.isError === true && /interrupt|aborted/i.test(r.text ?? '')) return
  const ok = r.isError !== true
  // un conflit git : il se cache derrière un carton tant que ça dure (dans ce tour) ;
  // résolu (un commit, une fusion qui continue ou qu'on abandonne), il ressort soulagé
  const maintenant = await $.clock.now()
  if (conflitDepuis !== null && maintenant - conflitDepuis > CONFLIT_OUBLIE_MS) conflitDepuis = null
  if (lance(FUSION, cmd) && SORTIE_CONFLIT.test(r.text ?? '')) {
    conflitDepuis = maintenant
    return scene($, 'cache', LONG)
  }
  if (conflitDepuis !== null && ok && lance(SORTIE_DE_CONFLIT, cmd)) {
    conflitDepuis = null
    await arrete($, a => a === 'cache')
    return scene($, 'soulage', dureeScene('soulage') * 1000)
  }
  // passée dans un `| tail`, une commande ratée sort en 0 : sa sortie le dit
  if (lance(BUILD, cmd) || lance(TESTS, cmd)) return verdict($, ok && !SORTIE_ECHEC.test(r.text ?? ''))
  if (lance(PUSH, cmd)) return scene($, ok ? 'fete' : 'triste', ok ? 6000 : 7000)
  // un pull réussi (sans conflit : vu plus haut) : les nouveautés de GitHub sont là, une petite fête ; rien de neuf, rien
  if (lance(PULL, cmd)) {
    if (!ok) return scene($, 'triste', 6000)
    return /Already up.to.date|Déjà à jour/i.test(r.text ?? '') ? undefined : scene($, 'fete', 4000)
  }
  if (lance(INSTALL_TEL, cmd)) {
    return ok && /Success/.test(r.text ?? '') ? scene($, 'fete', 5000) : scene($, 'triste', 6000)
  }
  if (lance(COMMIT, cmd) && ok) {
    // à Halloween, chaque commit réussi lui fait lâcher un bonbon
    return deguisementDu(await $.clock.now()) === 'citrouille' ? scene($, 'bonbon', BONBON_S * 1000) : scene($, 'ecoute', 2500)
  }
  if (!ok) return scene($, 'surpris', 3000)
}

/** Le mini-Clawd du sous-agent `agentId` change d'occupation (sans redessin inutile). */
async function copainFait($: EngineInterface, agentId: string, fait: ClawdCopain['fait']) {
  const equipe = await read($, copains)
  if (!equipe.some(c => c.id === agentId && c.fait !== fait)) return
  await update($, copains, l => l.map(c => (c.id === agentId ? { ...c, fait } : c)))
}

async function shell($: EngineInterface, cmd: string, agentId: string | undefined, go: () => Promise<ToolCallResult>) {
  // un tour que tu n'as pas lancé, pendant qu'il dort : il ne se réveille pas, et ne mime rien
  if (!tourDeToi && (await read($, dort))) return go()
  if (tourDeToi) await reveil($)
  // une commande d'un sous-agent : c'est son mini-Clawd qui s'y colle
  if (agentId) {
    await copainFait($, agentId, lance(BUILD, cmd) || lance(TESTS, cmd) ? 'build' : 'marche')
    return go()
  }
  if (tourDeToi) travaille(derniereActivite)
  await avantShell($, cmd)
  let r: ToolCallResult
  try {
    r = await go()
  } catch (err) {
    // une commande qui plante ou qu'on interrompt : sa scène ne reste pas
    await finDeCommande($, cmd).catch(() => {})
    throw err
  }
  // lancée en arrière-plan (ou passée en arrière-plan) : elle tourne encore, pas de verdict ; sa scène s'arrête avec le tour
  const res = (r as { result?: { backgroundTaskId?: unknown } }).result
  if (res?.backgroundTaskId !== undefined) return r
  await apresShell($, cmd, r).catch(() => {})
  return r
}

/**
 * Ce que tu fais de ses scènes, pour qui veut l'écouter (un module qui
 * enveloppe celui-ci, comme une version perso qui en tient un journal) : une
 * caresse (♥) ou un zap (🎲), avec la scène qu'il jouait.
 */
export const gestes: { ecoute?: (geste: 'caresse' | 'zappe', anim: ClawdAnim) => void } = {}

/** Prévient qui écoute, sans jamais gêner le bouton. */
function geste(g: 'caresse' | 'zappe', anim: ClawdAnim) {
  try {
    gestes.ecoute?.(g, anim)
  } catch {
    // l'écoute est en option
  }
}

// ------------------------------------------------------------------ hooks

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const ran = await next(e)
    derniereActivite = await $.clock.now()
    // ses scènes repartent de zéro (les minuteurs de l'ancien module n'existent plus)
    await reinitialiseScenes($)
    // les échecs d'une session d'avant ne privent pas celle-ci de ses fêtes
    echecsDaffilee = 0
    dessinAffiche = null
    minisAffiches = null
    permissions.length = 0
    // (une équipe d'avant, un SubagentStop manqué : le minuteur d'une minute la range ; un rechargement ne la vide plus,
    // sinon les minis de sous-agents encore au travail disparaîtraient pour de bon)
    // un numéro laissé en plan par un rechargement : il rend tout, et le prochain attendra un peu
    numeroLance = false
    numeroLanceA = 0
    if (await read($, numero)) await update($, numero, () => null)
    if (await read($, grandeScene)) await update($, grandeScene, () => null)
    if ((await read($, emprunts)).length) await update($, emprunts, () => [])
    dernierNumero = derniereActivite
    // une nouvelle session (ou un rechargement) : son déménagement repartira du début de sa boucle
    boulotJoue = 0
    boulotDepuis = null
    boulotTour = -1
    boulotAttente = 0
    // (et ses jeux de cartons, ses sorties de minis, repartent sans souvenir : une horloge qui recule ne les bloque pas)
    dernierJeuCartons = 0
    jeuCartonsAvant = null
    derniereSortie = null
    coinVu = null
    // (de même ses réactions et les jeux de ses minis : la bande d'une autre session ne déclenche rien ici)
    dejaVu = null
    reaction = null
    derniereReaction = 0
    dernierJeuMinis = 0
    lieuNumero = null
    retourChez = null
    placeDuPassage = null
    modelesCopains.clear()
    await relitEnchaine($)
    // sa couleur suit le modèle qui tourne
    const m = await $.session.model().catch(() => null)
    if (m) await update($, modele, () => m)
    const total = await $.store.get('caresses')
    const visite = await $.store.get('visiteA').catch(() => undefined)
    derniereVisite = typeof visite === 'number' ? visite : 0
    await update($, caresses, () => (typeof total === 'number' ? total : 0))
    // son expérience, gardée d'une session à l'autre : son niveau et son insigne, sans refêter un niveau déjà atteint
    const points = await $.store.get('xp').catch(() => undefined)
    xp = typeof points === 'number' && points >= 0 ? points : 0
    xpANoter = 0
    niveauVu = niveauDe(xp)
    niveauAFeter = null
    if ((await read($, niveau)) !== niveauVu) await update($, niveau, () => niveauVu)
    // la première session de la journée, il sort du lit ; ensuite, il est en forme ;
    // et si tu étais parti longtemps, il te fait la fête (après son café, le matin)
    const retour = await retrouvailles($, derniereActivite)
    if (await premierDuJour($, derniereActivite)) await emerge($)
    else if (!retour) await scene($, 'coucou', 4000)
    if (retour) await scene($, retour, dureeScene(retour) * 1000)

    // son humeur, relue d'une session à l'autre
    const gardee = await $.store.get('humeur')
    if (estHumeur(gardee)) {
      // fermé un moment : il s'est reposé pendant ce temps (le matin, il est en forme)
      const quand = await $.store.get('humeurA')
      const absent = typeof quand === 'number' ? derniereActivite - quand : 0
      humeur = absent > 0 ? vit(gardee, absent, { dort: true, seul: false }) : gardee
    }
    humeurVecue = derniereActivite
    // une sieste en cours quand le mod a été rechargé : elle garde une fin (sinon il dormirait jusqu'à ton prochain message)
    if ((await read($, dort)) && !estNuit(new Date(derniereActivite).getHours()) && finSieste === null) {
      finSieste = derniereActivite + (3 + Math.random() * 3) * 60_000
    }

    // son sommeil : la nuit, quand tu n'es plus là, il dort jusqu'à ton retour ;
    // le jour, il ne s'endort qu'à plat (après une bonne vingtaine de minutes
    // à s'occuper sans toi) et pour une sieste, dont il se réveille tout seul
    $.clock.every(60_000, () => {
      void (async () => {
        const maintenant = await $.clock.now()
        await vitSonHumeur($, maintenant)
        await $.store.set('humeur', humeurActuelle()).catch(() => {})
        await $.store.set('humeurA', maintenant).catch(() => {})
        // ce qu'il a gagné, ajouté au total gardé
        await noteXp($).catch(() => {})
        // un mini-Clawd dont le sous-agent est fini (son SubagentStop manqué) s'en va
        const equipe = await read($, copains)
        if (equipe.length) {
          const agents = await $.agent.list().catch(() => null)
          if (agents) {
            const vivants = new Set(agents.filter(a => !['completed', 'failed', 'killed'].includes(a.status)).map(a => a.id))
            const partis = equipe.filter(c => {
              const age = maintenant - (c.depuis ?? 0)
              if (age > PLAFOND_MINI_MS) return true
              // un agent de workflow n'est jamais listé : il attend son SubagentStop
              return !c.workflow && !vivants.has(c.id) && age > 60_000
            })
            if (partis.length) await update($, copains, l => l.filter(c => !partis.some(p => p.id === c.id)))
          }
        }
        // la fenêtre de 5 h s'est remise à zéro : il n'est plus épuisé (sans attendre ta prochaine réponse)
        if (resetCinqH !== null && maintenant >= resetCinqH && (await read($, fatigue))) await update($, fatigue, () => false)
        const dodo = (await read($, dort)) === true
        if (!dodo) {
          // pas de sieste pendant que Claude travaille : ses cartons ne disparaissent pas en plein déménagement
          if (maintenant - derniereActivite <= SOMMEIL_MS || auTravail) return
          const nuit = estNuit(new Date(maintenant).getHours())
          if (!nuit && humeur.energie > 0) return
          // il finit d'abord ce qu'il fait, et n'en commence pas d'autre : il s'endort dès la fin
          // (sa balade, elle, s'interrompt : il s'allonge là où il est)
          if (((await read($, activite)) !== null && maintenant < finActivite) || (enScene && maintenant < enScene.fin) || (await read($, numero)) !== null) {
            sommeilEnAttente = { nuit }
            return
          }
          await sEndort($, maintenant, nuit)
          return
        }
        if (finSieste !== null && maintenant >= finSieste) {
          // sa sieste est finie : il émerge, en forme, et retourne à ses occupations ; la nuit, elle devient son
          // sommeil de nuit : il dort jusqu'à ton retour (pas de réveil, café compris, pour se rendormir une minute après)
          finSieste = null
          if (estNuit(new Date(maintenant).getHours())) return
          humeur = { ...humeur, energie: 1 }
          await update($, dort, () => false)
          await emerge($)
          await occupe($, null)
        }
      })().catch(() => {})
    })

    // au repos : sa balade, puis une activité au hasard, puis la balade… et
    // de temps en temps, un numéro sur toute la bande
    await occupe($, null)
    // toutes les 4 s : assez fin pour des scènes de plusieurs secondes, et moitié moins de travail (son humeur vit dans le minuteur d'une minute)
    $.clock.every(4000, () => {
      void (async () => {
        const maintenant = await $.clock.now()
        tic++
        // un niveau atteint quand on ne le voyait pas : il le fête maintenant qu'on le voit
        if (niveauAFeter !== null && dessine) await feteNiveau($)
        if (numeroLance) {
          const n = await read($, numero)
          if (n) {
            // un numéro resté sans fin (ses minuteurs perdus) : il rend tout ; la bande a changé sous lui (masquée,
            // une de ses cibles partie, un questionnaire par-dessus) : une copie de rien resterait à l'écran, il rend tout
            if (!(maintenant <= n.fin + 2000) || sondage || (await bandePartie($, n))) await finNumero($, n.id)
            return
          }
          // décidé mais pas encore écrit (joueNumero pose son numéro en ce moment) : on ne le croit pas fini
          // (une horloge qui a reculé ne le garde pas « en train de s'écrire » pour toujours)
          if (maintenant >= numeroLanceA && maintenant - numeroLanceA < 10_000) return
          numeroLance = false
        } else if (maintenant < finActivite && tic % 8 !== 0) {
          // une activité se joue, aucun numéro : rien à vérifier (le nettoyage de secours ne passe qu'une fois sur huit) ;
          // il garde quand même un œil sur la bande, pour y réagir après ; en balade (pas une activité), il y va tout de suite
          if ((await read($, activite)) === null && !(await read($, passage)) && !(await read($, dort))) await reagit($, maintenant)
          else await remarque($, maintenant)
          return
        }
        // plus de numéro, mais un emprunt ou un dessin resté là : il rend tout (une fois sur huit si rien ne l'a lancé)
        if (tic % 8 === 0 || (await read($, numero)) === null) {
          // (revérifié au moment d'écrire : un numéro qui vient de se poser garde ce qu'il a écrit)
          if ((await read($, emprunts)).length) await update($, emprunts, l => (numeroLance ? l : []))
          if (await read($, grandeScene)) await update($, grandeScene, g => (numeroLance ? g : null))
        }
        if (await read($, dort)) return
        // une scène passagère (il attend ta permission, une question…) : il note ce qui change, et y réagira après
        if (await read($, passage)) {
          await remarque($, maintenant)
          return
        }
        // ce qui vient de changer sur la bande d'abord : il y réagit
        if (await reagit($, maintenant)) return
        // ses minis là : ce sont eux qui sortent jouer, de temps en temps
        if ((await read($, copains)).length) {
          await jeuDeMinis($, maintenant)
          return
        }
        if (await surprise($, maintenant)) return
        if (maintenant < finActivite) return
        // au travail, ses cartons : l'activité finie, il n'en commence pas d'autre… mais de temps en temps, il fait
        // autre chose d'un carton
        if (auTravail) {
          if (await read($, activite)) await update($, activite, () => null)
          await jeuDeCartons($, maintenant)
          return
        }
        // il a sommeil : pas de nouvelle activité, il s'endort là
        if (sommeilEnAttente && !auTravail) return sEndort($, maintenant, sommeilEnAttente.nuit)
        await occupe($, (await read($, activite)) ? null : await activiteAuRepos($, maintenant))
      })().catch(() => {})
    })
    return ran
  })

  on('prompt.submit', async ($, e, next) => {
    // ton message fait de ce tour le tien (même glissé dans un tour lancé par une notification) ; un autre ne dit à qui
    // est le tour que s'il en lance un (pas glissé dans un des tiens)
    if (deToi(e)) tourDeToi = true
    else if (e.turnId === undefined) tourDeToi = false
    // une notification de tâche, une routine, une autre session : ce n'est pas toi qui parles (il ne se réveille pas, ta séance ne continue pas)
    if (!deToi(e)) return next(e)
    await reveil($)
    // tu lui parles : il finit ce qu'il fait (une action ne se coupe jamais), puis te répond
    const maintenant = await $.clock.now()
    await relitEnchaine($)
    travaille(maintenant)
    const heure = new Date(maintenant).getHours()
    // la session est restée ouverte toute la nuit : il se réveille avec toi ; tu étais parti longtemps : il te fait la fête
    const retour = await retrouvailles($, maintenant)
    if (await premierDuJour($, maintenant)) {
      await emerge($)
      if (retour) await scene($, retour, dureeScene(retour) * 1000)
    } else if (retour) {
      await scene($, retour, dureeScene(retour) * 1000)
    } else if (heure >= 1 && heure < 6 && !couchePropose) {
      couchePropose = true
      await scene($, 'nuit', 6000)
    } else {
      await scene($, 'ecoute', 1800)
    }
    return next(e)
  })

  on('tool.call', { tool: 'Bash' }, ($, e, next) => shell($, e.command, e.agentId, () => next(e)))
  on('tool.call', { tool: 'PowerShell' }, ($, e, next) => shell($, e.command, e.agentId, () => next(e)))

  on('tool.call', { tool: /^(Edit|Write|NotebookEdit)$/ }, async ($, e, next) => {
    if (!tourDeToi && (await read($, dort))) return next(e)
    if (tourDeToi) await reveil($)
    if (e.agentId) await copainFait($, e.agentId, 'ecrit')
    else {
      if (tourDeToi) travaille(derniereActivite)
      await petiteScene($, 'ecrit', 3500)
    }
    return next(e)
  })

  on('tool.call', { tool: /^(Read|Grep|Glob|WebSearch|WebFetch)$/ }, async ($, e, next) => {
    if (!tourDeToi && (await read($, dort))) return next(e)
    if (tourDeToi) await reveil($)
    if (e.agentId) await copainFait($, e.agentId, 'cherche')
    else {
      if (tourDeToi) travaille(derniereActivite)
      await petiteScene($, 'cherche', 2500)
    }
    return next(e)
  })

  // Un sous-agent démarre : un mini-Clawd arrive et se met au boulot
  on('classic.SubagentStart', async ($, e, next) => {
    await reveil($)
    const modele = modelesCopains.get(e.agent_id)
    const depuis = await $.clock.now()
    const deWorkflow = agentsWorkflow.has(e.agent_id) ? { workflow: true as const } : {}
    await update($, copains, l => [...l.filter(c => c.id !== e.agent_id), { id: e.agent_id, type: e.agent_type, fait: 'marche' as const, modele, depuis, ...deWorkflow }])
    return next(e)
  })

  // Un sous-agent démarre sur un modèle : son mini-Clawd en prendra la couleur.
  // Selon l'ordre des événements, le mini est déjà là ou pas encore.
  on('agent.spawn', async ($, e, next) => {
    const r = await next(e)
    if (r.deny === undefined && r.agentId && e.workflow) {
      agentsWorkflow.add(r.agentId)
      if (agentsWorkflow.size > 200) agentsWorkflow.delete(agentsWorkflow.values().next().value!)
      const id = r.agentId
      if ((await read($, copains)).some(c => c.id === id && !c.workflow)) await update($, copains, l => l.map(c => (c.id === id ? { ...c, workflow: true as const } : c)))
    }
    if (r.deny === undefined && r.agentId && r.model) {
      const { agentId, model } = r
      modelesCopains.set(agentId, model)
      // des agents sans SubagentStop (workflows, agents tués) : on ne garde que les derniers
      if (modelesCopains.size > 50) modelesCopains.delete(modelesCopains.keys().next().value!)
      if ((await read($, copains)).some(c => c.id === agentId)) {
        await update($, copains, l => l.map(c => (c.id === agentId ? { ...c, modele: model } : c)))
      }
    }
    return r
  })

  // Il a fini : son mini-Clawd vient rendre son travail au chef (ce qu'il
  // faisait en dernier dit quoi : la loupe, la feuille, le marteau, le carton),
  // reçoit une tape sur la tête et s'en va, chaque fois d'une autre façon
  // (en trottinant, d'un plongeon dans le vide, pouf, en fusée, en tourbillon)
  on('classic.SubagentStop', async ($, e, next) => {
    const ran = await next(e)
    modelesCopains.delete(e.agent_id)
    const c = (await read($, copains)).find(c => c.id === e.agent_id)
    if (c) {
      await update($, copains, l => l.filter(c => c.id !== e.agent_id))
      rapportSuivant = { fait: c.fait, couleur: teinteConnue(c.modele) }
      // deux minis qui rendent leur travail à la fois : le second attend que le premier ait fini
      await scene($, 'rapport', RAPPORT_S * 1000, false, FRAICHE_IMPORTANT_MS)
    }
    return ran
  })

  on('turn.complete', async ($, e, next) => {
    const ran = await next(e)
    if (e.agentId !== undefined) return ran
    // au prochain tour, son déménagement repart du début de sa boucle
    toursFinis++
    // un tour que tu n'as pas lancé (une notification de tâche, une routine) : ce n'est pas ta séance
    const deToiCeTour = tourDeToi
    if (deToiCeTour) derniereActivite = await $.clock.now()
    // un tour fini (même interrompu) : rien de ce qu'il montrait ne tourne plus (commande, question, permission, compactage,
    // sa cachette) ; affiché jusqu'à ce que ce qu'il dit du tour le remplace d'un coup
    permissions.length = 0
    const affichee = await arrete($, a => [...LONGUES, 'tasse', 'attend', 'question', 'cache'].includes(a), true)
    try {
      // (et pendant qu'il dort, il ne se réveille pas pour lui)
      if (!deToiCeTour && (await read($, dort))) return ran
      // ce qu'il montre encore, sans ce qui vient de s'arrêter
      const affiche = await read($, passage)
      const p = affiche && affiche.id !== affichee ? affiche : null
      // deux heures que tu enchaînes : il t'apporte un verre d'eau (pas en pleine fête ni en plein grand moment)
      const calme = !e.isAborted && e.reason !== 'error' && !(p && [...EMOTIONS, ...LONGUES, 'fete'].includes(p.anim))
      if (deToiCeTour && (await pauseDue($, derniereActivite, calme))) await scene($, 'pause', dureeScene('pause') * 1000)
      else if (e.isAborted) await scene($, 'surpris', 4000)
      // déjà dit par le verdict d'une commande (en cours ou en file) : il ne le redit pas
      else if (e.reason === 'error') {
        if (!dejaDit('triste', p)) await scene($, 'triste', 6000)
      } else if (e.reason === 'refusal') await scene($, 'surpris', 3000)
      else if (e.durationMs > LONG_TOUR_MS) {
        // pas de fête sur un échec qui vient d'être dit (tests rouges, découragement), ni par-dessus une autre
        if (echecsDaffilee === 0 && !(['fete', 'delivrance', 'triste', 'gratte', 'decourage'] as ClawdAnim[]).some(a => dejaDit(a, p))) await scene($, 'fete', 6000)
      }
      else {
        // ne pas écraser une fête de build/push qui vient d'arriver
        // (le lundi matin, il lui arrive de bâiller au lieu de sauter)
        if (!p || ['cherche', 'ecrit', 'attend', 'question'].includes(p.anim))
          await (deguisementDu(derniereActivite) === 'cernes' && Math.random() < ENVIE_P ? scene($, 'baille', BAILLE_S * 1000) : scene($, 'ecoute', 2500))
      }
      return ran
    } finally {
      await efface($, affichee)
    }
  })

  // La conversation se compacte : il saute sur la pile de feuilles pour la
  // tasser tant que ça dure, puis montre le petit paquet qu'il en a fait
  on('session.compact', async ($, e, next) => {
    // ni les calculs faits d'avance, ni les compactages des sous-agents
    if (e.trigger === 'precompute' || e.agentId !== undefined) return next(e)
    // un compactage d'un tour que tu n'as pas lancé, pendant qu'il dort : il ne se réveille pas
    if (!tourDeToi && (await read($, dort))) return next(e)
    await reveil($)
    await scene($, 'tasse', LONG)
    try {
      const r = await next(e)
      // le compactage est fini, réussi ou non : la pile ne se tasse plus
      await arrete($, a => a === 'tasse')
      if (r.skip === undefined) {
        // le contexte est redescendu : il pourra de nouveau avoir le vertige
        vertigeMontre = false
        await scene($, 'paquet', 6000)
      }
      return r
    } catch (err) {
      await arrete($, a => a === 'tasse')
      await scene($, 'triste', 6000)
      throw err
    }
  })

  // Une action se termine (autorisée ou refusée) : il n'attend plus ta réponse ; chaque outil lancé ensemble (le sien
  // ou celui d'un sous-agent) lui rapporte un point d'expérience
  on('tool.call', async ($, e, next) => {
    try {
      return await next(e)
    } finally {
      // un outil d'un sous-agent qui finit ne baisse pas la patte : la permission du tour principal attend toujours
      if (e.agentId === undefined) await finAttente($, clePermission(e.tool, e)).catch(() => {})
      await gagne($, XP_OUTIL).catch(() => {})
    }
  })

  // Claude attend ta permission : il se tourne vers toi, lève la patte et tape
  // du pied. Une commande qui dure (build, tests…) garde sa scène : le mod ne
  // sait pas quand tu réponds, il resterait la patte levée pendant tout le build.
  // Il ne décide rien : la demande passe telle quelle, en dernier (l'annuaire le
  // vérifie). Si une règle la tranche, sa patte retombe quand l'action est faite.
  on('classic.PermissionRequest', async ($, e, next) => {
    // la demande d'un sous-agent : son mini-Clawd la porte, pas lui (et rien ne baisserait sa patte)
    if (e.agent_id === undefined) {
      permissions.push(clePermission(e.tool_name, e.tool_input))
      try {
        await reveil($)
        const p = await read($, passage)
        if (!p || !LONGUES.includes(p.anim)) await scene($, 'attend', LONG)
      } catch {
        // (sa patte n'empêche jamais la demande d'arriver jusqu'à toi)
      }
    }
    return next(e)
  })

  // Claude te pose une question : il brandit sa pancarte « ? » jusqu'à ta réponse
  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    await reveil($)
    await scene($, 'question', LONG)
    try {
      return await next(e)
    } finally {
      await arrete($, a => a === 'question').catch(() => {})
    }
  })

  // Le modèle change : sa couleur avec
  on('classic.PostModelSwitch', async ($, e, next) => {
    const ran = await next(e)
    await update($, modele, () => e.to_model)
    return ran
  })

  // Claude agit sans te demander (mode auto ou bypass) : il met sa visière de pilote automatique. Chaque événement du
  // tour principal dit le mode du moment : l'ouverture de la session, ton message, chaque outil fini
  on('classic.SessionStart', async ($, e, next) => {
    const r = await next(e)
    await notePilote($, e).catch(() => {})
    return r
  })
  on('classic.UserPromptSubmit', async ($, e, next) => {
    const r = await next(e)
    await notePilote($, e).catch(() => {})
    return r
  })
  on('classic.PostToolUse', async ($, e, next) => {
    const r = await next(e)
    await notePilote($, e).catch(() => {})
    return r
  })

  // /clear ou une reprise : le même module continue sur une autre conversation (sans session.start) ;
  // les builds ratés de l'autre ne privent pas celle-ci de ses fêtes ; son contexte repart de zéro (plus de sueur) ;
  // ce qu'il a gagné est noté
  on('session.end', async ($, e, next) => {
    echecsDaffilee = 0
    if (await read($, transpire)) await update($, transpire, () => 0)
    await noteXp($).catch(() => {})
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    const w = e.rateLimits.find(w => w.kind === 'five_hour')
    const r = w?.resetsAt ? Date.parse(w.resetsAt) : NaN
    resetCinqH = Number.isNaN(r) ? null : r
    const épuisé = (w?.percentUsed ?? 0) >= 90 && !(resetCinqH !== null && resetCinqH <= (await $.clock.now()))
    if (épuisé !== (await read($, fatigue))) await update($, fatigue, () => épuisé)
    // redescendu sous 70 % (un /clear, une reprise, un compactage) : le prochain trop-plein le refera tituber
    if (e.context.percent !== undefined && e.context.percent < 70) vertigeMontre = false
    // le contexte se remplit : il transpire (une goutte à la moitié, deux et les joues rouges passé 70 %)
    if (e.context.percent !== undefined) {
      const s = sueurDe(e.context.percent)
      if ((await read($, transpire)) !== s) await update($, transpire, () => s)
    }
    if ((e.context.percent ?? 0) >= 85 && !vertigeMontre) {
      vertigeMontre = true
      // un avertissement : il attend son tour jusqu'à une minute plutôt que de tomber (il ne revient qu'après un compactage)
      await scene($, 'vertige', 6000, false, FRAICHE_IMPORTANT_MS)
    }
    return next(e)
  })

  // /clawd : son niveau et son humeur, montre (un numéro, une scène), voit ; la version perso a la sienne (perso.tsx)
  if (commandePublique.active) {
    on('session.start', { cwd: /^/ }, async ($, e, next) => {
      await $.command
        .register({ name: 'clawd', description: 'Clawd : son niveau, ou montre <numéro | bande | scène> · voit', argumentHint: '[montre <numéro | bande | scène> | voit]' })
        .catch(() => {})
      return next(e)
    })
    on('command.run', { command: 'clawd' }, async ($, e) => ({ text: await commandeDeBase($, e.args.trim()) }))
  }

  // ------------------------------------------------------------ dessin

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    dessine = true
    sondage = e.props.hasSurvey === true
    if (e.props.hasSurvey) {
      // son dessin n'est plus affiché : le prochain repart d'où en est le déménagement
      dessinAffiche = null
      minisAffiches = null
      return next(e)
    }
    // Claude au travail : ses numéros s'y font plus rares ; hors desktop, pas de grande scène
    auTravail = e.props.isWorking === true
    bureau = e.surface === 'desktop'
    colonnes = e.props.bodyColumns
    const dessous = await next(e)
    const p = await read($, passage)
    const a = await read($, activite)
    const endormi = await read($, dort)
    const épuisé = await read($, fatigue)
    const equipe = await read($, copains)

    // ce qu'il fait en fond ; des sous-agents tournent : il dirige le chantier
    // (et ne s'endort pas)
    // une activité commencée va au bout, même si Claude se met au travail : ses cartons ensuite
    const enActivite = a !== null && (await $.clock.now()) < finActivite
    const fond: ClawdAnim =
      // (une activité commencée passe même avant l'arrivée de son équipe ; une activité finie ne se rejoue jamais : il se balade)
      enActivite ? a.anim : equipe.length >= SIFFLE_DES ? 'sifflet' : equipe.length > 0 ? 'chef' : endormi ? 'dodo' : e.props.isWorking ? 'boulot' : épuisé ? 'fatigue' : 'balade'
    // au travail, une petite réaction s'affiche en bulle au-dessus de sa tête :
    // il continue sa scène au lieu de s'interrompre (les grosses gardent la leur)
    const bulle: Bulle | null =
      p && (fond === 'boulot' || fond === 'chef' || fond === 'sifflet') && (EN_BULLE as readonly ClawdAnim[]).includes(p.anim) ? (p.anim as Bulle) : null
    const anim: ClawdAnim = bulle ? fond : (p?.anim ?? fond)
    const couleur = teinte((await read($, modele)) ?? (await $.session.model().catch(() => null)))
    // chaque mini dans la teinte du modèle de son sous-agent
    const minis = equipe.map(c => ({ fait: c.fait, couleur: teinteConnue(c.modele) }))
    const maintenant = await $.clock.now()
    const deguise = deguisementDu(maintenant)
    // sa tenue : son déguisement du jour, sa visière, sa sueur, son insigne ; ses minis n'ont que le déguisement et la visière
    const porte = await tenueSession($)
    const tenue = tenueDe({ ...porte, deguise })
    const tenueMinis = tenueDe({ deguise, visiere: porte.visiere })
    const nv = await read($, niveau)
    // un numéro sur toute la bande : son coin reste vide pendant ce temps (n'y restent que ses cartons quand il l'a lancé
    // en plein déménagement : il revient les reprendre là où il les a laissés)
    const n = await read($, numero)
    const enNumero = n !== null && maintenant < n.fin && e.surface === 'desktop'
    // son déménagement n'avance que quand on le voit : une scène ou un numéro qui l'interrompt le met en pause ; un
    // nouveau tour le fait repartir du début de sa boucle (où il en était juste avant : `faitAvant`)
    const faitAvant = boulotEnCours(maintenant)
    const tourAvant = boulotTour
    reprise(enNumero || numeroLance ? null : anim, maintenant)
    const repart = anim === 'boulot' && boulotTour !== tourAvant
    // une scène qui interrompt son déménagement se joue là où il en était, au milieu de ses cartons (il ne saute plus à
    // son coin, puis de nouveau au milieu en reprenant) ; commencée là, elle y reste jusqu'au bout
    const passee = p !== null && anim === p.anim && anim !== 'boulot'
    const enPlace = enNumero || !passee
      ? null
      : placeDuPassage?.id === p.id
        ? placeDuPassage.place
        : fond === 'boulot' && !estChoregraphie(anim)
          ? boulotEnPlace(maintenant)
          : null
    if (!enNumero) placeDuPassage = passee && enPlace ? { id: p.id, place: enPlace } : null
    // ses minis ont leur propre dessin (hors chorégraphie et rapport) : un sous-agent qui change d'outil ne recrée pas le sien
    const aPart = minisAPart(anim)
    if (anim === 'rapport' && p) {
      if (minisDuRapport?.id !== p.id) minisDuRapport = { id: p.id, minis }
    } else minisDuRapport = null
    const minisDedans = aPart ? [] : (minisDuRapport?.minis ?? minis)
    // quand il se déplace (ses cartons), pas de bulle : dessinée dans son image, elle la refaisait à chaque outil (à
    // son arrivée puis à son départ), et l'app redémarre une image neuve en retard : il s'arrêtait et sautait d'un côté à
    // l'autre ; dessinée à part, elle ne le suivrait pas. Sa scène suffit à dire qu'il travaille
    const bulleVisible = bulle !== null && !bulleDedans(anim)
    // (une scène qui recommence, la même deux fois de suite, repart de son début : son passage fait partie de la clé)
    const cle = `${anim}|${couleur.O}|${JSON.stringify(minisDedans)}|${anim === 'rapport' ? JSON.stringify(rapportEnCours) : ''}|${tenue ? JSON.stringify(tenue) : ''}|${enPlace ? enPlace.x : ''}|${passee ? p.id : ''}`
    // le mouchard des dessins (pour /clawd voit) : quand, quelle scène, et pourquoi son image a été refaite
    const avant = dessinAffiche?.cle
    notesDessins.push({ t: maintenant, anim, refaite: !enNumero && avant !== cle ? (avant === undefined ? 'premier dessin' : pourquoiRefaite(avant, cle)) : null, surface: e.surface })
    if (notesDessins.length > 20) notesDessins.shift()
    if (enNumero) dessinAffiche = null
    // seule sa tenue (visière, sueur, insigne) ou sa couleur a changé : la même scène, redessinée là où elle en est (elle
    // ne repart pas du début, il ne rentre pas chez lui)
    else if (avant !== cle && dessinAffiche && memeScene(avant!, cle)) dessinAffiche = { ...dessinAffiche, cle }
    else if (avant !== cle) {
      // jamais il ne saute d'une scène à l'autre : de là où il est (où la scène coupée l'a laissé, ou son numéro, qu'il a
      // fini là où il l'avait commencé), il marche jusqu'au départ de la suivante pendant que ce qu'il laisse s'efface
      const ici = lieuNumero ?? lieuActuel(maintenant, faitAvant)
      lieuNumero = null
      // (sur place, ou son déménagement qui reprend : ses cartons restent)
      const garde = enPlace !== null || (anim === 'boulot' && !repart)
      const vers = enPlace ? enPlace.x : anim === 'boulot' ? etatBoulot(boulotEnCours(maintenant)).x : etatScene(anim, 0).x
      let rentre: EnPlace | undefined
      if (!enPlace && ici && (Math.abs(ici.x - vers) > 0.5 || (ici.decor !== '' && !garde))) {
        // (déjà en route vers là : il continue)
        if (!(retourChez && enRetour(maintenant) && Math.abs(retourChez.vers - vers) < 0.5)) retourChez = { etat: { x: ici.x, decor: garde ? '' : ici.decor }, vers, debut: maintenant }
        rentre = { ...retourChez!.etat, rentre: true, vers, avance: +((maintenant - retourChez!.debut) / 1000).toFixed(2) }
      }
      const reste = rentre ? Math.max(0, dureeTrajet(retourChez!) - rentre.avance!) : 0
      // son déménagement ne compte qu'une fois qu'il y est (à la fin du trajet, même repris en route : sa clé a changé)
      if (anim === 'boulot' && reste > 0) boulotAttente = Math.max(0, maintenant - (boulotDepuis ?? maintenant)) + reste * 1000
      // son déménagement laissé là (la fin du tour, son équipe qui arrive) : le prochain repartira du début de sa boucle
      if ((coinVu?.anim === 'boulot' || coinVu?.enPlace) && anim !== 'boulot' && !enPlace) boulotTour = -1
      dessinAffiche = { cle, depuis: maintenant, ...(rentre ? { rentre } : {}) }
      coinVu = { anim, depuis: maintenant, decale: reste, enPlace, passage: passee }
    }
    const rentre = dessinAffiche?.rentre ?? null
    // où en est sa scène (s), recalé à chaque rendu : l'app recrée son image quand la bande change, et une image neuve
    // repartait du début (ou d'un instant figé : il ne faisait plus que regarder ses cartons tomber). Son déménagement a
    // son propre compte (il le reprend là où il l'a laissé) ; les autres scènes comptent depuis qu'elles se jouent
    // (précédée de son trajet, sa scène suit l'horloge de son image : la sienne part à son arrivée)
    const deja = anim === 'boulot' && !rentre ? boulotEnCours(maintenant) : dessinAffiche ? (maintenant - dessinAffiche.depuis) / 1000 : 0
    // le dessin de ses minis : refait seulement quand eux ou sa scène changent, recalé sur la même horloge (celle de sa
    // scène, qui attend la fin de son retour chez lui)
    const dejaMinis = rentre ? Math.max(0, deja - (dureeRetour(rentre.x, rentre.vers) - (rentre.avance ?? 0))) : deja
    const cleMinis = `${cle}|${JSON.stringify(minis)}`
    if (enNumero || !aPart || !minis.length) minisAffiches = null
    else if (minisAffiches?.cle !== cleMinis) minisAffiches = { cle: cleMinis, source: svgMinis(anim, minis, couleur, 0, tenueMinis) }
    // son dessin : atelier le pose par-dessus toute la bande ; quand atelier ne dessine rien, c'est à lui
    const gs = enNumero ? await read($, grandeScene) : null
    const atelierPose = enNumero && (await read($, sceneAtelier)) !== null
    // pendant son numéro, ce qui était posé autour de lui (ses cartons) l'attend dans son coin, à sa place
    const coin = enNumero && lieuNumero?.decor ? svgDecor(lieuNumero.decor) : COIN_VIDE
    // la bulle part d'où en est sa scène quand elle apparaît (son dessin ne change plus ensuite : elle ne ressurgit pas)
    if (!bulle || !p) bulleVue = null
    else if (bulleVue?.id !== p.id) bulleVue = { id: p.id, deja }

    const caresser = async () => {
      geste('caresse', anim)
      const n = (await update($, caresses, c => c + 1)) ?? 0
      await $.store.set('caresses', n)
      await reveil($)
      humeur = vecu(humeur, 'caresse')
      // ta caresse passe tout de suite : il arrête ce qu'il fait (même un cœur d'avant)
      await joueGeste($, 'coeur', 3000)
    }
    // ton bouton 🕺 : il danse tout de suite, comme le ♥ ; une autre danse à chaque clic, sans attendre la fin de la première
    const danse = async () => {
      await reveil($)
      const choix = DANSES.filter(d => d !== derniereDanse && d !== derniereScene && d !== a?.anim)
      const d = pioche(choix)
      derniereDanse = d
      derniereScene = d
      humeur = vecu(humeur, 'reussite')
      await joueGeste($, d, Math.min(10_000, dureeScene(d) * 1000))
    }
    const occupeToi = async () => {
      geste('zappe', anim)
      await finNumero($)
      await reveil($)
      await coupeScenes($)
      const prochaine = tirage(await $.clock.now())
      // un état de fond a repris (un build, une question) : l'activité passe quand même tout de suite, devant lui, le temps
      // d'une danse au plus (cachée dessous, tu n'aurais rien vu) ; il reprend après, puisqu'il t'informe
      if (enScene && sansFin(enScene.ms)) {
        await joueGeste($, prochaine.anim, Math.min(10_000, dureeScene(prochaine.anim) * 1000))
        return
      }
      await occupe($, prochaine)
    }

    // Ce que les autres dessinent (le bandeau d'atelier…) prend toute la
    // largeur ; Clawd se tient à droite, posé sur le bord du bas.
    const { Box, Button } = $.ui.resolve(e)
    // son mot de la nuit, pas encore lu : une bulle au-dessus de lui ; un clic le montre
    const mot = await read($, motNonLu)
    const lireMot = async () => {
      const m = await motLu($)
      if (m) $.ui.toast(`💬 Clawd : « ${m.message} »`, { timeoutMs: 20_000 })
    }
    const bulleMot = mot && (
      <Box key="mot" position="absolute" top={0} right={0}>
        <Button key="lire-mot" label="💬" plain onPress={lireMot} />
      </Box>
    )
    // son niveau, au survol : où il en est de son expérience, et ce qui la fait monter
    const montreNiveau = () => {
      try {
        $.ui.toast(`⭐ Niveau ${nv} · ${xp} XP · encore ${Math.max(0, seuilNiveau(nv + 1) - xp)} pour le niveau ${nv + 1} (un outil lancé : 1, une réussite : 5, un mini qui rend son travail : 3)`, { timeoutMs: 8000 })
      } catch {
        // pas de toast ici : le chiffre de son bouton suffit
      }
    }
    const boutons = (
      <Box position="absolute" top={0} left={0} display="none" hover={{ display: 'flex' }} flexDirection="row">
        <Button key="caresse" label="♥" plain onPress={caresser} />
        <Button key="occupe" label="🎲" plain onPress={occupeToi} />
        <Button key="danse" label="🕺" plain onPress={danse} />
        <Button key="niveau" label={`⭐${nv}`} plain onPress={montreNiveau} />
      </Box>
    )

    if (e.surface === 'desktop') {
      const { Svg } = $.ui.resolve(e)
      return (
        <Box flexDirection="row" alignItems="flex-end">
          <Box flexDirection="column" flexGrow={1}>
            {dessous}
          </Box>
          <Box key="clawd" flexShrink={0}>
            <Svg
              source={enNumero ? coin : svgScene(anim, minisDedans, deja, couleur, anim === 'rapport' ? (rapportEnCours ?? undefined) : undefined, undefined, tenue, enPlace ?? rentre ?? undefined)}
              alt={`Clawd : ${anim}${equipe.length ? ` (+${equipe.length} copains)` : ''}`}
              width={TAILLE.largeur}
              height={TAILLE.hauteur}
            />
            {minisAffiches?.source && (
              // ses mini-Clawds, posés à côté de lui dans leur propre dessin
              <Box key="minis" position="absolute" top={0} left={0}>
                <Svg source={avecT0(minisAffiches.source, dejaMinis)} alt={`Ses ${minis.length} mini-Clawds`} width={TAILLE.largeur} height={TAILLE.hauteur} />
              </Box>
            )}
            {!enNumero && bulle && bulleVue && bulleVisible && (
              // posée sur sa scène, dans son propre dessin : la scène ne redémarre pas
              <Box key="bulle" position="absolute" top={0} left={0}>
                <Svg
                  source={svgBulle(anim, bulle, bulleVue.deja)}
                  alt={`Bulle : ${bulle}`}
                  width={TAILLE.largeur}
                  height={TAILLE.hauteur}
                />
              </Box>
            )}
            {boutons}
            {bulleMot}
          </Box>
          {gs && !atelierPose && (
            // sans atelier, sa rangée est la nôtre : il pose son numéro lui-même, par-dessus toute la bande,
            // à sa largeur en px (la bande ne se mesure qu'en cases : une de plus, l'app compte les cases entières ;
            // plus large que la bande, l'image y est ramenée, sans être étirée)
            <Box key="grande-scene" position="absolute" left={0} right={0} bottom={0}>
              <Svg source={avecT0(gs.svg, (maintenant - (typeof gs.debut === 'number' ? gs.debut : maintenant)) / 1000)} alt={`Clawd : ${n?.nom ?? 'numéro'}`} width={Math.round((e.props.bodyColumns + 1) * CELLULE)} height={gs.hauteur} />
            </Box>
          )}
        </Box>
      )
    }

    const { Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" alignItems="flex-end">
        <Box flexDirection="column" flexGrow={1}>
          {dessous}
        </Box>
        <Box key="clawd" flexShrink={0} flexDirection="row" alignItems="center">
          {minis.slice(0, 5).map((m, i) => (
            <Text key={`mini-${i}`} color={(m.couleur ?? couleur).O}>
              {i === Math.min(minis.length, 5) - 1 ? '▪ ' : '▪'}
            </Text>
          ))}
          {EMOJI[bulle ?? anim] !== '' && <Text dimColor>{`${EMOJI[bulle ?? anim]} `}</Text>}
          <Box flexDirection="column">
            {CLAWD_TEXTE.map((l, i) => (
              <Text key={i} color={couleur.O}>{l}</Text>
            ))}
          </Box>
          {boutons}
          {bulleMot}
        </Box>
      </Box>
    )
  })
}
