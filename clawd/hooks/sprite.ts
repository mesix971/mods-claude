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

type Yeux =
  | 'normal' | 'ferme' | 'heureux' | 'mi' | 'grand' | 'croix' | 'coeur'
  | 'etoile' | 'gauche' | 'droite' | 'haut' | 'bas' | 'clin'
type Bras = 'bas' | 'haut' | 'ciel' | 'tendu' | 'devant' | 'pend' | 'tete' | 'cache'
type Jambes = 'normal' | 'pasA' | 'pasB' | 'replie' | 'assis' | 'assis2' | 'ecarte'
type Pose = {
  yeux?: Yeux
  g?: Bras
  d?: Bras
  jambes?: Jambes
  dx?: number
  dy?: number
  vue?: 'face' | 'dos' | 'cote' | 'coteD'
  bouche?: 'o' | 'grand'
}

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
    s += R(x0 + lx, y0 + 36, 6, h, O)
  })

  if (vue === 'cote' || vue === 'coteD') {
    // de profil, en plein demi-tour : corps étroit, un œil, un bras
    s += R(x0 + 24, y0, 24, 36, O)
    s += R(x0 + (vue === 'cote' ? 28 : 38), y0 + 6, 6, 6, PAL.K!)
    s += R(x0 + (vue === 'cote' ? 30 : 30), y0 + 16, 12, 10, PAL.o!)
    return s
  }

  s += R(x0 + 12, y0, 48, 36, vue === 'dos' ? PAL.o! : O)

  const bras = (b: Bras, droite: boolean) => {
    if (b === 'cache' || b === 'devant') return ''
    return BRAS[b].map(([x, y, w, h]) => R(x0 + (droite ? 72 - x - w : x), y0 + y, w, h, O)).join('')
  }
  s += bras(p.g ?? 'bas', false) + bras(p.d ?? 'bas', true)

  if (vue === 'face') {
    const t = p.yeux ?? 'normal'
    s += oeil(x0 + 18, y0 + 6, t === 'clin' ? 'normal' : t)
    s += oeil(x0 + 48, y0 + 6, t === 'clin' ? 'ferme' : t)
    if (p.bouche === 'o') s += R(x0 + 33, y0 + 20, 6, 4, PAL.K!)
    if (p.bouche === 'grand') s += R(x0 + 31, y0 + 17, 10, 9, PAL.K!) + R(x0 + 33, y0 + 22, 6, 3, PAL.R!)
  }

  // bras devant le ventre, en ombré (par-dessus le corps)
  if (p.g === 'devant') s += R(x0 + 12, y0 + 22, 16, 8, PAL.o!)
  if (p.d === 'devant') s += R(x0 + 44, y0 + 22, 16, 8, PAL.o!)
  return s
}

// Profil avec la canne (première capture), mis à l'échelle de la vue de face
// et centré sur le même axe (x = 90) pour passer de face à profil sans saut
function profil(pas: '' | 'vite' | 'lent' = 'vite'): string {
  const r = (x: number, y: number, w: number, h: number) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`
  const patte = (x: number) => r(x, 91, 7, 4) + r(x + 4, 95, 7, 7) + r(x, 95, 4, 3)
  return (
    `<g transform="translate(${X0 - 25.7} 7.5) scale(.857)"><g class="${pas}">` +
    `<g fill="${PAL.G}">${r(10, 80, 3, 8)}${r(13, 84, 4, 7)}${r(16, 88, 4, 3)}${r(17, 91, 7, 4)}${r(21, 95, 7, 3)}${r(24, 98, 22, 4)}</g>` +
    `<g class="corps"><g fill="${PAL.O}">${r(49, 53, 43, 38)}${r(38, 70, 11, 14)}</g>` +
    `<g fill="${PAL.o}">${r(92, 53, 14, 38)}${r(35, 88, 14, 10)}</g>` +
    `<g fill="${PAL.K}" class="cligne">${r(49, 62, 7, 7)}${r(76, 62, 7, 7)}</g></g>` +
    `<g class="pA"><g fill="${PAL.O}">${patte(49)}${patte(85)}</g></g>` +
    `<g class="pB"><g fill="${PAL.O}">${patte(63)}</g><g fill="${PAL.o}">${patte(98)}</g></g>` +
    `</g></g>`
  )
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
const COOKIE_CROQUE = ['.NN..', 'NnN..', 'NNNN.', 'NNnNN', '.NNN.']
const CRAYON = ['....P', '...Y.', '..Y..', '.Y...', 'K....']
const LOUPE = ['.GGG.', 'G...G', 'G...G', 'G...G', '.GGG.', '....N', '.....N']
const MARTEAU_HAUT = ['GGGG', 'GGGG', '.N..', '.N..', '.N..']
const MARTEAU_BAS = ['..GG', 'NNGG', '..GG']
const BRIQUE = ['RRRRRR', 'RRwRRR', 'RRRRRR']
const PLANCHETTE = ['..gg..', 'NNNNNN', 'NWWWWN', 'NWWWWN', 'NWWWWN', 'NWWWWN', 'NNNNNN']
const AVION = ['W.....', 'WWW...', 'WWWWWW', 'wWW...', 'w.....']
const TEL = ['gggg', 'gBBg', 'gBBg', 'gBBg', 'gBBg', 'gggg']
const COPAIN = ['.OOOO.', 'OKOOKO', 'OOOOOO', '.O..O.']
const COEUR = ['.PP.PP.', 'PPPPPPP', 'PPPPPPP', '.PPPPP.', '..PPP..', '...P...']
const NUAGE = ['..GGG...', '.GGGGGG.', 'GGGGGGGG', '.GGGGGG.']
const BONNET = ['.......W', '.....bb.', '...bbbb.', '.bbbbbb.', 'bbbbbbbb']
const ETOILE = ['.Y.', 'YYY', '.Y.']
const NOTE = ['..YY', '..Y.', '..Y.', 'YYY.', 'YYY.']
const CARTON = ['nNNNNNNNNn', 'NNNNyyNNNN', 'NnNNNNNNnN', 'nNNNNNNNNn']

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

type Scene = {
  images: string[]
  duree: number
  cls?: string
  fx?: string
  /** scène chorégraphiée : il se déplace sur sa petite scène */
  choreo?: Segment[]
  /** dessin fixe du décor, visible tout le temps sauf pendant [debut, fin] (s) */
  decor?: { svg: string; cache: [number, number] }
}

const rep = (n: number, f: (i: number) => string) => Array.from({ length: n }, (_, i) => f(i))

/** Une scène chorégraphiée à partir de ses segments. */
const choreo = (segments: Segment[], extra: Partial<Scene> = {}): Scene => ({
  images: [...new Set(segments.flatMap(s => s.images))],
  duree: segments.reduce((t, s) => t + s.duree, 0),
  choreo: segments,
  ...extra,
})

// Carton porté sur la tête (de profil), tenu devant, posé par terre, au-dessus de la tête
const carton = (dx: number, dy: number) => A(CARTON, dx, dy)
const CARTON_TETE = carton(21, -5)
const CARTON_VENTRE = carton(21, 14)
const CARTON_SOL = carton(21, 36)
const CARTON_HAUT = carton(21, -12)

const SCENES: Record<ClawdAnim, () => Scene> = {
  // ------------------------------------------------------------- repos
  repos: () => ({
    duree: 7,
    cls: 'respire',
    images: [
      corps(), corps(), corps(), corps({ yeux: 'ferme' }), corps(), corps(),
      corps({ yeux: 'gauche' }), corps({ yeux: 'gauche' }), corps(), corps({ yeux: 'droite' }),
    ],
  }),
  // La vie de tous les jours : il part se balader sur sa petite scène,
  // regarde autour, se gratte la tête, saute, s'assoit en balançant les
  // pattes, te fait coucou, revient et fait une pirouette.
  balade: () => {
    const f = corps
    const versGauche = profil('vite')
    const versDroite = miroir(profil('vite'))
    const assis = (j: 'assis' | 'assis2', yeux: Yeux = 'droite') => f({ jambes: j, dy: 8, yeux })
    return choreo([
      { duree: 3, images: [f(), f(), f({ yeux: 'ferme' }), f(), f({ yeux: 'gauche' }), f({ yeux: 'gauche' }), f(), f({ yeux: 'droite' })] },
      { duree: 2, images: [versGauche], de: 0, a: -50 },
      {
        duree: 2.4,
        images: [f({ yeux: 'gauche' }), f({ yeux: 'haut' }), f({ d: 'tete', yeux: 'haut' }), f({ d: 'tete', yeux: 'droite' }), f(), f({ yeux: 'heureux' })],
      },
      {
        duree: 1.2,
        images: [
          f({ jambes: 'replie', dy: 3 }),
          f({ dy: -10, jambes: 'replie', g: 'haut', d: 'haut', yeux: 'heureux' }),
          f({ dy: -16, jambes: 'replie', g: 'ciel', d: 'ciel', yeux: 'heureux' }),
          f({ dy: -8, jambes: 'replie', g: 'haut', d: 'haut', yeux: 'heureux' }),
          f({ jambes: 'replie', dy: 3, yeux: 'heureux' }),
          f({ yeux: 'heureux' }),
        ],
      },
      { duree: 3.2, tours: 2, images: [assis('assis'), assis('assis2'), assis('assis'), assis('assis2', 'ferme')] },
      { duree: 0.5, images: [f({ jambes: 'replie', dy: 4 }), f()] },
      { duree: 1.6, images: [versGauche], de: -50, a: -100 },
      { duree: 2, tours: 3, images: [f({ d: 'haut', yeux: 'heureux' }), f({ d: 'ciel', yeux: 'heureux' })] },
      { duree: 4, images: [versDroite], de: -100, a: 0 },
      {
        duree: 1.6,
        images: [f({ vue: 'cote' }), f({ vue: 'dos' }), f({ vue: 'coteD' }), f({ yeux: 'heureux' }), f({ yeux: 'heureux', dy: -8, jambes: 'replie' }), f({ yeux: 'heureux' })],
      },
      { duree: 2.5, images: [f(), f(), f({ yeux: 'ferme' }), f(), f({ yeux: 'droite' }), f()] },
    ])
  },
  // Au travail : il fait des allers-retours en transportant des cartons
  boulot: () => {
    const f = corps
    return choreo(
      [
        { duree: 3, images: [profil('vite') + CARTON_TETE], de: 0, a: -90 },
        {
          duree: 0.9,
          images: [f({ g: 'devant', d: 'devant', yeux: 'bas' }) + CARTON_VENTRE, f({ g: 'pend', d: 'pend', jambes: 'replie', dy: 3, yeux: 'bas' }) + CARTON_SOL],
        },
        { duree: 0.9, images: [f({ d: 'tete', yeux: 'ferme' }), f({ d: 'tete', yeux: 'ferme', dy: 1 }), f({ yeux: 'heureux' })] },
        { duree: 3, images: [miroir(profil('vite'))], de: -90, a: 0 },
        { duree: 1, images: [f({ g: 'pend', d: 'pend', jambes: 'replie', dy: 3, yeux: 'bas' }) + CARTON_SOL, f({ g: 'haut', d: 'haut', yeux: 'heureux' }) + CARTON_HAUT] },
      ],
      // la pile de cartons qu'il a déposée reste là-bas (sauf pendant qu'il en pose un)
      { decor: { svg: `<g transform="translate(-90 0)">${CARTON_SOL}</g>`, cache: [3, 3.9] } },
    )
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
  lecture: () => {
    const base = { jambes: 'assis', dy: 8, g: 'devant', d: 'devant' } as const
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
    const base = corps({ jambes: 'assis', dy: 8, d: 'tendu', yeux: 'droite' })
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
  promenade: () => ({ duree: 1, images: [`<g class="promene">${profil('vite')}</g>`] }),
  pirouette: () => ({
    duree: 1.4,
    cls: 'hop',
    images: [corps(), corps({ vue: 'cote' }), corps({ vue: 'dos' }), corps({ vue: 'coteD' }), corps({ yeux: 'heureux' }), corps({ yeux: 'heureux' })],
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

  // --------------------------------------------------------- réactions
  ecoute: () => ({
    duree: 0.8,
    images: [
      corps({ jambes: 'replie', dy: 3, yeux: 'heureux' }),
      corps({ g: 'haut', d: 'haut', dy: -10, jambes: 'replie', yeux: 'heureux' }),
      corps({ g: 'haut', d: 'haut', dy: -4, jambes: 'replie', yeux: 'heureux' }),
      corps({ yeux: 'heureux' }),
    ],
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
  fete: () => ({
    duree: 0.9,
    fx: effets.confettis() + effets.etincelles(),
    images: [
      corps({ g: 'haut', d: 'haut', jambes: 'replie', dy: 3, yeux: 'heureux' }),
      corps({ g: 'ciel', d: 'ciel', dy: -14, jambes: 'replie', yeux: 'heureux' }),
      corps({ g: 'ciel', d: 'ciel', dy: -8, jambes: 'replie', yeux: 'heureux' }),
      corps({ g: 'haut', d: 'haut', yeux: 'heureux' }),
    ],
  }),
  triste: () => ({
    duree: 1.2,
    images: [0, 1].map(i =>
      corps({ jambes: 'assis', dy: 8, g: 'pend', d: 'pend', yeux: 'mi' }) + A(NUAGE, 24, -18, 3) + A(['B', '.', '.', 'B'], 30 + i * 6, -4 + i * 3, 3) + A(['B'], 48 - i * 4, -2 + i * 5, 3),
    ),
  }),
  alerte: () => ({
    duree: 0.3,
    cls: 'tremble',
    fx: glyphe('!', 30, -16, 22, PAL.R!, 'scintille'),
    images: [corps({ g: 'ciel', d: 'ciel', yeux: 'grand' }), corps({ g: 'haut', d: 'haut', yeux: 'grand' })],
  }),
  surpris: () => ({
    duree: 1,
    fx: glyphe('?!', 26, -14, 16, PAL.Y!, 'scintille'),
    images: [corps({ g: 'haut', d: 'haut', dy: -8, jambes: 'replie', yeux: 'grand' }), corps({ yeux: 'grand' }), corps({ yeux: 'grand' })],
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
  nuit: () => ({
    duree: 2.4,
    images: [
      corps({ yeux: 'mi', bouche: 'grand', g: 'haut' }) + A(BONNET, 10, -4),
      corps({ yeux: 'ferme', g: 'bas' }) + A(BONNET, 10, -4),
    ],
  }),
}

// ------------------------------------------------------------------- CSS

const CSS = `
.respire{animation:respire 2.4s steps(2) infinite}
@keyframes respire{50%{transform:translateY(1px)}}
.flotte{animation:flotte 3s ease-in-out infinite}
@keyframes flotte{50%{transform:translateY(-5px)}}
.hop{animation:hop 1.4s ease-in-out infinite}
@keyframes hop{30%{transform:translateY(-6px)}60%{transform:translateY(0)}}
.cligne{transform-box:fill-box;transform-origin:center;animation:cligne 4s infinite}
@keyframes cligne{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}
.vite .pA,.vite .pB{animation:pas .4s steps(1) infinite}
.vite .pB{animation-delay:.2s}
@keyframes pas{0%{transform:translateY(0)}50%{transform:translateY(-3px)}}
.balade{animation:balade 8s ease-in-out infinite}
@keyframes balade{0%,100%{transform:translateX(0)}50%{transform:translateX(-14px)}}
.promene{transform-box:fill-box;transform-origin:center;animation:promene 9s linear infinite}
@keyframes promene{0%{transform:translateX(0) scaleX(1)}45%{transform:translateX(-90px) scaleX(1)}50%{transform:translateX(-90px) scaleX(-1)}95%{transform:translateX(0) scaleX(-1)}100%{transform:translateX(0) scaleX(1)}}
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
.confetti{animation:confetti 1.4s linear infinite}
@keyframes confetti{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(80px) rotate(200deg);opacity:0}}
.scintille{animation:scintille .8s steps(2) infinite}
@keyframes scintille{50%{opacity:.2}}
`

// ----------------------------------------------------------- intégration

/**
 * Cadrage : sa petite scène s'étend vers la gauche de sa place (il s'y
 * balade jusqu'à 100 unités), et on l'affiche à la taille du Clawd natif de
 * l'app (une case ≈ 2,9 px CSS).
 */
const VUE = { x: -70, y: 8, w: 244, h: 88 }
export const TAILLE = { largeur: 116, hauteur: 42 }

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
  s.choreo || /balade|promene/.test(s.cls ?? '') || s.images.some(i => i.includes('promene')) ? '' : OMBRE

const entete = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VUE.x} ${VUE.y} ${VUE.w} ${VUE.h}" shape-rendering="crispEdges">`

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

/**
 * Chorégraphie : un seul cycle de T secondes pour tout. Le groupe qui porte
 * Clawd glisse d'une position à l'autre (trajet), et chaque image distincte
 * n'est visible que pendant ses fenêtres. Tout reste synchronisé, sans script.
 */
function choreographie(nom: string, s: Scene): { css: string; svg: string } {
  const T = s.duree
  const pc = (t: number) => `${((t / T) * 100).toFixed(3)}%`
  const trajet: string[] = []
  const vues = new Map<string, [number, number][]>()
  let t = 0
  let x = 0
  for (const sg of s.choreo!) {
    const x0 = sg.de ?? x
    const x1 = sg.a ?? x0
    trajet.push(`${pc(t)}{transform:translateX(${x0}px)}`, `${pc(t + sg.duree * 0.999)}{transform:translateX(${x1}px)}`)
    const n = sg.images.length * (sg.tours ?? 1)
    for (let k = 0; k < n; k++) {
      const img = sg.images[k % sg.images.length]!
      const debut = t + (k * sg.duree) / n
      vues.set(img, [...(vues.get(img) ?? []), [debut, debut + sg.duree / n]])
    }
    t += sg.duree
    x = x1
  }
  trajet.push(`100%{transform:translateX(${s.choreo![0]!.de ?? 0}px)}`)

  let css = `.ch-${nom}{animation:ch-${nom} ${T}s linear infinite}@keyframes ch-${nom}{${trajet.join('')}}`
  let corps = ''
  let k = 0
  for (const [img, ws] of vues) {
    const id = `v-${nom}-${k++}`
    css += `.${id}{opacity:0;animation:${id} ${T}s infinite steps(1,end)}@keyframes ${id}{${fenetres(ws, T)}}`
    corps += `<g class="${id}">${img}</g>`
  }
  let decor = ''
  if (s.decor) {
    const id = `v-${nom}-decor`
    const [a, b] = s.decor.cache
    css += `.${id}{opacity:0;animation:${id} ${T}s infinite steps(1,end)}@keyframes ${id}{${fenetres([[0, a], [b, T]], T)}}`
    decor = `<g class="${id}">${s.decor.svg}</g>`
  }
  return { css, svg: `${decor}<g class="ch-${nom}">${OMBRE}${corps}</g>` }
}

/** Durée naturelle d'une scène au repos : une chorégraphie entière, ou quelques cycles. */
export function dureeScene(anim: ClawdAnim): number {
  const s = SCENES[anim]()
  return s.choreo ? s.duree : Math.min(14, Math.max(8, s.duree * 3))
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
function mini(i: number, fait: MiniFait): { css: string; svg: string } {
  const centre = X0 - 24 - i * 40
  // réduit de moitié autour du sol : ses pattes restent par terre
  const tx = centre - 0.5 * (X0 + 36)
  const ty = 0.5 * (Y0 + 48)
  const scene: Pick<Scene, 'images' | 'duree'> =
    fait === 'marche'
      ? {
          duree: 0.5,
          images: [
            corps({ jambes: 'pasA', g: 'haut', d: 'haut', yeux: 'heureux' }) + CARTON_HAUT,
            corps({ jambes: 'pasB', g: 'haut', d: 'haut', dy: -2 }) + carton(21, -14),
          ],
        }
      : SCENES[fait]()
  const id = `fbm-${i}`
  const n = scene.images.length
  const css = `.${id}{opacity:0;animation:${id} ${scene.duree}s infinite steps(1,end)}@keyframes ${id}{0%{opacity:1}${(100 / n).toFixed(3)}%{opacity:0}100%{opacity:0}}`
  const images = scene.images
    .map((img, k) => {
      const delai = k === 0 ? 0 : -(scene.duree - (k * scene.duree) / n)
      return `<g class="${id}" style="animation-delay:${delai.toFixed(3)}s">${img}</g>`
    })
    .join('')
  return { css, svg: `<g transform="translate(${tx} ${ty}) scale(.5)">${images}</g>` }
}

function equipe(copains: readonly MiniFait[]): { css: string; svg: string } {
  const visibles = copains.slice(0, MINIS_MAX).map((fait, i) => mini(i, fait))
  const reste = copains.length - MINIS_MAX
  return {
    css: visibles.map(m => m.css).join(''),
    svg: visibles.map(m => m.svg).join('') + (reste > 0 ? glyphe(`+${reste}`, -122, 6, 10, PAL.O!) : ''),
  }
}

/**
 * Le SVG complet d'une scène : images en flipbook + effets continus, et les
 * mini-Clawds des sous-agents en cours à côté de lui.
 */
export function svgScene(anim: ClawdAnim, copains: readonly MiniFait[] = []): string {
  const s = SCENES[anim]()
  if (s.choreo) {
    const c = choreographie(anim, s)
    return (
      entete() +
      `<style>${CSS}${THEME}${c.css}</style>${FILTRE}` +
      `<g filter="url(#contour)">${c.svg}${s.fx ?? ''}</g></svg>`
    )
  }
  const n = s.images.length
  let images: string
  let css = CSS + THEME
  if (n === 1) {
    images = s.images[0]!
  } else {
    // noms propres à la scène : plusieurs SVG dans une même page ne se marchent pas dessus
    css += `.fb-${anim}{opacity:0;animation:fb-${anim} ${s.duree}s infinite steps(1,end)}@keyframes fb-${anim}{0%{opacity:1}${(100 / n).toFixed(3)}%{opacity:0}100%{opacity:0}}`
    images = s.images
      .map((img, i) => {
        // délai négatif : l'image i est visible pendant la tranche [i/n, (i+1)/n) du cycle
        const delai = i === 0 ? 0 : -(s.duree - (i * s.duree) / n)
        return `<g class="fb-${anim}" style="animation-delay:${delai.toFixed(3)}s">${img}</g>`
      })
      .join('')
  }
  // les mini-Clawds bossent à sa gauche (lui reste à sa place, au bord droit)
  const minis = equipe(copains)
  return (
    entete() +
    `<style>${css}${minis.css}</style>${FILTRE}${ombre(s)}` +
    `<g filter="url(#contour)">${minis.svg}<g class="${s.cls ?? ''}">${images}</g>${s.fx ?? ''}</g></svg>`
  )
}

/** Chaque image d'une scène en SVG figé (planche-contact pour vérifier le dessin). */
export function imagesScene(anim: ClawdAnim): string[] {
  const s = SCENES[anim]()
  return s.images.map(
    img =>
      entete() + `<style>${THEME}</style>${FILTRE}${ombre(s)}<g filter="url(#contour)">${img}${s.fx ?? ''}</g></svg>`,
  )
}

/** Version terminal : le logo en blocs (le terminal n'a pas de SVG). */
export const CLAWD_TEXTE = [' ▐▛███▜▌', '▝▜█████▛▘', '  ▘▘ ▝▝']

export const EMOJI: Record<ClawdAnim, string> = {
  repos: '', coucou: '👋', danse: '💃', jongle: '🤹', cafe: '☕', lecture: '📖', etirement: '🙆',
  corde: '🪢', bulles: '🫧', peche: '🎣', yoyo: '🪀', guitare: '🎸', arrosage: '🌱', ballon: '🏀',
  papillon: '🦋', promenade: '🚶', pirouette: '🌀', gratte: '🤔', meditation: '🧘', cookie: '🍪',
  balade: '', boulot: '📦', ecoute: '^^', marche: '…', ecrit: '✎', cherche: '🔍', build: '🔨', tests: '📋', push: '🚀',
  tel: '📱', copain: '👾', chef: '📋', fete: '🎉', triste: '🌧', alerte: '❗', surpris: '❓', dodo: '💤',
  fatigue: '😓', vertige: '😵', coeur: '♥', nuit: '🌙',
}

/** Les activités tirées au sort quand rien ne se passe. */
export const ACTIVITES: readonly ClawdAnim[] = [
  'coucou', 'danse', 'jongle', 'cafe', 'lecture', 'etirement', 'corde', 'bulles', 'peche', 'yoyo',
  'guitare', 'arrosage', 'ballon', 'papillon', 'pirouette', 'gratte', 'meditation', 'cookie',
]
