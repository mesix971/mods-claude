// La vitrine du README : chaque scène choisie en SVG animé (promo/vitrine/<nom>.svg), dessinée par le vrai moteur
// de Clawd, telle que l'app l'affiche. Avec --numeros, ses numéros sur toute la bande en GIF : joués sur la bande
// d'exemple, figés image par image dans Edge sans fenêtre, puis assemblés par ffmpeg (il faut les deux).
//
//   node --experimental-strip-types promo/vitrine.mts [--numeros]
//
// Une scène par fichier : dans une même page, des SVG partageraient leurs id (`#profil`…), alors que dans l'app
// chaque dessin est une image à part.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { register } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

register(new URL('./extensions.mjs', import.meta.url))
const s = await import('../clawd/hooks/sprite.ts')
const T = s.TEINTES
const dossier = fileURLToPath(new URL('./vitrine/', import.meta.url))
mkdirSync(dossier, { recursive: true })

// trois sous-agents sur trois modèles : un mini en Haiku, un en Sonnet, un en Fable
const EQUIPE = [
  { fait: 'marche', couleur: T.haiku },
  { fait: 'cherche', couleur: T.sonnet },
  { fait: 'ecrit', couleur: T.fable },
] as const

type Tuile = { fichier: string; anim: string; copains?: readonly unknown[]; rapporteur?: unknown; tenue?: unknown; couleur?: unknown; enPlace?: unknown }
const tuiles: Tuile[] = [
  // au repos
  ...['balade', 'cafe', 'guitare', 'peche', 'jongle', 'glace', 'papillon', 'lecture', 'meditation'].map(anim => ({ fichier: anim, anim })),
  // ses danses (🕺), chacune dans la couleur d'un modèle
  { fichier: 'danse-haiku', anim: 'floss', couleur: T.haiku },
  { fichier: 'danse-sonnet', anim: 'griddy', couleur: T.sonnet },
  { fichier: 'danse-opus', anim: 'danse', couleur: T.opus },
  { fichier: 'danse-fable', anim: 'orange', couleur: T.fable },
  // au travail
  ...['boulot', 'build', 'tests', 'push', 'tel', 'deballe'].map(anim => ({ fichier: anim, anim })),
  // ses jeux de cartons, au milieu de son déménagement
  ...s.JEUX_CARTONS.map((anim: string) => ({ fichier: anim, anim, enPlace: s.etatBoulot(30) })),
  // ses réactions
  ...['fete', 'triste', 'delivrance', 'alerte', 'question', 'attend', 'vertige', 'tasse', 'paquet'].map(anim => ({ fichier: anim, anim })),
  // ses minis : chef de chantier, au sifflet, et chacun qui repart à sa façon
  { fichier: 'chef', anim: 'chef', copains: EQUIPE },
  { fichier: 'sifflet', anim: 'sifflet', copains: [...EQUIPE, { fait: 'build', couleur: T.sonnet }] },
  ...s.SORTIES.map((sortie: string) => ({ fichier: `sortie-${sortie}`, anim: 'rapport', rapporteur: { fait: 'cherche', couleur: T.haiku, sortie } })),
  // sa tenue, son niveau
  { fichier: 'visiere', anim: 'coucou', tenue: { visiere: true } },
  { fichier: 'sueur', anim: 'ecoute', tenue: { sueur: 2 } },
  { fichier: 'niveau', anim: 'niveau', tenue: { insigne: 'or' } },
  ...['bronze', 'argent', 'or', 'etoile'].map(insigne => ({ fichier: `insigne-${insigne}`, anim: 'coucou', tenue: { insigne } })),
  // sa journée
  ...['reveil', 'pause', 'retrouvailles', 'chat', 'filante', 'dodo', 'nuit'].map(anim => ({ fichier: anim, anim })),
  // ses déguisements du jour
  { fichier: 'halloween', anim: 'bonbon', tenue: { deguise: 'citrouille' } },
  { fichier: 'vendredi', anim: 'detente', tenue: { deguise: 'lunettes' } },
  { fichier: 'lundi', anim: 'baille', tenue: { deguise: 'cernes' } },
]

// (les tuiles d'une vitrine d'avant qui n'en font plus partie s'en vont)
const avant = new Set(readdirSync(dossier).filter(f => f.endsWith('.svg')))
let total = 0
for (const t of tuiles) {
  const svg = s.svgScene(t.anim, t.copains ?? [], 0, t.couleur ?? T.opus, t.rapporteur, undefined, t.tenue, t.enPlace)
  writeFileSync(`${dossier}${t.fichier}.svg`, svg)
  avant.delete(`${t.fichier}.svg`)
  total += svg.length
}
for (const f of avant) rmSync(`${dossier}${f}`)
console.log(`vitrine : ${tuiles.length} scènes, ${(total / 1024).toFixed(0)} Ko en tout`)

// ------------------------------------------------- ses numéros, en GIF

if (process.argv.includes('--numeros')) {
  const b = await import('../clawd/hooks/bande.ts')
  const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  // une bande de 560 px (celle d'exemple, et son coin), affichée deux fois plus grande ; 10 images par seconde
  const LARGEUR = 560
  const ZOOM = 2
  const PAS = 0.1
  const COLONNES = 4
  const travail = fileURLToPath(new URL('./vitrine-travail/', import.meta.url))
  mkdirSync(travail, { recursive: true })
  // Edge sans fenêtre rend la main avant d'avoir écrit sa capture : on l'attend (taille stable)
  const attends = (f: string) => {
    let n = -1
    for (let i = 0; i < 240; i++) {
      const t = existsSync(f) ? statSync(f).size : -1
      if (t > 0 && t === n) return true
      n = t
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500)
    }
    return false
  }
  for (const nom of process.argv.filter(a => a in b.NUMEROS).length ? process.argv.filter(a => a in b.NUMEROS) : ['chipe', 'popcorn', 'bousculade']) {
    const prep = b.prepareNumero(nom, b.EXEMPLE, LARGEUR)
    if (!prep) {
      console.log(`${nom} : rien à viser sur la bande d'exemple`)
      continue
    }
    const dessus = b.svgNumero({ nom, elements: b.EXEMPLE, cibles: prep.cibles, largeur: LARGEUR }, T.opus)
    // (un temps de repos dans son coin avant de recommencer)
    const fin = prep.duree + 1
    const n = Math.ceil(fin / PAS)
    const lignes = Math.ceil(n / COLONNES)
    const instants = Array.from({ length: COLONNES * lignes }, (_, k) => +Math.min(fin, k * PAS).toFixed(2))
    // l'original caché pendant qu'il le tient, comme atelier le fait
    const cellule = (t: number) => {
      const tenus = new Set(prep.emprunts.filter(e => t >= e.de && t < e.a).map(e => e.id))
      return `<div class="bande" data-t="${t}">${b.svgBandeExemple(b.EXEMPLE, tenus)}<div class="dessus">${dessus}</div></div>`
    }
    const page = `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;padding:0;background:#1e1e1e}
.grille{display:grid;grid-template-columns:repeat(${COLONNES},${LARGEUR * ZOOM}px);width:${COLONNES * LARGEUR * ZOOM}px}
.bande{position:relative;width:${LARGEUR}px;height:${b.HAUTEUR}px;overflow:hidden;zoom:${ZOOM}}
.bande>svg,.dessus{position:absolute;left:0;bottom:0;width:100%;height:${b.HAUTEUR}px}
.dessus>svg{display:block;width:100%;height:100%}
</style><body><div class="grille">${instants.map(cellule).join('')}</div><script>
for (const d of document.querySelectorAll('.bande')) for (const a of d.getAnimations({ subtree: true })) { a.pause(); a.currentTime = Number(d.dataset.t) * 1000 }
</script></body>`
    const base = `${travail}${nom}`
    writeFileSync(`${base}.html`, page, 'utf8')
    rmSync(`${base}.png`, { force: true })
    const r = spawnSync(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${travail}profil`, `--window-size=${COLONNES * LARGEUR * ZOOM},${lignes * b.HAUTEUR * ZOOM}`, '--virtual-time-budget=5000', `--screenshot=${base}.png`, pathToFileURL(`${base}.html`).href], { encoding: 'utf8', timeout: 180_000 })
    if (r.status !== 0 || !attends(`${base}.png`)) {
      console.log(`${nom} : capture ratée ${String(r.stderr).slice(-200)}`)
      continue
    }
    const gif = `${dossier}numero-${nom}.gif`
    const f = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${base}.png`, '-filter_complex', `untile=${COLONNES}x${lignes},setpts=N/10/TB,split[a][b];[a]palettegen=max_colors=96:reserve_transparent=0[p];[b][p]paletteuse=dither=none`, '-r', '10', '-loop', '0', gif], { encoding: 'utf8' })
    console.log(f.status === 0 ? `${nom} : ${n} images, ${prep.duree} s → ${gif} (${(statSync(gif).size / 1024).toFixed(0)} Ko)` : `${nom} : ffmpeg ${f.stderr.slice(-300)}`)
  }
}
