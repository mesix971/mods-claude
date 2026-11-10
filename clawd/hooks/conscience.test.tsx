// Tests de sa conscience : ses besoins, ses émotions qui durent, ton rythme,
// et ce qu'il en pense ; puis en situation (il a faim, il boude, il te guette).
import { expect, mock, test } from 'claude-code/testing'

import { texteCarte } from './carte'
import type { Fiche } from './carte'
import {
  ENVIE_DES,
  ESPRIT_DEPART,
  SCENE_BESOIN,
  SCENE_EMOTION,
  arrivee,
  besoinFort,
  colore,
  comble,
  emotionDe,
  envie,
  espritDe,
  estRythme,
  fusionne,
  habitudes,
  heureDite,
  jourDe,
  minuteDuJour,
  moment,
  noteVu,
  parBesoinSeulement,
  pense,
  ressent,
  rythmeDe,
  vieillit,
} from './conscience'
import type { Esprit, Rythme } from './conscience'
import { HUMEUR_DEPART } from './humeur'
import { ACTIVITES, EMOJI, PENSEES, dureeScene, svgScene } from './sprite'

const MIN = 60_000
/** Au centième près (ses jauges sont des sommes de fractions) */
const centieme = (v: number) => Math.round(v * 100) / 100
/** Le 15 octobre 2026 à cette heure */
const le15 = (h: number, m = 0) => new Date(2026, 9, 15, h, m).getTime()
const T0 = le15(14)
const esprit = (b: Partial<Esprit['besoins']> = {}, e: Partial<Esprit> = {}): Esprit => ({ ...ESPRIT_DEPART, besoins: { faim: 0, soif: 0, bouger: 0, curiosite: 0, ...b }, ...e })
/** Trois jours passés : arrivé à 9 h, parti à 18 h (en minutes depuis 5 h) */
const HABITUES: Rythme = ['2026-10-12', '2026-10-13', '2026-10-14'].map(jour => ({ jour, debut: 240, fin: 780 }))

test('ses besoins : ils montent éveillé, à peine endormi (sa faim, sa soif), et une activité comble le sien', () => {
  // 50 min éveillé : il meurt de faim ; sa bougeotte est à son comble depuis longtemps
  const apres = vieillit(esprit(), 50 * MIN, { dort: false }, T0)
  expect(apres.besoins.faim).toBe(1)
  expect(apres.besoins.bouger).toBe(1)
  // endormi : une petite faim seulement, et il ne s'agite pas en dormant
  const dormi = vieillit(esprit(), 50 * MIN, { dort: true }, T0)
  expect(centieme(dormi.besoins.faim)).toBe(0.2)
  expect(dormi.besoins.bouger).toBe(0)
  expect(dormi.besoins.curiosite).toBe(0)
  // une nuit entière : une petite faim au réveil, pas affamé ; et dormir ne le rassasie pas
  expect(vieillit(esprit(), 600 * MIN, { dort: true }, T0).besoins).toMatchObject({ faim: 0.7, soif: 0.7 })
  expect(vieillit(esprit({ faim: 0.9 }), 600 * MIN, { dort: true }, T0).besoins.faim).toBe(0.9)
  // un temps négatif (l'horloge recule) ne le rassasie pas
  expect(vieillit(esprit({ faim: 0.5 }), -5 * MIN, { dort: false }, T0).besoins.faim).toBe(0.5)
  // son cookie comble sa faim, pas sa soif ; une scène qui ne comble rien ne change rien
  const rassasie = comble(esprit({ faim: 0.9, soif: 0.9 }), 'cookie')
  expect(centieme(rassasie.besoins.faim)).toBe(0.2)
  expect(rassasie.besoins.soif).toBe(0.9)
  expect(comble(esprit({ faim: 0.9 }), 'coucou').besoins.faim).toBe(0.9)
  expect(besoinFort(esprit({ soif: 0.8, faim: 0.3 }))).toEqual({ besoin: 'soif', force: 0.8 })
  // manger et boire, il ne le fait que par besoin (jamais tiré au sort) ; bouger ou lire, aussi pour le plaisir
  expect(ACTIVITES.filter(parBesoinSeulement)).toEqual(['cafe', 'cookie', 'glace'])
  expect(parBesoinSeulement('guimauve')).toBe(true)
  expect(parBesoinSeulement('danse')).toBe(false)
})

test('un besoin pressant décide de son activité : ce qui le comble, jamais deux fois la même, de plus en plus sûrement', () => {
  const toujours = () => 0
  // rien ne presse : son humeur décide
  expect(envie(esprit({ faim: ENVIE_DES - 0.01 }), ACTIVITES, null, T0, toujours)).toBeNull()
  // il a faim : un cookie ou une glace, pas ce qu'il vient de manger
  const faim = envie(esprit({ faim: 1 }), ACTIVITES, null, T0, toujours)
  expect(faim?.besoin).toBe('faim')
  expect(['cookie', 'glace']).toContain(faim?.anim)
  expect(envie(esprit({ faim: 1 }), ACTIVITES, 'cookie', T0, toujours)?.anim).toBe('glace')
  // soif : son café ; s'il vient d'en boire un, rien d'autre ne l'étanche
  expect(envie(esprit({ soif: 1 }), ACTIVITES, null, T0, toujours)).toEqual({ besoin: 'soif', anim: 'cafe' })
  expect(envie(esprit({ soif: 1 }), ACTIVITES, 'cafe', T0, toujours)).toBeNull()
  // à peine pressant : pas à tous les coups ; à son comble : toujours
  const parfois = () => 0.5
  expect(envie(esprit({ curiosite: 0.65 }), ACTIVITES, null, T0, parfois)).toBeNull()
  expect(envie(esprit({ curiosite: 1 }), ACTIVITES, null, T0, () => 0.99)?.besoin).toBe('curiosite')
  // inquiet, il n'a pas le cœur à bouger : son besoin suivant passe, s'il presse
  const inquiet = ressent(esprit({ bouger: 1, faim: 0.9 }), { quoi: 'echec', serie: 2 }, T0)
  expect(envie(inquiet, ACTIVITES, null, T0, toujours)?.besoin).toBe('faim')
  expect(envie(ressent(esprit({ bouger: 1 }), { quoi: 'echec', serie: 2 }, T0), ACTIVITES, null, T0, toujours)).toBeNull()
  // chacune de ses pensées a sa scène
  for (const scene of [...Object.values(SCENE_BESOIN), ...Object.values(SCENE_EMOTION), 'guette'] as const) expect(PENSEES).toContain(scene)
})

test('ses émotions durent : fier d’un push, inquiet des échecs qui s’enchaînent, vexé par trois zaps ; une caresse pardonne', () => {
  // un push : fier dix minutes, puis ça lui passe
  const fier = ressent(esprit(), { quoi: 'push' }, T0)
  expect(emotionDe(fier, T0 + 9 * MIN)?.nom).toBe('fier')
  expect(emotionDe(fier, T0 + 11 * MIN)).toBeNull()
  expect(vieillit(fier, MIN, { dort: false }, T0 + 11 * MIN).emotion).toBeNull()
  // une horloge qui recule : l'émotion d'« après » ne vaut plus
  expect(emotionDe(fier, T0 - MIN)).toBeNull()
  // un échec seul ne l'inquiète pas ; deux d'affilée, oui, et il sait combien ; une réussite le rassure
  expect(ressent(esprit(), { quoi: 'echec', serie: 1 }, T0).emotion).toBeNull()
  const inquiet = ressent(esprit(), { quoi: 'echec', serie: 3 }, T0)
  expect(emotionDe(inquiet, T0)).toMatchObject({ nom: 'inquiet', cause: 'echecs', n: 3 })
  expect(ressent(inquiet, { quoi: 'reussite' }, T0 + MIN).emotion).toBeNull()
  // (une réussite ne lui retire pas sa fierté)
  expect(ressent(fier, { quoi: 'reussite' }, T0 + MIN).emotion?.nom).toBe('fier')
  // trois zaps en deux minutes : vexé ; espacés, non
  let e = esprit()
  for (const t of [0, 20_000, 40_000]) e = ressent(e, { quoi: 'zappe' }, T0 + t)
  expect(emotionDe(e, T0 + 41_000)).toMatchObject({ nom: 'vexe', cause: 'zaps' })
  let calme = esprit()
  for (const t of [0, 3 * MIN, 6 * MIN]) calme = ressent(calme, { quoi: 'zappe' }, T0 + t)
  expect(calme.emotion).toBeNull()
  // ta caresse : pardonné, et le compte de tes zaps repart de zéro
  const pardonne = ressent(e, { quoi: 'caresse' }, T0 + MIN)
  expect(pardonne.emotion).toBeNull()
  expect(pardonne.zaps).toEqual([])
  // inquiet, tes zaps ne le vexent pas : il a autre chose en tête
  let soucieux = inquiet
  for (const t of [0, 1000, 2000]) soucieux = ressent(soucieux, { quoi: 'zappe' }, T0 + t)
  expect(emotionDe(soucieux, T0 + 3000)?.nom).toBe('inquiet')
  // te regarder travailler nourrit sa curiosité
  expect(centieme(ressent(esprit({ curiosite: 0.5 }), { quoi: 'outil' }, T0).besoins.curiosite)).toBe(0.48)
  // son émotion colore son humeur : fier, joyeux ; inquiet, au calme ; vexé, il ne vient pas te chercher
  const h = { energie: 1, ennui: 0.9, joie: 0.3 }
  expect(colore(h, fier, T0).joie).toBe(0.9)
  expect(colore(h, inquiet, T0).energie).toBe(0.3)
  expect(colore(h, e, T0 + 41_000).ennui).toBe(0)
  expect(colore(h, esprit(), T0)).toEqual(h)
})

test('son esprit gardé d’une session à l’autre : relu s’il a la bonne forme, borné, sans tes zaps', () => {
  const garde = { besoins: { faim: 0.4, soif: 7, bouger: -1, curiosite: 0.2 }, emotion: { nom: 'fier', cause: 'push', depuis: T0, jusqua: T0 + MIN } }
  expect(espritDe(garde)).toEqual({ besoins: { faim: 0.4, soif: 1, bouger: 0, curiosite: 0.2 }, emotion: garde.emotion, zaps: [] })
  expect(espritDe({ besoins: { faim: 0.4 } })).toBeNull()
  expect(espritDe('faim')).toBeNull()
  expect(espritDe(null)).toBeNull()
  // une émotion inconnue ou abîmée : il l'oublie, sans perdre ses besoins
  expect(espritDe({ ...garde, emotion: { nom: 'jaloux', cause: 'push', depuis: T0, jusqua: T0 + MIN } })?.emotion).toBeNull()
  expect(espritDe({ ...garde, emotion: { nom: 'fier', cause: 'push', depuis: 'hier', jusqua: T0 } })?.emotion).toBeNull()
})

test('ton rythme : sa journée commence à 5 h ; tes jours fusionnent ; tes habitudes après trois jours', () => {
  // 4 h 30 du matin compte encore pour la veille, à la 1410e minute de sa journée
  expect(jourDe(new Date(2026, 9, 15, 4, 30).getTime())).toBe('2026-10-14')
  expect(minuteDuJour(new Date(2026, 9, 15, 4, 30).getTime())).toBe(1410)
  expect(jourDe(le15(9))).toBe('2026-10-15')
  expect(minuteDuJour(le15(9))).toBe(240)
  // deux signes de vie le même jour : ton premier et ton dernier
  const jour = noteVu(noteVu([], le15(9)), le15(18, 30))
  expect(jour).toEqual([{ jour: '2026-10-15', debut: 240, fin: 810 }])
  // deux sessions : par jour, le plus tôt et le plus tard ; triés, quatorze jours au plus
  expect(fusionne([{ jour: '2026-10-15', debut: 300, fin: 600 }], [{ jour: '2026-10-14', debut: 200, fin: 500 }, { jour: '2026-10-15', debut: 240, fin: 580 }])).toEqual([
    { jour: '2026-10-14', debut: 200, fin: 500 },
    { jour: '2026-10-15', debut: 240, fin: 600 },
  ])
  const vingt = Array.from({ length: 20 }, (_, i) => ({ jour: `2026-09-${String(i + 1).padStart(2, '0')}`, debut: 240, fin: 780 }))
  expect(fusionne(vingt, [])).toHaveLength(14)
  expect(fusionne(vingt, [])[0]!.jour).toBe('2026-09-07')
  // pas assez de jours : il ne te connaît pas encore ; aujourd'hui ne compte pas
  expect(habitudes(HABITUES.slice(0, 2), '2026-10-15')).toBeNull()
  expect(habitudes(HABITUES, '2026-10-14')).toBeNull()
  // la médiane : une matinée exceptionnelle ne change pas ton heure
  expect(habitudes([...HABITUES, { jour: '2026-10-11', debut: 60, fin: 800 }, { jour: '2026-10-10', debut: 250, fin: 790 }], '2026-10-15')).toEqual({ arrivee: 240, depart: 780 })
  expect([240, 247, 255, 1140, 1170].map(heureDite)).toEqual(['9 h', '9 h', '9 h 15', '0 h', '0 h 30'])
  expect(estRythme(HABITUES)).toBe(true)
  expect(estRythme([{ jour: '15/10', debut: 1, fin: 2 }])).toBe(false)
  expect(estRythme({})).toBe(false)
  // relu du stockage : un jour abîmé ne lui fait pas oublier les autres
  expect(rythmeDe([...HABITUES, { jour: 'hier', debut: 1, fin: 2 }, null, { jour: '2026-10-11', debut: 'tôt', fin: 3 }])).toEqual(HABITUES)
  expect(rythmeDe('rien')).toEqual([])
})

test('où en est ta journée : il te guette à ton heure, t’attend si tu tardes, et il se fait tard passé ton heure de fin', () => {
  // pas encore vu aujourd'hui : trop tôt, rien ; dix minutes avant, il guette ; passé vingt minutes, tu es en retard
  expect(moment(HABITUES, le15(8, 40))).toBeNull()
  expect(moment(HABITUES, le15(8, 52))).toEqual({ quoi: 'bientot', heure: 240 })
  expect(moment(HABITUES, le15(9, 20))).toEqual({ quoi: 'bientot', heure: 240 })
  expect(moment(HABITUES, le15(10))).toEqual({ quoi: 'retard', heure: 240 })
  // (trois heures plus tard, il ne t'attend plus)
  expect(moment(HABITUES, le15(13))).toBeNull()
  // tu es là : plus rien à guetter ; jusqu'à ton heure de fin
  const la = noteVu(HABITUES, le15(9, 5))
  expect(moment(la, le15(9, 6))).toBeNull()
  expect(moment(la, le15(17, 45))).toBeNull()
  expect(moment(la, le15(17, 52))).toEqual({ quoi: 'tard', heure: 780 })
  // des passages éclair (pas de vraie journée) : pas d'heure de fin
  const eclair = HABITUES.map(j => ({ ...j, fin: j.debut + 10 }))
  expect(moment(noteVu(eclair, le15(9, 5)), le15(12))).toBeNull()
  // il ne te connaît pas encore
  expect(moment([], le15(9))).toBeNull()
  // ton arrivée du jour : en retard ou matinal de trois quarts d'heure ; à ton heure ou déjà vu, rien
  expect(arrivee(HABITUES, le15(10))).toEqual({ quoi: 'retard', heure: 240 })
  expect(arrivee(HABITUES, le15(8))).toEqual({ quoi: 'matinal', heure: 240 })
  expect(arrivee(HABITUES, le15(9, 10))).toBeNull()
  expect(arrivee(la, le15(10))).toBeNull()
})

test('ses pensées : son émotion et sa cause, le besoin qui le travaille, ton heure, ce qu’il vit ; endormi, ses rêves', () => {
  const c = { maintenant: T0, dort: false, auTravail: false, equipe: 0, humeur: { ...HUMEUR_DEPART }, rythme: [] as Rythme }
  expect(pense(esprit(), c)).toBe('Il est tranquille.')
  expect(pense(esprit(), { ...c, humeur: { energie: 1, ennui: 0.8, joie: 0.5 } })).toBe('Il s’ennuie de toi.')
  expect(pense(esprit(), { ...c, auTravail: true })).toBe('Il suit ton travail, un carton après l’autre.')
  expect(pense(esprit(), { ...c, auTravail: true, equipe: 2 })).toBe('Il dirige ses minis au travail.')
  // un besoin : il titille, puis il presse
  expect(pense(esprit({ faim: 0.55 }), c)).toBe('Il a une petite faim ; il est tranquille.')
  expect(pense(esprit({ soif: 0.9 }), c)).toBe('Il a soif ; il est tranquille.')
  // ce qu'il fait parce qu'il en avait besoin
  expect(pense(esprit(), { ...c, raison: { besoin: 'faim', anim: 'cookie' } })).toBe('Il avait faim : il se régale ; il est tranquille.')
  // son émotion d'abord, avec sa cause et depuis quand (par pas de cinq minutes)
  const fier = ressent(esprit({ faim: 0.8 }), { quoi: 'push' }, T0 - 4 * MIN)
  expect(pense(fier, c)).toBe('Il est encore fier de ton push (il y a 5 min) ; il a faim.')
  expect(pense(ressent(esprit(), { quoi: 'niveau' }, T0 - MIN), c)).toBe('Il est fier de son nouveau niveau (à l’instant) ; il est tranquille.')
  expect(pense(ressent(esprit(), { quoi: 'echec', serie: 3 }, T0), c)).toBe('Tes 3 échecs d’affilée l’inquiètent ; il est tranquille.')
  let vexe = esprit()
  for (const t of [3000, 2000, 1000]) vexe = ressent(vexe, { quoi: 'zappe' }, T0 - t)
  expect(pense(vexe, c)).toContain('Il boude un peu : tu l’as zappé trois fois de suite')
  // ton heure : il te guette, il t'attend, il se fait tard ; ton arrivée qui sort de l'ordinaire
  expect(pense(esprit(), { ...c, maintenant: le15(8, 55), rythme: HABITUES })).toBe('Il te guette : d’habitude tu arrives vers 9 h ; il est tranquille.')
  expect(pense(esprit(), { ...c, maintenant: le15(10), rythme: HABITUES })).toBe('Il t’attend : d’habitude tu es là vers 9 h ; il est tranquille.')
  expect(pense(esprit(), { ...c, maintenant: le15(18), rythme: noteVu(HABITUES, le15(9)) })).toBe('Il se fait tard pour vous deux : d’habitude tu t’arrêtes vers 18 h ; il est tranquille.')
  expect(pense(esprit(), { ...c, arrivee: { quoi: 'retard', heure: 240 } })).toBe('Tu es arrivé plus tard que d’habitude (9 h) : il t’attendait ; il est tranquille.')
  expect(pense(esprit(), { ...c, arrivee: { quoi: 'matinal', heure: 240 } })).toBe('Tu es matinal aujourd’hui (d’habitude, 9 h) ; il est tranquille.')
  // trois idées au plus
  expect(pense(ressent(esprit({ faim: 0.8 }), { quoi: 'push' }, le15(18) - MIN), { ...c, maintenant: le15(18), rythme: noteVu(HABITUES, le15(9)) }).split(' ; ')).toHaveLength(3)
  // endormi : ce dont il rêve, s'il a un besoin ; sinon à poings fermés
  expect(pense(esprit({ faim: 0.7 }), { ...c, dort: true })).toBe('Il dort ; il rêve d’un cookie.')
  expect(pense(esprit(), { ...c, dort: true })).toBe('Il dort à poings fermés.')
  // sa carte la dit en mots
  expect(texteCarte({ faits: [], humeur: HUMEUR_DEPART, pensee: 'Il est tranquille.' } as unknown as Fiche).at(-1)).toBe('💭 Il est tranquille.')
})

test('💭 ses scènes de pensée : sans texte, légères, jouées une fois ; chacune a son emoji', () => {
  for (const anim of PENSEES) {
    const svg = svgScene(anim)
    expect(svg).not.toContain('<text')
    expect(svg.length).toBeLessThan(40_000)
    expect(dureeScene(anim)).toBeLessThanOrEqual(4)
    expect(EMOJI[anim]).not.toBe('')
    // sa bulle de pensée (sauf quand il boude : il te tourne le dos)
    expect(svgScene(anim, [], 0).includes('#FFFFFF')).toBe(anim !== 'boude')
  }
  // pas des activités tirées au sort : il n'y pense que quand ça le travaille
  for (const anim of PENSEES) expect(ACTIVITES).not.toContain(anim)
})

// ------------------------------------------------------------ en situation

const BAND = {
  plugin: 'clawd',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120, scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const
const SESSION = { cwd: '/projet', surface: 'desktop', isInteractive: true } as const
type On = Parameters<Parameters<typeof test>[1] extends infer F ? (F extends ($: never, on: infer O) => unknown ? (o: O) => void : never) : never>[0]

function moteur(on: On, debut: number) {
  const stockage = new Map<string, unknown>()
  const toasts: string[] = []
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
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  // déjà venu aujourd'hui : pas de réveil ni de retrouvailles
  stockage.set('journee', `${new Date(debut).getFullYear()}-${new Date(debut).getMonth() + 1}-${new Date(debut).getDate()}`)
  stockage.set('vuA', debut)
  return { stockage, horloge, toasts }
}
type Vue = { find: (q: { type: string }) => Promise<{ props?: Record<string, unknown> } | undefined> }
const scene = async (ui: Vue) => String((await ui.find({ type: 'Svg' }))?.props?.alt ?? '').replace('Clawd : ', '')
const clawd = async ($: { command: { run: (c: never) => Promise<{ text?: string }> } }) => String((await $.command.run({ command: 'clawd', args: '', origin: { kind: 'composer' } } as never)).text ?? '')

test('il a faim : il y pense (son cookie dans sa bulle), puis il mange ; /clawd, son 💭 et sa carte disent pourquoi', { timeoutMs: 60_000 }, async ($, on) => {
  const { stockage, horloge, toasts } = moteur(on, T0)
  // affamé, gardé de la session d'avant (fermée à l'instant : il n'a pas dormi entre-temps)
  stockage.set('esprit', { besoins: { faim: 1, soif: 0, bouger: 0, curiosite: 0 }, emotion: null })
  stockage.set('humeurA', T0)
  await $.session.start(SESSION)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await clawd($ as never)).toContain('💭 Il a faim')
  // seconde après seconde : sa pensée, puis ce qui comble sa faim, aussitôt après
  const vues: string[] = []
  let pendant = ''
  for (let s = 0; s < 150 && !['cookie', 'glace'].includes(vues.at(-1) ?? ''); s++) {
    await horloge.advance(1000)
    const vu = await scene(ui as never)
    if (vu !== vues.at(-1)) vues.push(vu)
  }
  expect(['cookie', 'glace']).toContain(vues.at(-1))
  expect(vues.at(-2)).toBe('faim')
  // pendant qu'il mange : il sait pourquoi
  pendant = await clawd($ as never)
  expect(pendant).toContain('💭 Il avait faim : il se régale')
  await ui.press({ key: 'pense' } as never)
  expect(toasts.at(-1)).toContain('💭 Il avait faim : il se régale')
  // rassasié, et gardé pour la session suivante (noté chaque minute)
  await horloge.advance(MIN)
  const garde = espritDe(stockage.get('esprit'))
  expect(garde).not.toBeNull()
  expect(garde!.besoins.faim).toBeLessThan(0.5)
  await ui.unmount()
})

test('trois 🎲 de suite : il boude, te tourne le dos, et ne vient plus te chercher ; un ♥ : pardonné', { timeoutMs: 60_000 }, async ($, on) => {
  const { horloge } = moteur(on, T0)
  await $.session.start(SESSION)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'occupe' } as never)
  await ui.press({ key: 'occupe' } as never)
  expect(await clawd($ as never)).not.toContain('boude')
  // le troisième : vexé, il boude aussitôt
  await ui.press({ key: 'occupe' } as never)
  expect(await scene(ui as never)).toBe('boude')
  expect(await clawd($ as never)).toContain('💭 Il boude un peu : tu l’as zappé trois fois de suite')
  // tant qu'il boude, aucun appel vers toi
  for (let s = 0; s < 100; s++) {
    await horloge.advance(2000)
    expect(['coucou', 'question', 'attend']).not.toContain(await scene(ui as never))
  }
  // ta caresse : il oublie tout
  await ui.press({ key: 'caresse' } as never)
  expect(await clawd($ as never)).not.toContain('boude')
  await ui.unmount()
})

test('ton heure approche : endormi, il se lève tout seul et te guette ; tu arrives en retard, il t’attendait (sans refaire son réveil)', { timeoutMs: 120_000 }, async ($, on) => {
  // la veille à 23 h, tu laisses la session ouverte ; d'habitude tu arrives à 9 h
  const hier23h = new Date(2026, 9, 14, 23, 0).getTime()
  const { stockage, horloge } = moteur(on, hier23h)
  let t = hier23h
  const avance = async (ms: number) => {
    t += ms
    await horloge.advance(ms)
  }
  stockage.set('rythme', HABITUES)
  await $.session.start(SESSION)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  // la nuit, sans toi : il dort pour de bon, jusqu'au matin
  await avance(12 * MIN)
  for (let s = 0; s < 20 && (await scene(ui as never)) !== 'dodo'; s++) await avance(1000)
  expect(await scene(ui as never)).toBe('dodo')
  await avance(le15(8, 45) - t)
  expect(await scene(ui as never)).toBe('dodo')
  // dix minutes avant ton heure : debout, et il guette
  const vues = new Set<string>()
  for (let s = 0; s < 12 * 60 && !vues.has('guette'); s++) {
    await avance(1000)
    vues.add(await scene(ui as never))
  }
  expect(vues.has('reveil')).toBe(true)
  expect(vues.has('guette')).toBe(true)
  expect(await clawd($ as never)).toContain('d’habitude tu arrives vers 9 h')
  // il veille en t'attendant : pas de nouveau dodo d'ici ton arrivée (bien après ton heure)
  await avance(le15(9, 50) - t)
  expect(await clawd($ as never)).toContain('l t’attend : d’habitude tu es là vers 9 h')
  // te voilà : il ne refait pas son réveil, et il le dit
  vues.clear()
  await $.prompt.submit({ text: 'bonjour' } as never)
  for (let s = 0; s < 20; s++) {
    vues.add(await scene(ui as never))
    await avance(1000)
  }
  expect(vues.has('reveil')).toBe(false)
  expect(await clawd($ as never)).toContain('u es arrivé plus tard que d’habitude (9 h) : il t’attendait')
  // ton rythme d'aujourd'hui est noté
  expect((stockage.get('rythme') as Rythme).at(-1)).toMatchObject({ jour: '2026-10-15', debut: 290 })
  await ui.unmount()
})

test('rouvert après une nuit : une petite faim (pas affamé), et son café du réveil l’a désaltéré', { timeoutMs: 60_000 }, async ($, on) => {
  const { stockage, horloge } = moteur(on, le15(8))
  // hier soir : rassasié ; la session d'avant s'est fermée il y a dix heures
  stockage.set('journee', '2026-10-14')
  stockage.set('esprit', { besoins: { faim: 0.1, soif: 0.1, bouger: 0, curiosite: 0 }, emotion: null })
  stockage.set('humeurA', le15(8) - 600 * MIN)
  await $.session.start(SESSION)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  // il sort du lit (son café compris) : une petite faim, pas « il a faim »
  expect(await clawd($ as never)).toContain('💭 Il a une petite faim')
  await horloge.advance(MIN)
  expect(espritDe(stockage.get('esprit'))!.besoins.soif).toBeLessThan(0.2)
  await ui.unmount()
})

test('rien ne le presse : jamais de cookie, de glace ni de café par hasard (il ne mange et ne boit que par besoin)', { timeoutMs: 60_000 }, async ($, on) => {
  const { stockage, horloge } = moteur(on, T0)
  stockage.set('esprit', { besoins: { faim: 0, soif: 0, bouger: 0, curiosite: 0 }, emotion: null })
  stockage.set('humeurA', T0)
  await $.session.start(SESSION)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const vues = new Set<string>()
  for (let s = 0; s < 5 * 60; s++) {
    await horloge.advance(1000)
    vues.add(await scene(ui as never))
  }
  // il s'est occupé (plusieurs activités), sans rien manger ni boire
  expect(vues.size).toBeGreaterThan(3)
  for (const anim of ['cookie', 'glace', 'cafe', 'faim', 'soif']) expect(vues.has(anim)).toBe(false)
  await ui.unmount()
})

test('deux builds ratés d’affilée : il s’inquiète (il sait combien) ; ça passe enfin : il en est fier', { timeoutMs: 60_000 }, async ($, on) => {
  const { horloge } = moteur(on, T0)
  const sortie = { isError: true, text: 'BUILD FAILED' }
  on('tool.call', { tool: 'Bash' }, () => ({ result: sortie.text, isError: sortie.isError, text: sortie.text }) as never)
  await $.session.start(SESSION)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const build = async () => {
    await horloge.advance(20_000)
    await $.tool.call({ tool: 'Bash', command: './gradlew assembleDebug' } as never)
  }
  await build()
  expect(await clawd($ as never)).not.toContain('inquiètent')
  await build()
  expect(await clawd($ as never)).toContain('💭 Tes 2 échecs d’affilée l’inquiètent')
  await build()
  expect(await clawd($ as never)).toContain('💭 Tes 3 échecs d’affilée l’inquiètent')
  sortie.isError = false
  sortie.text = 'BUILD SUCCESSFUL'
  await build()
  const apres = await clawd($ as never)
  expect(apres).not.toContain('inquiètent')
  expect(apres).toContain('💭 Il est fier de vous deux : la galère est passée')
  await ui.unmount()
})

test('ton heure de fin approche : il bâille, une seule fois ce jour-là', { timeoutMs: 60_000 }, async ($, on) => {
  // 17 h 55 : d'habitude tu t'arrêtes à 18 h, et tu es là depuis ce matin
  const { stockage, horloge } = moteur(on, le15(17, 55))
  stockage.set('rythme', [...HABITUES, { jour: '2026-10-15', debut: 240, fin: 770 }])
  await $.session.start(SESSION)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  let bailles = 0
  let avant = ''
  for (let s = 0; s < 8 * 60; s++) {
    await horloge.advance(1000)
    const vu = await scene(ui as never)
    if (vu === 'baille' && avant !== 'baille') bailles++
    avant = vu
  }
  expect(bailles).toBe(1)
  expect(await clawd($ as never)).toContain('d’habitude tu t’arrêtes vers 18 h')
  await ui.unmount()
})

test('un push réussi : il en est fier un bon moment, et y repense au repos (sa médaille dans sa bulle)', { timeoutMs: 60_000 }, async ($, on) => {
  const { horloge } = moteur(on, T0)
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: 'ok', stderr: '', interrupted: false }, text: 'ok' }) as never)
  await $.session.start(SESSION)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await $.tool.call({ tool: 'Bash', command: 'git push' } as never)
  expect(await clawd($ as never)).toContain('💭 Il est encore fier de ton push (à l’instant)')
  const vues = new Set<string>()
  for (let s = 0; s < 240 && !vues.has('fier'); s++) {
    await horloge.advance(1000)
    vues.add(await scene(ui as never))
  }
  expect(vues.has('fier')).toBe(true)
  // dix minutes plus tard, ça lui est passé
  await horloge.advance(11 * MIN)
  expect(await clawd($ as never)).not.toContain('fier')
  await ui.unmount()
})
