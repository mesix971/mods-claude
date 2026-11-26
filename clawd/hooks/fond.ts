// Le fond animé de l'app : son feu de camp, la nuit, dans le coin en bas à
// droite (loin du milieu, où sont les mots, et au-dessus de la zone de
// saisie). Ciel et sol suivent le mode de l'app ; des étoiles qui scintillent
// lentement, des flammes qui ondulent, des braises qui montent. Tout bouge
// lentement (moins d'une fois par seconde), et sans animation (mouvement
// réduit) la scène reste finie : feu, étoiles et braises à leur place.

/** Ses couleurs de pixels (PAL dans sprite.ts) : bois, flammes, braises */
const BOIS = '#9A6234'
const BOIS_FONCE = '#5C3A1A'
const ROUGE = '#E5484D'
const ORANGE = '#D97758'
const JAUNE = '#FFD75F'
const JAUNE_FONCE = '#E0A030'

/** Ses étoiles : x, y (sur 1600×1000), taille, délai de scintillement (s) */
const ETOILES: readonly [number, number, number, number][] = [
  [90, 80, 3, 0], [260, 170, 2, 1.7], [410, 60, 3, 3.1], [620, 140, 2, 0.9], [780, 50, 3, 2.4], [960, 120, 2, 4.2],
  [1120, 70, 3, 1.2], [1290, 160, 2, 3.6], [1450, 90, 3, 0.4], [1540, 210, 2, 2.8], [150, 300, 2, 4.8], [520, 260, 2, 2.1],
  [880, 280, 2, 5.3], [1230, 300, 2, 1.5], [1380, 380, 2, 3.9], [340, 420, 2, 0.7],
]

const CARRE = (x: number, y: number, t: number, couleur: string) => `<rect x="${x}" y="${y}" width="${t}" height="${t}" fill="${couleur}"/>`

/** Le feu, en pixels de 8 (un bloc de 160×200, posé par le coin) */
const FEU = [
  // les bûches croisées
  `<rect x="16" y="168" width="128" height="16" fill="${BOIS}"/>`,
  `<rect x="16" y="168" width="128" height="4" fill="${BOIS_FONCE}"/>`,
  `<rect x="40" y="152" width="80" height="16" fill="${BOIS_FONCE}"/>`,
  // les pierres
  ...[0, 32, 64, 96, 128].map(x => `<rect x="${x + 4}" y="184" width="24" height="12" rx="2" fill="var(--pierre)"/>`),
].join('')

const FLAMMES =
  // la grande flamme rouge, l'orange, le cœur jaune
  `<g class="fl fl1"><path d="M40 160 L48 104 L64 120 L72 56 L88 96 L96 72 L112 120 L120 160 Z" fill="${ROUGE}"/></g>` +
  `<g class="fl fl2"><path d="M52 160 L60 120 L72 128 L80 80 L92 120 L104 104 L108 160 Z" fill="${ORANGE}"/></g>` +
  `<g class="fl fl3"><path d="M64 160 L72 136 L80 112 L88 136 L96 160 Z" fill="${JAUNE}"/></g>`

/** Ses braises : x de départ (dans le bloc du feu), délai (s), durée (s) */
const BRAISES: readonly [number, number, number][] = [[72, 0, 6], [92, 2.2, 7], [60, 4.1, 6.5], [104, 1.3, 8], [84, 5.4, 7.5]]

const CSS =
  `:root{--ciel-haut:#120d14;--ciel-bas:#2a1a16;--sol:#1a1210;--pierre:#4a4a4a;--etoile:#f3e8e0;--lueur:${ORANGE}}` +
  `@media (prefers-color-scheme: light){:root{--ciel-haut:#e9d9cc;--ciel-bas:#f3e2d2;--sol:#d9c2ad;--pierre:#8b8b8b;--etoile:#b08a72;--lueur:${JAUNE_FONCE}}}` +
  // les étoiles scintillent doucement (un cycle de 6 s)
  `.et{animation:et 6s ease-in-out infinite}@keyframes et{0%,100%{opacity:.9}50%{opacity:.35}}` +
  // les flammes ondulent, chacune à son rythme (plus d'une seconde par cycle : jamais un clignotement)
  `.fl{transform-box:fill-box;transform-origin:50% 100%}` +
  `.fl1{animation:fl1 2.4s ease-in-out infinite}@keyframes fl1{0%,100%{transform:scale(1,1)}50%{transform:scale(1.04,.92)}}` +
  `.fl2{animation:fl2 1.9s ease-in-out infinite}@keyframes fl2{0%,100%{transform:scale(1,1) skewX(0)}50%{transform:scale(.96,1.08) skewX(-3deg)}}` +
  `.fl3{animation:fl3 1.6s ease-in-out infinite}@keyframes fl3{0%,100%{transform:scale(1,1)}50%{transform:scale(1.06,.9)}}` +
  // la lueur respire lentement
  `.lueur{animation:lueur 4s ease-in-out infinite}@keyframes lueur{0%,100%{opacity:.32}50%{opacity:.22}}` +
  // les braises montent et s'éteignent (au repos : déjà en l'air, à mi-chemin)
  `.br{animation-name:br;animation-timing-function:ease-out;animation-iteration-count:infinite}` +
  `@keyframes br{0%{transform:translate(0,0);opacity:1}100%{transform:translate(-14px,-130px);opacity:0}}`

/**
 * La scène entière, en SVG pur (le moteur refuse images et polices). Sa
 * racine prend toute la boîte, sans viewBox : chaque calque se cale lui-même,
 * le ciel étiré, les étoiles en haut, le feu épinglé en bas à droite, entier
 * sur un écran large comme sur un téléphone.
 */
export const SCENE_FEU =
  `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">` +
  `<style>${CSS}</style>` +
  `<defs><linearGradient id="ciel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--ciel-haut)"/><stop offset="1" stop-color="var(--ciel-bas)"/></linearGradient>` +
  `<radialGradient id="halo"><stop offset="0" stop-color="var(--lueur)" stop-opacity="1"/><stop offset="1" stop-color="var(--lueur)" stop-opacity="0"/></radialGradient></defs>` +
  `<rect width="100%" height="100%" fill="url(#ciel)"/>` +
  // le sol : le bas de la boîte
  `<svg width="100%" height="100%" viewBox="0 0 1600 1000" preserveAspectRatio="none"><rect y="900" width="1600" height="100" fill="var(--sol)"/></svg>` +
  // ses étoiles, en haut, recadrées à la largeur
  `<svg width="100%" height="100%" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMin slice">` +
  ETOILES.map(([x, y, t, d]) => `<g class="et" style="animation-delay:-${d}s">${CARRE(x, y, t * 2, 'var(--etoile)')}</g>`).join('') +
  `</svg>` +
  // son feu, épinglé en bas à droite, posé sur le sol (au-dessus de la zone de saisie : il est haut de 200 sur 1000)
  `<svg width="100%" height="100%" viewBox="0 0 520 1000" preserveAspectRatio="xMaxYMax meet" overflow="visible">` +
  `<g transform="translate(320 712)">` +
  `<ellipse class="lueur" cx="80" cy="150" rx="260" ry="200" fill="url(#halo)" opacity=".28"/>` +
  FEU +
  FLAMMES +
  BRAISES.map(([x, d, t]) => `<g class="br" style="animation-duration:${t}s;animation-delay:-${d}s">${CARRE(x, 100, 6, JAUNE)}</g>`).join('') +
  `</g></svg></svg>`
