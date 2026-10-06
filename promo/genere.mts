// Génère promo/adopte-un-clawd.html : le film de présentation des mods, avec
// les vrais sprites de Clawd et les vraies jauges d'atelier, tirés de leur code.
//
//   node --experimental-strip-types promo/genere.mts
//
// Mise en page : la colonne de gauche empile légende puis interface dans le
// flux (rien ne peut se chevaucher) ; toutes les tailles suivent la largeur du
// film, comme une vidéo ; sous 560 px il passe en portrait.
import { mkdirSync, writeFileSync } from 'node:fs'

import { jauges, svgJauges } from '../atelier/hooks/jauges.ts'
import { EMOJI, svgScene } from '../clawd/hooks/sprite.ts'

type Anim = Parameters<typeof svgScene>[0]
type Copains = Parameters<typeof svgScene>[1]

const base64 = (svg: string) => 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64')
const sprite = (anim: Anim, cls = '', style = '', copains: Copains = []) =>
  `<img class="clawd ${cls}" style="${style}" src="${base64(svgScene(anim, copains))}" alt="Clawd : ${anim}">`
const tuile = (anim: Anim, nom: string, i: number) =>
  `<figure class="tuile" style="--i:${i}"><img src="${base64(svgScene(anim))}" alt="Clawd : ${nom}"><figcaption>${nom}</figcaption></figure>`

// Les vraies jauges d'atelier, dans trois situations
const hhmm = (ms: number) => {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
const T0 = Date.UTC(2026, 9, 6, 11, 12) // 13:12 à Paris
const dans = (h: number) => new Date(T0 + h * 3600_000).toISOString()
const jauge = (cinqH: number, resetH: number, septJ: number, ctx: number, cls: string, style = '') => {
  const lj = jauges({ fiveHour: { percent: cinqH, resetsAt: dans(resetH) }, sevenDay: { percent: septJ, resetsAt: dans(90) }, contextPercent: ctx }, T0)
  return `<img class="jauges ${cls}" style="${style}" src="${base64(svgJauges(lj, hhmm).svg)}" alt="Jauges : 5 h ${cinqH} %, 7 j ${septJ} %, contexte ${ctx} %">`
}

// Le curseur de souris qui « clique » dans le film
const CURSEUR = `<svg class="curseur" viewBox="0 0 16 22" aria-hidden="true"><path d="M1 1v17l4.5-4.2 3 6.8 3-1.3-3-6.6H15z" fill="#fff" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/></svg>`

type Scene = {
  duree: number
  heure: string
  chapitre: string
  titre: string
  sous: string
  /** interface empilée sous la légende, dans la colonne de gauche */
  ui?: string
  /** Clawd, la mosaïque… placés à droite */
  scene: string
  nuit?: boolean
}

const scenes: Scene[] = [
  {
    duree: 5, heure: '09:02', chapitre: 'Arrivée',
    titre: 'Voici Clawd.', sous: 'Il habite au-dessus de ton prompt. Loyer&nbsp;: zéro.',
    scene: sprite('coucou', 'gros tombe'),
  },
  {
    duree: 7, heure: '09:15', chapitre: 'Boulot',
    titre: 'Tu lui files du boulot…', sous: '…il porte les cartons. Sans râler.',
    scene:
      `<div class="saisie-film"><span class="tape" style="--n:27">corrige le bug du minuteur ⏎</span></div>` +
      sprite('ecoute', 'gros p1', '--x:2.2s') + sprite('boulot', 'gros p2', '--x:2.2s'),
  },
  {
    duree: 6, heure: '10:31', chapitre: 'Build',
    titre: 'Build qui passe&nbsp;?', sous: 'Confettis. Évidemment.',
    ui: `<div class="term"><p>$ ./gradlew assembleDebug</p><p class="ok p2" style="--x:2.4s">BUILD SUCCESSFUL in 41s</p></div>`,
    scene: sprite('build', 'gros p1', '--x:2.4s') + sprite('fete', 'gros p2', '--x:2.4s'),
  },
  {
    duree: 5, heure: '11:07', chapitre: 'Build cassé',
    titre: 'Build qui casse&nbsp;?', sous: 'Petit nuage perso. On respecte le deuil.',
    ui: `<div class="term"><p>$ ./gradlew assembleDebug</p><p class="ko p2" style="--x:1s">BUILD FAILED · 3 errors</p></div>`,
    scene: sprite('triste', 'gros'),
  },
  {
    duree: 7, heure: '13:12', chapitre: 'Quotas',
    titre: 'Tu crames tes quotas&nbsp;?', sous: 'Les jauges virent à l’ambre avant le mur.',
    ui:
      `<div class="bande-film colonne"><span>🌿 <b>main</b> <span class="doux">· 2 modifs · à jour avec GitHub</span></span>` +
      `<span class="pile">${jauge(22, 2, 41, 38, 'p1', '--x:1.8s')}${jauge(58, 3, 44, 52, 'fenetre', '--x:1.8s;--y:4s')}${jauge(93, 1.2, 47, 71, 'p2', '--x:4s')}</span></div>` +
      `<p class="explication">Le petit trait, c’est l’heure qu’il est dans ta fenêtre de 5&nbsp;h. Si la barre le dépasse, tu vas trop vite.</p>`,
    scene: sprite('boulot', 'gros p1', '--x:1.8s') + sprite('fatigue', 'gros p2', '--x:1.8s'),
  },
  {
    duree: 7, heure: '14:20', chapitre: 'Le tel',
    titre: '«&nbsp;C’est quelle version sur le tel, déjà&nbsp;?&nbsp;»', sous: 'Le bandeau te le dit. Un clic, c’est installé.',
    ui:
      `<div class="bande-film"><span>📱 <b>5.7.0</b> (30)</span><span class="doux">· APK 5.7.0 14:18</span>` +
      `<span class="p1 attention" style="--x:3.6s">· tel 5.6.0 ⚠ pas à jour</span><span class="p2 bon" style="--x:3.6s">· tel 5.7.0 ✓</span>` +
      `<span class="bouton clique" style="--x:2.9s">Installer sur le tel<span class="vise">${CURSEUR}</span></span></div>`,
    scene: sprite('tel', 'gros p1', '--x:3.6s') + sprite('fete', 'gros p2', '--x:3.6s'),
  },
  {
    duree: 7, heure: '15:48', chapitre: 'Garde-fou',
    titre: 'Claude tente un <code>pm clear</code>&nbsp;?', sous: 'Il te demande avant. Toujours.',
    ui:
      `<div class="term"><p>$ adb shell pm clear com.ton.app</p></div>` +
      `<div class="pile">` +
      `<div class="dialogue fenetre" style="--x:1.2s;--y:3.8s"><p><b>⚠️ Commande destructrice</b><br>efface toutes les données de l’app.<br>Autoriser&nbsp;?</p>` +
      `<div class="choix"><span class="bouton">Autoriser</span><span class="bouton prim clique" style="--x:3.4s">Refuser<span class="vise">${CURSEUR}</span></span></div></div>` +
      `<div class="toast p2" style="--x:3.9s">Refusé. Tes données dorment tranquilles.</div></div>`,
    scene: sprite('alerte', 'gros p1', '--x:3.9s') + sprite('ecoute', 'gros p2', '--x:3.9s'),
  },
  {
    duree: 6, heure: '16:52', chapitre: 'Secrets',
    titre: 'Ton keystore dans un commit&nbsp;?', sous: 'Bloqué. Ton toi du futur te remercie.',
    ui: `<div class="term"><p>$ git commit -am "wip"</p><p class="ko p2" style="--x:1.4s">🔑 release.keystore · commit bloqué</p></div>`,
    scene: sprite('alerte', 'gros p1', '--x:2.6s') + sprite('coeur', 'gros p2', '--x:2.6s'),
  },
  {
    duree: 6, heure: '17:30', chapitre: 'Sous-agents',
    titre: 'Trois sous-agents&nbsp;?', sous: 'Trois mini-Clawds. Lui passe chef de chantier.',
    ui: `<div class="term"><p>⏵ 3 agents lancés en parallèle</p></div>`,
    scene: sprite('chef', 'gros', '', ['marche', 'cherche', 'ecrit']),
  },
  {
    duree: 7, heure: '18:05', chapitre: 'Pause',
    titre: 'Tu fais une pause&nbsp;?', sous: 'Lui aussi.',
    scene: `<div class="mosaique">${(
      [['cafe', 'café'], ['guitare', 'solo'], ['peche', 'pêche'], ['jongle', 'jonglage'], ['lecture', 'lecture'], ['danse', 'danse']] as const
    ).map(([a, n], i) => tuile(a, n, i)).join('')}</div>`,
  },
  {
    duree: 6, heure: '01:58', chapitre: 'Nuit', nuit: true,
    titre: 'Il est 2&nbsp;h du mat’.', sous: 'Il te le dira. Gentiment.',
    scene: sprite('nuit', 'gros p1', '--x:3s') + sprite('dodo', 'gros p2', '--x:3s'),
  },
  {
    duree: 6, heure: '∞', chapitre: 'Adopte-le',
    titre: 'Adopte un Clawd.', sous: 'Deux mods · zéro dépendance · une ligne de config.',
    ui: `<a class="fleche" href="#installer">↓ Installe-le en 30 secondes</a>`,
    scene: sprite('coucou', 'gros'),
  },
]

const filmScenes = scenes
  .map(
    (s, i) => `<section class="scene${i === 0 ? ' on' : ''}${s.nuit ? ' nuit' : ''}" data-duree="${s.duree}" aria-label="${s.heure} · ${s.chapitre}">
  ${s.nuit ? '<div class="voile-nuit"></div>' : ''}
  <div class="gauche"><p class="heure">${s.heure}</p><h2 class="titre">${s.titre}</h2><p class="sous">${s.sous}</p>${s.ui ?? ''}</div>
  ${s.scene}
</section>`,
  )
  .join('\n')

const chapitres = scenes
  .map((s, i) => `<button type="button" class="chap" data-i="${i}" id="chap-${i}"><span class="h">${s.heure}</span>${s.chapitre}</button>`)
  .join('')

const page = `<title>Adopte un Clawd</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=JetBrains+Mono:wght@400;700&family=Pixelify+Sans:wght@500;700&display=swap">
<style>
/* Mise en page : une page étroite autour d'un « écran » 16:9 (portrait sur
   mobile) où passe le film, une journée de dev horodatée, puis l'adoption
   en trois gestes. */
:root {
  --page: #e9edf0;        /* gris papier légèrement bleuté : l'orange de Clawd ressort */
  --encre: #1b1e22;
  --doux: #59606b;
  --trait: #c9d0d6;
  --carte: #f6f8f9;
  --orange: #d97758;      /* la couleur de Clawd */
  --orange-texte: #b4532f;
  /* l'écran du film reste sombre dans les deux thèmes : c'est l'app */
  --ecran: #18191b;
  --ecran-2: #242528;
  --ecran-3: #2f3034;
  --ecran-encre: #ecebe8;
  --ecran-doux: #9a9ea6;
  --bon: #4cc38a;
  --mauvais: #ef5b5f;
  --jaune: #ffd75f;
  --nuit: #10162b;
  --f-titre: "Pixelify Sans", "Courier New", monospace;
  --f-texte: "Atkinson Hyperlegible", "Segoe UI", system-ui, sans-serif;
  --f-code: "JetBrains Mono", Consolas, "Courier New", monospace;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --page: #111214; --encre: #ecebe8; --doux: #9ea3ab; --trait: #2c2e33; --carte: #191a1d;
    --orange-texte: #e8896a; color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --page: #111214; --encre: #ecebe8; --doux: #9ea3ab; --trait: #2c2e33; --carte: #191a1d;
  --orange-texte: #e8896a; color-scheme: dark;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--page); color: var(--encre); font: 17px/1.55 var(--f-texte); }
.page { max-width: 1120px; margin: 0 auto; padding-inline: 20px; padding-block: 28px 48px; display: grid; gap: 40px; }
a { color: var(--orange-texte); }
:focus-visible { outline: 3px solid var(--orange); outline-offset: 3px; border-radius: 4px; }

/* ---------------------------------------------------------------- en-tête */
.tete { display: grid; gap: 10px; }
.tete h1 { margin: 0; font: 700 clamp(34px, 6vw, 64px)/1 var(--f-titre); letter-spacing: .01em; text-wrap: balance; }
.tete h1 span { color: var(--orange-texte); }
.tete p { margin: 0; max-width: 62ch; color: var(--doux); font-size: 18px; text-wrap: pretty; }
.etiquette { justify-self: start; font: 700 12px/1 var(--f-code); letter-spacing: .08em; text-transform: uppercase; color: var(--doux); border: 1px solid var(--trait); border-radius: 999px; padding: 6px 10px; }

/* ------------------------------------------------------------------ film
   Toutes les tailles sont en cqw (largeur du film) : la composition est la
   même à toutes les tailles, comme une vidéo. */
.film { display: grid; gap: 12px; container-type: inline-size; }
.ecran {
  position: relative; width: 100%; max-width: 100%; aspect-ratio: 16 / 9;
  overflow: hidden; border-radius: 14px; background: var(--ecran); color: var(--ecran-encre);
  background-image: radial-gradient(circle at 76% 58%, #d9775826 0, transparent 34%),
    radial-gradient(#ffffff0d 1px, transparent 1px);
  background-size: auto, 1.6cqw 1.6cqw;
  box-shadow: 0 1px 0 #ffffff12 inset, 0 24px 60px -30px #000c;
}
.scene { position: absolute; inset: 0; visibility: hidden; }
.scene.on { visibility: visible; }

/* colonne de gauche : légende puis interface, empilées dans le flux */
.gauche { position: absolute; z-index: 3; left: 5cqw; top: 4.6cqw; width: 52cqw; display: flex; flex-direction: column; align-items: flex-start; gap: 1.3cqw; }
.heure { margin: 0; font: 700 1.7cqw/1 var(--f-code); letter-spacing: .1em; color: var(--jaune); }
.titre { margin: 0; font: 700 4.6cqw/1.05 var(--f-titre); text-wrap: balance; }
.titre code { font: inherit; color: var(--orange); }
.sous { margin: 0 0 .6cqw; font-size: 2.1cqw; line-height: 1.3; color: var(--ecran-doux); max-width: 46cqw; }

/* barre de saisie de l'app, en bas de l'écran, dans toutes les scènes */
.saisie { position: absolute; left: 5cqw; right: 5cqw; bottom: 3.6cqw; height: 6cqw; border-radius: 1.2cqw;
  background: var(--ecran-2); border: 1px solid #ffffff14; display: flex; align-items: center; padding: 0 2cqw;
  font: 1.7cqw/1 var(--f-texte); color: var(--ecran-doux); }
.ecran:has(.scene.on .saisie-film) .saisie { color: transparent; }
.saisie-film { position: absolute; z-index: 2; left: 7cqw; bottom: 5.5cqw; font: 1.8cqw/1 var(--f-code); color: var(--ecran-encre); }

/* Clawd en grand à droite, debout sur la barre de saisie */
.clawd { position: absolute; image-rendering: pixelated; }
.clawd.gros { right: 3cqw; bottom: 9.6cqw; width: 46cqw; height: auto; }

/* interface du film */
.term { display: grid; gap: .8cqw; padding: 1.4cqw 2cqw; width: 44cqw; border-radius: 1.2cqw; background: #0d0e0f; border: 1px solid #ffffff12; font: 1.6cqw/1.3 var(--f-code); }
.term p { margin: 0; }
.ok { color: var(--bon); font-weight: 700; }
.ko { color: var(--mauvais); font-weight: 700; }
.bande-film { display: flex; flex-wrap: wrap; align-items: center; gap: .7cqw 1cqw; max-width: 52cqw;
  padding: 1.3cqw 1.8cqw; border-radius: 1.2cqw; background: var(--ecran-2); font: 1.7cqw/1.25 var(--f-texte); }
.bande-film.colonne { flex-direction: column; align-items: flex-start; }
.doux { color: var(--ecran-doux); }
.attention { color: var(--jaune); }
.bon { color: var(--bon); }
.bouton { position: relative; display: inline-block; padding: .5cqw 1.2cqw; border-radius: .7cqw; background: var(--ecran-3); color: var(--ecran-encre); font: 700 1.5cqw/1.2 var(--f-texte); }
.bouton.prim { background: var(--orange); color: #1b0f0a; }
/* plusieurs états au même endroit : on les superpose dans une seule case */
.pile { display: grid; }
.pile > * { grid-area: 1 / 1; }
.dialogue { width: 40cqw; padding: 1.8cqw; border-radius: 1.4cqw; background: var(--ecran-3); box-shadow: 0 2cqw 4cqw -1cqw #000b; font: 1.7cqw/1.35 var(--f-texte); }
.dialogue p { margin: 0 0 1.3cqw; }
.choix { display: flex; gap: 1cqw; justify-content: flex-end; }
.toast { align-self: start; justify-self: start; padding: 1.2cqw 1.8cqw; border-radius: 1cqw; background: var(--bon); color: #062615; font: 700 1.6cqw/1.2 var(--f-texte); }
.jauges { width: 40cqw; height: auto; display: block; }
.explication { margin: 0; max-width: 46cqw; font: 1.6cqw/1.35 var(--f-texte); color: var(--ecran-doux); }
.curseur { width: 2.6cqw; height: auto; display: block; filter: drop-shadow(0 .3cqw .3cqw #0008); }
.vise { position: absolute; left: 55%; top: 45%; z-index: 5; pointer-events: none; }
.fleche { font: 700 2.2cqw/1 var(--f-texte); color: var(--jaune); text-decoration: none; }

/* mosaïque de la pause, à droite */
.mosaique { position: absolute; right: 4cqw; top: 6cqw; width: 39cqw; display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.2cqw; }
.tuile { margin: 0; aspect-ratio: 1; border-radius: 1.2cqw; background: var(--ecran-2); display: grid; grid-template-rows: 1fr auto; overflow: hidden; }
.tuile img { width: 100%; height: 100%; object-fit: cover; object-position: 88% 60%; image-rendering: pixelated; }
.tuile figcaption { font: 700 1.3cqw/1 var(--f-code); color: var(--ecran-doux); text-align: center; padding: .7cqw 0 .9cqw; }

/* la nuit tombe */
.voile-nuit { position: absolute; inset: 0; background: var(--nuit);
  background-image: radial-gradient(#fff 1px, transparent 1.4px), radial-gradient(#fff9 1px, transparent 1.4px);
  background-size: 9cqw 7cqw, 13cqw 11cqw; background-position: 2cqw 1cqw, 6cqw 4cqw; }

/* ---------------------------------------------- portrait (écrans étroits) */
@container (max-width: 560px) {
  .ecran { aspect-ratio: 4 / 5; background-size: auto, 3cqw 3cqw; }
  .gauche { left: 6cqw; top: 6cqw; width: 88cqw; gap: 2.2cqw; }
  .heure { font-size: 3.2cqw; }
  .titre { font-size: 8cqw; }
  .sous { font-size: 3.8cqw; max-width: 88cqw; }
  .saisie { left: 6cqw; right: 6cqw; bottom: 5cqw; height: 10cqw; border-radius: 2.4cqw; font-size: 3.2cqw; padding: 0 3.5cqw; }
  .saisie-film { left: 9.5cqw; bottom: 8.6cqw; font-size: 3.3cqw; }
  .clawd.gros { right: 2cqw; bottom: 15cqw; width: 92cqw; }
  .term { width: 88cqw; padding: 2.6cqw 3.4cqw; font-size: 3.1cqw; border-radius: 2.2cqw; gap: 1.4cqw; }
  .bande-film { max-width: 88cqw; padding: 2.4cqw 3cqw; font-size: 3.2cqw; border-radius: 2.2cqw; gap: 1.2cqw 2cqw; }
  .bouton { font-size: 3cqw; padding: 1cqw 2.2cqw; border-radius: 1.4cqw; }
  .dialogue { width: 80cqw; padding: 3.2cqw; font-size: 3.2cqw; border-radius: 2.4cqw; }
  .toast { font-size: 3.1cqw; padding: 2.2cqw 3cqw; border-radius: 2cqw; }
  .jauges { width: 78cqw; }
  .explication { font-size: 3cqw; max-width: 88cqw; }
  .curseur { width: 5cqw; }
  .fleche { font-size: 4.2cqw; }
  .mosaique { left: 6cqw; right: 6cqw; top: auto; bottom: 18cqw; width: auto; gap: 2.4cqw; }
  .tuile figcaption { font-size: 2.6cqw; padding: 1.2cqw 0 1.6cqw; }
}

/* ----------------------------------------------------- animations du film */
.scene.on .titre { animation: monte .55s cubic-bezier(.2, 1.6, .4, 1) both; }
.scene.on .sous { animation: monte .55s .25s cubic-bezier(.2, 1.4, .4, 1) both; }
.scene.on .heure { animation: clignote 1s steps(2) 2; }
.scene.on .tombe { animation: tombe 1s cubic-bezier(.3, 1.5, .5, 1) both; }
/* p1 : visible jusqu'à --x ; p2 : à partir de --x ; fenetre : de --x à --y */
.scene.on .p1 { animation: part 0s var(--x) both; }
.scene.on .p2 { animation: arrive 0s var(--x) both; }
.fenetre { visibility: hidden; }
.scene.on .fenetre { animation: fenetre calc(var(--y) - var(--x)) var(--x); }
.scene.on .dialogue.fenetre { animation: fenetre calc(var(--y) - var(--x)) var(--x), pop .35s var(--x) cubic-bezier(.2, 1.5, .4, 1) backwards; }
.scene.on .toast.p2 { animation: arrive 0s var(--x) both, pop .35s var(--x) cubic-bezier(.2, 1.5, .4, 1) backwards; }
.scene.on .tape { display: inline-block; overflow: hidden; white-space: nowrap; vertical-align: bottom; animation: tape 1.4s .3s steps(var(--n)) both; }
.scene.on .vise { animation: vise 1.1s calc(var(--x) - 1.1s) cubic-bezier(.5, 0, .2, 1) both; }
.scene.on .clique { animation: clique .25s var(--x) both; }
.scene.on .tuile { animation: pop .4s calc(.4s + var(--i) * .45s) cubic-bezier(.2, 1.5, .4, 1) both; }
.scene.on .fleche { animation: rebond 1.2s 1s ease-in-out infinite; }
.scene.nuit.on .voile-nuit { animation: nuit 1.2s both; }
@keyframes monte { from { opacity: 0; transform: translateY(1.5cqw); } }
@keyframes clignote { 50% { opacity: .2; } }
@keyframes tombe { from { transform: translateY(-40cqw); } }
@keyframes part { to { visibility: hidden; } }
@keyframes arrive { from { visibility: hidden; } to { visibility: visible; } }
@keyframes fenetre { from, to { visibility: visible; } }
@keyframes pop { from { opacity: 0; transform: scale(.6); } }
@keyframes tape { from { width: 0; } to { width: calc(var(--n) * 1ch); } }
@keyframes vise { from { transform: translate(40cqw, 30cqw); } to { transform: translate(0, 0); } }
@keyframes clique { 50% { transform: scale(.9); filter: brightness(1.4); } }
@keyframes rebond { 50% { transform: translateY(.8cqw); } }
@keyframes nuit { from { opacity: 0; } }
.ecran.pause * { animation-play-state: paused !important; }

/* commandes du film */
.commandes { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.lecture { display: inline-flex; align-items: center; gap: 8px; border: 0; border-radius: 999px; padding: 9px 16px; cursor: pointer;
  background: var(--orange); color: #1b0f0a; font: 700 15px/1 var(--f-texte); }
.barre { flex: 1 1 200px; height: 6px; border-radius: 999px; background: var(--trait); overflow: hidden; min-width: 0; }
.barre i { display: block; height: 100%; width: 0; background: var(--orange); }
.chapitres { display: flex; flex-wrap: wrap; gap: 6px; }
.chap { border: 1px solid var(--trait); background: var(--carte); color: var(--encre); border-radius: 999px; padding: 6px 11px; cursor: pointer;
  font: 600 13px/1 var(--f-texte); display: inline-flex; gap: 6px; align-items: center; }
.chap .h { font: 700 11px/1 var(--f-code); color: var(--doux); font-variant-numeric: tabular-nums; }
.chap[aria-current="true"] { border-color: var(--orange); background: var(--orange); color: #1b0f0a; }
.chap[aria-current="true"] .h { color: #1b0f0a; }

/* ------------------------------------------------------------- les mods */
.mods { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 16px; }
.mod { background: var(--carte); border: 1px solid var(--trait); border-radius: 12px; padding: 20px 22px; display: grid; gap: 10px; align-content: start; min-width: 0; }
.mod h2 { margin: 0; font: 700 26px/1.1 var(--f-titre); }
.mod h2 small { font: 700 12px/1 var(--f-code); color: var(--doux); letter-spacing: .06em; text-transform: uppercase; margin-left: 8px; }
.mod ul { margin: 0; padding-left: 1.1em; display: grid; gap: 6px; }
.mod li::marker { color: var(--orange); }
.mod .note { margin: 0; font-size: 14px; color: var(--doux); }

/* ------------------------------------------------------------- installer */
.installer { display: grid; gap: 18px; }
.installer h2 { margin: 0; font: 700 clamp(26px, 4vw, 40px)/1.05 var(--f-titre); text-wrap: balance; }
.etapes { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; counter-reset: etape; }
.etapes > li { counter-increment: etape; display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 14px; align-items: start; }
.contenu { display: grid; gap: 8px; min-width: 0; }
.etapes > li::before { content: counter(etape); width: 44px; height: 44px; border-radius: 10px; display: grid; place-items: center;
  font: 700 22px/1 var(--f-titre); background: var(--orange); color: #1b0f0a; }
.etapes h3 { margin: 6px 0 0; font-size: 18px; }
.bloc { position: relative; min-width: 0; }
.bloc pre { margin: 0; overflow-x: auto; padding: 14px 16px; padding-right: 92px; border-radius: 10px; background: var(--ecran); color: var(--ecran-encre);
  font: 14px/1.5 var(--f-code); }
.copier { position: absolute; top: 8px; right: 8px; border: 1px solid #ffffff2a; background: var(--ecran-3); color: var(--ecran-encre);
  border-radius: 8px; padding: 6px 10px; font: 700 12px/1 var(--f-texte); cursor: pointer; }
.etapes p { margin: 0; color: var(--doux); }
.pied { color: var(--doux); font-size: 14px; border-top: 1px solid var(--trait); padding-top: 16px; }
.pied p { margin: 0 0 6px; max-width: 75ch; }

@media (prefers-reduced-motion: reduce) {
  .scene.on .fleche, .scene.on .titre, .scene.on .sous, .scene.on .heure, .scene.on .tombe,
  .scene.on .tuile, .scene.on .tape, .scene.on .vise, .scene.on .clique { animation: none; }
  .scene.on .tape { width: auto; }
}
</style>

<main class="page">
  <header class="tete">
    <span class="etiquette">Mods pour Claude Code · fan-made</span>
    <h1>Adopte un <span>Clawd</span>.</h1>
    <p>Deux mods pour Claude Code. Un compagnon en pixel art qui vit au-dessus de ton prompt et réagit à tout ce que tu fais, et un atelier qui t’évite les bêtises classiques du dev Android.</p>
  </header>

  <section class="film" aria-label="Le film : une journée avec Clawd">
    <div class="ecran" id="ecran">
      ${filmScenes}
      <div class="saisie" aria-hidden="true">Tapez / pour les commandes.</div>
    </div>
    <div class="commandes">
      <button type="button" class="lecture" id="lecture" aria-label="Mettre en pause">❚❚ Pause</button>
      <div class="barre" aria-hidden="true"><i id="avance"></i></div>
    </div>
    <nav class="chapitres" aria-label="Chapitres du film">${chapitres}</nav>
  </section>

  <section class="mods" aria-label="Les deux mods">
    <article class="mod">
      <h2>clawd <small>le compagnon</small></h2>
      <ul>
        <li>${Object.keys(EMOJI).length} scènes animées image par image, sans un mot.</li>
        <li>Il se balade sur sa petite scène, boit son café, pêche, jongle, joue de la guitare quand tu fais une pause.</li>
        <li>Il écrit quand Claude édite, sort la loupe quand il cherche, porte des cartons pendant que ça bosse.</li>
        <li>Confettis quand ça passe, petit nuage quand ça casse.</li>
        <li>Un mini-Clawd par sous-agent, et lui en chef de chantier.</li>
        <li>Fond transparent, contour et ombre qui suivent ton thème clair ou sombre.</li>
      </ul>
      <p class="note">Survole-le : ♥ pour le caresser (il compte), 🎲 pour qu’il change d’activité.</p>
    </article>
    <article class="mod">
      <h2>atelier <small>le garde-fou</small></h2>
      <ul>
        <li>Jauges des quotas 5 h et 7 j et du contexte : vert, ambre, rouge. Un trait marque le temps écoulé, pour voir si tu vas trop vite.</li>
        <li>Version déclarée, dernier APK, version installée sur le tel, bouton « Installer sur le tel ».</li>
        <li>État git, bouton « Commit + push », alerte si la version est bumpée sans CHANGELOG.</li>
        <li>Demande ton accord avant <code>pm clear</code>, <code>reset --hard</code>, un push forcé…</li>
        <li>Bloque les commits qui embarquent un keystore, un <code>.env</code> ou <code>local.properties</code>.</li>
      </ul>
      <p class="note">adb et le JBR d’Android Studio sont trouvés tout seuls, sous Windows, macOS et Linux.</p>
    </article>
  </section>

  <section class="installer" id="installer">
    <h2>Installe-le en 30 secondes</h2>
    <ol class="etapes">
      <li><div class="contenu">
        <h3>Ajoute la marketplace</h3>
        <div class="bloc"><pre id="cmd-marketplace">claude plugin marketplace add mesix971/mods-claude</pre><button type="button" class="copier" data-cible="cmd-marketplace">Copier</button></div>
      </div></li>
      <li><div class="contenu">
        <h3>Installe Clawd (et atelier si tu fais de l’Android)</h3>
        <div class="bloc"><pre id="cmd-install">claude plugin install clawd@mods-claude
claude plugin install atelier@mods-claude</pre><button type="button" class="copier" data-cible="cmd-install">Copier</button></div>
      </div></li>
      <li><div class="contenu">
        <h3>Ouvre une nouvelle session</h3>
        <p>Clawd arrive au-dessus du prompt et te fait coucou. Les mods utilisent les hooks de fonction de Claude Code : il te faut une version récente.</p>
      </div></li>
    </ol>
  </section>

  <footer class="pied">
    <p>Projet perso, fan-made et non officiel, sans lien avec Anthropic. Clawd y est redessiné pixel par pixel à partir de l’app.</p>
    <p>Code : <a href="https://github.com/mesix971/mods-claude" target="_blank" rel="noopener">github.com/mesix971/mods-claude</a></p>
  </footer>
</main>

<script>
(() => {
  const ecran = document.getElementById('ecran')
  const scenes = [...ecran.querySelectorAll('.scene')]
  const durees = scenes.map(s => Number(s.dataset.duree))
  const debuts = durees.map((_, i) => durees.slice(0, i).reduce((a, b) => a + b, 0))
  const total = durees.reduce((a, b) => a + b, 0)
  const chaps = [...document.querySelectorAll('.chap')]
  const bouton = document.getElementById('lecture')
  const avance = document.getElementById('avance')
  const calme = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let t = 0
  let enCours = !calme
  let courante = -1
  let avant = performance.now()

  function activer(i) {
    courante = i
    scenes.forEach(s => s.classList.remove('on'))
    void ecran.offsetWidth // relance les animations de la scène
    scenes[i].classList.add('on')
    chaps.forEach((c, k) => c.setAttribute('aria-current', String(k === i)))
  }
  function indice(temps) {
    for (let i = durees.length - 1; i >= 0; i--) if (temps >= debuts[i]) return i
    return 0
  }
  function majBouton() {
    bouton.textContent = enCours ? '❚❚ Pause' : '▶ Lecture'
    bouton.setAttribute('aria-label', enCours ? 'Mettre en pause' : 'Lancer le film')
    ecran.classList.toggle('pause', !enCours)
  }
  function image(maintenant) {
    const dt = Math.min(0.1, (maintenant - avant) / 1000)
    avant = maintenant
    if (enCours) t = (t + dt) % total
    const i = indice(t)
    if (i !== courante) activer(i)
    avance.style.width = ((t / total) * 100).toFixed(2) + '%'
    requestAnimationFrame(image)
  }
  bouton.addEventListener('click', () => { enCours = !enCours; majBouton() })
  chaps.forEach(c => c.addEventListener('click', () => {
    t = debuts[Number(c.dataset.i)]
    activer(Number(c.dataset.i))
    enCours = true
    majBouton()
  }))
  document.querySelectorAll('.copier').forEach(b => b.addEventListener('click', async () => {
    const cible = document.getElementById(b.dataset.cible)
    try {
      await navigator.clipboard.writeText(cible.textContent)
      b.textContent = 'Copié'
    } catch {
      const r = document.createRange()
      r.selectNodeContents(cible)
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(r)
      b.textContent = 'Sélectionné'
    }
    setTimeout(() => { b.textContent = 'Copier' }, 1600)
  }))
  majBouton()
  activer(0)
  requestAnimationFrame(image)
})()
</script>
`

writeFileSync(new URL('./adopte-un-clawd.html', import.meta.url), page)

// ------------------------------------------- page autonome pour GitHub Pages
// (la page ci-dessus est un fragment : l'hébergeur d'artefacts ajoute
// lui-même doctype, head et body)
const coupe = page.indexOf('<main class="page">')
const pageAutonome = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Clawd, le compagnon en pixel art de Claude Code, et atelier, le garde-fou du dev Android.">
${page.slice(0, coupe)}
</head>
<body>
${page.slice(coupe)}
</body>
</html>
`
mkdirSync(new URL('../docs/', import.meta.url), { recursive: true })
writeFileSync(new URL('../docs/index.html', import.meta.url), pageAutonome)

// --------------------------------------------- bande-annonce pour le README
// Un SVG animé sans script, que GitHub affiche tel quel. Les sprites y sont
// intégrés directement (pas d'image dans l'image) pour que leurs animations
// tournent partout.
const integre = (svg: string, x: number, y: number, w: number, h: number) =>
  svg.replace(/^<svg[^>]*?viewBox="([^"]+)"[^>]*>/, (_, vb: string) => `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${vb}" shape-rendering="crispEdges">`)

const BA: { anim: Anim; heure: string; texte: string; copains?: Copains }[] = [
  { anim: 'balade', heure: '09:02', texte: 'Il vit au-dessus de ton prompt' },
  { anim: 'boulot', heure: '09:15', texte: 'Tu bosses ? Il porte les cartons' },
  { anim: 'fete', heure: '10:31', texte: 'Build qui passe : confettis' },
  { anim: 'triste', heure: '11:07', texte: 'Build qui casse : petit nuage' },
  { anim: 'chef', heure: '17:30', texte: '3 sous-agents : 3 mini-Clawds', copains: ['marche', 'cherche', 'ecrit'] },
  { anim: 'cafe', heure: '18:05', texte: 'Tu fais une pause ? Lui aussi' },
  { anim: 'nuit', heure: '01:58', texte: 'À 2 h du mat’, il te dit d’aller dormir' },
]
const PAR_SCENE = 4.5
const TOTAL = BA.length * PAR_SCENE
const pc = (t: number) => `${((t / TOTAL) * 100).toFixed(3)}%`
const POLICE = `"Segoe UI",system-ui,-apple-system,"Helvetica Neue",Arial,sans-serif`
const jaugesBA = jauges({ fiveHour: { percent: 58, resetsAt: dans(3) }, sevenDay: { percent: 44, resetsAt: dans(90) }, contextPercent: 52 }, T0)
const dessinJauges = svgJauges(jaugesBA, hhmm)

const bandeAnnonce = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 300" width="960" height="300" role="img" aria-label="Adopte un Clawd : le compagnon en pixel art de Claude Code">
<style>
.t{font:800 46px ${POLICE};fill:#ecebe8}.o{fill:#d97758}
.s{font:400 17px ${POLICE};fill:#9a9ea6}
.h{font:700 15px ui-monospace,Consolas,"Courier New",monospace;fill:#ffd75f;letter-spacing:.08em}
.c{font:600 22px ${POLICE};fill:#ecebe8}
.j{font:600 12px ${POLICE};fill:#9a9ea6}
${BA.map((_, i) => `.ba${i}{opacity:0;animation:ba${i} ${TOTAL}s infinite steps(1,end)}@keyframes ba${i}{0%{opacity:0}${pc(i * PAR_SCENE)}{opacity:1}${pc((i + 1) * PAR_SCENE)}{opacity:0}}`).join('\n')}
</style>
<defs>
<pattern id="points" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#ffffff12"/></pattern>
<radialGradient id="halo" cx="74%" cy="64%" r="42%"><stop offset="0" stop-color="#d97758" stop-opacity=".2"/><stop offset="1" stop-color="#d97758" stop-opacity="0"/></radialGradient>
</defs>
<rect width="960" height="300" rx="18" fill="#18191b"/>
<rect width="960" height="300" rx="18" fill="url(#points)"/>
<rect width="960" height="300" rx="18" fill="url(#halo)"/>
<text class="t" x="40" y="80">Adopte un <tspan class="o">Clawd</tspan>.</text>
<text class="s" x="42" y="112">Deux mods pour Claude Code : un compagnon en pixel art, un garde-fou.</text>
${BA.map(
  (b, i) => `<g class="ba${i}"><text class="h" x="42" y="166">${b.heure}</text><text class="c" x="42" y="198">${b.texte}</text>${integre(svgScene(b.anim, b.copains ?? []), 430, 108, 510, 184)}</g>`,
).join('\n')}
<text class="j" x="42" y="246">atelier : jauges de quotas, garde-fous, APK ↔ tel</text>
${integre(dessinJauges.svg, 42, 254, dessinJauges.largeur, 18)}
</svg>
`
writeFileSync(new URL('./bande-annonce.svg', import.meta.url), bandeAnnonce)

console.log('ok', (page.length / 1024).toFixed(0), 'Ko ·', 'bande-annonce', (bandeAnnonce.length / 1024).toFixed(0), 'Ko')
