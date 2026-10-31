// La grande scène : pendant un numéro, Clawd sort de son coin et joue sur
// toute la bande, avec ce qu'atelier y dessine (sa bande partagée,
// `atelier.scene` : chaque jauge, chaque pastille, à sa place, et son dessin).
// Il peut prendre ce qui est là, le pousser, le faire sauter, passer derrière,
// sauter dessus, rapetisser pour se glisser dessous… Tant qu'il joue avec un
// élément (son état `clawd.emprunts`), atelier ne le dessine plus : c'est sa
// copie, au dessin identique, qui vit dans la scène. Il remet tout en place
// avant de finir.
//
// La physique reste crédible : il retombe en parabole (gravité), son ombre
// reste au sol et rétrécit quand il monte, ce qu'il pousse glisse et freine,
// ce qu'il heurte par en dessous rebondit. Taille, rotation, plans (devant,
// derrière) : tout s'anime.
//
// Le dessin est un SVG aussi large que la bande (`width="100%"`, sans
// viewBox : une unité = un px CSS, les places d'atelier s'y lisent telles
// quelles, et son coin est à `100% - 116px`). Il est préparé une fois au
// début du numéro et publié (`clawd.grandeScene`) : atelier le pose en absolu
// par-dessus toute la bande ; quand atelier ne dessine rien, Clawd le pose
// lui-même. Clawd y est dessiné comme dans sa petite scène (116×42), dans un
// SVG imbriqué au même cadrage, puis déplacé, tourné, agrandi par sa boîte.
//
// Un nouveau numéro : une entrée dans NUMEROS (voir `bousculade`), avec quand
// il peut le jouer, ce qu'il vise sur la bande (`cibles`) et ses pas.

import type { ClawdNumero, ElementBande } from '../types'
import { PINCEAUX, TAILLE, TEINTES } from './sprite'
import type { Deguisement, Teinte, Tenue } from './sprite'

const { PAL, VUE, CSS, vit, THEME, FILTRE, OMBRE, corps, profil, miroir, effets, fenetres, reutilises, recolore, deguiseEn, enPetit } = PINCEAUX
/** La teinte d'un modèle d'après sa couleur (celle d'une pastille de sous-agent), si c'en est une */
const teinteDe = (c: string | undefined): Teinte | undefined => Object.values(TEINTES).find(t => t.O.toLowerCase() === c?.toLowerCase())

/** Sa hauteur : les trois lignes du bas (ce qui dépasse de la bande est coupé, sans dommage ; au-dessus, la bande reste cliquable) */
export const HAUTEUR = 64
/** La hauteur d'une ligne d'atelier, en px CSS */
export const LIGNE = 19
/**
 * La largeur d'une case de la bande en px CSS : la bande ne se mesure qu'en
 * cases (`bodyColumns`), son numéro se pose à sa largeur en px. La même
 * valeur qu'atelier (scene.ts), à recaler d'après une capture du cadre.
 * L'app compte en largeurs de « 0 » de la police de la bande (`1ch`), arrondi
 * vers le bas (lu dans son code le 2026-10-26) : 7,55 px en Segoe UI 14 px,
 * 7,9 avant sa mise à jour. La bande fait donc au moins `cases × CELLULE`, et
 * moins d'une case de plus (le cadre du 2026-10-26 : 99 cases, 752 px).
 */
export const CELLULE = 7.55
/** Les px CSS d'une unité de sa toile (sa boîte de 116 px pour 244 unités) */
const ECHELLE_TOILE = TAILLE.largeur / VUE.w
/** Là où il est sur sa petite scène (unités de sa toile), en px de bande depuis son coin : le départ d'un numéro */
export const departDe = (xToile: number) => Math.round(xToile * ECHELLE_TOILE * 10) / 10
/** Son axe dans sa boîte de 116 px (x = 90 dans sa toile) */
export const AXE = Math.round((90 - VUE.x) * ECHELLE_TOILE)
/** Ses mesures dans la bande, en px : la moitié de sa largeur (son corps, sans les bras) et sa taille debout */
export const CORPS = { demiLargeur: Math.round(36 * ECHELLE_TOILE), hauteur: Math.round((VUE.y + VUE.h - 46) * ECHELLE_TOILE) }
/** Le haut de sa boîte quand il est au sol */
const BOITE = HAUTEUR - TAILLE.hauteur
/** La plus grande taille d'un numéro : ce que le moteur accepte d'un dessin, avec de la marge */
export const MAX_SVG = 120_000
/** La plus longue durée d'un numéro (s) : ce qu'il emprunte reste caché pendant ce temps */
export const MAX_DUREE = 60
/**
 * L'image du numéro démarre son animation un peu après les minuteurs (le
 * temps que l'app l'affiche, et chaque fois qu'elle la recrée). D'où trois
 * règles : chaque copie est dessinée pendant tout le numéro (au repos sur
 * l'original quand elle ne bouge pas) ; l'original est caché `MARGE` s après
 * le début (le temps que l'image s'affiche), pas plus tard : un texte et sa
 * copie l'un sur l'autre s'épaississent (le conseil devenait flou) ; il ne
 * revient qu'avec la fin du dessin, `RETENUE` s après la fin du numéro (tout
 * y est au repos, Clawd à sa place) : l'animation en retard finit sans être
 * coupée, et jamais l'original ne revient sous une copie qui bouge encore.
 */
export const MARGE = 0.3
export const RETENUE = 2

/** Le coin vide pendant un numéro : la même place, rien dedans (la bande ne bouge pas) */
export const COIN_VIDE = `<svg xmlns="http://www.w3.org/2000/svg" width="${TAILLE.largeur}" height="${TAILLE.hauteur}"/>`

/**
 * Où il se tient (le bord gauche de sa boîte) : à son coin (décalé de `coin`
 * px, négatif vers la gauche), à un x de la bande, ou l'axe sur une de ses
 * cibles (la `n`-ième, 0 par défaut, décalé de `cible` px). `h` : la hauteur
 * de ses pieds au-dessus du bas de la bande (0 : au sol ; perché sur une
 * pastille, ~16).
 */
export type Lieu = ({ coin: number } | { x: number } | { cible: number; n?: number }) & { h?: number }

/**
 * Comment il va d'un lieu à l'autre (et un élément d'un état à l'autre) :
 * `lineaire` (vitesse constante, le défaut), `doux` (démarre et s'arrête en
 * douceur), `elan` (accélère : une chute, un élan), `freine` (ralentit : ce
 * qu'on pousse et qui glisse, un saut qui monte).
 */
export type Mouvement = 'lineaire' | 'doux' | 'elan' | 'freine'

/** Ce qu'il fait de la copie d'une cible qu'il porte : il la tient (devant lui), la brandit, l'a ouverte en deux */
export type Objet = 'tenu' | 'haut' | 'ouvert'

/**
 * Ce qui arrive à une de ses cibles pendant un pas, restée sur la bande (pas
 * dans ses pinces) : son état à la fin du pas, depuis celui où l'a laissée le
 * pas d'avant (au départ, à sa place : tout à 0, taille 1, opacité 1).
 */
export type Geste = {
  /** quelle cible (son rang dans `cibles`, 0 par défaut) */
  n?: number
  /** son décalage depuis sa place, en px (`dy` vers le haut) */
  dx?: number
  dy?: number
  /** en degrés, autour de son centre */
  rot?: number
  /** sa taille (1 : normale), autour de son centre */
  echelle?: number
  opacite?: number
  mouvement?: Mouvement
  /** un bond en parabole pendant le pas, de cette hauteur (px) : ce qu'on heurte par en dessous, ce qu'on fait sauter */
  saut?: number
  /** il tremble pendant le pas, de cette amplitude (px), et s'arrête net à la fin */
  secoue?: number
  /** dessinée par-dessus lui pendant ce pas : il passe derrière (sinon, il passe devant) */
  devant?: boolean
}

/** Un pas d'un numéro : des images jouées pendant `duree` s, pendant qu'il va de `de` à `a` */
export type Pas = {
  /** en s ; avec une `vitesse`, c'est un minimum : la distance décide */
  duree: number
  images: string[]
  /** combien de fois la liste d'images défile pendant le pas (un entier, 1 par défaut) */
  tours?: number
  de?: Lieu
  a?: Lieu
  /**
   * Sa vitesse sur ce trajet : la durée du pas se calcule d'après la distance
   * (qui dépend de la largeur de la bande), au pas de ses pattes : `lent`
   * (marche, 50 px/s), `vite` (course, 150 px/s), ou des px/s. Plus petit, il
   * va moins vite (ses pattes aussi rapetissent).
   */
  vitesse?: 'lent' | 'vite' | number
  mouvement?: Mouvement
  /** il bondit pendant le pas, en parabole de cette hauteur (px), comme sous l'effet de la gravité */
  saut?: number
  /** sa taille à la fin du pas (1 : normale), autour de ses pieds */
  echelle?: number
  /** son inclinaison à la fin du pas, en degrés, autour du milieu de son corps (360 : un salto) */
  rot?: number
  /** la copie d'une cible qu'il porte pendant ce pas (`tient` : laquelle, 0 par défaut) ; à sa place, elle n'est plus dessinée */
  objet?: Objet
  tient?: number
  /** ce qui arrive à ses cibles restées sur la bande */
  gestes?: Geste[]
  /** les cadres de repérage autour de ce qu'il voit sur la bande */
  repere?: boolean
  /** des effets autour de lui, dans sa toile (comme ceux de ses scènes : notes, étincelles…) */
  fx?: string
  /** (posé par le moteur) la durée d'un cycle de ses pattes pendant ce trajet (s), à sa vitesse réelle : ses pieds ne glissent pas */
  cadence?: number
}

/**
 * Ce qu'un numéro sait de la partie qui se joue : la largeur de la bande
 * (px), une variante tirée au sort (entre 0 et 1, la même pour tout le
 * dessin : ses pas en tirent leurs variations), ce qu'il vient voir (l'id
 * d'un élément, pour une réaction à ce qui vient de changer), et ses minis
 * dans le coin (la couleur de chacun, null : la sienne) : ceux que le numéro
 * ne fait pas jouer le regardent depuis leurs cases (sans eux, ils
 * disparaîtraient le temps du numéro).
 */
export type Partie = { largeur: number; variante: number; vise?: string; figurants?: readonly (string | null)[] }

export type Numero = {
  /** Quand il peut le jouer de lui-même : au repos, pendant que Claude travaille, partout, ou seulement sur demande */
  quand: 'repos' | 'travail' | 'partout' | 'demande'
  /** Combien de fois plus souvent il le tire au sort, parmi ceux qu'il peut jouer (1 par défaut) */
  poids?: number
  /** Ce qu'il lui faut sur la bande, dit à l'utilisateur quand il ne peut pas le jouer (« une pastille… ») */
  besoin?: string
  /** Ce qu'il vise sur la bande, dans l'ordre de ses pas ; rien de convenable (undefined ou liste vide) : il ne le joue pas */
  cibles?: (elements: readonly ElementBande[], partie: Partie) => readonly ElementBande[] | undefined
  pas: (cibles: readonly ElementBande[], partie: Partie) => Pas[]
  /** Ses minis qui jouent avec lui, chacun ses pas (en même temps que les siens) */
  copains?: (cibles: readonly ElementBande[], partie: Partie) => Copain[]
  /** Il se joue avec ses minis : seulement quand ils sont là (des sous-agents au travail), et tiré à part (register.tsx) */
  avecMinis?: boolean
}

/**
 * Un de ses mini-Clawds sur la bande : il sort de sa case dans le coin (la
 * `place`-ième, 0 la plus proche de Clawd, comme dans sa petite scène), à
 * mi-taille, dans la `teinte` de son modèle (celle de sa pastille), joue ses
 * pas et y revient. Ses lieux `coin` se comptent depuis sa case. Il ne porte
 * rien (`objet`), et ne touche pas ce que touche un autre.
 */
export type Copain = { place: number; teinte?: string; pas: Pas[] }

/** Au plus trois minis sur la bande, comme dans son coin */
const MINIS_MAX = 3
/** La taille d'un mini */
const DEMI = 0.5
/** Le bord gauche de la boîte d'un mini dans sa case (px depuis celui de Clawd) : son axe, là où sa petite scène le dessine (`mini`, sprite.ts) */
export const coinCopain = (place: number) => Math.round((PINCEAUX.X0 - 24 - 40 * place - 90) * ECHELLE_TOILE * 10) / 10

/** La largeur de la bande quand on ne la connaît pas (px) : celle d'une fenêtre moyenne */
export const LARGEUR_BANDE = 760
/** Ses vitesses (px/s), au pas de ses pattes : un cycle de marche en 0,6 s, de course en 0,4 s */
const VITESSES = { lent: 50, vite: 150 }

// ------------------------------------------------------------- les copies

const VERT = '#4cc38a'
const ROUGE = '#ef5b5f'
const sure = (c: string | undefined) => (c && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(c) ? c : undefined)
/** La hauteur du dessin d'un élément d'atelier */
const H_EL = 18

const nombre = (v: unknown, max: number): v is number => typeof v === 'number' && v >= 0 && v <= max
/** Le bas de la rangée d'un élément (px au-dessus du bas de la bande) et sa hauteur : publiés par atelier (ses rangées
 * n'ont pas toutes la même hauteur), sinon au pas de LIGNE */
const basDe = (el: ElementBande) => (nombre(el.bas, HAUTEUR) ? el.bas : el.ligne * LIGNE)
const rangeeDe = (el: ElementBande) => (nombre(el.rangee, 2 * LIGNE) && el.rangee > 0 ? el.rangee : LIGNE)

/** Le centre d'un élément de la bande, en px */
export const centre = (el: ElementBande) => ({ x: el.x + el.largeur / 2, y: HAUTEUR - basDe(el) - rangeeDe(el) / 2 })
/** La hauteur où atelier pose le dessin d'un élément (sa largeur est à la même échelle) */
const hauteurDe = (el: ElementBande) => (typeof el.hauteur === 'number' && el.hauteur > 0 && el.hauteur <= LIGNE ? el.hauteur : H_EL)
/** Le haut du dessin d'un élément : centré sur sa rangée */
const hautDe = (el: ElementBande) => HAUTEUR - basDe(el) - (rangeeDe(el) + hauteurDe(el)) / 2
/** La hauteur (au-dessus du bas de la bande) du dessus d'un élément : où il se pose quand il monte dessus */
export const dessus = (el: ElementBande) => basDe(el) + rangeeDe(el) / 2 + (el.genre === 'jauge' || el.genre === 'conso' ? 4 : 6)

/** Une pastille de la ligne du bas, dessinée à sa façon, centrée en (cx, cy) : les mêmes couleurs que l'original */
function pastille(el: ElementBande, cx: number, cy: number): string {
  const teinte = sure(el.teinte)
  if (el.etat === 'faite' || el.etat === 'echec') {
    const fond = `<circle cx="${cx}" cy="${cy}" r="6" fill="${el.etat === 'echec' ? ROUGE : (teinte ?? VERT)}"/>`
    const trait =
      el.etat === 'faite'
        ? `<path class="cp-trait" d="M${cx - 2.8} ${cy + 0.1} l1.9 1.9 l3.7 -3.9"/>`
        : `<path class="cp-trait" d="M${cx - 2.3} ${cy - 2.3} l4.6 4.6 M${cx + 2.3} ${cy - 2.3} l-4.6 4.6"/>`
    return fond + trait
  }
  if (el.etat === 'encours') {
    // l'orbe qui respire, en plus simple : un anneau de points qui tourne
    const points = Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * 2 * Math.PI
      return `<circle cx="${(cx + 6 * Math.cos(a)).toFixed(1)}" cy="${(cy + 6 * Math.sin(a)).toFixed(1)}" r="${(0.7 + (i % 3) * 0.25).toFixed(2)}"/>`
    }).join('')
    return `<g class="cp-orbe"${teinte ? ` fill="${teinte}"` : ''}>${points}</g>`
  }
  return `<circle class="cp-attente" cx="${cx}" cy="${cy}" r="5.5"/>`
}

/**
 * Le dessin d'un élément quand atelier ne le donne pas (l'orbe en cours, la
 * bande d'exemple) : un SVG de sa taille, à la façon d'atelier, sans texte.
 */
function secours(el: ElementBande): string {
  const w = el.largeur
  let s = ''
  if (el.genre === 'jauge') {
    const c = el.etat === 'critique' ? ROUGE : el.etat === 'attention' ? '#f2b33d' : VERT
    const barre = Math.max(12, Math.min(56, w - 60))
    s = `<rect class="cp-texte" x="0" y="6" width="14" height="6" rx="2"/><rect class="cp-piste" x="22" y="6" width="${barre}" height="6" rx="3"/><rect x="22" y="6" width="${Math.round(barre * 0.45)}" height="6" rx="3" fill="${c}"/><rect class="cp-texte" x="${27 + barre}" y="6" width="${Math.max(4, w - 31 - barre)}" height="6" rx="2"/>`
  } else if (el.genre === 'conseil') {
    s = `<rect class="cp-conseil" x="0" y="6" width="${w}" height="6" rx="2"/>`
  } else if (el.genre === 'conso') {
    s = `<rect class="cp-texte${el.etat === 'lourde' ? ' cp-lourde' : ''}" x="0" y="6" width="${w}" height="6" rx="2"/>`
  } else s = pastille(el, w / 2, H_EL / 2)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${H_EL}">${s}</svg>`
}

/** Le dessin d'atelier, s'il a la forme attendue : un SVG seul, sans script ni lien vers l'extérieur */
const dessinSur = (d: unknown): d is string =>
  typeof d === 'string' && d.startsWith('<svg') && d.endsWith('</svg>') && d.length <= 20_000 && !/<script|<foreignObject|href\s*=|url\(\s*['"]?(?!#)|\bon[a-z]+\s*=/i.test(d)

/**
 * Ses noms de classes et d'animations, préfixés : deux dessins d'atelier
 * réunis dans le même SVG (une jauge, une pastille) définissent les mêmes
 * classes autrement (`.piste`), ils ne doivent pas se marcher dessus, ni sur
 * les siennes.
 */
function isole(svg: string, p: string): string {
  return svg
    .replace(/<style>([\s\S]*?)<\/style>/g, (_, css: string) =>
      `<style>${css
        .replace(/\.(-?[_a-zA-Z][\w-]*)/g, `.${p}$1`)
        .replace(/@keyframes\s+([\w-]+)/g, `@keyframes ${p}$1`)
        .replace(/animation(-name)?\s*:\s*([_a-zA-Z][\w-]*)/g, (_m, nom: string | undefined, a: string) => `animation${nom ?? ''}:${p}${a}`)}</style>`,
    )
    .replace(/class="([^"]*)"/g, (_, c: string) => `class="${c.split(/\s+/).filter(Boolean).map(x => p + x).join(' ')}"`)
}

/**
 * Le dessin d'une de ses cibles, posé en (x, y) : celui d'atelier à
 * l'identique (ses noms préfixés par `p`, propre à ce numéro et à cette
 * cible), sinon le sien
 */
function copieDe(el: ElementBande, p: string, x: number, y: number): string {
  const d = dessinSur(el.dessin) ? isole(el.dessin, p) : secours(el)
  // sa place et sa taille sont les nôtres : celles qu'il porterait déjà feraient un attribut en double (un SVG invalide)
  return d.replace(/^<svg\b([^>]*)>/, (_, attrs: string) => {
    const reste = attrs.replace(/\s(?:x|y|width|height|overflow)\s*=\s*("[^"]*"|'[^']*')/g, '')
    return `<svg x="${+x.toFixed(1)}" y="${+y.toFixed(1)}" width="${el.largeur}" height="${hauteurDe(el)}" overflow="visible"${reste}>`
  })
}

/** Où la copie qu'il porte se tient par rapport à sa boîte (son centre) : devant son ventre, à bout de bras au-dessus de lui */
const PRISE: Record<Objet, { x: number; y: number }> = {
  tenu: { x: AXE, y: BOITE + 28 },
  haut: { x: AXE, y: BOITE + 3 },
  ouvert: { x: AXE, y: BOITE + 1 },
}

/** La copie qu'il porte : centrée sur sa prise ; ouverte, en deux moitiés qui s'écartent (à partir de `debut` s, quand elle apparaît), avec des étincelles */
function portee(el: ElementBande, p: string, o: Objet, id: string, debut = 0): string {
  const { x, y } = PRISE[o]
  const x0 = x - el.largeur / 2
  const y0 = y - hauteurDe(el) / 2
  const c = copieDe(el, p, x0, y0)
  if (o !== 'ouvert') return c
  const moitie = (cote: 'g' | 'd') =>
    `<clipPath id="${id}-${cote}"><rect x="${(cote === 'g' ? x0 - 2 : x).toFixed(1)}" y="${y0 - 4}" width="${(el.largeur / 2 + 2).toFixed(1)}" height="${H_EL + 8}"/></clipPath>`
  const etincelles = [[-11, -7], [10, -9], [-7, 8], [12, 6]]
    .map(([dx, dy], i) => `<rect class="cp-scintille" style="animation-delay:${(i * 0.15).toFixed(2)}s" x="${x + dx! - 1.5}" y="${y + dy! - 1.5}" width="3" height="3" fill="${PAL.Y}"/>`)
    .join('')
  return (
    `<defs>${moitie('g')}${moitie('d')}</defs>` +
    // (l'ouverture démarre quand elle apparaît, pas au chargement du dessin : sinon elle est déjà finie)
    `<g class="cp-haut" style="animation-delay:calc(var(--t0,0s) + ${debut.toFixed(2)}s)"><g clip-path="url(#${id}-g)">${c}</g></g><g class="cp-bas" style="animation-delay:calc(var(--t0,0s) + ${debut.toFixed(2)}s)"><g clip-path="url(#${id}-d)">${c}</g></g>${etincelles}`
  )
}

// ------------------------------------------------------------- les numéros

const f = corps
/** Ses images de course et de bond, dessinées avec son déguisement du moment (recalculées par `avecDeguisement`) */
const imagesCourantes = () => ({
  /** Ses pattes libres (sans la canne) : pour pousser, porter */
  pousse: profil('lent', false),
  court: profil('vite'),
  /** Les images d'un bond : il s'élance (étiré), en l'air, puis se reçoit (écrasé) */
  bond: {
    part: f({ jambes: 'replie', g: 'haut', d: 'haut', masse: 'etire' }),
    haut: f({ jambes: 'replie', g: 'ciel', d: 'ciel', yeux: 'heureux' }),
    recoit: f({ jambes: 'replie', dy: 3 }),
  },
})
let { pousse, court, bond } = imagesCourantes()

/**
 * Dessine un numéro avec sa tenue du moment (lunettes du vendredi soir,
 * cernes du lundi matin, chapeau du 31/10 ; sa visière, sa sueur, son
 * insigne) : ses poses (`f`) la prennent au moment du dessin, et ses images de
 * course et de bond sont refaites avec elle
 */
function avecDeguisement<T>(d: Deguisement | Tenue | undefined, dessine: () => T): T {
  if (!d) return dessine()
  return deguiseEn(d, () => {
    const avant = { pousse, court, bond }
    ;({ pousse, court, bond } = imagesCourantes())
    try {
      return dessine()
    } finally {
      ;({ pousse, court, bond } = avant)
    }
  })
}
/**
 * Un choix parmi `k`, tiré de la variante de la partie : `rang` en donne un
 * autre, indépendant (un autre chiffre de la même variante). La variante 0
 * (celle des tests, de /clawd voit) donne toujours le premier.
 */
export const choix = (v: number, k: number, rang = 0) => Math.min(k - 1, Math.floor(((v * 10 ** rang) % 1) * k))

/** Ce qui est sur la ligne du bas (les pastilles), de gauche à droite */
const duBas = (els: readonly ElementBande[]) => els.filter(e => e.ligne === 0 && (e.genre === 'tache' || e.genre === 'agent' || e.genre === 'build')).sort((a, b) => a.x - b.x)
/** Ce qui est sur la ligne des quotas (jauges et conso), de gauche à droite */
const duHaut = (els: readonly ElementBande[]) => els.filter(e => e.ligne === 1 && estQuota(e)).sort((a, b) => a.x - b.x)
/** Ce qui est sur la ligne des quotas : les jauges, la conso, la puce du conseil de modèle */
const estQuota = (e: ElementBande) => e.genre === 'jauge' || e.genre === 'conso' || e.genre === 'conseil'

/**
 * Il chipe une pastille de la ligne du bas (l'orbe qui tourne d'abord : c'est
 * la plus drôle à voler) : il la repère, s'en approche en catimini, la prend,
 * la secoue, elle s'ouvre en deux, panique, il la recolle en vitesse, la
 * remet à sa place l'air de rien, et rentre en sifflotant.
 */
const chipe: Numero = {
  quand: 'partout',
  besoin: 'une pastille en bas de la bande (une tâche, un sous-agent ou un build)',
  cibles: els => {
    const bas = duBas(els)
    const c = bas.find(e => e.etat === 'encours') ?? bas[bas.length - 1]
    return c ? [c] : undefined
  },
  pas: (_, { variante }) => [
    { duree: 1.6, images: [f({ yeux: 'gauche' }), f({ yeux: 'gauche', d: 'tete' }), f({ yeux: 'clin' })], de: { coin: 0 } },
    // il court jusque près d'elle, puis s'approche en catimini
    { duree: 0.4, images: [court], de: { coin: 0 }, a: { cible: 60 }, vitesse: 'vite', mouvement: 'doux' },
    { duree: 0.4, images: [profil('lent')], a: { cible: 0 }, vitesse: 'lent' },
    { duree: 0.8, images: [f({ yeux: 'bas' }), f({ yeux: 'bas', g: 'tendu' })] },
    { duree: 1, images: [f({ g: 'devant', d: 'devant', yeux: 'heureux' })], objet: 'tenu' },
    // il la secoue plus ou moins longtemps (selon la partie), parfois en sautillant
    ...(choix(variante, 2, 1)
      ? [{ duree: 1.6, images: [f({ g: 'haut', d: 'haut', yeux: 'grand', dx: -2 }), f({ g: 'haut', d: 'haut', yeux: 'grand', dx: 2 })], tours: 2, objet: 'haut' as const, saut: 6 }]
      : []),
    { duree: [1.4, 1, 2][choix(variante, 3)]!, images: [f({ g: 'haut', d: 'haut', yeux: 'grand', dx: -2 }), f({ g: 'haut', d: 'haut', yeux: 'grand', dx: 2 })], tours: [4, 3, 6][choix(variante, 3)]!, objet: 'haut' },
    { duree: 1.6, images: [f({ g: 'ciel', d: 'ciel', yeux: 'grand', bouche: 'o' })], objet: 'ouvert', fx: effets.sueur() },
    { duree: 1.2, images: [f({ g: 'devant', d: 'devant', yeux: 'croix' }), f({ g: 'devant', d: 'devant', yeux: 'mi' })], tours: 2, objet: 'tenu' },
    { duree: 1, images: [f({ yeux: 'clin' }), f({ yeux: 'heureux' })], fx: effets.notes() },
    { duree: 0.4, images: [miroir(court)], a: { coin: 0 }, vitesse: 'vite', mouvement: 'doux' },
    { duree: 0.8, images: [f({ yeux: 'heureux' })] },
  ],
}

/**
 * Il fait le tour de la bande : jusqu'au bout à gauche, un coucou, un salto
 * (selon la partie : un simple, un double, ou deux sauts de joie), et retour
 * au coin.
 */
const tournee: Numero = {
  quand: 'partout',
  pas: (_, { variante }) => [
    { duree: 1.2, images: [f({ yeux: 'gauche' }), f({ yeux: 'heureux' })], de: { coin: 0 } },
    { duree: 0.4, images: [court], de: { coin: 0 }, a: { x: -30 }, vitesse: 'vite', mouvement: 'doux' },
    { duree: 1.6, images: [f({ g: 'haut', yeux: 'heureux' }), f({ g: 'ciel', yeux: 'heureux' })], tours: 3 },
    { duree: 0.25, images: [f({ jambes: 'replie', dy: 3 })] },
    ...([
      [{ duree: 0.9, images: [bond.part, bond.haut, bond.haut], saut: 30, rot: 360 }],
      // le double : plus haut, plus long
      [{ duree: 1.2, images: [bond.part, bond.haut, bond.haut], saut: 40, rot: 720 }],
      // deux sauts de joie, sans tourner
      [
        { duree: 0.6, images: [bond.part, bond.haut], saut: 16 },
        { duree: 0.2, images: [bond.recoit] },
        { duree: 0.6, images: [bond.part, bond.haut], saut: 22 },
      ],
    ][choix(variante, 3)]! satisfies Pas[]),
    { duree: 0.3, images: [bond.recoit] },
    { duree: 0.4, images: [miroir(court)], a: { coin: 0 }, vitesse: 'vite', mouvement: 'doux' },
    { duree: 0.8, images: [f()] },
  ],
}

/**
 * La bousculade : il tape dans les quotas (par en dessous, comme sous des
 * briques, quand des pastilles les portent ; d'un coup d'épaule quand ils sont
 * à sa hauteur), se glisse derrière les pastilles tout petit, bondit
 * par-dessus, et rentre.
 */
const bousculade: Numero = {
  quand: 'partout',
  besoin: 'les jauges des quotas sur la bande',
  cibles: els => {
    const quotas = els.filter(estQuota).sort((a, b) => a.x - b.x)
    const bas = duBas(els)
    // toute la rangée (il passe derrière d'un bout à l'autre), dans la limite du raisonnable
    if (bas.length > 12) return undefined
    const haut = quotas.filter(e => e.ligne >= 1).slice(-2).reverse()
    if (haut.length) return [...haut, ...bas]
    // pas de pastilles dessous : les quotas sont à sa hauteur, il fonce dans le dernier
    const sol = quotas.slice(-1)
    return sol.length ? sol : undefined
  },
  pas: c => (c[0]!.ligne >= 1 ? parDessous(c) : coupDEpaule(c[0]!)),
}

/** Les quotas au-dessus de sa tête : il tape dedans par en dessous, puis passe derrière les pastilles (s'il y en a) et bondit par-dessus */
function parDessous(c: readonly ElementBande[]): Pas[] {
  const nHaut = c.filter(e => e.ligne >= 1).length
  const bas = c.slice(nHaut)
  const iBas = bas.map((_, i) => nHaut + i)
  // il tape par en dessous dans chaque élément du haut, de droite à gauche
  const coups = c.slice(0, nHaut).flatMap((_, n): Pas[] => [
    { duree: 0.4, images: [court], a: { cible: 0, n }, vitesse: 'vite', mouvement: 'doux' },
    { duree: 0.2, images: [f({ jambes: 'replie', dy: 3, yeux: 'haut' })] },
    // sa tête touche déjà le bas de la ligne : l'élément part avec lui dès qu'il monte, un peu plus haut, puis tous deux retombent
    { duree: 0.28, images: [bond.part], a: { cible: 0, n, h: 7 }, mouvement: 'freine', gestes: [{ n, dy: 10, rot: n % 2 ? -5 : 5, mouvement: 'freine' }], fx: effets.etincelles() },
    { duree: 0.3, images: [bond.haut], a: { cible: 0, n }, mouvement: 'elan', gestes: [{ n, dy: 0, rot: 0, mouvement: 'elan' }] },
    // l'élément retombe à sa place et rebondit un peu
    { duree: 0.25, images: [bond.recoit], gestes: [{ n, saut: 2 }] },
    { duree: 0.5, images: [f({ yeux: 'heureux', g: 'haut' })] },
  ])
  const debut: Pas = { duree: 1.2, images: [f({ yeux: 'gauche' }), f({ yeux: 'clin' })], de: { coin: 0 } }
  const retour: Pas[] = [
    { duree: 0.6, images: [f({ g: 'ciel', d: 'ciel', yeux: 'heureux' })], fx: effets.notes() },
    { duree: 0.4, images: [miroir(court)], a: { coin: 0 }, vitesse: 'vite', mouvement: 'doux' },
    { duree: 0.6, images: [f({ yeux: 'heureux' })] },
  ]
  if (!bas.length) return [debut, ...coups, ...retour]
  const premier = bas[0]!
  const dernier = bas[bas.length - 1]!
  // derrière les pastilles : elles sont dessinées par-dessus lui, jusqu'à ce qu'il en soit sorti d'un bond
  const derriere = iBas.map(n => ({ n, devant: true }))
  return [
    debut,
    ...coups,
    { duree: 0.4, images: [court], a: { cible: CORPS.demiLargeur + 14, n: iBas[iBas.length - 1]! }, vitesse: 'vite', mouvement: 'doux' },
    // il rapetisse (à cette taille, il passe sous la ligne des quotas)
    { duree: 0.8, images: [f({ yeux: 'grand' }), f({ yeux: 'heureux' })], echelle: 0.5, fx: effets.etincelles() },
    { duree: 0.4, images: [court], a: { x: premier.x + 4 - AXE }, vitesse: 'vite', gestes: derriere },
    { duree: 0.8, images: [f({ yeux: 'gauche' }), f({ yeux: 'droite' })], gestes: derriere },
    // au bout, il reprend sa taille, toujours derrière
    { duree: 0.6, images: [f({ g: 'haut', d: 'haut', yeux: 'heureux' })], echelle: 1, gestes: derriere },
    { duree: 0.3, images: [f({ jambes: 'replie', dy: 3 })], gestes: derriere },
    // un grand bond par-dessus toute la rangée : il en sort par le haut, et se reçoit au-delà
    { duree: 1.1, images: [bond.part, bond.haut, bond.haut], a: { x: dernier.x + dernier.largeur - AXE + CORPS.demiLargeur + 14 }, saut: 24, gestes: derriere },
    { duree: 0.3, images: [bond.recoit] },
    ...retour,
  ]
}

/**
 * Les quotas à sa hauteur (pas de pastilles dessous) : il prend son élan et
 * fonce dans le dernier d'un coup d'épaule. Il glisse un peu et tangue, lui
 * rebondit en arrière, sonné ; l'élément revient en place comme un ressort.
 * Vexé, il saute par-dessus, puis le resaute pour rentrer.
 */
function coupDEpaule(el: ElementBande): Pas[] {
  // son axe quand il touche le bord droit de l'élément, et à distance d'élan
  const contact = el.largeur / 2 + CORPS.demiLargeur
  const dela = -(el.largeur / 2 + CORPS.demiLargeur + 14)
  return [
    { duree: 1.2, images: [f({ yeux: 'gauche' }), f({ yeux: 'clin' })], de: { coin: 0 } },
    { duree: 0.4, images: [court], a: { cible: contact + 40 }, vitesse: 'vite', mouvement: 'doux' },
    { duree: 0.5, images: [f({ jambes: 'replie', dy: 3, yeux: 'gauche' })] },
    // l'élan : il accélère jusqu'au choc
    { duree: 0.3, images: [court], a: { cible: contact }, mouvement: 'elan' },
    // le choc : l'élément glisse et tangue, lui rebondit en arrière
    { duree: 0.45, images: [f({ yeux: 'croix', g: 'haut', d: 'haut' })], a: { cible: contact + 18 }, saut: 6, mouvement: 'freine', gestes: [{ dx: -10, rot: -6, mouvement: 'freine' }], fx: effets.etincelles() },
    { duree: 1.1, images: [f({ yeux: 'croix' }), f({ yeux: 'mi' })], tours: 2, gestes: [{ dx: -10, rot: 0, secoue: 1.5 }] },
    // comme un ressort, il revient à sa place
    { duree: 0.6, images: [f({ yeux: 'grand', bouche: 'o' })], gestes: [{ dx: 0, mouvement: 'doux' }] },
    { duree: 0.5, images: [f({ jambes: 'replie', dy: 3, yeux: 'mi' })] },
    // vexé, il le saute (ses pieds passent au-dessus), et le resaute pour rentrer
    // (seulement s'il y a la place de se poser de l'autre côté : collé au bord gauche, il sortirait du dessin)
    ...(el.x + el.largeur / 2 + dela - CORPS.demiLargeur >= 0
      ? [
          { duree: 1.2, images: [bond.part, bond.haut, bond.haut], a: { cible: dela }, saut: 30 },
          { duree: 0.3, images: [bond.recoit] },
          { duree: 0.6, images: [f({ g: 'ciel', d: 'ciel', yeux: 'heureux' })], fx: effets.notes() },
          { duree: 0.3, images: [f({ jambes: 'replie', dy: 3 })] },
          { duree: 1.2, images: [bond.part, bond.haut, bond.haut], a: { cible: contact + 14 }, saut: 30 },
          { duree: 0.3, images: [bond.recoit] },
        ]
      : [{ duree: 0.8, images: [f({ g: 'ciel', d: 'ciel', yeux: 'heureux' }), f({ g: 'haut', d: 'haut', yeux: 'clin' })], fx: effets.notes() }]),
    { duree: 0.4, images: [miroir(court)], a: { coin: 0 }, vitesse: 'vite', mouvement: 'doux' },
    { duree: 0.6, images: [f({ yeux: 'heureux' })] },
  ]
}

/**
 * Le pop-corn : il tape du pied au bout de la rangée, et les pastilles
 * sautent l'une après l'autre en tournant sur elles-mêmes, comme du maïs dans
 * la poêle ; la dernière, la plus proche de lui, saute plus haut. Il applaudit.
 */
const popcorn: Numero = {
  quand: 'partout',
  besoin: 'au moins deux pastilles en bas de la bande (tâches, sous-agents, build)',
  cibles: els => {
    // les dernières de la rangée : il se tient au bout, sans cacher celles d'après
    const bas = duBas(els).slice(-6)
    return bas.length >= 2 ? bas : undefined
  },
  pas: (c, { variante }) => {
    const dernier = c.length - 1
    // selon la partie : de gauche à droite (la dernière, la plus proche, saute le plus haut), de droite à gauche (elle
    // ouvre le bal), ou en désordre ; les hauteurs changent aussi
    const ordre = c.map((_, n) => n)
    if (choix(variante, 3) === 1) ordre.reverse()
    if (choix(variante, 3) === 2) ordre.sort((a, b) => ((a * 7 + 3) % c.length) - ((b * 7 + 3) % c.length))
    const plus = choix(variante, 3, 1) * 3
    const sauts = ordre.map((n): Pas => ({
      duree: n === dernier ? 0.9 : 0.55,
      images: [f({ jambes: 'tape', yeux: 'grand' }), f({ yeux: 'grand', bouche: 'o' })],
      gestes: [{ n, saut: n === dernier ? 26 : 12 + (n % 3) * 3 + plus, rot: n % 2 ? -360 : 360, mouvement: 'freine' }],
    }))
    return [
      { duree: 1.2, images: [f({ yeux: 'gauche' }), f({ yeux: 'clin' })], de: { coin: 0 } },
      { duree: 0.4, images: [court], a: { cible: CORPS.demiLargeur + 16, n: dernier }, vitesse: 'vite', mouvement: 'doux' },
      { duree: 0.6, images: [f({ jambes: 'tape' }), f()], tours: 2 },
      ...sauts,
      { duree: 1.4, images: [f({ g: 'ciel', d: 'ciel', yeux: 'heureux' }), f({ g: 'haut', d: 'haut', yeux: 'heureux' })], tours: 3, fx: effets.notes() },
      { duree: 0.4, images: [miroir(court)], a: { coin: 0 }, vitesse: 'vite', mouvement: 'doux' },
      { duree: 0.6, images: [f({ yeux: 'heureux' })] },
    ]
  },
}

/**
 * L'échange : il fait sauter les deux dernières pastilles par-dessus l'une
 * l'autre pour les échanger, fier de lui… puis elles reprennent leur place
 * toutes seules. Il hausse les épaules.
 */
const echange: Numero = {
  quand: 'partout',
  besoin: 'deux pastilles différentes au bout de la rangée du bas (une faite et une à faire, par exemple)',
  // les deux dernières de la rangée, s'il y a de quoi voir l'échange : il se tient contre la dernière, sans cacher les autres
  cibles: els => {
    const bas = duBas(els)
    const [a, b] = bas.slice(-2)
    return a && b && a.etat !== b.etat && b.x - a.x <= 40 ? [a, b] : undefined
  },
  pas: ([a, b]) => {
    const d = b!.x - a!.x
    return [
      { duree: 1.2, images: [f({ yeux: 'gauche' }), f({ yeux: 'clin' })], de: { coin: 0 } },
      { duree: 0.4, images: [court], a: { cible: b!.largeur / 2 + CORPS.demiLargeur, n: 1 }, vitesse: 'vite', mouvement: 'doux' },
      { duree: 0.6, images: [f({ g: 'tendu', yeux: 'gauche' })] },
      // l'une passe haut, l'autre bas : au croisement, 15 px les séparent (elles en font 12)
      { duree: 0.9, images: [f({ g: 'haut', d: 'haut', yeux: 'grand' })], gestes: [{ n: 0, dx: d, saut: 18 }, { n: 1, dx: -d, saut: 3 }] },
      { duree: 1.4, images: [f({ yeux: 'heureux' }), f({ yeux: 'clin' })], fx: effets.notes() },
      // et elles reviennent d'elles-mêmes
      { duree: 0.9, images: [f({ yeux: 'grand', bouche: 'o' })], gestes: [{ n: 0, dx: 0, saut: 3 }, { n: 1, dx: 0, saut: 18 }] },
      { duree: 1.2, images: [f({ g: 'haut', d: 'haut', yeux: 'mi' }), f({ g: 'bas', d: 'bas', yeux: 'mi' })], tours: 2 },
      { duree: 0.4, images: [miroir(court)], a: { coin: 0 }, vitesse: 'vite', mouvement: 'doux' },
      { duree: 0.6, images: [f({ yeux: 'heureux' })] },
    ]
  },
}

/**
 * Le petit : il rapetisse au bout de la rangée, devient de la taille d'une
 * pastille, grimpe dessus et saute de l'une à l'autre (elles s'enfoncent sous
 * ses pieds). Sur la dernière, il se met à courir dessus comme sur une balle
 * de cirque : elle roule sous lui dans un sens, puis dans l'autre. Il revient
 * en sautant, reprend sa taille et rentre. Tiré deux fois plus souvent que les
 * autres : c'est quand il est petit qu'il joue le plus avec elles.
 */
const lilliput: Numero = {
  quand: 'partout',
  poids: 2,
  besoin: 'au moins deux pastilles en bas de la bande (tâches, sous-agents, build)',
  cibles: els => {
    // les dernières de la rangée : il part du bout où il est, sans cacher celles d'après
    const bas = duBas(els).slice(-3)
    return bas.length >= 2 ? bas : undefined
  },
  pas: (c, { variante }) => {
    const dernier = c.length - 1
    // la balle roule d'abord vers la gauche ou vers la droite (selon la partie), parfois une fois de plus
    const sens = choix(variante, 2) ? -1 : 1
    const roule = (k: number): Pas => ({ duree: k ? 1.2 : 1.4, images: [k % 2 === (sens < 0 ? 1 : 0) ? pousse : miroir(pousse)], gestes: [{ n: 0, rot: (k % 2 ? 720 : -720) * sens }] })
    const roulades = Array.from({ length: choix(variante, 2, 1) ? 3 : 2 }, (_, k) => roule(k))
    // où il se pose : sur la pastille, ses pieds sur son dessus (elle s'enfonce de 2 px sous lui)
    const posee = (n: number, avant?: number): Pas[] => [
      { duree: 0.5, images: [bond.part, bond.haut, bond.haut], a: { cible: 0, n, h: dessus(c[n]!) }, saut: 8 },
      { duree: 0.2, images: [bond.recoit], gestes: [{ n, dy: -2 }, ...(avant === undefined ? [] : [{ n: avant, dy: 0 }])] },
    ]
    const loin = CORPS.demiLargeur + 16
    return [
      { duree: 1.2, images: [f({ yeux: 'gauche' }), f({ yeux: 'clin' })], de: { coin: 0 } },
      { duree: 0.4, images: [court], a: { cible: loin, n: dernier }, vitesse: 'vite', mouvement: 'doux' },
      // il rapetisse : à cette taille, une pastille est un rocher
      { duree: 0.8, images: [f({ yeux: 'grand' }), f({ yeux: 'heureux' })], echelle: 0.5, fx: effets.etincelles() },
      { duree: 0.3, images: [court], a: { cible: 10, n: dernier }, vitesse: 'vite' },
      ...posee(dernier),
      ...Array.from({ length: dernier }, (_, k) => posee(dernier - 1 - k, dernier - k)).flat(),
      // sur la dernière : il court sur place, elle roule sous lui, dans un sens puis dans l'autre
      ...roulades,
      { duree: 0.7, images: [f({ g: 'ciel', d: 'ciel', yeux: 'heureux' })], fx: effets.notes() },
      ...Array.from({ length: dernier }, (_, k) => posee(1 + k, k)).flat(),
      // il redescend de l'autre côté, loin d'elles, avant de reprendre sa taille
      { duree: 0.5, images: [bond.part, bond.haut, bond.haut], a: { cible: loin, n: dernier, h: 0 }, saut: 8, gestes: [{ n: dernier, dy: 0 }] },
      { duree: 0.2, images: [bond.recoit] },
      { duree: 0.8, images: [f({ g: 'haut', d: 'haut', yeux: 'heureux' }), f({ yeux: 'heureux' })], echelle: 1, fx: effets.etincelles() },
      { duree: 0.4, images: [miroir(court)], a: { coin: 0 }, vitesse: 'vite', mouvement: 'doux' },
      { duree: 0.6, images: [f({ yeux: 'heureux' })] },
    ]
  },
}

/**
 * Le géant : il grandit au bout de la rangée, deux fois sa taille. Il tape du
 * pied (les pastilles sursautent toutes ensemble, comme un tremblement de
 * terre), en chiquenaude une qui vole très haut en tournant, bombe le torse,
 * rapetisse et rentre.
 */
const geant: Numero = {
  quand: 'partout',
  besoin: 'au moins deux pastilles en bas de la bande (tâches, sous-agents, build)',
  cibles: els => {
    const bas = duBas(els).slice(-5)
    return bas.length >= 2 ? bas : undefined
  },
  pas: (c, { variante }) => {
    const dernier = c.length - 1
    // la chiquenaude : la plus proche de lui, ou (selon la partie) la plus loin, du bout du doigt
    const vole = choix(variante, 2) ? 0 : dernier
    // toutes à la fois, chacune à sa façon : la terre tremble
    const secousse = (haut: number): Geste[] => c.map((_, n) => ({ n, saut: haut + (n % 3), rot: n % 2 ? -360 : 360, mouvement: 'freine' as const }))
    return [
      { duree: 1.2, images: [f({ yeux: 'gauche' }), f({ yeux: 'clin' })], de: { coin: 0 } },
      // il ne se met pas les bras en l'air : à cette taille, ils sortiraient de la bande
      { duree: 1, images: [f({ g: 'haut', d: 'haut', yeux: 'grand' }), f({ yeux: 'grand', bouche: 'o' })], echelle: 2, fx: effets.etincelles() },
      { duree: 0.4, images: [court], a: { cible: 2 * CORPS.demiLargeur + 6, n: dernier }, vitesse: 'vite', mouvement: 'doux' },
      { duree: 0.7, images: [f({ jambes: 'tape', yeux: 'grand' }), f({ yeux: 'grand', bouche: 'o' })], gestes: secousse(6) },
      { duree: 0.7, images: [f({ jambes: 'tape', yeux: 'grand' }), f({ yeux: 'grand', bouche: 'o' })], gestes: secousse(10) },
      { duree: 0.6, images: [f({ g: 'tendu', yeux: 'gauche' })] },
      { duree: 1, images: [f({ g: 'tendu', yeux: 'heureux' })], gestes: [{ n: vole, saut: 38, rot: 720, mouvement: 'freine' }] },
      { duree: 1.2, images: [f({ yeux: 'heureux' }), f({ yeux: 'clin' })], fx: effets.notes() },
      { duree: 0.8, images: [f({ yeux: 'grand' }), f({ yeux: 'heureux' })], echelle: 1, fx: effets.etincelles() },
      { duree: 0.4, images: [miroir(court)], a: { coin: 0 }, vitesse: 'vite', mouvement: 'doux' },
      { duree: 0.6, images: [f({ yeux: 'heureux' })] },
    ]
  },
}

/** De combien un mini soulève sa pastille (px) : au bout de ses bras levés, au-dessus de sa tête */
const LEVE = 10

/**
 * L'équipe : chaque mini sort de sa case et court à sa pastille (celle de son
 * sous-agent, dans sa couleur), l'un après l'autre. Il la tapote (elle
 * tremble), se glisse dessous, la soulève au-dessus de sa tête, sautille avec,
 * la repose et rentre. Clawd les envoie du bras depuis son coin, puis les
 * encourage. Tiré deux fois plus souvent : c'est leur moment.
 */
const equipe: Numero = {
  quand: 'partout',
  poids: 2,
  avecMinis: true,
  besoin: 'une pastille de sous-agent au travail en bas de la bande',
  cibles: els => {
    const agents = agentsAuTravail(els)
    return agents.length ? agents : undefined
  },
  pas: () => [
    { duree: 0.8, images: [f({ d: 'tendu', yeux: 'gauche' }), f({ d: 'haut', yeux: 'gauche' })], de: { coin: 0 } },
    { duree: 1.2, images: [f({ d: 'haut', yeux: 'gauche' }), f({ yeux: 'clin' })], tours: 2 },
    { duree: 1.6, images: [f({ g: 'haut', d: 'haut', yeux: 'heureux' }), f({ yeux: 'heureux' })], tours: 4, fx: effets.notes() },
  ],
  // à leur taille, sans sa sueur ni son insigne ; la première pastille au mini le plus proche de lui
  copains: (c, { variante }) =>
    enPetit(() => {
      const court = profil('vite')
      const leve = f({ g: 'ciel', d: 'ciel', yeux: 'heureux' })
      return c.map((el, n): Copain => ({
        place: n,
        teinte: el.teinte,
        pas: [
          // chacun son tour
          { duree: 0.6 + 0.4 * n, images: [f({ yeux: 'gauche' }), f({ yeux: 'heureux' })], de: { coin: 0 } },
          { duree: 0.4, images: [court], a: { cible: el.largeur / 2 + Math.round(CORPS.demiLargeur * DEMI) + 2, n }, vitesse: 320, mouvement: 'doux' },
          { duree: 0.6, images: [f({ g: 'tendu', yeux: 'gauche' }), f({ yeux: 'gauche' })], gestes: [{ n, secoue: 1.2 }] },
          // chacun à sa façon (selon la partie) : il la soulève et sautille avec, ou il grimpe dessus et danse
          ...(choix(variante, 2, n + 1)
            ? [
                { duree: 0.5, images: [f({ jambes: 'replie', g: 'haut', d: 'haut' }), f({ g: 'ciel', d: 'ciel', yeux: 'heureux' })], a: { cible: 0, n, h: dessus(el) }, saut: 6 },
                { duree: 0.2, images: [f({ jambes: 'replie', dy: 3 })], gestes: [{ n, dy: -2 }] },
                { duree: 1.2, images: [f({ g: 'ciel', yeux: 'heureux' }), f({ d: 'ciel', yeux: 'heureux' })], tours: 3, rot: 360, fx: effets.notes() },
                { duree: 0.5, images: [f({ jambes: 'replie', g: 'haut', d: 'haut' }), f({ yeux: 'heureux' })], a: { cible: el.largeur / 2 + Math.round(CORPS.demiLargeur * DEMI) + 2, n, h: 0 }, saut: 6, gestes: [{ n, dy: 0 }] },
              ]
            : [
                { duree: 0.3, images: [court], a: { cible: 0, n } },
                { duree: 0.5, images: [leve], gestes: [{ n, dy: LEVE, mouvement: 'freine' as const }] },
                // elle bondit avec lui
                { duree: 0.5, images: [leve], saut: 5, gestes: [{ n, saut: 5 }] },
                { duree: 0.5, images: [leve], saut: 5, gestes: [{ n, saut: 5 }] },
                { duree: 0.4, images: [f({ g: 'haut', d: 'haut', yeux: 'heureux' })], gestes: [{ n, dy: 0, mouvement: 'elan' as const }] },
              ]),
          { duree: 0.4, images: [miroir(court)], a: { coin: 0 }, vitesse: 320, mouvement: 'doux' },
          { duree: 0.4, images: [f({ yeux: 'heureux' })] },
        ],
      }))
    }),
}

// ------------------------------------------------- ses minis entre eux

/** Le pas (px) entre deux cases de minis dans son coin : ils s'y tiennent déjà en rang */
const RANG = 19
/** La hauteur d'un mini debout (px) : celle où le suivant se tient sur sa tête */
const TETE_MINI = Math.round(CORPS.hauteur * DEMI)

/** Ses minis là, d'après les pastilles de leurs sous-agents au travail : au moins `n`, sinon rien */
const minisLa = (n: number) => (els: readonly ElementBande[]) => {
  const a = agentsAuTravail(els)
  return a.length >= n ? a : undefined
}
/** Clawd les regarde jouer depuis son coin (`duree` : le temps de leur jeu, avant qu'ils rentrent), et les encourage à la fin */
const spectateur = (duree: number): Pas[] => [
  { duree: 0.8, images: [f({ d: 'tendu', yeux: 'gauche' }), f({ d: 'haut', yeux: 'gauche' })], de: { coin: 0 } },
  { duree: Math.max(1, duree - 2.4), images: [f({ yeux: 'gauche' }), f({ yeux: 'clin' })], tours: 2 },
  { duree: 1.6, images: [f({ g: 'haut', d: 'haut', yeux: 'heureux' }), f({ yeux: 'heureux' })], tours: 4, fx: effets.notes() },
]

/**
 * Saute-mouton : ses minis, en rang devant leurs cases, sautent l'un
 * par-dessus les autres (celui de derrière passe devant), deux tours chacun,
 * puis rentrent en courant. Les autres font le dos rond quand on leur saute
 * dessus. Il les regarde, ravi.
 */
const mouton: Numero = {
  quand: 'partout',
  avecMinis: true,
  besoin: 'au moins deux sous-agents au travail (leurs pastilles en bas de la bande)',
  cibles: minisLa(2),
  pas: (c, { variante }) => spectateur(0.8 + toursMouton(variante) * c.length * 0.75),
  copains: (c, { variante }) =>
    enPetit(() => {
      const k = c.length
      const tours = toursMouton(variante)
      const dos = f({ jambes: 'replie', dy: 3, yeux: 'haut' })
      return c.map((el, i): Copain => {
        const pas: Pas[] = [{ duree: 0.8, images: [f({ yeux: 'gauche' }), f({ yeux: 'heureux' })], de: { coin: 0 } }]
        let fait = 0
        for (let t = 0; t < tours * k; t++) {
          if (t % k === i) {
            fait++
            pas.push(
              { duree: 0.55, images: [f({ jambes: 'replie', masse: 'etire', g: 'haut', d: 'haut' }), f({ g: 'ciel', d: 'ciel', yeux: 'heureux' })], a: { coin: -RANG * k * fait }, saut: 14 },
              { duree: 0.2, images: [f({ jambes: 'replie', dy: 3, yeux: 'heureux' })] },
            )
          } else pas.push({ duree: 0.75, images: [dos] })
        }
        pas.push({ duree: 0.4, images: [miroir(profil('vite'))], a: { coin: 0 }, vitesse: 320, mouvement: 'doux' }, { duree: 0.4, images: [f({ yeux: 'heureux' })] })
        return { place: i, teinte: el.teinte, pas }
      })
    }),
}

/** Combien de sauts chacun fait au saute-mouton : deux ou trois, selon la partie */
const toursMouton = (variante: number) => 2 + choix(variante, 2)

/**
 * La pyramide : trois minis. Les deux plus loin de lui se serrent, bras
 * levés ; le premier saute sur leurs têtes, salue (il tangue un peu), et
 * redescend d'un bond. Clawd applaudit.
 */
const pyramide: Numero = {
  quand: 'partout',
  avecMinis: true,
  besoin: 'trois sous-agents au travail (leurs pastilles en bas de la bande)',
  cibles: minisLa(3),
  pas: () => spectateur(6),
  copains: c =>
    enPetit(() => {
      // le sommet : au-dessus du milieu des deux autres (le 1 se rapproche du 2 de 2 px)
      const sommet = (coinCopain(1) - 2 + coinCopain(2)) / 2 - coinCopain(0)
      const porte = [f({ g: 'haut', d: 'haut', yeux: 'haut' }), f({ g: 'haut', d: 'haut', yeux: 'mi' })]
      const base = (i: number, glisse: number): Copain => ({
        place: i,
        teinte: c[i]!.teinte,
        pas: [
          { duree: 0.8, images: [f({ yeux: 'gauche' })], de: { coin: 0 } },
          { duree: 0.4, images: [f({ g: 'haut', d: 'haut', yeux: 'heureux' })], a: { coin: glisse } },
          { duree: 3.6, images: porte, tours: 6 },
          { duree: 0.4, images: [f({ yeux: 'heureux' })], a: { coin: 0 } },
          { duree: 0.8, images: [f({ g: 'haut', yeux: 'heureux' }), f({ d: 'haut', yeux: 'heureux' })], tours: 2 },
        ],
      })
      return [
        {
          place: 0,
          teinte: c[0]!.teinte,
          pas: [
            { duree: 0.8, images: [f({ yeux: 'gauche' })], de: { coin: 0 } },
            { duree: 0.4, images: [f({ jambes: 'replie', dy: 3, yeux: 'gauche' })] },
            { duree: 0.6, images: [f({ jambes: 'replie', masse: 'etire', g: 'haut', d: 'haut' }), f({ g: 'ciel', d: 'ciel', yeux: 'heureux' })], a: { coin: sommet, h: TETE_MINI }, saut: 10 },
            // tout en haut, il salue, et tangue
            { duree: 0.8, images: [f({ g: 'ciel', yeux: 'heureux' }), f({ d: 'ciel', yeux: 'heureux' })], tours: 2, rot: 8, fx: effets.etincelles() },
            { duree: 0.8, images: [f({ g: 'ciel', d: 'ciel', yeux: 'grand', bouche: 'o' })], rot: -8 },
            { duree: 0.6, images: [f({ g: 'ciel', d: 'ciel', yeux: 'heureux' })], rot: 0 },
            { duree: 0.6, images: [f({ jambes: 'replie', masse: 'etire', g: 'haut', d: 'haut' }), f({ g: 'ciel', d: 'ciel', yeux: 'heureux' })], a: { coin: 0, h: 0 }, saut: 8 },
            { duree: 0.2, images: [f({ jambes: 'replie', dy: 3 })] },
            { duree: 1, images: [f({ yeux: 'heureux' })] },
          ],
        },
        base(1, -2),
        base(2, 0),
      ]
    }),
}

/**
 * La passe : deux minis courent à la pastille du premier. Il la soulève et
 * la lance à l'autre, qui la rattrape bras levés et la renvoie, en cloche,
 * deux ou trois fois ; puis il la repose et tous deux rentrent. Leurs
 * trajets ont la même durée : ils arrivent ensemble.
 */
const passe: Numero = {
  quand: 'partout',
  avecMinis: true,
  besoin: 'au moins deux sous-agents au travail (leurs pastilles en bas de la bande)',
  cibles: minisLa(2),
  pas: (c, partie) => spectateur(jeuDePasse(c, partie).duree),
  copains: (c, partie) =>
    enPetit(() => {
      const { ecart, vers, aller, bouge, lancers } = jeuDePasse(c, partie)
      const pret = f({ g: 'haut', d: 'haut', yeux: 'gauche' })
      const leve = f({ g: 'ciel', d: 'ciel', yeux: 'heureux' })
      const lance = f({ g: 'tendu', d: 'haut', yeux: 'heureux' })
      // un lancer de 0,7 s, puis 0,4 s où l'autre la tient : qui lance, qui attrape
      const echange = (moi: number) =>
        Array.from({ length: lancers }, (_, l): Pas[] => {
          const deLui = l % 2 === 0
          const geste = (g: Geste): Geste[] => (moi === 0 ? [g] : [])
          return [
            { duree: 0.7, images: [(deLui ? moi === 0 : moi === 1) ? lance : pret], gestes: geste({ n: 0, dx: deLui ? ecart : 0, saut: 14, rot: deLui ? 360 : -360 }) },
            { duree: 0.4, images: [(deLui ? moi === 1 : moi === 0) ? leve : f({ yeux: 'heureux' })] },
          ]
        }).flat()
      // un nombre impair de lancers la laisse chez l'autre : elle revient d'un dernier lancer
      const dernier = lancers % 2 ? (moi: number): Pas[] => [{ duree: 0.7, images: [moi === 1 ? lance : pret], gestes: moi === 0 ? [{ n: 0, dx: 0, saut: 14, rot: -360 }] : [] }] : () => []
      return [0, 1].map(
        (i): Copain => ({
          place: i,
          teinte: c[i]!.teinte,
          pas: [
            { duree: 0.6, images: [f({ yeux: 'gauche' }), f({ yeux: 'heureux' })], de: { coin: 0 } },
            { duree: aller, images: [profil('vite')], a: { x: vers[i]! } },
            // (celui qui n'a presque pas à marcher n'a ni élan ni freinage : il les attend, pour arriver en même temps)
            ...(bouge[i] ? [] : [{ duree: 2 * TRANSITION, images: [pret] }]),
            { duree: 0.5, images: [i === 0 ? leve : pret], gestes: i === 0 ? [{ n: 0, dy: LEVE, mouvement: 'freine' }] : [] },
            ...echange(i),
            ...dernier(i),
            { duree: 0.4, images: [f({ g: 'haut', d: 'haut', yeux: 'heureux' })], gestes: i === 0 ? [{ n: 0, dy: 0, mouvement: 'elan' }] : [] },
            { duree: 0.4, images: [miroir(profil('vite'))], a: { coin: 0 }, vitesse: 320, mouvement: 'doux' },
            { duree: 0.4, images: [f({ yeux: 'heureux' })] },
          ],
        }),
      )
    }),
}

/**
 * La passe sur cette bande : l'écart entre les deux minis (px), où chacun se
 * tient (le bord gauche de sa boîte : le premier sous sa pastille, l'autre à
 * sa droite), la durée de leur trajet (la même pour les deux), s'il marche
 * vraiment (assez loin pour son élan et son freinage), le nombre de lancers,
 * et la durée de leur jeu avant de rentrer.
 */
function jeuDePasse(c: readonly ElementBande[], { largeur, variante }: Partie) {
  const ecart = 34
  const vers = [centre(c[0]!).x - AXE, centre(c[0]!).x - AXE + ecart]
  const distances = [0, 1].map(i => Math.abs(vers[i]! - (largeur - TAILLE.largeur + coinCopain(i))))
  const aller = arrondi(Math.max(0.4, ...distances.map(d => d / 160)), 2)
  const lancers = 2 + choix(variante, 2)
  return { ecart, vers, aller, bouge: distances.map(d => d > 3), lancers, duree: 0.6 + aller + 2 * TRANSITION + 0.5 + lancers * 1.1 + (lancers % 2 ? 0.7 : 0) + 0.4 }
}

// ------------------------------------------------- ses réactions

/** L'élément visé par une réaction (`vise`), s'il est encore comme il faut ; sinon (à la demande) le premier qui convient */
const vu = (els: readonly ElementBande[], vise: string | undefined, ok: (e: ElementBande) => boolean) => {
  const el = vise ? els.find(e => e.id === vise) : els.find(ok)
  return el && ok(el) ? [el] : undefined
}
/** Sa place à côté d'un élément de sa hauteur : contre son bord droit */
const aCote = (el: ElementBande, jeu = 6) => el.largeur / 2 + CORPS.demiLargeur + jeu

/** Une étape vient d'être faite (sa coche verte) : il court la féliciter ; elle saute de joie, il lance des confettis. */
const bravo: Numero = {
  quand: 'demande',
  besoin: 'une étape faite (coche verte) en bas de la bande',
  cibles: (els, { vise }) => vu(els, vise, e => e.genre === 'tache' && e.etat === 'faite' && e.ligne === 0),
  pas: ([el], { variante }) => [
    { duree: 0.6, images: [f({ yeux: 'gauche', bouche: 'o' })], de: { coin: 0 } },
    { duree: 0.4, images: [court], a: { cible: aCote(el!) }, vitesse: 'vite', mouvement: 'doux' },
    { duree: 0.6, images: [f({ g: 'tendu', yeux: 'gauche' })], gestes: [{ saut: 14, rot: 360, mouvement: 'freine' }] },
    ...(choix(variante, 2)
      ? [
          { duree: 0.5, images: [bond.part, bond.haut], saut: 12 },
          { duree: 0.2, images: [bond.recoit] },
        ]
      : []),
    { duree: 1.2, images: [f({ g: 'ciel', d: 'ciel', yeux: 'heureux' }), f({ g: 'haut', d: 'haut', yeux: 'heureux' })], tours: 3, fx: effets.confettis() },
    { duree: 0.4, images: [miroir(court)], a: { coin: 0 }, vitesse: 'vite', mouvement: 'doux' },
    { duree: 0.4, images: [f({ yeux: 'heureux' })] },
  ],
}

/**
 * Le build vient d'échouer (sa pastille rouge) : il accourt, la regarde de
 * près, tape dessus (elle tremble), se gratte la tête, essaie encore (ou lui
 * donne un coup de pied : elle saute), puis hausse les épaules et rentre.
 */
const repare: Numero = {
  quand: 'demande',
  besoin: 'un build raté (pastille rouge) en bas de la bande',
  cibles: (els, { vise }) => vu(els, vise, e => e.genre === 'build' && e.etat === 'echec' && e.ligne === 0),
  pas: ([el], { variante }) => [
    { duree: 0.6, images: [f({ yeux: 'gauche', bouche: 'o' })], de: { coin: 0 } },
    { duree: 0.4, images: [court], a: { cible: aCote(el!, 2) }, vitesse: 'vite', mouvement: 'doux' },
    { duree: 0.8, images: [f({ yeux: 'bas' }), f({ yeux: 'bas', bouche: 'o' })] },
    { duree: 0.45, images: [f({ g: 'tendu', yeux: 'gauche' })], gestes: [{ secoue: 2 }] },
    { duree: 0.45, images: [f({ g: 'tendu', yeux: 'gauche' })], gestes: [{ secoue: 2 }] },
    { duree: 1, images: [f({ g: 'tete', yeux: 'mi' }), f({ g: 'tete', yeux: 'haut' })], fx: effets.sueur() },
    choix(variante, 2)
      ? { duree: 0.7, images: [f({ jambes: 'tape', yeux: 'croix' })], gestes: [{ saut: 10, rot: 360, mouvement: 'freine' }] }
      : { duree: 0.7, images: [f({ g: 'tendu', yeux: 'grand' })], gestes: [{ secoue: 3 }] },
    { duree: 1, images: [f({ g: 'haut', d: 'haut', yeux: 'mi' }), f({ g: 'bas', d: 'bas', yeux: 'mi' })], tours: 2 },
    { duree: 0.4, images: [miroir(court)], a: { coin: 0 }, vitesse: 'vite', mouvement: 'doux' },
    { duree: 0.4, images: [f({ yeux: 'mi' })] },
  ],
}

/**
 * Un quota vient de passer au rouge : il court dessous (ou contre lui, à sa
 * hauteur) et s'arc-boute pour le retenir, en sueur ; la jauge tremble et
 * revient, il s'essuie le front et rentre.
 */
const retient: Numero = {
  quand: 'demande',
  besoin: 'une jauge de quota au rouge sur la bande, au plus sur la deuxième ligne',
  cibles: (els, { vise }) => vu(els, vise, e => e.genre === 'jauge' && e.etat === 'critique' && e.ligne <= 1),
  pas: ([el]) => {
    const dessous = el!.ligne >= 1
    const ici: Lieu = dessous ? { cible: Math.min(el!.largeur / 2 - CORPS.demiLargeur, 30) } : { cible: aCote(el!, 0) }
    return [
      { duree: 0.6, images: [f({ yeux: 'haut', bouche: 'o' })], de: { coin: 0 } },
      { duree: 0.4, images: [court], a: ici, vitesse: 'vite', mouvement: 'doux' },
      dessous
        ? { duree: 1.6, images: [f({ g: 'ciel', d: 'ciel', yeux: 'croix' }), f({ g: 'ciel', d: 'ciel', yeux: 'mi', bouche: 'o' })], tours: 3, gestes: [{ dy: 3, secoue: 1.5 }], fx: effets.sueur() }
        : { duree: 1.6, images: [f({ g: 'tendu', d: 'tendu', yeux: 'croix' }), f({ g: 'tendu', d: 'tendu', yeux: 'mi', bouche: 'o' })], tours: 3, gestes: [{ dx: -4, secoue: 1.5 }], fx: effets.sueur() },
      { duree: 0.5, images: [f({ yeux: 'grand' })], gestes: [{ dx: 0, dy: 0, mouvement: 'doux' }] },
      { duree: 1, images: [f({ g: 'tete', yeux: 'ferme' }), f({ g: 'tete', yeux: 'mi' })] },
      { duree: 0.4, images: [miroir(court)], a: { coin: 0 }, vitesse: 'vite', mouvement: 'doux' },
      { duree: 0.4, images: [f({ yeux: 'mi' })] },
    ]
  },
}

/**
 * Un sous-agent vient de finir (sa pastille cochée, dans sa couleur) : une
 * fois que son mini lui a rendu son rapport dans le coin, il va contrôler le
 * travail sur la bande. Il prend la pastille, l'examine de près, la brandit,
 * satisfait, la repose et rentre.
 */
const controle: Numero = {
  quand: 'demande',
  besoin: 'un sous-agent fini (pastille cochée) en bas de la bande',
  cibles: (els, { vise }) => vu(els, vise, e => e.genre === 'agent' && e.etat === 'faite' && e.ligne === 0),
  pas: () => [
    { duree: 0.6, images: [f({ yeux: 'gauche' })], de: { coin: 0 } },
    { duree: 0.4, images: [court], a: { cible: 0 }, vitesse: 'vite', mouvement: 'doux' },
    { duree: 0.6, images: [f({ yeux: 'bas', g: 'tendu' })] },
    { duree: 1.4, images: [f({ g: 'devant', d: 'devant', yeux: 'bas' }), f({ g: 'devant', d: 'devant', yeux: 'mi' })], tours: 2, objet: 'tenu' },
    { duree: 1.2, images: [f({ g: 'haut', d: 'haut', yeux: 'heureux' })], objet: 'haut', fx: effets.etincelles() },
    { duree: 0.6, images: [f({ g: 'devant', d: 'devant', yeux: 'heureux' })], objet: 'tenu' },
    { duree: 0.6, images: [f({ yeux: 'clin' })], fx: effets.notes() },
    { duree: 0.4, images: [miroir(court)], a: { coin: 0 }, vitesse: 'vite', mouvement: 'doux' },
    { duree: 0.4, images: [f({ yeux: 'heureux' })] },
  ],
}

// ------------------------------------------------- quand il s'ennuie

/**
 * Le funambule : il grimpe sur le bout d'une jauge et marche dessus, bras en
 * balancier, en tanguant ; au bout, il saute à terre et rentre.
 */
const funambule: Numero = {
  quand: 'repos',
  besoin: 'une jauge de quota assez longue, au plus sur la deuxième ligne',
  cibles: els => {
    // (assez loin du bord gauche pour sauter à terre de ce côté sans sortir du dessin)
    const j = els.filter(e => e.genre === 'jauge' && e.ligne <= 1 && e.largeur >= 60 && e.x >= 2 * CORPS.demiLargeur + 6).sort((a, b) => b.x - a.x)[0]
    return j ? [j] : undefined
  },
  pas: ([el]) => {
    const h = dessus(el!)
    const bout = el!.largeur / 2 - CORPS.demiLargeur
    const loin = aCote(el!, 10)
    return [
      { duree: 1, images: [f({ yeux: 'gauche' }), f({ yeux: 'haut' })], de: { coin: 0 } },
      { duree: 0.4, images: [court], a: { cible: loin }, vitesse: 'vite', mouvement: 'doux' },
      { duree: 0.3, images: [f({ jambes: 'replie', dy: 3, yeux: 'haut' })] },
      { duree: 0.6, images: [bond.part, bond.haut], a: { cible: bout, h }, saut: 10 },
      { duree: 0.2, images: [bond.recoit] },
      // en équilibre : il avance en tanguant d'un côté puis de l'autre
      { duree: 1, images: [pousse], a: { cible: bout / 3, h }, rot: 7 },
      { duree: 1, images: [pousse], a: { cible: -bout / 3, h }, rot: -7 },
      { duree: 1, images: [pousse], a: { cible: -bout, h }, rot: 4 },
      { duree: 0.6, images: [f({ g: 'tendu', d: 'tendu', yeux: 'grand', bouche: 'o' })], rot: -9 },
      { duree: 0.5, images: [f({ g: 'ciel', d: 'ciel', yeux: 'heureux' })], rot: 0, fx: effets.etincelles() },
      { duree: 0.6, images: [bond.part, bond.haut], a: { cible: -aCote(el!, 6), h: 0 }, saut: 8 },
      { duree: 0.2, images: [bond.recoit] },
      { duree: 0.4, images: [miroir(court)], a: { coin: 0 }, vitesse: 'vite', mouvement: 'doux' },
      { duree: 0.4, images: [f({ yeux: 'heureux' })] },
    ]
  },
}

/**
 * La sieste : il s'assoit sur la pastille la plus proche, balance les
 * pattes, bâille, pique du nez (quelques z), se réveille en sursaut et rentre
 * en vitesse.
 */
const sieste: Numero = {
  quand: 'repos',
  besoin: 'une pastille en bas de la bande',
  cibles: els => {
    const p = duBas(els).at(-1)
    return p ? [p] : undefined
  },
  pas: ([el]) => {
    const h = dessus(el!) - 4
    return [
      { duree: 1, images: [f({ yeux: 'gauche' }), f({ yeux: 'mi' })], de: { coin: 0 } },
      { duree: 0.4, images: [profil('lent')], a: { cible: aCote(el!, 4) }, vitesse: 'lent' },
      { duree: 0.6, images: [bond.part, bond.haut], a: { cible: 0, h }, saut: 6 },
      { duree: 0.3, images: [f({ jambes: 'assis', yeux: 'heureux' })], gestes: [{ dy: -2 }] },
      { duree: 1.6, images: [f({ jambes: 'assis', yeux: 'mi' }), f({ jambes: 'assis2', yeux: 'mi' })], tours: 4 },
      { duree: 0.8, images: [f({ jambes: 'assis', yeux: 'ferme', bouche: 'grand' })] },
      // (des bulles en pixels, pas des z : sur la bande, pas un mot)
      { duree: 2.4, images: [f({ jambes: 'assis', yeux: 'ferme', dy: 2 })], fx: effets.bulles() },
      { duree: 0.4, images: [f({ jambes: 'assis', yeux: 'grand', bouche: 'o' })], saut: 6 },
      { duree: 0.5, images: [bond.part, bond.haut], a: { cible: aCote(el!, 4), h: 0 }, saut: 8, gestes: [{ dy: 0 }] },
      { duree: 0.2, images: [bond.recoit] },
      { duree: 0.4, images: [miroir(court)], a: { coin: 0 }, vitesse: 'vite', mouvement: 'doux' },
      { duree: 0.4, images: [f({ yeux: 'heureux' })] },
    ]
  },
}

/** Les pastilles de ses sous-agents au travail (une par mini, les premières : son coin montre ses trois premiers minis) */
const agentsAuTravail = (els: readonly ElementBande[]) => duBas(els).filter(e => e.genre === 'agent' && e.etat === 'encours').slice(0, MINIS_MAX)

/**
 * L'inspection, pendant que Claude travaille : il pose ses cartons et fait le
 * tour des quotas comme un contremaître, de droite à gauche. Il tapote
 * chacun (à bout de bras, ou d'un petit bond quand c'est au-dessus de sa
 * tête) ; le dernier sursaute. Satisfait, il retourne à ses cartons.
 */
const inspection: Numero = {
  quand: 'travail',
  besoin: 'les jauges des quotas sur la bande',
  cibles: els => {
    const q = els.filter(estQuota).sort((a, b) => b.x - a.x).slice(0, 3)
    return q.length ? q : undefined
  },
  pas: c => [
    { duree: 0.8, images: [f({ yeux: 'gauche' }), f({ yeux: 'clin' })], de: { coin: 0 } },
    ...c.flatMap((el, n): Pas[] => {
      const dernier = n === c.length - 1
      // à sa hauteur, il se tient contre son bord droit ; au-dessus de sa tête, juste dessous
      const ici: Lieu = el.ligne >= 1 ? { cible: 0, n } : { cible: el.largeur / 2 + CORPS.demiLargeur + 2, n }
      const tape: Pas[] =
        el.ligne >= 1
          ? [
              { duree: 0.25, images: [bond.part], a: { ...ici, h: 5 }, mouvement: 'freine', gestes: [{ n, dy: dernier ? 8 : 3, mouvement: 'freine', secoue: dernier ? 0 : 1 }] },
              { duree: 0.25, images: [bond.haut], a: ici, mouvement: 'elan', gestes: [{ n, dy: 0, mouvement: 'elan' }] },
            ]
          : [{ duree: 0.5, images: [f({ g: 'tendu', yeux: 'gauche' }), f({ yeux: 'gauche' })], gestes: [{ n, secoue: dernier ? 3 : 1.2, ...(dernier ? { saut: 6 } : {}) }] }]
      return [
        { duree: 0.4, images: [court], a: ici, vitesse: 'vite', mouvement: 'doux' },
        { duree: 0.4, images: [f({ yeux: 'haut' })] },
        ...tape,
        { duree: dernier ? 0.9 : 0.4, images: dernier ? [f({ yeux: 'grand', bouche: 'o' }), f({ yeux: 'heureux' })] : [f({ yeux: 'heureux' })] },
      ]
    }),
    { duree: 0.6, images: [f({ g: 'haut', yeux: 'heureux' })], fx: effets.notes() },
    { duree: 0.4, images: [miroir(court)], a: { coin: 0 }, vitesse: 'vite', mouvement: 'doux' },
    { duree: 0.4, images: [f()] },
  ],
}

/**
 * Le rappel : continuer la conversation coûte trop (atelier publie toujours la
 * place de son bouton « 🆕 New », qui ne bouge jamais : au bout de la ligne
 * git, sinon des jauges ; `a-montrer` quand il est temps, `repos` sinon). Il
 * va à la jauge du contexte et tape dessus
 * (elle tremble, il grimace : c'est plein), puis court au bouton et te le
 * montre du bras en sautillant, avant de rentrer. Il ne touche pas le bouton
 * (le vrai reste là, cliquable). Joué quand il est temps (register.tsx), pas
 * tiré au hasard.
 */
const rappel: Numero = {
  quand: 'demande',
  besoin: 'le bouton « 🆕 New » à montrer sur la bande (atelier le dit quand il est temps de changer de conversation), au plus sur la troisième ligne depuis le bas',
  cibles: els => {
    // plus haut que la troisième ligne, il ne l'atteindrait pas, même en sautant (son dessin fait 64 px de haut) ; au repos, rien à montrer
    const bouton = els.find(e => e.genre === 'bouton' && e.id === 'nouvelle' && e.etat === 'a-montrer' && e.ligne <= 2)
    if (!bouton) return undefined
    const jauge = els.find(e => e.id === 'jauge-contexte')
    return jauge ? [bouton, jauge] : [bouton]
  },
  pas: ([bouton, jauge]) => {
    const b = bouton!
    // à côté de ce qu'il vise : dessous quand c'est au-dessus de sa tête, contre son bord gauche sinon (le bouton est à sa droite)
    const pres = (el: ElementBande, n: number, dessous: number): Lieu => (el.ligne >= 1 ? { cible: dessous, n } : { cible: -el.largeur / 2 - CORPS.demiLargeur - 2, n })
    const surLaJauge: Pas[] = jauge
      ? [
          { duree: 0.4, images: [court], a: pres(jauge, 1, 0), vitesse: 'vite', mouvement: 'doux' },
          { duree: 0.6, images: [f({ yeux: 'haut' }), f({ yeux: 'haut', bouche: 'o' })] },
          // il tape dessus : elle tremble, pleine à craquer
          ...(jauge.ligne >= 1
            ? [
                { duree: 0.25, images: [bond.part], a: { ...pres(jauge, 1, 0), h: 5 }, mouvement: 'freine' as const, gestes: [{ n: 1, dy: 4, secoue: 2, mouvement: 'freine' as const }] },
                { duree: 0.25, images: [bond.haut], a: pres(jauge, 1, 0), mouvement: 'elan' as const, gestes: [{ n: 1, dy: 0, mouvement: 'elan' as const }] },
              ]
            : [{ duree: 0.5, images: [f({ d: 'tendu', yeux: 'droite' }), f({ yeux: 'droite' })], gestes: [{ n: 1, secoue: 2 }] }]),
          // il grimace : c'est plein
          { duree: 0.8, images: [f({ yeux: 'croix' }), f({ yeux: 'mi', bouche: 'o' })] },
        ]
      : []
    // il court vers le bouton dans le bon sens : depuis la jauge, selon qu'il est à sa droite ou à sa gauche ; depuis son coin, vers la gauche
    const versLeBouton = jauge && b.x > jauge.x ? miroir(court) : court
    // il ne cache jamais ce qu'il montre : il se tient juste à sa gauche (sur la ligne des jauges, sa tête est à
    // sa hauteur ; sur celle des pastilles, son corps) et le désigne du bras tendu ; sur la ligne git, au-dessus
    // de sa tête, il se met sous son bord gauche, lève le bras vers lui, les yeux en l'air, et saute plus haut
    const haut = b.ligne >= 2
    const ici: Lieu = { cible: haut ? -b.largeur / 2 + 4 : -b.largeur / 2 - CORPS.demiLargeur - 4, n: 0 }
    const montre = haut ? [f({ d: 'ciel', yeux: 'haut' }), f({ d: 'haut', yeux: 'heureux' })] : [f({ d: 'tendu', yeux: 'droite' }), f({ d: 'tendu', yeux: 'heureux' })]
    const saut = haut ? 16 : 10
    return [
      { duree: 0.8, images: [f({ yeux: 'gauche' }), f({ yeux: 'clin' })], de: { coin: 0 } },
      ...surLaJauge,
      { duree: 0.5, images: [versLeBouton], a: ici, vitesse: 'vite', mouvement: 'doux' },
      // « là ! » : il le montre, sautille, et le remontre
      { duree: 1.2, images: montre, tours: 3 },
      { duree: 0.45, images: [bond.part, bond.haut], saut, fx: effets.etincelles() },
      { duree: 0.2, images: [bond.recoit] },
      { duree: 0.45, images: [bond.part, bond.haut], saut },
      { duree: 0.2, images: [bond.recoit] },
      { duree: 1.2, images: montre, tours: 3, fx: effets.notes() },
      { duree: 0.4, images: [miroir(court)], a: { coin: 0 }, vitesse: 'vite', mouvement: 'doux' },
      { duree: 0.4, images: [f()] },
    ]
  },
}

/**
 * Le cadre, pour vérifier la grande scène sur une capture (/clawd montre
 * cadre) : les cadres de repérage autour de ce qu'atelier dessine, une règle
 * graduée tous les 50 px, et Clawd à son coin, qui fait coucou.
 */
const cadre: Numero = {
  quand: 'demande',
  pas: () => [{ duree: 20, images: [f({ g: 'haut', yeux: 'heureux' }), f({ g: 'ciel', yeux: 'heureux' })], tours: 20, de: { coin: 0 }, repere: true }],
}

/**
 * « Installer » : un nouvel APK attend d'être installé (atelier publie le
 * bouton Installer de sa ligne 📱, `a-montrer` quand il est jaune). La ligne
 * 📱 est en haut de la bande, hors de sa portée (sa scène n'en couvre que le
 * bas) : il court se mettre dessous, lève le bras vers lui les yeux en l'air,
 * saute, le remontre, et rentre. Il ne touche pas le bouton (le vrai reste là,
 * cliquable). Joué quand le bouton passe au jaune (register.tsx), pas tiré au
 * hasard.
 */
const installe: Numero = {
  quand: 'demande',
  besoin: 'le bouton « Installer » à montrer sur la bande (atelier le dit quand un nouvel APK attend d’être installé)',
  cibles: els => {
    const bouton = els.find(e => e.genre === 'bouton' && e.id === 'installer' && e.etat === 'a-montrer')
    return bouton ? [bouton] : undefined
  },
  pas: () => {
    // juste dessous, centré : il le désigne bras levé
    const montre = [f({ d: 'ciel', yeux: 'haut' }), f({ d: 'haut', yeux: 'heureux' })]
    return [
      { duree: 0.8, images: [f({ yeux: 'haut' }), f({ yeux: 'clin' })], de: { coin: 0 } },
      { duree: 0.5, images: [court], a: { cible: 0, n: 0 }, vitesse: 'vite', mouvement: 'doux' },
      { duree: 1.2, images: montre, tours: 3 },
      { duree: 0.45, images: [bond.part, bond.haut], saut: 16, fx: effets.etincelles() },
      { duree: 0.2, images: [bond.recoit] },
      { duree: 1.2, images: montre, tours: 3, fx: effets.notes() },
      { duree: 0.4, images: [miroir(court)], a: { coin: 0 }, vitesse: 'vite', mouvement: 'doux' },
      { duree: 0.4, images: [f()] },
    ]
  },
}

export const NUMEROS: Record<string, Numero> = { chipe, tournee, bousculade, popcorn, echange, lilliput, geant, funambule, sieste, equipe, mouton, pyramide, passe, bravo, repare, retient, controle, inspection, rappel, installe, cadre }

export const estNumero = (nom: unknown): nom is string => typeof nom === 'string' && Object.hasOwn(NUMEROS, nom)

/** Les jeux de ses minis qu'ils peuvent jouer maintenant, d'après les pastilles de leurs sous-agents */
export function numerosAvecMinis(elements: readonly ElementBande[], largeur = LARGEUR_BANDE): string[] {
  return Object.entries(NUMEROS)
    .filter(([nom, n]) => n.avecMinis && prepareNumero(nom, elements, largeur) !== null)
    .map(([nom]) => nom)
}

/** Les numéros qu'il peut jouer de lui-même maintenant, d'après ce qu'il y a sur la bande */
export function numerosJouables(moment: 'repos' | 'travail', elements: readonly ElementBande[], largeur = LARGEUR_BANDE): string[] {
  return Object.entries(NUMEROS)
    .filter(([nom, n]) => (n.quand === 'partout' || n.quand === moment) && !n.avecMinis && prepareNumero(nom, elements, largeur) !== null)
    .map(([nom]) => nom)
}

// ------------------------------------------------------------- le mouvement

/**
 * Les courbes, en CSS : `elan` et `freine` sont les quadratiques exactes. Une
 * chute libre accélère comme `elan`, un bond qui monte ralentit comme
 * `freine` : un saut en parabole, c'est `freine` jusqu'en haut, puis `elan`.
 */
const COURBE: Record<Mouvement, string> = {
  lineaire: 'linear',
  doux: 'cubic-bezier(.45,0,.55,1)',
  elan: 'cubic-bezier(.55,.085,.68,.53)',
  freine: 'cubic-bezier(.25,.46,.45,.94)',
}
/** Les mêmes courbes, en nombres : pour suivre une secousse pas à pas */
const LISSE: Record<Mouvement, (u: number) => number> = {
  lineaire: u => u,
  doux: u => u * u * (3 - 2 * u),
  elan: u => u * u,
  freine: u => 1 - (1 - u) * (1 - u),
}
const lerp = (a: number, b: number, e: number) => a + (b - a) * e
const arrondi = (v: number, k = 2) => +v.toFixed(k)

/** Une abscisse : une part de la largeur de la bande plus des px (son coin est à 100 % - 116 px) */
type X = { pct: number; px: number }
const ecrisX = (x: X) => (Math.abs(x.pct) < 1e-6 ? `${arrondi(x.px, 1)}px` : `calc(${arrondi(x.pct * 100, 3)}% + ${arrondi(x.px, 1)}px)`)

/** L'état d'une de ses cibles : son décalage, son inclinaison, sa taille, son opacité */
type EtatEl = { dx: number; dy: number; r: number; s: number; o: number }
const REPOS: EtatEl = { dx: 0, dy: 0, r: 0, s: 1, o: 1 }
const auRepos = (e: EtatEl) => Math.abs(e.dx) < 0.01 && Math.abs(e.dy) < 0.01 && Math.abs(e.r % 360) < 0.01 && Math.abs(e.s - 1) < 0.001 && Math.abs(e.o - 1) < 0.001
const tourComplet = (r: number) => r !== 0 && Math.abs(r % 360) < 0.01

function xDe(l: Lieu, cibles: readonly ElementBande[], depart = 0): X | null {
  if ('coin' in l) return { pct: 1, px: l.coin + depart - TAILLE.largeur }
  if ('x' in l) return { pct: 0, px: l.x }
  const c = cibles[l.n ?? 0]
  return c ? { pct: 0, px: centre(c).x - AXE + l.cible } : null
}

/**
 * Une piste d'animation : une propriété (son déplacement horizontal, sa
 * hauteur, son bond, sa taille…), sa valeur au départ, et ses images clés,
 * seulement là où elle change. Chaque image clé porte la courbe jusqu'à la
 * suivante.
 */
type Cle = { t: number; v: string; c?: string }
type Piste = { depart: string; cles: Cle[] }
const piste = (depart: string): Piste => ({ depart, cles: [] })
const actuelle = (p: Piste) => p.cles.at(-1)?.v ?? p.depart
/** Juste avant la fin d'un pas : la valeur suivante peut repartir d'ailleurs sans glisser */
const finDe = (t0: number, t1: number) => t1 - Math.min(0.01, (t1 - t0) / 4)

/** La piste prend la valeur `v` à l'instant `t` (et la tient jusque-là) */
function pose(p: Piste, t: number, v: string, c?: string) {
  const der = p.cles.at(-1)
  const avant = actuelle(p)
  // elle tenait sa valeur jusqu'ici : sans cette image clé, elle glisserait vers la nouvelle depuis la précédente
  if (v !== avant && (!der || der.t < t - 0.006)) p.cles.push({ t: Math.max(0, t - 0.005), v: avant, c: 'steps(1,end)' })
  p.cles.push({ t, v, ...(c && c !== 'linear' ? { c } : {}) })
}

/** La piste va de `de` à `a` pendant [t0, t1], selon la courbe */
function va(p: Piste, t0: number, t1: number, de: string, a: string, c = 'linear') {
  if (de === a) {
    if (de !== actuelle(p)) pose(p, t0, de)
    return
  }
  pose(p, t0, de, c)
  p.cles.push({ t: finDe(t0, t1), v: a })
}

/** Un bond en parabole sur une piste : `haut` au milieu du pas, `bas` aux deux bouts */
function bondit(p: Piste, t0: number, t1: number, bas: string, haut: string) {
  pose(p, t0, bas, COURBE.freine)
  p.cles.push({ t: (t0 + t1) / 2, v: haut, c: COURBE.elan }, { t: finDe(t0, t1), v: bas })
}

const tx = (x: X) => `translateX(${ecrisX(x)})`
const ty = (h: number) => `translateY(${arrondi(-h, 1)}px)`
/** Sa taille autour de ses pieds, son inclinaison autour du milieu de son corps (un salto tourne autour de lui) */
const tr = (s: number, r: number) => `scale(${arrondi(s, 3)}) translateY(${-CORPS.hauteur / 2}px) rotate(${arrondi(r, 1)}deg) translateY(${CORPS.hauteur / 2}px)`
const trEl = (s: number, r: number) => `rotate(${arrondi(r, 1)}deg) scale(${arrondi(s, 3)})`
/** Son ombre, d'autant plus petite qu'il est haut */
const reduit = (saut: number) => `scaleX(${arrondi(Math.max(0.35, 1 - saut / 40), 3)})`

/** Ses pistes : où il est (x), à quelle hauteur il est posé (sol), son bond (arc), sa taille et son inclinaison ; son ombre suit */
type Lui = { x: Piste; sol: Piste; arc: Piste; tr: Piste; ombreTaille: Piste; ombreArc: Piste }
/** Les pistes d'une cible : son décalage (dx, dy), son bond, sa taille et son inclinaison, son opacité */
type PistesEl = { dx: Piste; dy: Piste; arc: Piste; tr: Piste; o: Piste }

/**
 * Un acteur de la grande scène : lui (le premier), ou un de ses minis. Chacun
 * part de son coin (`depart` px depuis celui de Clawd ; la case d'un mini,
 * voir `coinCopain`), à sa taille `s0`, et y revient à la fin.
 */
type Acteur = { pas: readonly Pas[]; depart: number; s0: number }

/**
 * Leurs trajets et ceux de leurs cibles, pas à pas, en pistes d'animation.
 * Null si un pas vise une cible absente, si deux acteurs touchent la même
 * cible, si un acteur ne revient pas à son coin, à sa taille, ou s'il laisse
 * une cible ailleurs qu'à sa place à la fin du dernier pas qui la touche (il
 * remet tout en place). Seul Clawd porte ce qu'il prend (`objet`).
 */
function trajets(acteurs: readonly Acteur[], cibles: readonly ElementBande[]) {
  const els: PistesEl[] = cibles.map(() => ({ dx: piste('translateX(0px)'), dy: piste(ty(0)), arc: piste(ty(0)), tr: piste(trEl(1, 0)), o: piste('1') }))
  const tenue = cibles.map(() => [] as [number, number][])
  const devant = cibles.map(() => [] as [number, number][])
  const touchee = cibles.map(() => [] as [number, number][])
  const etats = cibles.map(() => ({ ...REPOS }))
  // (les pistes d'une cible se suivent dans le temps : un seul acteur peut la toucher)
  const qui = cibles.map(() => -1)
  const prend = (n: number, k: number) => {
    if (qui[n] !== -1 && qui[n] !== k) return false
    qui[n] = k
    return true
  }
  const luis: Lui[] = []
  let duree = 0
  for (const [k, { pas, depart, s0 }] of acteurs.entries()) {
    const coin: X = { pct: 1, px: depart - TAILLE.largeur }
    const lui: Lui = { x: piste(tx(coin)), sol: piste(ty(0)), arc: piste(ty(0)), tr: piste(tr(s0, 0)), ombreTaille: piste(`scale(${arrondi(s0, 3)})`), ombreArc: piste(reduit(0)) }
    let ici = { x: coin, h: 0, s: s0, r: 0 }
    let t = 0
    for (const p of pas) {
      const t1 = t + p.duree
      const de = p.de ? xDe(p.de, cibles, depart) : ici.x
      const a = p.a ? xDe(p.a, cibles, depart) : de
      if (!de || !a) return null
      const h0 = p.de ? (p.de.h ?? 0) : ici.h
      const h1 = p.a ? (p.a.h ?? 0) : h0
      const s1 = p.echelle ?? ici.s
      const r1 = p.rot ?? ici.r
      const c = COURBE[p.mouvement ?? 'lineaire']
      va(lui.x, t, t1, tx(de), tx(a), c)
      va(lui.sol, t, t1, ty(h0), ty(h1), c)
      va(lui.tr, t, t1, tr(ici.s, ici.r), tr(s1, r1), c)
      va(lui.ombreTaille, t, t1, `scale(${arrondi(ici.s, 3)})`, `scale(${arrondi(s1, 3)})`, c)
      if (p.saut) {
        bondit(lui.arc, t, t1, ty(0), ty(p.saut))
        bondit(lui.ombreArc, t, t1, reduit(0), reduit(p.saut))
      }
      // un tour complet le laisse comme il était : l'angle repart de 0 (le saut de 360 à 0 ne se voit pas)
      const r = tourComplet(r1) ? 0 : r1
      if (r !== r1) pose(lui.tr, t1, tr(s1, 0))
      ici = { x: a, h: h1, s: s1, r }

      if (p.objet) {
        const n = p.tient ?? 0
        if (!cibles[n] || k > 0 || !prend(n, k)) return null
        tenue[n]!.push([t, t1])
        touchee[n]!.push([t, t1])
      }
      const vues = new Set<number>()
      for (const g of p.gestes ?? []) {
        const n = g.n ?? 0
        const pe = els[n]
        if (!pe || vues.has(n) || !prend(n, k)) return null
        vues.add(n)
        touchee[n]!.push([t, t1])
        if (g.devant) devant[n]!.push([t, t1])
        const av = etats[n]!
        const ap: EtatEl = { dx: g.dx ?? av.dx, dy: g.dy ?? av.dy, r: g.rot ?? av.r, s: g.echelle ?? av.s, o: g.opacite ?? av.o }
        const m = g.mouvement ?? 'lineaire'
        if (g.secoue) {
          // la secousse, suivie de près : elle s'amortit et s'arrête net
          pose(pe.dx, t, `translateX(${arrondi(av.dx, 1)}px)`)
          for (let i = 1; i <= 24; i++) {
            const u = i / 24
            const v = lerp(av.dx, ap.dx, LISSE[m](u)) + g.secoue * Math.sin(u * Math.PI * 12) * (1 - u)
            pe.dx.cles.push({ t: i === 24 ? finDe(t, t1) : t + u * p.duree, v: `translateX(${arrondi(v, 1)}px)` })
          }
        } else va(pe.dx, t, t1, `translateX(${arrondi(av.dx, 1)}px)`, `translateX(${arrondi(ap.dx, 1)}px)`, COURBE[m])
        va(pe.dy, t, t1, ty(av.dy), ty(ap.dy), COURBE[m])
        va(pe.tr, t, t1, trEl(av.s, av.r), trEl(ap.s, ap.r), COURBE[m])
        va(pe.o, t, t1, `${arrondi(av.o, 2)}`, `${arrondi(ap.o, 2)}`, COURBE[m])
        if (g.saut) bondit(pe.arc, t, t1, ty(0), ty(g.saut))
        // un tour complet sur elle-même la laisse comme elle était : l'angle repart de 0, au même instant
        if (tourComplet(ap.r)) {
          ap.r = 0
          pose(pe.tr, t1, trEl(ap.s, 0))
        }
        etats[n] = ap
      }
      t = t1
    }
    // il finit comme il a commencé : à son coin (ou là où il travaillait), au sol, à sa taille, droit
    if (ici.x.pct !== 1 || Math.abs(ici.x.px + TAILLE.largeur - depart) > 0.5 || ici.h !== 0 || Math.abs(ici.s - s0) > 1e-6 || ici.r !== 0) return null
    luis.push(lui)
    duree = Math.max(duree, t)
  }
  // chaque cible touchée est empruntée du premier au dernier pas qui la touche, et rendue à sa place
  const emprunts: { n: number; de: number; a: number }[] = []
  for (let n = 0; n < cibles.length; n++) {
    const w = touchee[n]!
    if (!w.length) continue
    if (!auRepos(etats[n]!)) return null
    emprunts.push({ n, de: arrondi(Math.min(...w.map(x => x[0])), 3), a: arrondi(Math.max(...w.map(x => x[1])), 3) })
  }
  return { lui: luis[0]!, minis: luis.slice(1), els, tenue, devant, emprunts, duree }
}

// ------------------------------------------------------------- la préparation

/** Le bord gauche de sa boîte, en px, sur une bande de cette largeur */
const pxDe = (x: X, largeur: number) => x.pct * largeur + x.px

/**
 * Ses pas tels qu'il les joue : la durée d'un trajet donné avec une vitesse
 * vient de sa distance sur cette bande, au pas de ses pattes et à sa taille.
 * Null si un pas est mal formé.
 */
function resous(pas: readonly Pas[], cibles: readonly ElementBande[], largeur: number, depart = 0, s0 = 1, mini = false): Pas[] | null {
  let ici: X = { pct: 1, px: depart - TAILLE.largeur }
  let s = s0
  const r: Pas[] = []
  for (const p of pas) {
    if (!(p.duree > 0) || !Number.isFinite(p.duree) || !p.images.length) return null
    if (p.tours !== undefined && !(Number.isInteger(p.tours) && p.tours >= 1)) return null
    const de = p.de ? xDe(p.de, cibles, depart) : ici
    const a = p.a ? xDe(p.a, cibles, depart) : de
    if (!de || !a) return null
    let duree = p.duree
    if (p.vitesse !== undefined) {
      const v = (typeof p.vitesse === 'number' ? p.vitesse : VITESSES[p.vitesse]) * Math.min(s, p.echelle ?? s)
      if (!(v > 0) || !Number.isFinite(v)) return null
      duree = Math.max(duree, Math.abs(pxDe(a, largeur) - pxDe(de, largeur)) / v)
    }
    // un trajet à pied (pas un bond) : de quel côté il va, et la cadence de ses pattes à sa vitesse réelle
    const dx = pxDe(a, largeur) - pxDe(de, largeur)
    const sens = !p.saut && Math.abs(dx) > 3 ? Math.sign(dx) : 0
    const foulee = sens && cadenceDe(p.images, Math.abs(dx) / duree, Math.min(s, p.echelle ?? s))
    r.push({ ...p, duree: arrondi(duree, 3), ...(foulee ? { cadence: foulee } : {}) })
    sensDe.set(r.at(-1)!, sens)
    ici = a
    s = p.echelle ?? s
  }
  return enchaine(r, mini)
}

/** De quel côté chaque pas résolu le mène (-1 à gauche, 1 à droite, 0 sur place ou en bondissant) */
const sensDe = new WeakMap<Pas, number>()

/** La longueur d'un cycle de ses pattes (px, à sa taille normale) : course 150 px/s en 0,4 s, marche 50 px/s en 0,6 s */
const FOULEE = { vite: 60, lent: 30 }
/** Le cycle de ses pattes (s, au vingtième) pour qu'elles suivent sa vitesse réelle (px/s), s'il marche ou court de profil et que ce n'est pas celui d'office */
function cadenceDe(images: readonly string[], v: number, s: number): number | undefined {
  const allure = images.some(i => i.includes('class="vite"')) ? 'vite' : images.some(i => i.includes('class="lent"')) ? 'lent' : null
  if (!allure || !(v > 0)) return undefined
  const c = Math.round(Math.min(1.2, Math.max(0.15, (FOULEE[allure] * s) / v)) * 20) / 20
  return Math.abs(c - (allure === 'vite' ? 0.4 : 0.6)) < 0.01 ? undefined : c
}

/** La durée d'une image de transition (s) */
const TRANSITION = 0.09
/** Le sol de sa toile (y de ses pieds) : il se tasse au-dessus */
const SOL = PINCEAUX.Y0 + 48

/**
 * Ses trajets enchaînés sans à-coup : avant de partir, il se tourne de trois
 * quarts et se ramasse (l'élan) ; à l'arrivée, il freine de trois quarts ;
 * quand il repart dans l'autre sens, il fait demi-tour (trois quarts, face,
 * trois quarts) au lieu de se retourner d'un coup. Ces images se jouent sur
 * place, à sa hauteur, et gardent ce qu'il porte et ce derrière quoi il passe.
 * Un mini les a à sa taille (sans sueur ni insigne).
 */
function enchaine(pas: readonly Pas[], mini: boolean): Pas[] {
  return (mini ? enPetit : <T,>(d: () => T) => d())(() => {
    // sa silhouette de course, immobile (de profil, tournée du côté où il va), un peu tassée sur ses pattes : il se ramasse
    // ou il freine (la vue de côté de son corps de face, toute mince, détonnait entre la face et la course)
    const arret = (sens: number) => {
      const p = `<g transform="translate(0 ${arrondi(SOL * 0.1, 1)}) scale(1 .9)">${profil('')}</g>`
      return sens < 0 ? p : miroir(p)
    }
    const r: Pas[] = []
    // ce qu'il garde pendant une transition : ce qu'il porte, et les cibles devant lui (il reste derrière)
    const garde = (p: Pas): Partial<Pas> => {
      const devant = (p.gestes ?? []).filter(g => g.devant).map(g => ({ n: g.n, devant: true }))
      return { ...(p.objet ? { objet: p.objet, tient: p.tient } : {}), ...(devant.length ? { gestes: devant } : {}) }
    }
    const transition = (images: string[], p: Pas, de?: Lieu): Pas => ({ duree: arrondi(TRANSITION * images.length, 3), images, ...(de ? { de } : {}), ...garde(p) })
    for (const [i, p] of pas.entries()) {
      const avant = i > 0 ? sensDe.get(pas[i - 1]!)! : 0
      const sens = sensDe.get(p)!
      if (sens && sens !== avant) {
        r.push(
          avant
            ? transition([arret(avant), corps({ yeux: sens < 0 ? 'gauche' : 'droite' }), arret(sens)], p, p.de)
            : transition([arret(sens)], p, p.de),
        )
      }
      r.push(p)
      const apres = i + 1 < pas.length ? sensDe.get(pas[i + 1]!)! : 0
      // il freine, sauf s'il continue sur sa lancée, repart aussitôt dans l'autre sens (son demi-tour commence par là),
      // ou prend son élan pour percuter ce qui l'attend (un coup d'épaule : pas de freinage juste avant le choc)
      if (sens && apres === 0 && p.mouvement !== 'elan') r.push(transition([arret(sens)], p))
    }
    return r
  })
}

const somme = (pas: readonly Pas[]) => pas.reduce((s, p) => s + p.duree, 0)

/**
 * Ses pas et ceux de ses minis joués sur cette bande, et leurs pistes, ou
 * null : un numéro qui plante, mal formé ou trop long ne se joue pas (sans
 * faire tomber les autres). Le premier rentré attend les autres chez lui, sur
 * sa dernière image.
 */
function monte(numero: Numero, cibles: readonly ElementBande[], partie: Partie, depart = 0) {
  const { largeur } = partie
  try {
    const pas = resous(numero.pas(cibles, partie), cibles, largeur, depart)
    if (!pas || !pas.length) return null
    const copains: Copain[] = []
    for (const c of (numero.copains?.(cibles, partie) ?? []).slice(0, MINIS_MAX)) {
      // une case de son coin, chacun la sienne
      if (!Number.isInteger(c.place) || c.place < 0 || c.place >= MINIS_MAX || copains.some(x => x.place === c.place)) return null
      const p = resous(c.pas, cibles, largeur, coinCopain(c.place), DEMI, true)
      if (!p || !p.length) return null
      copains.push({ ...c, pas: p })
    }
    const total = Math.max(somme(pas), ...copains.map(c => somme(c.pas)))
    if (!Number.isFinite(total) || total > MAX_DUREE) return null
    // ses autres minis le regardent depuis leurs cases
    enPetit(() => {
      for (const [place, teinte] of (partie.figurants ?? []).slice(0, MINIS_MAX).entries()) {
        if (copains.some(c => c.place === place)) continue
        const images = [corps({ yeux: 'droite' }), corps({ yeux: 'heureux' }), corps({ yeux: 'droite' }), corps({ yeux: 'clin' })]
        copains.push({ place, ...(teinte ? { teinte } : {}), pas: [{ duree: arrondi(total, 3), images, tours: Math.max(1, Math.round(total / 2.4)) }] })
      }
    })
    const cale = (l: Pas[]): Pas[] => {
      const reste = arrondi(total - somme(l), 3)
      return reste > 0 ? [...l, { duree: reste, images: [l.at(-1)!.images.at(-1)!] }] : l
    }
    const sien = cale(pas)
    const leurs = copains.map(c => ({ ...c, pas: cale(c.pas) }))
    const tj = trajets([{ pas: sien, depart, s0: 1 }, ...leurs.map(c => ({ pas: c.pas, depart: coinCopain(c.place), s0: DEMI }))], cibles)
    return tj ? { pas: sien, copains: leurs, tj } : null
  } catch {
    return null
  }
}

/** Pourquoi un numéro se joue ou non sur cette bande, en clair (pour /clawd voit) */
export function diagnostic(nom: string, elements: readonly ElementBande[], largeur = LARGEUR_BANDE): string {
  const n = NUMEROS[nom]
  if (!n) return 'inconnu'
  const partie: Partie = { largeur, variante: 0 }
  let cibles: readonly ElementBande[] = []
  try {
    if (n.cibles) {
      const c = n.cibles(elements, partie)
      if (!c || !c.length) return `rien à viser${n.besoin ? ` (il lui faut ${n.besoin})` : ''}`
      cibles = c
    }
  } catch (e) {
    return `plante en choisissant ses cibles : ${String(e).slice(0, 80)}`
  }
  let pas: Pas[] | null
  try {
    pas = resous(n.pas(cibles, partie), cibles, largeur)
  } catch (e) {
    return `plante en préparant ses pas : ${String(e).slice(0, 80)}`
  }
  if (!pas || !pas.length) return 'un pas mal formé (durée, images, tours, lieu ou vitesse)'
  const total = pas.reduce((s, p) => s + p.duree, 0)
  if (total > MAX_DUREE) return `trop long : ${arrondi(total, 1)} s (au plus ${MAX_DUREE})`
  const m = monte(n, cibles, partie)
  if (!m) return 'un trajet impossible (une cible absente, laissée ailleurs qu’à sa place, il ne revient pas à son coin, ou un de ses minis non plus)'
  return `jouable : ${arrondi(m.tj.duree, 1)} s${cibles.length ? `, vise ${cibles.map(c => c.id).join(', ')}` : ''}`
}

/**
 * Un numéro prêt à jouer sur une bande de cette largeur (px) : ses cibles, sa
 * durée (s), et quand il emprunte chacune [début, fin] (s). `depart` : là où
 * il le commence et le finit, en px depuis son coin (négatif vers la gauche) :
 * là où il en était de son déménagement. `variante` et `vise` : voir `Partie`
 * (le dessin doit les recevoir à l'identique).
 */
export function prepareNumero(
  nom: string,
  elements: readonly ElementBande[],
  largeur = LARGEUR_BANDE,
  depart = 0,
  { variante = 0, vise, figurants }: { variante?: number; vise?: string; figurants?: readonly (string | null)[] } = {},
): { cibles: ElementBande[]; duree: number; emprunts: { id: string; de: number; a: number }[] } | null {
  const n = NUMEROS[nom]
  if (!n) return null
  const partie: Partie = { largeur, variante, ...(vise ? { vise } : {}), ...(figurants?.length ? { figurants } : {}) }
  let cibles: readonly ElementBande[] = []
  try {
    if (n.cibles) {
      const c = n.cibles(elements, partie)
      if (!c || !c.length) return null
      cibles = c
    }
  } catch {
    return null
  }
  // deux fois la même cible : il ne saurait pas laquelle rendre
  if (new Set(cibles.map(c => c.id)).size !== cibles.length) return null
  const m = monte(n, cibles, partie, depart)
  if (!m) return null
  return { cibles: [...cibles], duree: arrondi(m.tj.duree, 3), emprunts: m.tj.emprunts.map(e => ({ id: cibles[e.n]!.id, de: e.de, a: e.a })) }
}

// ------------------------------------------------- pour la planche-contact

/**
 * Une bande d'exemple, comme atelier la dessine : trois jauges et la conso en
 * haut ; en bas un build raté, une étape faite, l'étape en cours (l'orbe), une
 * à faire, puis un sous-agent. La planche-contact y joue ses numéros.
 */
export const EXEMPLE: ElementBande[] = [
  { id: 'jauge-5h', genre: 'jauge', etat: 'attention', x: 0, largeur: 157, ligne: 1 },
  { id: 'jauge-7j', genre: 'jauge', etat: 'ok', x: 171, largeur: 108, ligne: 1 },
  { id: 'jauge-contexte', genre: 'jauge', etat: 'ok', x: 293, largeur: 108, ligne: 1 },
  { id: 'conso', genre: 'conso', etat: 'ok', x: 415, largeur: 92, ligne: 1 },
  { id: 'build', genre: 'build', etat: 'echec', x: 0, largeur: 17, ligne: 0 },
  { id: 'tache-plan-1', genre: 'tache', etat: 'faite', x: 27, largeur: 17, ligne: 0 },
  { id: 'tache-plan-2', genre: 'tache', etat: 'encours', x: 44, largeur: 17, ligne: 0 },
  { id: 'tache-plan-3', genre: 'tache', etat: 'attente', x: 61, largeur: 17, ligne: 0 },
  { id: 'agent-a1', genre: 'agent', etat: 'encours', x: 88, largeur: 17, ligne: 0, teinte: '#E9A27F' },
]

/** La bande d'exemple dessinée, sans ce qu'il tient (comme atelier le fait), pour la planche-contact */
export function svgBandeExemple(elements: readonly ElementBande[], tenus: ReadonlySet<string> = new Set()): string {
  const dessin = elements
    .filter(el => !tenus.has(el.id))
    .map((el, k) => copieDe(el, `ex-e${k}-`, el.x, hautDe(el)))
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="${HAUTEUR}"><style>${CSS_BANDE}</style>${dessin}</svg>`
}

// ------------------------------------------------------------- le dessin

const pc = (t: number, T: number) => `${arrondi(Math.min(100, (t / T) * 100), 3)}%`

/** Les cadres de repérage : un trait pointillé autour de chaque élément de la bande */
const reperes = (els: readonly ElementBande[]) =>
  els.map(el => `<rect class="repere" x="${el.x - 1}" y="${+(HAUTEUR - basDe(el) - rangeeDe(el) + 1).toFixed(1)}" width="${el.largeur + 2}" height="${+(rangeeDe(el) - 2).toFixed(1)}" rx="4"/>`).join('')

/** La règle du cadre : une graduation tous les 50 px, le coin de Clawd, et la largeur prévue (pour recaler CELLULE) */
const regle = (colonnes?: number) =>
  Array.from({ length: 40 }, (_, i) => `<rect class="grad" x="${i * 50}" y="${HAUTEUR - 6}" width="1" height="6"/><text class="grad" x="${i * 50 + 2}" y="${HAUTEUR - 8}">${i * 50}</text>`).join('') +
  // l'étiquette à gauche du trait du coin, à mi-hauteur : le haut du dessin dépasse de la bande, coupé
  `<g class="coin"><rect class="grad" x="0" y="0" width="1" height="${HAUTEUR}"/>` +
  (colonnes ? `<text class="grad" x="-6" y="30" text-anchor="end">${colonnes} colonnes · ${Math.round(colonnes * CELLULE)} à ${Math.round((colonnes + 1) * CELLULE)} px prévus</text>` : '') +
  '</g>'

const CSS_BANDE =
  `.repere{fill:none;stroke:#FFD75F;stroke-width:1.2;stroke-dasharray:3 2}` +
  `.grad{fill:#FFD75F;font:8px monospace}` +
  `.coin{transform-box:view-box;transform:translateX(calc(100% - ${TAILLE.largeur}px))}` +
  `.cp-trait{fill:none;stroke:#fff;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}` +
  `.cp-attente{fill:none;stroke:#8b9097;stroke-width:1.4;stroke-dasharray:2.2 2.1}` +
  `.cp-piste{fill:#ffffff24}.cp-texte{fill:#a3a7ad;opacity:.55}.cp-lourde{fill:#f2b33d}.cp-conseil{fill:#b085f5;opacity:.7}` +
  `.cp-orbe{fill:#ececec;transform-box:fill-box;transform-origin:center;animation:cp-tourne 1.6s linear infinite}@keyframes cp-tourne{to{transform:rotate(360deg)}}` +
  `.cp-haut{animation:cp-haut 1.6s ease-out both}@keyframes cp-haut{to{transform:translate(-4px,-7px) rotate(-25deg)}}` +
  `.cp-bas{animation:cp-bas 1.6s ease-out both}@keyframes cp-bas{to{transform:translate(4px,5px) rotate(20deg)}}` +
  `.cp-haut,.cp-bas{transform-box:fill-box;transform-origin:center}` +
  `.cp-scintille{animation:scintille .5s steps(2) infinite}` +
  `@media (prefers-color-scheme: light){.repere{stroke:#b7791f}.grad{fill:#b7791f}.cp-orbe{fill:#202124}.cp-attente{stroke:#9aa0a6}.cp-piste{fill:#0000001f}.cp-texte{fill:#5f646b}.cp-lourde{fill:#b7791f}.cp-conseil{fill:#7c4dcc}}`

/** Les images clés d'une piste, en CSS : l'animation de la classe `cls` (jouée une fois, tenue au bout) */
function anime(cls: string, p: Piste, T: number, prop = 'transform', toujours = false): string {
  const k = p.cles
  if (!k.length && !toujours) return `.${cls}{${prop}:${p.depart}}`
  const corps = [
    ...(!k.length || k[0]!.t > 0 ? [`0%{${prop}:${p.depart}}`] : []),
    ...k.map(c => `${pc(c.t, T)}{${prop}:${c.v}${c.c ? `;animation-timing-function:${c.c}` : ''}}`),
    ...(!k.length || k.at(-1)!.t < T ? [`100%{${prop}:${actuelle(p)}}`] : []),
  ]
  return `.${cls}{animation:${cls} ${T}s linear both;animation-delay:var(--t0,0s)}@keyframes ${cls}{${corps.join('')}}`
}

/** Les fenêtres [début, fin] d'une liste, moins celles d'une autre */
function sauf(ws: readonly [number, number][], moins: readonly [number, number][]): [number, number][] {
  let r: [number, number][] = ws.map(w => [...w])
  for (const [a, b] of moins) {
    r = r.flatMap(([x, y]): [number, number][] => (b <= x || a >= y ? [[x, y]] : ([[x, Math.max(x, a)], [Math.min(y, b), y]] as [number, number][]).filter(([p, q]) => q - p > 1e-6)))
  }
  return r
}

/** Des groupes emboîtés, un par classe, autour d'un contenu */
const emboite = (classes: readonly string[], contenu: string) => classes.reduceRight((s, c) => `<g class="${c}">${s}</g>`, contenu)

/**
 * Le dessin d'un numéro : un seul cycle, joué une fois. Sa boîte va d'un
 * lieu à l'autre (`.pos-<numéro>`), posée à sa hauteur, avec son bond, sa
 * taille et son inclinaison, chacun sa piste ; son ombre suit, au sol. Chaque
 * image n'est visible que pendant ses fenêtres ; ses cibles empruntées sont
 * dessinées à leur place (derrière lui, ou devant quand il passe derrière),
 * animées par leurs gestes, ou dans ses pinces quand il les porte. Les noms
 * portent celui du numéro : plusieurs dessins dans une même page (la
 * planche-contact) ne se marchent pas dessus.
 */
type AuDessin = Pick<ClawdNumero, 'nom' | 'elements' | 'largeur' | 'depart' | 'variante' | 'vise' | 'figurants'> & { cibles?: readonly ElementBande[]; colonnes?: number }

export function svgNumero(n: AuDessin, couleur: Teinte, deguise?: Deguisement | Tenue): string {
  return avecDeguisement(deguise, () => dessineNumero(n, couleur))
}

function dessineNumero(n: AuDessin, couleur: Teinte): string {
  const numero = NUMEROS[n.nom]
  if (!numero) return COIN_VIDE
  const cibles = n.cibles ?? []
  const m = monte(numero, cibles, { largeur: n.largeur ?? LARGEUR_BANDE, variante: n.variante ?? 0, ...(n.vise ? { vise: n.vise } : {}), ...(n.figurants?.length ? { figurants: n.figurants } : {}) }, n.depart ?? 0)
  if (!m) return COIN_VIDE
  const { pas, tj } = m
  const T = arrondi(tj.duree, 3)
  const N = n.nom
  let css = CSS_BANDE

  let id = 0
  const fenetre = (ws: [number, number][], contenu: string) => {
    if (!ws.length) return ''
    const cls = `v-${N}-${id++}`
    // visible jusqu'au bout : il le reste pendant la RETENUE (Clawd à son coin, copies sur les originaux) ; sans
    // image clé à 100 %, le navigateur la prendrait de la valeur de base (opacity:0), et `both` la garderait
    const tenue = Math.max(...ws.map(w => w[1])) >= T - 1e-6 ? '100%{opacity:1}' : ''
    css += `.${cls}{opacity:0;animation:${cls} ${T}s steps(1,end) both;animation-delay:var(--t0,0s)}@keyframes ${cls}{${fenetres(ws, T)}${tenue}}`
    return `<g class="${cls}">${contenu}</g>`
  }

  /** Les cadences de pattes employées (leur classe, leur cycle en s) : leur CSS suit celui des allures d'office, qu'il remplace */
  const cadences = new Map<string, number>()
  // Clawd (ou un mini) à sa taille, dans un SVG imbriqué au cadrage de sa petite scène ; son ombre de même, à part, au sol
  const cadrage = `x="0" y="${BOITE}" width="${TAILLE.largeur}" height="${TAILLE.hauteur}" viewBox="${VUE.x} ${VUE.y} ${VUE.w} ${VUE.h}" overflow="visible" shape-rendering="crispEdges"`
  /**
   * Un acteur : ses pistes (ses pieds sont l'origine de sa taille, et de celle
   * de son ombre), ses images chacune visible pendant ses fenêtres (les effets
   * de même), dans sa teinte ; `pinces` : ce qu'il porte, qui le suit
   */
  const acteur = (suffixe: string, sesPas: readonly Pas[], lui: Lui, teinte: Teinte, pinces = '') => {
    const c = { pos: `pos-${N}${suffixe}`, sol: `sol-${N}${suffixe}`, arc: `arc-${N}${suffixe}`, tr: `tr-${N}${suffixe}`, ot: `ot-${N}${suffixe}`, oa: `oa-${N}${suffixe}` }
    css += `.${c.pos},.${c.sol},.${c.arc}{transform-box:view-box;transform-origin:0 0}.${c.tr},.${c.ot},.${c.oa}{transform-box:view-box;transform-origin:${AXE}px ${HAUTEUR}px}`
    css += anime(c.pos, lui.x, T, 'transform', true) + anime(c.sol, lui.sol, T) + anime(c.arc, lui.arc, T) + anime(c.tr, lui.tr, T)
    css += anime(c.ot, lui.ombreTaille, T) + anime(c.oa, lui.ombreArc, T)
    const vues = new Map<string, [number, number][]>()
    const fx = new Map<string, [number, number][]>()
    let t = 0
    for (const p of sesPas) {
      const k = p.images.length * (p.tours ?? 1)
      // ses pattes à la cadence de ce trajet
      const cad = p.cadence ? `cad-${Math.round(p.cadence * 1000)}` : ''
      if (cad) cadences.set(cad, p.cadence!)
      for (let i = 0; i < k; i++) {
        // son ombre est dessinée à part, au sol
        let img = p.images[i % p.images.length]!.replace(/<rect class="ombre[^"]*"[^>]*\/>/g, '')
        if (cad) img = img.replace(/class="(vite|lent)"/g, `class="$1 ${cad}"`)
        const debut = t + (i * p.duree) / k
        vues.set(img, [...(vues.get(img) ?? []), [debut, debut + p.duree / k]])
      }
      if (p.fx) fx.set(p.fx, [...(fx.get(p.fx) ?? []), [t, t + p.duree]])
      t += p.duree
    }
    let images = ''
    for (const [img, ws] of vues) images += fenetre(ws, img)
    for (const [effet, ws] of fx) images += fenetre(ws, effet)
    return {
      images,
      corps: emboite([c.pos, c.sol, c.arc, c.tr], recolore(`<svg ${cadrage}><g filter="url(#contour)">${images}</g></svg>`, teinte) + pinces),
      ombre: emboite([c.pos, c.sol, c.ot, c.oa], `<svg ${cadrage}>${OMBRE}</svg>`),
    }
  }
  // les cadres de repérage, pendant ses pas qui les demandent
  const vus: [number, number][] = []
  let t = 0
  for (const p of pas) {
    if (p.repere) vus.push([t, t + p.duree])
    t += p.duree
  }

  // ses cibles : à leur place pendant l'emprunt (sauf quand il les porte), derrière ou devant lui
  let derriere = ''
  let devant = ''
  let portees = ''
  for (const e of tj.emprunts) {
    const el = cibles[e.n]!
    const pe = tj.els[e.n]!
    const k = { dx: `edx-${N}-${e.n}`, dy: `edy-${N}-${e.n}`, arc: `ea-${N}-${e.n}`, tr: `etr-${N}-${e.n}`, o: `eo-${N}-${e.n}` }
    const ctr = centre(el)
    css += `.${k.dx},.${k.dy},.${k.arc}{transform-box:view-box;transform-origin:0 0}.${k.tr}{transform-box:view-box;transform-origin:${arrondi(ctr.x, 1)}px ${arrondi(ctr.y, 1)}px}`
    css += anime(k.dx, pe.dx, T) + anime(k.dy, pe.dy, T) + anime(k.arc, pe.arc, T) + anime(k.tr, pe.tr, T) + anime(k.o, pe.o, T, 'opacity')
    const prefixe = `${N}-e${e.n}-`
    const place = emboite([k.dx, k.dy, k.arc, k.tr, k.o], copieDe(el, prefixe, el.x, hautDe(el)))
    // pendant tout le numéro, au repos sur l'original quand elle ne bouge pas (rien ne se voit) : le dessin démarre en retard sur les minuteurs
    const libre = sauf([[0, T]], tj.tenue[e.n]!)
    const auDessus = sauf(libre, sauf(libre, tj.devant[e.n]!))
    derriere += fenetre(sauf(libre, auDessus), place)
    devant += fenetre(auDessus, place)
    // dans ses pinces, comme il la tient à chaque pas
    const parObjet = new Map<Objet, [number, number][]>()
    let tp = 0
    for (const p of pas) {
      if (p.objet && (p.tient ?? 0) === e.n) parObjet.set(p.objet, [...(parObjet.get(p.objet) ?? []), [tp, tp + p.duree]])
      tp += p.duree
    }
    for (const [o, ws] of parObjet) portees += fenetre(ws, portee(el, prefixe, o, `cl-${N}-${e.n}-${o}`, ws[0]?.[0] ?? 0))
  }
  const decor = (vus.length ? fenetre(vus, reperes(n.elements)) : '') + (N === 'cadre' ? regle(n.colonnes) : '')

  // lui prend la teinte de son modèle, chaque mini celle du sien (celle de sa pastille) : les copies gardent leurs
  // couleurs (un sous-agent Opus reste terracotta)
  const lui = acteur('', pas, tj.lui, couleur, portees)
  const minis = m.copains.map((cp, i) => acteur(`-m${i}`, cp.pas, tj.minis[i]!, teinteDe(cp.teinte) ?? couleur))
  const images = lui.images + minis.map(x => x.images).join('')
  for (const [cad, c] of cadences) css += `.${cad} .pA,.${cad} .pB{animation-duration:${c}s}.${cad} .pB{animation-delay:${arrondi(c / 2, 3)}s}`
  // (ses minis devant lui : ils sortent de leurs cases, devant la sienne)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="${HAUTEUR}" style="--t0:0s">` +
    recolore(`<style>${CSS}${vit(reutilises(images) + images)}${THEME}${css}</style>${FILTRE}${reutilises(images)}`, couleur) +
    `${decor}${derriere}${lui.ombre}${minis.map(x => x.ombre).join('')}${lui.corps}${minis.map(x => x.corps).join('')}${devant}</svg>`
  )
}
