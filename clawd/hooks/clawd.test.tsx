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

function moteur(on: On, sortieBash: { isError: boolean; text: string; attente?: number } = { isError: false, text: 'ok' }) {
  const stockage = new Map<string, unknown>()
  const horloge = mock.clock(on as never)
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
  on('tool.call', { tool: 'Bash' }, async () => {
    if (sortieBash.attente) await horloge.sleep(sortieBash.attente)
    return sortieBash.isError
      ? { result: { stdout: '', stderr: 'FAILED', interrupted: false }, isError: true as const, text: sortieBash.text }
      : { result: { stdout: sortieBash.text, stderr: '', interrupted: false }, text: sortieBash.text }
  })
  return { stockage, horloge }
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
  const dessin = String((await svg(boulot as never)).source)
  // chargé, il marche plus lentement et le carton cahote ; à vide, il trottine
  expect(dessin).toContain('class="lent"')
  expect(dessin).toContain('class="cahote"')
  expect(dessin).toContain('class="vite"')
  // ses deux pyramides de trois places (chez lui, là-bas) font partie du décor
  expect(dessin).toContain('v-boulot-decor5')
  await boulot.unmount()
})

test('au travail, une petite réaction est une bulle : il ne lâche pas ses cartons', async ($, on) => {
  const { horloge } = moteur(on)
  await horloge.advance(3000)
  // un commit, pendant qu'il déménage
  await $.tool.call({ tool: 'Bash', command: 'git commit -m essai' })
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  // sa scène continue, sans redémarrer…
  expect(await scene(ui as never)).toContain('boulot')
  expect(String((await svg(ui as never)).source)).not.toContain('animation-delay:-')
  // … et la bulle, posée par-dessus, suit son trajet au-dessus de sa tête
  const bulle = (await ui.find({ key: 'bulle' }))?.children[0] as { type: string; props: { alt: string; source: string } } | undefined
  expect(bulle?.type).toBe('Svg')
  expect(bulle?.props.alt).toContain('ecoute')
  expect(bulle?.props.source).toContain('ch-boulot-bulle')
  await ui.unmount()
})

test('après une grosse réaction, il reprend ses cartons là où il les avait laissés', async ($, on) => {
  const { stockage, horloge } = moteur(on, { isError: false, text: 'BUILD SUCCESSFUL' })
  // il déménage 5 s…
  let ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(String((await svg(ui as never)).source)).not.toContain('animation-delay:-')
  await ui.unmount()
  await horloge.advance(5000)
  // … un build passe : la fête a sa scène entière…
  await $.tool.call({ tool: 'Bash', command: './gradlew assembleDebug' })
  ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('fete')
  expect(await ui.find({ key: 'bulle' })).toBeUndefined()
  // (où il en est est noté, pour la prochaine session)
  expect(stockage.get('boulot')).toBe(5000)
  await ui.unmount()
  // … puis il reprend à 5 s, pas au début (sinon ses cartons sauteraient)
  await horloge.advance(7000)
  ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('boulot')
  expect(String((await svg(ui as never)).source)).toContain('animation-delay:-5.000s')
  await ui.unmount()
})

test('une nouvelle session reprend son déménagement où il en était', async ($, on) => {
  const { stockage, horloge } = moteur(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  // la dernière fois, il en était à 20 s : sur le retour
  stockage.set('boulot', 20_000)
  await $.session.start({ cwd: '/projet', surface: 'desktop', isInteractive: true })
  await horloge.advance(5000)
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('boulot')
  expect(String((await svg(ui as never)).source)).toContain('animation-delay:-20.000s')
  await ui.unmount()
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
  const { stockage } = moteur(on)
  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  await ui.press({ key: 'caresse' })
  await ui.press({ key: 'caresse' })
  expect(stockage.get('caresses')).toBe(2)
  // au repos, la réaction a toute sa scène (pas de bulle)
  expect(await scene(ui as never)).toContain('coeur')
  expect(await ui.find({ key: 'bulle' })).toBeUndefined()
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

// une conversation d'un message, et son résumé
const CONVERSATION = [{ role: 'user' as const, text: 'corrige le minuteur', toolUses: [] }]
const RESUME = [{ role: 'user' as const, text: 'Résumé : le minuteur est corrigé.', toolUses: [] }]

test('compactage : il tasse la pile de feuilles tant que ça dure, puis montre le paquet', async ($, on) => {
  const { horloge } = moteur(on)
  // le compactage du moteur prend 10 s
  on('session.compact', async () => {
    await horloge.sleep(10_000)
    return { messages: RESUME }
  })
  const fini = $.session.compact({ trigger: 'manual', messages: CONVERSATION })
  await horloge.settle()
  let ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('tasse')
  await ui.unmount()
  await horloge.advance(10_000)
  await fini
  ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('paquet')
  await ui.unmount()
})

test('un compactage calculé d’avance ne le dérange pas', async ($, on) => {
  moteur(on)
  on('session.compact', () => ({ messages: RESUME }))
  await $.session.compact({ trigger: 'precompute', messages: CONVERSATION })
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('boulot')
  await ui.unmount()
})

test('il attend ta permission, patte levée, jusqu’à ce que l’action soit faite', async ($, on) => {
  moteur(on)
  on('classic.PermissionRequest', () => ({}))
  await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'rm -rf build' } } as never)
  let ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('attend')
  await ui.unmount()
  // l'action autorisée se termine : il baisse la patte
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(ui as never)).not.toContain('attend')
  await ui.unmount()
})

test('une permission déjà tranchée par une règle : il n’attend rien', async ($, on) => {
  moteur(on)
  on('classic.PermissionRequest', () => ({ decision: { behavior: 'allow' as const } }))
  await $.classic.PermissionRequest({ tool_name: 'Edit', tool_input: {} } as never)
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('boulot')
  await ui.unmount()
})

test('une question pour toi : pancarte « ? » tant que tu n’as pas répondu', async ($, on) => {
  const { horloge } = moteur(on)
  on('tool.call', { tool: 'AskUserQuestion' }, async () => {
    await horloge.sleep(5000)
    return { result: {}, text: 'Oui' } as never
  })
  const reponse = $.tool.call({ tool: 'AskUserQuestion', questions: [] } as never)
  await horloge.settle()
  let ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('question')
  await ui.unmount()
  await horloge.advance(5000)
  await reponse
  ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(ui as never)).not.toContain('question')
  await ui.unmount()
})

test('des dépendances s’installent : il déballe un carton', async ($, on) => {
  const { horloge } = moteur(on, { isError: false, text: 'Got dependencies!', attente: 5000 })
  const fini = $.tool.call({ tool: 'Bash', command: 'flutter pub get' })
  await horloge.settle()
  let ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('deballe')
  await ui.unmount()
  await horloge.advance(5000)
  await fini
  ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('boulot')
  await ui.unmount()
})

test('sa couleur suit le modèle : Haiku pistache, puis Fable corail', async ($, on) => {
  moteur(on)
  on('session.model', () => ({ value: 'claude-haiku-5-5' }))
  on('classic.PostModelSwitch', () => ({}))
  let ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  let dessin = String((await svg(ui as never)).source)
  expect(dessin).toContain('#9CB86A')
  expect(dessin).not.toContain('#D97758')
  await ui.unmount()
  await $.classic.PostModelSwitch({ from_model: 'claude-haiku-5-5', to_model: 'claude-fable-5-1', requested_model: 'fable', source: 'command' } as never)
  ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  dessin = String((await svg(ui as never)).source)
  expect(dessin).toContain('#E2604A')
  await ui.unmount()
})
