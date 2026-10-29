// La vidéo de présentation (pour Reddit et ailleurs) : ses scènes et un de ses numéros sur la bande d'atelier,
// chacune légendée en anglais. Comme les GIF de la vitrine, chaque image est dessinée par le vrai moteur de Clawd,
// figée à son instant dans Edge sans fenêtre (une grille d'images par capture), puis ffmpeg les assemble.
//
//   node --experimental-strip-types promo/video.mts
//
// Sortie : promo/vitrine-travail/clawd.mp4 (pas versionnée), 1280×720, 20 images par seconde, sans son.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { register } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

register(new URL('./extensions.mjs', import.meta.url))
const s = await import('../clawd/hooks/sprite.ts')
const b = await import('../clawd/hooks/bande.ts')
const T = s.TEINTES
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const L = 1280
const H = 720
const IPS = 20
// une capture = une grille de 4 × 6 images
const COLONNES = 4
const LIGNES = 6
const racine = fileURLToPath(new URL('./vitrine-travail/', import.meta.url))
const travail = `${racine}video/`
rmSync(travail, { recursive: true, force: true })
mkdirSync(`${travail}images`, { recursive: true })

// trois sous-agents sur trois modèles (un quatrième ne tiendrait pas : un « +1 » sans explication le remplacerait)
const EQUIPE = [
  { fait: 'marche', couleur: T.haiku },
  { fait: 'cherche', couleur: T.sonnet },
  { fait: 'ecrit', couleur: T.fable },
] as const
/** Le nom d'un modèle dans la couleur de ses minis */
const nom = (texte: string, t: { O: string }) => `<b style="color:${t.O}">${texte}</b>`

type Scene = { anim: string; copains?: readonly unknown[]; rapporteur?: unknown; bulle?: string; tenue?: unknown; enPlace?: unknown }
/** Le cadrage d'un plan : décalé (Clawd seul se tient aux deux tiers de sa scène) ou agrandi autour de lui */
type Cadre = { decalage?: number; echelle?: number }
type Plan = {
  titre: string
  sous?: string
  /** en secondes de vidéo */
  duree: number
  /** l'instant de la scène où commence le plan */
  depuis?: number
  /** au-delà, la scène reste figée (la fin d'une scène qui ne se joue qu'une fois) */
  jusqua?: number
  scene?: Scene
  /** une autre tenue à partir de cet instant de la scène (sa médaille qui change) */
  puis?: { des: number; tenue: unknown }
  cadre?: Cadre
  numero?: string
  /** un numéro joué plus vite que nature */
  vitesse?: number
  fin?: true
}

const plans: Plan[] = [
  { titre: 'Meet Clawd', sous: 'A tiny pixel-art Claude who lives above your Claude Code prompt', duree: 4, scene: { anim: 'coucou' }, cadre: { decalage: -190 } },
  { titre: 'While Claude works, Clawd moves boxes', sous: 'The bubble shows what Claude is doing', duree: 4, depuis: 2.1, scene: { anim: 'boulot', bulle: 'ecrit' } },
  // (le carton qui tombe entre déjà entier dans l'image)
  { titre: 'Sometimes a box fights back', sous: 'One of four box surprises, picked at random', duree: s.dureeScene('colis') - 0.15, depuis: 0.15, scene: { anim: 'colis', enPlace: s.etatBoulot(30) } },
  { titre: 'Tests pass: confetti', duree: 2.3, scene: { anim: 'fete' }, cadre: { decalage: -190 } },
  { titre: 'Tests fail: a little rain cloud', duree: 2.3, scene: { anim: 'triste' }, cadre: { decalage: -190 } },
  { titre: 'Every subagent becomes a mini-Clawd', sous: `In its model's color: ${nom('Haiku', T.haiku)}, ${nom('Sonnet', T.sonnet)}, ${nom('Fable', T.fable)}`, duree: 3.8, scene: { anim: 'sifflet', copains: EQUIPE } },
  // (un temps sur Clawd seul, une fois le mini parti)
  { titre: 'Done? The mini hands in its work', sous: 'And leaves in one of five ways', duree: s.dureeScene('rapport') + 0.6, jusqua: s.dureeScene('rapport') - 0.05, scene: { anim: 'rapport', rapporteur: { fait: 'cherche', couleur: T.haiku, sortie: 'pouf' } } },
  // (la sueur de face et au calme : de profil, un carton dans les bras, ses gouttes ne se voient pas)
  { titre: 'Context filling up? He sweats', duree: 3, scene: { anim: 'repos', tenue: { sueur: 2 } }, cadre: { decalage: -190, echelle: 1.5 } },
  { titre: 'Auto mode? Autopilot visor', duree: 2.4, depuis: 6, scene: { anim: 'boulot', tenue: { visiere: true } } },
  // (l'étoile entre déjà entière ; la médaille passe d'argent à or quand il bombe le torse)
  { titre: 'Tool calls earn XP', sous: 'A star falls at each level; his medal upgrades as he climbs', duree: s.dureeScene('niveau') - 0.45, depuis: 0.45, scene: { anim: 'niveau', tenue: { insigne: 'argent' } }, puis: { des: 2.4, tenue: { insigne: 'or' } }, cadre: { decalage: -190 } },
  // la bande entière, puis le gag de près (de son arrivée à son départ)
  { titre: 'Add the atelier mod and he pranks its status bar', sous: 'Here he steals the loading orb… and glues it back', numero: 'chipe', depuis: 2, vitesse: 1.6, duree: (14.2 - 2) / 1.6 },
  { titre: 'Clawd', duree: 4.6, scene: { anim: 'danse' }, fin: true },
]

// --------------------------------------------------------------- les images

const CSS = `
html,body{margin:0;padding:0;background:#141110}
.grille{display:grid;grid-template-columns:repeat(${COLONNES},${L}px);width:${COLONNES * L}px}
.image{position:relative;width:${L}px;height:${H}px;overflow:hidden;background:radial-gradient(ellipse at 50% 58%,#3b2a22 0%,#1e1815 58%,#141110 100%);font-family:"Segoe UI",system-ui,sans-serif;color:#f2efea}
.titre{position:absolute;left:0;right:0;top:40px;text-align:center;font-size:50px;font-weight:700;letter-spacing:-.01em}
.sous{position:absolute;left:0;right:0;top:106px;text-align:center;font-size:26px;color:#b9b2aa}
.sous b{font-weight:700}
.scene{position:absolute;left:30px;top:160px;width:1220px;height:440px}
.scene>svg{display:block;width:100%;height:100%}
.prompt{position:absolute;left:50px;right:50px;top:618px;height:62px;box-sizing:border-box;border:1.5px solid #ffffff26;border-radius:16px;background:#ffffff0a;padding:0 24px;font:22px/59px Consolas,"Cascadia Mono",monospace;color:#8f8a84}
.prompt b{color:#d97758;font-weight:400;margin-right:14px}
.bande{position:absolute;width:560px;height:${b.HAUTEUR}px;transform-origin:0 0;overflow:hidden}
.bande>svg,.bande .dessus{position:absolute;left:0;bottom:0;width:100%;height:${b.HAUTEUR}px}
.bande .dessus>svg{display:block;width:100%;height:100%}
.fin .titre{top:34px;font-size:64px;color:#d97758}
.fin .scene{left:127px;top:118px;width:780px;height:281px}
.lignes{position:absolute;left:0;right:0;top:412px;text-align:center}
.lignes div{margin:0 0 16px}
.l1{font-size:30px;font-weight:600}
.l2{font:24px/1.45 Consolas,"Cascadia Mono",monospace;color:#f2efea;background:#ffffff0d;border:1px solid #ffffff1f;border-radius:10px;display:inline-block;padding:10px 20px;text-align:left}
.l3{font-size:26px;color:#d97758}
.l4{font-size:22px;color:#b9b2aa}
.voile{position:absolute;inset:0;background:#000}
`

const PROMPT = '<div class="prompt"><b>›</b>Ask Claude to fix the failing test…</div>'

/** Le fondu au noir à l'entrée et à la sortie d'un plan (plus long au début et à la fin de la vidéo) */
function voile(p: Plan, u: number): string {
  const entree = p === plans[0] ? 0.4 : 0.15
  const sortie = p.fin ? 0.5 : 0.15
  const o = Math.max(0, 1 - u / entree, 1 - (p.duree - u) / sortie)
  return o > 0 ? `<div class="voile" style="opacity:${o.toFixed(2)}"></div>` : ''
}

/** Une image du plan, `u` secondes après son début, au temps `t` de sa scène (le titre apparaît en 0,3 s) */
function image(p: Plan, u: number, t: number, dessin: string): string {
  const fondu = Math.min(1, u / 0.3).toFixed(2)
  const textes = `<div class="titre" style="opacity:${fondu}">${p.titre}</div>${p.sous ? `<div class="sous" style="opacity:${fondu}">${p.sous}</div>` : ''}`
  if (p.fin) {
    return `<div class="image fin" data-t="${t}">${textes}<div class="scene">${dessin}</div><div class="lignes">` +
      '<div class="l1">73 wordless animated scenes · free and open source (MIT)</div>' +
      '<div><span class="l2">claude plugin marketplace add mesix971/mods-claude<br>claude plugin install clawd@mods-claude</span></div>' +
      '<div class="l3">github.com/mesix971/mods-claude</div>' +
      '<div class="l4">Unofficial fan project, not affiliated with Anthropic</div></div>' + voile(p, u) + '</div>'
  }
  return `<div class="image" data-t="${t}">${textes}${dessin}${PROMPT}${voile(p, u)}</div>`
}

/** La scène cadrée comme le plan le demande (agrandie autour de Clawd, aux deux tiers de sa largeur, pieds au sol) */
function cadree(p: Plan, svg: string): string {
  const c = p.cadre ?? {}
  const style = `left:${30 + (c.decalage ?? 0)}px${c.echelle ? `;transform:scale(${c.echelle});transform-origin:65.6% 92%` : ''}`
  return `<div class="scene" style="${style}">${svg}</div>`
}

const doux = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
/** La bande d'atelier : entière (×2,2) juste au-dessus du prompt, puis de près (×5) sur sa gauche, où se joue le gag */
function placeBande(u: number): string {
  const k = doux((u - 0.7) / 0.6)
  const gauche = 24 + (0 - 24) * k
  const haut = 400 + (270 - 400) * k
  const zoom = 2.2 + (5 - 2.2) * k
  return `left:${gauche.toFixed(1)}px;top:${haut.toFixed(1)}px;transform:scale(${zoom.toFixed(3)})`
}

// (la bande est agrandie par `transform` : `zoom` multiplierait aussi sa position et la pousserait hors de l'image)

// Edge sans fenêtre rend la main avant d'avoir écrit sa capture : on l'attend (taille stable)
function attends(f: string) {
  let n = -1
  for (let i = 0; i < 240; i++) {
    const t = existsSync(f) ? statSync(f).size : -1
    if (t > 0 && t === n) return true
    n = t
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500)
  }
  return false
}

let numero = 0
let page = 0
/** Capture une grille d'images (toutes du même dessin : deux dessins dans une page partageraient leurs id) */
function capture(cellules: string[]) {
  const base = `${travail}page-${String(page++).padStart(3, '0')}`
  const lignes = Math.ceil(cellules.length / COLONNES)
  writeFileSync(`${base}.html`, `<!doctype html><meta charset="utf-8"><style>${CSS}</style><body><div class="grille">${cellules.join('')}</div><script>
for (const d of document.querySelectorAll('.image')) for (const a of d.getAnimations({ subtree: true })) { a.pause(); a.currentTime = Number(d.dataset.t) * 1000 }
</script></body>`, 'utf8')
  const r = spawnSync(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${racine}profil`, `--window-size=${COLONNES * L},${lignes * H}`, '--force-device-scale-factor=1', '--virtual-time-budget=5000', `--screenshot=${base}.png`, pathToFileURL(`${base}.html`).href], { encoding: 'utf8', timeout: 240_000 })
  if (r.status !== 0 || !attends(`${base}.png`)) throw new Error(`capture ratée : ${base} ${String(r.stderr).slice(-200)}`)
  const f = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${base}.png`, '-vf', `untile=${COLONNES}x${lignes}`, '-frames:v', String(cellules.length), '-start_number', String(numero), `${travail}images/%05d.png`], { encoding: 'utf8' })
  if (f.status !== 0) throw new Error(`ffmpeg : ${f.stderr.slice(-300)}`)
  numero += cellules.length
}

/** Capture les images dans l'ordre, une grille à la fois, sans jamais mêler deux dessins dans une page */
function captureTout(images: { cle: string; html: string }[]) {
  let lot: string[] = []
  let cle = ''
  for (const i of images) {
    if (lot.length === COLONNES * LIGNES || (lot.length > 0 && i.cle !== cle)) {
      capture(lot)
      lot = []
    }
    cle = i.cle
    lot.push(i.html)
  }
  if (lot.length > 0) capture(lot)
}

for (const p of plans) {
  const depuis = p.depuis ?? 0
  const vitesse = p.vitesse ?? 1
  const debut = numero
  // chaque image est prise en son milieu : au bord d'une image, deux poses d'une animation se chevauchent ou
  // s'éteignent ensemble (arrondis des délais), d'où des fantômes et des clignotements
  const instants = Array.from({ length: Math.round(p.duree * IPS) }, (_, k) => {
    const u = (k + 0.5) / IPS
    return { u, t: Math.min(depuis + u * vitesse, p.jusqua ?? Infinity) }
  })
  if (p.numero) {
    // le numéro sur la bande d'exemple d'atelier, l'original caché pendant que Clawd le tient (comme atelier le fait)
    const prep = b.prepareNumero(p.numero, b.EXEMPLE, 560)
    if (!prep) throw new Error(`${p.numero} : rien à viser sur la bande d'exemple`)
    const dessus = b.svgNumero({ nom: p.numero, elements: b.EXEMPLE, cibles: prep.cibles, largeur: 560 }, T.opus)
    captureTout(instants.map(({ u, t }) => {
      const tenus = new Set(prep.emprunts.filter((e: { de: number; a: number }) => t >= e.de && t < e.a).map((e: { id: string }) => e.id))
      return { cle: p.numero!, html: image(p, u, t, `<div class="bande" style="${placeBande(u)}">${b.svgBandeExemple(b.EXEMPLE, tenus)}<div class="dessus">${dessus}</div></div>`) }
    }))
  } else if (p.scene) {
    const c = p.scene
    const dessin = (tenue: unknown) => s.svgScene(c.anim, c.copains ?? [], 0, T.opus, c.rapporteur, c.bulle, tenue, c.enPlace)
    const avant = dessin(c.tenue)
    const apres = p.puis ? dessin(p.puis.tenue) : avant
    captureTout(instants.map(({ u, t }) => {
      const svg = p.puis && t >= p.puis.des ? apres : avant
      return { cle: svg === avant ? 'avant' : 'apres', html: image(p, u, t, p.fin ? svg : cadree(p, svg)) }
    }))
  }
  console.log(`${p.titre} : ${p.duree.toFixed(2)} s (images ${debut} à ${numero - 1})`)
}

const mp4 = `${racine}clawd.mp4`
const f = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(IPS), '-i', `${travail}images/%05d.png`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], { encoding: 'utf8' })
if (f.status !== 0) throw new Error(`ffmpeg : ${f.stderr.slice(-300)}`)
console.log(`${mp4} : ${numero} images, ${(numero / IPS).toFixed(1)} s, ${(statSync(mp4).size / 1024 / 1024).toFixed(1)} Mo`)
