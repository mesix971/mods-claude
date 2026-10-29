// Moteur de sprites de Clawd, en SVG animé image par image (flipbook CSS).
//
// Vue de face : grille de 12×8 cases relevée sur la capture (tête et corps
// 8 cases, un bras de 2 cases de chaque côté, 4 pattes). Une case = 6 px.
// Vue de profil : relevée pixel par pixel sur la première capture (avec sa
// canne), utilisée pour marcher.
//
// Une scène = des images (corps dans une pose + accessoires) qui défilent,
// plus des effets continus (notes, Z, confettis…) animés en CSS.

import type { ClawdAnim } from '../types'

// ------------------------------------------------------------------ palette

const PAL: Record<string, string> = {
  O: '#D97758', // orange Clawd
  o: '#BF694F', // orange ombré
  K: '#141414', // noir
  W: '#FFFFFF',
  w: '#CFCFCF', // gris clair
  G: '#8B8B8B', // gris
  g: '#4A4A4A', // gris foncé
  Y: '#FFD75F', // jaune
  y: '#E0A030', // jaune foncé
  R: '#E5484D', // rouge
  B: '#5AB0FF', // bleu
  b: '#2F6FB0', // bleu foncé
  P: '#FF6B9A', // rose
  N: '#9A6234', // marron
  n: '#5C3A1A', // marron foncé
  V: '#4CC38A', // vert
  v: '#2E8B57', // vert foncé
  L: '#C39BFF', // lilas
  // carton (kraft)
  H: '#E8C792', // dessus, éclairé
  C: '#D2A46B', // face avant
  c: '#A97B46', // côté, à l'ombre
  D: '#6B4522', // arêtes
  S: '#F7E6BF', // scotch
  s: '#EAD3A2', // scotch sur la face avant
  // citrouille (Halloween) : plus vive que lui, et elle ne prend pas sa teinte
  Q: '#F5891F',
  q: '#C2610F',
  // ses cernes du lundi matin : un mauve fatigué sous les yeux
  M: '#7E4E6E',
  // son insigne de niveau en bronze, et son liseré (l'argent, c'est w cerclé de G ; l'or, Y cerclé de y)
  Z: '#CD7F32',
  z: '#6E3F17',
  // le verre de sa visière de pilote automatique (translucide : ses yeux se voient au travers)
  T: '#4FC3F7',
}

// Toile : 180×96, Clawd posé au milieu, de la place au-dessus pour les
// accessoires (le cadrage final est VUE, plus bas)
const W = 180
const X0 = 54
const Y0 = 46

const R = (x: number, y: number, w: number, h: number, c: string) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`

/** Pixel art : une ligne par rangée, un caractère par pixel (« . » = vide). */
function art(lignes: readonly string[], x: number, y: number, p = 3): string {
  let s = ''
  lignes.forEach((l, j) => {
    let i = 0
    while (i < l.length) {
      const ch = l[i]!
      const c = PAL[ch]
      if (!c) {
        i++
        continue
      }
      let k = i
      while (k < l.length && l[k] === ch) k++
      s += R(x + i * p, y + j * p, (k - i) * p, p, c)
      i = k
    }
  })
  return s
}

/** Accessoire placé par rapport à Clawd (même repère que son corps). */
const A = (lignes: readonly string[], dx: number, dy: number, p = 3) => art(lignes, X0 + dx, Y0 + dy, p)

const trait = (pts: [number, number][], c: string, ep = 2) =>
  `<path d="M${pts.map(([x, y]) => `${X0 + x} ${Y0 + y}`).join(' L')}" stroke="${c}" stroke-width="${ep}" fill="none"/>`

const courbe = (x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, c: string, ep = 2) =>
  `<path d="M${X0 + x1} ${Y0 + y1} Q${X0 + cx} ${Y0 + cy} ${X0 + x2} ${Y0 + y2}" stroke="${c}" stroke-width="${ep}" fill="none" shape-rendering="auto"/>`

const glyphe = (s: string, dx: number, dy: number, taille: number, c: string, cls = '', delai = 0) =>
  `<text class="${cls}" x="${X0 + dx}" y="${Y0 + dy}" font-size="${taille}" font-family="monospace" font-weight="bold" fill="${c}"${delai ? ` style="animation-delay:${delai}s"` : ''}>${s}</text>`

// ------------------------------------------------------------------ le corps

/**
 * Son déguisement du jour, porté dans toutes ses poses (de face, de dos, de
 * profil) : le 31 octobre, un chapeau-citrouille ; le vendredi soir, ses
 * lunettes de soleil ; le lundi matin, des cernes et les yeux mi-clos.
 * Décidé par `register.tsx` (la date, l'heure), passé à `svgScene` ; null le
 * reste du temps.
 */
export type Deguisement = 'citrouille' | 'lunettes' | 'cernes'
let deguisement: Deguisement | null = null

// Le chapeau-citrouille : côtes plus sombres, queue marron et sa feuille
const CITROUILLE = ['....nV....', '....nVV...', '.QQqQQqQQ.', 'QQqQQQQqQQ', 'QQqQQQQqQQ', '.QQqQQqQQ.']
const CITROUILLE_DEF = `<g id="citrouille">${art(CITROUILLE, 0, 0, 3)}</g>`
/**
 * Son déguisement posé sur sa tête (le haut de sa tête en `y`, son axe en
 * `cx`, en pixels de `p`) ; rien s'il n'en porte pas. Écrit une seule fois
 * par SVG (voir `reutilises`), puis repris.
 */
const chapeau = (cx: number, y: number, p = 3) => {
  if (deguisement !== 'citrouille') return ''
  const [x0, y0] = [cx - 5 * p, y - 5 * p]
  return p === 3 ? `<use href="#citrouille" x="${x0}" y="${y0}"/>` : `<g transform="translate(${x0} ${y0}) scale(${+(p / 3).toFixed(4)})"><use href="#citrouille"/></g>`
}

// Ses lunettes de soleil (repère : le coin haut-gauche de son corps, de face) :
// deux verres noirs plus larges que ses yeux, un reflet en biais sur chacun,
// le pont entre les deux et les branches jusqu'au bord de sa tête
const LUNETTES_DEF =
  `<g id="lunettes">` +
  R(12, 5, 48, 3, PAL.K!) +
  R(15, 4, 12, 9, PAL.K!) + R(45, 4, 12, 9, PAL.K!) +
  R(17, 6, 2, 2, PAL.W!) + R(19, 8, 2, 2, PAL.W!) + R(47, 6, 2, 2, PAL.W!) + R(49, 8, 2, 2, PAL.W!) +
  `</g>`
// Ses cernes : un trait mauve sous chaque œil
const CERNES_DEF = `<g id="cernes">${R(17, 13, 8, 4, PAL.M!) + R(47, 13, 8, 4, PAL.M!)}</g>`
/** Les yeux trop parlants pour rester derrière des verres noirs : il remonte ses lunettes sur son front */
const YEUX_PARLANTS: readonly Yeux[] = ['coeur', 'etoile', 'croix', 'grand']
/**
 * Ce que la session lui met en plus de son déguisement du jour (register.tsx
 * le décide) : sa visière de pilote automatique quand Claude agit sans te
 * demander (mode auto ou bypass), la sueur qui monte avec le contexte, et
 * l'insigne de son niveau, épinglé sur son ventre.
 */
export type Insigne = 'bronze' | 'argent' | 'or' | 'etoile'
export type Tenue = {
  /** son déguisement du jour (la date, l'heure) */
  deguise?: Deguisement
  /** sa visière : Claude agit sans te demander */
  visiere?: boolean
  /** le contexte se remplit : une goutte de sueur (1), puis deux et les joues rouges (2) */
  sueur?: 1 | 2
  /** l'insigne de son niveau */
  insigne?: Insigne
}
let visiere = false
let sueur: 0 | 1 | 2 = 0
let insigne: Insigne | null = null
/** Un mini-Clawd se dessine : ni la sueur ni l'insigne de Clawd, mais la même visière (son sous-agent a le même mode) */
let enMini = false
/** Dessine un mini-Clawd (voir `enMini`) */
function enPetit<T>(dessine: () => T): T {
  const avant = enMini
  enMini = true
  try {
    return dessine()
  } finally {
    enMini = avant
  }
}

/** Sa tenue, sans ce qu'il ne porte pas ; rien du tout : undefined (son dessin reste celui de toujours) */
export function tenueDe(t: Tenue): Tenue | undefined {
  const n: Tenue = {
    ...(t.deguise ? { deguise: t.deguise } : {}),
    ...(t.visiere ? { visiere: true } : {}),
    ...(t.sueur ? { sueur: t.sueur } : {}),
    ...(t.insigne ? { insigne: t.insigne } : {}),
  }
  return Object.keys(n).length ? n : undefined
}

// Sa visière de pilote automatique (même repère que ses lunettes) : un verre bleuté d'un bord à l'autre de sa tête, à
// travers lequel on voit encore ses yeux, sa monture sombre, un reflet, et le voyant vert du pilote sur le dessus
const reflet = (x: number, y: number) => `<rect x="${x}" y="${y}" width="2" height="2" fill="${PAL.W}" fill-opacity=".85"/>`
// (le verre et sa monture d'un seul rectangle : la monture est son trait, de 2, à cheval sur son bord)
const verreMonte = (x: number, y: number, w: number, h: number) =>
  `<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" fill="${PAL.T}" fill-opacity=".65" stroke="${PAL.g}" stroke-width="2"/>`
const VISIERE_DEF = `<g id="visiere">${verreMonte(12, 3, 48, 12) + reflet(28, 6) + reflet(30, 8) + R(50, 3, 4, 2, PAL.V!)}</g>`
// en plein demi-tour : un seul verre dans sa monture (son coin haut-gauche en 0, 0), la branche est dessinée à part
const VISIERE_COTE_DEF = `<g id="visiere-cote">${verreMonte(0, 0, 12, 12) + reflet(2, 3)}</g>`
// de profil (dans le repère de `profil`) : le verre devant ses deux yeux dans sa monture, la branche vers l'arrière
const VISIERE_PROFIL = verreMonte(45, 58, 46, 14) + reflet(62, 61) + reflet(64, 63) + R(90, 62, 16, 3, PAL.g!)

/** Comme `art`, sa couleur dominante posée une fois sur le groupe : un dessin repris plus léger */
function artGroupe(lignes: readonly string[], x: number, y: number, p: number, dominante: string): string {
  const c = PAL[dominante]!
  return `<g fill="${c}">${art(lignes, x, y, p).replaceAll(` fill="${c}"/>`, '/>')}</g>`
}

// Une goutte de sueur (pixels de 2) : elle perle à sa tempe, glisse et s'efface (`.goutte`, en boucle) ; la seconde
// (`.g2`) part à mi-chemin de la première. Ses joues rouges, de face : le contexte est presque plein
const GOUTTE = ['.B.', 'BBB', 'WBB', '.B.']
const GOUTTE_DEF = `<g id="goutte">${artGroupe(GOUTTE, 0, 0, 2, 'B')}</g>`
/** Une goutte qui perle en (`x`, `y`) ; la seconde (`deux`) à mi-chemin de la première */
const goutte = (x: number, y: number, deux = false) => `<g class="goutte${deux ? ' g2' : ''}"><use href="#goutte" x="${x}" y="${y}"/></g>`
const joue = (x: number) => `<rect x="${x}" y="16" width="6" height="2" fill="${PAL.P}" fill-opacity=".8"/>`
const JOUES_DEF = `<g id="joues">${joue(14)}${joue(52)}</g>`
const CSS_GOUTTE =
  `.goutte{animation:goutte 2.6s ease-in infinite;opacity:0}.g2{animation-delay:-1.3s}` +
  `@keyframes goutte{0%{transform:translateY(0);opacity:0}12%,70%{opacity:1}100%{transform:translateY(9px);opacity:0}}`

// L'insigne de son niveau (pixels de 2), épinglé sur son ventre : une médaille ronde cerclée de sombre (elle se détache
// de son corps, quelle que soit sa couleur) en bronze, puis en argent, puis en or ; passé le niveau 20, une étoile d'or
// qui brille de temps en temps
const MEDAILLE = (c: string, liseré: string) => ['.rr.', 'rcWr', 'rccr', '.rr.'].map(l => l.replaceAll('c', c).replaceAll('r', liseré))
const METAUX: Record<Exclude<Insigne, 'etoile'>, [string, string]> = { bronze: ['Z', 'z'], argent: ['w', 'G'], or: ['Y', 'y'] }
const ETOILE_INSIGNE = ['..Y..', '.YYY.', 'YYWYY', '.YYY.', '.Y.Y.']
const INSIGNES: readonly Insigne[] = ['bronze', 'argent', 'or', 'etoile']
/** Le dessin de son insigne (`i` : son initiale) */
const insigneDef = (i: Insigne) =>
  `<g id="i${i[0]}">${
    i === 'etoile'
      ? artGroupe(ETOILE_INSIGNE, -1, -1, 2, 'Y') + `<g class="brille">${R(7, -3, 2, 2, PAL.W!)}</g>`
      : artGroupe(MEDAILLE(...METAUX[i]), 0, 0, 2, METAUX[i][1])
  }</g>`
const CSS_BRILLE = `.brille{animation:brille 3s steps(1,end) infinite;opacity:0}@keyframes brille{0%,78%{opacity:0}80%,92%{opacity:1}}`

/** Sa tenue lui met-elle quelque chose de plus (visière, sueur, insigne) ? Un mini n'a que la visière */
const enTenue = () => visiere || (!enMini && (sueur > 0 || insigne !== null))
/**
 * Le nom du dessin de ce que sa tenue lui met, de face (`tn`) ou de profil
 * (`tnp`), ses parties à la suite : `v` sa visière (`h` relevée sur son
 * front), `1`/`2` sa sueur, l'initiale de son insigne (`tnv2e` : visière,
 * deux gouttes, étoile). Il ne dépend que de son nom (`tenueDef`) ; court, il
 * pèse peu dans chaque image. Un mini n'a que la visière.
 */
const idTenue = (profil: boolean, haut = false) =>
  `tn${profil ? 'p' : ''}${visiere ? (haut ? 'h' : 'v') : ''}${!enMini && sueur ? sueur : ''}${!enMini && insigne ? insigne[0] : ''}`
/** Les noms de ces dessins, dans ce qui les reprend */
const ID_TENUE = /href="#(tnp?[vh]?[12]?[baoe]?)"/g
/**
 * Ce que sa tenue lui met, d'après son nom (`idTenue`), dans son repère (le
 * coin haut-gauche de son corps ; de profil, celui de `profil`) : sa visière,
 * ses gouttes de sueur et ses joues rouges, son insigne sur son ventre (ses
 * bras devant lui le cachent). Écrit une fois par SVG, repris d'un seul <use>
 * par image : ses scènes les plus longues restent légères.
 */
function tenueDef(id: string): string {
  const [, p, v, s, i] = /^tn(p?)([vh]?)([12]?)([baoe]?)$/.exec(id) ?? []
  const contenu = p
    ? (v ? VISIERE_PROFIL : '') + (s ? goutte(86, 54) : '') + (i ? `<use href="#i${i}" x="53" y="75"/>` : '')
    : (v ? `<use href="#visiere"${v === 'h' ? ' y="-9"' : ''}/>` : '') +
      (s ? goutte(54, 1) + (s === '2' ? `${goutte(12, 3, true)}<use href="#joues"/>` : '') : '') +
      (i ? `<use href="#i${i}" x="46" y="22"/>` : '')
  return `<g id="${id}">${contenu}</g>`
}

/**
 * Ce que la session lui met de face (son corps en `x0`, `y0`) : sa visière,
 * sa sueur, son insigne (`tenueDef`), dessinés avant ses yeux : ils restent
 * bien noirs devant le verre bleuté.
 */
const porte = (x0: number, y0: number, yeux: Yeux) => (enTenue() ? `<use href="#${idTenue(false, YEUX_PARLANTS.includes(yeux))}" x="${x0}" y="${y0}"/>` : '')
/**
 * Ce que son déguisement met sur son visage de face, par-dessus ses yeux :
 * ses lunettes (sur le front quand ses yeux ont quelque chose à dire), ou ses
 * cernes ; rien sous sa visière. Repris (<use>) pour ne pas alourdir ses
 * scènes.
 */
const visage = (x0: number, y0: number, yeux: Yeux) => {
  if (visiere) return ''
  if (deguisement === 'lunettes') return `<use href="#lunettes" x="${x0}" y="${y0 + (YEUX_PARLANTS.includes(yeux) ? -9 : 0)}"/>`
  if (deguisement === 'cernes') return `<use href="#cernes" x="${x0}" y="${y0}"/>`
  return ''
}
/** Le lundi matin, son regard ordinaire est à moitié fermé */
const regard = (yeux: Yeux): Yeux => (deguisement === 'cernes' && yeux === 'normal' ? 'mi' : yeux)

type Yeux =
  | 'normal' | 'ferme' | 'heureux' | 'mi' | 'grand' | 'croix' | 'coeur'
  | 'etoile' | 'gauche' | 'droite' | 'haut' | 'bas' | 'clin'
type Bras = 'bas' | 'haut' | 'ciel' | 'tendu' | 'devant' | 'pend' | 'tete' | 'cache'
type Jambes = 'normal' | 'pasA' | 'pasB' | 'replie' | 'assis' | 'assis2' | 'ecarte' | 'tape'
type Pose = {
  yeux?: Yeux
  g?: Bras
  d?: Bras
  jambes?: Jambes
  dx?: number
  dy?: number
  vue?: 'face' | 'dos' | 'cote' | 'coteD'
  bouche?: 'o' | 'grand'
  /** son poids : écrasé en se recevant (d'office quand il s'accroupit), étiré en s'élançant */
  masse?: 'ecrase' | 'etire'
  /** au calme, il vit : son buste respire au-dessus de ses pattes, ses yeux ouverts clignent (voir `VIVANT_S`) */
  calme?: boolean
}

/** Les regards ouverts : ceux qui clignent quand il est au calme */
const YEUX_OUVERTS: readonly Yeux[] = ['normal', 'gauche', 'droite', 'haut', 'bas', 'mi']
/** Les poses où il tient en place (debout ou assis) : son buste y respire */
const POSE_TRANQUILLE: readonly Jambes[] = ['normal', 'assis', 'assis2']

// Bras gauche (le droit est en miroir : x' = 72 - x - w)
const BRAS: Record<Exclude<Bras, 'devant' | 'cache'>, [number, number, number, number][]> = {
  bas: [[0, 12, 12, 12]],
  haut: [[0, 0, 12, 12]],
  ciel: [[0, -12, 12, 24]],
  tendu: [[-10, 14, 22, 8]],
  pend: [[2, 18, 10, 12]],
  tete: [[6, -10, 18, 10]],
}

function oeil(x: number, y: number, t: Yeux): string {
  const K = PAL.K!
  switch (t) {
    case 'ferme':
      return R(x, y + 3, 6, 2, K)
    case 'heureux':
      return R(x + 2, y, 2, 2, K) + R(x, y + 2, 2, 3, K) + R(x + 4, y + 2, 2, 3, K)
    case 'mi':
      return R(x, y + 2, 6, 4, K)
    case 'grand':
      return R(x - 1, y - 1, 8, 8, K) + R(x + 3, y, 2, 2, PAL.W!)
    case 'croix':
      return R(x, y, 2, 2, K) + R(x + 4, y, 2, 2, K) + R(x + 2, y + 2, 2, 2, K) + R(x, y + 4, 2, 2, K) + R(x + 4, y + 4, 2, 2, K)
    case 'coeur':
      return R(x, y, 2, 2, PAL.P!) + R(x + 4, y, 2, 2, PAL.P!) + R(x, y + 2, 6, 2, PAL.P!) + R(x + 2, y + 4, 2, 2, PAL.P!)
    case 'etoile':
      return R(x + 2, y, 2, 6, PAL.Y!) + R(x, y + 2, 6, 2, PAL.Y!)
    case 'gauche':
      return R(x - 2, y, 6, 6, K)
    case 'droite':
      return R(x + 2, y, 6, 6, K)
    case 'haut':
      return R(x, y - 2, 6, 6, K)
    case 'bas':
      return R(x, y + 2, 6, 5, K)
    default:
      return R(x, y, 6, 6, K)
  }
}

function corps(p: Pose = {}): string {
  const x0 = X0 + (p.dx ?? 0)
  const y0 = Y0 + (p.dy ?? 0)
  const vue = p.vue ?? 'face'
  const O = PAL.O!
  const j = p.jambes ?? 'normal'
  let s = ''

  // pattes
  const xs =
    vue === 'cote' || vue === 'coteD' ? [27, 39] : j === 'ecarte' ? [8, 24, 42, 58] : [12, 24, 42, 54]
  xs.forEach((lx, i) => {
    let h = 12
    if (j === 'replie') h = 6
    if (j === 'assis') h = 4
    // assis en balançant les pattes : une sur deux remonte
    if (j === 'assis2') h = i % 2 ? 4 : 2
    if ((j === 'pasA' && i % 2 === 0) || (j === 'pasB' && i % 2 === 1)) h = 8
    // il tape du pied : la patte de droite seulement
    if (j === 'tape' && i === 3) h = 8
    s += R(x0 + lx, y0 + 36, 6, h, O)
  })

  if (vue === 'cote' || vue === 'coteD') {
    // de profil, en plein demi-tour : corps étroit, un œil, un bras
    s += R(x0 + 24, y0, 24, 36, O)
    const ox = x0 + (vue === 'cote' ? 28 : 38)
    // sa visière (le verre bleuté dans sa monture, sa branche vers l'arrière de la tête) : avant son œil, qui reste noir
    if (visiere)
      s += `<use href="#visiere-cote" x="${ox - 3}" y="${y0 + 3}"/>` + R(vue === 'cote' ? ox + 9 : x0 + 24, y0 + 7, vue === 'cote' ? x0 + 48 - ox - 9 : ox - 3 - x0 - 24, 2, PAL.g!)
    // (sous sa visière, ses yeux mi-clos du lundi, sans le mauve)
    s += deguisement === 'cernes' ? R(ox, y0 + 8, 6, 4, PAL.K!) + (visiere ? '' : R(ox - 1, y0 + 13, 8, 3, PAL.M!)) : R(ox, y0 + 6, 6, 6, PAL.K!)
    // de profil, un seul verre et sa branche vers l'arrière de la tête
    if (!visiere && deguisement === 'lunettes') s += R(ox - 3, y0 + 4, 12, 9, PAL.K!) + R(vue === 'cote' ? ox + 9 : x0 + 24, y0 + 5, vue === 'cote' ? x0 + 48 - ox - 9 : ox - 3 - x0 - 24, 3, PAL.K!) + R(ox - 1, y0 + 6, 2, 2, PAL.W!)
    // sa sueur, à l'arrière de sa tête
    if (sueur && !enMini) s += goutte(vue === 'cote' ? x0 + 40 : x0 + 26, y0 + 1)
    s += R(x0 + (vue === 'cote' ? 30 : 30), y0 + 16, 12, 10, PAL.o!)
    return s + chapeau(x0 + 36, y0)
  }

  // ses pattes restent au sol ; au calme, le reste (buste, bras, visage) respire au-dessus
  const pattes = s
  s = ''
  s += R(x0 + 12, y0, 48, 36, vue === 'dos' ? PAL.o! : O)

  const bras = (b: Bras, droite: boolean) => {
    if (b === 'cache' || b === 'devant') return ''
    return BRAS[b].map(([x, y, w, h]) => R(x0 + (droite ? 72 - x - w : x), y0 + y, w, h, O)).join('')
  }
  s += bras(p.g ?? 'bas', false) + bras(p.d ?? 'bas', true)

  if (vue === 'face') {
    const t = regard(p.yeux ?? 'normal')
    const yeux = oeil(x0 + 18, y0 + 6, t === 'clin' ? 'normal' : t) + oeil(x0 + 48, y0 + 6, t === 'clin' ? 'ferme' : t)
    // (sa visière, sa sueur, son insigne : sous ses yeux, et sous ses bras devant lui)
    s += porte(x0, y0, t)
    s += p.calme && YEUX_OUVERTS.includes(t) ? `<g class="cligne">${yeux}</g>` : yeux
    s += visage(x0, y0, t)
    if (p.bouche === 'o') s += R(x0 + 33, y0 + 20, 6, 4, PAL.K!)
    if (p.bouche === 'grand') s += R(x0 + 31, y0 + 17, 10, 9, PAL.K!) + R(x0 + 33, y0 + 22, 6, 3, PAL.R!)
  }
  // de dos, sa sueur seule (une goutte à chaque tempe)
  if (vue === 'dos' && sueur && !enMini) s += goutte(x0 + 54, y0 + 1) + (sueur === 2 ? goutte(x0 + 12, y0 + 3, true) : '')

  // bras devant le ventre, en ombré (par-dessus le corps)
  if (p.g === 'devant') s += R(x0 + 12, y0 + 22, 16, 8, PAL.o!)
  if (p.d === 'devant') s += R(x0 + 44, y0 + 22, 16, 8, PAL.o!)
  s += chapeau(x0 + 36, y0)
  s = p.calme && vue === 'face' && POSE_TRANQUILLE.includes(j) ? `<g class="souffle">${s}</g>` : s
  return pese(pattes + s, p)
}

/**
 * Le poids de ses sauts. Accroupi, pattes repliées (il prend son élan ou se
 * reçoit), il s'écrase : plus large, plus bas, les pattes bien posées au sol.
 * Lancé vers le haut, il s'étire. En l'air, son ombre reste au sol et
 * rétrécit d'autant plus qu'il monte haut.
 */
function pese(s: string, p: Pose): string {
  const dy = p.dy ?? 0
  const replie = p.jambes === 'replie'
  const masse = p.masse ?? (replie && dy > 0 ? 'ecrase' : undefined)
  const cx = X0 + (p.dx ?? 0) + 36
  if (masse) {
    // il se déforme autour de ses pieds ; écrasé, il les pose au sol
    const pied = Y0 + dy + 36 + (replie ? 6 : 12)
    const pose = masse === 'ecrase' ? Math.max(0, Y0 + 48 - pied) : 0
    const [sx, sy] = masse === 'ecrase' ? [1.12, 0.86] : [0.88, 1.14]
    s = `<g transform="translate(${cx} ${pied + pose}) scale(${sx} ${sy}) translate(${-cx} ${-pied})">${s}</g>`
  }
  if (replie && dy < 0) s = ombreSaut(cx, dy) + s
  return s
}

/** Son ombre au sol quand il saute : moins large à mesure qu'il monte. */
function ombreSaut(cx: number, dy: number): string {
  const l = Math.max(20, 2 * Math.round((56 + 1.6 * dy) / 2))
  return `<rect class="ombre ombre-saut" x="${cx - l / 2}" y="${Y0 + 48}" width="${l}" height="2"/>`
}
/** Une image qui porte sa propre ombre de saut. */
const OMBRE_SAUT = /<rect class="ombre ombre-saut"[^>]*\/>/
/** Sépare l'ombre d'une image (dessinée hors du contour) du reste de l'image. */
const separeOmbre = (img: string): [string, string] => {
  const m = OMBRE_SAUT.exec(img)
  return m ? [m[0], img.replace(m[0], '')] : [OMBRE, img]
}

// Profil avec la canne (première capture), mis à l'échelle de la vue de face
// et centré sur le même axe (x = 90) pour passer de face à profil sans saut.
// Sans la canne (ni la patte qui la tient), il a les pattes libres pour porter.
function profil(pas: '' | 'vite' | 'lent' = 'vite', canne = true): string {
  const r = (x: number, y: number, w: number, h: number) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`
  const patte = (x: number) => r(x, 91, 7, 4) + r(x + 4, 95, 7, 7) + r(x, 95, 4, 3)
  return (
    `<g transform="translate(${X0 - 25.7} 7.5) scale(.857)"><g class="${pas}">` +
    (canne ? `<g fill="${PAL.G}">${r(10, 80, 3, 8)}${r(13, 84, 4, 7)}${r(16, 88, 4, 3)}${r(17, 91, 7, 4)}${r(21, 95, 7, 3)}${r(24, 98, 22, 4)}</g>` : '') +
    `<g class="corps"><g fill="${PAL.O}">${r(49, 53, 43, 38)}${r(38, 70, 11, 14)}</g>` +
    `<g fill="${PAL.o}">${r(92, 53, 14, 38)}${canne ? r(35, 88, 14, 10) : ''}</g>` +
    `${enTenue() ? `<use href="#${idTenue(true)}"/>` : ''}<g fill="${PAL.K}" class="cligne">${r(49, 62, 7, 7)}${r(76, 62, 7, 7)}</g>${visageProfil()}${chapeau(77.5, 53, 3.5)}</g>` +
    `<g class="pA"><g fill="${PAL.O}">${patte(49)}${patte(85)}</g></g>` +
    `<g class="pB"><g fill="${PAL.O}">${patte(63)}</g><g fill="${PAL.o}">${patte(98)}</g></g>` +
    `</g></g>`
  )
}

/**
 * Son déguisement sur son visage de profil (dans le repère de `profil`), par-dessus ses yeux : lunettes ou cernes ; rien
 * sous sa visière (elle, sa sueur et son insigne sont dessinés avant ses yeux, voir `profil`)
 */
function visageProfil(): string {
  const r = (x: number, y: number, w: number, h: number, c: string) => R(x, y, w, h, c)
  if (visiere) return ''
  if (deguisement === 'lunettes')
    return r(46, 59, 13, 10, PAL.K!) + r(73, 59, 13, 10, PAL.K!) + r(59, 61, 47, 3, PAL.K!) + r(48, 61, 2, 2, PAL.W!) + r(75, 61, 2, 2, PAL.W!)
  if (deguisement === 'cernes') return r(48, 70, 9, 3, PAL.M!) + r(75, 70, 9, 3, PAL.M!)
  return ''
}

/** Retourne un dessin autour de l'axe de Clawd (x = 90) : il regarde à droite. */
const miroir = (svg: string) => `<g transform="translate(${2 * (X0 + 36)} 0) scale(-1 1)">${svg}</g>`

// ------------------------------------------------------------- accessoires

const TASSE = ['nNNNn..', 'WWWWWWW', 'WWWWW.W', 'WWWWWWW', 'WWWWW..', '.WWW...']
const VAPEUR = [['w.', '.w', 'w.'], ['.w', 'w.', '.w']]
const LIVRE = ['.WWWWnWWWW.', 'WGGGWnWGGGW', 'WWWWWnWWWWW', 'WGGWWnWGGWW', 'bbbbbbbbbbb']
const LIVRE_PAGE = ['.....W.....', '.WWWWWWWWW.', 'WGGGWWWGGGW', 'WWWWWnWWWWW', 'bbbbbbbbbbb']
const BALLE = (c: string) => [c + c, c + c]
const ANNEAU = ['.ww.', 'w..w', 'w..w', '.ww.']
const BULLE = ['.BB.', 'B..B', 'B..B', '.BB.']
const BOUCHON = ['W', 'R']
const POISSON = ['..Y..', 'YYYY.Y', 'YKYYYY', 'YYYY.Y', '..Y..']
const YOYO = ['.R.', 'RRR', '.R.']
const GUITARE = [
  '...........nn',
  '..........n..',
  '.........n...',
  'NNNN....n....',
  'NNNNN..n.....',
  'NNKNNnn......',
  'NNNNN........',
  '.NNN.........',
]
const ARROSOIR = ['G......', 'GGGGG.G', 'GGGGGG.', 'GGGGG..']
const POT = ['NNNNNN', '.NNNN.', '.NNNN.']
const POUSSE = [['..V..', '..V..'], ['VV.VV', '.VVV.', '..V..', '..V..'], ['..P..', '.PYP.', '..P..', 'VVVVV', '.VVV.', '..V..', '..V..']]
const BALLON = ['.RR.', 'RRWR', 'RRRR', '.RR.']
const PAPILLON = [['P.P', 'PYP', 'P.P'], ['.P.', '.Y.', '.P.']]
const COOKIE = ['.NNN.', 'NnNnN', 'NNNNN', 'NNnNN', '.NNN.']
const GLACE = ['.PPP.', 'PPPPP', 'PPPPP', '.NnN.', '..N..', '..N..']
const GLACE_LECHEE = ['.....', '.PPP.', 'PPPPP', '.NnN.', '..N..', '..N..']
const GLACE_RESTE = ['.....', '.....', '.PPP.', '.NnN.', '..N..', '..N..']
const COOKIE_CROQUE = ['.NN..', 'NnN..', 'NNNN.', 'NNnNN', '.NNN.']
const CRAYON = ['....P', '...Y.', '..Y..', '.Y...', 'K....']
const LOUPE = ['.GGG.', 'G...G', 'G...G', 'G...G', '.GGG.', '....N', '.....N']
const MARTEAU_HAUT = ['GGGG', 'GGGG', '.N..', '.N..', '.N..']
const MARTEAU_BAS = ['..GG', 'NNGG', '..GG']
const BRIQUE = ['RRRRRR', 'RRwRRR', 'RRRRRR']
// le sifflet du chef : la chambre ronde à gauche, l'embout dans sa bouche
const SIFFLET = ['.GGG.....', 'GwwwGGGGG', 'GwKwwwwwG', 'GwwwGGGGG', '.GGG.....']
const PLANCHETTE = ['..gg..', 'NNNNNN', 'NWWWWN', 'NWWWWN', 'NWWWWN', 'NWWWWN', 'NNNNNN']
const AVION = ['W.....', 'WWW...', 'WWWWWW', 'wWW...', 'w.....']
const TEL = ['gggg', 'gBBg', 'gBBg', 'gBBg', 'gBBg', 'gggg']
const COPAIN = ['.OOOO.', 'OKOOKO', 'OOOOOO', '.O..O.']
const COEUR = ['.PP.PP.', 'PPPPPPP', 'PPPPPPP', '.PPPPP.', '..PPP..', '...P...']
const NUAGE = ['..GGG...', '.GGGGGG.', 'GGGGGGGG', '.GGGGGG.']
const BONNET = ['.......W', '.....bb.', '...bbbb.', '.bbbbbb.', 'bbbbbbbb']
const ETOILE = ['.Y.', 'YYY', '.Y.']
// un verre d'eau : bord clair, eau bleue avec un reflet, fond plus épais
const VERRE = ['wBBBBw', 'wBWBBw', 'wBWBBw', 'wBBBBw', 'wbbbbw', '.wwww.']
const VERRE_BU = ['w....w', 'w....w', 'wBWBBw', 'wBBBBw', 'wbbbbw', '.wwww.']
// un jus de fin de semaine : son petit parasol, la paille, la citronnade et un glaçon
const JUS = ['.LLL...', 'LLLLL..', '..n.W..', 'w.nYWw.', 'wYnYWw.', 'wYYWYw.', 'wYYYYw.', '.wwww..']
const JUS_BU = ['.LLL...', 'LLLLL..', '..n.W..', 'w.n.Ww.', 'w.n.Ww.', 'wYYWYw.', 'wYYYYw.', '.wwww..']
// un bonbon d'Halloween dans son papier (9×5 en pixels de 2), et à peine écrasé en touchant le sol
const BONBON = ['L.......L', 'LL.QQQ.LL', 'LLQQWQQLL', 'LL.QQQ.LL', 'L.......L']
const BONBON_SOL = ['L.........L', 'LL.QQQQQ.LL', 'LLQQQWQQQLL', 'L.........L']
const NOTE = ['..YY', '..Y.', '..Y.', 'YYY.', 'YYY.']
// Compactage : la conversation est une pile de feuilles en vrac, vue de côté
// (`n` feuilles, une ligne blanche et une grise chacune, décalées), qu'il
// écrase en sautant dessus, et dont il fait un petit paquet ficelé.
function feuilles(n: number): string[] {
  const decale = [3, 0, 4, 1, 5, 2, 3]
  return Array.from({ length: n }, (_, i) => {
    const o = decale[i % decale.length]!
    const l = 24 - (i % 3)
    return ['.'.repeat(o) + 'W'.repeat(l), '.'.repeat(o) + 'w'.repeat(l)]
  }).flat()
}
const PILE_ECRASEE = ['.WWWWWWWWWWWWWWWWWWWWWWWWWW.', 'wwwwwwwwwwwwwwwwwwwwwwwwwwww', 'WWWWWWWWWWWWWWWWWWWWWWWWWWWW', '.wwwwwwwwwwwwwwwwwwwwwwwwww.']
const PAQUET = [
  '.....RR.RR.....',
  '......RRR......',
  'WWWWWWWRWWWWWWW',
  'wwwwwwwRwwwwwww',
  'WWWWWWWRWWWWWWW',
  'RRRRRRRRRRRRRRR',
  'WWWWWWWRWWWWWWW',
  'wwwwwwwRwwwwwww',
]
const FEUILLE = ['WWW', 'www']
// Une question pour toi : il brandit une pancarte « ? »
const PANCARTE = [
  'GGGGGGGGGGGGG',
  'GWWWWWWWWWWWG',
  'GWWWbbbbbWWWG',
  'GWWbbWWWbbWWG',
  'GWWWWWWWbbWWG',
  'GWWWWWbbbWWWG',
  'GWWWWWbbWWWWG',
  'GWWWWWWWWWWWG',
  'GWWWWWbbWWWWG',
  'GWWWWWWWWWWWG',
  'GGGGGGGGGGGGG',
  '......NN.....',
  '......NN.....',
  '......NN.....',
]
// Il attend ta permission : un petit cadenas à côté de sa patte levée
const CADENAS = ['.GGG.', 'G...G', 'G...G', 'YYYYY', 'YYKYY', 'YYYYY']
// Des dépendances s'installent : il déballe un carton ouvert (rabats levés,
// sans scotch), d'où sortent des petits paquets de toutes les couleurs
const CARTON_OUVERT = [
  '..HH.........HH..',
  '..HH.........HH..',
  '..HHDDDDDDDDDHHDD',
  '..DnnnnnnnnnnnnDD',
  '.DnnnnnnnnnnnnDcD',
  'DDDDDDDDDDDDDDccD',
  'DCCCCCCCCCCCCDccD',
  'DCCCCCCCCCCCCDccD',
  'DCCCCCCCCCCCCDccD',
  'DCCCCCCCCCCCCDccD',
  'DCCCCCCCCCCCCDccD',
  'DCCCCCCCCWWWCDccD',
  'DCCCCCCCCwwWCDccD',
  'DCCCCCCCCCCCCDccD',
  'DCCCCCCCCCCCCDcD.',
  'DCCCCCCCCCCCCDD..',
  'DDDDDDDDDDDDDD...',
]
const PETIT_PAQUET = (c: string) => [c + c, c + c]
// Un conflit git : le grand carton derrière lequel il se cache, plus large
// que lui (pixels de 3), même kraft que ses cartons de déménagement
const GRAND_CARTON = [
  '...DDDDDDDDSSDDDDDDDD',
  '..DHHHHHHHSSHHHHHHHDD',
  '.DHHHHHHSSHHHHHHHHDcD',
  'DDDDDDDSSDDDDDDDDDccD',
  'DCCCCCCssCCCCCCCCDccD',
  'DCCCCCCssCCCCCCCCDccD',
  'DCCCCCCssCCCCCCCCDccD',
  'DCCCCCCCCCCCCCCCCDccD',
  'DCCCCCCCCCCCWWWCCDccD',
  'DCCCCCCCCCCCwwWCCDccD',
  'DCCCCCCCCCCCCCCCCDcD.',
  'DCCCCCCCCCCCCCCCCDD..',
  'DDDDDDDDDDDDDDDDDD...',
]
// Carton de déménagement vu de trois quarts : dessus éclairé, côté à l'ombre,
// scotch sur la fente des rabats, étiquette d'expédition (pixels de 2)
const CARTON = [
  '...DDDDDDSSDDDDDD',
  '..DHHHHHSSHHHHHDD',
  '.DHHHHHSSHHHHHDcD',
  'DDDDDDSSDDDDDDccD',
  'DCCCCCssCCCCCDccD',
  'DCCCCCssCCCCCDccD',
  'DCCCCCssCCCCCDccD',
  'DCCCCCCCCCCCCDccD',
  'DCCCCCCCCCCCCDccD',
  'DCCCCCCCCWWWCDccD',
  'DCCCCCCCCwwWCDccD',
  'DCCCCCCCCCCCCDccD',
  'DCCCCCCCCCCCCDcD.',
  'DCCCCCCCCCCCCDD..',
  'DDDDDDDDDDDDDD...',
]

// ---------------------------------------------------------- effets en CSS

const effets = {
  notes: () =>
    `<g class="monte">${A(NOTE, -26, -6, 2)}</g><g class="monte" style="animation-delay:.9s">${A(NOTE, 84, -12, 2)}</g>`,
  zzz: () =>
    glyphe('z', 62, -4, 9, '#9FB3B3', 'monte') + glyphe('z', 70, -12, 11, '#9FB3B3', 'monte', 0.6) + glyphe('Z', 78, -20, 13, '#9FB3B3', 'monte', 1.2),
  coeurs: () =>
    `<g class="monte">${A(COEUR, -18, -8, 2)}</g><g class="monte" style="animation-delay:.7s">${A(COEUR, 78, -14, 2)}</g>`,
  confettis: () =>
    [[-40, 'Y'], [-20, 'P'], [0, 'B'], [20, 'V'], [44, 'R'], [66, 'Y'], [88, 'L'], [106, 'B']]
      .map(([x, c], i) => `<g class="confetti" style="animation-delay:${(i * 0.17).toFixed(2)}s">${R(X0 + Number(x), 4, 4, 4, PAL[String(c)]!)}</g>`)
      .join(''),
  sueur: () => `<g class="tombe">${A(['B', 'B'], 62, -2, 3)}</g>`,
  etincelles: () =>
    [[-24, -6], [92, -14], [10, -30], [70, -34]]
      .map(([x, y], i) => `<g class="scintille" style="animation-delay:${i * 0.2}s">${A(ETOILE, x!, y!, 2)}</g>`)
      .join(''),
  zen: () =>
    [[-20, 10], [84, 4], [30, -26]]
      .map(([x, y], i) => `<g class="scintille" style="animation-delay:${i * 0.4}s">${A(['.L.', 'LLL', '.L.'], x!, y!, 2)}</g>`)
      .join(''),
  bulles: () =>
    [[56, -26, 0], [70, -20, 0.7], [62, -30, 1.4]]
      .map(([x, y, d]) => `<g class="monte" style="animation-delay:${d}s">${A(BULLE, x!, y!, 2)}</g>`)
      .join(''),
  // au moment où il retombe sur la pile (0,5 s dans sa boucle de 1,5 s)
  feuilles: () =>
    ([[4, 30, 'g'], [62, 30, 'd'], [26, 28, 'g'], [44, 29, 'd']] as const)
      .map(([x, y, sens], i) => `<g class="vole-${sens}" style="animation-delay:${(0.5 + i * 0.04).toFixed(2)}s">${A(FEUILLE, x, y, 2)}</g>`)
      .join(''),
  // ce qu'il sort du carton et lance par-dessus son épaule (0,8 s dans sa boucle)
  deballe: () =>
    ([['d', 'B', 0.8], ['h', 'V', 0.86], ['d', 'R', 0.92]] as const)
      .map(([sens, c, d]) => `<g class="lance-${sens}" style="animation-delay:${d}s">${A(PETIT_PAQUET(c), 34, 14, 2)}</g>`)
      .join(''),
  cadenas: () => `<g class="scintille">${A(CADENAS, 76, -22, 2)}</g>`,
}

// --------------------------------------------------------------- scènes

/**
 * Un segment de chorégraphie : des images jouées à intervalles réguliers
 * pendant `duree` secondes, pendant que Clawd va de `de` à `a` (en unités de
 * la toile, par rapport à sa place au bord droit ; immobile par défaut).
 */
type Segment = {
  duree: number
  images: string[]
  /** combien de fois la liste d'images défile pendant le segment (défaut 1) */
  tours?: number
  de?: number
  a?: number
}

/** Un élément du décor de sa petite scène. */
type Decor = {
  svg: string
  /** visible seulement pendant ces fenêtres [début, fin] (s) ; tout le temps sinon */
  visible?: [number, number][]
}

type Scene = {
  images: string[]
  duree: number
  cls?: string
  fx?: string
  /** scène chorégraphiée : il se déplace sur sa petite scène */
  choreo?: Segment[]
  /** décor fixe de sa petite scène (chorégraphies) */
  decor?: Decor[]
  /**
   * Deux personnages qui jouent ensemble (le rapport) : un calque chacun, une
   * image par tranche comme `images` (qui les superpose, pour la planche).
   * Chaque pose n'est écrite qu'une fois, visible dans toutes ses tranches.
   */
  calques?: { images: string[]; cls?: string }[]
  /** ce que ses images reprennent plusieurs fois (<use>), écrit une seule fois */
  defs?: string
  /** le style de ce qui bouge à côté de lui (un visiteur, voir `passant`), calé sur sa scène */
  css?: string
  /** une classe pour ses mini-Clawds au travail (ils réagissent à la scène) */
  minis?: string
}

const rep = (n: number, f: (i: number) => string) => Array.from({ length: n }, (_, i) => f(i))

// Une parabole d'une image clé à la suivante : en montant, la vitesse décroît comme sous la pesanteur (ease-out
// quadratique exact), en descendant elle croît (ease-in quadratique)
const MONTE = 'cubic-bezier(.33,.67,.67,1)'
const TOMBE = 'cubic-bezier(.33,0,.67,.33)'
const pourcent = (x: number) => `${+x.toFixed(2)}%`

/** Une scène chorégraphiée à partir de ses segments. */
const choreo = (segments: Segment[], extra: Partial<Scene> = {}): Scene => ({
  images: [...new Set(segments.flatMap(s => s.images))],
  // arrondie, pour que les durées calculées (trajets) ne laissent pas 48.5999… dans le CSS
  duree: +segments.reduce((t, s) => t + s.duree, 0).toFixed(3),
  choreo: segments,
  ...extra,
})

// Le carton (34×30) : de face, il le tient devant lui à deux pinces (ses yeux
// dépassent juste au-dessus) ; de profil, il lâche sa canne pour le porter.
// Son dessin n'est écrit qu'une fois par SVG (voir `reutilises`), puis repris.
const CARTON_DEF = `<g id="carton">${art(CARTON, 0, 0, 2)}</g>`
const CARTON_OUVERT_DEF = `<g id="carton-ouvert">${art(CARTON_OUVERT, 0, 0, 2)}</g>`
const cartonOuvert = (dx: number, dy: number) => `<use href="#carton-ouvert" x="${X0 + dx}" y="${Y0 + dy}"/>`
const carton = (dx: number, dy: number) => `<use href="#carton" x="${X0 + dx}" y="${Y0 + dy}"/>`
const CARTON_X = 19
const ombreSol = (dx: number, l: number) => `<rect class="ombre" x="${X0 + dx}" y="${Y0 + 48}" width="${l}" height="2"/>`
const pinces = (dy: number) => R(X0 + CARTON_X - 3, Y0 + dy, 6, 6, PAL.O!) + R(X0 + CARTON_X + 31, Y0 + dy, 6, 6, PAL.O!)
const porteFace = (p: Pose = {}) => corps({ g: 'devant', d: 'devant', ...p }) + carton(CARTON_X, 12 + (p.dy ?? 0)) + pinces(24 + (p.dy ?? 0))

// De profil, le carton est devant lui, côté `g` (il regarde à gauche) ou `d`.
// Le dessin du carton n'est jamais retourné : il garde le même aspect dans
// ses pinces et sur la pile.
type Cote = 'g' | 'd'
const DEVANT: Record<Cote, number> = { g: -22, d: 60 }
const pince = (cote: Cote, x: number, y: number) => R(X0 + (cote === 'g' ? x : 60 - x), Y0 + y, 12, 6, PAL.O!)
// immobile, son profil sans canne revient dans presque chaque image : il n'est
// écrit qu'une fois par SVG, lui aussi
// (redessiné à chaque fois : il porte peut-être son déguisement du jour)
const profilDef = () => `<g id="profil">${profil('', false)}</g>`
// de face, les yeux en l'air (il regarde les cartons tomber) : écrit une fois, repris dans chaque image de la chute
const leveDef = () => `<g id="leve">${corps({ yeux: 'haut' })}</g>`
const deProfil = (cote: Cote, pas: '' | 'vite' | 'lent' = '') => {
  const p = pas ? profil(pas, false) : '<use href="#profil"/>'
  return cote === 'g' ? p : miroir(p)
}
/** Il le tient par le côté, à la hauteur `dy` (18 : posé par terre, -12 : sur l'autre) */
const tient = (cote: Cote, dy: number, prise = true) =>
  (dy === 18 ? ombreSol(DEVANT[cote], 34) : '') + deProfil(cote) + carton(DEVANT[cote], dy) + (prise ? pince(cote, 8, dy + 16) : '')
/** Il le soutient par-dessous, bras levé, pour le hisser sur la pile ou l'en descendre */
const hisse = (cote: Cote, dy: number) => deProfil(cote) + carton(DEVANT[cote], dy) + pince(cote, 4, dy + 28)
/** Il marche chargé : plus lentement, et le carton cahote à chaque pas */
const charge = (cote: Cote) => deProfil(cote, 'lent') + `<g class="cahote">${carton(DEVANT[cote], 6)}${pince(cote, 8, 22)}</g>`
/** De trois quarts, en plein demi-tour : le carton passe devant lui */
const porte3q = (cote: Cote) =>
  corps({ vue: cote === 'g' ? 'cote' : 'coteD' }) + carton(cote === 'g' ? -2 : 40, 9) + R(X0 + (cote === 'g' ? 28 : 36), Y0 + 21, 8, 6, PAL.O!)

// Un demi-tour passe par chaque orientation : profil, trois quarts, face,
// trois quarts, profil. Le carton le suit d'un côté à l'autre au lieu de sauter.
const ORIENTATIONS = ['g', 'cg', 'f', 'cd', 'd'] as const
type Orientation = (typeof ORIENTATIONS)[number]
/** Les images entre deux orientations (elles exclues), carton en main ou non */
function tourne(de: Orientation, vers: Orientation, avecCarton: boolean): string[] {
  const i = ORIENTATIONS.indexOf(de)
  const j = ORIENTATIONS.indexOf(vers)
  const sens = Math.sign(j - i)
  const yeux: Yeux = sens < 0 ? 'gauche' : 'droite'
  const images: string[] = []
  for (let k = i + sens; k !== j; k += sens) {
    const o = ORIENTATIONS[k]!
    if (o === 'f') images.push(avecCarton ? porteFace({ yeux }) : corps({ yeux }))
    else images.push(avecCarton ? porte3q(o === 'cg' ? 'g' : 'd') : corps({ vue: o === 'cg' ? 'cote' : 'coteD' }))
  }
  return images
}

/**
 * Ses deux piles de trois cartons en pyramide (deux au sol, un dessus) : chez
 * lui à droite, là-bas à gauche. Pour chaque place : où est le carton, et de
 * quel côté Clawd se tourne pour l'attraper. Les places du sol d'abord : le
 * carton du dessus se dessine par-dessus elles.
 */
type Place = 'ici1' | 'ici2' | 'labas1' | 'labas2' | 'iciHaut' | 'labasHaut'
const PLACES: Record<Place, { dx: number; cote: Cote; haut?: boolean }> = {
  ici1: { dx: 50, cote: 'd' },
  ici2: { dx: 84, cote: 'd' },
  labas1: { dx: -88, cote: 'g' },
  labas2: { dx: -122, cote: 'g' },
  iciHaut: { dx: 67, cote: 'd', haut: true },
  labasHaut: { dx: -105, cote: 'g', haut: true },
}
/** Où il se tient pour avoir le carton de cette place juste devant lui */
const devantPlace = (p: Place) => PLACES[p].dx - DEVANT[PLACES[p].cote]

/** `pousse` : les places dont il pousse les cartons hors de la bande (elles se vident au début de l'étape) */
type Etape = Segment & { prend?: Place; pose?: Place; pousse?: Place[] }

/**
 * Quand un carton repose à chaque place : il la quitte au début de l'étape où
 * Clawd le prend (ou la pousse), et l'occupe à la fin de celle où il le pose.
 * Au début de la boucle, aucun : ils lui tombent du ciel.
 */
function occupation(etapes: readonly Etape[]): Record<Place, [number, number][]> {
  const depuis = {} as Record<Place, number | null>
  const vu = {} as Record<Place, [number, number][]>
  for (const p of Object.keys(PLACES) as Place[]) {
    depuis[p] = null
    vu[p] = []
  }
  let t = 0
  for (const e of etapes) {
    for (const p of [...(e.prend ? [e.prend] : []), ...(e.pousse ?? [])]) {
      if (depuis[p] === null) continue
      vu[p].push([depuis[p]!, t])
      depuis[p] = null
    }
    t += e.duree
    if (e.pose) depuis[e.pose] = t
  }
  for (const p of Object.keys(depuis) as Place[]) if (depuis[p] !== null) vu[p].push([depuis[p]!, t])
  return vu
}

/** Le carton qui repose à cette place (et son ombre au sol) */
const posePlace = (p: Place) => (PLACES[p].haut ? '' : ombreSol(PLACES[p].dx, 34)) + carton(PLACES[p].dx, PLACES[p].haut ? -12 : 18)

// vitesse de marche au travail, chargé ou à vide (unités de la toile par seconde)
const CHARGE = 32
const VIDE = 52

/**
 * Son déménagement, étape par étape (une boucle). Trois cartons neufs lui
 * tombent du ciel à gauche pendant qu'il les regarde de chez lui ; il va les
 * chercher et les déménage chez lui, un par un (il soulève, porte en
 * cahotant, pose, hisse le dernier sur les deux autres) ; puis il livre : il
 * pousse la pile hors du cadre, à droite, s'essuie le front et rentre. La
 * boucle commence et finit chez lui, de face, sans carton, là où ses autres
 * scènes le laissent : il s'y met et s'en va sans sauter d'un bout à l'autre,
 * et jamais il ne rapporte ce qu'il vient de déménager.
 */
function etapesBoulot(): Etape[] {
  const f = corps
  // un demi-tour : une image toutes les 0,1 s
  const demiTour = (de: Orientation, vers: Orientation, avecCarton: boolean): Etape => {
    const images = tourne(de, vers, avecCarton)
    return { duree: 0.1 * images.length, images }
  }
  /** Un voyage : il prend le carton, le porte, le pose, puis repart à vide vers `ensuite` */
  const voyage = (de: Place, vers: Place, ensuite?: Place): Etape[] => {
    const p = PLACES[de]
    const q = PLACES[vers]
    const x0 = devantPlace(de)
    const x1 = devantPlace(vers)
    const etapes: Etape[] = [
      {
        duree: 0.7,
        images: p.haut
          ? [hisse(p.cote, -12), hisse(p.cote, -6), hisse(p.cote, 0), tient(p.cote, 6)]
          : [tient(p.cote, 18), tient(p.cote, 14), tient(p.cote, 10), tient(p.cote, 6)],
        de: x0,
        a: x0,
        prend: de,
      },
      demiTour(p.cote, q.cote, true),
      { duree: Math.abs(x1 - x0) / CHARGE, images: [charge(q.cote)], de: x0, a: x1 },
      {
        duree: 0.8,
        images: q.haut
          ? [hisse(q.cote, 0), hisse(q.cote, -6), hisse(q.cote, -12), tient(q.cote, -12, false)]
          : [tient(q.cote, 10), tient(q.cote, 14), tient(q.cote, 18), tient(q.cote, 18, false)],
        pose: vers,
      },
    ]
    if (ensuite) {
      const x2 = devantPlace(ensuite)
      const cote = PLACES[ensuite].cote
      etapes.push(demiTour(q.cote, cote, false), { duree: Math.abs(x2 - x1) / VIDE, images: [deProfil(cote, 'vite')], de: x1, a: x2 })
    }
    return etapes
  }
  // chez lui (sa place dans toutes ses scènes), devant la pile de gauche, et là où il hisse le dernier carton
  const xRepos = 0
  const xLabas = devantPlace('labasHaut')
  const xChez = devantPlace('iciHaut')
  // trois cartons neufs tombent là-bas, un par un : il les regarde arriver de chez lui, et saute de joie
  const leve = '<use href="#leve"/>'
  const tombe = (p: Place): Etape => {
    const { dx, haut } = PLACES[p]
    const rel = dx - xRepos
    const fin = haut ? -12 : 18
    return { duree: 0.45, images: [-56, -20, fin].map(dy => leve + carton(rel, dy) + (dy === fin && !haut ? ombreSol(rel, 34) : '')), pose: p }
  }
  const arrivee: Etape[] = [
    { duree: 0.4, images: [leve] },
    tombe('labas2'),
    tombe('labas1'),
    tombe('labasHaut'),
    { duree: 0.6, images: [f({ dy: -8, jambes: 'replie', g: 'haut', d: 'haut', yeux: 'heureux' }), f({ yeux: 'heureux' })] },
  ]
  const aller: Etape[] = [demiTour('f', 'g', false), { duree: (xRepos - xLabas) / VIDE, images: [deProfil('g', 'vite')], de: xRepos, a: xLabas }]
  // la pile de chez lui, dessinée par rapport à lui (`rel` : le bord gauche du carton du sol le plus proche)
  const pile = (rel: number) => ombreSol(rel, 34) + ombreSol(rel + 34, 34) + carton(rel, 18) + carton(rel + 34, 18) + carton(rel + 17, -12)
  const pousse = (rel: number) => deProfil('d') + pile(rel) + pince('d', 2, 24)
  // la livraison : il recule contre la pile, la pousse, lui donne un dernier élan, et elle sort du cadre à droite
  const xContre = PLACES.ici1.dx - DEVANT.d - 8
  const xLache = xContre + 40
  const relPile = PLACES.ici1.dx - xContre
  const livre: Etape[] = [
    { duree: (xChez - xContre) / VIDE, images: [deProfil('d', 'lent')], de: xChez, a: xContre },
    { duree: (xLache - xContre) / (CHARGE * 0.8), images: [pousse(relPile)], de: xContre, a: xLache, pousse: ['ici1', 'ici2', 'iciHaut'] },
    { duree: 0.75, images: [18, 60, 120].map(d => pousse(relPile + d)) },
  ]
  // ouf : il s'essuie le front, et rentre chez lui
  const retour: Etape[] = [
    demiTour('d', 'f', false),
    { duree: 1.2, images: [f({ d: 'tete', yeux: 'ferme' }), f({ d: 'tete', yeux: 'ferme', dy: 1 }), f({ yeux: 'heureux' })] },
    demiTour('f', 'g', false),
    { duree: (xLache - xRepos) / VIDE, images: [deProfil('g', 'vite')], de: xLache, a: xRepos },
    demiTour('g', 'f', false),
  ]
  return [
    ...arrivee,
    ...aller,
    // de là-bas à chez lui : celui du dessus d'abord, puis ceux du sol
    ...voyage('labasHaut', 'ici2', 'labas1'),
    ...voyage('labas1', 'ici1', 'labas2'),
    ...voyage('labas2', 'iciHaut'),
    ...livre,
    ...retour,
  ]
}

/** Les étapes de son déménagement sans leurs images (leurs durées, ses trajets, ses cartons), faites une fois */
let squelette: { etapes: Etape[]; T: number } | null = null
const squeletteBoulot = () => {
  if (!squelette) {
    const etapes = etapesBoulot()
    squelette = { etapes, T: +etapes.reduce((t, e) => t + e.duree, 0).toFixed(3) }
  }
  return squelette
}

/**
 * Où en est son déménagement après `deja` secondes : où il est, et ses
 * cartons tels qu'ils sont, pour jouer là une scène qui l'interrompt (puis
 * reprendre pile où il était). Le carton qu'il porte, il le pose à côté de
 * lui ; celui qu'il soulève ou qu'il pose est à sa place. La pile qu'il
 * pousse est déjà partie.
 */
export function etatBoulot(deja: number): EnPlace {
  const { etapes, T } = squeletteBoulot()
  const t = ((deja % T) + T) % T
  const occupee = new Set<Place>()
  let x = 0
  let tenu: Place | null = null
  let cote: Cote = 'g'
  let acc = 0
  for (const e of etapes) {
    const fin = acc + e.duree
    const de = e.de ?? x
    const a = e.a ?? de
    if (a !== de) cote = a > de ? 'd' : 'g'
    for (const p of e.pousse ?? []) occupee.delete(p)
    if (t < fin) {
      x = de + (a - de) * Math.min(1, Math.max(0, (t - acc) / e.duree))
      // en train de le poser : il est à sa place
      if (e.pose) {
        occupee.add(e.pose)
        tenu = null
      }
      // en train de le soulever : il n'a pas encore quitté sa place
      if (e.prend) tenu = null
      break
    }
    if (e.prend) {
      occupee.delete(e.prend)
      tenu = e.prend
    }
    if (e.pose) {
      occupee.add(e.pose)
      tenu = null
    }
    x = a
    acc = fin
  }
  // posé par terre à côté de lui, du côté où il allait ; s'il y a déjà une pile là, de l'autre côté
  let posePorte = ''
  if (tenu) {
    const au = (c: Cote) => +(x + (c === 'd' ? 60 : -38)).toFixed(1)
    const libre = (gx: number) => [...occupee].every(p => PLACES[p].haut || Math.abs(PLACES[p].dx - gx) >= 34)
    const gx = libre(au(cote)) ? au(cote) : au(cote === 'd' ? 'g' : 'd')
    posePorte = ombreSol(gx, 34) + carton(gx, 18)
  }
  const ordre = (Object.keys(PLACES) as Place[]).filter(p => occupee.has(p))
  return { x: +x.toFixed(1), decor: ordre.map(posePlace).join('') + posePorte }
}

/** La durée d'une boucle de son déménagement (s) */
export const dureeBoulot = () => squeletteBoulot().T

// Sa cachette pendant un conflit git : le grand carton posé devant lui (le
// bord du haut au niveau de ses yeux quand il se hisse) ; tapi derrière, il
// agrippe ses pinces au bord de devant, et une goutte de sueur perle au-dessus de sa tête
const abri = (agrippe: boolean) =>
  art(GRAND_CARTON, X0 + 3, Y0 + 9, 3) +
  (agrippe ? `<g class="tremble">${R(X0 + 15, Y0 + 15, 6, 6, PAL.O!)}${R(X0 + 42, Y0 + 15, 6, 6, PAL.O!)}</g><g class="tombe">${A(['B', 'B'], 66, -2, 3)}</g>` : '')
/** Tapi derrière le carton : seul le haut de sa tête dépasse */
const tapi = () => corps({ dy: 4, jambes: 'assis', g: 'cache', d: 'cache', yeux: 'ferme' })
/** Hissé sur la pointe des pieds, les yeux juste au-dessus du bord */
const guette = (yeux: Yeux) => corps({ dy: -3, g: 'cache', d: 'cache', yeux })

// ------------------------------------------------- ses jeux de cartons

// De temps en temps pendant son déménagement, un carton de plus lui tombe du
// ciel, juste devant lui, et il en fait autre chose que le porter : il l'ouvre
// (un diable à ressort en jaillit, ou des cartons gigognes jusqu'à un tout petit
// cœur), il en joue comme d'un tambour, ou il monte dessus en vainqueur… et le
// carton cède. Chacun se joue une fois, là où il en est, au milieu de ses
// cartons (register.tsx en tire un de temps en temps, jamais deux fois le même
// de suite), puis le carton s'en va et son déménagement reprend.

/** Ses jeux de cartons */
export const JEUX_CARTONS: readonly ClawdAnim[] = ['colis', 'gigogne', 'tambour', 'podium']
/** Une image de ses jeux de cartons (s) : leurs gestes vifs ; une pose qui dure est répétée */
const JEU_PAS = 0.15
const fois = (n: number, img: string) => Array<string>(n).fill(img)

// la tête du diable à ressort (pixels de 2) : bonnet de bouffon à grelots, nez rouge, grand sourire
const DIABLE = ['Y.......Y', 'R.......L', 'RR.....LL', '.RRR.LLL.', '..RRLLL..', '.WWWWWWW.', 'WWKWWWKWW', 'WWWWRWWWW', 'WRWWWWWRW', '.WRRRRRW.', '..WWWWW..']
// la poussière soulevée par un carton qui touche le sol ; le scotch qu'il arrache
const POUSSIERE = ['.w.', 'www']
const SCOTCH = ['SS..', '.SS.', '..SS']

/** Le carton du jeu, posé devant lui : fermé, ou ouvert (ses rabats levés, sur la même base) */
const cartonJeu = carton(CARTON_X, 18)
const cartonJeuOuvert = cartonOuvert(CARTON_X, 14)
/** Un carton à l'échelle `k`, son coin haut-gauche en (`dx`, `dy`) : les cartons gigognes */
const boite = (dx: number, dy: number, k: number, ouvert = false) =>
  `<g transform="translate(${X0 + dx} ${Y0 + dy}) scale(${k})"><use href="#${ouvert ? 'carton-ouvert' : 'carton'}"/></g>`
/** Ses deux pinces de part et d'autre de ce qu'il tient devant lui (de `x0` à `x1`), à la hauteur `dy` */
const tientDevant = (x0: number, x1: number, dy: number) => R(X0 + x0 - 5, Y0 + dy, 6, 6, PAL.O!) + R(X0 + x1 - 1, Y0 + dy, 6, 6, PAL.O!)

/**
 * Un carton lui tombe du ciel juste devant lui (sa chute : `.<jeu>-tombe`, voir `jeu`) : il le regarde arriver,
 * sursaute quand il touche le sol, le regarde (6 images)
 */
const arriveCarton = (nom: string) => [
  ...fois(2, corps({ yeux: 'haut' }) + `<g class="${nom}-tombe">${cartonJeu}</g>`),
  corps({ yeux: 'grand', bouche: 'o' }) + cartonJeu + A(POUSSIERE, 12, 44, 2) + A(POUSSIERE, 54, 44, 2),
  corps({ yeux: 'grand', dy: -3 }) + cartonJeu,
  ...fois(2, corps({ yeux: 'bas' }) + cartonJeu),
]
/** Il l'empoigne, arrache le scotch, et les rabats s'ouvrent : il se penche pour voir dedans (7 images) */
const ouvreCarton = () => [
  ...fois(2, corps({ g: 'devant', d: 'devant', yeux: 'bas', dy: 2 }) + cartonJeu + pinces(18)),
  ...fois(2, corps({ g: 'devant', d: 'ciel', yeux: 'heureux' }) + cartonJeu + A(SCOTCH, 62, -16, 2)),
  ...fois(3, corps({ g: 'devant', d: 'devant', yeux: 'bas', dy: 3 }) + cartonJeuOuvert + pinces(17)),
]

/**
 * Un point du trajet de ce qui s'en va : `t` s après son départ, en (`x`, `y`) px, tourné de `tour` degrés ; `allure`
 * : celle de sa hauteur jusqu'au point suivant (de côté, il va d'un pas régulier)
 */
type Point = [t: number, x: number, y: number, tour: number, allure?: string]
/**
 * Ce qui s'en va de sa scène (le carton qui saute tout seul, celui qu'il
 * fait décoller ou qu'il lance) : immobile jusqu'à `debut` (s), puis le long
 * de `chemin`, et il reste où il finit (hors du cadre). Deux pistes, comme un
 * objet lancé (de vraies paraboles) : `.<nom>` le mène de côté d'un pas
 * régulier, `.<nom>-y` le fait monter et retomber, en tournant sur lui-même.
 * Le même mouvement dans chaque image qui le montre (`enVa`), calé sur la
 * scène (`--t0`).
 */
function sEnVa(nom: string, T: number, debut: number, chemin: readonly Point[], allure = 'linear'): string {
  const p = (t: number) => pourcent(Math.min(100, ((debut + t) / T) * 100))
  const regle = (classe: string, tourne: boolean, cles: string) =>
    `.${classe}{${tourne ? 'transform-box:fill-box;transform-origin:center;' : ''}animation:${classe} ${T}s linear infinite;animation-delay:var(--t0,0s)}@keyframes ${classe}{${cles}}`
  const [, xf, yf, rf] = chemin[chemin.length - 1]!
  const haut = (y: number, r: number) => `transform:translateY(${y}px) rotate(${r}deg)`
  return (
    regle(nom, false, `0%,${p(0)}{transform:translateX(0)}${chemin.map(([t, x]) => `${p(t)}{transform:translateX(${x}px)}`).join('')}100%{transform:translateX(${xf}px)}`) +
    regle(
      `${nom}-y`,
      true,
      `0%,${p(0)}{${haut(0, 0)};animation-timing-function:${allure}}` +
        chemin.map(([t, , y, r, a]) => `${p(t)}{${haut(y, r)}${a ? `;animation-timing-function:${a}` : ''}}`).join('') +
        `100%{${haut(yf, rf)}}`,
    )
  )
}
/** Ce qui s'en va, dans une image (voir `sEnVa`) */
const enVa = (nom: string, svg: string) => `<g class="${nom}"><g class="${nom}-y">${svg}</g></g>`
/** Des bonds vers la droite, de plus en plus longs (`longueurs`, px), hauts de `haut` px, chacun en `t` s */
const bonds = (longueurs: readonly number[], haut: number, t: number): Point[] => {
  let x = 0
  return longueurs.flatMap((l, i) => {
    const pts: Point[] = [
      [t * i + t / 2, x + l / 2, -haut, 8, TOMBE],
      [t * (i + 1), x + l, 0, 0, MONTE],
    ]
    x += l
    return pts
  })
}
/** La durée d'un jeu (s) : une image toutes les JEU_PAS s */
const dureeJeu = (images: readonly string[]) => +(images.length * JEU_PAS).toFixed(2)
/**
 * La scène d'un jeu : ses images, chaque pose écrite une fois (un seul
 * calque, visible dans chacune de ses tranches) ; la chute du carton (ses
 * deux premières images, de 74 px plus haut, de plus en plus vite) et ce qui
 * s'en va (`css`), calés sur elle.
 */
const jeu = (nom: string, images: string[], extra: Partial<Scene> = {}): Scene => {
  const T = dureeJeu(images)
  const chute =
    `.${nom}-tombe{animation:${nom}-tombe ${T}s infinite;animation-delay:var(--t0,0s)}` +
    `@keyframes ${nom}-tombe{0%{transform:translateY(-74px);animation-timing-function:${TOMBE}}${pourcent(((2 * JEU_PAS) / T) * 100)},100%{transform:translateY(0)}}`
  return { duree: T, images, calques: [{ images }], ...extra, css: chute + (extra.css ?? '') }
}

// Le colis : il l'ouvre, et BOING, un diable à ressort lui jaillit sous le
// nez ; il sursaute, en rit, le renfonce dans le carton et le referme… et le
// carton s'en va tout seul vers la droite, à petits bonds de plus en plus
// longs, jusqu'à sortir du cadre. Il le regarde partir, et lui fait au revoir.
function colis(): Scene {
  const f = corps
  // sa tête et son ressort (11 spires) écrits une fois ; sorti de `n` spires, le ressort se tasse d'autant, monté du
  // fond du carton (dessiné avant lui, qui en cache le pied)
  const defs = `<defs><g id="diable">${art(DIABLE, 0, 0, 2)}</g><g id="ressort">${art(rep(11, i => (i % 2 ? '.GGG' : 'GGG.')), 0, 0, 2)}</g></defs>`
  const diable = (n: number) => {
    const haut = 20 - 2 * n
    // (le repère dans un groupe : le rendu de la séance de nuit ne lit pas `transform` sur un <use>)
    return `<g transform="translate(${X0 + 32} ${Y0 + haut}) scale(1 ${+(n / 11).toFixed(3)})"><use href="#ressort"/></g><use href="#diable" x="${X0 + 27}" y="${Y0 + haut - 22}"/>`
  }
  const avec = (p: Pose, n: number) => f(p) + diable(n) + cartonJeuOuvert
  const part = enVa('colis-part', cartonJeu)
  const avant = [
    ...arriveCarton('colis'),
    ...ouvreCarton(),
    // BOING : il sursaute, les bras au ciel ; le diable se balance au bout de son ressort
    avec({ g: 'ciel', d: 'ciel', yeux: 'grand', bouche: 'o', dy: -8 }, 11),
    avec({ g: 'ciel', d: 'ciel', yeux: 'grand', bouche: 'o', dy: -4 }, 7),
    avec({ g: 'haut', d: 'haut', yeux: 'grand', bouche: 'o' }, 10),
    avec({ g: 'haut', d: 'haut', yeux: 'grand' }, 8),
    // … puis il en rit
    ...[0, 1, 0, 1].map(i => avec({ yeux: 'heureux', dy: i }, 10 - i)),
    ...fois(2, avec({ yeux: 'clin' }, 10)),
    // il le renfonce à deux pinces, et referme le carton : le carton tremble
    ...fois(3, f({ g: 'devant', d: 'devant', yeux: 'bas', dy: 2 }) + diable(3) + cartonJeuOuvert + tientDevant(27, 45, -4)),
    ...fois(2, f({ yeux: 'bas' }) + `<g class="tremble">${cartonJeu}</g>`),
  ]
  const apres = [
    // il s'en va tout seul ! Clawd n'en revient pas, puis lui fait au revoir
    ...fois(3, f({ yeux: 'droite', bouche: 'o' }) + part),
    ...fois(8, f({ d: 'haut', yeux: 'heureux' }) + part),
  ]
  const images = [...avant, ...apres]
  return jeu('colis', images, { defs, css: sEnVa('colis-part', dureeJeu(images), avant.length * JEU_PAS, bonds([16, 24, 36, 54, 84], 10, 0.2), MONTE) })
}

// Les cartons gigognes : il l'ouvre, et en sort… un carton, plus petit. Il
// le regarde, sceptique, te regarde ; l'ouvre : un autre en sort, plus petit
// encore ; il l'ouvre : un tout petit cœur s'en échappe et s'envole, et il en
// a des cœurs dans les yeux. Il range le tout, referme… et pouf, plus rien.
function gigogne(): Scene {
  const f = corps
  // le moyen (moitié de taille) tenu devant lui, son haut en `dy` (8 : juste au-dessus du grand, ses pinces sous ses
  // yeux) ; ouvert, ses rabats dépassent de 2
  const moyen = (dy: number, ouvert = false) => boite(27.5, ouvert ? dy - 2 : dy, 0.5, ouvert) + tientDevant(27.5, 44.5, dy + 6)
  // le petit (quart de taille), sorti du moyen ouvert, son haut en `dy`
  const petit = (dy: number, ouvert = false) => boite(31.75, ouvert ? dy - 1 : dy, 0.25, ouvert)
  const ouvertDevant = (p: Pose) => f({ g: 'devant', d: 'devant', ...p }) + cartonJeuOuvert
  const avant = [
    ...arriveCarton('gigogne'),
    ...ouvreCarton(),
    // il en sort un carton, plus petit…
    ouvertDevant({ yeux: 'haut' }) + moyen(14),
    ...fois(3, ouvertDevant({ yeux: 'mi' }) + moyen(8)),
    ...fois(3, ouvertDevant({ yeux: 'normal' }) + moyen(8)),
    // … qu'il ouvre : un autre en sort, encore plus petit
    ...fois(2, ouvertDevant({ yeux: 'haut' }) + moyen(8, true) + petit(4)),
    ...fois(2, ouvertDevant({ yeux: 'grand' }) + moyen(8, true) + petit(-1)),
    ...fois(2, ouvertDevant({ yeux: 'mi' }) + moyen(8, true) + petit(-1)),
  ]
  const apres = [
    // il l'ouvre : un tout petit cœur s'en échappe, et s'envole (`.gigogne-coeur`)
    // (en pixels de 2 : plus petit, il ne se verrait pas)
    ...fois(7, ouvertDevant({ yeux: 'coeur' }) + moyen(8, true) + petit(-1, true) + enVa('gigogne-coeur', A(COEUR, 29, -14, 2))),
    // il range le tout dans le grand (le moyen y redescend, derrière son bord), et referme
    ...fois(2, f({ g: 'devant', d: 'devant', yeux: 'bas', dy: 2 }) + boite(27.5, 10, 0.5, true) + cartonJeuOuvert + pinces(17)),
    ...fois(2, f({ yeux: 'heureux' }) + cartonJeu),
    // pouf : plus de carton, quelques étincelles
    ...fois(2, f({ yeux: 'grand', bouche: 'o' }) + art(POUF, X0 + 17, Y0 + 22, 3)),
    ...fois(3, f({ yeux: 'heureux' }) + A(ETOILE, 18, 26, 2) + A(ETOILE, 44, 20, 2) + A(ETOILE, 31, 36, 2)),
  ]
  const images = [...avant, ...apres]
  return jeu('gigogne', images, { css: sEnVa('gigogne-coeur', dureeJeu(images), avant.length * JEU_PAS, [[0.9, 0, -40, 0]]) })
}

// Le tambour : un clin d'œil, et il tape dessus en rythme, une pince puis
// l'autre (le carton tressaute sous les coups, des notes s'envolent), un roulement,
// puis les deux pinces au ciel… BAM : le carton décolle et sort du cadre par
// le haut. Il salue, en rock star.
function tambour(): Scene {
  const f = corps
  const o = PAL.O!
  const notes = effets.notes()
  // sous un coup, le carton se tasse, posé au sol, et un peu de poussière s'en échappe de ce côté
  const tasse = `<g transform="translate(0 ${Y0 + 48}) scale(1 .9) translate(0 ${-(Y0 + 48)})">${cartonJeu}</g>`
  // une pince (ombrée, pour se détacher de son ventre) frappe le dessus, d'un côté ou de l'autre du scotch ; l'autre est levée
  const coup = (gauche: boolean) =>
    f({ g: gauche ? 'devant' : 'haut', d: gauche ? 'haut' : 'devant', yeux: 'heureux' }) + tasse + R(X0 + (gauche ? 21 : 41), Y0 + 20, 10, 6, PAL.o!) + A(POUSSIERE, gauche ? 12 : 54, 44, 2) + notes
  const leve = f({ g: 'haut', d: 'haut', yeux: 'heureux' }) + cartonJeu + notes
  const part = enVa('tambour-part', cartonJeu)
  const rythme = 'GDGDGGD.GDGDDDG.'
  const avant = [
    ...arriveCarton('tambour'),
    ...fois(2, f({ yeux: 'clin' }) + cartonJeu),
    f({ g: 'haut', d: 'haut', yeux: 'heureux' }) + cartonJeu,
    ...[...rythme].map(c => (c === '.' ? leve : coup(c === 'G'))),
    // le final : les deux pinces au ciel…
    ...fois(2, f({ g: 'ciel', d: 'ciel', yeux: 'ferme' }) + cartonJeu + notes),
  ]
  const apres = [
    // BAM : les deux à la fois, et le carton décolle
    f({ g: 'devant', d: 'devant', yeux: 'grand', bouche: 'o', dy: 2 }) + part + R(X0 + 22, Y0 + 16, 10, 6, o) + R(X0 + 40, Y0 + 16, 10, 6, o),
    // il salue, en rock star, sous les étincelles
    ...fois(3, f({ g: 'ciel', d: 'ciel', yeux: 'heureux', bouche: 'grand' }) + part + effets.etincelles()),
    ...fois(3, f({ g: 'haut', d: 'ciel', yeux: 'clin' }) + part + effets.etincelles()),
  ]
  const images = [...avant, ...apres]
  return jeu('tambour', images, { css: sEnVa('tambour-part', dureeJeu(images), avant.length * JEU_PAS + 0.05, [[0.55, 14, -150, 200]], 'cubic-bezier(.2,.8,.4,1)') })
}

// Le podium : un clin d'œil, et d'un bond il grimpe sur le carton. Le roi du
// carton : bras au ciel, il salue la foule… crac, le carton cède et s'aplatit
// sous lui. Sonné, il regarde la galette, se gratte la tête (oups), puis la
// ramasse et la lance par-dessus son épaule.
function podium(): Scene {
  const f = corps
  // le carton qui cède sous lui : sa hauteur × k, posé au sol ; lui, debout dessus (ses pieds sur le dessus)
  const cede = (k: number) => (k === 1 ? cartonJeu : `<g transform="translate(0 ${Y0 + 48}) scale(1 ${k}) translate(0 ${-(Y0 + 48)})">${cartonJeu}</g>`)
  const dessus = (k: number) => -Math.round(30 * k)
  const brille = (k: number) => (k ? A(ETOILE, -8, -34, 2) + A(ETOILE, 74, -26, 2) : A(ETOILE, -2, -24, 2) + A(ETOILE, 70, -34, 2))
  const sonne = A(ETOILE, 6, -12, 2) + A(ETOILE, 60, -14, 2)
  // (à la hauteur de ses pinces levées)
  const galette = enVa('podium-part', `<g transform="translate(0 -56)">${cede(0.2)}</g>`)
  const avant = [
    ...arriveCarton('podium'),
    ...fois(2, f({ yeux: 'clin' }) + cartonJeu),
    // il se ramasse, et bondit dessus (ses bras levés restent sous le haut du cadre, 38 au-dessus de sa tête)
    f({ g: 'haut', d: 'haut', jambes: 'replie', dy: 3, yeux: 'heureux' }) + cartonJeu,
    f({ g: 'haut', d: 'haut', dy: -30, yeux: 'heureux', masse: 'etire' }) + cartonJeu,
    // le roi du carton : tadaa, d'un côté puis de l'autre
    ...fois(2, f({ g: 'haut', d: 'haut', dy: dessus(1), yeux: 'heureux', bouche: 'grand' }) + cartonJeu),
    ...[0, 1, 0, 1].flatMap(k => fois(2, f({ g: k ? 'tendu' : 'haut', d: k ? 'haut' : 'tendu', dy: dessus(1), yeux: k ? 'heureux' : 'clin' }) + cartonJeu + brille(k))),
    // crac
    ...fois(2, f({ g: 'haut', d: 'haut', dy: dessus(0.7), yeux: 'grand', bouche: 'o' }) + cede(0.7)),
    f({ g: 'ciel', d: 'ciel', dy: dessus(0.25), yeux: 'croix' }) + cede(0.25) + A(POUSSIERE, 10, 44, 2) + A(POUSSIERE, 56, 44, 2),
    // sonné, sur sa galette… oups
    ...fois(3, f({ dy: dessus(0.2), yeux: 'croix' }) + cede(0.2) + sonne),
    ...fois(2, f({ dy: dessus(0.2), yeux: 'bas' }) + cede(0.2)),
    ...fois(4, f({ dy: dessus(0.2), d: 'tete', yeux: 'heureux' }) + cede(0.2)),
    // il la ramasse, au-dessus de sa tête…
    f({ g: 'ciel', d: 'ciel', yeux: 'heureux' }) + galette,
  ]
  const apres = [
    // … et la lance par-dessus son épaule
    ...fois(2, f({ g: 'haut', d: 'ciel', yeux: 'gauche' }) + galette),
    ...fois(3, f({ yeux: 'heureux' }) + galette),
  ]
  const images = [...avant, ...apres]
  // par-dessus son épaule : elle monte et part en arrière en tournoyant, puis retombe loin derrière lui, hors du cadre
  // (à gauche et sous le sol, même quand il la lance de chez lui) ; son sommet, d'une même pesanteur que sa chute
  const chute: Point[] = [[auSommet(0, 0.7, 0, -30, 80), -65, -30, -150, TOMBE], [0.7, -190, 80, -360]]
  return jeu('podium', images, { css: sEnVa('podium-part', dureeJeu(images), avant.length * JEU_PAS, chute, MONTE) })
}

// ------------------------------------------------- il monte de niveau

// La grande étoile d'or qui lui tombe du ciel (pixels de 2)
const GRANDE_ETOILE = ['...Y...', '..YYY..', 'YYYYYYY', '.YYWYY.', '..YYY..', '.YY.YY.', '.Y...Y.']

/**
 * Il monte de niveau : une étoile d'or descend du ciel ; il la suit des
 * yeux, bouche bée, l'attrape au-dessus de sa tête, la serre contre lui (elle
 * scintille)… et bondit de joie, des étoiles plein les yeux. Puis il bombe le
 * torse : l'insigne de son nouveau niveau brille sur son ventre. Jouée une
 * fois, quand son expérience passe un seuil (register.tsx).
 */
function niveau(): Scene {
  const f = corps
  const etoile = A(GRANDE_ETOILE, 29, -22, 2)
  // (sa descente : la même dans chaque image qui la montre, calée sur la scène)
  const descend = `<g class="niveau-descend">${etoile}</g>`
  const serre = A(ETOILE, -4, 12, 2) + A(ETOILE, 72, 8, 2) + A(ETOILE, 34, -12, 2)
  const bondit = A(ETOILE, -18, -6, 2) + A(ETOILE, 86, -10, 2) + A(ETOILE, -10, -30, 2) + A(ETOILE, 78, -32, 2)
  const images = [
    ...fois(3, f({ yeux: 'haut' }) + descend),
    ...fois(3, f({ yeux: 'haut', bouche: 'o' }) + descend),
    // il l'attrape au-dessus de sa tête…
    ...fois(2, f({ g: 'ciel', d: 'ciel', yeux: 'heureux' }) + etoile),
    // … et la serre contre lui : elle scintille
    ...fois(3, f({ g: 'devant', d: 'devant', yeux: 'ferme' }) + serre),
    // un bond de joie (sans quitter son ombre : elle reste au sol)
    f({ g: 'haut', d: 'haut', jambes: 'replie', dy: 3, yeux: 'heureux' }),
    ...fois(3, f({ g: 'ciel', d: 'ciel', dy: -12, yeux: 'etoile', bouche: 'grand', masse: 'etire' }) + bondit),
    f({ jambes: 'replie', dy: 3, yeux: 'heureux' }),
    // il bombe le torse, son insigne tout neuf sur le ventre
    ...fois(6, f({ g: 'haut', d: 'haut', yeux: 'etoile' }) + effets.etincelles()),
    ...fois(4, f({ yeux: 'heureux' })),
  ]
  const T = dureeJeu(images)
  return {
    duree: T,
    images,
    calques: [{ images }],
    css:
      `.niveau-descend{animation:niveau-descend ${T}s infinite;animation-delay:var(--t0,0s)}` +
      `@keyframes niveau-descend{0%{transform:translateY(-50px);animation-timing-function:ease-out}${pourcent(((6 * JEU_PAS) / T) * 100)},100%{transform:translateY(0)}}`,
  }
}

// Tu reviens après une longue absence : il t'a attendu. Il te remarque (yeux
// ronds, petit sursaut), te fait un grand coucou des deux pattes, puis serre
// ses pattes sur son cœur pendant qu'un cœur pousse au-dessus de sa tête.
// Après plus d'un jour sans toi (`longtemps`), il n'en croit pas ses yeux (il
// se les frotte des deux pattes), bondit de joie trois fois, fait un aller-retour
// en courant comme un chien content, et seulement alors son coucou.
const retrouve = (longtemps: boolean): Scene => {
  const f = corps
  // le cœur au-dessus de sa tête (petit pendant le coucou, grand à la fin), qui suit ses bonds
  const coeurTete = (dy: number, grand = false) => (grand ? A(COEUR, 25, dy - 22, 3) : A(COEUR, 29, dy - 16, 2))
  // ses deux pattes (ombrées, devant le visage) se frottent les yeux
  const frotte = (dy: number) => f({ g: 'haut', d: 'haut', yeux: 'ferme' }) + R(X0 + 12, Y0 + 3 + dy, 14, 9, PAL.o!) + R(X0 + 46, Y0 + 3 + dy, 14, 9, PAL.o!)
  // un bond de joie qui a du poids : il se ramasse, s'étire en décollant, s'écrase en se recevant
  const bond = (coeur: boolean) => [
    f({ g: 'haut', d: 'haut', jambes: 'replie', dy: 3, yeux: 'heureux' }),
    f({ g: 'ciel', d: 'ciel', dy: -10, jambes: 'replie', yeux: 'heureux', bouche: 'grand', masse: 'etire' }),
    f({ g: 'ciel', d: 'ciel', dy: -18, jambes: 'replie', yeux: 'heureux', bouche: 'grand' }) + (coeur ? coeurTete(-18) : ''),
    f({ g: 'ciel', d: 'ciel', dy: -8, jambes: 'replie', yeux: 'heureux' }) + (coeur ? coeurTete(-8) : ''),
    f({ g: 'haut', d: 'haut', jambes: 'replie', dy: 3, yeux: 'ferme' }),
  ]
  // le grand coucou des deux pattes, en se dandinant d'un pied sur l'autre
  const coucou = [
    f({ g: 'ciel', d: 'haut', jambes: 'pasA', dx: -2, yeux: 'heureux' }) + coeurTete(0),
    f({ g: 'haut', d: 'ciel', jambes: 'pasB', dx: 2, yeux: 'heureux' }) + coeurTete(-2),
  ]
  const segments: Segment[] = [
    // tiens… ? c'est toi !
    { duree: 0.7, images: [f({ yeux: 'gauche' }), f({ yeux: 'grand' }), f({ yeux: 'grand', bouche: 'o', g: 'haut', d: 'haut', dy: -3 })] },
  ]
  if (longtemps) {
    const versGauche = profil('vite', false)
    const versDroite = miroir(profil('vite', false))
    segments.push(
      // il n'en croit pas ses yeux
      { duree: 0.9, tours: 2, images: [frotte(0), frotte(3)] },
      { duree: 0.5, images: [f({ yeux: 'grand', bouche: 'grand' })] },
      // trois bonds de joie, le cœur qui saute avec lui
      { duree: 2.7, tours: 3, images: bond(true) },
      // un aller-retour en courant, ventre à terre, puis il pile devant toi
      { duree: 0.6, images: [versGauche], de: 0, a: -44 },
      { duree: 0.15, images: [f({ vue: 'cote' })], de: -44, a: -44 },
      { duree: 0.6, images: [versDroite], de: -44, a: 0 },
      { duree: 0.3, images: [f({ jambes: 'replie', dy: 3, yeux: 'heureux' })] },
    )
  } else {
    // un petit bond de joie
    segments.push({ duree: 0.9, images: bond(false) })
  }
  segments.push(
    { duree: 1.8, tours: 3, images: coucou },
    // il serre ses pattes sur son cœur, et le cœur grossit au-dessus de sa tête
    {
      duree: 1.4,
      images: [
        f({ g: 'devant', d: 'devant', yeux: 'coeur' }) + coeurTete(0),
        f({ g: 'devant', d: 'devant', yeux: 'coeur' }) + coeurTete(0, true),
        f({ g: 'devant', d: 'devant', yeux: 'coeur', dy: -2 }) + coeurTete(-3, true),
        f({ g: 'devant', d: 'devant', yeux: 'heureux' }) + coeurTete(0, true),
      ],
    },
  )
  return choreo(segments, longtemps ? { fx: effets.coeurs() } : {})
}

// ------------------------------------------------------- ses visiteurs

/**
 * Un visiteur sur sa petite scène (`decor`) : il suit son propre trajet
 * (`cles` : à tel instant, en secondes, tel décalage [x, y]), en ligne droite
 * d'une place à l'autre, et chacune de ses poses n'est visible que pendant
 * ses fenêtres. Tout suit `--t0`, comme Clawd : repris en route, il est là
 * où il doit être.
 */
function passant(nom: string, T: number, cles: [number, number, number][], poses: [string, [number, number][]][]): { css: string; svg: string } {
  const pc = (t: number) => `${((t / T) * 100).toFixed(3)}%`
  let css = `.${nom}{animation:${nom} ${T}s linear infinite${REPRISE}}@keyframes ${nom}{${cles.map(([t, x, y]) => `${pc(t)}{transform:translate(${x}px,${y}px)}`).join('')}}`
  let svg = ''
  poses.forEach(([img, ws], i) => {
    const id = `${nom}-${i}`
    css += `.${id}{opacity:0;animation:${id} ${T}s infinite steps(1,end)${REPRISE}}@keyframes ${id}{${fenetres(ws, T)}}`
    svg += `<g class="${id}">${img}</g>`
  })
  return { css, svg: `<g class="${nom}">${svg}</g>` }
}

// Le chat, gris rayé, de profil vers la droite (sa queue dressée derrière lui) :
// son corps, puis ses pattes proches et lointaines, qui se lèvent tour à tour
const CHAT = [
  '.g...............G...G',
  'g................GG.GG',
  'g................GGGKG',
  '.g..GGGGGGGGGGGGGGGGGP',
  '..gGGgGGgGGgGGGGGGGG..',
  '...GGGGGGGGGGGGGGGGG..',
  '...GwwwwwwwwwwwwwwG...',
]
const CHAT_PATTES = ['GG.........GG', 'GG.........GG', 'GG.........GG']
const CHAT_PATTES_LOIN = ['gg........gg', 'gg........gg', 'gg........gg']
// Assis, la tête tournée vers toi (les yeux fermés quand il ronronne), la queue
// enroulée d'un côté ou de l'autre
const chatAssis = (ronronne: boolean, queue: 0 | 1) => [
  '...G.....G.',
  '...GG...GG.',
  '...GGGGGGG.',
  ronronne ? '...GGGGGGG.' : '...GKKGKKG.',
  '...GKKGKKG.',
  '...GGGPGGG.',
  '....GGGGG..',
  queue ? '...GGwwwGG.' : 'g..GGwwwGG.',
  queue ? '..GGGwwwGG.' : 'g.GGGwwwGG.',
  queue ? '.GGGGwwwGGG' : '.gGGGwwwGGG',
  queue ? 'gGGGGGGGGGG' : '..GGGGGGGGG',
  queue ? '.gGG.GG.GG.' : '..GG.GG.GG.',
]
/** Le chat qui marche (dans son repère : son coin haut-gauche au bord gauche de la toile de Clawd, posé au sol) */
const chatMarche = () =>
  `<g class="vite">${A(CHAT, 0, 28, 2)}<g class="pB">${A(CHAT_PATTES_LOIN, 12, 42, 2)}</g><g class="pA">${A(CHAT_PATTES, 6, 42, 2)}</g></g>`
/** Le chat assis (même repère) ; il ronronne : un petit cœur monte au-dessus de sa tête */
const chatAssisSvg = (ronronne: boolean, queue: 0 | 1) =>
  A(chatAssis(ronronne, queue), 0, 24, 2) + (ronronne ? `<g class="monte">${A(COEUR, 4, 6, 2)}</g>` : '')

/**
 * Un chat traverse sa petite scène (une visite rare, de jour). Clawd le voit
 * arriver de la gauche, ouvre de grands yeux ; le chat s'assoit près de lui,
 * Clawd s'accroupit et le caresse (il ronronne, un petit cœur monte) ; puis le
 * chat repart en passant derrière ses pattes, Clawd le suit des yeux et lui
 * fait au revoir de la patte quand il sort à droite.
 */
function visiteChat(): Scene {
  const f = corps
  // ses places (décalage du chat) : il entre par la gauche, s'arrête contre Clawd, repart à droite
  const [loin, arret, assis, sortie] = [-176, -42, -20, 124]
  // à 40 px/s : 3,35 s pour entrer, 4,15 s pour traverser
  const [entre, arrive, repart, sorti, T] = [1.2, 4.55, 9.2, 13.35, 14.8]
  const caresse = (k: number) => f({ jambes: 'replie', dy: k ? 4 : 6, dx: k ? -2 : 0, g: 'tendu', yeux: 'heureux' })
  const chat = passant('chat', T, [
    [0, loin, 0], [entre, loin, 0], [arrive, arret, 0],
    [arrive + 0.001, assis, 0], [repart - 0.001, assis, 0], [repart, arret, 0],
    [sorti, sortie, 0], [T, sortie, 0],
  ], [
    [chatMarche(), [[entre, arrive], [repart, sorti]]],
    [chatAssisSvg(false, 0), [[arrive, 5.6], [8.8, repart]]],
    [chatAssisSvg(true, 0), [[5.6, 6.2], [6.8, 7.4], [8, 8.6]]],
    [chatAssisSvg(true, 1), [[6.2, 6.8], [7.4, 8], [8.6, 8.8]]],
  ])
  return choreo(
    [
      { duree: 1.2, images: [f(), f(), f({ yeux: 'ferme' }), f()] },
      // il entend quelque chose à gauche, le voit : yeux ronds, bouche bée
      { duree: 0.8, images: [f({ yeux: 'gauche' })] },
      { duree: 0.6, images: [f({ yeux: 'grand', bouche: 'o', dy: -2 })] },
      { duree: 1.95, images: [f({ yeux: 'gauche' }), f({ yeux: 'gauche' }), f({ yeux: 'heureux' })] },
      // le chat s'assoit à côté de lui : il s'accroupit et le caresse
      { duree: 0.6, images: [f({ yeux: 'heureux' })] },
      { duree: 0.45, images: [f({ jambes: 'replie', dy: 3, yeux: 'gauche' })] },
      { duree: 3.2, tours: 4, images: [caresse(0), caresse(1)] },
      { duree: 0.4, images: [f({ jambes: 'replie', dy: 3, yeux: 'gauche' })] },
      // il repart : Clawd le suit des yeux, à gauche, à ses pieds (le chat passe derrière ses pattes), à droite
      { duree: 0.75, images: [f({ yeux: 'gauche' })] },
      { duree: 1.25, images: [f({ yeux: 'bas' })] },
      { duree: 0.6, images: [f({ yeux: 'droite' })] },
      { duree: 2.4, tours: 3, images: [f({ d: 'haut', yeux: 'droite' }), f({ d: 'ciel', yeux: 'droite' })] },
      { duree: 0.6, images: [f({ yeux: 'heureux' })] },
    ],
    { decor: [{ svg: chat.svg }], css: chat.css },
  )
}

// L'étoile filante : sa tête, et sa traînée qui s'efface derrière elle (vers le haut à droite)
const FILANTE =
  A(ETOILE, 0, 0, 2) +
  [0.8, 0.6, 0.45, 0.3, 0.15].map((o, k) => `<rect x="${X0 + 6 + 6 * k}" y="${Y0 + 1 - Math.round(0.8 * (k + 1))}" width="6" height="2" fill="${PAL.Y}" fill-opacity="${o}"/>`).join('')
// Quelques étoiles qui scintillent dans le ciel du soir
const CIEL = [[-50, -20], [-6, -34], [24, -14], [106, -30]]
  .map(([x, y], i) => `<g class="scintille" style="animation-delay:${(i * 0.45).toFixed(2)}s">${A(['w'], x!, y!, 2)}</g>`)
  .join('')

/**
 * Le soir, une étoile filante (une visite rare). Assis à regarder le ciel,
 * il la voit filer d'un bout à l'autre, la montre de la patte, puis joint
 * les pattes, ferme les yeux et fait un vœu ; ravi, il se relève.
 */
function visiteFilante(): Scene {
  const f = corps
  const assis = (p: Pose = {}) => f({ jambes: 'assis', dy: 8, ...p })
  const [part, fini, T] = [2.2, 3.1, 9]
  const etoile = passant('filante', T, [[0, 100, -30], [part, 100, -30], [fini, -150, -2], [T, -150, -2]], [[FILANTE, [[part, fini]]]])
  return choreo(
    [
      { duree: 2.2, images: [assis({ yeux: 'haut' }), assis({ yeux: 'haut' }), assis({ yeux: 'ferme' }), assis({ yeux: 'haut' })] },
      // elle file : il la suit des yeux, de droite à gauche
      { duree: 0.45, images: [assis({ yeux: 'haut' })] },
      { duree: 0.45, images: [assis({ yeux: 'gauche' })] },
      // il n'en revient pas, et la montre
      { duree: 0.5, images: [assis({ yeux: 'etoile', bouche: 'o' })] },
      { duree: 1, images: [assis({ yeux: 'etoile', g: 'ciel' })] },
      // les pattes jointes, les yeux fermés : il fait un vœu
      { duree: 2.4, images: [assis({ yeux: 'ferme', g: 'devant', d: 'devant' }), assis({ yeux: 'ferme', g: 'devant', d: 'devant' }) + A(ETOILE, 33, -18, 2)], tours: 2 },
      { duree: 0.5, images: [f({ jambes: 'replie', dy: 4, yeux: 'heureux' })] },
      { duree: 1.5, images: [f({ yeux: 'heureux', d: 'haut' }), f({ yeux: 'heureux' })] },
    ],
    { decor: [{ svg: CIEL }, { svg: etoile.svg }], css: etoile.css },
  )
}

const SCENES: Record<ClawdAnim, () => Scene> = {
  // ------------------------------------------------------------- repos
  // au calme, il respire et cligne des yeux quand ça lui chante (`vivant`), en jetant un œil autour
  repos: () => {
    const f = (yeux: Yeux = 'normal') => corps({ yeux, calme: true })
    return { duree: 7, images: [f(), f(), f(), f(), f(), f(), f('gauche'), f('gauche'), f(), f('droite')] }
  },
  // La vie de tous les jours : il part se balader sur sa petite scène,
  // regarde autour, se gratte la tête, saute, s'assoit en balançant les
  // pattes, te fait coucou, revient et fait une pirouette.
  balade: () => {
    // quand il s'arrête, il respire et cligne des yeux (`vivant`) : plus besoin de fermer les yeux image par image
    const f = (p: Pose = {}) => corps({ calme: true, ...p })
    const versGauche = profil('vite')
    const versDroite = miroir(profil('vite'))
    const assis = (j: 'assis' | 'assis2', yeux: Yeux = 'droite') => f({ jambes: j, dy: 8, yeux })
    return choreo([
      { duree: 3, images: [f(), f(), f(), f(), f({ yeux: 'gauche' }), f({ yeux: 'gauche' }), f(), f({ yeux: 'droite' })] },
      { duree: 2, images: [versGauche], de: 0, a: -50 },
      {
        duree: 2.4,
        images: [f({ yeux: 'gauche' }), f({ yeux: 'haut' }), f({ d: 'tete', yeux: 'haut' }), f({ d: 'tete', yeux: 'droite' }), f(), f({ yeux: 'heureux' })],
      },
      {
        duree: 1.2,
        images: [
          f({ jambes: 'replie', dy: 3 }),
          f({ dy: -10, jambes: 'replie', g: 'haut', d: 'haut', yeux: 'heureux', masse: 'etire' }),
          f({ dy: -16, jambes: 'replie', g: 'ciel', d: 'ciel', yeux: 'heureux' }),
          f({ dy: -8, jambes: 'replie', g: 'haut', d: 'haut', yeux: 'heureux' }),
          f({ jambes: 'replie', dy: 3, yeux: 'heureux' }),
          f({ yeux: 'heureux' }),
        ],
      },
      { duree: 3.2, tours: 2, images: [assis('assis'), assis('assis2'), assis('assis'), assis('assis2', 'heureux')] },
      { duree: 0.5, images: [f({ jambes: 'replie', dy: 4 }), f()] },
      { duree: 1.6, images: [versGauche], de: -50, a: -100 },
      { duree: 2, tours: 3, images: [f({ d: 'haut', yeux: 'heureux' }), f({ d: 'ciel', yeux: 'heureux' })] },
      { duree: 4, images: [versDroite], de: -100, a: 0 },
      {
        duree: 1.6,
        images: [f({ vue: 'cote' }), f({ vue: 'dos' }), f({ vue: 'coteD' }), f({ yeux: 'heureux' }), f({ yeux: 'heureux', dy: -8, jambes: 'replie' }), f({ yeux: 'heureux' })],
      },
      { duree: 2.5, images: [f(), f(), f({ yeux: 'haut' }), f(), f({ yeux: 'droite' }), f()] },
    ])
  },
  // Au travail : son déménagement (voir `etapesBoulot`), en boucle ; chaque place
  // n'est dessinée que quand un carton y repose
  boulot: () => {
    const etapes = etapesBoulot()
    const vu = occupation(etapes)
    return choreo(etapes, { decor: (Object.keys(PLACES) as Place[]).map(p => ({ svg: posePlace(p), visible: vu[p] })) })
  },
  coucou: () => ({
    duree: 1.6,
    images: [
      corps({ d: 'haut', yeux: 'heureux' }),
      corps({ d: 'ciel', yeux: 'heureux' }),
      corps({ d: 'haut', yeux: 'heureux' }),
      corps({ d: 'ciel', yeux: 'heureux', dy: -5, jambes: 'replie' }),
    ],
  }),
  danse: () => ({
    duree: 1.2,
    fx: effets.notes(),
    images: [
      corps({ g: 'ciel', d: 'bas', jambes: 'pasA', dx: -8, dy: -2, yeux: 'heureux' }),
      corps({ g: 'haut', d: 'haut', dy: -8, jambes: 'replie', yeux: 'clin' }),
      corps({ g: 'bas', d: 'ciel', jambes: 'pasB', dx: 8, dy: -2, yeux: 'heureux' }),
      corps({ g: 'haut', d: 'haut', dy: -8, jambes: 'replie', yeux: 'heureux' }),
      corps({ g: 'ciel', d: 'ciel', jambes: 'ecarte', yeux: 'heureux' }),
      corps({ g: 'tendu', d: 'tendu', jambes: 'ecarte', dy: 2, yeux: 'clin' }),
    ],
  }),
  jongle: () => ({
    duree: 1.2,
    images: rep(6, i => {
      const balles = ['Y', 'R', 'B']
        .map((c, k) => {
          const a = ((i * 60 + k * 120) * Math.PI) / 180
          return A(BALLE(c), Math.round(33 + 22 * Math.cos(a)), Math.round(-16 + 12 * Math.sin(a)), 3)
        })
        .join('')
      return corps({ g: i % 2 ? 'haut' : 'bas', d: i % 2 ? 'bas' : 'haut', yeux: 'haut' }) + balles
    }),
  }),
  cafe: () => ({
    duree: 3.6,
    images: [
      corps({ d: 'devant' }) + A(TASSE, 42, 10) + A(VAPEUR[0]!, 46, 2),
      corps({ d: 'devant', yeux: 'ferme' }) + A(TASSE, 42, 10) + A(VAPEUR[1]!, 46, 2),
      corps({ d: 'haut', yeux: 'ferme' }) + A(TASSE, 38, 4),
      corps({ d: 'haut', yeux: 'heureux' }) + A(TASSE, 38, 4),
    ],
  }),
  // Vendredi soir, entre deux cartons : lunettes de soleil sur le nez, il
  // s'assoit sur un carton fermé, balance les pattes, sirote sa citronnade,
  // croise une patte derrière la tête, puis baisse ses lunettes pour te faire
  // un clin d'œil par-dessus avant de les remonter d'un doigt.
  detente: () =>
    deguiseEn('lunettes', () => {
      const h = -18
      const assise = carton(CARTON_X, 18)
      // sa citronnade sur ses genoux, bien à l'écart de ses lunettes
      const posee = (p: Pose, jus = JUS) => assise + corps({ jambes: 'assis', dy: h, d: 'devant', ...p }) + A(jus, 50, 14 + h)
      const gorgee = (p: Pose, jus = JUS) => assise + corps({ jambes: 'assis', dy: h, d: 'haut', ...p }) + A(jus, 38, 8 + h)
      // ses lunettes glissées au bout du nez : ses yeux par-dessus
      const parDessus = (yeux: Yeux, jambes: Jambes) =>
        assise + deguiseEn(undefined, () => corps({ jambes, dy: h, g: 'haut', d: 'devant', yeux })) + `<use href="#lunettes" x="${X0}" y="${Y0 + h + 9}"/>` + A(JUS_BU, 50, 14 + h)
      return {
        duree: 9.6,
        images: [
          posee({}),
          posee({ jambes: 'assis2' }),
          gorgee({ jambes: 'assis2', yeux: 'ferme' }),
          gorgee({ yeux: 'ferme' }, JUS_BU),
          posee({ bouche: 'o' }, JUS_BU),
          posee({ g: 'tete', jambes: 'assis2' }, JUS_BU),
          posee({ g: 'tete' }, JUS_BU),
          parDessus('droite', 'assis'),
          parDessus('clin', 'assis'),
          parDessus('droite', 'assis2'),
          posee({ g: 'haut' }, JUS_BU),
          posee({ jambes: 'assis2', yeux: 'heureux' }, JUS_BU),
        ],
      }
    }),
  // Le lundi matin, il bâille à s'en décrocher la mâchoire : la bouche
  // s'ouvre, les pattes montent, une larme perle, il se frotte l'œil et se
  // secoue, cernes sous les yeux.
  baille: () =>
    deguiseEn('cernes', () => {
      const larme = R(X0 + 56, Y0 + 12, 3, 4, PAL.B!)
      const frotte = (dy: number) => corps({ yeux: 'mi', d: 'haut' }) + R(X0 + 46, Y0 + 3 + dy, 14, 9, PAL.o!)
      return {
        duree: BAILLE_S,
        images: [
          corps({ g: 'pend', d: 'pend', dy: 1 }),
          corps({ g: 'pend', d: 'pend', dy: 1, bouche: 'o', yeux: 'ferme' }),
          corps({ yeux: 'ferme', bouche: 'grand', g: 'haut', d: 'haut', dy: -1, masse: 'etire' }),
          corps({ yeux: 'ferme', bouche: 'grand', g: 'ciel', d: 'ciel', dy: -2, masse: 'etire' }),
          corps({ yeux: 'ferme', bouche: 'grand', g: 'ciel', d: 'ciel', dy: -2, masse: 'etire' }) + larme,
          corps({ yeux: 'ferme', bouche: 'o', g: 'pend', d: 'pend' }) + larme,
          frotte(0),
          frotte(3),
          corps({ vue: 'cote', yeux: 'ferme' }),
          corps({ vue: 'coteD' }),
          corps({ dy: 1 }),
          corps({ g: 'pend', d: 'pend', dy: 1 }),
        ],
      }
    }),
  lecture: () => {
    const base = { jambes: 'assis', dy: 8, g: 'devant', d: 'devant', calme: true } as const
    return {
      duree: 4,
      images: [
        corps({ ...base, yeux: 'bas' }) + A(LIVRE, 20, 30),
        corps({ ...base, yeux: 'bas', dx: 0 }) + A(LIVRE, 20, 30),
        corps({ ...base, yeux: 'ferme' }) + A(LIVRE, 20, 30),
        corps({ ...base, yeux: 'heureux' }) + A(LIVRE_PAGE, 20, 27),
      ],
    }
  },
  etirement: () => ({
    duree: 2.6,
    images: [
      corps({ g: 'ciel', d: 'ciel', yeux: 'ferme', dy: -3, bouche: 'grand' }),
      corps({ g: 'ciel', d: 'ciel', yeux: 'ferme', dy: -4, bouche: 'grand' }),
      corps({ g: 'haut', d: 'haut', yeux: 'ferme', bouche: 'o' }),
      corps({ yeux: 'heureux' }),
    ],
  }),
  corde: () => ({
    duree: 0.9,
    images: [
      corps({ g: 'tendu', d: 'tendu' }) + courbe(-8, 18, 36, -40, 80, 18, PAL.N!),
      corps({ g: 'tendu', d: 'tendu', dy: -10, jambes: 'replie', yeux: 'heureux' }) + courbe(-8, 8, 36, 72, 80, 8, PAL.N!),
      corps({ g: 'tendu', d: 'tendu', dy: -4, jambes: 'replie' }) + courbe(-8, 14, 36, 56, 80, 14, PAL.N!),
      corps({ g: 'tendu', d: 'tendu' }) + courbe(-8, 18, 36, -20, 80, 18, PAL.N!),
    ],
  }),
  bulles: () => ({
    duree: 1.6,
    fx: effets.bulles(),
    images: [
      corps({ d: 'haut', yeux: 'heureux' }) + A(['N', 'N', 'N', 'N'], 64, -12) + A(ANNEAU, 60, -24),
      corps({ d: 'haut', bouche: 'o' }) + A(['N', 'N', 'N', 'N'], 64, -12) + A(ANNEAU, 60, -24),
    ],
  }),
  peche: () => {
    // il guette son bouchon sans bouger : il respire, il cligne
    const base = corps({ jambes: 'assis', dy: 8, d: 'tendu', yeux: 'droite', calme: true })
    const canne = trait([[78, 26], [104, -14]], PAL.N!, 3)
    const eau = R(X0 + 92, Y0 + 44, W - X0 - 92, 4, PAL.b!) + R(X0 + 92, Y0 + 44, W - X0 - 92, 1, PAL.B!)
    const ligne = (y: number) => trait([[104, -14], [114, y]], PAL.w!, 1) + A(BOUCHON, 113, y, 3)
    return {
      duree: 4.2,
      images: [
        base + canne + eau + ligne(36),
        base + canne + eau + ligne(38),
        base + canne + eau + ligne(36),
        base + canne + eau + ligne(38),
        corps({ jambes: 'assis', dy: 8, d: 'ciel', yeux: 'grand' }) + trait([[78, 6], [96, -20]], PAL.N!, 3) + eau + trait([[96, -20], [108, 14]], PAL.w!, 1) + A(POISSON, 100, 14, 3),
        corps({ jambes: 'assis', dy: 8, d: 'ciel', yeux: 'heureux' }) + trait([[78, 6], [96, -20]], PAL.N!, 3) + eau + trait([[96, -20], [104, 0]], PAL.w!, 1) + A(POISSON, 96, 0, 3),
      ],
    }
  },
  yoyo: () => ({
    duree: 1.2,
    images: [6, 18, 30, 18].map(l => corps({ d: 'tendu', yeux: l > 20 ? 'bas' : 'normal' }) + trait([[80, 18], [80, 18 + l]], PAL.w!, 1) + A(YOYO, 76, 16 + l, 3)),
  }),
  guitare: () => ({
    duree: 0.6,
    fx: effets.notes(),
    images: [
      corps({ g: 'devant', d: 'devant', yeux: 'ferme' }) + A(GUITARE, 12, 10),
      corps({ g: 'devant', d: 'pend', yeux: 'heureux' }) + A(GUITARE, 12, 10),
    ],
  }),
  arrosage: () => {
    const goutte = (i: number) => A(['B', '.', 'B'], 98, 16 + (i % 2) * 4, 3)
    const pot = A(POT, 84, 39)
    return {
      duree: 5,
      images: [
        corps({ d: 'tendu', yeux: 'droite' }) + A(ARROSOIR, 76, 4) + goutte(0) + pot + A(POUSSE[0]!, 87, 33),
        corps({ d: 'tendu', yeux: 'droite' }) + A(ARROSOIR, 76, 4) + goutte(1) + pot + A(POUSSE[0]!, 87, 33),
        corps({ d: 'tendu', yeux: 'droite' }) + A(ARROSOIR, 76, 4) + goutte(0) + pot + A(POUSSE[1]!, 84, 27),
        corps({ d: 'tendu', yeux: 'droite' }) + A(ARROSOIR, 76, 4) + goutte(1) + pot + A(POUSSE[1]!, 84, 27),
        corps({ g: 'haut', d: 'haut', yeux: 'heureux' }) + pot + A(POUSSE[2]!, 84, 18),
        corps({ g: 'haut', d: 'haut', yeux: 'coeur' }) + pot + A(POUSSE[2]!, 84, 18),
      ],
    }
  },
  ballon: () => ({
    duree: 0.8,
    images: [
      corps({ d: 'haut', yeux: 'droite' }) + A(BALLON, 76, 4),
      corps({ d: 'bas', yeux: 'droite' }) + A(BALLON, 78, 22),
      corps({ d: 'pend', yeux: 'bas' }) + A(BALLON, 78, 36),
      corps({ d: 'bas', yeux: 'droite' }) + A(BALLON, 78, 22),
    ],
  }),
  papillon: () => {
    const pos: [number, number, Yeux][] = [
      [-16, -6, 'gauche'], [0, -24, 'gauche'], [32, -32, 'haut'], [62, -24, 'droite'], [84, -8, 'droite'], [40, -14, 'haut'],
    ]
    return {
      duree: 3.6,
      images: pos.map(([x, y, yeux], i) =>
        corps({ yeux, g: i === 5 ? 'ciel' : 'bas', d: i === 5 ? 'ciel' : 'bas', dy: i === 5 ? -4 : 0 }) + A(PAPILLON[i % 2]!, x, y, 4),
      ),
    }
  },
  // (sa promenade dure un aller-retour entier, 9 s : elle finit chez lui ; son trajet suit `--t0`, sur sa classe)
  promenade: () => ({ duree: 9, cls: 'promene', images: [profil('vite')] }),
  pirouette: () => ({
    duree: 1.4,
    cls: 'hop',
    images: [corps(), corps({ vue: 'cote' }), corps({ vue: 'dos' }), corps({ vue: 'coteD' }), corps({ yeux: 'heureux' }), corps({ yeux: 'heureux' })],
  }),
  // ---------------------------------------------------- ses danses
  // Des clins d'œil aux danses qu'on connaît : de simples poses de son corps
  // (aucun accessoire d'un jeu, aucun texte), ses bras et ses jambes qui font
  // le mouvement.
  /** Les hanches d'un côté, les bras de l'autre, d'un coup de balancier */
  floss: () => ({
    duree: 0.8,
    fx: effets.notes(),
    images: [
      corps({ dx: -10, g: 'devant', d: 'pend', jambes: 'pasA', yeux: 'heureux' }),
      corps({ dx: -3, g: 'bas', d: 'bas', yeux: 'clin' }),
      corps({ dx: 10, g: 'pend', d: 'devant', jambes: 'pasB', yeux: 'heureux' }),
      corps({ dx: 3, g: 'bas', d: 'bas', yeux: 'clin' }),
    ],
  }),
  /** Les bras qui moulinent devant, les genoux qui montent */
  orange: () => ({
    duree: 1,
    images: [
      corps({ dx: -6, dy: -3, g: 'devant', d: 'haut', jambes: 'pasA', yeux: 'grand' }),
      corps({ dy: -1, g: 'haut', d: 'devant', jambes: 'replie', yeux: 'heureux' }),
      corps({ dx: 6, dy: -3, g: 'haut', d: 'devant', jambes: 'pasB', yeux: 'grand' }),
      corps({ dy: -1, g: 'devant', d: 'haut', jambes: 'replie', yeux: 'heureux' }),
    ],
  }),
  /** Les poings en l'air, les jambes qui s'écartent en cadence */
  defaut: () => ({
    duree: 1.2,
    fx: effets.notes(),
    images: [
      corps({ dy: -4, g: 'ciel', d: 'bas', jambes: 'ecarte', yeux: 'heureux' }),
      corps({ dy: -6, g: 'bas', d: 'ciel', jambes: 'replie', yeux: 'clin' }),
      corps({ g: 'ciel', d: 'ciel', jambes: 'ecarte', yeux: 'heureux' }),
      corps({ dy: -2, g: 'haut', d: 'haut', jambes: 'tape', yeux: 'clin' }),
    ],
  }),
  /** Les bras grands ouverts, les pieds qui glissent d'un côté puis de l'autre */
  griddy: () => ({
    duree: 0.8,
    images: [
      corps({ dx: -8, g: 'tendu', d: 'tendu', jambes: 'pasA', yeux: 'mi' }),
      corps({ dx: -2, g: 'tendu', d: 'tendu', jambes: 'ecarte', yeux: 'clin' }),
      corps({ dx: 8, g: 'tendu', d: 'tendu', jambes: 'pasB', yeux: 'mi' }),
      corps({ dx: 2, g: 'tendu', d: 'tendu', jambes: 'ecarte', yeux: 'clin' }),
    ],
  }),
  /** La main sur le front, le bras tendu : un petit « perdant » qu'il dessine avec ses doigts, pour rire */
  takel: () => ({
    duree: 2,
    fx: `<g class="scintille">${A(['Y.', 'Y.', 'Y.', 'YYY'], 70, -16, 3)}</g>`,
    images: [
      corps({ g: 'tete', d: 'tendu', yeux: 'clin' }),
      corps({ g: 'tete', d: 'tendu', yeux: 'heureux', dy: -2 }),
      corps({ g: 'tete', d: 'tendu', yeux: 'mi', dy: -1 }),
      corps({ g: 'tete', d: 'tendu', yeux: 'ferme', dy: 1 }),
    ],
  }),
  /** Le 6-7 : les deux paumes qui montent et descendent à contretemps, les yeux grands */
  sixseven: () => ({
    duree: 0.6,
    images: [
      corps({ dy: -2, g: 'ciel', d: 'bas', yeux: 'grand' }),
      corps({ dy: 1, g: 'bas', d: 'ciel', yeux: 'grand' }),
      corps({ dy: -2, g: 'ciel', d: 'bas', yeux: 'heureux' }),
      corps({ dy: 1, g: 'bas', d: 'ciel', yeux: 'heureux' }),
    ],
  }),
  gratte: () => ({
    duree: 1.6,
    fx: glyphe('?', 70, -10, 16, PAL.Y!, 'scintille'),
    images: [corps({ d: 'tete', yeux: 'gauche' }), corps({ d: 'haut', yeux: 'haut' }), corps({ d: 'tete', yeux: 'droite' }), corps({ d: 'haut', yeux: 'haut' })],
  }),
  meditation: () => ({
    duree: 3,
    cls: 'flotte',
    fx: effets.zen(),
    images: [corps({ jambes: 'assis', dy: 4, g: 'tendu', d: 'tendu', yeux: 'ferme' })],
  }),
  cookie: () => ({
    duree: 3.2,
    images: [
      corps({ d: 'devant', yeux: 'coeur' }) + A(COOKIE, 44, 16),
      corps({ d: 'haut', bouche: 'o', yeux: 'ferme' }) + A(COOKIE, 38, 10),
      corps({ d: 'haut', yeux: 'heureux' }) + A(COOKIE_CROQUE, 40, 10),
      corps({ d: 'devant', yeux: 'heureux' }) + A(COOKIE_CROQUE, 44, 16) + A(['N.n', '.N.'], 30, 44, 2),
    ],
  }),
  glace: () => ({
    duree: 3.2,
    images: [
      corps({ d: 'devant', yeux: 'coeur' }) + A(GLACE, 44, 14),
      corps({ d: 'haut', bouche: 'o', yeux: 'ferme' }) + A(GLACE, 38, 8),
      corps({ d: 'haut', yeux: 'heureux' }) + A(GLACE_LECHEE, 38, 8),
      corps({ d: 'devant', yeux: 'heureux' }) + A(GLACE_RESTE, 44, 14) + A(['P', 'P'], 50, 36, 2),
    ],
  }),

  // --------------------------------------------------------- réactions
  ecoute: () => ({
    duree: 1,
    images: [
      corps({ jambes: 'replie', dy: 3, yeux: 'heureux' }),
      corps({ g: 'haut', d: 'haut', dy: -10, jambes: 'replie', yeux: 'heureux', masse: 'etire' }),
      corps({ g: 'haut', d: 'haut', dy: -4, jambes: 'replie', yeux: 'heureux' }),
      corps({ jambes: 'replie', dy: 2, yeux: 'heureux' }),
      corps({ yeux: 'heureux' }),
    ],
  }),
  // Halloween, un commit réussi : déguisé en citrouille, il sort un bonbon de
  // derrière son dos, te le montre avec un clin d'œil, tend la patte et le
  // lâche ; le bonbon tombe en accélérant, rebondit une fois à ses pieds, et
  // il sautille, content de sa farce.
  bonbon: () =>
    deguiseEn('citrouille', () => {
      const b = (dx: number, dy: number) => A(BONBON, dx, dy, 2)
      const sol = 48 - 10
      const tendu = (yeux: Yeux, bonbon: string) => corps({ d: 'tendu', yeux }) + bonbon
      const auSol = b(72, sol)
      return {
        duree: BONBON_S,
        images: [
          corps({ d: 'cache', yeux: 'droite' }),
          corps({ d: 'cache', yeux: 'clin' }),
          corps({ d: 'ciel', yeux: 'heureux' }) + b(57, -22),
          corps({ d: 'ciel', yeux: 'clin' }) + b(57, -22),
          tendu('droite', b(72, 13)),
          // il le lâche : il tombe de plus en plus vite
          tendu('bas', b(72, 18)),
          tendu('bas', b(72, 27)),
          tendu('bas', A(BONBON_SOL, 71, sol + 2, 2)),
          corps({ yeux: 'bas', bouche: 'o' }) + b(72, sol - 5),
          corps({ yeux: 'bas' }) + auSol,
          corps({ jambes: 'replie', dy: 3, yeux: 'heureux' }) + auSol,
          corps({ g: 'haut', d: 'haut', dy: -8, jambes: 'replie', yeux: 'heureux', masse: 'etire' }) + auSol,
          corps({ jambes: 'replie', dy: 2, yeux: 'heureux' }) + auSol,
          corps({ yeux: 'heureux' }) + auSol,
        ],
      }
    }),
  marche: () => ({ duree: 1, cls: 'balade', images: [profil('vite')] }),
  ecrit: () => {
    // Assis, il écrit pour de vrai : sa patte tient le crayon et le suit, la
    // mine trace la ligne au fur et à mesure, puis il passe à la ligne
    // suivante. Il se balance un peu en écrivant et cligne des yeux.
    const feuille = R(X0 + 72, Y0 + 38, 34, 10, PAL.W!)
    const images: string[] = []
    for (const ligne of [0, 1]) {
      ;[78, 84, 90, 96].forEach((mine, k) => {
        const yLigne = 41 + ligne * 4
        const traits =
          (ligne === 1 ? R(X0 + 75, Y0 + 41, 24, 1, PAL.G!) : '') + R(X0 + 75, Y0 + yLigne, mine - 75 + 1, 1, PAL.G!)
        // le crayon a sa mine en bas à gauche : on la pose sur la ligne
        const yCrayon = yLigne - 13
        const patte = R(X0 + 58, Y0 + yCrayon + 2, mine - 58 + 11, 7, PAL.O!)
        const yeux: Yeux = ligne === 1 && k === 3 ? 'ferme' : 'bas'
        images.push(
          corps({ jambes: 'assis', dy: 8 + (k % 2), d: 'cache', yeux }) + feuille + traits + patte + A(CRAYON, mine, yCrayon, 3),
        )
      })
    }
    return { duree: 2.4, images }
  },
  cherche: () => ({
    duree: 2,
    images: [
      corps({ d: 'haut', yeux: 'grand' }) + A(LOUPE, 40, -2, 3),
      corps({ d: 'haut', yeux: 'droite' }) + A(LOUPE, 52, -6, 3),
      corps({ g: 'haut', yeux: 'grand' }) + A(LOUPE, 12, -2, 3),
      corps({ g: 'haut', yeux: 'gauche' }) + A(LOUPE, 2, -6, 3),
    ],
  }),
  build: () => ({
    duree: 0.6,
    fx: effets.sueur(),
    images: [
      corps({ d: 'ciel', yeux: 'droite' }) + A(MARTEAU_HAUT, 62, -26) + A(BRIQUE, 84, 39),
      corps({ d: 'tendu', yeux: 'ferme' }) + A(MARTEAU_BAS, 80, 28) + A(BRIQUE, 84, 39) + A(ETOILE, 98, 30, 2) + A(ETOILE, 82, 32, 2),
    ],
  }),
  tests: () => ({
    duree: 2.4,
    images: [0, 1, 2, 3].map(n =>
      corps({ d: 'devant', g: 'devant', yeux: 'bas' }) + A(PLANCHETTE, 27, 10, 3) + rep(n, k => A(['.V', 'V.'], 33, 17 + k * 4, 2)).join(''),
    ),
  }),
  push: () => ({
    duree: 1.8,
    images: [
      corps({ d: 'ciel', yeux: 'haut' }) + A(AVION, 62, -22),
      corps({ d: 'tendu', yeux: 'droite' }) + A(AVION, 88, -18),
      corps({ d: 'bas', yeux: 'heureux' }) + A(AVION, 104, -32, 2),
      corps({ yeux: 'heureux' }),
    ],
  }),
  tel: () => ({
    duree: 2,
    images: [0, 1, 2, 3].map(n =>
      corps({ d: 'devant', g: 'devant', yeux: 'bas' }) + A(TEL, 30, 12, 3) + R(X0 + 33, Y0 + 26, n * 2, 2, PAL.V!),
    ),
  }),
  copain: () => ({
    duree: 2,
    fx: `<g class="court">${A(COPAIN, -54, 38, 2)}</g>`,
    images: [corps({ yeux: 'gauche' }), corps({ yeux: 'normal' }), corps({ yeux: 'droite', d: 'haut' }), corps({ yeux: 'droite', d: 'ciel' })],
  }),
  // Un sous-agent a fini : son mini-Clawd vient lui rendre son travail (par
  // défaut, la loupe d'une recherche ; voir `rapport`)
  rapport: () => rapport('cherche'),
  // Des sous-agents bossent : Clawd devient chef de chantier, planchette en
  // main, il pointe ses mini-copains du doigt et coche ce qui avance.
  chef: () => {
    const planchette = A(PLANCHETTE, 44, 8, 3)
    const coche = A(['.V', 'V.'], 50, 15, 2)
    return {
      duree: 2.4,
      images: [
        corps({ g: 'tendu', d: 'devant', yeux: 'gauche' }) + planchette,
        corps({ g: 'tendu', d: 'devant', yeux: 'gauche', dy: 1 }) + planchette,
        corps({ d: 'devant', yeux: 'bas' }) + planchette + coche,
        corps({ g: 'haut', d: 'devant', yeux: 'heureux' }) + planchette + coche,
      ],
    }
  },
  // Trois sous-agents ou plus : le chantier se corse, le chef sort son
  // sifflet. Il prend son souffle (il s'étire), siffle un grand coup en
  // gonflant les joues (il s'élargit), le bras tendu vers son équipe, et ses
  // mini-Clawds sursautent à chaque coup de sifflet (`.au-sifflet`) ; puis il
  // coche sa planchette, content.
  sifflet: () => {
    // la planchette et le sifflet reviennent à chaque image : écrits une fois (`defs`), puis repris
    const planchette = `<use href="#planchette-chef" x="${X0 + 44}" y="${Y0 + 8}"/>`
    const coche = A(['.V', 'V.'], 50, 15, 2)
    // l'embout dans sa bouche ; le corps s'étire ou s'écrase autour de ses pieds, le sifflet avec
    const siffle = ({ masse, ...p }: Pose, plus = '') =>
      pese(corps(p) + `<use href="#sifflet" x="${X0 + 20}" y="${Y0 + 17}"/>` + plus, { masse })
    // le son part vers son équipe, en arcs de plus en plus grands, au-dessus de son bras
    const onde = (n: number) =>
      A(['.W', 'W.', 'W.', '.W'], 4, -2, 3) + (n > 1 ? A(['.W', 'W.', 'W.', 'W.', 'W.', '.W'], -6, -8, 3) : '')
    return {
      duree: SIFFLET_S,
      minis: 'au-sifflet',
      defs: `<defs><g id="planchette-chef">${art(PLANCHETTE, 0, 0, 3)}</g><g id="sifflet">${art(SIFFLET, 0, 0, 2)}</g></defs>`,
      images: [
        // il regarde son équipe, le sifflet aux lèvres
        siffle({ d: 'devant', yeux: 'gauche' }, planchette),
        // il prend son souffle…
        siffle({ d: 'devant', yeux: 'gauche', masse: 'etire' }, planchette),
        // … et siffle un grand coup, joues gonflées, le bras tendu vers eux
        siffle({ g: 'tendu', d: 'devant', yeux: 'ferme', masse: 'ecrase' }, planchette + onde(1)),
        siffle({ g: 'tendu', d: 'devant', yeux: 'ferme', masse: 'ecrase' }, planchette + onde(2)),
        siffle({ g: 'tendu', d: 'devant', yeux: 'gauche' }, planchette),
        // un deuxième coup, plus court
        siffle({ g: 'tendu', d: 'devant', yeux: 'gauche', masse: 'etire' }, planchette),
        siffle({ g: 'tendu', d: 'devant', yeux: 'ferme', masse: 'ecrase' }, planchette + onde(2)),
        // ça repart : il coche, content
        siffle({ d: 'devant', yeux: 'bas' }, planchette + coche),
        siffle({ g: 'haut', d: 'devant', yeux: 'heureux' }, planchette + coche),
      ],
    }
  },
  fete: () => ({
    duree: 1.2,
    fx: effets.confettis() + effets.etincelles(),
    images: [
      // il prend son élan, s'étire en décollant, retombe, s'écrase en se recevant
      corps({ g: 'haut', d: 'haut', jambes: 'replie', dy: 3, yeux: 'heureux' }),
      corps({ g: 'ciel', d: 'ciel', dy: -10, jambes: 'replie', yeux: 'heureux', masse: 'etire' }),
      corps({ g: 'ciel', d: 'ciel', dy: -16, jambes: 'replie', yeux: 'heureux' }),
      corps({ g: 'ciel', d: 'ciel', dy: -8, jambes: 'replie', yeux: 'heureux' }),
      corps({ g: 'haut', d: 'haut', jambes: 'replie', dy: 3, yeux: 'ferme' }),
      corps({ g: 'haut', d: 'haut', yeux: 'heureux' }),
    ],
  }),
  triste: () => ({
    duree: 1.2,
    images: [0, 1].map(i =>
      corps({ jambes: 'assis', dy: 8, g: 'pend', d: 'pend', yeux: 'mi' }) + A(NUAGE, 24, -18, 3) + A(['B', '.', '.', 'B'], 30 + i * 6, -4 + i * 3, 3) + A(['B'], 48 - i * 4, -2 + i * 5, 3),
    ),
  }),
  // Trois échecs d'affilée : il se gratte la tête en regardant de tous côtés,
  // soupire, se laisse tomber sur les fesses et enfouit sa tête dans ses
  // pattes, sous un petit nuage qui pleut.
  decourage: () => {
    const f = corps
    const assis = 8
    // ses coudes posés sur les genoux, ses pattes (ombrées) sur ses yeux
    const pattesSurLesYeux = (dy: number) =>
      R(X0 + 2, Y0 + dy + 24, 10, 10, PAL.O!) + R(X0 + 60, Y0 + dy + 24, 10, 10, PAL.O!) +
      R(X0 + 12, Y0 + dy + 4, 18, 12, PAL.o!) + R(X0 + 42, Y0 + dy + 4, 18, 12, PAL.o!)
    const effondre = (dy: number) => f({ jambes: 'assis', dy, g: 'cache', d: 'cache', yeux: 'ferme' }) + pattesSurLesYeux(dy)
    // un petit nuage au-dessus de sa tête basse, et la pluie qui tombe
    const pluie = (i: number) => A(NUAGE, 24, -12, 3) + A(['B', '.', '.', 'B'], 30 + i * 6, 2 + i * 3, 3) + A(['B'], 48 - i * 4, 4 + i * 5, 3)
    // son soupir : une petite bouffée qui s'échappe sur le côté
    const souffle = A(['.ww', 'www', '.w.'], 2, -6, 2)
    return choreo(
      [
        // il se gratte la tête et cherche de tous côtés ce qui cloche
        {
          duree: 1.8,
          images: [
            f({ d: 'tete', yeux: 'gauche' }),
            f({ d: 'haut', yeux: 'haut' }),
            f({ d: 'tete', yeux: 'droite' }),
            f({ d: 'haut', yeux: 'haut' }),
          ],
        },
        // les épaules tombent, il soupire
        {
          duree: 1,
          images: [
            f({ g: 'pend', d: 'pend', yeux: 'mi', bouche: 'o' }) + souffle,
            f({ g: 'pend', d: 'pend', yeux: 'mi', dy: 2 }),
          ],
        },
        // il se laisse tomber, un petit rebond sur les fesses
        {
          duree: 0.6,
          images: [
            f({ jambes: 'replie', dy: 4, g: 'pend', d: 'pend', yeux: 'ferme' }),
            f({ jambes: 'assis', dy: assis + 2, g: 'pend', d: 'pend', yeux: 'ferme' }),
            f({ jambes: 'assis', dy: assis, g: 'pend', d: 'pend', yeux: 'mi' }),
          ],
        },
        // la tête dans les pattes ; il la relève un peu, soupire, et replonge
        {
          duree: 4.4,
          images: [
            effondre(assis) + pluie(0),
            effondre(assis + 1) + pluie(1),
            effondre(assis) + pluie(0),
            effondre(assis + 1) + pluie(1),
            f({ jambes: 'assis', dy: assis, g: 'pend', d: 'pend', yeux: 'bas' }) + pluie(0),
            f({ jambes: 'assis', dy: assis, g: 'pend', d: 'pend', yeux: 'bas', bouche: 'o' }) + pluie(1) + A(['.ww', 'www', '.w.'], 2, 4, 2),
            effondre(assis) + pluie(0),
            effondre(assis + 1) + pluie(1),
          ],
        },
      ],
      // le « ? » de l'inquiétude, tant qu'il se gratte la tête
      { decor: [{ svg: `<g class="scintille">${A(['.YYY.', 'Y...Y', '...Y.', '..Y..', '.....', '..Y..'], 74, -14, 3)}</g>`, visible: [[0, 1.8]] }] },
    )
  },
  // Ça passe enfin, après une série d'échecs : il n'y croit pas, puis bondit
  // de joie sous un feu d'artifice, s'essuie le front, soulagé, et lève les
  // bras au ciel. Plus grand et plus long qu'une fête ordinaire.
  delivrance: () => {
    const f = corps
    const saut = (dy: number, bouche?: 'o' | 'grand', masse?: 'etire') =>
      f({ g: 'ciel', d: 'ciel', dy, jambes: 'replie', yeux: 'heureux', bouche, masse })
    // une goutte de sueur qui s'envole quand il s'essuie le front
    const goutte = (dx: number, dy: number) => A(['B', 'B'], dx, dy, 3)
    // les fusées, à gauche de lui, au-dessus de sa petite scène : [départ, x, y, couleur]
    const fusees: [number, number, number, string][] = [
      // (assez bas pour que leurs gerbes, jusqu'à 18 de rayon, restent dans le cadre qui commence à y = 8)
      [1.4, -40, 29, 'Y'],
      [2.6, 8, 27, 'P'],
      [3.8, -22, 32, 'B'],
      [5.0, -52, 28, 'V'],
    ]
    const decor: Decor[] = []
    for (const [t, x, y, c] of fusees) {
      // la fusée monte en laissant une traînée…
      ;[40, 20].forEach((h, k) => {
        decor.push({ svg: R(x, y + h, 3, 6, PAL.W!) + R(x, y + h + 6, 3, 6, PAL.y!), visible: [[t + k * 0.2, t + (k + 1) * 0.2]] })
      })
      // … puis éclate en gerbe qui s'ouvre, retombe et s'éteint
      const gerbe = (r: number, chute: number, p: number, col: string, n = 8) =>
        rep(n, i => {
          const a = (i * 2 * Math.PI) / n
          return R(Math.round(x + r * Math.cos(a)), Math.round(y + chute + r * Math.sin(a)), p, p, col)
        }).join('')
      const t0 = t + 0.4
      decor.push(
        { svg: R(x - 2, y - 2, 7, 7, PAL.W!) + gerbe(7, 0, 3, PAL[c]!), visible: [[t0, t0 + 0.25]] },
        { svg: gerbe(14, 0, 4, PAL[c]!) + gerbe(7, 0, 3, PAL.W!, 4), visible: [[t0 + 0.25, t0 + 0.65]] },
        { svg: `<g opacity=".6">${gerbe(18, 5, 3, PAL[c]!)}</g>`, visible: [[t0 + 0.65, t0 + 1.1]] },
      )
    }
    // les confettis pleuvent pendant toute la fête
    decor.push({ svg: effets.confettis(), visible: [[2, 7.6]] })
    return choreo(
      [
        // il n'y croit pas : yeux ronds, bouche bée, il cligne…
        {
          duree: 1.2,
          images: [
            f({ yeux: 'grand' }),
            f({ yeux: 'grand', bouche: 'o' }),
            f({ yeux: 'ferme', bouche: 'o' }),
            f({ yeux: 'grand', bouche: 'o', g: 'haut', d: 'haut' }),
          ],
        },
        // … il se ramasse, et bondit très haut
        { duree: 0.4, images: [f({ jambes: 'replie', dy: 5, g: 'pend', d: 'pend', yeux: 'heureux' })] },
        { duree: 0.6, images: [saut(-12, 'grand', 'etire'), saut(-20, 'grand')] },
        // et saute de joie sous le feu d'artifice
        {
          duree: 4.8,
          tours: 4,
          images: [
            f({ g: 'haut', d: 'haut', jambes: 'replie', dy: 4, yeux: 'heureux' }),
            saut(-16, 'grand', 'etire'),
            saut(-9),
            f({ g: 'haut', d: 'haut', yeux: 'heureux' }),
          ],
        },
        // ouf : il s'essuie le front, souffle un grand coup
        {
          duree: 1.8,
          images: [
            f({ g: 'tete', yeux: 'ferme' }),
            f({ g: 'haut', yeux: 'ferme' }) + goutte(-8, -6),
            f({ g: 'pend', d: 'pend', yeux: 'heureux', bouche: 'o', dy: 1 }) + goutte(-16, 4) + A(['.ww', 'www', '.w.'], 2, -6, 2),
            f({ g: 'pend', d: 'pend', yeux: 'heureux', dy: 1 }),
          ],
        },
        // et lève les bras au ciel, des étoiles plein les yeux
        {
          duree: 1.2,
          images: [f({ g: 'ciel', d: 'ciel', yeux: 'etoile', bouche: 'grand' }), f({ g: 'ciel', d: 'ciel', yeux: 'etoile', dy: -2 })],
        },
      ],
      { decor },
    )
  },
  alerte: () => ({
    duree: 0.3,
    cls: 'tremble',
    fx: glyphe('!', 30, -16, 22, PAL.R!, 'scintille'),
    images: [corps({ g: 'ciel', d: 'ciel', yeux: 'grand' }), corps({ g: 'haut', d: 'haut', yeux: 'grand' })],
  }),
  surpris: () => ({
    duree: 1,
    fx: glyphe('?!', 26, -14, 16, PAL.Y!, 'scintille'),
    images: [corps({ g: 'haut', d: 'haut', dy: -8, jambes: 'replie', yeux: 'grand', masse: 'etire' }), corps({ yeux: 'grand' }), corps({ yeux: 'grand' })],
  }),
  dodo: () => {
    const base = corps({ jambes: 'assis', dy: 8, g: 'pend', d: 'pend', yeux: 'ferme' }) + A(BONNET, 10, -4)
    return {
      duree: 3,
      fx: effets.zzz(),
      images: [base + A(['.B.', 'B.B', '.B.'], 38, 26, 2), base + A(BULLE, 38, 22, 3)],
    }
  },
  fatigue: () => ({
    duree: 1.8,
    fx: effets.sueur(),
    images: [
      corps({ yeux: 'mi', g: 'pend', d: 'pend', jambes: 'pasA', dy: 1 }),
      corps({ yeux: 'mi', g: 'pend', d: 'pend', jambes: 'pasB', dy: 1 }),
    ],
  }),
  vertige: () => ({
    duree: 1.2,
    cls: 'vacille',
    images: rep(4, i =>
      corps({ yeux: 'croix' }) +
      [0, 1, 2]
        .map(k => {
          const a = ((i * 90 + k * 120) * Math.PI) / 180
          return A(ETOILE, Math.round(33 + 30 * Math.cos(a)), Math.round(-10 + 6 * Math.sin(a)), 2)
        })
        .join(''),
    ),
  }),
  coeur: () => ({
    duree: 0.8,
    fx: effets.coeurs(),
    images: [
      corps({ g: 'devant', d: 'devant', yeux: 'coeur' }) + A(COEUR, 25, 12, 3),
      corps({ g: 'devant', d: 'devant', yeux: 'coeur', dy: -3 }) + A(COEUR, 25, 9, 3),
    ],
  }),
  // Le premier réveil de la journée : il arrive en traînant les pattes, les
  // yeux mi-clos et son bonnet de nuit encore sur la tête, pique du nez,
  // bâille, se frotte l'œil, s'étire, jette son bonnet, puis boit son café…
  // et là, il est réveillé pour de bon.
  reveil: () => {
    const f = corps
    // un peu plus haut que pour dormir : ses yeux mi-clos doivent se voir
    const bonnet = (dy = 0) => A(BONNET, 10, -9 + dy)
    // jeté par terre, à sa gauche : il y reste jusqu'à la fin
    const parTerre = A(BONNET, -42, 33)
    const ensuque = (p: Pose = {}) => f({ yeux: 'mi', g: 'pend', d: 'pend', dy: 1, ...p })
    // sa patte (ombrée, devant le visage) frotte son œil droit
    const frotte = (dy: number) => f({ yeux: 'mi', d: 'haut' }) + bonnet() + R(X0 + 46, Y0 + 3 + dy, 14, 9, PAL.o!)
    const tasse = (yeux: Yeux, vapeur?: 0 | 1) =>
      f({ d: 'devant', yeux }) + A(TASSE, 42, 10) + (vapeur === undefined ? '' : A(VAPEUR[vapeur]!, 46, 2)) + parTerre
    const gorgee = f({ d: 'haut', yeux: 'ferme' }) + A(TASSE, 38, 4) + parTerre
    return choreo([
      {
        duree: 2,
        tours: 5,
        // ses paupières tombent à chaque pas
        images: [ensuque({ jambes: 'pasA' }) + bonnet(1), ensuque({ jambes: 'pasB', dy: 2, yeux: 'ferme' }) + bonnet(2)],
        de: -60,
        a: 0,
      },
      // il pique du nez, debout
      { duree: 0.9, images: [ensuque() + bonnet(1), ensuque({ yeux: 'ferme', dy: 3 }) + bonnet(3), ensuque() + bonnet(1)] },
      {
        duree: 1.6,
        images: [
          ensuque({ bouche: 'o' }) + bonnet(1),
          f({ yeux: 'ferme', bouche: 'grand', g: 'haut', d: 'haut', dy: -1 }) + bonnet(-1),
          f({ yeux: 'ferme', bouche: 'grand', g: 'haut', d: 'haut', dy: -1 }) + bonnet(-1),
          f({ yeux: 'ferme', bouche: 'o', g: 'pend', d: 'pend' }) + bonnet(),
        ],
      },
      { duree: 0.8, tours: 2, images: [frotte(0), frotte(3)] },
      {
        duree: 1.4,
        images: [
          f({ g: 'ciel', d: 'ciel', yeux: 'ferme', bouche: 'o', dy: -3 }) + bonnet(-3),
          f({ g: 'ciel', d: 'ciel', yeux: 'ferme', bouche: 'o', dy: -4 }) + bonnet(-4),
          f({ g: 'haut', d: 'haut', yeux: 'mi' }) + bonnet(),
        ],
      },
      // il attrape son bonnet et le jette par-dessus son épaule
      {
        duree: 1,
        images: [
          f({ g: 'tete', yeux: 'mi' }) + bonnet(),
          f({ g: 'ciel', yeux: 'normal' }) + A(BONNET, -8, -24),
          f({ g: 'haut', yeux: 'gauche' }) + A(BONNET, -30, -8),
          f({ yeux: 'gauche' }) + parTerre,
        ],
      },
      // le café : il hume, boit une longue gorgée… et ses yeux s'ouvrent grand
      {
        duree: 3,
        images: [
          tasse('mi', 0), tasse('ferme', 1), tasse('ferme', 0), gorgee, gorgee,
          // le sursaut du café
          f({ d: 'devant', g: 'haut', yeux: 'grand', dy: -3 }) + A(TASSE, 42, 7) + parTerre,
        ],
      },
      {
        duree: 1.2,
        images: [
          f({ g: 'ciel', d: 'devant', yeux: 'heureux', dy: -6, jambes: 'replie' }) + A(TASSE, 42, 4) + parTerre,
          tasse('heureux'),
          tasse('heureux'),
        ],
      },
    ])
  },
  // Deux heures que tu enchaînes sans souffler : il arrive avec un verre
  // d'eau, te le tend (il grossit : il le pousse vers toi), en boit une
  // gorgée pour montrer l'exemple, le pose, s'étire en te regardant et te
  // montre le verre. À toi.
  pause: () => {
    const f = corps
    // tenu à deux pattes devant son ventre, puis poussé vers toi (plus gros)
    const tenu = (p: Pose = {}, dy = 0) => f({ g: 'devant', d: 'devant', ...p }) + A(VERRE, 27, 14 + dy) + pattes(21 + dy)
    const tendu = (p: Pose = {}, dy = 0) => f({ g: 'devant', d: 'devant', ...p }) + A(VERRE, 24, 6 + dy, 4) + pattes(15 + dy, 4)
    const pattes = (dy: number, ecart = 0) => R(X0 + 23 - ecart, Y0 + dy, 6, 6, PAL.O!) + R(X0 + 43 + ecart, Y0 + dy, 6, 6, PAL.O!)
    // posé par terre, à sa droite : il y reste jusqu'à la fin
    const pose = A(VERRE_BU, 74, 30)
    return choreo([
      {
        duree: 2,
        tours: 5,
        // il arrive en trottinant, le verre bien droit pour ne rien renverser
        images: [tenu({ jambes: 'pasA', yeux: 'bas' }), tenu({ jambes: 'pasB', dy: 1, yeux: 'bas' }, 1)],
        de: -60,
        a: 0,
      },
      // il lève les yeux vers toi… et te tend le verre
      { duree: 0.8, images: [tenu({ yeux: 'normal' }), tenu({ yeux: 'heureux' })] },
      {
        duree: 2.4,
        tours: 2,
        images: [tendu({ yeux: 'normal' }), tendu({ yeux: 'heureux' }, -1), tendu({ yeux: 'normal', bouche: 'o' })],
      },
      // tu ne le prends pas : il montre l'exemple, une bonne gorgée
      {
        duree: 1.8,
        images: [
          f({ d: 'haut', yeux: 'ferme' }) + A(VERRE, 38, 2),
          f({ d: 'haut', yeux: 'ferme', dy: 1 }) + A(VERRE_BU, 38, 1),
          f({ d: 'haut', yeux: 'heureux' }) + A(VERRE_BU, 38, 4),
        ],
      },
      // il le pose à côté de lui
      { duree: 0.8, images: [f({ d: 'pend', yeux: 'droite', dy: 3 }) + A(VERRE_BU, 70, 27), f({ yeux: 'droite' }) + pose] },
      // il s'étire en te regardant, d'un côté puis de l'autre
      {
        duree: 2.4,
        images: [
          f({ g: 'ciel', d: 'ciel', yeux: 'ferme', bouche: 'o', dy: -4 }) + pose,
          f({ g: 'ciel', d: 'haut', yeux: 'normal', dx: -3, dy: -2 }) + pose,
          f({ g: 'haut', d: 'ciel', yeux: 'normal', dx: 3, dy: -2 }) + pose,
          f({ g: 'haut', d: 'haut', yeux: 'heureux' }) + pose,
        ],
      },
      // et te montre le verre : à toi
      { duree: 1.6, tours: 2, images: [f({ d: 'tendu', yeux: 'normal' }) + pose, f({ d: 'tendu', yeux: 'clin' }) + pose] },
    ])
  },
  nuit: () => ({
    duree: 2.4,
    images: [
      // debout, son bonnet posé au-dessus des yeux (comme au réveil), pas sur l'œil gauche
      corps({ yeux: 'mi', bouche: 'grand', g: 'haut' }) + A(BONNET, 10, -9),
      corps({ yeux: 'ferme', g: 'bas' }) + A(BONNET, 10, -9),
    ],
  }),
  // La conversation se compacte : il saute sur la pile de feuilles pour la
  // tasser… et elle rebondit à chaque fois. Il insiste tant que ça dure.
  tasse: () => {
    // ses pattes sur le dessus de la pile : n feuilles font 4n de haut
    const pile = (n: number) => A(feuilles(n), 8, 48 - 4 * n, 2)
    const ecrasee = A(PILE_ECRASEE, 8, 40, 2)
    const tasse = corps({ dy: -2, jambes: 'replie', g: 'tendu', d: 'tendu', yeux: 'ferme', bouche: 'o' }) + ecrasee
    return {
      duree: 1.5,
      fx: effets.feuilles(),
      images: [
        corps({ dy: -24, g: 'haut', d: 'haut', yeux: 'bas' }) + pile(6),
        // (son chapeau-citrouille dépasserait du cadre : il saute un peu moins haut ces jours-là)
        corps({ dy: deguisement === 'citrouille' ? -23 : -32, jambes: 'replie', g: 'haut', d: 'haut', yeux: 'heureux' }) + pile(6),
        corps({ dy: -12, g: 'tendu', d: 'tendu', yeux: 'ferme' }) + pile(3),
        tasse,
        tasse,
        corps({ dy: -20, g: 'haut', d: 'haut', yeux: 'grand' }) + pile(5),
      ],
    }
  },
  // … et quand c'est fini : tout tient dans un petit paquet ficelé. Fier de lui.
  paquet: () => {
    const paquet = A(PAQUET, 21, 32, 2)
    return {
      duree: 2.4,
      fx: effets.etincelles(),
      images: [
        corps({ yeux: 'bas' }) + paquet,
        corps({ g: 'haut', d: 'haut', yeux: 'heureux' }) + paquet,
        corps({ g: 'haut', d: 'ciel', yeux: 'clin' }) + paquet,
        corps({ d: 'tete', yeux: 'heureux' }) + paquet,
      ],
    }
  },
  // Claude attend ta permission : il se tourne vers toi, lève la patte et
  // tape du pied, un petit cadenas à côté, jusqu'à ce que tu répondes
  attend: () => ({
    duree: 1.2,
    fx: effets.cadenas(),
    images: [
      corps({ d: 'ciel' }),
      corps({ d: 'ciel', jambes: 'tape' }),
      corps({ d: 'haut' }),
      corps({ d: 'ciel', jambes: 'tape', yeux: 'ferme' }),
    ],
  }),
  // Une question pour toi : il brandit sa pancarte « ? » et attend ta réponse
  question: () => {
    const pancarte = (dy: number) => A(PANCARTE, 53, -28 + dy, 2)
    return {
      duree: 2,
      images: [
        corps({ d: 'haut' }) + pancarte(0),
        corps({ d: 'haut', dy: 1 }) + pancarte(1),
        corps({ d: 'haut', yeux: 'ferme' }) + pancarte(0),
        corps({ d: 'haut', yeux: 'heureux' }) + pancarte(0),
      ],
    }
  },
  // Des dépendances s'installent : il fouille un carton ouvert et lance ce
  // qu'il trouve par-dessus son épaule
  deballe: () => {
    const boite = cartonOuvert(CARTON_X, 14)
    const fouille = corps({ g: 'devant', d: 'devant', yeux: 'bas', dy: 2 }) + boite + pinces(22)
    return {
      duree: 1.6,
      fx: effets.deballe(),
      images: [
        fouille,
        corps({ g: 'devant', d: 'haut', yeux: 'bas' }) + boite + A(PETIT_PAQUET('B'), 62, -4, 2),
        corps({ g: 'devant', d: 'ciel', yeux: 'heureux' }) + boite,
        corps({ g: 'devant', d: 'devant', yeux: 'droite' }) + boite + pinces(24),
      ],
    }
  },
  // ses jeux de cartons, de temps en temps pendant son déménagement (voir `JEUX_CARTONS`)
  colis,
  gigogne,
  tambour,
  podium,
  // Un conflit git : il se tapit derrière un grand carton, les pinces
  // agrippées au bord, et tremble ; de temps en temps il se hisse pour jeter
  // un œil de chaque côté, écarquille les yeux et replonge
  cache: () => {
    const f = corps
    return {
      duree: 4,
      cls: 'tremble',
      fx: abri(true),
      images: [
        tapi(),
        tapi(),
        tapi(),
        f({ dy: 1, jambes: 'assis', g: 'cache', d: 'cache', yeux: 'haut' }),
        guette('gauche'),
        guette('droite'),
        guette('grand'),
        f({ dy: 1, jambes: 'assis', g: 'cache', d: 'cache', yeux: 'bas' }),
      ],
    }
  },
  // Le conflit est résolu : il passe la tête, regarde de chaque côté, n'y
  // croit pas, sort de derrière son carton sur la pointe des pieds, souffle
  // un grand coup, les épaules qui tombent, et s'essuie le front
  soulage: () => {
    const f = corps
    // la goutte de sueur qui s'envole quand il s'essuie le front ; son soupir
    const goutte = (dx: number, dy: number) => A(['B', 'B'], dx, dy, 3)
    const souffle = A(['.ww', 'www', '.w.'], 76, -6, 2)
    return choreo(
      [
        // il se hisse, regarde à gauche, à droite…
        { duree: 1.6, images: [tapi(), f({ dy: 1, jambes: 'assis', g: 'cache', d: 'cache', yeux: 'haut' }), guette('gauche'), guette('droite')] },
        // … c'est fini ? c'est fini.
        { duree: 0.6, images: [guette('grand'), guette('heureux')] },
        // il sort de sa cachette à petits pas, par la gauche
        { duree: 1.6, tours: 3, a: -70, images: [f({ jambes: 'pasA', yeux: 'gauche' }), f({ jambes: 'pasB', yeux: 'gauche' })] },
        // il se retourne vers toi et souffle un grand coup, les épaules tombent
        {
          duree: 1.4,
          images: [
            f({ g: 'pend', d: 'pend', yeux: 'ferme', bouche: 'o' }) + souffle,
            f({ g: 'pend', d: 'pend', yeux: 'mi', dy: 2 }),
          ],
        },
        // il s'essuie le front
        {
          duree: 1.2,
          images: [f({ g: 'tete', yeux: 'ferme' }), f({ g: 'haut', yeux: 'ferme' }) + goutte(-8, -6), f({ yeux: 'heureux', dy: 1 }) + goutte(-16, 4)],
        },
        // et sourit, une patte levée vers toi : tout va bien
        { duree: 1, images: [f({ d: 'haut', yeux: 'heureux' }), f({ d: 'ciel', yeux: 'clin' })] },
      ],
      { fx: abri(false) },
    )
  },
  // Tu reviens après plus de 8 h : il t'a attendu ; après plus d'un jour et demi, il saute de joie
  attendu: () => retrouve(false),
  retrouvailles: () => retrouve(true),
  // une visite rare au repos : un chat le jour, une étoile filante le soir
  chat: visiteChat,
  filante: visiteFilante,
  // il monte de niveau
  niveau,
}

// ------------------------------------------------------------------- CSS

/** La durée du rapport (s) : 20 images de 0,3 s ; le mini part à la 15e (75 %) */
export const RAPPORT_S = 6
/** La durée du bonbon d'Halloween (s) : 14 images de 0,25 s, jouées une fois */
export const BONBON_S = 3.5
/** Un bâillement (s) : un seul, à la fin d'un tour du lundi matin (il ne retient pas la file des scènes) */
export const BAILLE_S = 4
/** La durée du sifflet (s) : 9 images de 0,4 s ; il siffle aux 3e-4e et à la 7e */
const SIFFLET_S = 3.6

/**
 * Sa vie au calme : une boucle de 23 s, trop longue pour qu'on y voie un
 * rythme. Ses souffles n'ont pas tous la même longueur, et le 4e est un
 * soupir (il gonfle plus fort, plus longtemps) pendant lequel il ferme
 * doucement les yeux. Ses clignements tombent à intervalles irréguliers,
 * dont un double. Le même temps pour les deux (`--t0`) : le soupir et ses
 * yeux fermés restent ensemble.
 */
export const VIVANT_S = 23
/** Ses souffles (s), dans l'ordre ; leur somme fait la boucle */
export const SOUFFLES = [3.6, 4.1, 3.4, 5.2, 3.3, 3.4] as const
/** Le souffle qui est un soupir */
const SOUPIR = 3
/** Quand il cligne (début, en s) ; le soupir garde ses yeux fermés à part */
export const CLIGNEMENTS = [0.9, 5.6, 7.3, 7.65, 16.1, 21.4] as const
/** Un clignement (s) : la paupière tombe vite, remonte un peu moins vite */
const CLIGNE_S = 0.24

function vivant(): string {
  // au dixième de pour cent (23 ms) : assez fin, et les instants d'un même état partagent leur règle (le SVG reste léger)
  const pc = (t: number) => `${+((t / VIVANT_S) * 100).toFixed(1)}%`
  // son buste : il inspire (40 % du souffle) en s'élevant d'un pixel, expire en revenant ; le soupir, plus fort et plus long
  const repos: string[] = []
  const inspire: string[] = []
  let t = 0
  let soupir = ''
  SOUFFLES.forEach((d, i) => {
    repos.push(pc(t))
    if (i === SOUPIR) soupir = pc(t + d * 0.55)
    else inspire.push(pc(t + d * 0.4))
    t += d
  })
  // ses yeux : ouverts, sauf le temps d'un clignement, et du soupir (il les ferme doucement en gonflant, les rouvre après)
  const debutSoupir = SOUFFLES.slice(0, SOUPIR).reduce((a, b) => a + b, 0)
  const fermes: [number, number, number][] = [...CLIGNEMENTS.map(c => [c, c + 0.08, c + CLIGNE_S] as [number, number, number]), [debutSoupir + 1.2, debutSoupir + 1.6, debutSoupir + 3]]
  const ouverts = fermes.flatMap(([a, , c]) => [pc(a), pc(c)])
  const clos = fermes.flatMap(([, b, c]) => [pc(b), pc(c - 0.1)])
  return (
    `.souffle{transform-box:fill-box;transform-origin:50% 100%;animation:souffle ${VIVANT_S}s ease-in-out infinite;animation-delay:var(--t0,0s)}` +
    `@keyframes souffle{${repos.join(',')},100%{transform:none}${inspire.join(',')}{transform:scale(1.015,1.06)}${soupir}{transform:scale(1.03,1.12)}}` +
    `.cligne{transform-box:fill-box;transform-origin:center;animation:cligne ${VIVANT_S}s infinite;animation-delay:var(--t0,0s)}` +
    `@keyframes cligne{0%,${ouverts.join(',')},100%{transform:none}${clos.join(',')}{transform:scaleY(.2)}}`
  )
}

/**
 * Sa vie au calme, sa sueur qui perle et son étoile qui brille : posées seulement dans les dessins qui s'en servent (les
 * plus lourds n'en portent pas le poids)
 */
const VIVANT = vivant()
const vit = (svg: string) =>
  (/class="(?:souffle|cligne)"/.test(svg) ? VIVANT : '') + (svg.includes('class="goutte') ? CSS_GOUTTE : '') + (svg.includes('class="brille"') ? CSS_BRILLE : '')

const CSS = `
.flotte{animation:flotte 3s ease-in-out infinite}
@keyframes flotte{50%{transform:translateY(-5px)}}
.hop{animation:hop 1.4s ease-in-out infinite}
@keyframes hop{30%{transform:translateY(-6px)}60%{transform:translateY(0)}}
.vite .pA,.vite .pB{animation:pas .4s steps(1) infinite}
.vite .pB{animation-delay:.2s}
@keyframes pas{0%{transform:translateY(0)}50%{transform:translateY(-3px)}}
.lent .pA,.lent .pB{animation:pas .6s steps(1) infinite}
.lent .pB{animation-delay:.3s}
.cahote{animation:cahote .3s steps(1) infinite}
@keyframes cahote{50%{transform:translateY(2px)}}
.balade{animation:balade 8s ease-in-out infinite}
@keyframes balade{0%,100%{transform:translateX(0)}50%{transform:translateX(-14px)}}
.promene{transform-box:fill-box;transform-origin:center;animation:promene 9s linear infinite}
@keyframes promene{0%{transform:translateX(0) scaleX(1)}45%{transform:translateX(-90px) scaleX(1)}50%{transform:translateX(-90px) scaleX(-1)}95%{transform:translateX(0) scaleX(-1)}100%{transform:translateX(0) scaleX(1)}}
.au-sifflet{animation:au-sifflet ${SIFFLET_S}s infinite}
@keyframes au-sifflet{0%,22%,42%,66%,78%,100%{transform:translateY(0);animation-timing-function:ease-out}30%,71%{transform:translateY(-8px);animation-timing-function:ease-in}}
.court{animation:court 2s linear infinite}
@keyframes court{0%{transform:translateX(0)}100%{transform:translateX(240px)}}
.tremble{animation:tremble .15s linear infinite}
@keyframes tremble{0%,100%{transform:translateX(0)}50%{transform:translateX(2px)}}
.vacille{transform-box:fill-box;transform-origin:50% 100%;animation:vacille 1.2s ease-in-out infinite}
@keyframes vacille{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}
.monte{animation:monte 2s ease-out infinite;opacity:0}
@keyframes monte{0%{transform:translateY(6px);opacity:0}30%{opacity:1}100%{transform:translateY(-14px);opacity:0}}
.tombe{animation:tombe 1.2s ease-in infinite}
@keyframes tombe{0%{transform:translateY(0);opacity:1}100%{transform:translateY(14px);opacity:0}}
.confetti{transform-box:fill-box;transform-origin:center;animation:confetti 1.4s linear infinite}
@keyframes confetti{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(80px) rotate(200deg);opacity:0}}
.scintille{animation:scintille .8s steps(2) infinite}
@keyframes scintille{50%{opacity:.2}}
.vole-g,.vole-d{transform-box:fill-box;transform-origin:center;opacity:0}
.vole-g{animation:vole-g 1.5s ease-out infinite}
.vole-d{animation:vole-d 1.5s ease-out infinite}
@keyframes vole-g{0%{opacity:1;transform:translate(0,0) rotate(0)}55%{opacity:0;transform:translate(-20px,-16px) rotate(-200deg)}100%{opacity:0}}
@keyframes vole-d{0%{opacity:1;transform:translate(0,0) rotate(0)}55%{opacity:0;transform:translate(20px,-14px) rotate(200deg)}100%{opacity:0}}
.lance-d,.lance-h{transform-box:fill-box;transform-origin:center;opacity:0}
.lance-d{animation:lance-d 1.6s ease-out infinite}
.lance-h{animation:lance-h 1.6s ease-out infinite}
@keyframes lance-d{0%{opacity:1;transform:translate(0,0) rotate(0)}30%{transform:translate(16px,-24px) rotate(120deg)}60%{opacity:1;transform:translate(30px,-4px) rotate(260deg)}61%,100%{opacity:0}}
@keyframes lance-h{0%{opacity:1;transform:translate(0,0) rotate(0)}30%{transform:translate(-6px,-28px) rotate(-90deg)}60%{opacity:1;transform:translate(-18px,-6px) rotate(-200deg)}61%,100%{opacity:0}}
`

// ----------------------------------------------------------- intégration

/**
 * Cadrage : sa petite scène s'étend vers la gauche de sa place (il s'y
 * balade jusqu'à 100 unités), et on l'affiche à la taille du Clawd natif de
 * l'app (une case ≈ 2,9 px CSS).
 */
const VUE = { x: -70, y: 8, w: 244, h: 88 }
export const TAILLE = { largeur: 116, hauteur: 42 }

/**
 * Sa couleur selon le modèle qui tourne, du plus frais au plus vif : Haiku en
 * vert pistache, Sonnet en abricot pâle, Opus dans le terracotta d'origine,
 * Fable en corail vif. Ni ocre (il se fondrait dans ses cartons kraft), ni
 * rouge franc (celui des alertes).
 */
export const TEINTES = {
  haiku: { O: '#9CB86A', o: '#84A052' },
  sonnet: { O: '#E9A27F', o: '#CF8A68' },
  opus: { O: '#D97758', o: '#BF694F' },
  fable: { O: '#E2604A', o: '#C44D39' },
} as const
export type Teinte = (typeof TEINTES)[keyof typeof TEINTES]

/** La teinte d'un modèle d'après son id (`claude-haiku-5-5`…), s'il est reconnu. */
export function teinteConnue(modele: string | null | undefined): Teinte | undefined {
  const famille = /haiku|sonnet|opus|fable/i.exec(modele ?? '')?.[0]?.toLowerCase() as keyof typeof TEINTES | undefined
  return famille ? TEINTES[famille] : undefined
}

/** La teinte de Clawd : celle de son modèle, celle d'Opus sinon. */
export const teinte = (modele: string | null | undefined): Teinte => teinteConnue(modele) ?? TEINTES.opus

/** Le même dessin, avec Clawd dans une autre teinte (son corps et son ombré). */
const recolore = (svg: string, c: Teinte) => (c === TEINTES.opus ? svg : svg.replaceAll(PAL.O!, c.O).replaceAll(PAL.o!, c.o))

// Contour fin comme sur le sprite d'origine, et ombre au sol, réglés selon le
// thème (prefers-color-scheme) : discrets en sombre, plus marqués en clair
// pour que les accessoires blancs restent lisibles.
const THEME = `
.ombre{fill:#000;fill-opacity:.38}
.contour{flood-color:#2a1810;flood-opacity:.55}
@media (prefers-color-scheme: light){
.ombre{fill-opacity:.13}
.contour{flood-color:#000;flood-opacity:.32}
}
`
const FILTRE =
  `<defs><filter id="contour" x="-10%" y="-10%" width="120%" height="120%">` +
  `<feMorphology in="SourceAlpha" operator="dilate" radius="1" result="epais"/>` +
  `<feFlood class="contour"/><feComposite in2="epais" operator="in"/>` +
  `<feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`

const OMBRE = `<rect class="ombre" x="${X0 + 8}" y="${Y0 + 48}" width="56" height="2"/>`

/** Ombre au sol, sauf pour les scènes de profil qui se déplacent toutes seules. */
const ombre = (s: Scene) =>
  s.choreo || sauts(s) || /balade|promene/.test(s.cls ?? '') || s.images.some(i => i.includes('promene')) ? '' : OMBRE

/** Une scène où il saute : chaque image a son ombre, qui rétrécit quand il est en l'air. */
const sauts = (s: Scene) => s.images.some(i => OMBRE_SAUT.test(i))

/**
 * Le haut de son dessin. `--t0` (posé à 0 ici, voir `avecT0`) décale toutes
 * les animations de sa scène : l'app recrée son image sans prévenir (quand la
 * bande change), et une image neuve repart de son début ; recalée à chaque
 * rendu, elle repart de là où il en est.
 */
const entete = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VUE.x} ${VUE.y} ${VUE.w} ${VUE.h}" shape-rendering="crispEdges" style="--t0:0s">`

/** Le décalage d'une animation de sa scène : `--t0`, plus le sien (s) */
const delai = (d = 0) => (Math.abs(d) < 0.0005 ? 'var(--t0,0s)' : `calc(var(--t0,0s) ${d < 0 ? '-' : '+'} ${Math.abs(d).toFixed(3)}s)`)
/** Le pas du recalage (s) : deux rendus dans le même dixième donnent la même image (l'app n'en relance pas une pour rien) */
const PAS_RECALAGE = 0.1

/**
 * Le même dessin, avancé de `deja` secondes : toutes ses animations (scène,
 * trajet, cartons, le geste de ses minis, numéro) partent de là où il en est,
 * même dans une image que l'app vient de recréer. Au dixième près. Les petites
 * boucles de décor (clignement, confettis, pattes) n'en ont pas besoin.
 */
export function avecT0(svg: string, deja: number): string {
  const d = Math.round(deja / PAS_RECALAGE) * PAS_RECALAGE
  return d > 0 && Number.isFinite(d) ? svg.replace('style="--t0:0s', `style="--t0:-${+d.toFixed(1)}s`) : svg
}

/** Les dessins repris plusieurs fois (<use>) dont ce contenu a besoin (sauf ceux que `deja` définit déjà). */
const reutilises = (contenu: string, deja = '') => {
  const defs: string[] = []
  const repris = (id: string) => !deja.includes(`id="${id}"`) && (contenu.includes(`href="#${id}"`) || defs.some(d => d.includes(`href="#${id}"`)))
  // dans l'ordre : son profil peut lui-même reprendre son chapeau, et ce que sa tenue lui met (sa visière, sa sueur,
  // son insigne), d'après le nom de chaque variante reprise (`idTenue`)
  const avant = { carton: () => CARTON_DEF, 'carton-ouvert': () => CARTON_OUVERT_DEF, profil: profilDef, leve: leveDef, citrouille: () => CITROUILLE_DEF, lunettes: () => LUNETTES_DEF, cernes: () => CERNES_DEF }
  for (const [id, def] of Object.entries(avant)) if (repris(id)) defs.push(def())
  const tenues = new Set([contenu, ...defs].flatMap(t => [...t.matchAll(ID_TENUE)].map(m => m[1]!)))
  for (const id of tenues) if (!deja.includes(`id="${id}"`)) defs.push(tenueDef(id))
  const apres = { visiere: () => VISIERE_DEF, 'visiere-cote': () => VISIERE_COTE_DEF, goutte: () => GOUTTE_DEF, joues: () => JOUES_DEF }
  for (const [id, def] of Object.entries(apres)) if (repris(id)) defs.push(def())
  for (const i of INSIGNES) if (repris(`i${i[0]}`)) defs.push(insigneDef(i))
  return defs.length ? `<defs>${defs.join('')}</defs>` : ''
}

/**
 * Keyframes d'opacité : visible pendant chaque fenêtre [début, fin] (en
 * secondes sur une boucle de T secondes), caché le reste du temps.
 */
function fenetres(ws: [number, number][], T: number): string {
  const pc = (t: number) => `${((t / T) * 100).toFixed(3)}%`
  const fusion: [number, number][] = []
  for (const w of [...ws].sort((a, b) => a[0] - b[0])) {
    const der = fusion[fusion.length - 1]
    if (der && w[0] <= der[1] + 1e-6) der[1] = Math.max(der[1], w[1])
    else fusion.push([w[0], w[1]])
  }
  let kf = fusion[0] && fusion[0][0] > 0 ? '0%{opacity:0}' : ''
  for (const [a, b] of fusion) kf += `${pc(a)}{opacity:1}` + (b < T - 1e-6 ? `${pc(b)}{opacity:0}` : '')
  return kf
}

/** Reprise là où elle en était : toute la boucle avance de `--t0` (voir `avecT0`). */
const REPRISE = `;animation-delay:${delai()}`

/** Le trajet d'une chorégraphie : le groupe `ch-<nom>` glisse d'une place à l'autre. */
function trajet(nom: string, s: Scene): string {
  const T = s.duree
  const pc = (t: number) => `${((t / T) * 100).toFixed(3)}%`
  const cles: string[] = []
  let t = 0
  let x = 0
  for (const sg of s.choreo!) {
    const x0 = sg.de ?? x
    const x1 = sg.a ?? x0
    cles.push(`${pc(t)}{transform:translateX(${x0}px)}`, `${pc(t + sg.duree * 0.999)}{transform:translateX(${x1}px)}`)
    t += sg.duree
    x = x1
  }
  cles.push(`100%{transform:translateX(${s.choreo![0]!.de ?? 0}px)}`)
  return `.ch-${nom}{animation:ch-${nom} ${T}s linear infinite${REPRISE}}@keyframes ch-${nom}{${cles.join('')}}`
}

/**
 * Chorégraphie : un seul cycle de T secondes pour tout. Le groupe qui porte
 * Clawd glisse d'une position à l'autre (trajet), et chaque image distincte
 * n'est visible que pendant ses fenêtres. Tout reste synchronisé, sans script.
 */
function choreographie(nom: string, s: Scene, dessus = ''): { css: string; svg: string; ombre: string } {
  const T = s.duree
  const reprise = REPRISE
  const vues = new Map<string, [number, number][]>()
  let t = 0
  for (const sg of s.choreo!) {
    const n = sg.images.length * (sg.tours ?? 1)
    for (let k = 0; k < n; k++) {
      const img = sg.images[k % sg.images.length]!
      const debut = t + (k * sg.duree) / n
      vues.set(img, [...(vues.get(img) ?? []), [debut, debut + sg.duree / n]])
    }
    t += sg.duree
  }

  let css = trajet(nom, s) + (s.css ?? '')
  let corps = ''
  let k = 0
  // pendant ses sauts, son ombre au sol est celle du saut, plus petite
  const enLAir = [...vues].filter(([img]) => OMBRE_SAUT.test(img)).flatMap(([, ws]) => ws)
  let ombreAuSol = OMBRE
  if (enLAir.length) {
    const auSol: [number, number][] = []
    let fin = 0
    for (const [a, b] of [...enLAir].sort((u, v) => u[0] - v[0])) {
      if (a > fin + 1e-6) auSol.push([fin, a])
      fin = Math.max(fin, b)
    }
    if (fin < T - 1e-6) auSol.push([fin, T])
    css += `.v-${nom}-sol{opacity:0;animation:v-${nom}-sol ${T}s infinite steps(1,end)${reprise}}@keyframes v-${nom}-sol{${fenetres(auSol, T)}}`
    ombreAuSol = `<g class="v-${nom}-sol">${OMBRE}</g>`
  }
  for (const [img, ws] of vues) {
    const id = `v-${nom}-${k++}`
    css += `.${id}{opacity:0;animation:${id} ${T}s infinite steps(1,end)${reprise}}@keyframes ${id}{${fenetres(ws, T)}}`
    corps += `<g class="${id}">${img}</g>`
  }
  let decor = ''
  s.decor?.forEach((d, i) => {
    if (!d.visible) {
      decor += d.svg
      return
    }
    const id = `v-${nom}-decor${i}`
    css += `.${id}{opacity:0;animation:${id} ${T}s infinite steps(1,end)${reprise}}@keyframes ${id}{${fenetres(d.visible.filter(([a, b]) => b > a), T)}}`
    decor += `<g class="${id}">${d.svg}</g>`
  })
  // son ombre suit le même trajet, mais hors du contour (sinon elle s'épaissit et fonce)
  return { css, svg: `${decor}<g class="ch-${nom}">${corps}${dessus}</g>`, ombre: `<g class="ch-${nom}">${ombreAuSol}</g>` }
}

/** Durée naturelle d'une scène au repos : une chorégraphie entière, ou quelques cycles. */
export function dureeScene(anim: ClawdAnim): number {
  // le rapport d'un mini se joue une fois (son mini repart), pas en boucle ; ses jeux de cartons aussi (le carton s'en
  // va), et sa montée de niveau (l'étoile ne tombe qu'une fois)
  if (anim === 'rapport') return RAPPORT_S
  const s = SCENES[anim]()
  if (JEUX_CARTONS.includes(anim) || anim === 'niveau') return s.duree
  if (s.choreo) return s.duree
  const t = Math.min(14, Math.max(8, s.duree * 3))
  // une longue boucle (une petite histoire) que le plafond couperait en plein geste : des tours entiers, au moins un
  return s.duree * 3 > 14 ? Math.max(1, Math.floor(t / s.duree)) * s.duree : t
}

/** Ce que fait le sous-agent d'un mini-Clawd, donc ce que le mini mime. */
export type MiniFait = 'marche' | 'cherche' | 'ecrit' | 'build'

/** Au plus 3 mini-Clawds à côté de lui ; au-delà, un « +N ». */
const MINIS_MAX = 3

/**
 * Un mini-Clawd (à mi-taille) dans sa case, à gauche de Clawd, qui mime ce
 * que fait son sous-agent : il porte un carton, sort la loupe, écrit ou tape
 * au marteau. Il réutilise les images des grandes scènes, réduites de moitié.
 */
function mini(i: number, fait: MiniFait, place = i): { css: string; svg: string } {
  // (ni la sueur ni l'insigne de Clawd sur lui)
  const scene: Pick<Scene, 'images' | 'duree'> = enPetit(() =>
    fait === 'marche'
      ? {
          duree: 0.5,
          images: [
            porteFace({ jambes: 'pasA', yeux: 'heureux' }),
            porteFace({ jambes: 'pasB', dy: -2, yeux: 'haut' }),
          ],
        }
      : SCENES[fait](),
  )
  const id = `fbm-${i}`
  const n = scene.images.length
  const css = `.${id}{opacity:0;animation:${id} ${scene.duree}s infinite steps(1,end)}@keyframes ${id}{0%{opacity:1}${(100 / n).toFixed(3)}%{opacity:0}100%{opacity:0}}`
  // (chaque pose dans sa tranche de son petit cycle, sans `--t0` : une boucle d'une demi-seconde qui repart ne se voit
  // pas, et le sifflet, le plus chargé, tient ainsi sous 40 Ko)
  const images = scene.images
    .map((img, k) => {
      const d = k === 0 ? 0 : -(scene.duree - (k * scene.duree) / n)
      return `<g class="${id}" style="animation-delay:${d.toFixed(3)}s">${img}</g>`
    })
    .join('')
  return { css, svg: petit(images, X0 - 24 - place * 40) }
}

/** Un dessin de Clawd réduit de moitié autour du sol, son axe en `centre` : un mini-Clawd */
const petit = (svg: string, centre = X0 - 24) => `<g transform="translate(${centre - 0.5 * (X0 + 36)} ${0.5 * (Y0 + 48)}) scale(.5)">${svg}</g>`

// Ce que chaque mini rapporte au chef, d'après ce que faisait son sous-agent :
// la loupe de sa recherche, la feuille qu'il a écrite, le marteau du build,
// ou le carton qu'il portait (le même que le sien, à sa taille).
const FEUILLET = ['WWWW..', 'WGGWW.', 'WWWWWW', 'WGGGGW', 'WWWWWW', 'WGGGWW', 'WWWWWW']
// Il passe de patte en patte : son dessin n'est écrit qu'une fois (`defs` du rapport).
const OBJETS: Record<MiniFait, { l: number; h: number; svg: string }> = {
  // le verre bleuté : une loupe grise seule se perdrait sur son corps orange
  cherche: { l: 12, h: 14, svg: art(['.GGG..', 'GBBWG.', 'GBBBG.', 'GBBBG.', '.GGG..', '....N.', '.....N'], 0, 0, 2) },
  ecrit: { l: 12, h: 14, svg: art(FEUILLET, 0, 0, 2) },
  build: { l: 12, h: 15, svg: art(MARTEAU_HAUT, 0, 0, 3) },
  marche: { l: 17, h: 15, svg: '<g transform="scale(.5)"><use href="#carton"/></g>' },
}
/** L'objet, centré en `cx` (par rapport à Clawd), posé sur `bas` */
const objet = (fait: MiniFait, cx: number, bas: number) => {
  const o = OBJETS[fait]
  return `<use href="#objet" x="${X0 + Math.round(cx - o.l / 2)}" y="${Y0 + bas - o.h}"/>`
}

/**
 * Comment un mini-Clawd quitte la scène, son rapport rendu (tirée au sort par
 * register.tsx, jamais la même deux fois d'affilée) : il repart en trottinant
 * (`trotte`), court au bout de la bande et saute dans le vide (`vide`),
 * disparaît dans un petit nuage (`pouf`), décolle vers le ciel (`envol`), ou
 * tourne sur lui-même jusqu'à n'être plus que des étincelles (`tourbillon`).
 */
export const SORTIES = ['trotte', 'vide', 'pouf', 'envol', 'tourbillon'] as const
export type Sortie = (typeof SORTIES)[number]

// Le nuage du pouf, à la place du mini : gros et rond, puis en lambeaux qui se dispersent
const POUF = ['....WWW.....', '..WWWWWWW...', '.WWWwWWWWWW.', 'WWWWWWWwWWWW', 'WWwWWWWWWWWW', '.WWWWWwWWWW.', '..WWWWWWWW..', '...WW..WW...']
const POUF_FIN = ['.WW..........WW.', 'WwWW........WWwW', '.WW....WW....WW.', '......WwWW......', '.......WW.......']
// La traînée de son envol, deux flammèches qui battent sous ses pattes ; la fumée qu'il laisse au sol
const FLAMMES = [
  ['.Y.Y.', 'YRYRY', '.R.R.', '..Y..'],
  ['Y.Y.Y', '.YRY.', 'YR.RY', '..R..'],
]
const FUMEE = ['..ww..w.', '.wwwwwww', 'wwwWwwww', '.wwwwww.']
const FUMEE_FIN = ['.w....w.', 'w..w...w', '.w...ww.']

/** Quand il est au sommet d'un saut de `de` à `a` (`translateY`, en px) qui monte jusqu'à `sommet` : les deux arcs d'une même pesanteur */
const auSommet = (t0: number, t1: number, de: number, sommet: number, a: number) => t0 + (t1 - t0) / (1 + Math.sqrt((a - sommet) / (de - sommet)))

/**
 * Le mouvement d'ensemble du mini pendant sa sortie (sur la durée du rapport :
 * il part à 75 %), écrit seulement dans le dessin qui en a besoin.
 * - trotte : il glisse hors de la scène, vers la gauche ;
 * - pouf : son nuage jaillit, puis ses lambeaux s'écartent (`.rapport-pouf`) ;
 * - vide : deux bonds (`.rapport-vide` les mène vers la droite, d'un pas
 *   régulier, `.rapport-vide-y` les fait monter et retomber) : sur la tête de
 *   Clawd, puis de là, par-dessus le bord droit de la bande, dans le vide ;
 * - envol : il décolle, de plus en plus vite, par le haut ;
 * - tourbillon : il tourne sur lui-même à toute allure (`.rapport-tour`, ses
 *   quatre faces) en rapetissant jusqu'à rien (`.rapport-tourne`).
 * Ce qui bouge à l'intérieur d'une image a son propre recalage (`--t0`).
 */
function cssSortie(sortie: Sortie): string {
  const T = RAPPORT_S
  switch (sortie) {
    case 'trotte':
      return `.rapport-part{animation:rapport-part ${T}s infinite}@keyframes rapport-part{0%,75%{transform:translateX(0);animation-timing-function:ease-in}97%,100%{transform:translateX(-130px)}}`
    case 'vide': {
      // la tête de Clawd est à 48 au-dessus du sol ; le mini y bondit (10 plus haut), y reste le temps d'une image, puis
      // rebondit (14 plus haut : il reste dans le cadre) et retombe 40 sous le sol, déjà passé le bord droit
      const [tete, saut1, saut2, fond] = [-48, -58, -62, 40]
      return (
        `.rapport-vide{animation:rapport-vide ${T}s linear infinite}` +
        `@keyframes rapport-vide{0%,75%{transform:translateX(0)}80%,85%{transform:translateX(60px)}100%{transform:translateX(170px)}}` +
        `.rapport-vide-y{animation:rapport-vide-y ${T}s infinite;animation-delay:var(--t0,0s)}` +
        `@keyframes rapport-vide-y{0%,75%{transform:translateY(0);animation-timing-function:${MONTE}}` +
        `${pourcent(auSommet(75, 80, 0, saut1, tete))}{transform:translateY(${saut1}px);animation-timing-function:${TOMBE}}` +
        `80%,85%{transform:translateY(${tete}px);animation-timing-function:${MONTE}}` +
        `${pourcent(auSommet(85, 100, tete, saut2, fond))}{transform:translateY(${saut2}px);animation-timing-function:${TOMBE}}` +
        `100%{transform:translateY(${fond}px)}}`
      )
    }
    case 'pouf':
      // son nuage jaillit (de la moitié de sa taille à un peu plus), puis ses lambeaux s'écartent
      return (
        `.rapport-pouf{transform-box:fill-box;transform-origin:50% 60%;animation:rapport-pouf ${T}s infinite;animation-delay:var(--t0,0s)}` +
        `@keyframes rapport-pouf{0%,80%{transform:scale(.5);animation-timing-function:ease-out}84.9%{transform:scale(1.1)}85%{transform:scale(1)}90%,100%{transform:scale(1.2)}}`
      )
    case 'envol':
      return `.rapport-envol{animation:rapport-envol ${T}s infinite}@keyframes rapport-envol{0%,80%{transform:translateY(0);animation-timing-function:${TOMBE}}100%{transform:translateY(-130px)}}`
    case 'tourbillon':
      return (
        // ses quatre faces, 0,08 s chacune (comme le petit flipbook des minis au travail)
        `.rapport-tour{opacity:0;animation:rapport-tour .32s steps(1,end) infinite}@keyframes rapport-tour{0%{opacity:1}25%{opacity:0}100%{opacity:0}}` +
        `.rapport-tourne{transform-box:fill-box;transform-origin:50% 50%;animation:rapport-tourne ${T}s infinite;animation-delay:var(--t0,0s)}` +
        `@keyframes rapport-tourne{0%,75%{transform:scale(1);animation-timing-function:${TOMBE}}93%,100%{transform:scale(0)}}`
      )
  }
}
/** La classe qui emmène tout le calque du mini, quand sa sortie le déplace */
const CLASSE_SORTIE: Record<Sortie, string | undefined> = { trotte: 'rapport-part', vide: 'rapport-vide', pouf: undefined, envol: 'rapport-envol', tourbillon: undefined }

/**
 * Un sous-agent a fini : au lieu de disparaître, son mini-Clawd vient rendre
 * son travail au chef. Il se tourne vers Clawd, sautille, lui tend ce qu'il
 * rapporte à bout de bras ; Clawd le prend, l'examine, content, lui tapote la
 * tête (le mini s'écrase un peu sous la patte) ; le mini lui fait signe et
 * s'en va, à sa façon (`sortie`), pendant que Clawd le suit des yeux.
 *
 * Deux calques par image : Clawd, et le mini avec ce qu'il tient, chacun dans
 * sa teinte (celle du modèle de son sous-agent, `sienne`). Le mini sort d'un
 * seul mouvement (`cssSortie`, `CLASSE_SORTIE`), sans à-coups.
 */
function rapport(fait: MiniFait, sienne?: Teinte, chef?: Teinte, sortie: Sortie = 'trotte'): Scene {
  const f = corps
  const o = PAL.O!
  // le mini, à mi-taille, à la place du premier mini au travail (son axe en X0 - 24) ; ni la sueur ni l'insigne du chef
  const m = (p: Pose) => petit(enPetit(() => f(p)))
  // il porte son travail à deux pattes, devant lui, ses pinces de part et d'autre
  const { l } = OBJETS[fait]
  const ilTient = (p: Pose) => {
    const y = Y0 + 37 + (p.dy ?? 0) / 2
    return m({ g: 'devant', d: 'devant', ...p }) + objet(fait, -24, 45 + (p.dy ?? 0) / 2) + R(X0 - 27 - Math.round(l / 2), y, 3, 3, o) + R(X0 - 24 + Math.round(l / 2), y, 3, 3, o)
  }
  // à bout de bras, tendu vers Clawd
  const ilLeve = m({ g: 'devant', d: 'ciel', yeux: 'haut' }) + objet(fait, -9, 19)
  // Clawd le tient d'une patte, contre lui (son bras droit devant)
  const tenu = (p: Pose) => f({ d: 'devant', ...p }) + objet(fait, 52, 29 + (p.dy ?? 0))
  // sa patte gauche tapote la tête du mini : levée, puis posée dessus
  const tapote = (bas: boolean) =>
    f({ g: 'cache', d: 'devant', yeux: 'heureux' }) + objet(fait, 52, 29) + R(X0 - 4, Y0 + 15, 16, 8, o) + R(X0 - 20, Y0 + (bas ? 22 : 18), 18, 6, o)
  // de profil, il trottine sans canne : écrit une fois (`defs`), dans sa teinte
  const part = petit('<use href="#mini-part"/>')
  // Clawd lui fait au revoir, son travail contre lui
  const salut = tenu({ g: 'haut', yeux: 'heureux' })
  // sa sortie : 6 images, de la 15e à la 20e
  const sorties: Record<Sortie, () => [string, string][]> = {
    // il se retourne, et repart en trottinant ; Clawd lui fait au revoir
    trotte: () => [
      [salut, m({ yeux: 'gauche' })],
      [tenu({ g: 'ciel', yeux: 'gauche' }), part],
      [tenu({ g: 'haut', yeux: 'gauche' }), part],
      [tenu({ g: 'ciel', yeux: 'gauche' }), part],
      [salut, part],
      [salut, part],
    ],
    // il s'accroupit, bondit sur la tête du chef (qui ferme les yeux sous ses pattes), s'en sert de tremplin et plonge
    // en criant de joie par-dessus le bord droit de la bande ; Clawd, bouche bée, le regarde partir, puis rit
    vide: () => {
      const enLAir = (p: Pose) => `<g class="rapport-vide-y">${m(p)}</g>`
      const tombe = enLAir({ g: 'haut', d: 'haut', yeux: 'heureux', bouche: 'grand' })
      return [
        [salut, m({ yeux: 'haut', jambes: 'replie', masse: 'ecrase' })],
        [tenu({ yeux: 'haut', bouche: 'o' }), enLAir({ g: 'ciel', d: 'ciel', yeux: 'heureux', masse: 'etire' })],
        [tenu({ yeux: 'ferme', bouche: 'o' }), enLAir({ yeux: 'heureux', jambes: 'replie', masse: 'ecrase' })],
        [tenu({ yeux: 'droite', bouche: 'o' }), enLAir({ g: 'ciel', d: 'ciel', yeux: 'heureux', bouche: 'grand', masse: 'etire' })],
        [tenu({ yeux: 'droite', bouche: 'o' }), tombe],
        [salut, tombe],
      ]
    },
    // un clin d'œil, il se ramasse… et pouf : un nuage à sa place, qui gonfle, part en lambeaux, puis quelques étincelles
    pouf: () => {
      const etonne = tenu({ yeux: 'grand', bouche: 'o' })
      const nuage = (svg: string) => `<g class="rapport-pouf">${svg}</g>`
      return [
        [salut, m({ d: 'ciel', yeux: 'clin' })],
        [tenu({ yeux: 'gauche' }), m({ yeux: 'ferme', masse: 'ecrase' })],
        [etonne, nuage(art(POUF, 12, 70, 3))],
        [etonne, nuage(art(POUF_FIN, 6, 70, 3))],
        [tenu({ yeux: 'gauche' }), art(ETOILE, 14, 72, 2) + art(ETOILE, 38, 66, 2) + art(ETOILE, 28, 84, 2)],
        [tenu({ yeux: 'heureux' }), art(['Y'], 20, 76, 2) + art(['Y'], 40, 80, 2)],
      ]
    },
    // il salue, se ramasse, et décolle comme une fusée, ses flammèches sous les pattes ; sa fumée reste au sol
    envol: () => {
      const fusee = (k: number) => m({ g: 'ciel', d: 'ciel', yeux: 'heureux', masse: 'etire', dy: -12 }) + art(FLAMMES[k]!, 25, 88, 2)
      return [
        [salut, m({ d: 'tete', yeux: 'heureux' })],
        [tenu({ yeux: 'gauche' }), m({ yeux: 'ferme', jambes: 'replie', dy: 6 })],
        [tenu({ yeux: 'haut', bouche: 'o' }) + art(FUMEE, 22, 86, 2), fusee(0)],
        [tenu({ yeux: 'haut', bouche: 'o' }) + art(FUMEE_FIN, 22, 88, 2), fusee(1)],
        [tenu({ g: 'haut', yeux: 'haut' }), fusee(0)],
        [tenu({ g: 'ciel', yeux: 'haut' }), fusee(1)],
      ]
    },
    // bras écartés, il tourne sur lui-même de plus en plus petit, jusqu'à n'être plus que des étincelles ; Clawd en a
    // des étoiles plein les yeux
    tourbillon: () => {
      const faces = (['face', 'coteD', 'dos', 'cote'] as const).map((vue, k) => {
        const d = k === 0 ? 0 : -(0.32 - k * 0.08)
        return `<g class="rapport-tour" style="animation-delay:${d.toFixed(2)}s">${m({ vue, g: 'tendu', d: 'tendu', yeux: 'heureux' })}</g>`
      })
      const tourne = `<g class="rapport-tourne">${faces.join('')}</g>`
      const etincelles = (k: number) => (k ? art(ETOILE, 16, 70, 2) + art(ETOILE, 40, 78, 2) + art(['Y'], 28, 64, 2) : art(ETOILE, 24, 74, 2) + art(['Y'], 14, 82, 2) + art(['Y'], 42, 68, 2))
      return [
        [salut, m({ g: 'tendu', d: 'tendu', yeux: 'heureux' })],
        [tenu({ yeux: 'gauche' }), tourne],
        [tenu({ yeux: 'gauche', bouche: 'o' }), tourne],
        [tenu({ yeux: 'etoile' }), tourne],
        [tenu({ yeux: 'etoile' }) + etincelles(0), tourne],
        [tenu({ yeux: 'heureux' }) + etincelles(1), tourne],
      ]
    },
  }
  const calques: [string, string][] = [
    // il se tourne vers le chef, son travail dans les pattes, et sautille
    [f({ yeux: 'gauche' }), ilTient({ yeux: 'droite' })],
    [f({ yeux: 'gauche' }), ilTient({ yeux: 'heureux', dy: -10 })],
    // il le lui tend à bout de bras ; Clawd s'étonne, puis tend la patte
    [f({ yeux: 'gauche', bouche: 'o' }), ilLeve],
    [f({ g: 'tendu', yeux: 'gauche' }), ilLeve],
    // c'est Clawd qui l'a, au bout de sa patte
    [f({ g: 'tendu', yeux: 'gauche' }) + objet(fait, -6, 15), m({ yeux: 'haut' })],
    // il l'examine contre lui… et il est content
    [f({ g: 'devant', d: 'devant', yeux: 'bas' }) + objet(fait, 36, 30), m({ yeux: 'haut' })],
    [f({ g: 'devant', d: 'devant', yeux: 'bas' }) + objet(fait, 36, 30), m({ yeux: 'haut' })],
    [tenu({ yeux: 'heureux', dy: -2 }), m({ yeux: 'heureux' })],
    // une tape sur la tête : le mini s'écrase un peu sous la patte
    [tapote(false), m({ yeux: 'heureux' })],
    [tapote(true), m({ yeux: 'ferme', masse: 'ecrase' })],
    [tapote(false), m({ yeux: 'heureux' })],
    [tapote(true), m({ yeux: 'ferme', masse: 'ecrase' })],
    // il fait signe au chef…
    [salut, m({ d: 'ciel', yeux: 'heureux' })],
    [salut, m({ d: 'haut', yeux: 'heureux' })],
    // … et s'en va
    ...sorties[sortie](),
  ]
  const grands = calques.map(([grand]) => recolore(grand, chef ?? TEINTES.opus))
  const copains = calques.map(([, copain]) => recolore(copain, sienne ?? chef ?? TEINTES.opus))
  const cls = CLASSE_SORTIE[sortie]
  return {
    duree: RAPPORT_S,
    images: grands.map((g, i) => g + (cls ? `<g class="${cls}">${copains[i]}</g>` : copains[i])),
    calques: [{ images: grands }, { images: copains, cls }],
    // seul le trot reprend son profil
    defs: `<defs><g id="objet">${OBJETS[fait].svg}</g>${sortie === 'trotte' ? `<g id="mini-part">${recolore(enPetit(() => profil('vite', false)), sienne ?? chef ?? TEINTES.opus)}</g>` : ''}</defs>`,
    css: cssSortie(sortie),
  }
}

/**
 * Un mini-Clawd : ce que fait son sous-agent et, si on le connaît, la teinte
 * de son modèle. Sans teinte, il a celle de Clawd (un sous-agent tourne par
 * défaut sur le modèle de la conversation).
 */
export type Mini = MiniFait | { fait: MiniFait; couleur?: Teinte; sortie?: Sortie }

function equipe(copains: readonly Mini[], couleur: Teinte, decale = 0): { css: string; svg: string } {
  const visibles = copains.slice(0, MINIS_MAX - decale).map((c, i) => {
    const { fait, couleur: sienne } = typeof c === 'string' ? { fait: c, couleur: undefined } : c
    const m = mini(i, fait, i + decale)
    return { css: m.css, svg: recolore(m.svg, sienne ?? couleur) }
  })
  const reste = copains.length - visibles.length
  return {
    css: visibles.map(m => m.css).join(''),
    svg: visibles.map(m => m.svg).join('') + (reste > 0 ? recolore(glyphe(`+${reste}`, -122, 6, 10, PAL.O!), couleur) : ''),
  }
}

/**
 * Où il est, et ce qui est posé autour de lui : là où il joue une scène qui
 * interrompt son déménagement (`x`, en unités de la toile ; ses cartons,
 * `decor`, dessinés à leur place), ou là où une scène coupée le laisse. Sans
 * elle, à son coin. `rentre` : la scène commence par son trajet à pied de
 * `x` jusqu'à son départ à elle (`vers`, chez lui par défaut), pendant que ce
 * qu'il laisse s'efface ; `avance` : où en était déjà ce trajet (s) quand la
 * scène a commencé.
 */
export type EnPlace = { x: number; decor: string; rentre?: boolean; vers?: number; avance?: number }

/** La durée de son trajet à pied (s) de `x` à `vers` : à sa vitesse à vide, une demi-seconde au moins (le temps que ce qu'il laisse s'efface) */
export const dureeRetour = (x: number, vers = 0) => +Math.max(0.5, Math.abs(vers - x) / VIDE).toFixed(2)

/** Les derniers dessins faits (sans leur décalage) : un rendu qui ne fait que recaler le temps ne redessine rien */
const dessinsFaits = new Map<string, string>()
/**
 * Le poids d'une scène précédée de son trajet, au plus (octets de SVG). Une
 * scène seule reste sous 40 Ko (sa règle) ; son trajet (lui de profil, ses
 * cartons qui s'effacent) en ajoute jusqu'à 7. Les plus lourdes (la pause, le
 * réveil, la délivrance) le gardent ainsi : l'app redessine sans peine des
 * images bien plus grosses (ses numéros), et un saut se verrait.
 */
const POIDS_MAX = 56 * 1024

/**
 * Le SVG complet d'une scène : images en flipbook + effets continus, et les
 * mini-Clawds des sous-agents en cours à côté de lui. Elle reprend à `deja`
 * secondes : le temps qu'elle a déjà joué (`avecT0`). Pendant un rapport,
 * `rapporteur` est le mini qui revient (ce que faisait son sous-agent, sa
 * teinte) : les autres lui laissent la première place. `enPlace` : elle se
 * joue là où son déménagement l'a interrompu.
 */
export function svgScene(anim: ClawdAnim, copains: readonly Mini[] = [], deja = 0, couleur: Teinte = TEINTES.opus, rapporteur?: Mini, bulle?: Bulle, deguise?: Deguisement | Tenue, enPlace?: EnPlace): string {
  const cle = JSON.stringify([anim, copains, couleur.O, rapporteur ?? null, bulle ?? null, deguise ?? null, enPlace ?? null])
  let svg = dessinsFaits.get(cle)
  if (svg === undefined) {
    // la nuit, c'est son bonnet de nuit qu'il porte : pas de chapeau par-dessus
    svg = deguiseEn(sonDeguisement(anim, deguise), () => {
      if (!enPlace?.rentre) return dessineScene(anim, copains, couleur, rapporteur, bulle, enPlace)
      // son trajet avant la scène (au-delà de POIDS_MAX, ce qui n'arrive pas avec ses scènes actuelles : elle commence
      // alors sans lui)
      const seule = dessineScene(anim, copains, couleur, rapporteur, bulle)
      const avecRetour = rentreChezLui(seule, enPlace, couleur)
      return avecRetour.length < POIDS_MAX ? avecRetour : seule
    })
    dessinsFaits.set(cle, svg)
    if (dessinsFaits.size > 8) dessinsFaits.delete(dessinsFaits.keys().next().value!)
  }
  return avecT0(svg, deja)
}

/** Les scènes où il porte son bonnet de nuit */
const SOUS_LE_BONNET: readonly ClawdAnim[] = ['dodo', 'nuit', 'reveil']
/** Ce qu'il porte dans cette scène : sous son bonnet de nuit, ni chapeau, ni visière, ni sueur (il garde son insigne) */
const sonDeguisement = (anim: ClawdAnim, d?: Deguisement | Tenue): Deguisement | Tenue | undefined =>
  !SOUS_LE_BONNET.includes(anim) ? d : typeof d === 'object' && d.insigne ? { insigne: d.insigne } : {}

/**
 * Dessine avec cette tenue (le temps de ce dessin seulement). Une tenue
 * entière (celle que register.tsx décide) remplace tout ; un déguisement seul
 * (une scène qui lui met ses lunettes, ou les lui ôte) ne touche qu'à son
 * visage : il garde sa sueur et son insigne.
 */
function deguiseEn<T>(d: Deguisement | Tenue | undefined, dessine: () => T): T {
  const avant = { deguisement, visiere, sueur, insigne }
  if (typeof d === 'object') {
    deguisement = d.deguise ?? null
    visiere = d.visiere === true
    sueur = d.sueur ?? 0
    insigne = d.insigne ?? null
  } else {
    deguisement = d ?? null
    visiere = false
  }
  try {
    return dessine()
  } finally {
    ;({ deguisement, visiere, sueur, insigne } = avant)
  }
}

function dessineScene(anim: ClawdAnim, copains: readonly Mini[], couleur: Teinte, rapporteur?: Mini, bulle?: Bulle, enPlace?: EnPlace): string {
  const lui = anim === 'rapport' && rapporteur ? (typeof rapporteur === 'string' ? { fait: rapporteur } : rapporteur) : null
  // le rapport se peint lui-même, calque par calque : rien à recolorer ensuite
  const s = lui ? rapport(lui.fait, lui.couleur ?? couleur, couleur, lui.sortie) : SCENES[anim]()
  const peinture = lui ? TEINTES.opus : couleur
  if (s.choreo) {
    // une chorégraphie n'a pas de mini : tout le dessin prend sa teinte
    // sa bulle sur son trajet, dans le même dessin : elle le suit toujours, quoi qu'il arrive à l'image
    const c = choreographie(anim, s, bulle ? dessinBulle(bulle) : '')
    return recolore(
      entete() +
        `<style>${CSS}${vit(reutilises(c.svg) + c.svg)}${THEME}${bulle ? CSS_BULLE : ''}${c.css}</style>${FILTRE}${reutilises(c.svg)}${c.ombre}` +
        `<g filter="url(#contour)">${c.svg}${s.fx ?? ''}</g></svg>`,
      couleur,
    )
  }
  const n = s.images.length
  let images: string
  // (le style propre à la scène : la sortie d'un mini)
  let css = CSS + THEME + (s.css ?? '')
  // quand il saute, l'ombre de chaque image défile avec elle, hors du contour
  let ombres = ombre(s)
  const dessins = sauts(s) ? s.images.map(separeOmbre) : s.images.map(img => ['', img] as const)
  if (s.calques) {
    // chaque pose distincte une seule fois, visible dans chacune de ses tranches
    let k = 0
    images = s.calques
      .map(c => {
        const vues = new Map<string, [number, number][]>()
        c.images.forEach((img, i) => vues.set(img, [...(vues.get(img) ?? []), [(i * s.duree) / n, ((i + 1) * s.duree) / n]]))
        const poses = [...vues].map(([img, ws]) => {
          const id = `cq-${anim}-${k++}`
          css += `.${id}{opacity:0;animation:${id} ${s.duree}s infinite steps(1,end)${REPRISE}}@keyframes ${id}{${fenetres(ws, s.duree)}}`
          return `<g class="${id}">${img}</g>`
        })
        return c.cls ? `<g class="${c.cls}" style="animation-delay:${delai()}">${poses.join('')}</g>` : poses.join('')
      })
      .join('')
  } else if (n === 1) {
    images = dessins[0]![1]
    ombres ||= dessins[0]![0]
  } else {
    // noms propres à la scène : plusieurs SVG dans une même page ne se marchent pas dessus
    css += `.fb-${anim}{opacity:0;animation:fb-${anim} ${s.duree}s infinite steps(1,end)}@keyframes fb-${anim}{0%{opacity:1}${(100 / n).toFixed(3)}%{opacity:0}100%{opacity:0}}`
    // délai négatif : l'image i est visible pendant la tranche [i/n, (i+1)/n) du cycle
    const tranche = (i: number, dessin: string) => `<g class="fb-${anim}" style="animation-delay:${delai(i === 0 ? 0 : -(s.duree - (i * s.duree) / n))}">${dessin}</g>`
    images = dessins.map(([, img], i) => tranche(i, img)).join('')
    if (sauts(s)) ombres = dessins.map(([o], i) => tranche(i, o)).join('')
  }
  // les mini-Clawds bossent à sa gauche (lui reste à sa place, au bord droit),
  // chacun dans la teinte de son modèle (hors rapport, ils ont leur propre dessin : `svgMinis`)
  const minis = equipe(copains, couleur, anim === 'rapport' ? 1 : 0)
  // un rapport sans rapporteur connu (une démo) : le mini qui repart prend la teinte du moment, pas l'orange d'Opus
  const defs = anim === 'rapport' && !lui ? recolore(s.defs ?? '', couleur) : (s.defs ?? '')
  // interrompu en plein déménagement : ses cartons restent où ils sont, et lui joue sa scène là où il en était
  const decor = enPlace?.decor ?? ''
  const ici = (svg: string) => (enPlace && enPlace.x !== 0 ? `<g transform="translate(${+enPlace.x.toFixed(1)} 0)">${svg}</g>` : svg)
  return (
    entete() +
    `<style>${css}${minis.css}${vit(reutilises(minis.svg + images + defs + decor) + minis.svg + images + defs + decor + (s.fx ?? ''))}</style>${FILTRE}${defs}${reutilises(minis.svg + images + defs + decor)}${ici(ombres)}` +
    `<g filter="url(#contour)">${decor}${ici(`${s.minis ? `<g class="${s.minis}">${minis.svg}</g>` : minis.svg}<g class="${s.cls ?? ''}" style="animation-delay:${delai()}">${recolore(images, peinture)}</g>${recolore(s.fx ?? '', peinture)}`)}</g></svg>`
  )
}

/** Ses mini-Clawds ont-ils leur propre dessin dans cette scène ? (pas dans une chorégraphie, ni dans un rapport) */
export const minisAPart = (anim: ClawdAnim) => anim !== 'rapport' && !SCENES[anim]().choreo

/** Une scène chorégraphiée (il s'y déplace : sa balade, son déménagement…) ? Elle se joue toujours depuis son coin */
export const estChoregraphie = (anim: ClawdAnim) => Boolean(SCENES[anim]().choreo)

/** Les classes de scène qui le déplacent tout entier, qu'`etatScene` sait suivre */
export const CLASSES_QUI_DEPLACENT = ['promene', 'balade']
/** La classe d'une scène (son mouvement d'ensemble), s'il en a une : pour vérifier qu'aucune ne le déplace en douce */
export const classeDe = (anim: ClawdAnim) => SCENES[anim]().cls

/**
 * Où il se tient dans une scène après `deja` secondes (unités de la toile, 0 :
 * chez lui), et ce qui est alors posé autour de lui : là où une scène coupée
 * le laisse. Toutes commencent et finissent chez lui ; en route, il est
 * ailleurs dans celles où il se déplace : une chorégraphie (son trajet, son
 * décor), sa promenade et sa marche (leur classe).
 */
export function etatScene(anim: ClawdAnim, deja: number): EnPlace {
  if (anim === 'boulot') return etatBoulot(deja)
  const s = SCENES[anim]()
  const boucle = (T: number) => ((deja % T) + T) % T
  if (s.choreo) {
    const t = boucle(s.duree)
    let x = 0
    let acc = 0
    for (const sg of s.choreo) {
      const x0 = sg.de ?? x
      const x1 = sg.a ?? x0
      // (comme son trajet : il arrive juste avant la fin du segment)
      if (t < acc + sg.duree) {
        x = x0 + (x1 - x0) * Math.min(1, (t - acc) / (sg.duree * 0.999))
        break
      }
      x = x1
      acc += sg.duree
    }
    const decor = (s.decor ?? []).filter(d => !d.visible || d.visible.some(([a, b]) => t >= a && t < b)).map(d => d.svg).join('')
    return { x: +x.toFixed(1), decor }
  }
  // sa promenade : jusqu'à 90 unités à gauche (45 % de 9 s), demi-tour, et retour (à 95 %), en ligne droite
  // (une autre classe qui le déplacerait doit être apprise ici : `CLASSES_QUI_DEPLACENT`, un test y veille)
  if (s.cls === 'promene') {
    const u = boucle(9) / 9
    const x = u < 0.45 ? (-90 * u) / 0.45 : u < 0.5 ? -90 : u < 0.95 ? -90 + (90 * (u - 0.5)) / 0.45 : 0
    return { x: +x.toFixed(1), decor: '' }
  }
  // sa marche : un petit va-et-vient de 14 unités (8 s, en douceur)
  if (s.cls === 'balade') return { x: +((-14 * (1 - Math.cos((2 * Math.PI * boucle(8)) / 8))) / 2).toFixed(1), decor: '' }
  return { x: 0, decor: '' }
}

/**
 * Il va à pied jusqu'au départ de sa scène avant de la jouer : de là où la
 * scène d'avant l'a laissé (`x`) jusqu'à `vers` (chez lui, d'ordinaire), à sa
 * vitesse à vide, pendant que ce qu'il laisse (ses cartons) s'efface. Sa scène
 * attend son arrivée, cachée, son horloge (`--tm`) décalée d'autant : jamais
 * il ne saute d'un bout à l'autre en changeant de scène. Une scène qui
 * commence en plein trajet (`avance` s déjà faites) le reprend là où il en est.
 */
function rentreChezLui(svg: string, { x, decor, vers = 0, avance = 0 }: EnPlace, couleur: Teinte): string {
  const i = svg.indexOf('</style>')
  const fin = svg.lastIndexOf('</svg>')
  if (i < 0 || fin < i) return svg
  const W = dureeRetour(x, vers)
  // ce qu'il lui reste à marcher : sa scène suit son horloge à elle, d'autant plus tard ; le retour suit celle de l'image
  const reste = +Math.max(0.05, W - avance).toFixed(2)
  const enRoute = delai(-avance)
  const scene = svg.slice(0, fin).replaceAll('var(--t0,0s)', 'var(--tm,0s)')
  const css =
    `.rentre-scene{opacity:0;animation:rentre-scene ${reste}s steps(1,end) both;animation-delay:var(--t0,0s)}@keyframes rentre-scene{100%{opacity:1}}` +
    `.rentre-pas{animation:rentre-pas ${W}s linear both;animation-delay:${enRoute}}` +
    `@keyframes rentre-pas{0%{transform:translateX(${x}px)}99.9%{transform:translateX(${vers}px);opacity:1}100%{transform:translateX(${vers}px);opacity:0}}` +
    `.rentre-range{animation:rentre-range ${W}s linear both;animation-delay:${enRoute}}@keyframes rentre-range{to{opacity:0}}`
  const pas = recolore(deProfil(vers > x ? 'd' : 'g', 'vite'), couleur)
  // (ses cartons, et ce que sa tenue lui met de profil, s'ils ne sont pas déjà dans sa scène ; sa sueur qui perle)
  const defs = reutilises(decor + pas, scene)
  const tenueCss = (defs.includes('class="goutte') && !scene.includes('@keyframes goutte') ? CSS_GOUTTE : '') + (defs.includes('class="brille"') && !scene.includes('@keyframes brille') ? CSS_BRILLE : '')
  const retour = `${defs}<g class="rentre-pas">${OMBRE}</g><g filter="url(#contour)"><g class="rentre-range">${decor}</g><g class="rentre-pas">${pas}</g></g>`
  const tete = scene.slice(0, i).replace('style="--t0:0s"', `style="--t0:0s;--tm:calc(var(--t0,0s) + ${reste}s)"`)
  return `${tete}${css}${tenueCss}</style>${retour}<g class="rentre-scene">${scene.slice(i + '</style>'.length)}</g></svg>`
}

/** Ses cartons seuls dans son coin (lui joue un numéro sur la bande) : tels qu'il les a laissés */
export function svgDecor(decor: string): string {
  return entete() + `<style>${THEME}</style>${FILTRE}${reutilises(decor)}<g filter="url(#contour)">${decor}</g></svg>`
}

/**
 * Les mini-Clawds seuls, posés par-dessus sa scène : quand un sous-agent
 * change d'outil, seul ce dessin-ci est recréé, et lui ne reprend pas son
 * geste au début. `phase` : où en est sa scène (s), pour qu'ils sursautent
 * toujours avec son sifflet. Null sans équipe.
 */
export function svgMinis(anim: ClawdAnim, copains: readonly Mini[], couleur: Teinte = TEINTES.opus, phase = 0, deguise?: Deguisement | Tenue): string | null {
  if (!copains.length) return null
  // ses minis portent le même déguisement que lui, et la même visière (ni sa sueur ni son insigne : voir `mini`)
  return deguiseEn(deguise, () => dessineMinis(anim, copains, couleur, phase))
}

function dessineMinis(anim: ClawdAnim, copains: readonly Mini[], couleur: Teinte, phase: number): string {
  const s = SCENES[anim]()
  const m = equipe(copains, couleur)
  const groupe = s.minis ? `<g class="${s.minis}" style="animation-delay:${delai()}">${m.svg}</g>` : m.svg
  return avecT0(entete() + `<style>${CSS}${vit(reutilises(m.svg) + m.svg)}${THEME}${m.css}</style>${FILTRE}${reutilises(m.svg)}<g filter="url(#contour)">${groupe}</g></svg>`, phase)
}

// ----------------------------------------------------------------- bulles

// Au travail, les petites réactions s'affichent dans une bulle de pensée
// au-dessus de sa tête : il continue sa scène au lieu de s'arrêter.
// En pixels de 3, elle prend toute la hauteur libre au-dessus de sa tête
// (45×36), avec un liseré gris pour se détacher aussi sur un thème clair.
const PENSEE = [
  '..GGGGGGGGGGG..',
  '.GWWWWWWWWWWWG.',
  'GWWWWWWWWWWWWWG',
  'GWWWWWWWWWWWWWG',
  'GWWWWWWWWWWWWWG',
  'GWWWWWWWWWWWWWG',
  'GWWWWWWWWWWWWWG',
  'GWWWWWWWWWWWWWG',
  '.GWWWWWWWWWWWG.',
  '..GGGGGGGGGGG..',
  '...GWG.........',
  '....G..........',
]
const ICONES = {
  // loupe (Claude cherche), crayon (il écrit), ?! (une commande a échoué),
  // note (un commit, un message), cœur (une caresse)
  cherche: ['.GGG..', 'GBBWG.', 'GBBBG.', 'GBBBG.', '.GGG..', '....N.', '.....N'],
  ecrit: ['.....PP', '....yyP', '...yyy.', '..yyy..', '.yyy...', 'nKy....', 'K......'],
  surpris: ['.bbb..R', 'b...b.R', '....b.R', '...b..R', '..b...R', '.......', '..b...R'],
  ecoute: ['..bbbbb', '..b...b', '..b...b', '..b...b', 'bbb.bbb', 'bbb.bbb'],
  coeur: COEUR,
}

/** Les petites réactions qui, au travail, s'affichent en bulle. */
export type Bulle = keyof typeof ICONES
export const EN_BULLE = Object.keys(ICONES) as Bulle[]

const CSS_BULLE =
  `.pop{transform-box:fill-box;transform-origin:20% 100%;animation:pop .25s ease-out}` +
  `@keyframes pop{0%{transform:scale(.3);opacity:0}100%{transform:scale(1);opacity:1}}` +
  `.plane{animation:plane 2.4s ease-in-out infinite}@keyframes plane{50%{transform:translateY(-1.5px)}}`

/** Sa bulle de pensée et son icône : centrée sur sa tête, la pointe juste au-dessus ; l'icône au milieu du blanc */
function dessinBulle(bulle: Bulle): string {
  const icone = ICONES[bulle]
  const w = icone[0]!.length * 3
  const h = icone.length * 3
  return `<g class="pop"><g class="plane">${A(PENSEE, 14, -36, 3)}${A(icone, 14 + Math.round((45 - w) / 2), -33 + Math.round((24 - h) / 2), 3)}</g></g>`
}

/**
 * Sa bulle va-t-elle dans le dessin de sa scène ? Oui quand il se déplace (une
 * chorégraphie, son déménagement) : deux images n'ont pas la même horloge
 * (l'app peut recréer la sienne sans prévenir), une seule la suit à coup sûr.
 */
export const bulleDedans = (anim: ClawdAnim) => Boolean(SCENES[anim]().choreo)

/**
 * La bulle, dans un SVG à part posé sur sa scène (même cadrage) : elle suit
 * Clawd sur son trajet, repris à `deja` secondes comme sa scène, sans que
 * celle-ci ne redémarre.
 */
export function svgBulle(anim: ClawdAnim, bulle: Bulle, deja = 0): string {
  const s = SCENES[anim]()
  const dessin = dessinBulle(bulle)
  const nom = `${anim}-bulle`
  return avecT0(
    entete() +
      `<style>${THEME}${CSS_BULLE}${s.choreo ? trajet(nom, s) : ''}</style>${FILTRE}` +
      `<g filter="url(#contour)">${s.choreo ? `<g class="ch-${nom}">${dessin}</g>` : dessin}</g></svg>`,
    deja,
  )
}

/** Chaque image d'une scène en SVG figé (planche-contact pour vérifier le dessin). */
export function imagesScene(anim: ClawdAnim, deguise?: Deguisement | Tenue): string[] {
  return deguiseEn(sonDeguisement(anim, deguise), () => imagesFixes(anim))
}

function imagesFixes(anim: ClawdAnim): string[] {
  const s = SCENES[anim]()
  return s.images.map(i => {
    const [sienne, img] = sauts(s) ? separeOmbre(i) : ['', i]
    return entete() + `<style>${THEME}</style>${FILTRE}${s.defs ?? ''}${reutilises(img + (s.defs ?? ''))}${ombre(s) || sienne}<g filter="url(#contour)">${img}${s.fx ?? ''}</g></svg>`
  })
}

/** Version terminal : le logo en blocs (le terminal n'a pas de SVG). */
export const CLAWD_TEXTE = [' ▐▛███▜▌', '▝▜█████▛▘', '  ▘▘ ▝▝']

export const EMOJI: Record<ClawdAnim, string> = {
  repos: '', coucou: '👋', danse: '💃', jongle: '🤹', cafe: '☕', lecture: '📖', etirement: '🙆',
  corde: '🪢', bulles: '🫧', peche: '🎣', yoyo: '🪀', guitare: '🎸', arrosage: '🌱', ballon: '🏀',
  papillon: '🦋', promenade: '🚶', pirouette: '🌀', gratte: '🤔', meditation: '🧘', cookie: '🍪', glace: '🍦',
  balade: '', boulot: '📦', ecoute: '^^', marche: '…', ecrit: '✎', cherche: '🔍', build: '🔨', tests: '📋', push: '🚀',
  tel: '📱', copain: '👾', chef: '📋', sifflet: '📣', fete: '🎉', triste: '🌧', alerte: '❗', surpris: '❓', dodo: '💤',
  fatigue: '😓', vertige: '😵', coeur: '♥', nuit: '🌙', reveil: '🥱', tasse: '🗜', paquet: '✨', attend: '✋',
  question: '❔', deballe: '📥', decourage: '😞', delivrance: '🎆', colis: '🎁', gigogne: '🪆', tambour: '🥁', podium: '🏆',
  pause: '🥛', rapport: '🤝', bonbon: '🍬', detente: '😎', baille: '😪', cache: '🫣', soulage: '😮‍💨', attendu: '🤗', retrouvailles: '🥰', chat: '🐈', filante: '🌠',
  floss: '🕺', orange: '🍊', defaut: '🎶', griddy: '🔥', takel: '🫵', sixseven: '6️⃣7️⃣', niveau: '⭐',
}

/** Ses danses, pour le bouton 🕺 et ses envies (la danse d'origine, puis les clins d'œil) */
export const DANSES: readonly ClawdAnim[] = ['danse', 'floss', 'orange', 'defaut', 'griddy', 'takel', 'sixseven']

/** Les activités tirées au sort quand rien ne se passe. */
export const ACTIVITES: readonly ClawdAnim[] = [
  'coucou', 'danse', 'jongle', 'cafe', 'lecture', 'etirement', 'corde', 'bulles', 'peche', 'yoyo',
  'guitare', 'arrosage', 'ballon', 'papillon', 'pirouette', 'gratte', 'meditation', 'cookie', 'glace',
  'floss', 'orange', 'defaut', 'griddy', 'takel', 'sixseven',
]

// ------------------------------------------------------------- grande scène

/**
 * Ses pinceaux, pour la grande scène (bande.ts) : son corps, son profil, ses
 * accessoires et ses effets, et de quoi les animer image par image.
 */
export const PINCEAUX = { PAL, X0, Y0, VUE, CSS, vit, THEME, FILTRE, OMBRE, corps, profil, miroir, A, art, effets, fenetres, reutilises, recolore, deguiseEn }
