// Tests de la grande scène : ses numéros sur toute la bande, avec ce qu'atelier
// y dessine. Il vise, il prend (atelier ne dessine plus l'original), il rend
// toujours, il rentre dans son coin, et il ne dit jamais un mot. Son dessin
// est préparé une fois et publié : atelier le pose par-dessus la bande ; sans
// atelier qui dessine, c'est lui qui le pose.
import { expect, mock, test } from 'claude-code/testing'

import type { ElementBande } from '../types'
import { COIN_VIDE, HAUTEUR, MARGE, MAX_DUREE, MAX_SVG, NUMEROS, RETENUE, numerosAvecMinis, numerosJouables, prepareNumero, svgNumero } from './bande'
import type { Numero } from './bande'
import { TEINTES } from './sprite'

const BAND = {
  plugin: 'clawd',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120, scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const
const SESSION = { cwd: '/projet', surface: 'desktop', isInteractive: true } as const
const COMPOSER = { kind: 'composer' } as const
/** La largeur de la bande de BAND en px (120 cases, au moins) : ses trajets s'y mesurent */
const LARGEUR = 906
// 17/10/2026, 15:00 à Paris
const MAINTENANT = Date.UTC(2026, 9, 17, 13, 0)

/** La bande d'atelier : une jauge en haut ; en bas le build raté, une étape faite, l'étape en cours (l'orbe) */
const ELEMENTS: ElementBande[] = [
  { id: 'jauge-5h', genre: 'jauge', etat: 'ok', x: 0, largeur: 108, ligne: 1 },
  { id: 'build', genre: 'build', etat: 'echec', x: 0, largeur: 17, ligne: 0 },
  { id: 'tache-plan-1', genre: 'tache', etat: 'faite', x: 27, largeur: 17, ligne: 0 },
  { id: 'tache-plan-2', genre: 'tache', etat: 'encours', x: 44, largeur: 17, ligne: 0 },
]

type On = Parameters<Parameters<typeof test>[1] extends infer F ? (F extends ($: never, on: infer O) => unknown ? (o: O) => void : never) : never>[0]
type Noeud = { props?: Record<string, unknown>; children?: Noeud[] }

/** Le moteur pour de faux, avec (ou sans) la bande partagée d'atelier ; ce que Clawd écrit dans son état est noté */
function moteur(on: On, bande: { elements: ElementBande[] } | null = { elements: ELEMENTS }, lecon?: Record<string, unknown>, masque = false) {
  const stockage = new Map<string, unknown>()
  const ecrits: { key: string; value: unknown }[] = []
  const horloge = mock.clock(on as never, { now: MAINTENANT })
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>dessous</Text>
  })
  on('store.get', ($, e) => ({ value: stockage.get(e.key) }))
  on('store.set', ($, e) => {
    stockage.set(e.key, e.value)
    return { value: undefined }
  })
  on('ui.toast', () => ({ value: undefined }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  // sa dernière leçon, s'il en a une (le moteur passe les chemins à la Windows)
  on('fs.read', ($, e) => {
    if (lecon && e.path.replace(/\\/g, '/').endsWith('/clawd/perso/lecon.json')) return { value: JSON.stringify(lecon) }
    throw new Error('absent')
  })
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: 'non', isStdoutTruncated: false, isStderrTruncated: false } }))
  // atelier : sa bande partagée (null quand il ne dessine rien)
  on('state.get', ($, e, next) =>
    e.plugin === 'atelier' && e.key === 'scene'
      ? { value: { value: bande && { lignes: ['quotas', 'pastilles'], ...bande }, version: 1 } }
      : e.plugin === 'atelier' && e.key === 'isHidden'
        ? { value: { value: masque, version: 1 } }
        : next(e),
  )
  on('state.set', ($, e, next) => {
    ecrits.push({ key: (e as { key: string }).key, value: (e as { value: unknown }).value })
    return next(e)
  })
  /** Sa dernière écriture sous cette clé */
  const dernier = (cle: string) => ecrits.filter(x => x.key === cle).at(-1)?.value
  /** Ce qu'il tient (les noms), d'après sa dernière écriture */
  const tenus = () => ((dernier('emprunts') as { id: string }[] | undefined) ?? []).map(x => x.id)
  return { horloge, dernier, tenus, ecrits }
}

/** La Box d'une clé, puis son dessin (la clé posée sur un Svg enfant n'est pas gardée par le kit) */
const dessinDe = async (ui: { find: (q: { key: string }) => Promise<unknown> }, cle: string) => ((await ui.find({ key: cle })) as Noeud | undefined)?.children?.[0]?.props

test('grande scène : il vise l’orbe qui tourne, la tient le temps voulu, et se dessine sans un mot', () => {
  const prep = prepareNumero('chipe', ELEMENTS)!
  expect(prep.cibles.map(c => c.id)).toEqual(['tache-plan-2'])
  // sur 760 px : 607 px de course (4,05 s), 60 px en catimini (1,2 s), 667 px de retour (4,45 s), et à chaque trajet
  // son élan et son freinage (0,09 s chacun)
  expect(prep.duree).toBe(19.46)
  // il la prend à 7,83 s (après l'approche en catimini) et la rend à 13,03 s (après l'avoir recollée)
  expect(prep.emprunts).toEqual([{ id: 'tache-plan-2', de: 7.83, a: 13.03 }])
  // sur une bande plus large, il court plus longtemps : sa vitesse ne change pas
  expect(Math.round(prepareNumero('chipe', ELEMENTS, 1520)!.duree * 100)).toBe(Math.round((19.46 + (2 * 760) / 150) * 100))
  // rien à chiper sur la bande : il ne le joue pas
  expect(prepareNumero('chipe', [])).toBeNull()
  expect(numerosJouables('repos', [])).toEqual(['tournee'])
  // pendant que Claude travaille, des intermèdes aussi (et l'inspection, rien qu'au travail)
  expect(numerosJouables('travail', [])).toEqual(['tournee'])
  expect(numerosJouables('travail', ELEMENTS)).toEqual(['chipe', 'tournee', 'bousculade', 'popcorn', 'echange', 'lilliput', 'geant', 'inspection'])
  // (au repos, la sieste en plus ; le funambule, lui, n'a pas de jauge assez loin du bord gauche)
  expect(numerosJouables('repos', ELEMENTS)).toEqual(['chipe', 'tournee', 'bousculade', 'popcorn', 'echange', 'lilliput', 'geant', 'sieste'])

  const n = { nom: 'chipe', cibles: prep.cibles, elements: ELEMENTS }
  const svg = svgNumero(n, TEINTES.opus)
  // aussi large que la bande, sans viewBox (1 unité = 1 px) ; il part de son coin, à sa taille ; tout le dessin suit
  // son décalage, à la racine (atelier le recale à chaque dessin sur son début : l'app recrée l'image en route)
  expect(svg).toContain(`<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="${HAUTEUR}" style="--t0:0s">`)
  expect(svg).toContain('animation-delay:var(--t0,0s)')
  expect(svg).toContain('calc(100% + -116px)')
  expect(svg).toContain('viewBox="-70 8 244 88"')
  // pas de cadres pointillés dans un vrai numéro : seul le cadre (l'outil de calage) en dessine
  expect(svg).not.toContain('class="repere"')
  expect(svg).toContain('cp-orbe')
  expect(svg).not.toContain('<text')
  // le même dessin d'un rendu à l'autre : le numéro ne redémarre jamais en route
  expect(svgNumero(n, TEINTES.opus)).toBe(svg)
  // sa couleur suit le modèle
  expect(svgNumero(n, TEINTES.haiku)).toContain('#9CB86A')
  // le cadre (pour vérifier la scène sur une capture) a sa règle graduée
  expect(svgNumero({ nom: 'cadre', elements: ELEMENTS }, TEINTES.opus)).toContain('>800</text>')
  // et la largeur de la bande, en cases et en px prévus, de sa plus petite à une case de plus (pour recaler CELLULE sur une capture)
  expect(svgNumero({ nom: 'cadre', elements: ELEMENTS, colonnes: 120 }, TEINTES.opus)).toContain('>120 colonnes · 906 à 914 px prévus</text>')
  expect(svgNumero({ nom: 'cadre', elements: ELEMENTS }, TEINTES.opus)).not.toContain('colonnes')
  expect(svgNumero({ nom: 'inconnu', elements: [] }, TEINTES.opus)).toBe(COIN_VIDE)
})

test('le petit et le géant : il rapetisse ou grandit au bout de la rangée, joue avec les pastilles, les rend et reprend sa taille', () => {
  const lil = prepareNumero('lilliput', ELEMENTS, LARGEUR)!
  const gea = prepareNumero('geant', ELEMENTS, LARGEUR)!
  // les dernières pastilles de la rangée (trois au plus pour le petit), et elles sont toutes rendues à leur place
  expect(lil.cibles.map(c => c.id)).toEqual(['build', 'tache-plan-1', 'tache-plan-2'])
  expect(gea.cibles.map(c => c.id)).toEqual(['build', 'tache-plan-1', 'tache-plan-2'])
  expect(lil.emprunts.map(e => e.id)).toEqual(['build', 'tache-plan-1', 'tache-plan-2'])
  expect(lil.duree).toBeGreaterThan(10)
  expect(lil.duree).toBeLessThan(MAX_DUREE)
  expect(gea.duree).toBeLessThan(MAX_DUREE)
  // une seule pastille : rien à faire sauter
  expect(prepareNumero('lilliput', ELEMENTS.slice(0, 2), LARGEUR)).toBeNull()
  expect(prepareNumero('geant', ELEMENTS.slice(0, 2), LARGEUR)).toBeNull()
  // le petit vaut deux tirages (il est plus souvent avec elles), le géant un
  expect(NUMEROS.lilliput!.poids).toBe(2)
  expect(NUMEROS.geant!.poids).toBeUndefined()
  // à la moitié de sa taille d'abord, puis le double pour l'autre ; reprise de taille normale à la fin
  const petit = svgNumero({ nom: 'lilliput', elements: ELEMENTS, cibles: lil.cibles }, TEINTES.opus)
  const grand = svgNumero({ nom: 'geant', elements: ELEMENTS, cibles: gea.cibles }, TEINTES.opus)
  expect(petit).toContain('scale(0.5)')
  expect(grand).toContain('scale(2)')
  expect(petit).not.toBe(COIN_VIDE)
  expect(grand).not.toBe(COIN_VIDE)
})

test('l’équipe : chaque mini court à la pastille de son sous-agent, dans sa couleur, la soulève, la rend et rentre dans sa case', () => {
  const agents: ElementBande[] = [
    ...ELEMENTS,
    { id: 'agent-a1', genre: 'agent', etat: 'encours', x: 70, largeur: 17, ligne: 0, teinte: '#9CB86A' },
    { id: 'agent-a2', genre: 'agent', etat: 'encours', x: 87, largeur: 17, ligne: 0, teinte: '#E2604A' },
  ]
  // sans sous-agent sur la bande, pas d'équipe
  expect(prepareNumero('equipe', ELEMENTS, LARGEUR)).toBeNull()
  const prep = prepareNumero('equipe', agents, LARGEUR)!
  expect(prep.cibles.map(c => c.id)).toEqual(['agent-a1', 'agent-a2'])
  // chacune rendue à sa place ; le numéro dure le temps du dernier mini rentré (lui l'attend dans son coin)
  expect(prep.emprunts.map(e => e.id)).toEqual(['agent-a1', 'agent-a2'])
  expect(prep.duree).toBeGreaterThan(8)
  expect(prep.duree).toBeLessThan(MAX_DUREE)
  expect(NUMEROS.equipe!.poids).toBe(2)
  // Clawd en Sonnet : deux minis, chacun sa boîte et ses pistes, à mi-taille, dans la couleur de son modèle (Haiku,
  // Fable), pas dans celle de Clawd
  const svg = svgNumero({ nom: 'equipe', elements: agents, cibles: prep.cibles }, TEINTES.sonnet)
  expect(svg).not.toContain('pos-equipe-m2')
  expect(svg).toContain('scale(0.5)')
  const boite = (cls: string) => {
    const i = svg.indexOf(`<g class="${cls}">`)
    expect(i).toBeGreaterThan(-1)
    return svg.slice(i, svg.indexOf('</svg>', i))
  }
  // (le corps de chacun : le groupe de son bond ; celui de sa position contient d'abord son ombre)
  const [lui, m0, m1] = ['arc-equipe', 'arc-equipe-m0', 'arc-equipe-m1'].map(boite)
  expect(lui).toContain(TEINTES.sonnet.O)
  expect(m0).toContain(TEINTES.haiku.O)
  expect(m0).not.toContain(TEINTES.sonnet.O)
  expect(m1).toContain(TEINTES.fable.O)
  expect(m1).not.toContain(TEINTES.sonnet.O)
  // au plus trois minis, les trois premiers, comme dans son coin
  const six: ElementBande[] = Array.from({ length: 6 }, (_, i) => ({ id: `agent-b${i}`, genre: 'agent', etat: 'encours', x: 20 * i, largeur: 17, ligne: 0 }))
  expect(prepareNumero('equipe', six, LARGEUR)!.cibles.map(c => c.id)).toEqual(['agent-b0', 'agent-b1', 'agent-b2'])
})

test('le moteur : deux acteurs ne touchent jamais la même pastille, et un mini qui ne rentre pas dans sa case annule le numéro', () => {
  const essai = (n: Numero) => {
    NUMEROS.essai = n
    try {
      return prepareNumero('essai', ELEMENTS, LARGEUR)
    } finally {
      delete NUMEROS.essai
    }
  }
  const base = { quand: 'demande' as const, cibles: (els: readonly ElementBande[]) => els.filter(e => e.ligne === 0) }
  const tape = { duree: 1, images: ['<g/>'], gestes: [{ n: 0, secoue: 1 }] }
  expect(essai({ ...base, pas: () => [{ duree: 1, images: ['<g/>'] }], copains: () => [{ place: 0, pas: [tape] }] })).not.toBeNull()
  expect(essai({ ...base, pas: () => [tape], copains: () => [{ place: 0, pas: [tape] }] })).toBeNull()
  expect(essai({ ...base, pas: () => [{ duree: 1, images: ['<g/>'] }], copains: () => [{ place: 0, pas: [{ duree: 1, images: ['<g/>'], a: { x: 10 } }] }] })).toBeNull()
  // chacun sa case, une vraie
  expect(essai({ ...base, pas: () => [{ duree: 1, images: ['<g/>'] }], copains: () => [{ place: 0, pas: [{ duree: 1, images: ['<g/>'] }] }, { place: 0, pas: [{ duree: 1, images: ['<g/>'] }] }] })).toBeNull()
  expect(essai({ ...base, pas: () => [{ duree: 1, images: ['<g/>'] }], copains: () => [{ place: Number.NaN, pas: [{ duree: 1, images: ['<g/>'] }] }] })).toBeNull()
  // un mini ne porte rien
  expect(essai({ ...base, pas: () => [{ duree: 1, images: ['<g/>'] }], copains: () => [{ place: 0, pas: [{ duree: 1, images: ['<g/>'], objet: 'tenu' }] }] })).toBeNull()
})

test('la fluidité : élan, freinage et demi-tour s’insèrent d’eux-mêmes entre ses trajets ; ses pattes suivent sa vitesse', () => {
  const essai = (n: Numero, opts?: Parameters<typeof prepareNumero>[4]) => {
    NUMEROS.essai = n
    try {
      return prepareNumero('essai', [], LARGEUR, 0, opts)
    } finally {
      delete NUMEROS.essai
    }
  }
  const g = ['<g/>']
  // aller à gauche puis revenir aussitôt : élan (1 image), demi-tour (3), freinage (1), à 0,09 s l'image
  const allerRetour = essai({ quand: 'demande', pas: () => [{ duree: 1, images: g, de: { coin: 0 } }, { duree: 2, images: g, a: { x: 100 } }, { duree: 2, images: g, a: { coin: 0 } }, { duree: 1, images: g }] })!
  expect(allerRetour.duree).toBe(6.45)
  // un bond n'est pas un trajet à pied : rien d'inséré
  expect(essai({ quand: 'demande', pas: () => [{ duree: 1, images: g, de: { coin: 0 } }, { duree: 2, images: g, a: { x: 100 }, saut: 10 }, { duree: 2, images: g, a: { coin: 0 }, saut: 10 }] })!.duree).toBe(5)
  // deux trajets dans le même sens se suivent sans freinage entre eux
  // (et il revient d'un bond)
  expect(essai({ quand: 'demande', pas: () => [{ duree: 1, images: g, de: { coin: 0 } }, { duree: 1, images: g, a: { x: 300 } }, { duree: 1, images: g, a: { x: 100 } }, { duree: 1, images: g, a: { coin: 0 }, saut: 10 }] })!.duree).toBe(4.18)
  // un mini qui trottine lentement sous sa pastille : ses pattes ralentissent (sa propre cadence), pas celles d'office
  const agents: ElementBande[] = [...ELEMENTS, { id: 'agent-a1', genre: 'agent', etat: 'encours', x: 70, largeur: 17, ligne: 0, teinte: '#9CB86A' }]
  const svg = svgNumero({ nom: 'equipe', elements: agents, cibles: prepareNumero('equipe', agents, LARGEUR)!.cibles }, TEINTES.opus)
  expect(/class="vite cad-\d+"/.test(svg)).toBe(true)
  expect(/\.cad-\d+ \.pA,\.cad-\d+ \.pB\{animation-duration:[\d.]+s\}/.test(svg)).toBe(true)
})

test('les variantes : tirées au sort au lancement, le même dessin pour la même variante, des pas différents d’une partie à l’autre', () => {
  const simple = prepareNumero('tournee', [], LARGEUR, 0, { variante: 0 })!
  const double = prepareNumero('tournee', [], LARGEUR, 0, { variante: 0.5 })!
  const joie = prepareNumero('tournee', [], LARGEUR, 0, { variante: 0.9 })!
  expect(new Set([simple.duree, double.duree, joie.duree]).size).toBe(3)
  const a = svgNumero({ nom: 'tournee', elements: [], variante: 0.5 }, TEINTES.opus)
  expect(svgNumero({ nom: 'tournee', elements: [], variante: 0.5 }, TEINTES.opus)).toBe(a)
  expect(a).toContain('rotate(720deg)')
  expect(svgNumero({ nom: 'tournee', elements: [], variante: 0 }, TEINTES.opus)).not.toContain('rotate(720deg)')
  // chaque numéro à variantes se joue quelle que soit la variante
  for (const nom of ['chipe', 'tournee', 'popcorn', 'lilliput', 'geant'])
    for (const variante of [0, 0.15, 0.35, 0.55, 0.75, 0.95]) expect(prepareNumero(nom, ELEMENTS, LARGEUR, 0, { variante })).not.toBeNull()
})

test('ses réactions : il vise ce qui vient de changer (une étape faite, un build raté, un quota rouge, un sous-agent fini), et rien d’autre', () => {
  const bande: ElementBande[] = [
    { id: 'jauge-5h', genre: 'jauge', etat: 'critique', x: 0, largeur: 108, ligne: 1 },
    { id: 'build', genre: 'build', etat: 'echec', x: 0, largeur: 17, ligne: 0 },
    { id: 'tache-plan-1', genre: 'tache', etat: 'faite', x: 27, largeur: 17, ligne: 0 },
    { id: 'tache-plan-2', genre: 'tache', etat: 'faite', x: 44, largeur: 17, ligne: 0 },
    { id: 'agent-a1', genre: 'agent', etat: 'faite', x: 70, largeur: 17, ligne: 0, teinte: '#E2604A' },
  ]
  expect(prepareNumero('bravo', bande, LARGEUR, 0, { vise: 'tache-plan-2' })!.cibles.map(c => c.id)).toEqual(['tache-plan-2'])
  // à la demande, sans rien de visé : la première qui convient
  expect(prepareNumero('bravo', bande, LARGEUR)!.cibles.map(c => c.id)).toEqual(['tache-plan-1'])
  // ce qu'il venait voir n'est plus comme ça : il n'y va pas
  expect(prepareNumero('bravo', bande, LARGEUR, 0, { vise: 'build' })).toBeNull()
  expect(prepareNumero('repare', bande, LARGEUR, 0, { vise: 'build' })!.cibles.map(c => c.id)).toEqual(['build'])
  expect(prepareNumero('retient', bande, LARGEUR, 0, { vise: 'jauge-5h' })!.cibles.map(c => c.id)).toEqual(['jauge-5h'])
  const ctl = prepareNumero('controle', bande, LARGEUR, 0, { vise: 'agent-a1' })!
  expect(ctl.emprunts.map(e => e.id)).toEqual(['agent-a1'])
  // jamais de lui-même au hasard : ce sont des réactions
  for (const nom of ['bravo', 'repare', 'retient', 'controle']) expect(NUMEROS[nom]!.quand).toBe('demande')
})

test('ses minis : les autres le regardent depuis leurs cases ; saute-mouton, pyramide et passe se jouent à plusieurs', () => {
  // un numéro sans minis, joué pendant que deux sous-agents travaillent : leurs minis restent là, dans leurs couleurs
  const t = svgNumero({ nom: 'tournee', elements: [], figurants: [TEINTES.haiku.O, null] }, TEINTES.opus)
  expect(t).toContain('class="pos-tournee-m0"')
  expect(t).toContain('class="pos-tournee-m1"')
  expect(t).toContain(TEINTES.haiku.O)
  const agents = (n: number): ElementBande[] =>
    Array.from({ length: n }, (_, i) => ({ id: `agent-a${i}`, genre: 'agent', etat: 'encours', x: 30 + 17 * i, largeur: 17, ligne: 0, teinte: [TEINTES.haiku.O, TEINTES.sonnet.O, TEINTES.fable.O][i] }))
  expect(prepareNumero('mouton', agents(1), LARGEUR)).toBeNull()
  expect(prepareNumero('mouton', agents(2), LARGEUR)).not.toBeNull()
  expect(prepareNumero('passe', agents(2), LARGEUR)!.emprunts.map(e => e.id)).toEqual(['agent-a0'])
  expect(prepareNumero('pyramide', agents(2), LARGEUR)).toBeNull()
  expect(prepareNumero('pyramide', agents(3), LARGEUR)).not.toBeNull()
  // la passe à deux pendant qu'un troisième regarde depuis sa case
  const p = svgNumero({ nom: 'passe', elements: agents(3), cibles: prepareNumero('passe', agents(3), LARGEUR)!.cibles, figurants: [null, null, null] }, TEINTES.opus)
  expect(p).toContain('class="pos-passe-m2"')
  // chaque mini va à SA pastille : ici, le mini de la première case est celui du sous-agent a1 (la 2e pastille)
  const croise = svgNumero({ nom: 'equipe', elements: agents(2), cibles: prepareNumero('equipe', agents(2), LARGEUR, 0, { minis: ['a1', 'a0'] })!.cibles, minis: ['a1', 'a0'] }, TEINTES.opus)
  const corpsDe = (cls: string) => croise.slice(croise.indexOf(`<g class="${cls}">`), croise.indexOf('</svg>', croise.indexOf(`<g class="${cls}">`)))
  expect(corpsDe('arc-equipe-m0')).toContain(TEINTES.sonnet.O)
  expect(corpsDe('arc-equipe-m1')).toContain(TEINTES.haiku.O)
  // un mini sans pastille au travail (son sous-agent pas encore publié par atelier) : on ne joue qu'avec les autres
  expect(prepareNumero('equipe', agents(2), LARGEUR, 0, { minis: ['zz', 'a1'] })!.cibles.map(c => c.id)).toEqual(['agent-a1'])
  // un sous-agent fini n'a plus de mini : pas de jeu pour lui
  expect(prepareNumero('equipe', agents(1).map(a => ({ ...a, etat: 'faite' })), LARGEUR)).toBeNull()
  // ils ne sont tirés qu'à part, quand ses minis sont là
  expect(numerosJouables('travail', agents(3))).not.toContain('mouton')
  expect(numerosAvecMinis(agents(3), LARGEUR)).toEqual(['equipe', 'mouton', 'pyramide', 'passe'])
})

test('le poids : avec trois minis, leurs figurants et des dessins d’atelier réalistes, chaque numéro reste sous la limite du moteur', () => {
  // ~4 Ko par dessin d'atelier, comme une jauge avec son style
  const dessin = (w: number) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 18">${'<rect x="1" y="1" width="1" height="1"/>'.repeat(100)}</svg>`
  const bande: ElementBande[] = [
    { id: 'jauge-5h', genre: 'jauge', etat: 'critique', x: 0, largeur: 157, ligne: 1 },
    { id: 'jauge-7j', genre: 'jauge', etat: 'ok', x: 171, largeur: 108, ligne: 1 },
    { id: 'build', genre: 'build', etat: 'echec', x: 0, largeur: 17, ligne: 0 },
    { id: 'tache-plan-1', genre: 'tache', etat: 'faite', x: 27, largeur: 17, ligne: 0 },
    ...[0, 1, 2].map((i): ElementBande => ({ id: `agent-a${i}`, genre: 'agent', etat: 'encours', x: 54 + 17 * i, largeur: 17, ligne: 0, teinte: [TEINTES.haiku.O, TEINTES.sonnet.O, TEINTES.fable.O][i] })),
  ].map(e => ({ ...e, dessin: dessin(e.largeur) }))
  const figurants = [TEINTES.haiku.O, TEINTES.sonnet.O, TEINTES.fable.O]
  for (const nom of Object.keys(NUMEROS).filter(n => n !== 'cadre')) {
    for (const variante of [0, 0.55, 0.95]) {
      const prep = prepareNumero(nom, bande, LARGEUR, 0, { variante, figurants })
      if (!prep) continue
      const svg = svgNumero({ nom, elements: bande, cibles: prep.cibles, largeur: LARGEUR, variante, figurants }, TEINTES.opus)
      expect(svg.length).toBeLessThan(MAX_SVG)
      // et pas un mot : lui ne parle pas
      expect(svg).not.toContain('<text')
    }
  }
})

test('il réagit en direct : une étape qui passe à « faite » sur la bande, il court la féliciter', async ($, on) => {
  const bande = { elements: ELEMENTS.map(e => ({ ...e })) }
  const { horloge, dernier } = moteur(on, bande)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await $.session.start(SESSION)
  // un premier coup d'œil : il note ce qu'il voit
  await horloge.advance(4000)
  bande.elements = bande.elements.map(e => (e.id === 'tache-plan-2' ? { ...e, etat: 'faite' } : e))
  // il le remarque au coup d'œil suivant, même en pleine activité, et y va dès qu'il est libre (au plus 40 s plus tard)
  let n: { nom: string; vise?: string } | undefined
  for (let i = 0; i < 10 && !n; i++) {
    await horloge.advance(4000)
    n = dernier('numero') as typeof n
  }
  expect(n?.nom).toBe('bravo')
  expect(n?.vise).toBe('tache-plan-2')
  await ui.unmount()
})

test('/clawd montre bande : il prend l’orbe (atelier ne la dessine plus), la rend, et publie son dessin pour qu’atelier le pose', async ($, on) => {
  const { horloge, dernier, tenus } = moteur(on)
  // la bande se dessine sur desktop : la grande scène peut s'y voir
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const r = await $.command.run({ command: 'clawd', args: 'montre chipe', origin: COMPOSER })
  expect(r.text).toContain('« chipe »')
  // son coin reste vide (la bande ne bouge pas)
  expect((await dessinDe(ui as never, 'clawd'))?.source).toBe(COIN_VIDE)
  // son dessin est publié une fois pour toutes : c'est atelier (qui dessine la bande) qui le pose, pas lui
  const gs = dernier('grandeScene') as { svg: string; hauteur: number; debut: number; fin: number }
  expect(gs.svg).toContain('cp-orbe')
  expect(gs.hauteur).toBe(HAUTEUR)
  // son début, pour qu'atelier recale son dessin à chaque fois qu'il le pose
  expect(gs.debut).toBe(MAINTENANT)
  // (sa variante, tirée au lancement, est gardée avec le numéro : ses pas en dépendent)
  const { variante } = dernier('numero') as { variante: number }
  expect(variante).toBeGreaterThanOrEqual(0)
  const prep = prepareNumero('chipe', ELEMENTS, LARGEUR, 0, { variante })!
  const [e] = prep.emprunts
  // son dessin reste un peu après la fin du numéro, au repos : l'animation, partie en retard, finit sans être coupée
  const fin = MAINTENANT + (prep.duree + RETENUE) * 1000
  expect(gs.fin).toBe(fin)
  expect(await ui.find({ key: 'grande-scene' })).toBeUndefined()
  // il prend l'orbe dès que son dessin est là, bien avant de la toucher (sa copie, au repos dessus, la remplace : un
  // texte et sa copie l'un sur l'autre s'épaississaient) ; atelier ne la dessine plus, jusqu'à la fin du dessin au plus
  expect(e!.de - MARGE).toBeGreaterThan(MARGE)
  await horloge.set(MAINTENANT + MARGE * 1000 - 50)
  expect(tenus()).toEqual([])
  await horloge.set(MAINTENANT + MARGE * 1000)
  expect(tenus()).toEqual(['tache-plan-2'])
  expect(dernier('emprunts')).toEqual([{ id: 'tache-plan-2', jusqua: fin + 2000, numero: expect.any(Number) }])
  // remise à sa place, elle reste dessinée par lui (au repos) jusqu'à la fin du dessin : l'original ne revient jamais sous une copie qui bouge
  await horloge.set(MAINTENANT + (e!.a + MARGE) * 1000 + 100)
  expect(tenus()).toEqual(['tache-plan-2'])
  await horloge.set(MAINTENANT + prep.duree * 1000 + 100)
  expect(tenus()).toEqual(['tache-plan-2'])
  // il est rentré dans son coin, son dessin n'est plus publié, et atelier redessine l'original au même instant
  await horloge.set(fin)
  expect(tenus()).toEqual([])
  expect(dernier('grandeScene')).toBeNull()
  expect((await dessinDe(ui as never, 'clawd'))?.source).not.toBe(COIN_VIDE)
  await ui.unmount()
})

test('🎲 en plein numéro : il rend tout de suite ce qu’il tenait, et rien ne le reprend après', async ($, on) => {
  const { horloge, dernier, tenus } = moteur(on)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await $.command.run({ command: 'clawd', args: 'montre chipe', origin: COMPOSER })
  const prep = prepareNumero('chipe', ELEMENTS, LARGEUR)!
  await horloge.advance(prep.emprunts[0]!.de * 1000 + 1000)
  expect(tenus()).toEqual(['tache-plan-2'])
  await ui.press({ key: 'occupe' })
  expect(tenus()).toEqual([])
  expect(dernier('grandeScene')).toBeNull()
  await horloge.advance(prep.duree * 1000)
  expect(tenus()).toEqual([])
  // 🎲 avant même qu'il l'ait prise : il ne la prend plus
  await $.command.run({ command: 'clawd', args: 'montre chipe', origin: COMPOSER })
  await horloge.advance(2_000)
  await ui.press({ key: 'occupe' })
  await horloge.advance(prep.duree * 1000)
  expect(tenus()).toEqual([])
  await ui.unmount()
})

test('sans atelier qui dessine, il pose lui-même son numéro ; un rechargement en plein numéro l’arrête', async ($, on) => {
  const { horloge, dernier, tenus } = moteur(on, null)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  // pas d'atelier : rien à chiper, il fait le tour de la bande, et le pose lui-même par-dessus
  const r = await $.command.run({ command: 'clawd', args: 'montre bande', origin: COMPOSER })
  expect(r.text).toContain('« tournee »')
  const grande = (await ui.find({ key: 'grande-scene' })) as Noeud
  expect(grande.props).toMatchObject({ position: 'absolute', left: 0, right: 0, bottom: 0 })
  const dessin = (await dessinDe(ui as never, 'grande-scene'))!
  expect(dessin.height).toBe(HAUTEUR)
  // à la largeur de la bande en px (120 cases, une de plus : l'app compte les cases entières), pour que le dessin la couvre à l'échelle 1
  expect(dessin.width).toBe(914)
  // un deuxième numéro pendant le premier : non
  const encore = await $.command.run({ command: 'clawd', args: 'montre cadre', origin: COMPOSER })
  expect(encore.text).toContain('Il finit d’abord ce qu’il fait')
  await horloge.advance(3_000)
  // le module se recharge (session.start revient) : le numéro laissé en plan s'arrête
  await $.session.start(SESSION)
  expect(await ui.find({ key: 'grande-scene' })).toBeUndefined()
  expect(dernier('grandeScene')).toBeNull()
  expect(tenus()).toEqual([])
  await ui.unmount()
})

test('sur le terminal, pas de grande scène : il le dit au lieu de jouer dans le vide', async ($, on) => {
  const { dernier } = moteur(on)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const r = await $.command.run({ command: 'clawd', args: 'montre bande', origin: COMPOSER })
  expect(r.text).toContain('app de bureau')
  expect(dernier('numero')).toBeUndefined()
  await ui.unmount()
})

test('le moteur : il remet tout en place, vise ce qui est là, et ne dépasse pas la minute', () => {
  const essai = (n: Numero) => {
    NUMEROS.essai = n
    try {
      return prepareNumero('essai', ELEMENTS)
    } finally {
      delete NUMEROS.essai
    }
  }
  const bas = (els: readonly ElementBande[]) => els.filter(e => e.ligne === 0)
  const f = (n: number) => ({ duree: 1, images: ['<g/>'], gestes: [{ n, dx: 10 }] })
  // poussée puis ramenée : jouable, empruntée le temps des deux pas
  expect(essai({ quand: 'demande', cibles: bas, pas: () => [f(0), { duree: 1, images: ['<g/>'], gestes: [{ n: 0, dx: 0 }] }] })?.emprunts).toEqual([{ id: 'build', de: 0, a: 2 }])
  // laissée ailleurs qu'à sa place : il ne le joue pas
  expect(essai({ quand: 'demande', cibles: bas, pas: () => [f(0)] })).toBeNull()
  // un tour complet sur elle-même la laisse à sa place
  expect(essai({ quand: 'demande', cibles: bas, pas: () => [{ duree: 1, images: ['<g/>'], gestes: [{ rot: 360 }] }] })).not.toBeNull()
  // une cible qu'il n'a pas
  expect(essai({ quand: 'demande', cibles: bas, pas: () => [f(7)] })).toBeNull()
  expect(essai({ quand: 'demande', cibles: bas, pas: () => [{ duree: 1, images: ['<g/>'], a: { cible: 0, n: 9 } }] })).toBeNull()
  // trop long : ce qu'il emprunte resterait caché trop longtemps
  expect(essai({ quand: 'demande', pas: () => [{ duree: MAX_DUREE + 1, images: ['<g/>'] }] })).toBeNull()
  expect(essai({ quand: 'demande', pas: () => [{ duree: MAX_DUREE, images: ['<g/>'] }] })).not.toBeNull()
  // un numéro qui plante en préparant ses pas ne se joue pas (il ne fait pas tomber le reste)
  expect(essai({ quand: 'demande', pas: () => { throw new Error('oups') } })).toBeNull()
})

test('les copies : le dessin d’atelier à l’identique, ses styles isolés, un dessin douteux écarté', () => {
  const dessin = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 17 18"><style>.piste{fill:red}.t:hover .zone{fill:#fff}@keyframes pulse{50%{opacity:.45}}.pulse{animation:pulse 1.2s}</style><circle class="piste pulse" cx="8" cy="9" r="5"/></svg>'
  const els: ElementBande[] = ELEMENTS.map(e => (e.id === 'tache-plan-1' ? { ...e, dessin } : e))
  const prep = prepareNumero('popcorn', els)!
  expect(prep.cibles.map(c => c.id)).toEqual(['build', 'tache-plan-1', 'tache-plan-2'])
  const svg = svgNumero({ nom: 'popcorn', elements: els, cibles: prep.cibles }, TEINTES.opus)
  // ses classes et ses animations préfixées : elles ne se mêlent ni aux siennes, ni à celles d'un autre dessin
  expect(svg).toContain('.popcorn-e1-piste{fill:red}')
  expect(svg).toContain('.popcorn-e1-t:hover .popcorn-e1-zone{fill:#fff}')
  expect(svg).toContain('@keyframes popcorn-e1-pulse{50%{opacity:.45}}')
  expect(svg).toContain('animation:popcorn-e1-pulse 1.2s')
  expect(svg).toContain('class="popcorn-e1-piste popcorn-e1-pulse"')
  expect(svg).not.toContain('class="piste')
  // posé à la place de l'original, à sa taille (ses propres x, y, largeur, hauteur ne doublent pas les nôtres)
  expect(svg).toContain('<svg x="27" y="')
  const avecTaille = els.map(e => (e.id === 'tache-plan-1' ? { ...e, dessin: dessin.replace('<svg ', '<svg width="17" height="18" x="3" ') } : e))
  const s2 = svgNumero({ nom: 'popcorn', elements: avecTaille, cibles: prepareNumero('popcorn', avecTaille)!.cibles }, TEINTES.opus)
  expect(s2).toContain('<svg x="27" y="45.5" width="17" height="18" overflow="visible" xmlns=')
  // sa rangée publiée par atelier (ses rangées n'ont pas toutes la même hauteur) : la copie est centrée dessus, pas au pas fixe
  const rangee = avecTaille.map(e => (e.id === 'tache-plan-1' ? { ...e, hauteur: 17, bas: 1, rangee: 16 } : e))
  const s3 = svgNumero({ nom: 'popcorn', elements: rangee, cibles: prepareNumero('popcorn', rangee)!.cibles }, TEINTES.opus)
  expect(s3).toContain('<svg x="27" y="46.5" width="17" height="17" overflow="visible" xmlns=')
  // les copies gardent leurs couleurs quand Clawd prend celle de son modèle : un sous-agent Opus reste terracotta
  const opus: ElementBande[] = ELEMENTS.map(e => (e.id === 'tache-plan-1' ? { ...e, dessin: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 17 18"><circle cx="8" cy="9" r="6" fill="#D97758"/></svg>' } : e))
  const enHaiku = svgNumero({ nom: 'popcorn', elements: opus, cibles: prepareNumero('popcorn', opus)!.cibles }, TEINTES.haiku)
  expect(enHaiku).toContain('<circle cx="8" cy="9" r="6" fill="#D97758"/>')
  expect(enHaiku).toContain('#9CB86A')
  // un dessin avec un script, un lien, un gestionnaire d'évènement : il dessine le sien
  for (const douteux of ['<svg><script>alert(1)</script></svg>', '<svg><image href="https://x.y/z.png"/></svg>', '<svg onload="x()"></svg>']) {
    const s = svgNumero({ nom: 'popcorn', elements: els, cibles: prep.cibles.map(c => (c.id === 'build' ? { ...c, dessin: douteux } : c)) }, TEINTES.opus)
    expect(s).not.toContain('alert(1)')
    expect(s).not.toContain('https://x.y')
    expect(s).not.toContain('onload')
  }
})

test('la physique : il retombe en chute libre, son ombre reste au sol, un salto tourne autour de lui', () => {
  const prep = prepareNumero('tournee', ELEMENTS)!
  const svg = svgNumero({ nom: 'tournee', elements: ELEMENTS, cibles: prep.cibles }, TEINTES.opus)
  // le bond : ralentit en montant, accélère en descendant (les quadratiques exactes)
  const bond = /@keyframes arc-tournee\{(.*?)\}(?=[.@<])/.exec(svg)?.[1] ?? ''
  expect(bond).toContain('translateY(-30px);animation-timing-function:cubic-bezier(.55,.085,.68,.53)')
  expect(bond).toContain('translateY(0px);animation-timing-function:cubic-bezier(.25,.46,.45,.94)')
  // son ombre ne monte pas avec lui : elle rétrécit
  expect(svg).toContain('class="ot-tournee"')
  expect(/@keyframes oa-tournee\{.*scaleX\(0\.35\)/.test(svg)).toBe(true)
  // ses pistes ont leur origine à ses pieds ; le salto tourne autour du milieu de son corps
  expect(svg).toContain('.tr-tournee,.ot-tournee,.oa-tournee{transform-box:view-box;transform-origin:76px 64px}')
  expect(svg).toContain('translateY(-12px) rotate(360deg) translateY(12px)')
  // après le salto, l'angle repart de 0 d'un coup (tenu à 360 jusque-là) : il ne refait pas un tour à l'envers
  expect(/rotate\(360deg\) translateY\(12px\);animation-timing-function:steps\(1,end\)\}[\d.]+%\{transform:scale\(1\) translateY\(-12px\) rotate\(0deg\)/.test(svg)).toBe(true)
  // son ombre est dessinée à part, au sol : pas dans ses images (même une image qui porte la sienne)
  expect((svg.match(/class="ombre/g) ?? []).length).toBe(1)
  NUMEROS.essai = { quand: 'demande', pas: () => [{ duree: 1, images: ['<g><rect class="ombre ombre-saut" x="80" y="94" width="20" height="2"/><rect x="1" y="1" width="2" height="2"/></g>'] }] }
  try {
    const s = svgNumero({ nom: 'essai', elements: [] }, TEINTES.opus)
    expect((s.match(/class="ombre/g) ?? []).length).toBe(1)
    expect(s).toContain('<rect x="1" y="1" width="2" height="2"/>')
  } finally {
    delete NUMEROS.essai
  }
})

test('/clawd montre bousculade : il emprunte d’un coup tout ce qu’il va bousculer, dès que son dessin est là, et rend tout à la fin', async ($, on) => {
  const { horloge, dernier, tenus } = moteur(on)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const r = await $.command.run({ command: 'clawd', args: 'montre bousculade', origin: COMPOSER })
  expect(r.text).toContain('bousculade')
  const prep = prepareNumero('bousculade', ELEMENTS, LARGEUR)!
  expect(prep.cibles.map(c => c.id)).toEqual(['jauge-5h', 'build', 'tache-plan-1', 'tache-plan-2'])
  // rien avant que son dessin soit là, puis tout à la fois : ses copies, au repos sur les originaux, les remplacent
  expect(tenus()).toEqual([])
  await horloge.set(MAINTENANT + MARGE * 1000 + 10)
  expect(tenus().sort()).toEqual(['build', 'jauge-5h', 'tache-plan-1', 'tache-plan-2'])
  // et jusqu'au bout du dessin (au repos, elles restent les siennes)
  await horloge.set(MAINTENANT + prep.duree * 1000)
  expect(tenus().sort()).toEqual(['build', 'jauge-5h', 'tache-plan-1', 'tache-plan-2'])
  // à la fin du dessin, rien n'est resté caché, et son dessin n'est plus publié
  await horloge.set(MAINTENANT + (prep.duree + RETENUE) * 1000 + 50)
  expect(tenus()).toEqual([])
  expect(dernier('grandeScene')).toBeNull()
  await ui.unmount()
})

test('/clawd montre popcorn : toutes les pastilles prises dès que son dessin est là, rendues ensemble à la fin du dessin', async ($, on) => {
  const { horloge, tenus } = moteur(on)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await $.command.run({ command: 'clawd', args: 'montre popcorn', origin: COMPOSER })
  const prep = prepareNumero('popcorn', ELEMENTS, LARGEUR)!
  const [a, b, c] = prep.emprunts
  // toutes à la fois, dès que son dessin est là (pas une à une : un original et sa copie l'un sur l'autre se voient)
  await horloge.set(MAINTENANT + MARGE * 1000 - 10)
  expect(tenus()).toEqual([])
  await horloge.set(MAINTENANT + MARGE * 1000 + 10)
  expect(tenus().sort()).toEqual([a!.id, b!.id, c!.id].sort())
  // retombées, elles restent dessinées par lui, au repos, jusqu'à la fin du dessin
  await horloge.set(MAINTENANT + prep.duree * 1000)
  expect(tenus().sort()).toEqual([a!.id, b!.id, c!.id].sort())
  await horloge.set(MAINTENANT + (prep.duree + RETENUE) * 1000)
  expect(tenus()).toEqual([])
  await ui.unmount()
})

test('un numéro trop lourd pour le moteur : il ne le joue pas, et ne réessaie pas en boucle', async ($, on) => {
  // des dessins d'atelier valides mais énormes (19 Ko chacun) : la bousculade les promènerait tous, en double
  const gros = (w: number) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 18">${'<rect x="1" y="1" width="1" height="1"/>'.repeat(480)}</svg>`
  const lourds = ELEMENTS.map(e => ({ ...e, dessin: gros(e.largeur) }))
  expect(lourds[0]!.dessin!.length).toBeLessThan(20_000)
  const { dernier } = moteur(on, { elements: lourds })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const r = await $.command.run({ command: 'clawd', args: 'montre bousculade', origin: COMPOSER })
  expect(r.text).toContain('trop lourd')
  expect(dernier('grandeScene')).toBeUndefined()
  expect(dernier('numero')).toBeUndefined()
  await ui.unmount()
})

test('/clawd montre : il dit pourquoi un numéro ne se joue pas, et ce qui se joue à la place', async ($, on) => {
  // rien que les quotas, sans pastille (la bande habituelle) : la bousculade s'y adapte, pas le pop-corn
  const quotas: ElementBande[] = [
    { id: 'jauge-5h', genre: 'jauge', etat: 'ok', x: 0, largeur: 108, ligne: 0 },
    { id: 'conso', genre: 'conso', etat: 'ok', x: 122, largeur: 92, ligne: 0 },
  ]
  const { horloge, dernier } = moteur(on, { elements: quotas })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const r = await $.command.run({ command: 'clawd', args: 'montre popcorn', origin: COMPOSER })
  expect(r.text).toContain('Rien à viser pour « popcorn »')
  expect(r.text).toContain('au moins deux pastilles')
  expect(r.text).toContain('Jouables maintenant : tournee, bousculade, inspection.')
  // la bousculade, d'un coup d'épaule dans la conso (à sa hauteur), qu'il saute ensuite
  const b = await $.command.run({ command: 'clawd', args: 'montre bousculade', origin: COMPOSER })
  expect(b.text).toContain('« bousculade »')
  expect(prepareNumero('bousculade', quotas, LARGEUR)!.cibles.map(c => c.id)).toEqual(['conso'])
  // pendant ce temps, un autre : il le dit
  const encore = await $.command.run({ command: 'clawd', args: 'montre tournee', origin: COMPOSER })
  expect(encore.text).toContain('Il finit d’abord ce qu’il fait')
  await horloge.advance(60_000)
  expect(dernier('grandeScene')).toBeNull()
  await ui.unmount()
})

test('/clawd voit : ce qu’il voit de la bande, et pourquoi chaque numéro se joue ou non', async ($, on) => {
  moteur(on)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const r = (await $.command.run({ command: 'clawd', args: 'voit', origin: COMPOSER })).text ?? ''
  expect(r).toContain('largeur 906 px')
  expect(r).toContain('· jauge-5h (ok) ligne 1, x 0, 108 px')
  expect(r).toContain('· chipe : jouable')
  expect(r).toContain('· echange : jouable')
  expect(r).toContain('Aucun numéro en cours')
  await ui.unmount()
})

test('/clawd voit et /clawd montre : le bandeau d’atelier masqué, il le dit, et comment le ré-afficher', async ($, on) => {
  // masqué, atelier publie une bande vide (il est là, rien n’est à viser)
  moteur(on, { lignes: [], elements: [] } as never, undefined, true)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await $.command.run({ command: 'clawd', args: 'voit', origin: COMPOSER })).text).toContain('masqué : tape /atelier')
  expect((await $.command.run({ command: 'clawd', args: 'montre bousculade', origin: COMPOSER })).text).toContain('le bandeau d’atelier est masqué. Tape /atelier')
  await ui.unmount()
})

test('tu lui parles en plein numéro : il ne le coupe pas, le finit et rend tout, puis te répond', async ($, on) => {
  const { horloge, dernier, tenus } = moteur(on)
  on('prompt.submit', ($, e) => ({ text: e.text }))
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await $.command.run({ command: 'clawd', args: 'montre bousculade', origin: COMPOSER })
  const prep = prepareNumero('bousculade', ELEMENTS, LARGEUR)!
  await horloge.set(MAINTENANT + (prep.emprunts[0]!.de + 0.5) * 1000)
  const tenusAvant = tenus().slice().sort()
  expect(tenusAvant.length).toBeGreaterThan(0)
  await $.prompt.submit({ text: 'tu fais quoi là ?' })
  // une action ne se coupe jamais : le numéro continue, ce qu'il tient aussi
  expect(dernier('numero')).not.toBeNull()
  expect(tenus().slice().sort()).toEqual(tenusAvant)
  // à la fin du numéro tout est rendu
  await horloge.set(MAINTENANT + (prep.duree + RETENUE) * 1000 + 100)
  expect(tenus()).toEqual([])
  expect(dernier('numero')).toBeNull()
  await ui.unmount()
})

test('chipe : la pastille s’ouvre en deux quand elle apparaît dans ses pinces, pas dès le chargement du dessin', () => {
  const prep = prepareNumero('chipe', ELEMENTS, LARGEUR)
  if (!prep) return
  const svg = svgNumero({ nom: 'chipe', cibles: prep.cibles, elements: ELEMENTS }, TEINTES.opus)
  const delais = [...svg.matchAll(/class="cp-haut" style="animation-delay:calc\(var\(--t0,0s\) \+ ([\d.]+)s\)"/g)].map(m => Number(m[1]))
  expect(delais.length).toBeGreaterThan(0)
  for (const d of delais) expect(d).toBeGreaterThan(1)
})

test('bousculade d’un quota collé au bord gauche : il ne saute pas hors du dessin', () => {
  const seul: ElementBande[] = [{ id: 'jauge-ctx', genre: 'jauge', etat: 'ok', x: 0, largeur: 60, ligne: 0 }]
  const loin: ElementBande[] = [{ id: 'jauge-ctx', genre: 'jauge', etat: 'ok', x: 200, largeur: 60, ligne: 0 }]
  const a = prepareNumero('bousculade', seul, LARGEUR)
  const b = prepareNumero('bousculade', loin, LARGEUR)
  expect(a).not.toBeNull()
  expect(b).not.toBeNull()
  // collé au bord, il ne fait pas le saut par-dessus (plus court) ; avec de la place, il le fait
  expect(a!.duree).toBeLessThan(b!.duree)
})

test('/clawd voit : atelier chargé, bande vide (rien à montrer) : il le dit, sans parler de bandeau masqué', async ($, on) => {
  moteur(on, { lignes: [], elements: [] } as never)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const t = (await $.command.run({ command: 'clawd', args: 'voit', origin: COMPOSER })).text ?? ''
  expect(t).toContain('La bande d’atelier est vide')
  expect(t).not.toContain('masqué')
  await ui.unmount()
})

/** La bande quand continuer coûte trop : la jauge du contexte, et le bouton 🆕 (sans git, au bout des jauges) */
const AVEC_BOUTON: ElementBande[] = [
  ...ELEMENTS,
  { id: 'jauge-contexte', genre: 'jauge', etat: 'critique', x: 118, largeur: 108, ligne: 1 },
  { id: 'nouvelle', genre: 'bouton', etat: 'a-montrer', x: 234, largeur: 111, ligne: 1 },
]

test('fin de numéro : ce qui est visible au bout le reste pendant la RETENUE (Clawd à son coin, copies sur les originaux) ; son déguisement le suit', () => {
  const prep = prepareNumero('rappel', AVEC_BOUTON, LARGEUR)!
  const svg = svgNumero({ nom: 'rappel', cibles: prep.cibles, elements: AVEC_BOUTON }, TEINTES.opus)
  // chaque fenêtre qui touche la fin a son image clé à 100 % visible (sinon le navigateur la prend à opacity:0, et `both` la garde)
  const fenetres = svg
    .split('@keyframes ')
    .filter(k => k.startsWith('v-rappel-'))
    .map(k => k.slice(0, k.indexOf('}}') + 2))
  expect(fenetres.length).toBeGreaterThan(0)
  expect(fenetres.some(k => k.includes('100%{opacity:1}'))).toBe(true)
  // vendredi soir, ses lunettes le suivent sur la bande ; un autre jour, rien
  expect(svgNumero({ nom: 'rappel', cibles: prep.cibles, elements: AVEC_BOUTON }, TEINTES.opus, 'lunettes')).toContain('lunettes')
  expect(svg).not.toContain('lunettes')
  // et un numéro dessiné sans déguisement après l'avoir été avec : ses images de course ne l'ont pas gardé
  expect(svgNumero({ nom: 'rappel', cibles: prep.cibles, elements: AVEC_BOUTON }, TEINTES.opus)).toBe(svg)
})

test('rappel : il tape la jauge du contexte puis montre le bouton 🆕, sans toucher au bouton', () => {
  // pas de bouton : rien à rappeler ; un bouton au repos (pas encore temps de changer de conversation) non plus
  expect(prepareNumero('rappel', ELEMENTS, LARGEUR)).toBeNull()
  expect(prepareNumero('rappel', [...AVEC_BOUTON.slice(0, -1), { ...AVEC_BOUTON.at(-1)!, etat: 'repos' }], LARGEUR)).toBeNull()
  const prep = prepareNumero('rappel', AVEC_BOUTON, LARGEUR)
  expect(prep).not.toBeNull()
  expect(prep!.duree).toBeLessThanOrEqual(MAX_DUREE)
  // il n'emprunte que la jauge (elle tremble) : le vrai bouton reste là, cliquable, sans copie par-dessus
  expect(prep!.emprunts.map(e => e.id)).toEqual(['jauge-contexte'])
  // sans jauge du contexte, il montre quand même le bouton
  expect(prepareNumero('rappel', [AVEC_BOUTON.at(-1)!], LARGEUR)?.emprunts).toEqual([])
  // à hauteur de sa tête (une bande sans pastilles), aussi
  expect(prepareNumero('rappel', [{ ...AVEC_BOUTON.at(-1)!, ligne: 0 }], LARGEUR)).not.toBeNull()
  // au bout de la ligne git, au-dessus de sa tête : il le montre bras levé, en sautant plus haut
  const git = prepareNumero('rappel', [...AVEC_BOUTON.slice(0, -1), { ...AVEC_BOUTON.at(-1)!, x: 348, ligne: 2 }], LARGEUR)
  expect(git).not.toBeNull()
  expect(git!.duree).toBeLessThanOrEqual(MAX_DUREE)
  // plus haut encore (une ligne de plus en dessous) : hors de sa portée, il ne vient pas
  expect(prepareNumero('rappel', [{ ...AVEC_BOUTON.at(-1)!, ligne: 3 }], LARGEUR)).toBeNull()
  // il n'est jamais tiré au hasard : il a son moment à lui
  expect(numerosJouables('travail', AVEC_BOUTON)).not.toContain('rappel')
  expect(numerosJouables('repos', AVEC_BOUTON)).not.toContain('rappel')
  // il se dessine sans un mot
  expect(svgNumero({ nom: 'rappel', cibles: prep!.cibles, elements: AVEC_BOUTON }, TEINTES.opus)).not.toContain('<text')
})

/** Un nouvel APK attend : le bouton Installer de la ligne 📱, tout en haut de la bande */
const AVEC_INSTALLER: ElementBande[] = [...ELEMENTS, { id: 'installer', genre: 'bouton', etat: 'a-montrer', x: 300, largeur: 64, ligne: 4 }]

test('installe : un nouvel APK attend, il court sous le bouton Installer et le montre bras levé, sans le toucher', () => {
  // pas de bouton, ou un bouton au repos (discret : on ne sait pas s'il sert) : rien à montrer
  expect(prepareNumero('installe', ELEMENTS, LARGEUR)).toBeNull()
  expect(prepareNumero('installe', [...ELEMENTS, { ...AVEC_INSTALLER.at(-1)!, etat: 'repos' }], LARGEUR)).toBeNull()
  // tout en haut de la bande, hors de sa portée : il vient quand même, dessous
  const prep = prepareNumero('installe', AVEC_INSTALLER, LARGEUR)
  expect(prep).not.toBeNull()
  expect(prep!.duree).toBeLessThanOrEqual(MAX_DUREE)
  // il n'emprunte rien : le vrai bouton reste là, cliquable
  expect(prep!.emprunts).toEqual([])
  // il a son moment à lui, jamais tiré au hasard ; il se dessine sans un mot
  expect(numerosJouables('travail', AVEC_INSTALLER)).not.toContain('installe')
  expect(numerosJouables('repos', AVEC_INSTALLER)).not.toContain('installe')
  expect(svgNumero({ nom: 'installe', cibles: prep!.cibles, elements: AVEC_INSTALLER }, TEINTES.opus)).not.toContain('<text')
})

test('installe : il vient de lui-même quand le bouton passe au jaune, puis pas avant 30 min', { timeoutMs: 30_000 }, async ($, on) => {
  const { horloge, ecrits } = moteur(on, { elements: AVEC_INSTALLER })
  await $.session.start({ cwd: '/projet', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const vus = () => [...new Set(ecrits.filter(x => x.key === 'numero' && (x.value as { nom?: string } | null)?.nom === 'installe').map(x => (x.value as { debut: number }).debut))]
  for (let i = 0; i < 40 && vus().length === 0; i++) await horloge.advance(5000)
  expect(vus()).toHaveLength(1)
  // pas un autre dans le quart d'heure
  for (let i = 0; i < 36; i++) await horloge.advance(25_000)
  expect(vus()).toHaveLength(1)
  await ui.unmount()
})

test('rappel : il ne vient pas tant que le bouton est au repos', { timeoutMs: 30_000 }, async ($, on) => {
  const { horloge, ecrits } = moteur(on, { elements: [...AVEC_BOUTON.slice(0, -1), { ...AVEC_BOUTON.at(-1)!, etat: 'repos' }] })
  await $.session.start({ cwd: '/projet', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  for (let i = 0; i < 40; i++) await horloge.advance(5000)
  expect(ecrits.some(x => x.key === 'numero' && (x.value as { nom?: string } | null)?.nom === 'rappel')).toBe(false)
  await ui.unmount()
})

test('une bande où il n’y a que le bouton 🆕 au repos : rien à animer, pas de numéro', { timeoutMs: 60_000 }, async ($, on) => {
  const { horloge, ecrits } = moteur(on, { elements: [{ ...AVEC_BOUTON.at(-1)!, etat: 'repos' }] })
  await $.session.start({ cwd: '/projet', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  // une heure : au repos, il serait venu plusieurs fois faire le tour de la bande
  for (let i = 0; i < 60; i++) await horloge.advance(60_000)
  expect(ecrits.some(x => x.key === 'numero' && x.value !== null)).toBe(false)
  await ui.unmount()
})

test('rappel : il vient de lui-même quand le bouton apparaît, puis pas avant 10 min', { timeoutMs: 30_000 }, async ($, on) => {
  const { horloge, ecrits } = moteur(on, { elements: AVEC_BOUTON })
  await $.session.start({ cwd: '/projet', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const rappels = () => [...new Set(ecrits.filter(x => x.key === 'numero' && (x.value as { nom?: string } | null)?.nom === 'rappel').map(x => (x.value as { debut: number }).debut))]
  // il vient dès qu'il peut (pas pendant ce qu'il fait : il finit d'abord sa balade ou son activité)
  for (let i = 0; i < 40 && rappels().length === 0; i++) await horloge.advance(5000)
  expect(rappels()).toHaveLength(1)
  // pas un autre avant 10 min…
  for (let i = 0; i < 20; i++) await horloge.advance(25_000)
  expect(rappels()).toHaveLength(1)
  // … puis un deuxième
  for (let i = 0; i < 40 && rappels().length === 1; i++) await horloge.advance(25_000)
  expect(rappels()).toHaveLength(2)
  expect(rappels()[1]! - rappels()[0]!).toBeGreaterThanOrEqual(10 * 60_000)
  await ui.unmount()
})
