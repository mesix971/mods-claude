// L'orbe de l'étape en cours : l'état « breathing » de thinking-orbs
// (https://github.com/Jakubantalik/thinking-orbs), réglé pour 20 px. Un
// anneau de points vu de face, dont le rayon ondule sous deux ondes qui en
// font le tour.
//
// Porté du canvas en SVG sans script : chaque point oscille le long de son
// rayon. Les deux ondes sont deux oscillations sinusoïdales emboîtées (CSS),
// partagées par tous les points et décalées par la phase de chacun. La
// géométrie (8 voies × 15 points, rayons, encres, vitesse) est celle du
// réglage d'origine.
//
// Adapted from thinking-orbs — MIT License
//
// Copyright (c) 2026 Jakub Antalik
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

/** Le dessin d'origine tient dans une boîte de 20 × 20 */
const COTE = 20
const C = COTE / 2
/** Le réglage « 20 px » de breathing : vitesse, voies, points par voie, tailles */
const VITESSE = 3.78
const VOIES = 8
const POINTS = 15
const WOB = 0.565
const R_BASE = 1.1 * 1.622
const R_PROFONDEUR = 1.7 * 1.622
const R_MIN = 0.3

const R = C * 0.78
// les lobes gonflent au-delà de R : le rayon de base recule d'autant
const RAYON = R / (1 + 0.85 * 0.23 * WOB)
const ECHELLE_POINT = (COTE / 300) ** 0.6
/** Les deux ondes : amplitude (en unités du dessin) et période (en secondes) */
const ONDE_1 = { amplitude: RAYON * WOB * 0.16, periode: (2 * Math.PI) / (1.7 * VITESSE) }
const ONDE_2 = { amplitude: RAYON * WOB * 0.07, periode: (2 * Math.PI) / (1.1 * VITESSE) }

/**
 * Le retard (négatif) qui fait commencer une oscillation −A → +A → −A de
 * période P exactement comme A · sin(2π t / P + phase).
 */
const retard = (phase: number, periode: number) => {
  const tour = 2 * Math.PI
  return -((((phase + Math.PI / 2) % tour) + tour) % tour) / tour * periode
}

const n = (v: number, d = 2) => Number(v.toFixed(d)).toString()

type Point = { angle: number; rayon: number; r: number; opacite: number; retard1: number; retard2: number }

/** Les 120 points, du plus lointain au plus proche (l'ordre de dessin d'origine) */
const POINTS_ORBE: readonly Point[] = (() => {
  const l: Point[] = []
  for (let w = 0; w < VOIES; w++) {
    const decalage = (w - (VOIES - 1) / 2) * 0.075
    const bord = Math.abs(w - (VOIES - 1) / 2) / Math.max(1, (VOIES - 1) / 2)
    const norme = Math.sqrt(1 + decalage * decalage)
    const profondeur = ((RAYON * decalage) / norme / R + 1) / 2
    const encre = 0.52 - 0.44 * profondeur + 0.18 * bord
    for (let k = 0; k < POINTS; k++) {
      const a = (k / POINTS) * 2 * Math.PI
      l.push({
        angle: a,
        rayon: RAYON / norme,
        r: Math.max(R_MIN, (R_BASE + R_PROFONDEUR * profondeur) * (1 - 0.25 * bord) * ECHELLE_POINT),
        // l'encre d'origine (gris plus clair = plus proche sur fond sombre) portée par l'opacité
        opacite: (0.4 + 0.6 * profondeur) * (1 - Math.min(1, Math.max(0, encre))),
        // onde 1 : sin(3a − 1,7 τ + 0,22 w) ; onde 2 : sin(5a + 1,1 τ)
        retard1: retard(Math.PI - (3 * a + 0.22 * w), ONDE_1.periode),
        retard2: retard(5 * a, ONDE_2.periode),
      })
    }
  }
  return l
})()

/**
 * Le style de l'orbe, à mettre une fois dans le `<style>` du SVG. Les points
 * suivent le thème (clairs sur fond sombre, foncés sur fond clair) ou prennent
 * la teinte donnée à l'orbe, et restent immobiles pour qui a demandé moins
 * d'animations.
 */
export const CSS_ORBE =
  `.orbe circle{fill:var(--teinte,#ececec)}` +
  `.orbe .o1{animation:orbe1 ${n(ONDE_1.periode / 2, 3)}s cubic-bezier(.37,0,.63,1) infinite alternate}` +
  `.orbe .o2{animation:orbe2 ${n(ONDE_2.periode / 2, 3)}s cubic-bezier(.37,0,.63,1) infinite alternate}` +
  `@keyframes orbe1{from{transform:translateX(-${n(ONDE_1.amplitude, 3)}px)}to{transform:translateX(${n(ONDE_1.amplitude, 3)}px)}}` +
  `@keyframes orbe2{from{transform:translateX(-${n(ONDE_2.amplitude, 3)}px)}to{transform:translateX(${n(ONDE_2.amplitude, 3)}px)}}` +
  `@media (prefers-color-scheme: light){.orbe circle{fill:var(--teinte,#202124)}}` +
  `@media (prefers-reduced-motion: reduce){.orbe .o1,.orbe .o2{animation:none}}`

/**
 * L'orbe centré en (cx, cy), dans un carré de `cote` px. `anime` faux : un
 * anneau immobile (Claude ne travaille pas en ce moment). `teinte` : une couleur
 * #rrggbb déjà vérifiée, sinon les couleurs du thème.
 */
export function svgOrbe(cx: number, cy: number, cote: number, anime: boolean, teinte?: string): string {
  const s = cote / COTE
  let corps = ''
  for (const p of POINTS_ORBE) {
    const cercle = `<circle cx="${n(C + p.rayon)}" cy="${C}" r="${n(p.r)}" fill-opacity="${n(p.opacite)}"`
    // tourné à son angle : son rayon devient l'axe x, le long duquel les ondes le poussent
    corps += `<g transform="rotate(${n((-p.angle * 180) / Math.PI, 1)} ${C} ${C})">`
    corps += anime
      ? `<g class="o1" style="animation-delay:${n(p.retard1, 3)}s">${cercle} class="o2" style="animation-delay:${n(p.retard2, 3)}s"/></g>`
      : `${cercle}/>`
    corps += '</g>'
  }
  const style = teinte ? ` style="--teinte:${teinte}"` : ''
  return `<g class="orbe"${style} transform="translate(${n(cx - cote / 2)} ${n(cy - cote / 2)}) scale(${n(s, 4)})">${corps}</g>`
}
