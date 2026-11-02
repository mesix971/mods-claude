// Sa carte : son portrait en grand, façon carte à collectionner, avec ce
// qu'il est (son grade, son modèle), ce qu'il a fait (ses performances), ce
// que ça dit de lui (ses qualités, en étoiles), son humeur et ses hauts
// faits. Le cadre suit son grade : bronze, argent, or, puis épique, puis
// holographique pour une Légende. register.tsx rassemble sa fiche et pose la
// carte dans un panneau (ou dans sa bande, là où l'app n'en ouvre pas) ; une
// qualité nouvelle : une ligne dans QUALITES.

import { FAITS, GRADES } from './grades'

/** Ce que sa carte montre de lui (rassemblé par register.tsx) */
export type Fiche = {
  niveau: number
  xp: number
  /** l'expérience où son niveau a commencé, et celle du suivant */
  xpDe: number
  xpA: number
  grade: string | null
  prochain: { nom: string; niveau: number } | null
  /** son modèle (Opus, Sonnet…) et sa teinte */
  modele: string
  couleur: { O: string; o: string }
  humeur: { energie: number; joie: number; ennui: number }
  dort: boolean
  outils: number
  sessions: number
  delivrances: number
  serie: number
  record: number
  caresses: number
  /** jours depuis son adoption (null : pas encore adopté) */
  joursEnsemble: number | null
  /** ses hauts faits gagnés (leurs id) */
  faits: readonly string[]
  /** ce que la version perso y ajoute (ses leçons, ses diplômes) : une ligne en bas de la carte */
  savoirs?: string
}

/** Ses qualités : ce que ses performances disent de lui, d'une à cinq étoiles (un palier franchi : une étoile) */
export const QUALITES: readonly { nom: string; emoji: string; paliers: readonly number[]; de: (f: Fiche) => number }[] = [
  { nom: 'Ardeur', emoji: '🛠', paliers: [100, 1000, 5000, 20_000, 50_000], de: f => f.outils },
  { nom: 'Ténacité', emoji: '💪', paliers: [1, 5, 15, 40, 100], de: f => f.delivrances },
  { nom: 'Fidélité', emoji: '🔥', paliers: [2, 7, 14, 30, 100], de: f => f.record },
  { nom: 'Tendresse', emoji: '♥', paliers: [5, 25, 100, 250, 1000], de: f => f.caresses },
]

/** Ses étoiles dans une qualité (0 à 5) */
export const etoiles = (valeur: number, paliers: readonly number[]) => paliers.filter(p => valeur >= p).length

/** Le cadre de sa carte, d'après son grade (sans grade : bronze) ; la Légende est holographique */
const CADRES: readonly (readonly string[])[] = [
  ['#7a4a22', '#d9a066', '#7a4a22'],
  ['#6b737d', '#eef1f5', '#6b737d'],
  ['#94690f', '#ffe08a', '#94690f'],
  ['#9c3f1c', '#ffcf7a', '#9c3f1c'],
  ['#4a1f73', '#cfa8ff', '#4a1f73'],
  ['#ff5f6d', '#ffc371', '#5ce1a6', '#5fb4ff', '#c779ff', '#ff5f6d'],
]
const rang = (grade: string | null) => Math.max(0, GRADES.findIndex(g => g.nom === grade))

/** Le recadrage de son portrait dans sa scène de repos (lui, ses bras, son ombre, ce qu'il porte sur la tête) */
const PORTRAIT = { x: 30, y: 8, w: 120, h: 92 }

const OR = '#ffd257'
const TEXTE = '#f3ece6'
const TERNE = '#a89d95'
const CREUX = '#3a3230'
const nombre = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.max(0, Math.round(n)))
const pluriel = (n: number, mot: string) => `${mot}${n > 1 ? 's' : ''}`
/** Un texte posé dans le dessin (ce que la version perso y ajoute vient d'un fichier : jamais de balise) */
const xml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!)
const titre = (x: number, y: number, t: string) => `<text x="${x}" y="${y + 10}" class="ct-sec">${xml(t)}</text>`

const CSS =
  `.ct{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;fill:${TEXTE}}` +
  `.ct-sec{font-size:10px;font-weight:700;letter-spacing:.14em;fill:${TERNE}}` +
  `.ct-terne{fill:${TERNE}}` +
  `.ct-emo{font-family:'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif}`

/** Son nom, son grade et son modèle, et son niveau dans un médaillon d'or */
function entete(f: Fiche, x: number, y: number, w: number) {
  const cx = x + w - 22
  return [
    `<text x="${x}" y="${y + 27}" font-size="27" font-weight="700">Clawd</text>`,
    `<text x="${x}" y="${y + 50}" font-size="14" font-weight="600" fill="${f.couleur.O}">${xml(`${f.grade ?? 'Sans grade'} · ${f.modele}`)}</text>`,
    `<circle cx="${cx}" cy="${y + 24}" r="22" fill="url(#ct-medaille)" stroke="#8a5a00" stroke-width="1.5"/>`,
    `<circle cx="${cx}" cy="${y + 24}" r="17" fill="none" stroke="#fff3c4" stroke-opacity=".6"/>`,
    `<text x="${cx}" y="${y + 15}" font-size="7" font-weight="700" letter-spacing=".1em" text-anchor="middle" fill="#5a3a00">NIV</text>`,
    `<text x="${cx}" y="${y + 32}" font-size="${f.niveau >= 100 ? 14 : 17}" font-weight="800" text-anchor="middle" fill="#3b2600">${f.niveau}</text>`,
  ].join('')
}
const H_ENTETE = 58

/** Sa barre d'expérience vers le niveau suivant */
function experience(f: Fiche, x: number, y: number, w: number) {
  const fait = Math.max(0, f.xp - f.xpDe)
  const total = Math.max(1, f.xpA - f.xpDe)
  const part = Math.min(1, fait / total)
  return [
    `<text x="${x}" y="${y + 11}" font-size="12" class="ct-terne">Niveau ${f.niveau} → ${f.niveau + 1}</text>`,
    `<text x="${x + w}" y="${y + 11}" font-size="12" text-anchor="end">${nombre(fait)} / ${nombre(total)} XP</text>`,
    `<rect x="${x}" y="${y + 18}" width="${w}" height="10" rx="5" fill="${CREUX}"/>`,
    part > 0 ? `<rect x="${x}" y="${y + 18}" width="${Math.max(10, w * part).toFixed(1)}" height="10" rx="5" fill="url(#ct-xp)"/>` : '',
    `<text x="${x}" y="${y + 44}" font-size="11" class="ct-terne">${xml(`encore ${nombre(f.xpA - f.xp)} XP${f.prochain ? ` · ${f.prochain.nom} au niveau ${f.prochain.niveau}` : ''}`)}</text>`,
  ].join('')
}
const H_EXPERIENCE = 48

/** Ses performances : ce qu'il a fait, en chiffres, sur `colonnes` colonnes */
function performances(f: Fiche, x: number, y: number, w: number, colonnes: number) {
  const cases: [string, string][] = [
    [nombre(f.xp), 'XP au total'],
    [nombre(f.outils), pluriel(f.outils, 'outil') + ' ' + pluriel(f.outils, 'lancé')],
    [nombre(f.sessions), pluriel(f.sessions, 'session')],
    [nombre(f.delivrances), pluriel(f.delivrances, 'délivrance')],
    [`${nombre(f.serie)} j`, `de suite · record ${nombre(f.record)}`],
    [nombre(f.caresses), pluriel(f.caresses, 'caresse')],
  ]
  const l = w / colonnes
  return (
    titre(x, y, 'PERFORMANCES') +
    cases
      .map(([v, t], i) => {
        const cx = x + (i % colonnes) * l
        const cy = y + 20 + Math.floor(i / colonnes) * 38
        return `<text x="${cx}" y="${cy + 17}" font-size="17" font-weight="700">${xml(v)}</text><text x="${cx}" y="${cy + 31}" font-size="10.5" class="ct-terne">${xml(t)}</text>`
      })
      .join('')
  )
}
const hPerformances = (colonnes: number) => 20 + Math.ceil(6 / colonnes) * 38

/** Ses qualités, en étoiles, sur `colonnes` colonnes */
function qualites(f: Fiche, x: number, y: number, w: number, colonnes: number) {
  const l = w / colonnes
  return (
    titre(x, y, 'QUALITÉS') +
    QUALITES.map((q, i) => {
      const n = etoiles(q.de(f), q.paliers)
      const cx = x + (i % colonnes) * l
      const cy = y + 34 + Math.floor(i / colonnes) * 22
      const fin = cx + l - (i % colonnes === colonnes - 1 ? 0 : 14)
      return (
        `<text x="${cx}" y="${cy}" font-size="13"><tspan class="ct-emo">${q.emoji}</tspan> ${q.nom}</text>` +
        `<text x="${fin}" y="${cy}" font-size="13" text-anchor="end" letter-spacing="1"><tspan fill="${OR}">${'★'.repeat(n)}</tspan><tspan fill="${CREUX}">${'★'.repeat(5 - n)}</tspan></text>`
      )
    }).join('')
  )
}
const hQualites = (colonnes: number) => 20 + Math.ceil(QUALITES.length / colonnes) * 22

/** Son humeur du moment : trois jauges */
function humeur(f: Fiche, x: number, y: number, w: number) {
  const jauges: [string, number, string][] = [
    ['⚡ énergie', f.humeur.energie, '#7fd17f'],
    ['😊 joie', f.humeur.joie, OR],
    ['💤 ennui', f.humeur.ennui, '#8fa3c7'],
  ]
  const l = (w - 20) / 3
  return (
    titre(x, y, f.dort ? 'HUMEUR · IL DORT' : 'HUMEUR') +
    jauges
      .map(([t, v, c], i) => {
        const cx = x + i * (l + 10)
        // (au vingtième : sa carte ne se redessine pas à chaque souffle de son humeur)
        const part = Math.round(Math.min(1, Math.max(0, v)) * 20) / 20
        return (
          `<text x="${cx}" y="${y + 30}" font-size="11" class="ct-terne">${t}</text>` +
          `<rect x="${cx}" y="${y + 36}" width="${l.toFixed(1)}" height="6" rx="3" fill="${CREUX}"/>` +
          (part > 0 ? `<rect x="${cx}" y="${y + 36}" width="${Math.max(6, l * part).toFixed(1)}" height="6" rx="3" fill="${c}"/>` : '')
        )
      })
      .join('')
  )
}
const H_HUMEUR = 44

/** Ses hauts faits : ceux qu'il a gagnés, et la place de ceux qui restent */
function hautsFaits(f: Fiche, x: number, y: number, w: number) {
  const gagnes = new Set(f.faits)
  const l = w / FAITS.length
  return (
    titre(x, y, `HAUTS FAITS · ${FAITS.filter(fait => gagnes.has(fait.id)).length}/${FAITS.length}`) +
    FAITS.map((fait, i) => {
      const cx = (x + l * i + l / 2).toFixed(1)
      return gagnes.has(fait.id)
        ? `<text x="${cx}" y="${y + 38}" font-size="${Math.min(17, l * 0.8).toFixed(1)}" text-anchor="middle" class="ct-emo">${fait.emoji}</text>`
        : `<circle cx="${cx}" cy="${y + 32}" r="${Math.min(9, l * 0.4).toFixed(1)}" fill="#2a2422" stroke="#4d4440"/><text x="${cx}" y="${y + 36}" font-size="10" text-anchor="middle" class="ct-terne">?</text>`
    }).join('')
  )
}
const H_FAITS = 44

/** Le bas de sa carte : ce que la version perso y ajoute, son numéro, depuis quand vous êtes ensemble */
function pied(f: Fiche, x: number, y: number, w: number) {
  const depuis = f.joursEnsemble === null ? 'tout juste adopté' : f.joursEnsemble < 1 ? 'adopté aujourd’hui' : `ensemble depuis ${nombre(f.joursEnsemble)} ${pluriel(f.joursEnsemble, 'jour')}`
  return (
    (f.savoirs ? `<text x="${x}" y="${y + 11}" font-size="12" font-weight="600" fill="${f.couleur.O}">${xml(f.savoirs)}</text>` : '') +
    `<text x="${x}" y="${y + (f.savoirs ? 30 : 11)}" font-size="10.5" class="ct-terne">n° ${String(f.niveau).padStart(3, '0')}</text>` +
    `<text x="${x + w}" y="${y + (f.savoirs ? 30 : 11)}" font-size="10.5" text-anchor="end" class="ct-terne">${xml(depuis)}</text>`
  )
}
const hPied = (f: Fiche) => (f.savoirs ? 34 : 15)

/** Sa fenêtre : son portrait (sa scène de repos, recadrée sur lui, net), sur un fond à sa teinte ; un reflet passe dès Maître */
function fenetre(f: Fiche, portrait: string, x: number, y: number, w: number, haut: number) {
  const scene = portrait.replace(
    /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="[^"]*"/,
    `<svg x="${x}" y="${y + 6}" width="${w}" height="${haut - 6}" viewBox="${PORTRAIT.x} ${PORTRAIT.y} ${PORTRAIT.w} ${PORTRAIT.h}" preserveAspectRatio="xMidYMax meet"`,
  )
  const reflet =
    rang(f.grade) >= 3
      ? `<g clip-path="url(#ct-fenetre)"><rect x="${x - w}" y="${y}" width="${w * 0.6}" height="${haut}" fill="url(#ct-reflet)">` +
        `<animateTransform attributeName="transform" type="translate" values="0 0;0 0;${(w * 2.6).toFixed(0)} 0;${(w * 2.6).toFixed(0)} 0" keyTimes="0;.6;.85;1" dur="7s" repeatCount="indefinite"/></rect></g>`
      : ''
  return (
    `<clipPath id="ct-fenetre"><rect x="${x}" y="${y}" width="${w}" height="${haut}" rx="10"/></clipPath>` +
    `<rect x="${x}" y="${y}" width="${w}" height="${haut}" rx="10" fill="url(#ct-fond)"/>` +
    `<ellipse cx="${x + w / 2}" cy="${y + haut - 10}" rx="${(w * 0.36).toFixed(1)}" ry="9" fill="#000" fill-opacity=".25"/>` +
    scene +
    reflet +
    `<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${haut - 1}" rx="10" fill="none" stroke="#fff" stroke-opacity=".1"/>`
  )
}

/** Les dégradés de sa carte (son cadre, le fond de son portrait, sa barre d'expérience, son médaillon, le reflet) */
function defs(f: Fiche) {
  const cadre = CADRES[rang(f.grade)]!
  const legende = cadre.length > 3
  const arrets = cadre.map((c, i) => `<stop offset="${((i / (cadre.length - 1)) * 100).toFixed(0)}%" stop-color="${c}"/>`).join('')
  return (
    `<defs>` +
    `<linearGradient id="ct-cadre" x1="0" y1="0" x2="1" y2="1">${arrets}` +
    (legende ? `<animateTransform attributeName="gradientTransform" type="rotate" from="0 .5 .5" to="360 .5 .5" dur="8s" repeatCount="indefinite"/>` : '') +
    `</linearGradient>` +
    `<radialGradient id="ct-fond" cx=".5" cy=".38" r=".75"><stop offset="0%" stop-color="${f.couleur.O}" stop-opacity=".55"/><stop offset="100%" stop-color="#16110f"/></radialGradient>` +
    `<linearGradient id="ct-xp" x1="0" x2="1"><stop offset="0%" stop-color="${OR}"/><stop offset="100%" stop-color="${f.couleur.O}"/></linearGradient>` +
    `<radialGradient id="ct-medaille" cx=".35" cy=".3" r=".8"><stop offset="0%" stop-color="#fff3c4"/><stop offset="55%" stop-color="${OR}"/><stop offset="100%" stop-color="#c98a12"/></radialGradient>` +
    `<linearGradient id="ct-reflet" x1="0" x2="1"><stop offset="0%" stop-color="#fff" stop-opacity="0"/><stop offset="50%" stop-color="#fff" stop-opacity=".22"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `</defs>`
  )
}

/** Le cadre et le corps de sa carte */
const fond = (l: number, haut: number) =>
  `<rect width="${l}" height="${haut}" rx="20" fill="url(#ct-cadre)"/>` +
  `<rect x="8" y="8" width="${l - 16}" height="${haut - 16}" rx="14" fill="#1d1918"/>` +
  `<rect x="8.5" y="8.5" width="${l - 17}" height="${haut - 17}" rx="13.5" fill="none" stroke="#fff" stroke-opacity=".08"/>`

const enveloppe = (f: Fiche, l: number, haut: number, contenu: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${l} ${haut}"><style>${CSS}</style>${defs(f)}${fond(l, haut)}<g class="ct">${contenu}</g></svg>`

/**
 * Sa carte, en SVG, et sa taille naturelle (px) : `portrait` (en hauteur, pour
 * un panneau) ou `paysage` (en largeur, pour sa bande). `scene` : sa scène de
 * repos, telle que svgScene la dessine (elle y vit : il respire, cligne des yeux).
 */
export function svgCarte(f: Fiche, scene: string, format: 'portrait' | 'paysage'): { svg: string; largeur: number; hauteur: number } {
  if (format === 'portrait') {
    const l = 360
    const x = 24
    const w = l - 2 * x
    const morceaux: string[] = []
    let y = 22
    morceaux.push(entete(f, x, y, w))
    y += H_ENTETE + 8
    morceaux.push(fenetre(f, scene, x, y, w, 200))
    y += 200 + 16
    morceaux.push(experience(f, x, y, w))
    y += H_EXPERIENCE + 14
    morceaux.push(performances(f, x, y, w, 3))
    y += hPerformances(3) + 12
    morceaux.push(qualites(f, x, y, w, 2))
    y += hQualites(2) + 14
    morceaux.push(humeur(f, x, y, w))
    y += H_HUMEUR + 14
    morceaux.push(hautsFaits(f, x, y, w))
    y += H_FAITS + 14
    morceaux.push(pied(f, x, y, w))
    y += hPied(f) + 20
    return { svg: enveloppe(f, l, y, morceaux.join('')), largeur: l, hauteur: y }
  }
  // en largeur : son portrait à gauche ; son nom, son expérience et ses qualités ; ses performances, son humeur, ses hauts faits
  const l = 780
  const x2 = 262
  const w2 = 236
  const x3 = 524
  const w3 = l - 24 - x3
  let y2 = 22
  const col2: string[] = [entete(f, x2, y2, w2)]
  y2 += H_ENTETE + 8
  col2.push(experience(f, x2, y2, w2))
  y2 += H_EXPERIENCE + 14
  col2.push(qualites(f, x2, y2, w2, 1))
  y2 += hQualites(1) + 12
  col2.push(pied(f, x2, y2, w2))
  y2 += hPied(f)
  let y3 = 22
  const col3: string[] = [performances(f, x3, y3, w3, 2)]
  y3 += hPerformances(2) + 12
  col3.push(humeur(f, x3, y3, w3))
  y3 += H_HUMEUR + 14
  col3.push(hautsFaits(f, x3, y3, w3))
  y3 += H_FAITS
  const haut = Math.max(y2, y3) + 20
  return { svg: enveloppe(f, l, haut, fenetre(f, scene, 24, 22, 220, haut - 44) + col2.join('') + col3.join('')), largeur: l, hauteur: haut }
}

/** Sa carte en mots (le terminal ne dessine pas de SVG, et la description de l'image en dit autant) */
export function texteCarte(f: Fiche): string[] {
  const gagnes = FAITS.filter(fait => f.faits.includes(fait.id))
  return [
    `Clawd · ${f.grade ?? 'sans grade'} · ${f.modele} · niveau ${f.niveau}`,
    `⭐ ${nombre(f.xp - f.xpDe)} / ${nombre(f.xpA - f.xpDe)} XP vers le niveau ${f.niveau + 1}${f.prochain ? ` · ${f.prochain.nom} au niveau ${f.prochain.niveau}` : ''}`,
    `📊 ${nombre(f.xp)} XP · ${nombre(f.outils)} ${pluriel(f.outils, 'outil')} · ${nombre(f.sessions)} ${pluriel(f.sessions, 'session')} · ${nombre(f.delivrances)} ${pluriel(f.delivrances, 'délivrance')} · 🔥 ${nombre(f.serie)} j (record ${nombre(f.record)}) · ♥ ${nombre(f.caresses)}`,
    `✨ ${QUALITES.map(q => `${q.nom} ${'★'.repeat(etoiles(q.de(f), q.paliers))}${'☆'.repeat(5 - etoiles(q.de(f), q.paliers))}`).join(' · ')}`,
    `🧠 énergie ${Math.round(f.humeur.energie * 20) * 5} % · joie ${Math.round(f.humeur.joie * 20) * 5} % · ennui ${Math.round(f.humeur.ennui * 20) * 5} %${f.dort ? ' · il dort' : ''}`,
    `🏅 ${gagnes.length}/${FAITS.length} hauts faits${gagnes.length ? ` : ${gagnes.map(fait => fait.emoji).join(' ')}` : ''}`,
    ...(f.savoirs ? [f.savoirs] : []),
  ]
}
