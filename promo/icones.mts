// Les icônes des deux mods (PNG carrés de 1024 px, dans .claude-plugin/icon.png) : Clawd dessiné par son vrai moteur,
// les bras en l'air ; pour atelier, son bandeau en pixels (le téléphone et ses jauges). Capturées par Edge sans fenêtre.
//
//   node --experimental-strip-types promo/icones.mts
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { register } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

register(new URL('./extensions.mjs', import.meta.url))
const s = await import('../clawd/hooks/sprite.ts')
const { PAL, CSS, THEME, FILTRE, corps, A } = s.PINCEAUX
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const travail = fileURLToPath(new URL('./vitrine-travail/', import.meta.url))
mkdirSync(travail, { recursive: true })

const ETOILE = ['.Y.', 'YYY', '.Y.']
// Clawd heureux, les bras en l'air, entre trois étincelles (son contour suit le thème sombre de l'icône)
const clawd =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="40 18 100 100" shape-rendering="crispEdges">` +
  `<style>${CSS}${THEME}</style>${FILTRE}<g filter="url(#contour)">` +
  corps({ g: 'haut', d: 'haut', yeux: 'heureux' }) +
  A(ETOILE, -8, -16, 2) + A(ETOILE, 78, -10, 2) + A(['Y'], 70, -24, 2) +
  `</g></svg>`

// atelier : le téléphone (une coche verte : l'app est à jour) et trois jauges (vert, ambre, rouge), chacune avec son trait
const r = (x: number, y: number, w: number, h: number, c: string) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`
const jauge = (y: number, plein: number, c: string, trait: number) => r(30, y, 26, 6, '#ffffff22') + r(30, y, plein, 6, c) + r(30 + trait, y - 1, 1, 8, '#ececec')
const atelier =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" shape-rendering="crispEdges">` +
  r(9, 12, 16, 40, PAL.g!) + r(11, 14, 12, 34, '#24292f') + r(15, 49, 4, 2, PAL.G!) +
  r(13, 30, 2, 2, PAL.V!) + r(15, 32, 2, 2, PAL.V!) + r(17, 30, 2, 2, PAL.V!) + r(19, 28, 2, 2, PAL.V!) + r(21, 26, 2, 2, PAL.V!) +
  jauge(18, 18, '#4cc38a', 13) + jauge(30, 14, '#f2b33d', 9) + jauge(42, 22, '#ef5b5f', 15) +
  `</svg>`

const page = (svg: string, fond: string) =>
  `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:1024px;height:1024px;overflow:hidden;background:${fond}}svg{display:block;width:1024px;height:1024px}</style><body>${svg}</body>`

for (const [mod, svg, fond] of [
  ['clawd', clawd, 'radial-gradient(circle at 50% 56%, #5a3324 0%, #2a1c17 48%, #16110f 100%)'],
  ['atelier', atelier, 'radial-gradient(circle at 50% 45%, #2b3036 0%, #1b1e22 70%)'],
] as const) {
  const html = `${travail}icone-${mod}.html`
  const png = fileURLToPath(new URL(`../${mod}/.claude-plugin/icon.png`, import.meta.url))
  writeFileSync(html, page(svg, fond), 'utf8')
  rmSync(png, { force: true })
  spawnSync(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${travail}profil`, '--window-size=1024,1024', '--force-device-scale-factor=1', '--virtual-time-budget=2000', `--screenshot=${png}`, pathToFileURL(html).href])
  // (Edge rend la main avant d'avoir fini d'écrire : on attend que le fichier ne grossisse plus)
  let n = -1
  for (let i = 0; i < 60; i++) {
    const t = existsSync(png) ? statSync(png).size : -1
    if (t > 0 && t === n) break
    n = t
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300)
  }
  console.log(`${mod} : ${png} (${(statSync(png).size / 1024).toFixed(0)} Ko)`)
}
