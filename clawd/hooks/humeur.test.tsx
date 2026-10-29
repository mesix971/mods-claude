// Tests de son humeur : elle évolue avec le temps et ce qu'il vit, décide de
// ses activités, de ses siestes et de son sommeil de nuit.
import { expect, mock, test } from 'claude-code/testing'

import { HUMEUR_DEPART, choisit, decrit, ecartRepos, estHumeur, estNuit, vecu, vit } from './humeur'
import { ACTIVITES, dureeScene } from './sprite'

const MIN = 60_000

test('le temps passe : éveillé il se fatigue, endormi il se repose, seul il s’ennuie', () => {
  const h = { ...HUMEUR_DEPART }
  // 25 min éveillé, seul : à plat, et il s'ennuie tout à fait
  let x = h
  for (let i = 0; i < 25; i++) x = vit(x, MIN, { dort: false, seul: true })
  expect(x.energie).toBe(0)
  expect(x.ennui).toBe(1)
  // 5 min de sieste : rechargé ; l'ennui ne bouge pas en dormant
  for (let i = 0; i < 5; i++) x = vit(x, MIN, { dort: true, seul: true })
  expect(x.energie).toBe(1)
  expect(x.ennui).toBe(1)
  // tu reviens : l'ennui retombe en deux minutes
  x = vit(vit(x, MIN, { dort: false, seul: false }), MIN, { dort: false, seul: false })
  expect(x.ennui).toBe(0)
  // un pas de temps énorme (le PC sorti de veille) compte pour 10 min au plus : il ne se réveille pas épuisé
  expect(vit(h, 5 * 3_600_000, { dort: false, seul: true }).energie).toBe(0.6)
  expect(vit(h, -5, { dort: false, seul: true })).toEqual(vit(h, 0, { dort: false, seul: true }))
})

test('ce qu’il vit : ta caresse chasse l’ennui et le rend heureux', () => {
  const triste = { energie: 0.5, ennui: 0.9, joie: 0.2 }
  expect(vecu(triste, 'caresse')).toEqual({ energie: 0.5, ennui: 0, joie: 0.5 })
  expect(vecu(triste, 'parle').ennui).toBeLessThan(0.9)
  expect(vecu({ ...triste, joie: 0.95 }, 'reussite').joie).toBe(1)
})

test('ses activités suivent son humeur, et jamais deux fois la même d’affilée', () => {
  const tire = (h: typeof HUMEUR_DEPART, n = 2000) => {
    const vus = new Map<string, number>()
    let graine = 1
    const hasard = () => ((graine = (graine * 16807) % 2147483647) - 1) / 2147483646
    for (let i = 0; i < n; i++) {
      const a = choisit(h, ACTIVITES, null, hasard)
      vus.set(a, (vus.get(a) ?? 0) + 1)
    }
    return (l: string[]) => l.reduce((s, a) => s + (vus.get(a) ?? 0), 0) / n
  }
  const calmes = ['lecture', 'meditation', 'cafe', 'peche', 'arrosage', 'bulles', 'cookie', 'glace', 'gratte']
  const vives = ['danse', 'corde', 'ballon', 'pirouette', 'yoyo', 'jongle', 'guitare', 'papillon', 'etirement']
  const appels = ['coucou', 'question', 'attend']
  // fatigué : surtout du calme
  const fatigue = tire({ energie: 0.1, ennui: 0, joie: 0.5 })
  expect(fatigue(calmes)).toBeGreaterThan(3 * fatigue(vives))
  // joyeux et en forme : surtout du mouvement
  const joyeux = tire({ energie: 1, ennui: 0, joie: 1 })
  expect(joyeux(vives)).toBeGreaterThan(joyeux(calmes))
  // seul depuis longtemps : il vient te chercher
  expect(tire({ energie: 1, ennui: 1, joie: 0.5 })(appels)).toBeGreaterThan(tire({ energie: 1, ennui: 0, joie: 0.5 })(appels) * 3)
  // jamais la même que la précédente
  for (let i = 0; i < 50; i++) expect(choisit(HUMEUR_DEPART, ACTIVITES, 'danse')).not.toBe('danse')
})

test('la nuit, l’écart entre deux numéros, et ce qu’il dit de lui', () => {
  expect([21, 22, 23, 0, 3, 6, 7, 12].map(estNuit)).toEqual([false, true, true, true, true, true, false, false])
  expect(ecartRepos({ energie: 1, ennui: 0, joie: 0.5 })).toBe(6 * MIN)
  expect(ecartRepos({ energie: 1, ennui: 1, joie: 0.5 })).toBe(3 * MIN)
  expect(decrit({ energie: 1, ennui: 0.8, joie: 0.5 }, false)).toBe('il s’ennuie de toi (énergie 100 %, ennui 80 %, joie 50 %)')
  expect(decrit(HUMEUR_DEPART, true)).toContain('il dort')
  expect(estHumeur({ energie: 1, ennui: 0, joie: 0.5 })).toBe(true)
  expect(estHumeur({ energie: 'beaucoup' })).toBe(false)
})

const BAND = {
  plugin: 'clawd',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120, scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const
const SESSION = { cwd: '/projet', surface: 'desktop', isInteractive: true } as const
type On = Parameters<Parameters<typeof test>[1] extends infer F ? (F extends ($: never, on: infer O) => unknown ? (o: O) => void : never) : never>[0]

function moteur(on: On, debut: number) {
  const stockage = new Map<string, unknown>()
  const horloge = mock.clock(on as never, { now: debut })
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>dessous</Text>
  })
  on('store.get', ($, e) => ({ value: stockage.get(e.key) }))
  on('store.set', ($, e) => {
    stockage.set(e.key, e.value)
    return { value: undefined }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('fs.read', () => {
    throw new Error('absent')
  })
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: 'non', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('ui.toast', () => ({ value: undefined }))
  return { stockage, horloge }
}
const scene = async (ui: { find: (q: { type: string }) => Promise<{ props?: Record<string, unknown> } | undefined> }) => String((await ui.find({ type: 'Svg' }))?.props?.alt ?? '')

test('en journée, tu es là sans rien dire : il s’occupe, fait la sieste à plat, puis se réveille tout seul', { timeoutMs: 30_000 }, async ($, on) => {
  // 14 h : la journée
  const { horloge, stockage } = moteur(on, new Date(2026, 9, 15, 14, 0).getTime())
  stockage.set('journee', '2026-10-15')
  await $.session.start(SESSION)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  // 15 min sans un mot de toi : il ne dort pas (avant, il dormait dès 10 min)
  await horloge.advance(15 * MIN)
  expect(await scene(ui as never)).not.toContain('dodo')
  // à plat après ~25 min : la sieste
  await horloge.advance(12 * MIN)
  expect(await scene(ui as never)).toContain('dodo')
  // 3 à 6 min plus tard, il se réveille tout seul et repart
  await horloge.advance(7 * MIN)
  expect(await scene(ui as never)).not.toContain('dodo')
  // son humeur est gardée pour la session suivante
  expect(estHumeur(stockage.get('humeur'))).toBe(true)
  await ui.unmount()
})

test('la nuit, tu n’es plus là : il dort pour de bon, jusqu’à ton retour', { timeoutMs: 30_000 }, async ($, on) => {
  const { horloge, stockage } = moteur(on, new Date(2026, 9, 15, 23, 0).getTime())
  stockage.set('journee', '2026-10-15')
  await $.session.start(SESSION)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await horloge.advance(11 * MIN)
  // il finit d'abord ce qu'il faisait (une activité dure au plus 14 s)
  for (let s = 0; s < 20 && !(await scene(ui as never)).includes('dodo'); s++) await horloge.advance(1000)
  expect(await scene(ui as never)).toContain('dodo')
  // il ne se réveille jamais tout seul, minute après minute (pas de sieste la nuit)
  for (let i = 0; i < 20; i++) {
    await horloge.advance(MIN)
    expect(await scene(ui as never)).toContain('dodo')
  }
  // tu reviens : il se réveille
  await $.prompt.submit({ text: 'encore un petit truc avant de dormir' })
  expect(await scene(ui as never)).not.toContain('dodo')
  await ui.unmount()
})

test('le sommeil vient, mais il finit d’abord son activité : jamais coupée en route par le dodo', { timeoutMs: 60_000 }, async ($, on) => {
  const { horloge, stockage } = moteur(on, new Date(2026, 9, 15, 23, 0).getTime())
  stockage.set('journee', '2026-10-15')
  await $.session.start(SESSION)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await horloge.advance(9 * MIN)
  // seconde après seconde jusqu'au dodo : ce qu'il faisait juste avant est allé au bout
  let avant = ''
  let depuis = 0
  for (let s = 0; s < 6 * 60; s++) {
    await horloge.advance(1000)
    const vu = (await scene(ui as never)).replace('Clawd : ', '')
    if (vu === 'dodo') {
      if ((ACTIVITES as readonly string[]).includes(avant)) expect(depuis).toBeGreaterThanOrEqual(dureeScene(avant as never) - 1)
      break
    }
    if (vu === avant) depuis++
    else {
      avant = vu
      depuis = 1
    }
  }
  expect(await scene(ui as never)).toContain('dodo')
  await ui.unmount()
})
