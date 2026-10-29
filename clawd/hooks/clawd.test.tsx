// Tests de clawd : il se dessine sur desktop (SVG transparent) et terminal
// (blocs), garde ce qu'un autre mod dessine à côté, et change de scène selon
// les événements — sans jamais écrire de texte.
import { expect, mock, test } from 'claude-code/testing'
import { ACTIVITES, BONBON_S, CLASSES_QUI_DEPLACENT, CLIGNEMENTS, DANSES, EMOJI, JEUX_CARTONS, RAPPORT_S, SORTIES, SOUFFLES, TEINTES, VIVANT_S, avecT0, classeDe, dureeScene, etatBoulot, etatScene, imagesScene, svgMinis, svgScene, tenueDe } from './sprite'
import { autreQue, deToi, deguisementDu, insigneDe, niveauDe, seuilNiveau, sueurDe, visiteur } from './register'
import { COIN_VIDE, EXEMPLE, MAX_SVG, NUMEROS, departDe, prepareNumero, svgNumero } from './bande'

const BAND = (isWorking = false) =>
  ({
    plugin: 'clawd',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking, maxRows: 10, bodyColumns: 120, scroll: { offset: 0, bodyRows: 10 }, view: {} },
  }) as const

type On = Parameters<Parameters<typeof test>[1] extends infer F ? (F extends ($: never, on: infer O) => unknown ? (o: O) => void : never) : never>[0]

function moteur(
  on: On,
  sortieBash: { isError: boolean; text: string; attente?: number | ((cmd: string) => number); plante?: boolean; enFond?: boolean; interrompu?: boolean; refus?: string; selon?: (cmd: string) => { isError: boolean; text: string } | undefined } = { isError: false, text: 'ok' },
  debut?: number,
) {
  const stockage = new Map<string, unknown>()
  const horloge = debut === undefined ? mock.clock(on as never) : mock.clock(on as never, { now: debut })
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
  on('tool.call', { tool: 'Bash' }, async ($, e) => {
    // une sortie propre à cette commande (un merge en conflit, puis un commit qui passe…)
    const propre = sortieBash.selon?.(String((e as { command?: string }).command))
    const sortie = propre ? { ...sortieBash, ...propre } : sortieBash
    const attente = typeof sortieBash.attente === 'function' ? sortieBash.attente(String((e as { command?: string }).command)) : sortieBash.attente
    if (attente) await horloge.sleep(attente)
    if (sortieBash.plante) throw new Error('interrompu')
    if (sortieBash.refus) return { deny: sortieBash.refus } as never
    // comme le moteur : sur une erreur, le texte seul (jamais l'enregistrement de l'outil)
    if (sortieBash.interrompu) return { result: sortie.text, isError: true as const, text: sortie.text }
    return sortie.isError
      ? { result: { stdout: '', stderr: 'FAILED', interrupted: false }, isError: true as const, text: sortie.text }
      : { result: { stdout: sortie.text, stderr: '', interrupted: false, ...(sortieBash.enFond ? { backgroundTaskId: 'b1' } : {}) }, text: sortie.text }
  })
  return { stockage, horloge }
}

/** Regarde sa scène seconde après seconde jusqu'à ce que `motif` s'y trouve (une action en cours ne se coupe pas : la réaction attend son tour) */
async function vuJusqua($: Parameters<Parameters<typeof test>[1]>[0], horloge: { advance: (ms: number) => Promise<void> }, motif: string, secondes = 20) {
  let s = ''
  for (let i = 0; i <= secondes && !s.includes(motif); i++) {
    if (i) await horloge.advance(1000)
    const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
    s = String(((await ui.find({ type: 'Svg' }))?.props as { alt?: string } | undefined)?.alt ?? '')
    await ui.unmount()
  }
  return s
}

type Monte = { find: (q: { type?: string; key?: string }) => Promise<{ props?: Record<string, unknown> } | undefined> }
const svg = async (ui: Monte) => (await ui.find({ type: 'Svg' }))?.props ?? {}
/** Tout ce qu'il dessine à la fois : sa scène, et à part ses mini-Clawds (ou sa bulle) */
const toutDessin = async (ui: Monte) => (await (ui as unknown as { findAll: (q: unknown) => Promise<{ props: { source?: unknown } }[]> }).findAll({ type: 'Svg' })).map(s => String(s.props.source)).join('')
const scene = async (ui: Monte) => String((await svg(ui)).alt ?? '')
/** Ses visiteurs rares (un chat, une étoile filante) : une activité comme une autre, qui passe parfois à la place de la sienne */
const VISITEURS = ['chat', 'filante']

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

test('au travail, une petite réaction ne lui fait pas lâcher ses cartons (et pas de bulle pendant qu’il les porte)', async ($, on) => {
  const { horloge } = moteur(on)
  await horloge.advance(3000)
  // un commit, pendant qu'il déménage
  await $.tool.call({ tool: 'Bash', command: 'git commit -m essai' })
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  // il continue ses cartons (son déménagement compte depuis qu'il s'affiche)…
  expect(await scene(ui as never)).toContain('boulot')
  expect(decalage((await svg(ui as never)).source)).toBe(0)
  // … sans bulle : dans son image, elle la refaisait à chaque outil (il sautait) ; à part, elle ne le suivrait pas
  expect(String((await svg(ui as never)).source)).not.toContain('class="pop"')
  expect(await ui.find({ key: 'bulle' })).toBeUndefined()
  await ui.unmount()
})

test('après une grosse réaction, jouée là où il en était (au milieu de ses cartons), il reprend ses cartons pile là', async ($, on) => {
  const { horloge } = moteur(on, { isError: false, text: 'BUILD SUCCESSFUL' })
  // il déménage 5 s…
  let ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(decalage((await svg(ui as never)).source)).toBe(0)
  await ui.unmount()
  await horloge.advance(5000)
  // … un build passe : la fête a sa scène entière, jouée là où il en était, ses cartons à leur place (il ne saute pas
  // à son coin, puis de nouveau au milieu de la bande en reprenant)
  await $.tool.call({ tool: 'Bash', command: './gradlew assembleDebug' })
  ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('fete')
  expect(await ui.find({ key: 'bulle' })).toBeUndefined()
  const ici = etatBoulot(5)
  expect(ici.x).toBeLessThan(-40)
  const fete = String((await svg(ui as never)).source)
  expect(fete).toContain(`<g transform="translate(${ici.x} 0)">`)
  expect(fete).toContain(ici.decor)
  expect(ici.decor).toContain('href="#carton"')
  await ui.unmount()
  // … puis il reprend à 5 s, pas au début (sinon ses cartons sauteraient)
  await horloge.advance(7000)
  ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('boulot')
  expect(decalage((await svg(ui as never)).source)).toBe(5)
  await ui.unmount()
})

test('une scène commencée sur place y reste jusqu’au bout, même si le tour finit pendant ; puis il rentre chez lui', { timeoutMs: 30_000 }, async ($, on) => {
  const { horloge } = moteur(on, { isError: false, text: 'BUILD SUCCESSFUL' })
  on('turn.complete', () => ({ text: '' }) as never)
  let ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  await ui.unmount()
  await horloge.advance(8000)
  // un build passe : la fête, sur place
  await $.tool.call({ tool: 'Bash', command: './gradlew assembleDebug' })
  ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  const ici = etatBoulot(8)
  expect(String((await svg(ui as never)).source)).toContain(`<g transform="translate(${ici.x} 0)">`)
  await ui.unmount()
  // le tour finit pendant la fête : elle ne saute pas à son coin en route
  await horloge.advance(1000)
  await $.turn.complete({ answer: 'fait', durationMs: 1000, isAborted: false, turnId: 't' } as never)
  ui = await $.ui.mount({ ...BAND(false), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('fete')
  expect(String((await svg(ui as never)).source)).toContain(`<g transform="translate(${ici.x} 0)">`)
  await ui.unmount()
  // la fête finie : il rentre chez lui, ses cartons s'effacent
  await horloge.advance(6000)
  ui = await $.ui.mount({ ...BAND(false), surface: 'desktop' })
  expect(await scene(ui as never)).not.toContain('fete')
  expect(String((await svg(ui as never)).source)).toContain(`translateX(${ici.x}px)`)
  await ui.unmount()
})

test('son équipe arrive en plein déménagement : il rentre chez lui avant de la diriger ; elle repartie, son déménagement reprend au début (rien ne saute)', { timeoutMs: 30_000 }, async ($, on) => {
  const { horloge } = moteur(on)
  on('classic.SubagentStart', () => ({}))
  on('classic.SubagentStop', () => ({}))
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  await horloge.advance(12_000)
  // un sous-agent démarre : il rentre chez lui à pied (ses cartons s'effacent), puis il dirige
  await $.classic.SubagentStart({ agent_id: 'a1', agent_type: 'Explore' } as never)
  expect(await scene(ui as never)).toContain('chef')
  const chef = String((await svg(ui as never)).source)
  expect(chef).toContain('class="rentre-pas"')
  expect(chef).toContain(`translateX(${etatBoulot(12).x}px)`)
  await horloge.advance(5000)
  // il a fini : son mini vient rendre son travail (chez lui, pas au milieu de cartons qui n'y sont plus)
  await $.classic.SubagentStop({ agent_id: 'a1', agent_type: 'Explore', stop_hook_active: false, agent_transcript_path: '' } as never)
  expect(await scene(ui as never)).toContain('rapport')
  expect(String((await svg(ui as never)).source)).not.toMatch(/<g transform="translate\(-?[\d.]+ 0\)">/)
  // puis son déménagement reprend au début de sa boucle : chez lui, les cartons lui tombent du ciel
  await horloge.advance(8000)
  expect(await scene(ui as never)).toContain('boulot')
  expect(decalage((await svg(ui as never)).source)).toBeLessThan(0.2)
  await ui.unmount()
})

test('la même scène deux fois de suite : la seconde repart de son début', async ($, on) => {
  const { horloge } = moteur(on, { isError: true, text: 'erreur' })
  const ui = await $.ui.mount({ ...BAND(false), surface: 'desktop' })
  // deux commandes ratées : il est surpris, la seconde surprise attend la fin de la première
  await $.tool.call({ tool: 'Bash', command: 'ls a' })
  await horloge.advance(1000)
  await $.tool.call({ tool: 'Bash', command: 'ls b' })
  await horloge.advance(2100)
  expect(await scene(ui as never)).toContain('surpris')
  // (elle ne continue pas l'horloge de la première : elle commence)
  expect(decalage((await svg(ui as never)).source)).toBe(0)
  await ui.unmount()
})

test('son retour chez lui continue d’une scène à l’autre : la fin du tour qui arrive pendant ne le coupe pas', { timeoutMs: 30_000 }, async ($, on) => {
  const { horloge } = moteur(on)
  on('turn.complete', () => ({ text: '' }) as never)
  let ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  await ui.unmount()
  await horloge.advance(10_000)
  // la bande passe au repos avant que la fin du tour n'arrive : sa balade commence par son retour
  ui = await $.ui.mount({ ...BAND(false), surface: 'desktop' })
  expect(String((await svg(ui as never)).source)).toContain('class="rentre-pas"')
  await horloge.advance(300)
  // la fin du tour arrive : il t'écoute… après avoir fini son retour, là où il en est (0,3 s de fait)
  await $.turn.complete({ answer: 'fait', durationMs: 1000, isAborted: false, turnId: 't' } as never)
  expect(await scene(ui as never)).toContain('ecoute')
  const ecoute = String((await svg(ui as never)).source)
  expect(ecoute).toContain('class="rentre-pas"')
  expect(ecoute).toContain('animation-delay:calc(var(--t0,0s) - 0.300s)')
  await ui.unmount()
})

test('un numéro lancé pendant une scène jouée au milieu de ses cartons part de là où il est', { timeoutMs: 30_000 }, async ($, on) => {
  const { horloge } = moteur(on)
  on('classic.PermissionRequest', () => ({}))
  const ecrits: { key: string; value: unknown }[] = []
  on('state.set', ($, e, next) => {
    ecrits.push({ key: (e as { key: string }).key, value: (e as { value: unknown }).value })
    return next(e)
  })
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  await horloge.advance(10_000)
  // il attend ta permission, sur place
  await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'rm x' } } as never)
  expect(await scene(ui as never)).toContain('attend')
  const ici = etatBoulot(10)
  expect(String((await svg(ui as never)).source)).toContain(`<g transform="translate(${ici.x} 0)">`)
  // un numéro (une permission qui attend ne l'empêche pas) : il part de là où il est, ses cartons restent dans son coin
  await $.command.run({ command: 'clawd', args: 'montre tournee', origin: { kind: 'composer' } })
  await horloge.advance(100)
  const n = ecrits.filter(x => x.key === 'numero').at(-1)?.value as { depart?: number } | null | undefined
  expect(n?.depart).toBe(departDe(ici.x))
  expect(String((await svg(ui as never)).source)).toContain(ici.decor)
  await ui.unmount()
})

test('jamais un saut d’une scène à l’autre : sa balade coupée par une réaction, il revient d’abord à pied', { timeoutMs: 30_000 }, async ($, on) => {
  const { horloge } = moteur(on, { isError: true, text: 'erreur' })
  const ui = await $.ui.mount({ ...BAND(false), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('balade')
  await horloge.advance(4000)
  const ici = etatScene('balade', 4)
  expect(ici.x).toBeLessThan(-10)
  // une commande ratée : il est surpris… une fois revenu de là où sa balade l'avait mené
  await $.tool.call({ tool: 'Bash', command: 'ls x' })
  expect(await scene(ui as never)).toContain('surpris')
  const surpris = String((await svg(ui as never)).source)
  expect(surpris).toContain('class="rentre-pas"')
  expect(surpris).toContain(`translateX(${ici.x}px)`)
  await ui.unmount()
})

test('jamais un saut d’une scène à l’autre : Claude se met au travail en pleine balade, il revient avant ses cartons', { timeoutMs: 30_000 }, async ($, on) => {
  const { horloge } = moteur(on)
  let ui = await $.ui.mount({ ...BAND(false), surface: 'desktop' })
  await horloge.advance(4000)
  await ui.unmount()
  ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('boulot')
  const boulot = String((await svg(ui as never)).source)
  expect(boulot).toContain('class="rentre-pas"')
  const x = etatScene('balade', 4).x
  expect(boulot).toContain(`translateX(${x}px)`)
  // son déménagement attend son arrivée (le temps du trajet, une demi-seconde au moins) : il le commence au début de sa boucle
  expect(boulot).toContain(`--tm:calc(var(--t0,0s) + ${Math.max(0.5, Math.abs(x) / 52).toFixed(2).replace(/\.?0+$/, '')}s)`)
  await ui.unmount()
})

test('son déménagement attend la fin de son trajet pour compter, même si sa couleur change en route', { timeoutMs: 30_000 }, async ($, on) => {
  const { horloge } = moteur(on, { isError: false, text: 'BUILD SUCCESSFUL' })
  on('classic.PostModelSwitch', () => ({}))
  let ui = await $.ui.mount({ ...BAND(false), surface: 'desktop' })
  await horloge.advance(4000)
  await ui.unmount()
  // Claude se met au travail : il revient de sa balade (0,5 s), puis commence son déménagement
  ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  await horloge.advance(200)
  // en route, le modèle change (sa couleur : son dessin est refait, le trajet repris où il en est)
  await $.classic.PostModelSwitch({ from_model: 'claude-haiku-5-5', to_model: 'claude-fable-5-1', requested_model: 'fable', source: 'command' } as never)
  await horloge.advance(3300)
  // 3,5 s après le début du trajet, son déménagement en est à 3 s (pas 3,2) : interrompu, il est pile là où on le voit
  await $.tool.call({ tool: 'Bash', command: './gradlew assembleDebug' })
  expect(await scene(ui as never)).toContain('fete')
  expect(String((await svg(ui as never)).source)).toContain(`<g transform="translate(${etatBoulot(3).x} 0)">`)
  await ui.unmount()
})

test('jamais un saut d’une scène à l’autre : une scène qui le laisse loin de chez lui (soulagé, il s’éloigne), la suivante commence par son retour', { timeoutMs: 30_000 }, async ($, on) => {
  const { horloge } = moteur(on, {
    isError: false,
    text: 'ok',
    selon: cmd => (/merge/.test(cmd) ? { isError: true, text: 'CONFLICT (content): Merge conflict in a.ts\nAutomatic merge failed' } : undefined),
  })
  await $.tool.call({ tool: 'Bash', command: 'git merge origin/main' })
  await $.tool.call({ tool: 'Bash', command: 'git commit --no-edit' })
  let ui = await $.ui.mount({ ...BAND(false), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('soulage')
  await ui.unmount()
  const fin = etatScene('soulage', dureeScene('soulage') - 0.001)
  expect(fin.x).toBeLessThan(-10)
  await horloge.advance(dureeScene('soulage') * 1000 + 100)
  ui = await $.ui.mount({ ...BAND(false), surface: 'desktop' })
  expect(await scene(ui as never)).not.toContain('soulage')
  expect(String((await svg(ui as never)).source)).toContain(`translateX(${fin.x}px)`)
  await ui.unmount()
})

test('un numéro lancé en pleine balade part de là où il est', { timeoutMs: 30_000 }, async ($, on) => {
  const { horloge } = moteur(on)
  const ecrits: { key: string; value: unknown }[] = []
  on('state.set', ($, e, next) => {
    ecrits.push({ key: (e as { key: string }).key, value: (e as { value: unknown }).value })
    return next(e)
  })
  const ui = await $.ui.mount({ ...BAND(false), surface: 'desktop' })
  await horloge.advance(4000)
  await $.command.run({ command: 'clawd', args: 'montre tournee', origin: { kind: 'composer' } })
  const n = ecrits.filter(x => x.key === 'numero').at(-1)?.value as { depart?: number } | null | undefined
  expect(n?.depart).toBe(departDe(etatScene('balade', 4).x))
  await ui.unmount()
})

test('chaque tour de Claude, son déménagement repart du début de sa boucle : chez lui, ses cartons lui tombent du ciel', { timeoutMs: 30_000 }, async ($, on) => {
  const { horloge } = moteur(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('turn.complete', () => ({ text: '' }) as never)
  await $.session.start({ cwd: '/projet', surface: 'desktop', isInteractive: true })
  await horloge.advance(5000)
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('boulot')
  // une nouvelle session : au début de sa boucle (il est chez lui, de face, sans un carton : rien ne saute)
  expect(decalage((await svg(ui as never)).source)).toBe(0)
  expect(etatBoulot(0)).toEqual({ x: 0, decor: '' })
  await ui.unmount()
  // il travaille 10 s ; le tour fini, il se repose
  await horloge.advance(10_000)
  await $.turn.complete({ answer: 'fait', durationMs: 1000, isAborted: false, turnId: 't1' } as never)
  const repos = await $.ui.mount({ ...BAND(false), surface: 'desktop' })
  expect(await scene(repos as never)).not.toContain('boulot')
  // laissé en route, son déménagement : il rentre chez lui à pied (ses cartons s'effacent), puis sa scène commence
  const retour = String((await svg(repos as never)).source)
  const ici = etatBoulot(10)
  expect(ici.x).not.toBe(0)
  expect(retour).toContain('class="rentre-pas"')
  expect(retour).toContain(`translateX(${ici.x}px)`)
  expect(retour).toContain('class="rentre-range"')
  expect(retour).toContain('--tm:calc(var(--t0,0s) + ')
  await repos.unmount()
  await horloge.advance(30_000)
  // au tour suivant, sa boucle repart du début : ses cartons lui tombent du ciel, chez lui
  const tour2 = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(tour2 as never)).toContain('boulot')
  expect(decalage((await svg(tour2 as never)).source)).toBe(0)
  await tour2.unmount()
})

test('une scène finie laisse sa place à la suivante d’un coup : jamais une image de ses cartons entre les deux', async ($, on) => {
  const { horloge } = moteur(on, { isError: false, text: 'BUILD SUCCESSFUL', selon: cmd => (cmd.includes('casse') ? { isError: true, text: 'erreur' } : undefined) })
  const passages: (string | null)[] = []
  on('state.set', ($, e, next) => {
    if ((e as { key: string }).key === 'passage') passages.push((e as { value: { anim?: string } | null }).value?.anim ?? null)
    return next(e)
  })
  // un build qui passe : sa scène, puis sa fête, sans « rien » entre les deux (le fond s'y voyait le temps d'un éclair)
  await $.tool.call({ tool: 'Bash', command: './gradlew assembleDebug' })
  expect(passages).toEqual(['build', 'fete'])
  await horloge.advance(7000)
  expect(passages).toEqual(['build', 'fete', null])
  // une commande ratée (il est surpris), puis un commit qui attend son tour : l'une, puis l'autre, puis rien
  passages.length = 0
  await $.tool.call({ tool: 'Bash', command: 'ls casse' })
  await $.tool.call({ tool: 'Bash', command: 'git commit -m ok' })
  await horloge.advance(3500)
  await horloge.advance(3000)
  expect(passages).toEqual(['surpris', 'ecoute', null])
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

test('ses sauts ont du poids : écrasé en se recevant, étiré en décollant, ombre plus petite en l’air', () => {
  for (const anim of ['fete', 'ecoute', 'delivrance'] as const) {
    const dessin = svgScene(anim)
    // il s'écrase accroupi et s'étire en s'élançant
    expect(dessin).toContain('scale(1.12 0.86)')
    expect(dessin).toContain('scale(0.88 1.14)')
    expect(dessin).not.toContain('<text')
    expect(dessin.length).toBeLessThan(40_000)
    expect(svgScene(anim)).toBe(dessin)
  }
  // fête : chaque image a son ombre, plus étroite quand il est en l'air,
  // posée au sol hors du contour (pas de liseré autour d'une ombre)
  const fete = svgScene('fete')
  const largeurs = [...fete.matchAll(/class="ombre[^"]*"[^>]*width="(\d+)"/g)].map(m => Number(m[1]))
  expect(largeurs).toContain(56)
  expect(Math.min(...largeurs)).toBeLessThan(40)
  expect(fete.indexOf('ombre-saut')).toBeLessThan(fete.indexOf('filter="url(#contour)"'))
  for (const image of imagesScene('fete')) expect(image.match(/class="ombre/g)).toHaveLength(1)
  // en balade, l'ombre au sol s'efface pendant le saut, au profit de la petite
  const balade = svgScene('balade')
  expect(balade).toContain('v-balade-sol')
  expect(balade).toContain('ombre-saut')
  // au repos, rien ne change : une seule ombre, pleine largeur
  expect(svgScene('repos')).not.toContain('ombre-saut')
  // (il ne s'écrase ni ne s'étire : sa seule mise à l'échelle est celle de son souffle, en CSS)
  expect(svgScene('repos')).not.toMatch(/transform="[^"]*scale\(/)
})

test('au calme, il respire et cligne des yeux quand ça lui chante, pas toutes les 4 s pile', () => {
  // la boucle : ses souffles la remplissent, un soupir plus long au milieu
  expect(Math.abs(SOUFFLES.reduce((a, b) => a + b, 0) - VIVANT_S)).toBeLessThan(1e-9)
  expect(new Set(SOUFFLES).size).toBeGreaterThan(3)
  // ses clignements : irréguliers, dont un double, jamais plus de 6 s les yeux ouverts (hors soupir, où il les ferme)
  const ecarts = CLIGNEMENTS.map((c, i) => +(((CLIGNEMENTS[i + 1] ?? CLIGNEMENTS[0]! + VIVANT_S) - c).toFixed(2)))
  expect(new Set(ecarts).size).toBeGreaterThanOrEqual(5)
  expect(Math.min(...ecarts)).toBeLessThan(0.5)
  expect(Math.max(...ecarts)).toBeLessThan(9)
  for (const anim of ['repos', 'balade', 'lecture', 'peche'] as const) {
    const s = svgScene(anim)
    expect(s).toContain('class="souffle"')
    expect(s).toContain('class="cligne"')
    // sur sa boucle à lui, recalée sur `--t0` comme ses gestes
    expect(s).toMatch(/\.souffle\{[^}]*animation:souffle 23s[^}]*animation-delay:var\(--t0,0s\)/)
    expect(s).toMatch(/\.cligne\{[^}]*animation:cligne 23s[^}]*animation-delay:var\(--t0,0s\)/)
    expect(svgScene(anim)).toBe(s)
  }
  // ses pattes restent au sol : seul son buste (bras, yeux) respire au-dessus
  const debout = imagesScene('repos')[0]!
  const [pattes, buste] = debout.split('<g class="souffle">')
  expect(pattes!.match(/<rect [^>]*y="82"/g)).toHaveLength(4)
  expect(buste).not.toContain('y="82"')
  expect(buste).toContain('<g class="cligne">')
  // plus d'image « yeux fermés » au repos : ses clignements suffisent
  for (const image of imagesScene('repos')) expect(image).not.toContain('width="6" height="2"')
  // ce qui cligne a toujours sa règle, et les scènes qui ne s'en servent pas n'en portent pas le poids
  for (const anim of Object.keys(EMOJI) as (keyof typeof EMOJI)[]) {
    const s = svgScene(anim)
    if (s.includes('class="cligne"')) expect(s).toContain('@keyframes cligne')
    if (!/class="(?:souffle|cligne)"/.test(s)) expect(s).not.toContain('@keyframes souffle')
  }
  expect(svgScene('pause')).not.toContain('@keyframes souffle')
  // en plein saut, son corps ne respire pas
  for (const image of imagesScene('fete')) expect(image).not.toContain('class="souffle"')
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
    if (surface === 'desktop') {
      const s = (await scene(ui as never)).replace('Clawd : ', '')
      expect([...ACTIVITES, 'question', 'attend'].includes(s as never)).toBe(true)
    }
    else expect(await ui.find({ type: 'Text', text: /▐▛███▜▌/ })).toBeDefined()
    await ui.unmount()
  }
})

test('🍦 : la glace fait partie de ses activités et se dessine sans texte', () => {
  expect(ACTIVITES).toContain('glace')
  const dessin = svgScene('glace')
  expect(dessin).toContain('<svg')
  expect(dessin).not.toContain('<text')
  expect(dessin.length).toBeLessThan(40_000)
  // identique d'un rendu à l'autre
  expect(svgScene('glace')).toBe(dessin)
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
  expect(await toutDessin(ui as never)).toContain('fbm-1')
  // ses minis ont leur propre dessin : le sien n'en contient aucun
  expect(String((await svg(ui as never)).source)).not.toContain('fbm-0')
  await ui.unmount()

  await $.classic.SubagentStop({ agent_id: 'a1', agent_type: 'Explore', stop_hook_active: false, agent_transcript_path: '' } as never)
  ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  // son mini vient rendre son travail avant de partir ; l'autre reste au boulot
  expect(await scene(ui as never)).toContain('rapport')
  expect(await scene(ui as never)).toContain('+1 copains')
  expect(await toutDessin(ui as never)).not.toContain('fbm-1')
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
  // une autre action, lancée en parallèle, se termine : sa permission attend toujours
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('attend')
  await ui.unmount()
  // l'action autorisée se termine : il baisse la patte
  await $.tool.call({ tool: 'Bash', command: 'rm -rf build' })
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

test('chaque mini-Clawd prend la couleur du modèle de son sous-agent', async ($, on) => {
  moteur(on)
  // le moteur lance l'éclaireur sur Haiku et le relecteur sur Fable
  on('agent.spawn', ($, e) =>
    e.subagentType === 'eclaireur' ? { model: 'claude-haiku-5-5', agentId: 'a1' } : { model: 'claude-fable-5-1', agentId: 'a2' },
  )
  on('classic.SubagentStart', () => ({}))
  // le modèle peut être connu avant l'arrivée du mini (a1)… ou après (a2)
  await $.agent.spawn({ prompt: 'fouille le projet', subagentType: 'eclaireur' })
  await $.classic.SubagentStart({ agent_id: 'a1', agent_type: 'eclaireur' } as never)
  await $.classic.SubagentStart({ agent_id: 'a2', agent_type: 'relecteur' } as never)
  await $.agent.spawn({ prompt: 'relis le diff', subagentType: 'relecteur' })
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('chef')
  const dessin = await toutDessin(ui as never)
  expect(dessin).toContain('#9CB86A') // le mini de l'éclaireur, en Haiku
  expect(dessin).toContain('#E2604A') // celui du relecteur, en Fable
  expect(dessin).toContain('#D97758') // et Clawd, sur le modèle de la conversation
  await ui.unmount()
})

test('trois sous-agents ou plus : le chef sort son sifflet, et ses minis sursautent', async ($, on) => {
  const { horloge } = moteur(on)
  on('classic.SubagentStart', () => ({}))
  on('classic.SubagentStop', () => ({}))
  await $.classic.SubagentStart({ agent_id: 'a1', agent_type: 'Explore' } as never)
  await $.classic.SubagentStart({ agent_id: 'a2', agent_type: 'Plan' } as never)
  let ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  // deux, ça se gère à la planchette
  expect(await scene(ui as never)).toContain('Clawd : chef')
  await ui.unmount()

  await $.classic.SubagentStart({ agent_id: 'a3', agent_type: 'Explore' } as never)
  ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('Clawd : sifflet')
  const dessin = await toutDessin(ui as never)
  expect(dessin).toContain('<g class="au-sifflet"') // toute l'équipe sursaute au coup de sifflet
  expect(dessin).toContain('fbm-2') // les trois minis au travail
  expect(dessin).toContain('<g id="sifflet">') // dessiné une fois, repris à chaque image
  expect(dessin).not.toContain('<text')
  expect(dessin.length).toBeLessThan(40_000)
  // le même d'un rendu à l'autre : l'animation ne redémarre pas
  expect(await toutDessin(ui as never)).toBe(dessin)
  await ui.unmount()

  // l'un d'eux finit : il vient rendre son travail, puis le chef range son sifflet
  await $.classic.SubagentStop({ agent_id: 'a3', agent_type: 'Explore', stop_hook_active: false, agent_transcript_path: '' } as never)
  await horloge.advance(7000)
  ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('Clawd : chef')
  await ui.unmount()
})

test('le sifflet reste léger, même avec les minis les plus chargés', () => {
  const faits = ['marche', 'cherche', 'ecrit', 'build'] as const
  for (const a of faits) for (const b of faits) for (const c of faits) {
    const dessin = svgScene('sifflet', [a, b, c, 'marche'])
    expect(dessin.length).toBeLessThan(40_000)
  }
  // seul, il siffle quand même (et ne promène pas de minis)
  expect(svgScene('sifflet')).not.toContain('fbm-0')
})

test('un sous-agent fini : son mini rend son travail au chef, à sa couleur, puis repart', async ($, on) => {
  const { horloge } = moteur(on)
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: 'a1' }))
  on('classic.SubagentStart', () => ({}))
  on('classic.SubagentStop', () => ({}))
  on('tool.call', { tool: 'Grep' }, () => ({ result: { matches: [] }, text: '' }) as never)
  await $.agent.spawn({ prompt: 'fouille le projet', subagentType: 'Explore' })
  await $.classic.SubagentStart({ agent_id: 'a1', agent_type: 'Explore' } as never)
  await $.classic.SubagentStart({ agent_id: 'a2', agent_type: 'Plan' } as never)
  // l'éclaireur cherche : c'est sa loupe qu'il rapportera
  await $.tool.call({ tool: 'Grep', pattern: 'minuteur', agentId: 'a1' } as never)
  await $.classic.SubagentStop({ agent_id: 'a1', agent_type: 'Explore', stop_hook_active: false, agent_transcript_path: '' } as never)
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('rapport')
  const dessin = String((await svg(ui as never)).source)
  // il s'en va d'un seul mouvement, à l'une de ses façons (tirée au sort : voir le test des sorties)
  expect(dessin).toMatch(/class="rapport-(part|vide|pouf|envol|tourne)"/)
  expect(dessin).toContain('#9CB86A') // le mini de l'éclaireur, en Haiku
  expect(dessin).toContain('#D97758') // Clawd, sur le modèle de la conversation
  expect(dessin).toContain('<g id="objet">') // ce qu'il rapporte, dessiné une fois
  expect(dessin).toContain('#5AB0FF') // le verre de la loupe
  expect(dessin).toContain('fbm-0') // l'autre mini continue de bosser, une place plus loin
  expect(dessin).not.toContain('<text')
  expect(dessin.length).toBeLessThan(40_000)
  // le même d'un rendu à l'autre : l'animation ne redémarre pas
  expect(String((await svg(ui as never)).source)).toBe(dessin)
  // le rapport fini, le chef retourne à son chantier
  await horloge.advance(7000)
  expect(await scene(ui as never)).toContain('chef')
  await ui.unmount()
})

test('chaque mini rapporte ce qu\'il faisait, et le dessin reste léger', () => {
  const objets = (['cherche', 'ecrit', 'build', 'marche'] as const).map(fait => {
    const d = svgScene('rapport', [{ fait: 'build' }, { fait: 'ecrit' }], 0, undefined, { fait })
    expect(d).not.toContain('<text')
    expect(d.length).toBeLessThan(40_000)
    return d.slice(d.indexOf('<g id="objet">'), d.indexOf('</defs>', d.indexOf('<g id="objet">')))
  })
  expect(new Set(objets).size).toBe(4)
  // sans mini qui revient (la planche, l'annonce) : la loupe, dans la teinte de Clawd
  expect(svgScene('rapport')).toContain('#5AB0FF')
  expect(imagesScene('rapport').length).toBe(20)
})

test('le mini s\'en va chaque fois autrement, à sa couleur jusqu\'au bout, et le dessin reste léger', () => {
  const classe = { trotte: 'part', vide: 'vide', pouf: 'pouf', envol: 'envol', tourbillon: 'tourne' } as const
  for (const sortie of SORTIES) {
    // le chef sur Sonnet, le mini sur Haiku : pas une touche de l'orange d'Opus, dans aucune image de sa sortie
    const d = svgScene('rapport', [{ fait: 'build' }], 0, TEINTES.sonnet, { fait: 'cherche', couleur: TEINTES.haiku, sortie })
    expect(d).toContain(`class="rapport-${classe[sortie]}"`)
    expect(d).toContain('#9CB86A')
    expect(d).toContain('#E9A27F')
    expect(d).not.toContain('#D97758')
    expect(d).not.toContain('#BF694F')
    expect(d).not.toContain('<text')
    expect(d.length).toBeLessThan(40_000)
  }
  // jamais deux fois la même de suite, et chacune peut sortir
  for (const s of SORTIES) for (const h of [0, 0.5, 0.999]) expect(autreQue(SORTIES, s, () => h)).not.toBe(s)
  expect(new Set([0, 0.2, 0.4, 0.6, 0.8].map(h => autreQue(SORTIES, null, () => h))).size).toBe(SORTIES.length)
})

test('ses jeux de cartons : joués une fois, légers, sans texte, le carton tombe du ciel puis s’en va', () => {
  const auMilieu = etatBoulot(30)
  for (const jeu of JEUX_CARTONS) {
    const dessin = svgScene(jeu)
    expect(dessin).not.toContain('<text')
    expect(dessin.length).toBeLessThan(40_000)
    expect(svgScene(jeu)).toBe(dessin)
    expect(EMOJI[jeu]).toBeDefined()
    // une fois, de bout en bout (pas en boucle) : une image toutes les 0,15 s
    expect(Math.abs(dureeScene(jeu) - imagesScene(jeu).length * 0.15)).toBeLessThan(0.01)
    // le carton lui tombe du ciel, sa chute calée sur la scène
    expect(dessin).toContain(`.${jeu}-tombe{animation:${jeu}-tombe ${dureeScene(jeu)}s infinite;animation-delay:var(--t0,0s)}`)
    // joué au milieu de ses cartons (en plein déménagement), toujours léger
    expect(svgScene(jeu, [], 0, TEINTES.opus, undefined, undefined, undefined, auMilieu).length).toBeLessThan(40_000)
  }
  // … et le carton s'en va, calé sur la scène : à petits bonds, d'un coup de tambour, par-dessus son épaule ; les gigognes, pouf
  for (const jeu of ['colis', 'tambour', 'podium'] as const) expect(svgScene(jeu)).toMatch(new RegExp(`\\.${jeu}-part\\{[^}]*animation-delay:var\\(--t0,0s\\)\\}`))
  expect(svgScene('gigogne')).toContain('class="gigogne-coeur"')
})

test('au travail, de temps en temps, il fait autre chose d’un carton (jamais le même deux fois de suite), puis reprend ses cartons', { timeoutMs: 60_000 }, async ($, on) => {
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  const { horloge } = moteur(on)
  // (ses minuteurs partent avec la session)
  await $.session.start({ cwd: '/projet', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  // (son coucou de début de session fini)
  await horloge.advance(5000)
  // sa première minute de déménagement : rien que ses cartons
  for (let i = 0; i < 14; i++) {
    await horloge.advance(4000)
    expect(await scene(ui as never)).toContain('boulot')
  }
  // ensuite, un jeu tôt ou tard (une chance sur 12 toutes les 4 s), puis ses cartons ; plus tard, un autre jeu
  const JEU = new RegExp(JEUX_CARTONS.join('|'))
  const prochainJeu = async () => {
    let vu = ''
    for (let i = 0; i < 200 && !JEU.test(vu); i++) {
      await horloge.advance(4000)
      vu = await scene(ui as never)
    }
    return JEU.exec(vu)?.[0]
  }
  const premier = await prochainJeu()
  expect(premier).toBeDefined()
  await horloge.advance(8000)
  expect(await scene(ui as never)).toContain('boulot')
  const second = await prochainJeu()
  expect(second).toBeDefined()
  expect(second).not.toBe(premier)
  await ui.unmount()
})

test('au travail avec son équipe, il dirige le chantier : pas de jeu de cartons', { timeoutMs: 60_000 }, async ($, on) => {
  on('classic.SubagentStart', () => ({}))
  on('agent.list', () => ({ value: [] }) as never)
  on('agent.spawn', () => ({ agentId: 'w1', model: 'claude-opus-5-5' }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  const { horloge } = moteur(on)
  await $.session.start({ cwd: '/projet', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  // 50 s de cartons, puis un sous-agent d'un workflow (il reste jusqu'à son SubagentStop)
  for (let i = 0; i < 12; i++) await horloge.advance(4000)
  await $.agent.spawn({ prompt: 'lis', workflow: { runId: 'wf_1' } } as never)
  await $.classic.SubagentStart({ agent_id: 'w1', agent_type: 'workflow' } as never)
  // 5 min avec lui : il dirige, sans jamais un jeu
  for (let i = 0; i < 75; i++) {
    await horloge.advance(4000)
    const s = await scene(ui as never)
    expect(s).toContain('chef')
    expect(s).not.toMatch(new RegExp(JEUX_CARTONS.join('|')))
  }
  await ui.unmount()
})

test('un sous-agent sur un modèle inconnu garde la couleur de Clawd', async ($, on) => {
  moteur(on)
  on('session.model', () => ({ value: 'claude-sonnet-5-5' }))
  on('agent.spawn', () => ({ model: 'modele-maison-7b', agentId: 'a9' }))
  on('classic.SubagentStart', () => ({}))
  await $.agent.spawn({ prompt: 'aide-moi', subagentType: 'general-purpose' })
  await $.classic.SubagentStart({ agent_id: 'a9', agent_type: 'general-purpose' } as never)
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  const dessin = String((await svg(ui as never)).source)
  expect(dessin).toContain('#E9A27F') // Sonnet : Clawd et son mini
  expect(dessin).not.toContain('#D97758') // pas d'orange Opus par défaut
  await ui.unmount()
})

test('le matin, à sa première session de la journée, il se réveille ; ensuite il est en forme', { timeoutMs: 30_000 }, async ($, on) => {
  const SESSION = { cwd: '/projet', surface: 'desktop', isInteractive: true } as const
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  // tard le soir (heure locale) : la première fois, il ne sait pas quand il t'a vu, simple coucou
  const { horloge, stockage } = moteur(on, undefined, new Date(2026, 9, 14, 23, 40).getTime())
  await $.session.start(SESSION)
  let ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('coucou')
  await ui.unmount()
  // 0 h 20 : c'est encore la même soirée, il ne s'est pas couché
  await horloge.advance(40 * 60_000)
  await $.session.start(SESSION)
  ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('coucou')
  await ui.unmount()
  // il se souvient de cette soirée d'une session à l'autre
  expect(stockage.get('journee')).toBe('2026-10-14')
})

test('le lendemain matin, il émerge, bonnet sur la tête, puis il est en forme', async ($, on) => {
  const SESSION = { cwd: '/projet', surface: 'desktop', isInteractive: true } as const
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  const { horloge, stockage } = moteur(on, undefined, new Date(2026, 9, 15, 8, 0).getTime())
  // la dernière fois qu'il t'a vu, c'était hier soir
  stockage.set('journee', '2026-10-14')
  await $.session.start(SESSION)
  let ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('reveil')
  expect(String((await svg(ui as never)).source)).toContain('@keyframes ch-reveil')
  await ui.unmount()
  // une autre session dans la matinée : il est en forme
  await horloge.advance(10 * 60_000)
  await $.session.start(SESSION)
  expect(await vuJusqua($, horloge, 'coucou')).toContain('coucou')
})

test('une session restée ouverte la nuit : il se réveille à ton premier message du matin', { timeoutMs: 30_000 }, async ($, on) => {
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  const { horloge, stockage } = moteur(on, undefined, new Date(2026, 9, 15, 4, 50).getTime())
  stockage.set('journee', '2026-10-14')
  await $.session.start({ cwd: '/projet', surface: 'desktop', isInteractive: true })
  // 4 h 50 : sa nuit n'est pas finie, il te propose plutôt d'aller te coucher (quand son coucou est fini)
  await $.prompt.submit({ text: 'encore un truc' })
  expect(await vuJusqua($, horloge, 'nuit')).toContain('nuit')
  let ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  await ui.unmount()
  // 5 h 10 : une nouvelle journée commence, il se réveille avec toi
  await horloge.advance(20 * 60_000)
  await $.prompt.submit({ text: 'bonjour' })
  expect(await vuJusqua($, horloge, 'reveil')).toContain('reveil')
  // le message suivant : il écoute, comme d'habitude
  await horloge.advance(60_000)
  await $.prompt.submit({ text: 'et ensuite' })
  expect(await vuJusqua($, horloge, 'ecoute')).toContain('ecoute')
})

test('🥱 : son réveil se dessine sans texte, assez petit, et pareil d’un rendu à l’autre', () => {
  const dessin = svgScene('reveil')
  expect(dessin).not.toContain('<text')
  expect(dessin.length).toBeLessThan(40 * 1024)
  expect(svgScene('reveil')).toBe(dessin)
  // assez d'images pour un vrai mouvement
  expect(imagesScene('reveil').length).toBeGreaterThan(12)
})

test('la galère, puis la délivrance : triste, inquiet, découragé… puis le feu d’artifice', async ($, on) => {
  const sortie = { isError: false, text: 'BUILD SUCCESSFUL' }
  const { horloge } = moteur(on, sortie)
  on('tool.call', { tool: 'Read' }, () => ({ result: { content: '' }, text: '' }) as never)
  const apres = async (cmd: string) => {
    await horloge.advance(20_000)
    await $.tool.call({ tool: 'Bash', command: cmd })
    const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
    const s = await scene(ui as never)
    await ui.unmount()
    return s
  }
  // un build qui passe d'emblée : la fête ordinaire (et le compteur à zéro)
  expect(await apres('./gradlew assembleDebug')).toContain('fete')
  sortie.isError = true
  expect(await apres('./gradlew assembleDebug')).toContain('triste')
  expect(await apres('flutter test')).toContain('gratte')
  expect(await apres('./gradlew assembleDebug')).toContain('decourage')
  expect(await apres('./gradlew assembleDebug')).toContain('decourage')
  // ça passe enfin : la délivrance, qu'une loupe n'interrompt pas
  sortie.isError = false
  await horloge.advance(20_000)
  await $.tool.call({ tool: 'Bash', command: './gradlew assembleDebug' })
  await $.tool.call({ tool: 'Read', file_path: 'a.ts' })
  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('delivrance')
  await ui.unmount()
  // … puis le build suivant redevient une fête ordinaire
  expect(await apres('./gradlew assembleDebug')).toContain('fete')
  // un seul échec, puis une réussite : pas de délivrance
  sortie.isError = true
  expect(await apres('./gradlew assembleDebug')).toContain('triste')
  sortie.isError = false
  expect(await apres('./gradlew assembleDebug')).toContain('fete')
})

test('🎆 : découragement et délivrance se dessinent sans texte, assez petits, pareils d’un rendu à l’autre', () => {
  for (const anim of ['decourage', 'delivrance'] as const) {
    const dessin = svgScene(anim)
    expect(dessin).not.toContain('<text')
    expect(dessin.length).toBeLessThan(40 * 1024)
    expect(svgScene(anim)).toBe(dessin)
    expect(imagesScene(anim).length).toBeGreaterThan(10)
  }
  // le feu d'artifice éclate au-dessus de sa scène, sous une pluie de confettis
  expect(svgScene('delivrance')).toContain('class="confetti"')
})

test('deux heures sans pause : il t’apporte un verre d’eau, une seule fois', { timeoutMs: 30_000 }, async ($, on) => {
  const SESSION = { cwd: '/projet', surface: 'desktop', isInteractive: true } as const
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('turn.complete', () => ({ text: '' }) as never)
  const debut = new Date(2026, 9, 16, 10, 0).getTime()
  const { horloge, stockage } = moteur(on, undefined, debut)
  stockage.set('journee', '2026-10-16')
  // tu travailles déjà depuis une heure
  stockage.set('enchaine', { debut: debut - 60 * 60_000, dernier: debut - 60_000, rappel: false })
  await $.session.start(SESSION)
  // un échange toutes les 14 minutes : tu enchaînes sans vraie pause
  const echange = async (attente = 14 * 60_000) => {
    await horloge.advance(attente)
    await $.prompt.submit({ text: 'la suite' })
    await horloge.advance(30_000)
    await $.turn.complete({ answer: 'fait', durationMs: 30_000, isAborted: false, turnId: String(Math.random()) } as never)
  }
  const vu = async () => {
    const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
    const s = await scene(ui as never)
    await ui.unmount()
    return s
  }
  // près de deux heures de travail : rien encore
  for (let i = 0; i < 4; i++) await echange()
  expect(await vuJusqua($, horloge, 'ecoute')).toContain('ecoute')
  // une nouvelle session n'est pas une pause : la séance continue
  await $.session.start(SESSION)
  // deux heures : le verre d'eau
  await echange()
  expect(await vuJusqua($, horloge, 'pause')).toContain('pause')
  expect(stockage.get('enchaine')).toMatchObject({ rappel: true })
  // il ne t'en reparle pas tant que tu n'as pas soufflé
  await echange()
  expect(await vuJusqua($, horloge, 'ecoute')).toContain('ecoute')
})

test('une vraie pause remet le compteur à zéro ; la séance se reprend d’une session à l’autre', { timeoutMs: 30_000 }, async ($, on) => {
  const SESSION = { cwd: '/projet', surface: 'desktop', isInteractive: true } as const
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('turn.complete', () => ({ text: '' }) as never)
  const debut = new Date(2026, 9, 16, 15, 0).getTime()
  const { horloge, stockage } = moteur(on, undefined, debut)
  stockage.set('journee', '2026-10-16')
  const tour = async (attente: number) => {
    await horloge.advance(attente)
    await $.prompt.submit({ text: 'la suite' })
    await $.turn.complete({ answer: 'fait', durationMs: 1000, isAborted: false, turnId: String(Math.random()) } as never)
    const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
    const s = await scene(ui as never)
    await ui.unmount()
    return s
  }
  // déjà rappelé il y a longtemps, puis tu as soufflé 20 minutes : tout repart de zéro
  stockage.set('enchaine', { debut: debut - 3 * 3_600_000, dernier: debut - 20 * 60_000, rappel: true })
  await $.session.start(SESSION)
  expect(await tour(1000)).not.toContain('pause')
  expect(stockage.get('enchaine')).toMatchObject({ debut: debut + 1000, rappel: false })
  // une séance de 1 h 59 gardée par la session d'avant : il la reprend, et le verre arrive
  stockage.set('enchaine', { debut: debut - 119 * 60_000, dernier: debut - 60_000, rappel: false })
  await $.session.start(SESSION)
  await tour(2 * 60_000)
  // son verre d'eau attend la fin de ce qu'il fait (une action ne se coupe jamais), puis il le sert
  let vue = ''
  for (let i = 0; i < 20 && !vue.includes('pause'); i++) {
    await horloge.advance(1000)
    const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
    vue = await scene(ui as never)
    await ui.unmount()
  }
  expect(vue).toContain('pause')
})

test('🥛 : le verre d’eau se dessine sans texte, assez petit, pareil d’un rendu à l’autre', () => {
  const dessin = svgScene('pause')
  expect(dessin).not.toContain('<text')
  expect(dessin.length).toBeLessThan(40 * 1024)
  expect(svgScene('pause')).toBe(dessin)
  expect(imagesScene('pause').length).toBeGreaterThan(12)
  // ce n'est pas une activité de repos : il ne la joue que pour toi
  expect(ACTIVITES).not.toContain('pause')
})

test('ses scènes vont au bout : une petite réaction attend la fin de la scène en cours, puis la plus récente passe', async ($, on) => {
  const { horloge } = moteur(on)
  on('tool.call', { tool: 'Read' }, () => ({ result: { content: '' }, text: '' }) as never)
  on('tool.call', { tool: 'Write' }, () => ({ result: { content: '' }, text: '' }) as never)
  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  // une loupe se joue ; un crayon arrive pendant : il attend, sans la couper
  await $.tool.call({ tool: 'Read', file_path: 'a.ts' })
  expect(await scene(ui as never)).toContain('cherche')
  await $.tool.call({ tool: 'Write', file_path: 'a.ts', content: 'x' })
  expect(await scene(ui as never)).toContain('cherche')
  // la loupe finie, le crayon passe
  await horloge.advance(5000)
  expect(await scene(ui as never)).toContain('ecrit')
  await ui.unmount()
})

test('une petite réaction trop vieille ne se joue plus quand son tour arrive', async ($, on) => {
  const { horloge } = moteur(on, { isError: false, text: 'BUILD SUCCESSFUL', attente: 30_000 })
  on('tool.call', { tool: 'Read' }, () => ({ result: { content: '' }, text: '' }) as never)
  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  // un build qui dure ; la loupe arrive pendant et attend… 30 s : elle ne dit plus rien de ce qui se passe
  const build = $.tool.call({ tool: 'Bash', command: './gradlew assembleDebug' })
  await horloge.advance(100)
  await $.tool.call({ tool: 'Read', file_path: 'a.ts' })
  expect(await scene(ui as never)).toContain('build')
  await horloge.advance(31_000)
  await build
  // le build fini : la fête, jamais la vieille loupe
  expect(await scene(ui as never)).toContain('fete')
  await horloge.advance(7000)
  expect(await scene(ui as never)).not.toContain('cherche')
  await ui.unmount()
})

test('le verdict passe devant ce qui dure, et un build interrompu par une question reprend ensuite', async ($, on) => {
  const { horloge } = moteur(on, { isError: false, text: 'BUILD SUCCESSFUL', attente: 30_000 })
  on('tool.call', { tool: 'AskUserQuestion' }, async () => {
    await horloge.sleep(5000)
    return { result: { answers: [] }, text: '' } as never
  })
  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  // le build dure 30 s ; une question (priorité 4) passe devant, puis le build reprend sa scène
  const build = $.tool.call({ tool: 'Bash', command: './gradlew assembleDebug' })
  await horloge.advance(1000)
  expect(await scene(ui as never)).toContain('build')
  const question = $.tool.call({ tool: 'AskUserQuestion', questions: [] } as never)
  await horloge.advance(100)
  expect(await scene(ui as never)).toContain('question')
  await horloge.advance(5000)
  await question
  expect(await scene(ui as never)).toContain('build')
  // le build finit : la fête passe, et la scène du build ne revient pas
  await horloge.advance(25_000)
  await build
  expect(await scene(ui as never)).toContain('fete')
  await horloge.advance(7000)
  expect(await scene(ui as never)).not.toContain('build')
  await ui.unmount()
})

test('une activité commencée va au bout même quand Claude se met au travail, puis il prend ses cartons', async ($, on) => {
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  const { horloge, stockage } = moteur(on, undefined, new Date(2026, 9, 16, 15, 0).getTime())
  stockage.set('journee', '2026-10-16')
  await $.session.start({ cwd: '/projet', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  // sa balade, puis une activité : on attend qu'elle commence
  let anim = ''
  for (let i = 0; i < 40 && !anim; i++) {
    await horloge.advance(2000)
    const s = await scene(ui as never)
    if (!/balade|coucou|reveil|boulot|dodo/.test(s)) anim = s
  }
  expect(anim).not.toBe('')
  // Claude se met au travail pendant l'activité : elle continue (pas de cartons d'un coup)
  await ui.unmount()
  const travail = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(travail as never)).toBe(anim)
  await travail.unmount()
})

test('compactage : le paquet passé, la pile ne se retasse pas (la scène s’arrête avec le compactage)', async ($, on) => {
  const { horloge } = moteur(on)
  on('session.compact', async () => {
    await horloge.sleep(10_000)
    return { messages: RESUME }
  })
  const fini = $.session.compact({ trigger: 'manual', messages: CONVERSATION })
  await horloge.advance(10_000)
  await fini
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('paquet')
  // le paquet fini (6 s) : plus rien du compactage, il ne reprend pas la tasse pendant 15 min
  await horloge.advance(8000)
  expect(await scene(ui as never)).not.toContain('tasse')
  await horloge.advance(20 * 60_000)
  expect(await scene(ui as never)).not.toContain('tasse')
  await ui.unmount()
})

test('deux commandes en parallèle : celle qui finit vite n’efface pas la scène du build qui dure', async ($, on) => {
  const { horloge } = moteur(on, { isError: false, text: 'BUILD SUCCESSFUL', attente: cmd => (/gradlew/.test(cmd) ? 30_000 : 100) })
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  const build = $.tool.call({ tool: 'Bash', command: './gradlew assembleDebug' })
  await horloge.advance(500)
  const statut = $.tool.call({ tool: 'Bash', command: 'git status' })
  await horloge.advance(500)
  await statut
  // git status a fini : le build tourne encore, sa scène aussi
  expect(await scene(ui as never)).toContain('build')
  await horloge.advance(30_000)
  await build
  expect(await scene(ui as never)).toContain('fete')
  await ui.unmount()
})

test('une commande qui plante ou qu’on interrompt : sa scène ne reste pas', async ($, on) => {
  const { horloge } = moteur(on, { isError: false, text: 'ok', attente: 1000, plante: true })
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  const build = $.tool.call({ tool: 'Bash', command: './gradlew assembleDebug' }).catch(() => {})
  await horloge.advance(500)
  expect(await scene(ui as never)).toContain('build')
  await horloge.advance(1000)
  await build
  expect(await scene(ui as never)).not.toContain('build')
  await ui.unmount()
})

test('un tour fini (même interrompu) ne laisse plus rien qui tourne', async ($, on) => {
  const { horloge } = moteur(on, { isError: false, text: 'ok', attente: 60_000 })
  on('turn.complete', () => ({ text: '' }) as never)
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  void $.tool.call({ tool: 'Bash', command: './gradlew assembleDebug' }).catch(() => {})
  await horloge.advance(500)
  expect(await scene(ui as never)).toContain('build')
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: true, turnId: 't', reason: 'aborted' } as never)
  expect(await scene(ui as never)).not.toContain('build')
  await ui.unmount()
})

test('♥ pendant une question posée : il fait son cœur, puis la pancarte revient', async ($, on) => {
  const { horloge } = moteur(on)
  on('tool.call', { tool: 'AskUserQuestion' }, async () => {
    await horloge.sleep(60_000)
    return { result: { answers: [] }, text: '' } as never
  })
  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  void $.tool.call({ tool: 'AskUserQuestion', questions: [] } as never).catch(() => {})
  await horloge.advance(500)
  expect(await scene(ui as never)).toContain('question')
  await ui.press({ key: 'caresse' })
  expect(await scene(ui as never)).toContain('coeur')
  await horloge.advance(3500)
  // sa question est toujours posée : la pancarte revient
  expect(await scene(ui as never)).toContain('question')
  await ui.unmount()
})

test('un rechargement ou une nouvelle session : les scènes repartent de zéro', async ($, on) => {
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  const { horloge } = moteur(on, { isError: false, text: 'ok', attente: 60_000 })
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  void $.tool.call({ tool: 'Bash', command: './gradlew assembleDebug' }).catch(() => {})
  await horloge.advance(500)
  expect(await scene(ui as never)).toContain('build')
  await $.session.start({ cwd: '/projet', surface: 'desktop', isInteractive: true })
  expect(await scene(ui as never)).not.toContain('build')
  await ui.unmount()
})

test('un outil d’un sous-agent qui finit ne lui fait pas baisser la patte : la permission attend toujours', async ($, on) => {
  moteur(on)
  on('classic.PermissionRequest', () => ({}))
  on('tool.call', { tool: 'Read' }, () => ({ result: { content: '' }, text: '' }) as never)
  await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'rm -rf build' } } as never)
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('attend')
  // un sous-agent lit un fichier : la boîte de permission du tour principal est toujours ouverte
  await $.tool.call({ tool: 'Read', file_path: 'a.ts', agentId: 'a1' } as never)
  expect(await scene(ui as never)).toContain('attend')
  // le tour principal fait l'action autorisée : elle est faite, il baisse la patte
  await $.tool.call({ tool: 'Bash', command: 'rm -rf build' })
  expect(await scene(ui as never)).not.toContain('attend')
  await ui.unmount()
})

test('ses danses : le 6-7 et les clins d’œil aux emotes, sans texte, légères, identiques d’un rendu à l’autre', () => {
  expect(DANSES).toEqual(['danse', 'floss', 'orange', 'defaut', 'griddy', 'takel', 'sixseven'])
  for (const d of DANSES) {
    const dessin = svgScene(d)
    expect(dessin).not.toContain('<text')
    expect(dessin.length).toBeLessThan(40 * 1024)
    expect(svgScene(d)).toBe(dessin)
    // plusieurs images : il bouge vraiment
    expect(new Set(imagesScene(d)).size).toBeGreaterThanOrEqual(4)
  }
  // il les fait aussi tout seul, de temps en temps
  for (const d of DANSES.filter(x => x !== 'danse')) expect(ACTIVITES).toContain(d)
})

test('🕺 : à ton clic il danse, et jamais deux fois la même danse d’affilée', async ($, on) => {
  const { horloge } = moteur(on)
  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  expect(await ui.find({ key: 'danse' })).toBeDefined()
  const vues: string[] = []
  for (let i = 0; i < 8; i++) {
    await ui.press({ key: 'danse' })
    const s = await scene(ui as never)
    const nom = DANSES.find(d => s.endsWith(`: ${d}`))
    expect(nom).toBeDefined()
    vues.push(nom!)
    await horloge.advance(11_000)
  }
  for (let i = 1; i < vues.length; i++) expect(vues[i]).not.toBe(vues[i - 1])
  await ui.unmount()
})

test('🕺 pendant une question posée : il danse, puis la pancarte revient', async ($, on) => {
  const { horloge } = moteur(on)
  on('tool.call', { tool: 'AskUserQuestion' }, async () => {
    await horloge.sleep(120_000)
    return { result: { answers: [] }, text: '' } as never
  })
  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  void $.tool.call({ tool: 'AskUserQuestion', questions: [] } as never).catch(() => {})
  await horloge.advance(500)
  await ui.press({ key: 'danse' })
  const s = await scene(ui as never)
  expect(DANSES.some(d => s.endsWith(`: ${d}`))).toBe(true)
  await horloge.advance(12_000)
  expect(await scene(ui as never)).toContain('question')
  await ui.unmount()
})

test('une action ne se coupe pas par un verdict ; ton ♥ et ton 🕺, eux, passent tout de suite, même l’un par-dessus l’autre', async ($, on) => {
  const { horloge } = moteur(on)
  on('tool.call', { tool: 'Read' }, () => ({ result: { content: '' }, text: '' }) as never)
  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  // une loupe se joue (une action)
  await $.tool.call({ tool: 'Read', file_path: 'a.ts' })
  expect(await scene(ui as never)).toContain('cherche')
  // un verdict (priorité 3) arrive : il attend, il ne coupe pas
  await $.tool.call({ tool: 'Bash', command: './gradlew assembleDebug' })
  expect(await scene(ui as never)).toContain('cherche')
  // ton ♥ : la loupe s'arrête, son cœur tout de suite
  await ui.press({ key: 'caresse' })
  expect(await scene(ui as never)).toContain('coeur')
  // ton 🕺 aussitôt après : il n'attend pas la fin du cœur
  await ui.press({ key: 'danse' })
  const s = await scene(ui as never)
  expect(DANSES.some(d => s.endsWith(`: ${d}`))).toBe(true)
  // sa danse finie, le verdict qui attendait passe (il n'est pas jeté)
  await horloge.advance(10_500)
  expect(await scene(ui as never)).toContain('fete')
  await ui.unmount()
})

test('un git pull réussi : une petite fête ; rien de neuf, rien ; refusé, triste', async ($, on) => {
  const { horloge } = moteur(on, {
    isError: false,
    text: 'ok',
    selon: cmd =>
      cmd === 'git pull'
        ? { isError: false, text: 'Updating 1a2b3c4..5d6e7f8\nFast-forward\n' }
        : cmd.includes('-C a')
          ? { isError: false, text: 'Already up to date.\n' }
          : cmd.includes('-C b')
            ? { isError: true, text: 'fatal: Not possible to fast-forward, aborting.\n' }
            : undefined,
  })
  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  await $.tool.call({ tool: 'Bash', command: 'git pull' })
  expect(await scene(ui as never)).toContain('fete')
  await horloge.advance(5000)
  await $.tool.call({ tool: 'Bash', command: 'git -C a pull' })
  expect(await scene(ui as never)).not.toContain('fete')
  await $.tool.call({ tool: 'Bash', command: 'git -C b pull --ff-only' })
  expect(await scene(ui as never)).toContain('triste')
  await ui.unmount()
})

test('deux clics sur 🕺 : la deuxième danse part tout de suite, sans attendre la fin de la première', async ($, on) => {
  const { horloge } = moteur(on)
  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  await ui.press({ key: 'danse' })
  const premiere = await scene(ui as never)
  await horloge.advance(1000)
  await ui.press({ key: 'danse' })
  const deuxieme = await scene(ui as never)
  expect(DANSES.some(d => deuxieme.endsWith(`: ${d}`))).toBe(true)
  expect(deuxieme).not.toBe(premiere)
  await ui.unmount()
  // et deux ♥ : le deuxième cœur repart de son début (un passage neuf, son dessin recalé à zéro), sans attendre la fin du premier
  const ui2 = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  await ui2.press({ key: 'caresse' })
  await horloge.advance(1500)
  await ui2.unmount()
  const ui3 = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  expect(String((await svg(ui3 as never)).source)).toContain('--t0:-1.5s')
  await ui3.press({ key: 'caresse' })
  expect(await scene(ui3 as never)).toContain('coeur')
  expect(String((await svg(ui3 as never)).source)).toContain('style="--t0:0s"')
  await ui3.unmount()
})

test('ton ♥ pendant une activité : elle s’arrête, son cœur passe tout de suite', async ($, on) => {
  moteur(on)
  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  await ui.press({ key: 'occupe' })
  const activite = (await scene(ui as never)).replace('Clawd : ', '')
  expect([...ACTIVITES, 'question', 'attend'].includes(activite as never)).toBe(true)
  await ui.press({ key: 'caresse' })
  expect(await scene(ui as never)).toContain('coeur')
  await ui.unmount()
})

test('un numéro ne se coupe pas non plus : ni par un message, ni par une question', async ($, on) => {
  // le seul qui coupe, c'est ton 🎲 (zapper, c'est son rôle) : voir les tests de la bande
  const { horloge } = moteur(on, undefined, undefined)
  on('tool.call', { tool: 'AskUserQuestion' }, async () => {
    await horloge.sleep(1000)
    return { result: { answers: [] }, text: '' } as never
  })
  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  const fond = await scene(ui as never)
  await $.command.run({ command: 'clawd', args: 'montre cadre', origin: { kind: 'composer' } })
  await $.prompt.submit({ text: 'tu fais quoi ?' })
  const q = $.tool.call({ tool: 'AskUserQuestion', questions: [] } as never)
  await horloge.advance(500)
  // la question est posée : ni sa pancarte ni sa réaction à ton message ne sont venues par-dessus le numéro
  expect(await scene(ui as never)).toBe(fond)
  await horloge.advance(1000)
  await q
  // le numéro (le cadre dure 20 s) se joue toujours, et aucune scène n'est venue par-dessus
  expect(await ui.find({ key: 'grande-scene' })).toBeDefined()
  expect(await scene(ui as never)).toBe(fond)
  await ui.unmount()
})

test('une activité ne se coupe pas non plus : une loupe pendant sa lecture attend la fin de la lecture', { timeoutMs: 30_000 }, async ($, on) => {
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('tool.call', { tool: 'Read' }, () => ({ result: { content: '' }, text: '' }) as never)
  const { horloge, stockage } = moteur(on, undefined, new Date(2026, 9, 16, 15, 0).getTime())
  stockage.set('journee', '2026-10-16')
  await $.session.start({ cwd: '/projet', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  // on attend qu'il commence une activité
  let anim = ''
  for (let i = 0; i < 60 && !anim; i++) {
    await horloge.advance(2000)
    const s = await scene(ui as never)
    if (!/balade|coucou|reveil|boulot|dodo/.test(s)) anim = s
  }
  expect(anim).not.toBe('')
  // un outil lancé en pleine activité : sa scène n'est pas venue par-dessus
  await $.tool.call({ tool: 'Read', file_path: 'a.ts' })
  expect(await scene(ui as never)).toBe(anim)
  await ui.unmount()
})

/** Où en est sa scène (s) d'après la source de son dessin (son décalage `--t0`), 0 si elle n'en a pas */
const decalage = (source: unknown) => Number(/--t0:-([0-9.]+)s/.exec(String(source))?.[1] ?? 0)

test('chaque scène a son issue : on sait à tout instant où elle le laisse, et rien ne le déplace en douce', () => {
  for (const anim of Object.keys(EMOJI) as (keyof typeof EMOJI)[]) {
    const T = dureeScene(anim)
    // où il est, à tout instant : jamais hors de sa petite scène
    for (let k = 0; k <= 20; k++) {
      const { x } = etatScene(anim, (k / 20) * T)
      expect(Number.isFinite(x)).toBe(true)
      expect(Math.abs(x)).toBeLessThan(140)
    }
    // une classe qui le déplace tout entier (au-delà d'un frisson de quelques unités) doit être connue d'etatScene,
    // sinon la scène suivante ne saurait pas d'où il part (il sauterait)
    const cls = classeDe(anim)
    if (!cls) continue
    const images = new RegExp(`@keyframes ${cls}\\{((?:[^{}]*\\{[^{}]*\\})*)\\}`).exec(svgScene(anim))?.[1] ?? ''
    const deplace = [...images.matchAll(/translateX\((-?[\d.]+)px\)/g)].some(m => Math.abs(Number(m[1])) > 3)
    if (deplace) expect(CLASSES_QUI_DEPLACENT).toContain(cls)
  }
  // sa promenade dure un aller-retour entier : elle finit chez lui
  expect(dureeScene('promenade')).toBe(9)
  expect(etatScene('promenade', 4.05).x).toBe(-90)
  expect(Math.abs(etatScene('promenade', 8.999).x)).toBeLessThan(0.5)
})

test('le recalage : tout son dessin suit `--t0`, au dixième de seconde près ; sans décalage, la source est la même', () => {
  const s = svgScene('boulot')
  expect(s).toContain('style="--t0:0s"')
  // ses images, son trajet et ses cartons partent tous de `--t0`
  expect(s).toContain('animation-delay:var(--t0,0s)')
  expect(s).not.toMatch(/infinite steps\(1,end\)}/)
  expect(avecT0(s, 12.34)).toContain('style="--t0:-12.3s"')
  expect(avecT0(s, 0.04)).toBe(s)
  expect(svgScene('boulot', [], 7.26)).toBe(avecT0(s, 7.26))
  // une scène en images (la fête) aussi : chaque image part de `--t0`, plus sa tranche
  expect(svgScene('fete')).toContain('animation-delay:calc(var(--t0,0s) - ')
})

test('un numéro lancé en plein déménagement part de là où il en est et y revient : ses cartons l’attendent dans son coin, et il reprend pile là', { timeoutMs: 30_000 }, async ($, on) => {
  const { horloge } = moteur(on)
  // ce qu'il écrit dans son état (son numéro)
  const ecrits: { key: string; value: unknown }[] = []
  on('state.set', ($, e, next) => {
    ecrits.push({ key: (e as { key: string }).key, value: (e as { value: unknown }).value })
    return next(e)
  })
  // il déménage depuis 10 s
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('boulot')
  expect(decalage((await svg(ui as never)).source)).toBe(0)
  await horloge.advance(10_000)
  const avant = String((await svg(ui as never)).source)
  // la même source tant que rien ne change : rien ne redémarre
  expect(String((await svg(ui as never)).source)).toBe(avant)
  // un numéro sur la bande : il part de là où il en est (en px de bande depuis son coin)
  await $.command.run({ command: 'clawd', args: 'montre tournee', origin: { kind: 'composer' } })
  await horloge.advance(100)
  const n = ecrits.filter(x => x.key === 'numero').at(-1)?.value as { depart?: number } | null | undefined
  const ici = etatBoulot(10)
  expect(n?.depart).toBe(departDe(ici.x))
  // son coin ne garde que ses cartons, à leur place (pas de Clawd : il est sur la bande)
  const coin = String((await svg(ui as never)).source)
  expect(coin).not.toBe(COIN_VIDE)
  expect(coin).toContain(ici.decor)
  await horloge.advance(25_000)
  // le numéro fini (il est revenu là où il était), il reprend ses cartons pile là : 10 s, pas plus (rien n'a avancé
  // pendant le numéro), et jamais au début
  expect(decalage((await svg(ui as never)).source)).toBe(10)
  // et il n'a plus bougé tant que rien ne change
  await horloge.advance(10_000)
  expect(decalage((await svg(ui as never)).source)).toBe(10)
  await ui.unmount()
})

test('un changement de modèle en plein déménagement ne le fait pas reculer non plus', { timeoutMs: 30_000 }, async ($, on) => {
  const { horloge } = moteur(on)
  on('classic.PostModelSwitch', () => ({}))
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  await horloge.advance(30_000)
  await $.classic.PostModelSwitch({ from_model: 'claude-haiku-5-5', to_model: 'claude-fable-5-1', requested_model: 'fable', source: 'command' } as never)
  const d = decalage((await svg(ui as never)).source)
  // sa couleur change, son dessin est recréé : à ~30 s, pas au début
  expect(Math.abs(d - 30)).toBeLessThan(0.2)
  await ui.unmount()
})

test('la permission demandée par un sous-agent ne le fait pas lever la patte', async ($, on) => {
  moteur(on)
  on('classic.PermissionRequest', () => ({}))
  await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'rm x' }, agent_id: 'a1' } as never)
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(ui as never)).not.toContain('attend')
  await ui.unmount()
})

test('pendant que Claude travaille, il ne s’endort pas, même sans un signe de toi depuis longtemps', { timeoutMs: 30_000 }, async ($, on) => {
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  const { horloge, stockage } = moteur(on, undefined, new Date(2026, 9, 15, 23, 30).getTime())
  stockage.set('journee', '2026-10-15')
  await $.session.start({ cwd: '/projet', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  // la nuit, 40 min de travail sans un mot de toi : il déménage toujours (ou joue avec un de ses cartons)
  for (let i = 0; i < 40; i++) {
    await horloge.advance(60_000)
    expect(await scene(ui as never)).toMatch(/boulot|colis|gigogne|tambour|podium/)
  }
  await ui.unmount()
})

test('un mini-Clawd d’une session d’avant ne reste pas : une nouvelle session repart sans équipe fantôme', { timeoutMs: 30_000 }, async ($, on) => {
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('classic.SubagentStart', () => ({}))
  // (son agent n'est plus dans la liste des agents de la session)
  on('agent.list', () => ({ value: [] }) as never)
  const { horloge } = moteur(on)
  await $.classic.SubagentStart({ agent_id: 'a1', agent_type: 'Explore' } as never)
  let ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('chef')
  await ui.unmount()
  // un SubagentStop manqué : la nouvelle session ne le garde pas en chef de chantier (le ménage de la minute le range ;
  // un rechargement du module, lui, ne vide plus l'équipe d'un coup : des sous-agents peuvent encore travailler)
  await $.session.start({ cwd: '/projet', surface: 'desktop', isInteractive: true })
  await horloge.advance(2 * 60_000 + 5000)
  ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('boulot')
  await ui.unmount()
})

test('au travail, une activité finie : ses cartons reviennent aussitôt, pas quelques secondes après', { timeoutMs: 30_000 }, async ($, on) => {
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  const { horloge, stockage } = moteur(on, undefined, new Date(2026, 9, 16, 15, 0).getTime())
  stockage.set('journee', '2026-10-16')
  await $.session.start({ cwd: '/projet', surface: 'desktop', isInteractive: true })
  const repos = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  let anim = ''
  for (let i = 0; i < 60 && !anim; i++) {
    await horloge.advance(1000)
    const s = (await scene(repos as never)).replace('Clawd : ', '')
    // (pas son coucou du début de session : c'est une scène, pas une activité)
    if (s !== 'coucou' && [...ACTIVITES, ...VISITEURS, 'question', 'attend'].includes(s as never)) anim = s
  }
  await repos.unmount()
  expect(anim).not.toBe('')
  // Claude se met au travail en pleine activité : elle va au bout…
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(ui as never)).toContain(anim)
  // … et dès sa fin (elle a commencé il y a au plus 1 s), les cartons
  await horloge.advance(dureeScene(anim as never) * 1000 + 100)
  // (une demi-seconde de marge au plus, bien moins que le tic de 4 s d'avant)
  for (let k = 0; k < 5 && !(await scene(ui as never)).includes('boulot'); k++) await horloge.advance(100)
  expect(await scene(ui as never)).toContain('boulot')
  await ui.unmount()
})

test('une commande qui parle d’un build ou de tests sans en lancer un : pas de scène de build ni de verdict', async ($, on) => {
  const { horloge } = moteur(on)
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  for (const cmd of ['git commit -m "lance ./gradlew assembleDebug"', 'grep -rn pytest .', 'echo flutter build']) {
    await $.tool.call({ tool: 'Bash', command: cmd })
    const s = await scene(ui as never)
    expect(s).not.toContain('build')
    expect(s).not.toContain('tests')
    expect(s).not.toContain('fete')
    await horloge.advance(8000)
  }
  // installer pytest, c'est déballer des dépendances, pas lancer des tests
  await $.tool.call({ tool: 'Bash', command: 'python -m pip install pytest' })
  expect(await scene(ui as never)).not.toContain('tests')
  await ui.unmount()
})

test('les vraies commandes sont reconnues, même derrière un cd, des variables ou un lanceur', async ($, on) => {
  const { horloge } = moteur(on, { isError: false, text: 'ok', attente: 60_000 })
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  for (const [cmd, anim] of [
    ['cd app && ./gradlew assembleDebug', 'build'],
    ['CI=1 uv run pytest -q', 'tests'],
    ['"$CL" plugin test clawd', 'tests'],
    ['npm ci', 'deballe'],
  ] as const) {
    void $.tool.call({ tool: 'Bash', command: cmd }).catch(() => {})
    await horloge.advance(500)
    expect(await scene(ui as never)).toContain(anim)
    await horloge.advance(61_000)
    await horloge.advance(10_000)
  }
  await ui.unmount()
})

test('un build lancé en arrière-plan : pas de fête tout de suite, il martèle jusqu’à la fin du tour', async ($, on) => {
  const { horloge } = moteur(on, { isError: false, text: 'Command running in background', enFond: true })
  on('turn.complete', () => ({ text: '' }) as never)
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  await $.tool.call({ tool: 'Bash', command: './gradlew assembleDebug', run_in_background: true } as never)
  await horloge.advance(500)
  // la commande a rendu la main mais le build tourne : pas de verdict, sa scène continue
  expect(await scene(ui as never)).toContain('build')
  await $.turn.complete({ answer: 'je lance le build', durationMs: 1000, isAborted: false, turnId: 't' } as never)
  expect(await scene(ui as never)).not.toContain('build')
  await ui.unmount()
})

test('deux fêtes d’affilée en fin de tour : non, une seule', async ($, on) => {
  const { horloge } = moteur(on, { isError: false, text: 'BUILD SUCCESSFUL' })
  on('turn.complete', () => ({ text: '' }) as never)
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  await $.tool.call({ tool: 'Bash', command: './gradlew assembleDebug' })
  expect(await scene(ui as never)).toContain('fete')
  // le tour (long) finit juste après : sa fête n'est pas rejouée derrière celle du build
  await $.turn.complete({ answer: 'fait', durationMs: 10 * 60_000, isAborted: false, turnId: 't' } as never)
  await horloge.advance(6500)
  expect(await scene(ui as never)).not.toContain('fete')
  await ui.unmount()
})

test('un mini-Clawd dont le sous-agent est fini sans le dire s’en va, une minute après', { timeoutMs: 30_000 }, async ($, on) => {
  on('classic.SubagentStart', () => ({}))
  on('agent.list', () => ({ value: [] }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  const { horloge } = moteur(on)
  await $.session.start({ cwd: '/projet', surface: 'desktop', isInteractive: true })
  await $.classic.SubagentStart({ agent_id: 'a1', agent_type: 'Explore' } as never)
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  // (son coucou de début de session fini)
  await horloge.advance(5000)
  expect(await scene(ui as never)).toContain('chef')
  await horloge.advance(3 * 60_000)
  expect(await scene(ui as never)).not.toContain('chef')
  await ui.unmount()
})

test('un mini-Clawd d’un workflow (absent de la liste des agents) reste jusqu’à son SubagentStop, même à travers un rechargement', { timeoutMs: 30_000 }, async ($, on) => {
  on('classic.SubagentStart', () => ({}))
  on('classic.SubagentStop', () => ({}))
  on('agent.list', () => ({ value: [] }) as never)
  on('agent.spawn', () => ({ agentId: 'w1', model: 'claude-opus-5-5' }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  const { horloge } = moteur(on)
  await $.session.start({ cwd: '/projet', surface: 'desktop', isInteractive: true })
  await $.agent.spawn({ prompt: 'lis', workflow: { runId: 'wf_1' } } as never)
  await $.classic.SubagentStart({ agent_id: 'w1', agent_type: 'workflow' } as never)
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  await horloge.advance(5000)
  expect(await scene(ui as never)).toContain('chef')
  // 5 min sans être listé, et un rechargement du module : il est toujours là
  await horloge.advance(5 * 60_000)
  await $.session.start({ cwd: '/projet', surface: 'desktop', isInteractive: true })
  await horloge.advance(2 * 60_000)
  expect(await scene(ui as never)).toContain('chef')
  await ui.unmount()
})

test('pendant qu’il porte ses cartons, son image part toujours de là où il en est (l’app la recrée quand la bande change) ; chef, sa bulle est à part', { timeoutMs: 30_000 }, async ($, on) => {
  const { horloge } = moteur(on)
  on('classic.PostModelSwitch', () => ({}))
  on('classic.SubagentStart', () => ({}))
  on('tool.call', { tool: 'Read' }, () => ({ result: {}, text: '' }) as never)
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  const clawd = async () => String((await svg(ui as never)).source)
  await horloge.advance(12_000)
  const avant = await clawd()
  // une lecture toutes les 3 s et des commandes pendant une minute : à chaque dessin, son image (si l'app la
  // recrée) part de là où il en est vraiment (son dernier dessin date au plus de la fin de sa bulle, 0,5 s avant)
  for (let i = 0; i < 20; i++) {
    await $.tool.call({ tool: i % 4 ? 'Read' : 'Bash', ...(i % 4 ? { file_path: 'x' } : { command: `git commit -m ${i}` }) } as never)
    await horloge.advance(3000)
    const ecart = 12 + 3 * (i + 1) - decalage(await clawd())
    expect(ecart).toBeGreaterThan(-0.05)
    expect(ecart).toBeLessThan(0.55)
  }
  // rien de nouveau : la même image (l'app n'en relance pas une pour rien)
  const meme = await clawd()
  await horloge.advance(100)
  expect(await clawd()).toBe(meme)
  // un changement de modèle (sa couleur) refait son image, à là où il en est
  await $.classic.PostModelSwitch({ from_model: 'claude-haiku-5-5', to_model: 'claude-fable-5-1', requested_model: 'fable', source: 'command' } as never)
  expect(await clawd()).not.toBe(avant)
  // (il reprend là où il en est : 72 s de déménagement)
  expect(Math.abs(decalage(await clawd()) - 72)).toBeLessThan(0.2)
  await horloge.advance(8000)
  // un sous-agent démarre : il passe chef (il ne bouge pas) ; sa bulle est à part, sans trajet
  await $.classic.SubagentStart({ agent_id: 'a1', agent_type: 'Explore' } as never)
  expect(await scene(ui as never)).toContain('chef')
  await horloge.advance(6000)
  await $.tool.call({ tool: 'Bash', command: 'git commit -m c' })
  const b = ((await ui.find({ key: 'bulle' }))?.children[0] as { props: { source: string } } | undefined)?.props.source
  expect(b).toBeDefined()
  expect(String(b)).not.toContain('ch-chef-bulle')
  await ui.unmount()
})

test('un sous-agent qui change d’outil ne fait pas reprendre son geste au chef : seul le dessin des minis change', async ($, on) => {
  moteur(on)
  on('classic.SubagentStart', () => ({}))
  on('tool.call', { tool: 'Grep' }, () => ({ result: { matches: [] }, text: '' }) as never)
  on('tool.call', { tool: 'Edit' }, () => ({ result: {}, text: '' }) as never)
  for (const id of ['a1', 'a2', 'a3']) await $.classic.SubagentStart({ agent_id: id, agent_type: 'Explore' } as never)
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('sifflet')
  const chef = String((await svg(ui as never)).source)
  const minis = async () => String((await ui.find({ key: 'minis' }))?.children.map(c => String((c as { props: { source: string } }).props.source)).join(''))
  const avant = await minis()
  // l'un cherche, puis un autre écrit : leurs minis changent…
  await $.tool.call({ tool: 'Grep', pattern: 'x', agentId: 'a1' } as never)
  await $.tool.call({ tool: 'Edit', file_path: 'a.ts', agentId: 'a2' } as never)
  expect(await minis()).not.toBe(avant)
  // … mais son dessin à lui reste le même : il ne reprend pas son geste au début
  expect(String((await svg(ui as never)).source)).toBe(chef)
  // et ses minis sursautent toujours au rythme de son sifflet (calés sur son horloge)
  expect(await minis()).toContain('au-sifflet')
  await ui.unmount()
})

/** Regarde sa scène dans un affichage déjà monté, seconde après seconde, jusqu'à ce que `motif` y soit */
async function guette(ui: unknown, horloge: { advance: (ms: number) => Promise<void> }, motif: string, secondes = 20) {
  let s = ''
  for (let i = 0; i <= secondes && !s.includes(motif); i++) {
    if (i) await horloge.advance(1000)
    s = await scene(ui as never)
  }
  return s
}

test('🎲 pendant un build, puis ♥ : chacun passe tout de suite devant le build, qui reprend ensuite', async ($, on) => {
  const { horloge } = moteur(on, { isError: false, text: 'ok', attente: 120_000 })
  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  void $.tool.call({ tool: 'Bash', command: './gradlew assembleDebug' }).catch(() => {})
  await horloge.advance(500)
  expect(await scene(ui as never)).toContain('build')
  await ui.press({ key: 'occupe' })
  // ton 🎲 : une activité tout de suite (ou un de ses appels), devant le build, le temps d'une danse au plus
  const s = (await scene(ui as never)).replace('Clawd : ', '')
  expect([...ACTIVITES, 'question', 'attend'].includes(s as never)).toBe(true)
  // ton ♥ par-dessus : son cœur tout de suite, puis le build revient (il informe : il ne se perd pas)
  await ui.press({ key: 'caresse' })
  expect(await scene(ui as never)).toContain('coeur')
  await horloge.advance(3500)
  expect(await scene(ui as never)).toContain('build')
  await ui.unmount()
})

test('contexte presque plein : le vertige attend son tour derrière un push raté, sans tomber', async ($, on) => {
  const { horloge } = moteur(on, { isError: true, text: 'rejected' })
  on('session.measure', ($, e) => ({ changed: e.changed }))
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  // sa tristesse dure 7 s : plus que ce qu'une petite réaction attend (6 s)
  await $.tool.call({ tool: 'Bash', command: 'git push' })
  expect(await scene(ui as never)).toContain('triste')
  await $.session.measure({ context: { tokens: 900_000, window: 1_000_000, percent: 90 }, rateLimits: [], changed: ['context'] } as never)
  expect(await scene(ui as never)).toContain('triste')
  expect(await guette(ui, horloge, 'vertige')).toContain('vertige')
  await ui.unmount()
})

test('git push, adb install et commit : reconnus au début d’un morceau de la commande seulement', async ($, on) => {
  const { horloge } = moteur(on, { isError: false, text: 'Success', attente: 2000 })
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  const cas: [string, string, boolean][] = [
    ['git commit -m "on ne fait plus de git push sans demander"', 'push', false],
    ['git -C "C:/mon dossier" push', 'push', true],
    ['adb -s X1 install -r app.apk', 'tel', true],
    ['adb logcat | grep install', 'tel', false],
  ]
  for (const [cmd, anim, oui] of cas) {
    void $.tool.call({ tool: 'Bash', command: cmd }).catch(() => {})
    await horloge.advance(500)
    if (oui) expect(await scene(ui as never)).toContain(anim)
    else expect(await scene(ui as never)).not.toContain(anim)
    await horloge.advance(12_000)
  }
  await ui.unmount()
})

test('commandes Windows : chemin entre guillemets avec espaces, PowerShell -ExecutionPolicy, plusieurs lignes', async ($, on) => {
  const { horloge } = moteur(on, { isError: false, text: 'ok', attente: 2000 })
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  for (const cmd of ['& "C:/mes projets/app/gradlew.bat" assembleDebug', 'powershell -ExecutionPolicy Bypass -File ./release.ps1', 'cd app\n./gradlew assembleRelease']) {
    void $.tool.call({ tool: 'Bash', command: cmd }).catch(() => {})
    await horloge.advance(500)
    expect(await scene(ui as never)).toContain('build')
    await horloge.advance(12_000)
  }
  await ui.unmount()
})

test('un build passé dans un « | tail » qui échoue : la sortie le dit, il est triste (pas de fête)', async ($, on) => {
  const { horloge } = moteur(on, { isError: false, text: '> Task :app:compile FAILED\nBUILD FAILED in 12s' })
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  await $.tool.call({ tool: 'Bash', command: './gradlew assembleDebug 2>&1 | tail -30' })
  expect(await scene(ui as never)).toContain('triste')
  await horloge.advance(100)
  await ui.unmount()
})

test('un build interrompu (Échap) : ni fête ni tristesse, le compteur d’échecs ne bouge pas', async ($, on) => {
  const { horloge } = moteur(on, { isError: true, text: 'Interrupted by user', interrompu: true, attente: 1000 })
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  for (let i = 0; i < 3; i++) {
    const fini = $.tool.call({ tool: 'Bash', command: './gradlew assembleDebug' }).catch(() => {})
    await horloge.advance(1100)
    await fini
    const s = await scene(ui as never)
    expect(s).not.toContain('triste')
    expect(s).not.toContain('decourage')
    await horloge.advance(8000)
  }
  await ui.unmount()
})

test('tests rouges puis tour long : pas de fête sur un échec', async ($, on) => {
  const { horloge } = moteur(on, { isError: true, text: '2 failed, 10 passed' })
  on('turn.complete', () => ({ text: '' }) as never)
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  expect(await scene(ui as never)).toContain('triste')
  // sa tristesse est finie quand le tour se termine : ce n'est pas elle qui empêche la fête, c'est l'échec
  await horloge.advance(8000)
  await $.turn.complete({ answer: 'fait', durationMs: 10 * 60_000, isAborted: false, turnId: 't' } as never)
  for (let i = 0; i < 20; i++) {
    expect(await scene(ui as never)).not.toContain('fete')
    await horloge.advance(1000)
  }
  await ui.unmount()
})

test('fins de tour : en erreur il est triste, sur un refus il est surpris (jamais la fête)', async ($, on) => {
  const { horloge } = moteur(on)
  on('turn.complete', () => ({ text: '' }) as never)
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  await $.turn.complete({ answer: '', durationMs: 10 * 60_000, isAborted: false, turnId: 't1', reason: 'error' } as never)
  expect(await guette(ui, horloge, 'triste')).toContain('triste')
  await horloge.advance(8000)
  await $.turn.complete({ answer: '', durationMs: 10 * 60_000, isAborted: false, turnId: 't2', reason: 'refusal', refusal: { category: null, explanation: null } } as never)
  // au travail, il ne lâche pas ses cartons pour autant (pas de bulle pendant qu'il les porte), et jamais la fête
  expect(await scene(ui as never)).toContain('boulot')
  expect(await scene(ui as never)).not.toContain('fete')
  await ui.unmount()
})

test('un push : sa fusée dure tant que le push dure (plus de 15 s), puis la fête', async ($, on) => {
  const { horloge } = moteur(on, { isError: false, text: 'ok', attente: 30_000 })
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  const fini = $.tool.call({ tool: 'Bash', command: 'git push origin main' })
  await horloge.advance(20_000)
  expect(await scene(ui as never)).toContain('push')
  await horloge.advance(10_500)
  await fini
  expect(await scene(ui as never)).toContain('fete')
  await ui.unmount()
})

test('une installation sur le téléphone : « Success », la fête ; sinon il est triste', async ($, on) => {
  moteur(on, { isError: false, text: 'Performing Streamed Install\nSuccess' })
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  await $.tool.call({ tool: 'Bash', command: 'adb install -r app.apk' })
  expect(await scene(ui as never)).toContain('fete')
  await ui.unmount()
})

test('une action refusée par une règle : il lève son « ! »', async ($, on) => {
  moteur(on, { isError: false, text: '', refus: 'non' })
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  await $.tool.call({ tool: 'Bash', command: 'rm -rf /tmp/x' }).catch(() => {})
  expect(await scene(ui as never)).toContain('alerte')
  await ui.unmount()
})

test('un mini qui rend son travail n’est pas remplacé par la loupe suivante', async ($, on) => {
  const { horloge } = moteur(on)
  on('classic.SubagentStart', () => ({}))
  on('classic.SubagentStop', () => ({}))
  on('tool.call', { tool: 'Read' }, () => ({ result: { content: '' }, text: '' }) as never)
  await $.classic.SubagentStart({ agent_id: 'a1', agent_type: 'Explore' } as never)
  await $.classic.SubagentStart({ agent_id: 'a2', agent_type: 'Plan' } as never)
  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  await $.tool.call({ tool: 'Read', file_path: 'a.ts' })
  await $.classic.SubagentStop({ agent_id: 'a1', agent_type: 'Explore', stop_hook_active: false, agent_transcript_path: '' } as never)
  await $.tool.call({ tool: 'Read', file_path: 'b.ts' })
  expect(await guette(ui, horloge, 'rapport', 8)).toContain('rapport')
  await ui.unmount()
})

test('un message d’une tâche de fond, d’une routine ou d’une autre session n’est pas toi qui parles', () => {
  expect(deToi({ origin: { kind: 'composer' } })).toBe(true)
  expect(deToi({ origin: { kind: 'bridge' } })).toBe(true)
  expect(deToi({ origin: { kind: 'sdk' } })).toBe(true)
  expect(deToi({})).toBe(true)
  for (const kind of ['task-notification', 'scheduled-trigger', 'peer', 'peer-send-message', 'projects-relay', 'coordinator', 'observer', 'observer-activity']) expect(deToi({ origin: { kind } })).toBe(false)
  // un message que tu envoies par un canal (Slack, Discord…) : c'est toi
  expect(deToi({ origin: { kind: 'channel' } })).toBe(true)
  expect(deToi({ origin: { kind: 'composer' }, isMeta: true })).toBe(false)
})

test('dessins : le rapport dure ce qu’il dure, les confettis tournent sur eux-mêmes, l’ombre est hors du contour', () => {
  expect(dureeScene('rapport')).toBe(RAPPORT_S)
  expect(svgScene('fete')).toMatch(/\.confetti\{transform-box:fill-box;transform-origin:center/)
  // une chorégraphie : son ombre au sol est dessinée avant le filtre de contour
  const balade = svgScene('balade')
  expect(balade.indexOf('ch-balade')).toBeLessThan(balade.indexOf('filter="url(#contour)"'))
  // un rapport sans rapporteur connu, sur Sonnet : le mini qui repart n'est pas peint en orange Opus
  const r = svgScene('rapport', [], 0, TEINTES.sonnet)
  const repart = r.slice(r.indexOf('<g id="mini-part">'), r.indexOf('</defs>', r.indexOf('<g id="mini-part">')))
  expect(repart).not.toContain(TEINTES.opus.O)
})

test('une activité commencée va au bout même quand un sous-agent arrive : le chef, ensuite', { timeoutMs: 30_000 }, async ($, on) => {
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('classic.SubagentStart', () => ({}))
  const { horloge, stockage } = moteur(on, undefined, new Date(2026, 9, 16, 15, 0).getTime())
  stockage.set('journee', '2026-10-16')
  await $.session.start({ cwd: '/projet', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  let anim = ''
  for (let i = 0; i < 60 && !anim; i++) {
    await horloge.advance(1000)
    const s = (await scene(ui as never)).replace('Clawd : ', '')
    if (s !== 'coucou' && [...ACTIVITES, ...VISITEURS, 'question', 'attend'].includes(s as never)) anim = s
  }
  expect(anim).not.toBe('')
  await $.classic.SubagentStart({ agent_id: 'a1', agent_type: 'Explore' } as never)
  // son activité continue : pas coupée net par l'arrivée de son équipe
  expect(await scene(ui as never)).toContain(anim)
  // elle finie, il dirige le chantier
  expect(await guette(ui, horloge, 'chef', 16)).toContain('chef')
  await ui.unmount()
})

test('fermé un moment, il s’est reposé : le matin, il n’est plus « à plat »', async ($, on) => {
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  const debut = new Date(2026, 9, 17, 9, 0).getTime()
  const { stockage, horloge } = moteur(on, undefined, debut)
  stockage.set('journee', '2026-10-17')
  // la veille au soir : il s'est couché à plat, sauvegardé à 18 h
  stockage.set('humeur', { energie: 0, ennui: 0.2, joie: 0.5 })
  stockage.set('humeurA', debut - 15 * 3_600_000)
  await $.session.start({ cwd: '/projet', surface: 'desktop', isInteractive: true })
  // ce qu'il enregistre à la minute suivante : reposé
  await horloge.advance(61_000)
  expect((stockage.get('humeur') as { energie: number }).energie).toBeGreaterThan(0.9)
})

test('le vertige en attente n’est pas remplacé par la loupe qui arrive après lui', async ($, on) => {
  const { horloge } = moteur(on, { isError: true, text: 'rejected' })
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('tool.call', { tool: 'Read' }, () => ({ result: { content: '' }, text: '' }) as never)
  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  await $.tool.call({ tool: 'Bash', command: 'git push' })
  expect(await scene(ui as never)).toContain('triste')
  await $.session.measure({ context: { tokens: 900_000, window: 1_000_000, percent: 90 }, rateLimits: [], changed: ['context'] } as never)
  // Claude lit un fichier pendant sa tristesse : la loupe attend aussi, mais ne prend pas la place du vertige
  await $.tool.call({ tool: 'Read', file_path: 'a.ts' })
  expect(await guette(ui, horloge, 'vertige', 10)).toContain('vertige')
  await ui.unmount()
})

test('un verdict qui arrive derrière ton ♥ n’est pas jeté : les deux passent, l’un après l’autre', async ($, on) => {
  const { horloge } = moteur(on, { isError: false, text: 'BUILD SUCCESSFUL' })
  on('tool.call', { tool: 'Read' }, () => ({ result: { content: '' }, text: '' }) as never)
  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  // une loupe se joue ; ton ♥ attend son tour, puis la fête d'un build
  await $.tool.call({ tool: 'Read', file_path: 'a.ts' })
  await ui.press({ key: 'caresse' })
  await $.tool.call({ tool: 'Bash', command: './gradlew assembleDebug' })
  expect(await guette(ui, horloge, 'coeur', 6)).toContain('coeur')
  expect(await guette(ui, horloge, 'fete', 8)).toContain('fete')
  await ui.unmount()
})

test('🎃 le 31 octobre, il porte son chapeau-citrouille toute la journée et lâche un bonbon à chaque commit réussi', { timeoutMs: 30_000 }, async ($, on) => {
  const { horloge } = moteur(on, undefined, new Date(2026, 9, 31, 9, 30).getTime())
  await horloge.advance(3000)
  // au repos comme au travail : le chapeau est sur sa tête
  for (const travail of [false, true]) {
    const ui = await $.ui.mount({ ...BAND(travail), surface: 'desktop' })
    expect(String((await svg(ui as never)).source)).toContain('id="citrouille"')
    await ui.unmount()
  }
  // un commit réussi : le bonbon (une vraie scène, pas une bulle), joué une fois
  await $.tool.call({ tool: 'Bash', command: 'git commit -m "farce"' })
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('bonbon')
  await ui.unmount()
  await horloge.advance(BONBON_S * 1000 + 500)
  expect(await vuJusqua($, horloge, 'boulot')).not.toContain('bonbon')
})

test('🎃 la veille d’Halloween, ni chapeau ni bonbon : un commit, c’est sa bulle habituelle', async ($, on) => {
  const { horloge } = moteur(on, undefined, new Date(2026, 9, 30, 23, 0).getTime())
  await horloge.advance(3000)
  await $.tool.call({ tool: 'Bash', command: 'git commit -m essai' })
  const ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  // (il garde ses cartons : pas de bulle pendant qu'il les porte, ni bonbon ni cachette)
  expect(await scene(ui as never)).toContain('boulot')
  expect(String((await svg(ui as never)).source)).not.toContain('citrouille')
  await ui.unmount()
})

test('🎃 son chapeau tient sur toutes ses scènes : sans texte, pareil d’un rendu à l’autre, et pas sur son bonnet de nuit', () => {
  for (const anim of Object.keys(EMOJI) as (keyof typeof EMOJI)[]) {
    const dessin = svgScene(anim, [], 0, TEINTES.haiku, undefined, undefined, 'citrouille')
    expect(dessin.length).toBeLessThan(40 * 1024)
    expect(svgScene(anim, [], 0, TEINTES.haiku, undefined, undefined, 'citrouille')).toBe(dessin)
    expect(dessin.includes('<text')).toBe(svgScene(anim).includes('<text'))
    // un chapeau repris doit avoir son dessin dans le SVG (même par son profil réutilisé)
    if (dessin.includes('href="#citrouille"')) expect(dessin).toContain('id="citrouille"')
    // la citrouille ne prend pas sa teinte : elle reste orange citrouille
    if (['dodo', 'nuit', 'reveil'].includes(anim)) expect(dessin).not.toContain('citrouille')
    // (sa détente du vendredi et son bâillement du lundi portent leur propre tenue)
    else if (!['repos', 'detente', 'baille'].includes(anim)) expect(dessin).toContain('#F5891F')
  }
  // en déménageant de profil, il le garde aussi
  expect(svgScene('boulot', [], 0, TEINTES.opus, undefined, undefined, 'citrouille')).toMatch(/<g id="profil">.*href="#citrouille"/s)
  // le reste de l'année, rien
  expect(svgScene('balade')).not.toContain('citrouille')
})

test('😎 le vendredi dès 17 h, ses lunettes de soleil ; 😪 le lundi avant 10 h, ses cernes ; le reste de la semaine, rien', () => {
  // le 23 octobre 2026 est un vendredi, le 26 un lundi
  expect(deguisementDu(new Date(2026, 9, 23, 16, 59).getTime())).toBeUndefined()
  expect(deguisementDu(new Date(2026, 9, 23, 17, 0).getTime())).toBe('lunettes')
  expect(deguisementDu(new Date(2026, 9, 23, 23, 30).getTime())).toBe('lunettes')
  expect(deguisementDu(new Date(2026, 9, 24, 18, 0).getTime())).toBeUndefined()
  expect(deguisementDu(new Date(2026, 9, 26, 7, 45).getTime())).toBe('cernes')
  expect(deguisementDu(new Date(2026, 9, 26, 10, 0).getTime())).toBeUndefined()
  expect(deguisementDu(new Date(2026, 9, 28, 18, 0).getTime())).toBeUndefined()
  // Halloween reste Halloween, même un vendredi soir
  expect(deguisementDu(new Date(2031, 9, 31, 19, 0).getTime())).toBe('citrouille')
})

test('😎 un vendredi soir au repos, il porte ses lunettes et finit par se détendre sur un carton, sa citronnade à la main', { timeoutMs: 60_000 }, async ($, on) => {
  const { horloge } = moteur(on, undefined, new Date(2026, 9, 23, 18, 0).getTime())
  await horloge.advance(3000)
  for (const travail of [false, true]) {
    const ui = await $.ui.mount({ ...BAND(travail), surface: 'desktop' })
    expect(String((await svg(ui as never)).source)).toContain('id="lunettes"')
    await ui.unmount()
  }
  // ses envies au repos (ici, ce que le 🎲 lui fait tirer) : il finit par s'asseoir sur un carton
  expect(await tireJusqua($, 'detente')).toBe(true)
})

/** Tire ses activités au 🎲 jusqu'à tomber sur celle-ci (vrai s'il y arrive en 40 tirages) */
async function tireJusqua($: Parameters<Parameters<typeof test>[1]>[0], anim: string) {
  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  let vu = false
  for (let i = 0; i < 40 && !vu; i++) {
    await ui.press({ key: 'occupe' })
    vu = (await scene(ui as never)) === `Clawd : ${anim}`
  }
  await ui.unmount()
  return vu
}

test('😪 un lundi matin, il a des cernes, et un tour fini peut le faire bâiller', { timeoutMs: 60_000 }, async ($, on) => {
  const { horloge } = moteur(on, undefined, new Date(2026, 9, 26, 8, 30).getTime())
  await horloge.advance(3000)
  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  expect(String((await svg(ui as never)).source)).toContain('id="cernes"')
  await ui.unmount()
  expect(await tireJusqua($, 'baille')).toBe(true)
})

test('😪 un lundi matin, un tour fini peut le faire bâiller : un seul bâillement, qui ne retient pas la file des scènes', { timeoutMs: 60_000 }, async ($, on) => {
  on('turn.complete', () => ({ text: '' }) as never)
  const { horloge } = moteur(on, undefined, new Date(2026, 9, 26, 8, 30).getTime())
  await horloge.advance(5000)
  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  let vu = false
  // une fois sur trois environ : 40 tours (5 s chacun, on reste avant 10 h) suffisent
  for (let i = 0; i < 40 && !vu; i++) {
    await horloge.advance(5000)
    await $.turn.complete({ answer: 'fait', durationMs: 1000, isAborted: false, turnId: `t${i}` } as never)
    vu = (await scene(ui as never)).includes('baille')
  }
  expect(vu).toBe(true)
  // un seul bâillement (4 s), pas trois en boucle : la file des scènes repart aussitôt
  await horloge.advance(4500)
  expect(await scene(ui as never)).not.toContain('baille')
  await ui.unmount()
})

test('😎 un mercredi, ni lunettes ni cernes, et le 🎲 ne le fait ni se détendre ni bâiller : ce sont des envies du vendredi et du lundi', async ($, on) => {
  const { horloge } = moteur(on, undefined, new Date(2026, 9, 28, 8, 30).getTime())
  await horloge.advance(3000)
  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  const dessin = String((await svg(ui as never)).source)
  expect(dessin).not.toContain('cernes')
  expect(dessin).not.toContain('lunettes')
  await ui.unmount()
  expect(await tireJusqua($, 'detente')).toBe(false)
  expect(await tireJusqua($, 'baille')).toBe(false)
})

test('😎 lunettes et cernes tiennent sur toutes ses scènes : légères, pareilles d’un rendu à l’autre, sans texte', () => {
  for (const d of ['lunettes', 'cernes'] as const) {
    for (const anim of Object.keys(EMOJI) as (keyof typeof EMOJI)[]) {
      const dessin = svgScene(anim, [], 0, TEINTES.sonnet, undefined, undefined, d)
      expect(dessin.length).toBeLessThan(40 * 1024)
      expect(svgScene(anim, [], 0, TEINTES.sonnet, undefined, undefined, d)).toBe(dessin)
      expect(dessin.includes('<text')).toBe(svgScene(anim).includes('<text'))
      for (const id of ['lunettes', 'cernes']) if (dessin.includes(`href="#${id}"`)) expect(dessin).toContain(`id="${id}"`)
      // sous son bonnet de nuit, ni l'un ni l'autre
      if (['dodo', 'nuit', 'reveil'].includes(anim)) expect(dessin).not.toContain(`id="${d}"`)
    }
  }
  // sa détente porte toujours ses lunettes (et il les baisse pour un clin d'œil), son bâillement ses cernes
  expect(svgScene('detente')).toContain('id="lunettes"')
  expect(svgScene('baille')).toContain('id="cernes"')
  // quand ses yeux parlent (des cœurs devant sa fleur), ses lunettes montent sur son front
  const arrosage = imagesScene('arrosage', 'lunettes')
  expect(arrosage[0]).toContain('<use href="#lunettes" x="54" y="46"/>')
  expect(arrosage[arrosage.length - 1]).toContain('<use href="#lunettes" x="54" y="37"/>')
  expect(imagesScene('cafe', 'cernes')[0]).toContain('<use href="#cernes"')
  // en déménageant de profil, ses lunettes restent sur son nez
  expect(svgScene('boulot', [], 0, TEINTES.opus, undefined, undefined, 'lunettes')).toMatch(/<g id="profil">.*x="46" y="59"/s)
  expect(svgScene('balade')).not.toContain('lunettes')
})

test('🫣 un conflit git : il se cache derrière un carton en tremblant, et ressort soulagé quand il est résolu', { timeoutMs: 30_000 }, async ($, on) => {
  const { horloge } = moteur(on, {
    isError: false,
    text: 'ok',
    selon: cmd =>
      /merge|pull|rebase/.test(cmd) && !/--continue|--abort/.test(cmd)
        ? { isError: true, text: 'Auto-merging src/a.ts\nCONFLICT (content): Merge conflict in src/a.ts\nAutomatic merge failed; fix conflicts and then commit the result.' }
        : undefined,
  })
  await horloge.advance(3000)
  // un merge sans conflit (ni un grep de « CONFLICT ») ne lui fait pas peur
  await $.tool.call({ tool: 'Bash', command: 'grep -rn "CONFLICT (" docs' })
  let ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(ui as never)).not.toContain('cache')
  await ui.unmount()
  // le merge tombe sur un conflit : il se cache, et y reste tant que ça dure
  await $.tool.call({ tool: 'Bash', command: 'git fetch && git merge origin/main' })
  ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('cache')
  const dessin = String((await svg(ui as never)).source)
  expect(dessin).toContain('tremble')
  expect(dessin.includes('<text')).toBe(false)
  await ui.unmount()
  await horloge.advance(60_000)
  // une lecture de fichier pendant le conflit ne le fait pas sortir
  await $.tool.call({ tool: 'Bash', command: 'git status' })
  expect(await vuJusqua($, horloge, 'cache', 2)).toContain('cache')
  // résolu : le commit le fait ressortir soulagé (pas sa petite bulle habituelle), une fois
  await $.tool.call({ tool: 'Bash', command: 'git add src/a.ts && git commit --no-edit' })
  ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('soulage')
  await ui.unmount()
  await horloge.advance(dureeScene('soulage') * 1000 + 500)
  const apres = await vuJusqua($, horloge, 'boulot')
  expect(apres).not.toContain('soulage')
  expect(apres).not.toContain('cache')
  // le commit suivant, sans conflit : sa bulle habituelle
  await $.tool.call({ tool: 'Bash', command: 'git commit -m suite' })
  ui = await $.ui.mount({ ...BAND(true), surface: 'desktop' })
  // (il garde ses cartons : pas de bulle pendant qu'il les porte, ni bonbon ni cachette)
  expect(await scene(ui as never)).toContain('boulot')
  await ui.unmount()
})

test('🫣 un rebase en conflit qu’on abandonne le soulage aussi ; la fin du tour le sort de sa cachette', { timeoutMs: 30_000 }, async ($, on) => {
  const { horloge } = moteur(on, {
    isError: false,
    text: 'ok',
    selon: cmd => (/rebase main/.test(cmd) ? { isError: true, text: 'error: could not apply 1a2b3c4... essai\nCONFLICT (content): Merge conflict in a.txt' } : undefined),
  })
  on('turn.complete', () => ({ text: '' }) as never)
  await horloge.advance(3000)
  await $.tool.call({ tool: 'Bash', command: 'git rebase main' })
  expect(await vuJusqua($, horloge, 'cache', 1)).toContain('cache')
  await $.tool.call({ tool: 'Bash', command: 'git rebase --abort' })
  expect(await vuJusqua($, horloge, 'soulage', 1)).toContain('soulage')
  await horloge.advance(dureeScene('soulage') * 1000 + 500)
  // un nouveau conflit, puis le tour finit sans qu'il soit résolu : il ne reste pas caché
  await $.tool.call({ tool: 'Bash', command: 'git rebase main' })
  expect(await vuJusqua($, horloge, 'cache', 1)).toContain('cache')
  await $.turn.complete({ answer: 'à toi', durationMs: 5000, isAborted: false, turnId: 't1' } as never)
  expect(await vuJusqua($, horloge, 'balade', 3)).not.toContain('cache')
})

test('🤗 tu reviens après plus de 8 h : il t’a attendu (coucou des deux pattes et cœur) ; tes messages comptent comme des visites', { timeoutMs: 60_000 }, async ($, on) => {
  const SESSION = { cwd: '/projet', surface: 'desktop', isInteractive: true } as const
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  // samedi 14 h : il ne connaît encore que ta séance de travail de la veille au soir (vendredi 20 h)
  const { horloge, stockage } = moteur(on, undefined, new Date(2026, 9, 24, 14, 0).getTime())
  // de longues heures, par tranches (ses minuteurs tournent pendant ce temps)
  const passe = async (ms: number) => {
    for (let reste = ms; reste > 0; reste -= 3_600_000) await horloge.advance(Math.min(3_600_000, reste))
  }
  stockage.set('journee', '2026-10-24')
  stockage.set('enchaine', { debut: new Date(2026, 9, 23, 18, 0).getTime(), dernier: new Date(2026, 9, 23, 20, 0).getTime(), rappel: false })
  await $.session.start(SESSION)
  // 18 h sans toi : son grand coucou et un cœur, à la place du coucou habituel
  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('attendu')
  const dessin = String((await svg(ui as never)).source)
  expect(dessin).toContain('@keyframes ch-attendu')
  expect(dessin.includes('<text')).toBe(false)
  await ui.unmount()
  // ta visite est retenue pour la prochaine fois
  expect(stockage.get('vuA')).toBe(new Date(2026, 9, 24, 14, 0).getTime())
  // une heure plus tard, une autre session : son coucou habituel
  await passe(3_600_000)
  await $.session.start(SESSION)
  expect(await vuJusqua($, horloge, 'coucou')).toContain('coucou')
  // une session ouverte tout l'après-midi, où tu lui parles de temps en temps, n'est pas une absence
  await passe(4 * 3_600_000)
  await $.prompt.submit({ text: 'encore là' })
  await passe(4 * 3_600_000)
  await $.prompt.submit({ text: 'toujours là' })
  expect(await vuJusqua($, horloge, 'ecoute', 6)).toContain('ecoute')
  // la même session, retrouvée le lendemain à 8 h : il se réveille avec toi, puis te montre qu'il t'a attendu
  await passe(9 * 3_600_000)
  await $.prompt.submit({ text: 'me revoilà' })
  expect(await vuJusqua($, horloge, 'reveil', 6)).toContain('reveil')
  expect(await vuJusqua($, horloge, 'attendu', 30)).toContain('attendu')
})

test('🥰 après tout un week-end sans toi : lundi, il émerge d’abord (café compris), puis te saute au cou', { timeoutMs: 30_000 }, async ($, on) => {
  const SESSION = { cwd: '/projet', surface: 'desktop', isInteractive: true } as const
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  const { horloge, stockage } = moteur(on, undefined, new Date(2026, 9, 26, 12, 0).getTime())
  // ta dernière visite : samedi 22 h
  stockage.set('journee', '2026-10-24')
  stockage.set('vuA', new Date(2026, 9, 24, 22, 0).getTime())
  await $.session.start(SESSION)
  let ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('reveil')
  await ui.unmount()
  // son café fini, il te remarque enfin
  await horloge.advance(dureeScene('reveil') * 1000 + 100)
  ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  expect(await scene(ui as never)).toContain('retrouvailles')
  // il se frotte les yeux, bondit de joie, court : une chorégraphie
  expect(String((await svg(ui as never)).source)).toContain('@keyframes ch-retrouvailles')
  await ui.unmount()
  // une fois suffit : il ne te refait pas la fête dans l'après-midi
  await horloge.advance(dureeScene('retrouvailles') * 1000 + 60_000)
  await $.session.start(SESSION)
  expect(await vuJusqua($, horloge, 'coucou')).toContain('coucou')
})

test('🥰 ses retrouvailles : une vraie scène, sans texte, légère, et pareille d’un rendu à l’autre', () => {
  for (const anim of ['attendu', 'retrouvailles'] as const) {
    const dessin = svgScene(anim)
    expect(dessin).not.toContain('<text')
    expect(dessin.length).toBeLessThan(40 * 1024)
    expect(svgScene(anim)).toBe(dessin)
    expect(EMOJI[anim]).toBeDefined()
  }
  // la grande version : il se frotte les yeux, bondit, court, et fait son coucou
  expect(imagesScene('retrouvailles').length).toBeGreaterThan(imagesScene('attendu').length)
  expect(imagesScene('retrouvailles').length).toBeGreaterThan(14)
  expect(dureeScene('retrouvailles')).toBeLessThan(12)
})

test('🐈 une visite rare : un chat le jour, une étoile filante le soir, pas plus d’une toutes les deux heures', () => {
  const jour = new Date(2026, 9, 27, 15, 0).getTime()
  const soir = new Date(2026, 9, 27, 21, 30).getTime()
  // à peu près une fois sur 120 : un hasard plus grand ne fait venir personne
  expect(visiteur(jour, 0, 0.5)).toBeNull()
  expect(visiteur(jour, 0, 0.005)).toBe('chat')
  expect(visiteur(soir, 0, 0.005)).toBe('filante')
  expect(visiteur(new Date(2026, 9, 27, 5, 0).getTime(), 0, 0.005)).toBe('filante')
  // un visiteur il y a une heure : personne ; il y a trois heures : il peut revenir
  expect(visiteur(jour, jour - 3_600_000, 0)).toBeNull()
  expect(visiteur(jour, jour - 3 * 3_600_000, 0)).toBe('chat')
  for (const anim of ['chat', 'filante'] as const) {
    const dessin = svgScene(anim)
    // léger, pareil d'un rendu à l'autre, sans texte, et le visiteur suit `--t0` (repris en route, il est à sa place)
    expect(dessin.length).toBeLessThan(40 * 1024)
    expect(svgScene(anim)).toBe(dessin)
    expect(dessin).not.toContain('<text')
    expect(dessin).toMatch(new RegExp(`\\.${anim}\\{animation:${anim} [0-9.]+s linear infinite;animation-delay:var\\(--t0,0s\\)`))
    expect(dureeScene(anim)).toBeGreaterThan(8)
  }
  // le chat est gris, et il ne prend pas la teinte de Clawd
  expect(svgScene('chat', [], 0, TEINTES.haiku)).toContain('#8B8B8B')
})

// ------------------------------------------------- sa tenue, son expérience

/** Sa tenue la plus chargée : sa visière, deux gouttes et les joues rouges, l'étoile du niveau 20 */
const TOUT = { visiere: true, sueur: 2, insigne: 'etoile' } as const
/** Le libellé de son bouton ⭐ (son niveau, au survol) */
const etoile = async (ui: Monte) => String(((await ui.find({ key: 'niveau' })) as { props?: { label?: string } } | undefined)?.props?.label)

test('🥽 sa tenue (visière, sueur, insigne) tient sur toutes ses scènes : légère, pareille d’un rendu à l’autre, sans texte, chaque dessin repris défini', () => {
  // (le 31 octobre, son chapeau en plus de tout le reste : un peu plus, jamais au-delà de 44 Ko)
  const tenues = [[TOUT, 40], [{ ...TOUT, deguise: 'lunettes' }, 40], [{ ...TOUT, deguise: 'cernes' }, 40], [{ ...TOUT, deguise: 'citrouille' }, 44], [{ sueur: 1 }, 40], [{ insigne: 'bronze' }, 40]] as const
  for (const anim of Object.keys(EMOJI) as (keyof typeof EMOJI)[]) {
    for (const [t, ko] of tenues) {
      const dessin = svgScene(anim, [], 0, TEINTES.sonnet, undefined, undefined, t)
      expect(dessin.length).toBeLessThan(ko * 1024)
      expect(svgScene(anim, [], 0, TEINTES.sonnet, undefined, undefined, t)).toBe(dessin)
      expect(dessin.includes('<text')).toBe(svgScene(anim).includes('<text'))
      for (const m of dessin.matchAll(/href="#([^"]+)"/g)) expect(dessin).toContain(`id="${m[1]}"`)
    }
  }
  // en rentrant chez lui à pied (de profil) avant sa scène : sa tenue le suit, et ses dessins sont là
  const retour = svgScene('coucou', [], 0, TEINTES.sonnet, undefined, undefined, TOUT, { x: -60, decor: '', rentre: true })
  expect(retour).toContain('href="#tnpv2e"')
  for (const m of retour.matchAll(/href="#([^"]+)"/g)) expect(retour).toContain(`id="${m[1]}"`)
  expect(retour).toContain('@keyframes goutte')
  // et elle est bien dessinée : de face, de profil et en plein demi-tour (sa balade), relevée sur son front quand ses
  // yeux ont quelque chose à dire (des étoiles plein les yeux), chaque insigne
  expect(svgScene('coucou', [], 0, TEINTES.sonnet, undefined, undefined, TOUT)).toContain('href="#tnv2e"')
  const balade = svgScene('balade', [], 0, TEINTES.sonnet, undefined, undefined, TOUT)
  expect(balade).toContain('href="#tnpv2e"')
  expect(balade).toContain('href="#visiere-cote"')
  expect(svgScene('niveau', [], 0, TEINTES.sonnet, undefined, undefined, TOUT)).toContain('href="#tnh2e"')
  for (const [insigne, id] of [['bronze', 'ib'], ['argent', 'ia'], ['or', 'io'], ['etoile', 'ie']] as const) {
    const dessin = svgScene('coucou', [], 0, TEINTES.opus, undefined, undefined, { insigne })
    expect(dessin).toContain(`href="#${id}"`)
    expect(dessin).toContain(`id="${id}"`)
  }
  // ses yeux devant le verre : sa visière est reprise juste avant eux
  expect(svgScene('coucou', [], 0, TEINTES.opus, undefined, undefined, { visiere: true })).toMatch(/<use href="#tnv" x="[\d.]+" y="[\d.]+"\/>(<g class="cligne">)?<rect [^>]*fill="#141414"/)
})

test('🥽 ses minis portent sa visière (leur sous-agent a son mode), jamais sa sueur ni son insigne ; sous son bonnet, il garde son insigne', () => {
  const minis = svgMinis('chef', ['cherche', 'ecrit', 'build'], TEINTES.opus, 0, TOUT)!
  expect(minis).toMatch(/href="#tn[vh]"/)
  expect(minis).not.toContain('class="goutte')
  expect(minis).not.toMatch(/id="i[baoe]"/)
  // le mini qui rend son travail : sa visière seule ; le chef : tout
  const rapport = svgScene('rapport', [], 0, TEINTES.opus, { fait: 'cherche', sortie: 'trotte' }, undefined, TOUT)
  expect(rapport).toContain('href="#tnv2e"')
  expect(rapport).toContain('href="#tnv"')
  // sous son bonnet de nuit : ni visière ni sueur, son insigne oui
  const dodo = svgScene('dodo', [], 0, TEINTES.opus, undefined, undefined, TOUT)
  expect(dodo).not.toMatch(/href="#tnp?[vh]/)
  expect(dodo).not.toContain('class="goutte')
  expect(dodo).toContain('id="ie"')
})

test('🥽 sa tenue le suit sur toute la bande : chaque numéro dessiné avec sa visière, sa sueur et son insigne, léger, chaque dessin repris défini', () => {
  let joues = 0
  for (const nom of Object.keys(NUMEROS)) {
    const prep = prepareNumero(nom, EXEMPLE)
    if (!prep) continue
    joues++
    const dessin = svgNumero({ nom, elements: EXEMPLE, cibles: prep.cibles }, TEINTES.opus, TOUT)
    expect(dessin).toMatch(/href="#tnp?[vh]2e"/)
    expect(dessin).toContain('@keyframes goutte')
    expect(dessin.length).toBeLessThan(MAX_SVG / 2)
    for (const m of dessin.matchAll(/href="#([^"]+)"/g)) expect(dessin).toContain(`id="${m[1]}"`)
  }
  expect(joues).toBeGreaterThan(3)
})

test('⭐ ses niveaux : 50, 150, 300… points ; bronze, argent au 5, or au 10, l’étoile au 20 ; la sueur à 50 et 70 %', () => {
  expect([0, 49, 50, 149, 150, 299, 300, 749, 750].map(niveauDe)).toEqual([0, 0, 1, 1, 2, 2, 3, 4, 5])
  for (let n = 0; n < 60; n++) {
    expect(niveauDe(seuilNiveau(n))).toBe(n)
    expect(niveauDe(seuilNiveau(n + 1) - 1)).toBe(n)
  }
  expect([0, 1, 4, 5, 9, 10, 19, 20, 99].map(insigneDe)).toEqual([undefined, 'bronze', 'bronze', 'argent', 'argent', 'or', 'or', 'etoile', 'etoile'])
  expect([0, 49, 50, 69, 70, 100].map(sueurDe)).toEqual([0, 0, 1, 1, 2, 2])
  // rien à porter : son dessin de toujours
  expect(tenueDe({ visiere: false })).toBeUndefined()
  expect(tenueDe({ visiere: true })).toEqual({ visiere: true })
  expect(svgScene('coucou', [], 0, TEINTES.opus, undefined, undefined, tenueDe({}))).toBe(svgScene('coucou'))
})

test('⭐ sa montée de niveau : une vraie scène jouée une fois, sans texte, légère, l’étoile qui tombe calée sur sa scène', () => {
  const dessin = svgScene('niveau')
  expect(dessin).not.toContain('<text')
  expect(dessin.length).toBeLessThan(40 * 1024)
  expect(svgScene('niveau')).toBe(dessin)
  expect(EMOJI.niveau).toBe('⭐')
  expect(dureeScene('niveau')).toBe(+(imagesScene('niveau').length * 0.15).toFixed(2))
  expect(dessin).toMatch(/\.niveau-descend\{animation:niveau-descend [0-9.]+s infinite;animation-delay:var\(--t0,0s\)\}/)
})

test('🥽 en mode auto ou bypass, il met sa visière de pilote ; revenu à un autre mode, il l’ôte (un sous-agent ne compte pas)', async ($, on) => {
  moteur(on)
  on('classic.UserPromptSubmit', () => ({}))
  on('classic.PostToolUse', () => ({}))
  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  const visiere = async () => /href="#tnp?[vh]/.test(String((await svg(ui as never)).source))
  expect(await visiere()).toBe(false)
  await $.classic.UserPromptSubmit({ prompt: 'vas-y', permission_mode: 'bypassPermissions' } as never)
  expect(await visiere()).toBe(true)
  // l'outil d'un sous-agent : le mode qu'il porte ne change rien
  await $.classic.PostToolUse({ tool_name: 'Read', tool_input: {}, tool_response: {}, tool_use_id: 't1', permission_mode: 'default', agent_id: 'a1', agent_type: 'Explore' } as never)
  expect(await visiere()).toBe(true)
  // Maj+Tab : revenu au mode normal, il l'ôte au prochain outil
  await $.classic.PostToolUse({ tool_name: 'Read', tool_input: {}, tool_response: {}, tool_use_id: 't2', permission_mode: 'default' } as never)
  expect(await visiere()).toBe(false)
  await $.classic.UserPromptSubmit({ prompt: 'encore', permission_mode: 'auto' } as never)
  expect(await visiere()).toBe(true)
  await $.classic.UserPromptSubmit({ prompt: 'et là', permission_mode: 'acceptEdits' } as never)
  expect(await visiere()).toBe(false)
  await ui.unmount()
})

test('💧 le contexte se remplit : une goutte à la moitié, deux et les joues rouges à 70 %, plus rien quand il redescend ou après un /clear', async ($, on) => {
  moteur(on)
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('session.end', ($, e) => ({ sessionId: e.sessionId }))
  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  const mesure = (percent: number) => $.session.measure({ context: { tokens: percent * 10_000, window: 1_000_000, percent }, rateLimits: [], changed: ['context'] } as never)
  const dessin = async () => String((await svg(ui as never)).source)
  await mesure(40)
  expect(await dessin()).not.toContain('class="goutte')
  await mesure(55)
  expect(await dessin()).toMatch(/id="tnp?1"/)
  expect(await dessin()).not.toContain('id="joues"')
  await mesure(75)
  expect(await dessin()).toMatch(/id="tnp?2"/)
  expect(await dessin()).toContain('id="joues"')
  expect(await dessin()).toContain('@keyframes goutte')
  // un compactage l'a fait redescendre
  await mesure(30)
  expect(await dessin()).not.toContain('class="goutte')
  await mesure(80)
  expect(await dessin()).toContain('class="goutte')
  // un /clear : une conversation neuve, plus de sueur
  await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } } as never)
  expect(await dessin()).not.toContain('class="goutte')
  await ui.unmount()
})

test('⭐ chaque outil lui rapporte un point : à 50, il passe niveau 1, le fête une fois, et une médaille de bronze brille sur son ventre', async ($, on) => {
  const { stockage, horloge } = moteur(on)
  const toasts: string[] = []
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('tool.call', { tool: 'Glob' }, () => ({ result: { filenames: [] }, text: '' }) as never)
  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  for (let i = 0; i < 49; i++) await $.tool.call({ tool: 'Glob', pattern: '*.ts' } as never)
  expect(toasts.some(t => t.includes('niveau'))).toBe(false)
  expect(await etoile(ui as never)).toBe('⭐0')
  await $.tool.call({ tool: 'Glob', pattern: '*.ts' } as never)
  expect(await guette(ui, horloge, 'niveau', 40)).toContain('niveau')
  expect(toasts.filter(t => t.includes('niveau 1')).length).toBe(1)
  expect(stockage.get('xp')).toBe(50)
  expect(stockage.get('niveauFete')).toBe(1)
  expect(String((await svg(ui as never)).source)).toContain('id="ib"')
  expect(await etoile(ui as never)).toBe('⭐1')
  // ⭐ au survol : où il en est, et ce qui fait monter son expérience
  await (ui as unknown as { press: (q: { key: string }) => Promise<void> }).press({ key: 'niveau' })
  expect(toasts.at(-1)).toContain('Niveau 1 · 50 XP · encore 100 pour le niveau 2')
  await ui.unmount()
})

test('⭐ son expérience se note aussi entre deux niveaux : +5 par fête, +3 par mini qui rend son travail, gardée à la fin de la session', async ($, on) => {
  const { stockage, horloge } = moteur(on)
  on('session.end', ($, e) => ({ sessionId: e.sessionId }))
  on('classic.SubagentStart', () => ({}))
  on('classic.SubagentStop', () => ({}))
  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  // un push qui passe : l'outil (+1), puis sa fête (+5)
  await $.tool.call({ tool: 'Bash', command: 'git push' })
  expect(await guette(ui, horloge, 'fete')).toContain('fete')
  // un sous-agent qui finit : son mini vient lui rendre son travail (+3)
  await $.classic.SubagentStart({ agent_id: 'a1', agent_type: 'Explore' } as never)
  await $.classic.SubagentStop({ agent_id: 'a1', agent_type: 'Explore', stop_hook_active: false, agent_transcript_path: '' } as never)
  expect(await guette(ui, horloge, 'rapport', 30)).toContain('rapport')
  expect(stockage.get('xp')).toBeUndefined()
  // la fin de la session (un /clear) note le tout, sans passage de niveau
  await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } } as never)
  expect(stockage.get('xp')).toBe(9)
  await ui.unmount()
})

test('🥽⭐ sa visière dès l’ouverture d’une session en mode auto ; un toast refusé ne lui retire ni sa fête ni son bouton', async ($, on) => {
  const { horloge } = moteur(on)
  on('classic.SessionStart', () => ({}))
  on('ui.toast', () => {
    throw new Error('refusé')
  })
  on('tool.call', { tool: 'Glob' }, () => ({ result: { filenames: [] }, text: '' }) as never)
  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  await $.classic.SessionStart({ source: 'startup', permission_mode: 'auto' } as never)
  expect(String((await svg(ui as never)).source)).toMatch(/href="#tnp?[vh]/)
  for (let i = 0; i < 50; i++) await $.tool.call({ tool: 'Glob', pattern: '*' } as never)
  expect(await guette(ui, horloge, 'niveau', 40)).toContain('niveau')
  await (ui as unknown as { press: (q: { key: string }) => Promise<void> }).press({ key: 'niveau' })
  expect(await etoile(ui as never)).toBe('⭐1')
  await ui.unmount()
})

test('⭐ deux sessions ouvertes : ce que chacune gagne s’ajoute au total, un niveau ne se fête qu’une fois, et il revient à la session suivante', async ($, on) => {
  const { stockage, horloge } = moteur(on)
  const toasts: string[] = []
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('tool.call', { tool: 'Glob' }, () => ({ result: { filenames: [] }, text: '' }) as never)
  const SESSION = { cwd: '/projet', surface: 'desktop', isInteractive: true } as const
  stockage.set('xp', 40)
  await $.session.start(SESSION)
  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  expect(await etoile(ui as never)).toBe('⭐0')
  // l'autre session en a gagné 100 pendant ce temps
  stockage.set('xp', 140)
  for (let i = 0; i < 10; i++) await $.tool.call({ tool: 'Glob', pattern: '*' } as never)
  // 50 ici (niveau 1)… et avec l'autre session, 150 : le niveau 2, fêté une seule fois
  expect(await guette(ui, horloge, 'niveau', 40)).toContain('niveau')
  expect(stockage.get('xp')).toBe(150)
  expect(stockage.get('niveauFete')).toBe(2)
  expect(toasts.filter(t => t.includes('niveau')).length).toBe(1)
  expect(await etoile(ui as never)).toBe('⭐2')
  await ui.unmount()
  // la session suivante : son niveau et son insigne reviennent, sans nouvelle fête
  await $.session.start(SESSION)
  const apres = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  expect(await etoile(apres as never)).toBe('⭐2')
  expect(String((await svg(apres as never)).source)).toContain('id="ib"')
  expect(toasts.filter(t => t.includes('niveau')).length).toBe(1)
  await apres.unmount()
})
