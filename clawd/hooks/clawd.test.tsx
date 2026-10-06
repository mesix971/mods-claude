// Tests de clawd : il se dessine sur desktop (SVG transparent) et terminal
// (blocs), garde ce qu'un autre mod dessine à côté, et change de scène selon
// les événements — sans jamais écrire de texte.
import { expect, mock, test } from 'claude-code/testing'

const BAND = (isWorking = false) =>
  ({
    plugin: 'clawd',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking, maxRows: 10, bodyColumns: 120, scroll: { offset: 0, bodyRows: 10 }, view: {} },
  }) as const

type On = Parameters<Parameters<typeof test>[1] extends infer F ? (F extends ($: never, on: infer O) => unknown ? (o: O) => void : never) : never>[0]

function moteur(on: On, sortieBash: { isError: boolean; text: string } = { isError: false, text: 'ok' }) {
  const stockage = new Map<string, unknown>()
  mock.clock(on as never)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>dessous</Text>
  })
  on('store.get', ($, e) => ({ value: stockage.get(e.key) }))
  on('store.set', ($, e) => {
    stockage.set(e.key, e.value)
    return { value: undefined }
  })
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('tool.call', { tool: 'Bash' }, () =>
    sortieBash.isError
      ? { result: { stdout: '', stderr: 'FAILED', interrupted: false }, isError: true as const, text: sortieBash.text }
      : { result: { stdout: sortieBash.text, stderr: '', interrupted: false }, text: sortieBash.text },
  )
  return stockage
}

type Monte = { find: (q: { type?: string; key?: string }) => Promise<{ props?: Record<string, unknown> } | undefined> }
const svg = async (ui: Monte) => (await ui.find({ type: 'Svg' }))?.props ?? {}
const scene = async (ui: Monte) => String((await svg(ui)).alt ?? '')

test('desktop : SVG transparent, ce qui est à côté reste, boutons au survol', async ($, on) => {
  moteur(on)
  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  const p = await svg(ui as never)
  // pas de cadre interactif : c'est lui qui mettait un fond blanc
  expect(p.isInteractive).toBeUndefined()
  expect(String(p.source)).toContain('prefers-color-scheme')
  expect(await ui.find({ type: 'Text', text: /dessous/ })).toBeDefined()
  expect(await ui.find({ key: 'caresse' })).toBeDefined()
  expect(await ui.find({ key: 'occupe' })).toBeDefined()
  // aucune bulle de texte
  expect(await ui.find({ type: 'Text', text: /«/ })).toBeUndefined()
  await ui.unmount()
})

test('terminal : le logo en blocs, sans SVG', async ($, on) => {
  moteur(on)
  const ui = await $.ui.mount({ ...BAND(), surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /▐▛███▜▌/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /dessous/ })).toBeDefined()
  await ui.unmount()
})

test('au repos il se balade, au travail il transporte des cartons', async ($, on) => {
  moteur(on)
  const repos = await $.ui.mount({ ...BAND(false), surface: 'desktop' })
  expect(await scene(repos as never)).toContain('balade')
  // chorégraphie : un trajet qui le déplace sur sa petite scène
  expect(String((await svg(repos as never)).source)).toContain('@keyframes ch-balade')
  expect(String((await svg(repos as never)).source)).toContain('translateX(-100px)')
  await repos.unmount()

  const boulot = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(boulot as never)).toContain('boulot')
  expect(String((await svg(boulot as never)).source)).toContain('class="vite"')
  await boulot.unmount()
})

test('build qui plante : il est triste', async ($, on) => {
  moteur(on, { isError: true, text: 'BUILD FAILED' })
  await $.tool.call({ tool: 'Bash', command: './gradlew assembleDebug' })
  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('triste')
  await ui.unmount()
})

test('build qui passe : il fait la fête', async ($, on) => {
  moteur(on, { isError: false, text: 'BUILD SUCCESSFUL' })
  await $.tool.call({ tool: 'Bash', command: './gradlew assembleDebug' })
  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('fete')
  expect(String((await svg(ui as never)).source)).toContain('class="confetti"')
  await ui.unmount()
})

test('une caresse : cœur et compteur gardé entre les sessions', async ($, on) => {
  const stockage = moteur(on)
  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  await ui.press({ key: 'caresse' })
  await ui.press({ key: 'caresse' })
  expect(stockage.get('caresses')).toBe(2)
  expect(await scene(ui as never)).toContain('coeur')
  await ui.unmount()
})

test('🎲 : il se trouve une activité', async ($, on) => {
  moteur(on)
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ ...BAND(), surface })
    await ui.press({ key: 'occupe' })
    if (surface === 'desktop') expect(await scene(ui as never)).not.toContain('repos')
    else expect(await ui.find({ type: 'Text', text: /▐▛███▜▌/ })).toBeDefined()
    await ui.unmount()
  }
})

test('sous-agents : un mini-Clawd chacun, Clawd chef de chantier, ils repartent', async ($, on) => {
  moteur(on)
  // sous les plugins, le moteur n'a rien à décider pour ces événements
  on('classic.SubagentStart', () => ({}))
  on('classic.SubagentStop', () => ({}))
  await $.classic.SubagentStart({ agent_id: 'a1', agent_type: 'Explore' } as never)
  await $.classic.SubagentStart({ agent_id: 'a2', agent_type: 'Plan' } as never)
  let ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('chef')
  expect(await scene(ui as never)).toContain('+2 copains')
  expect(String((await svg(ui as never)).source)).toContain('fbm-1')
  await ui.unmount()

  await $.classic.SubagentStop({ agent_id: 'a1', agent_type: 'Explore', stop_hook_active: false, agent_transcript_path: '' } as never)
  ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('+1 copains')
  expect(String((await svg(ui as never)).source)).not.toContain('fbm-1')
  await ui.unmount()

  // terminal : un petit compteur
  ui = await $.ui.mount({ ...BAND(true), surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /▪/ })).toBeDefined()
  await ui.unmount()
})
