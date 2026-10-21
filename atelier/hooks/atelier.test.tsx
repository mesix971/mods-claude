// Tests du mod atelier : adb, git et le disque sont simulés avec de vraies
// sorties réelles d'adb et de git, anonymisées (app, appareil, utilisateur).
import { expect, mock, test } from 'claude-code/testing'

import { ajouteAgent, causeDe, finAgent, nettoieAgents, pastillesAgents, pingAgent } from './agents'
import { analyse, estBuild, quoiBuild, sortieFond } from './build'
import { aJuger, conseilAffiche, coupe, deToi, familleDe, lisConseil, nomEffort, promptConseil } from './conseil'
import { ajouteReponse, debutTour, estLourde, finTour, mesureCout, texteConso, titreConso } from './conso'
import { jauges, svgJauges, titreJauge } from './jauges'
import { decrit, estDiscret } from './outils'
import { svgPastilles } from './pastilles'
import { coutReponse, euros, tokensCourts } from './prix'
import { aRanger } from './rangement'
import { ECHELLE, HAUTEUR_DESSIN, empruntsDe, grandeSceneDe, planBandeau, quandDe, sceneDuBandeau } from './scene'
import { MAX_TACHES, ajouteTache, depuisTodos, horodate, interrompue, majTache, pastillesTaches, planFini, suitPlan, svgTaches, toutFait } from './taches'
import { dureePause } from './temps'

const LOCALAPPDATA = 'C:/Users/dev/AppData/Local'
const ADB = `${LOCALAPPDATA}/Android/Sdk/platform-tools/adb.exe`
const CWD = 'C:/proj'
// 01/10/2026 01:52:28 heure de Paris (CEST, UTC+2)
const APK_MTIME = Date.UTC(2026, 8, 30, 23, 52, 28)

const GRADLE = `
android {
    // des globs dans des chaînes : elles n'ouvrent pas de commentaire
    packaging { resources { excludes += "/META-INF/*.kotlin_module" } }
    defaultConfig {
        applicationId = "com.exemple.monapp"
        versionCode = 30
        versionName = "5.7.0"
    }
    buildTypes {
        debug {
            versionNameSuffix = "-debug"
        }
    }
}
val dex = fileTree("build").matching { include("**/*.dex") }`

const FILES: Record<string, string> = { [`${CWD}/app/build.gradle.kts`]: GRADLE }
const DIRS: Record<string, { name: string; kind: 'file' | 'dir'; mtimeMs: number }[]> = {
  [`${CWD}/app/build/outputs/apk`]: [
    { name: 'androidTest', kind: 'dir', mtimeMs: 0 },
    { name: 'debug', kind: 'dir', mtimeMs: 0 },
    { name: 'release', kind: 'dir', mtimeMs: 0 },
  ],
  [`${CWD}/app/build/outputs/apk/debug`]: [{ name: 'MonApp-5.7.0-debug.apk', kind: 'file', mtimeMs: APK_MTIME }],
  [`${CWD}/app/build/outputs/apk/release`]: [{ name: 'MonApp-5.7.0.apk', kind: 'file', mtimeMs: APK_MTIME - 13_000_000 }],
}

const ok = (stdout: string) => ({ exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false })

function fakeRun(argv: readonly string[], installed: { lastUpdate: string }) {
  const cmd = argv.join(' ')
  if (argv[0] === ADB) {
    if (cmd.includes('devices -l')) return ok('List of devices attached\n0A1B2C3D4E5F           device product:shiba model:Pixel_8 device:shiba transport_id:3\n\n')
    if (cmd.includes('pm list packages')) return ok('package:com.exemple.monapp\n')
    if (cmd.includes('dumpsys package')) {
      return ok(`    versionCode=30 minSdk=28 targetSdk=35\n    versionName=5.7.0-debug\n    lastUpdateTime=${installed.lastUpdate}\n`)
    }
    // vraie paire capturée sur le PC : 22:13:37 local ↔ epoch 1791058417
    if (cmd.includes('shell date')) return ok('1791058417_2026-10-03T22:13:37\n')
    if (cmd.includes(' install -r ')) return ok('Performing Streamed Install\nSuccess\n')
  }
  if (argv[0] === 'git') {
    if (cmd.includes('status')) return ok('## master...origin/master [ahead 2]\n M CHANGELOG.md\n M app/build.gradle.kts\n M app/src/main/java/Main.kt\n')
    if (cmd.includes(' remote')) return ok('origin\n')
    if (cmd.includes(' diff ')) return ok('@@ -40 +40 @@\n-        versionName = "5.6.0"\n+        versionName = "5.7.0"\n')
  }
  return { exitCode: 1, stdout: '', stderr: `inconnu: ${cmd}`, isStdoutTruncated: false, isStderrTruncated: false }
}

const BAND = {
  plugin: 'atelier',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120, scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const

test('bandeau : APK plus récent que le tel, git en avance, quota 5 h', async ($, on) => {
  const installed = { lastUpdate: '2026-09-30 22:11:49' }
  const runs: string[] = []
  const toasts: string[] = []
  // 22:10 heure de Paris : 4 h écoulées sur la fenêtre de 5 h qui se termine à 23:10
  mock.clock(on as never, { now: Date.UTC(2026, 9, 3, 20, 10) })
  // adb trouvé à l'emplacement standard du SDK Windows
  mock.env(on as never, { LOCALAPPDATA })
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('session.cwd', () => ({ value: CWD }))
  // le moteur passe les chemins à la Windows (C:\proj\app\...)
  const norm = (p: string) => p.replace(/\\/g, '/')
  on('fs.exists', ($, e) => ({ value: norm(e.path) in FILES || norm(e.path) in DIRS || norm(e.path) === ADB }))
  on('fs.read', ($, e) => {
    const t = FILES[norm(e.path)]
    if (t === undefined) throw new Error(`absent: ${e.path}`)
    return { value: t }
  })
  on('fs.list', ($, e) => {
    const d = DIRS[norm(e.path)]
    if (!d) throw new Error(`absent: ${e.path}`)
    return { value: d.map(x => ({ ...x, size: 1, isLink: false })) }
  })
  on('process.run', ($, e) => {
    runs.push(e.argv.join(' '))
    if (e.argv.join(' ').includes(' install -r ')) installed.lastUpdate = '2026-10-03 22:20:00'
    return { value: fakeRun(e.argv, installed) }
  })
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>moteur</Text>
  })

  await $.session.measure({
    context: { tokens: 90_000, window: 200_000, percent: 45 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 82, resetsAt: '2026-10-03T21:10:00Z' },
      // reset dans 6 jours : on affiche aussi le jour (vendredi 9 octobre, 07:30 à Paris)
      { kind: 'seven_day', percentUsed: 81, resetsAt: '2026-10-09T05:30:00Z' },
    ],
    changed: ['context', 'rateLimits'],
  })
  expect(toasts.some(t => t.includes('Quota 5 h à 82 %'))).toBe(true)
  await $.command.run({ command: 'atelier', args: '', origin: { kind: 'composer' } })
  await $.command.run({ command: 'atelier', args: '', origin: { kind: 'composer' } })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ key: 'install' })).toBeDefined()
    expect(await ui.find({ key: 'commit' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /📱 5\.7\.0 \(30\)/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /APK 5\.7\.0-debug 01:52/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /tel 5\.7\.0-debug 22:11 ⚠ pas à jour/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /2 commits non poussés/ })).toBeDefined()
    // ↻ et Masquer au bout de la ligne git, courte : la ligne des quotas ne passe plus à la ligne
    expect(JSON.stringify((await ui.find({ key: 'ligne-git' }))?.children)).toContain('Masquer')
    expect(JSON.stringify((await ui.find({ key: 'ligne-quotas' }))?.children)).not.toContain('Masquer')
    // quotas en jauges : dessin sur desktop (son texte alternatif dit tout), blocs ▰▱ en terminal
    if (surface === 'desktop') {
      const alt = String((await ui.find({ type: 'Svg' }))?.props?.alt ?? '')
      expect(alt).toContain('5 h 82 % → 23:10 (attention)')
      expect(alt).toContain('7 j 81 % → ven. 07:30 (attention)')
      expect(alt).toContain('contexte 45 %')
      // interactif : le survol d'une jauge dit sa projection (4 h sur 5 écoulées pour 82 % : la limite tombe avant le reset)
      const jaugesSvg = await ui.find({ type: 'Svg' })
      expect(jaugesSvg?.props?.isInteractive).toBe(true)
      expect(String(jaugesSvg?.props?.source)).toContain('À ce rythme : 100 % vers')
    } else {
      expect(await ui.find({ type: 'Text', text: /5 h ▰{7}▱ 82 % → 23:10/ })).toBeDefined()
    }
    // ce que les autres mods (clawd) dessinent sous le bandeau reste visible
    expect(await ui.find({ type: 'Text', text: /moteur/ })).toBeDefined()
    await ui.unmount()
  }

  // /tel installe le debug (le plus récent), puis le tel est à jour
  const res = await $.command.run({ command: 'tel', args: '', origin: { kind: 'composer' } })
  expect(res.text ?? '').toContain('MonApp-5.7.0-debug.apk installé')
  expect(runs.some(r => r.endsWith('install -r C:/proj/app/build/outputs/apk/debug/MonApp-5.7.0-debug.apk'))).toBe(true)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /✓/ })).toBeDefined()
  await ui.unmount()
})

test('jauges : le rythme de consommation alerte avant le seuil', async () => {
  const fin = Date.UTC(2026, 9, 6, 15, 0)
  const u = (p: number) => ({ fiveHour: { percent: p, resetsAt: new Date(fin).toISOString() }, sevenDay: null, contextPercent: 20 })
  // 1 h 15 écoulée sur 5 h (25 %) mais 40 % consommés : la limite tombera avant le reset
  expect(jauges(u(40), fin - 3.75 * 3600_000)[0]!.niveau).toBe('attention')
  // 3 h écoulées (60 %) pour 40 % consommés : tranquille
  const calme = jauges(u(40), fin - 2 * 3600_000)[0]!
  expect(calme.niveau).toBe('ok')
  expect(Math.round((calme.ecoule ?? 0) * 100)).toBe(60)
  // tout début de fenêtre : pas de fausse alerte sur des miettes
  expect(jauges(u(8), fin - 4.8 * 3600_000)[0]!.niveau).toBe('ok')
  expect(jauges(u(95), fin - 60_000)[0]!.niveau).toBe('critique')
  // l'heure du reset est passée : la fenêtre repart de zéro, sans attendre l'API
  const neuve = jauges(u(95), fin + 60_000)[0]!
  expect(neuve.pct).toBe(0)
  expect(neuve.niveau).toBe('ok')
  expect(neuve.ecoule).toBe(null)
  // contexte
  expect(jauges({ fiveHour: null, sevenDay: null, contextPercent: 80 }, fin)[0]!.niveau).toBe('attention')
})

test('↻ relit les quotas, une fenêtre déjà réinitialisée repart à 0 %, et « Masquer » dit comment revenir', async ($, on) => {
  // 08:00 à Paris
  mock.clock(on as never, { now: Date.UTC(2026, 9, 7, 6, 0) })
  mock.env(on as never, {})
  on('session.cwd', () => ({ value: 'C:/vide' }))
  on('fs.exists', () => ({ value: false }))
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  const toasts: string[] = []
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>moteur</Text>
  })
  // ce que la dernière réponse de l'API a dit (le test le change plus bas)
  let api: { kind: string; percentUsed: number; resetsAt: string }[] = []
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 920_000, window: 1_000_000, percent: 92 }, rateLimits: api } }))
  // ancienne lecture : la fenêtre de 5 h s'est terminée à 07:00, la semaine court encore
  await $.session.measure({
    context: { tokens: 920_000, window: 1_000_000, percent: 92 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 5, resetsAt: '2026-10-07T05:00:00Z' },
      { kind: 'seven_day', percentUsed: 66, resetsAt: '2026-10-07T06:30:00Z' },
    ],
    changed: ['context', 'rateLimits'],
  })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const alt = async () => String((await ui.find({ type: 'Svg' }))?.props?.alt ?? '')
  expect(await alt()).toContain('5 h 0 %')
  expect(await alt()).toContain('7 j 66 %')
  // sans git, ↻ et Masquer restent sur la ligne des quotas
  expect(JSON.stringify((await ui.find({ key: 'ligne-quotas' }))?.children)).toContain('Masquer')
  // la dernière réponse de l'API dit 0 % partout : le bouton ↻ va la relire
  api = [
    { kind: 'five_hour', percentUsed: 0, resetsAt: '2026-10-07T11:00:00Z' },
    { kind: 'seven_day', percentUsed: 0, resetsAt: '2026-10-14T06:00:00Z' },
  ]
  await ui.press({ key: 'refresh' })
  expect(await alt()).toContain('7 j 0 %')
  expect(await alt()).toContain('contexte 92 %')
  // « Masquer » : le bandeau s'efface, et un message dit comment le faire revenir
  await ui.press({ key: 'hide' })
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  expect(toasts).toContain('Bandeau atelier masqué : tape /atelier pour le ré-afficher')
  // /atelier le fait revenir
  await $.command.run({ command: 'atelier', args: '', origin: { kind: 'composer' } })
  expect(await alt()).toContain('contexte 92 %')
  await ui.unmount()
})

// ------------------------------------------------------------ garde-fous

function shellStubs(on: Parameters<Parameters<typeof test>[1] extends infer F ? F extends ($: never, on: infer O) => unknown ? (o: O) => void : never : never>[0], opts: { answer: string | null; staged?: string }) {
  const ran: string[] = []
  const asked: string[] = []
  const norm = (p: string) => p.replace(/\\/g, '/')
  on('session.cwd', () => ({ value: CWD }))
  on('ui.toast', () => ({ value: undefined }))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('fs.exists', ($, e) => ({ value: norm(e.path).includes('Android Studio Preview/jbr/lib/jvm.cfg') }))
  on('fs.read', () => {
    throw new Error('absent')
  })
  // deux installations d'Android Studio : la classique au JBR cassé, la Preview qui marche
  on('fs.list', ($, e) => {
    if (norm(e.path) !== 'C:/Program Files/Android') throw new Error('absent')
    return { value: ['Android Studio', 'Android Studio Preview'].map(name => ({ name, kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false })) }
  })
  mock.env(on as never, {})
  on('process.run', ($, e) => {
    const cmd = e.argv.join(' ')
    if (cmd.includes('diff --cached --name-only')) return { value: ok(opts.staged ?? '') }
    if (cmd.includes('ls-files')) return { value: ok(opts.staged ?? '') }
    return { value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('tool.call', { tool: 'AskUserQuestion' }, ($, e) => {
    const q = e.questions[0]?.question ?? ''
    asked.push(q)
    if (opts.answer === null) throw new Error('fermé')
    return { result: { questions: e.questions, answers: { [q]: opts.answer } } }
  })
  for (const tool of ['Bash', 'PowerShell'] as const) {
    on('tool.call', { tool }, ($, e) => {
      ran.push(e.command)
      return { result: { stdout: 'ok', stderr: '', interrupted: false } }
    })
  }
  return { ran, asked }
}

test('JBR d’Android Studio cassé corrigé et JAVA_HOME ajouté à gradlew', async ($, on) => {
  const { ran } = shellStubs(on as never, { answer: null })
  await $.tool.call({ tool: 'Bash', command: 'export JAVA_HOME="C:/Program Files/Android/Android Studio/jbr" && ./gradlew assembleDebug' })
  expect(ran[0]).toBe('export JAVA_HOME="C:/Program Files/Android/Android Studio Preview/jbr" && ./gradlew assembleDebug')
  await $.tool.call({ tool: 'PowerShell', command: '.\\gradlew.bat assembleDebug' })
  expect(ran[1]).toBe("$env:JAVA_HOME = 'C:\\Program Files\\Android\\Android Studio Preview\\jbr'; .\\gradlew.bat assembleDebug")
})

test('commande destructrice : refusée si tu fermes la question', async ($, on) => {
  const { ran, asked } = shellStubs(on as never, { answer: null })
  const r = await $.tool.call({ tool: 'Bash', command: 'adb shell pm clear com.sec.android.app.launcher' })
  expect(asked.length).toBe(1)
  expect(asked[0]).toContain('efface toutes les données')
  expect(ran.length).toBe(0)
  expect(r.isError === true || r.deny !== undefined).toBe(true)
})

test('commande destructrice : passe si tu autorises', async ($, on) => {
  const { ran } = shellStubs(on as never, { answer: 'Autoriser' })
  await $.tool.call({ tool: 'Bash', command: 'git reset --hard HEAD~1' })
  expect(ran).toEqual(['git reset --hard HEAD~1'])
})

test('secret indexé : le commit est bloqué', async ($, on) => {
  const { ran, asked } = shellStubs(on as never, { answer: 'Refuser', staged: 'app/src/Main.kt\nlocal.properties\n.env.example\n' })
  await $.prompt.submit({ text: 'commit et pousse' })
  await $.tool.call({ tool: 'Bash', command: 'git commit -m "feat: truc"' })
  expect(asked[0]).toContain('local.properties')
  expect(asked[0]).not.toContain('.env.example')
  expect(ran.length).toBe(0)
})

test('commit : toujours direct ; push non demandé : confirmation, demandé : direct', async ($, on) => {
  const { ran, asked } = shellStubs(on as never, { answer: 'Refuser' })
  await $.prompt.submit({ text: 'corrige le bug du minuteur' })
  await $.tool.call({ tool: 'Bash', command: 'git commit -am "fix: minuteur"' })
  expect(asked.length).toBe(0)
  expect(ran).toEqual(['git commit -am "fix: minuteur"'])
  await $.tool.call({ tool: 'Bash', command: 'git push' })
  expect(asked.length).toBe(1)
  expect(ran.length).toBe(1)
  await $.prompt.submit({ text: 'ok commit et pousse' })
  await $.tool.call({ tool: 'Bash', command: 'git push' })
  expect(ran).toEqual(['git commit -am "fix: minuteur"', 'git push'])
})

test('PowerShell : pas de bash WSL ni d’attente bloquante', async ($, on) => {
  const { ran } = shellStubs(on as never, { answer: null })
  const a = await $.tool.call({ tool: 'PowerShell', command: 'bash -c "ls"' })
  const b = await $.tool.call({ tool: 'PowerShell', command: 'Start-Sleep -Seconds 60; Get-Content log.txt' })
  await $.tool.call({ tool: 'PowerShell', command: 'Start-Sleep -Milliseconds 500' })
  await $.tool.call({ tool: 'PowerShell', command: '& "C:\\Program Files\\Git\\bin\\bash.exe" -c "ls"' })
  expect(a.isError === true || a.deny !== undefined).toBe(true)
  expect(b.isError === true || b.deny !== undefined).toBe(true)
  expect(ran).toEqual(['Start-Sleep -Milliseconds 500', '& "C:\\Program Files\\Git\\bin\\bash.exe" -c "ls"'])
})

test('rien à montrer : le bandeau laisse le moteur dessiner', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>moteur</Text>
  })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ key: 'install' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /moteur/ })).toBeDefined()
    await ui.unmount()
  }
})

test('ce que dessine Clawd reste au même endroit de l’arbre, bande vide, pleine ou masquée (sinon son image repart du début)', async ($, on) => {
  mock.clock(on as never, { now: Date.UTC(2026, 9, 7, 6, 0) })
  mock.env(on as never, {})
  on('session.cwd', () => ({ value: 'C:/vide' }))
  on('fs.exists', () => ({ value: false }))
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('session.usage', () => ({ value: null }) as never)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>clawd</Text>
  })
  // le chemin jusqu'à son dessin : les types et les rangs de ses ancêtres
  const chemin = (n: unknown, vise: string): string | null => {
    const e = n as { type?: string; text?: string; children?: unknown[] }
    if (!e || typeof e !== 'object') return null
    if (e.type === 'Text' && (e.children ?? []).includes(vise)) return 'Text'
    for (const [i, c] of (e.children ?? []).entries()) {
      const s = chemin(c, vise)
      if (s) return `${e.type}[${i}]>${s}`
    }
    return null
  }
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const racine = async () => chemin(await ui.find({ type: 'Box' }), 'clawd')
  // bande vide : il est déjà dans la même enveloppe
  const vide = await racine()
  expect(vide).not.toBeNull()
  // les quotas arrivent : la bande se remplit, il ne change pas de place
  await $.session.measure({
    context: { tokens: 920_000, window: 1_000_000, percent: 92 },
    rateLimits: [{ kind: 'five_hour', percentUsed: 5, resetsAt: '2026-10-07T09:00:00Z' }],
    changed: ['context', 'rateLimits'],
  })
  expect(await ui.find({ type: 'Svg' })).toBeDefined()
  expect(await racine()).toBe(vide)
  // masquée : toujours au même endroit
  await ui.press({ key: 'hide' })
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  expect(await racine()).toBe(vide)
  await ui.unmount()
})

test('version calculée par le script : lue dans version.properties, pas dans un commentaire', async ($, on) => {
  const fichiers: Record<string, string> = {
    [`${CWD}/app/build.gradle.kts`]: `
// Versioning auto : on lit version.properties à la racine du projet.
// versionName = "$major.$minor.$patch"  (ex. "1.2.3")
val computedVersionName = "$vMajor.$vMinor.$vPatch"
android {
    defaultConfig {
        applicationId = "com.exemple.monapp"
        versionCode = computedVersionCode
        versionName = computedVersionName
    }
}`,
    [`${CWD}/version.properties`]: '#MonApp version\nversionBuild=51\nversionMajor=3\nversionMinor=15\nversionPatch=2\n',
  }
  mock.clock(on as never)
  mock.env(on as never, { LOCALAPPDATA })
  on('session.cwd', () => ({ value: CWD }))
  const norm = (p: string) => p.replace(/\\/g, '/')
  on('fs.exists', ($, e) => ({ value: norm(e.path) in fichiers || norm(e.path) === ADB }))
  on('fs.read', ($, e) => {
    const f = fichiers[norm(e.path)]
    if (f === undefined) throw new Error(`absent: ${e.path}`)
    return { value: f }
  })
  on('fs.list', ($, e) => {
    throw new Error(`absent: ${e.path}`)
  })
  // pas de tel branché, pas de dépôt git
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>moteur</Text>
  })
  await $.command.run({ command: 'atelier', args: '', origin: { kind: 'composer' } })
  await $.command.run({ command: 'atelier', args: '', origin: { kind: 'composer' } })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /📱 3\.15\.2/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /\$major/ })).toBeUndefined()
  await ui.unmount()
})

// ------------------------------------------------------- liste de tâches

test('tâches : la liste suit le plan, ses avances, et les tâches de Claude Code', async () => {
  const plan = suitPlan([], {
    items: [
      { content: 'Lire le code', status: 'in_progress' },
      { content: 'Corriger le bug', status: 'pending' },
      { content: 'Vérifier', status: 'pending' },
    ],
  })
  expect(plan.map(t => t.etat)).toEqual(['encours', 'attente', 'attente'])
  const deux = suitPlan(plan, { advance: true })
  expect(deux.map(t => t.etat)).toEqual(['faite', 'encours', 'attente'])
  // dans le désordre (numéros à partir de 1) : une seule étape en cours
  expect(suitPlan(deux, { start: 3 }).map(t => t.etat)).toEqual(['faite', 'attente', 'encours'])
  expect(suitPlan(deux, { done: [2], start: 3 }).map(t => t.etat)).toEqual(['faite', 'faite', 'encours'])
  // la dernière avance : tout est fait
  expect(toutFait(suitPlan(suitPlan(deux, { advance: true }), { advance: true }))).toBe(true)
  expect(toutFait([])).toBe(false)

  // les tâches de Claude Code, par leur id
  let l = ajouteTache([], '1', 'Lire le code')
  l = ajouteTache(l, '2', 'Corriger')
  l = majTache(l, { taskId: '1', status: 'completed' })
  l = majTache(l, { taskId: '2', status: 'in_progress', subject: 'Corriger le bug' })
  expect(l).toEqual([
    { id: 'task-1', nom: 'Lire le code', etat: 'faite' },
    { id: 'task-2', nom: 'Corriger le bug', etat: 'encours' },
  ])
  expect(majTache(l, { taskId: '1', status: 'deleted' }).map(t => t.id)).toEqual(['task-2'])

  // un nom piégé ne casse pas le dessin
  const { svg } = svgTaches([{ id: 'x', nom: 'a <b> & "c"', etat: 'attente' }])
  expect(svg).toContain('<title>a &lt;b&gt; &amp; &quot;c&quot; — à faire</title>')
})

function bandeauVide(on: Parameters<Parameters<typeof test>[1] extends infer F ? F extends ($: never, on: infer O) => unknown ? (o: O) => void : never : never>[0]) {
  const horloge = mock.clock(on as never)
  mock.env(on as never, {})
  on('session.cwd', () => ({ value: 'C:/vide' }))
  on('fs.exists', () => ({ value: false }))
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('ui.toast', () => ({ value: undefined }))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>moteur</Text>
  })
  return horloge
}

test('bandeau : la liste de l’app desktop en pastilles, le nom au survol, cochées en vert', async ($, on) => {
  bandeauVide(on as never)
  on('tool.call', { tool: 'mcp__ccd_turn__update_plan' }, () => ({ result: { ok: true } }))
  const plan = (args: Record<string, unknown>) => $.tool.call({ tool: 'mcp__ccd_turn__update_plan', tool_use_id: 'plan', ...args })
  await plan({
    items: [
      { content: 'Lire le code', status: 'in_progress' },
      { content: 'Corriger le bug', status: 'pending' },
      { content: 'Vérifier', status: 'pending' },
    ],
    scope: 'first_task',
  })
  await plan({ advance: true })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const svg = await ui.find({ type: 'Svg' })
  // dessiné en cadre interactif : c'est ce qui fait marcher l'infobulle du survol
  expect(svg?.props?.isInteractive).toBe(true)
  const source = String(svg?.props?.source ?? '')
  expect(source).toContain('<title>Lire le code — faite en ')
  expect(source).toContain('#4cc38a')
  expect(String(svg?.props?.alt)).toBe('Tâches 1/3 : Lire le code (faite), Corriger le bug (en cours), Vérifier (à faire)')
  expect(await ui.find({ type: 'Text', text: /moteur/ })).toBeDefined()
  await ui.unmount()

  const term = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await term.find({ type: 'Text', text: /✔/ })).toBeDefined()
  expect(await term.find({ type: 'Text', text: /◐/ })).toBeDefined()
  await term.unmount()

  // tout est fait : les pastilles restent cochées jusqu'au message suivant
  await plan({ advance: true })
  await plan({ advance: true })
  const fini = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(String((await fini.find({ type: 'Svg' }))?.props?.alt)).toContain('Tâches 3/3')
  await $.prompt.submit({ text: 'merci' })
  expect(await fini.find({ type: 'Svg' })).toBeUndefined()
  expect(await fini.find({ type: 'Text', text: /moteur/ })).toBeDefined()
  await fini.unmount()
})

test('bandeau : les tâches de Claude Code, créées, cochées, supprimées', async ($, on) => {
  bandeauVide(on as never)
  let n = 0
  on('tool.call', { tool: 'TaskCreate' }, ($, e) => ({ result: { task: { id: String(++n), subject: e.subject } } }))
  on('tool.call', { tool: 'TaskUpdate' }, ($, e) =>
    e.taskId === '99'
      ? { result: { success: false, taskId: e.taskId, updatedFields: [], error: 'Task not found' } }
      : { result: { success: true, taskId: e.taskId, updatedFields: ['status'] } },
  )
  await $.tool.call({ tool: 'TaskCreate', subject: 'Lire le code', description: 'tout lire' })
  await $.tool.call({ tool: 'TaskCreate', subject: 'Corriger le bug', description: 'le corriger' })
  await $.tool.call({ tool: 'TaskUpdate', taskId: '1', status: 'completed' })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const alt = async () => String((await ui.find({ type: 'Svg' }))?.props?.alt ?? '')
  expect(await alt()).toBe('Tâches 1/2 : Lire le code (faite), Corriger le bug (à faire)')
  await $.tool.call({ tool: 'TaskUpdate', taskId: '2', status: 'deleted' })
  expect(await alt()).toBe('Tâches 1/1 : Lire le code (faite)')
  // l'outil répond sans erreur mais n'a rien changé : pas de pastille fantôme
  await $.tool.call({ tool: 'TaskUpdate', taskId: '99', status: 'in_progress' })
  expect(await alt()).toBe('Tâches 1/1 : Lire le code (faite)')
  await ui.unmount()
})

test('tâches : les cas limites relevés à la relecture', async () => {
  const plan = suitPlan([], { items: [{ content: 'A', status: 'completed' }, { content: 'B', status: 'in_progress' }, { content: 'C', status: 'pending' }] })
  // un `start` hors de la liste ne dérange pas l'étape en cours
  expect(suitPlan(plan, { done: [1], start: 99 }).map(t => t.etat)).toEqual(['faite', 'encours', 'attente'])
  // tour interrompu : l'étape en cours repasse en attente
  expect(interrompue(plan).map(t => t.etat)).toEqual(['faite', 'attente', 'attente'])
  // travail clos sans rien en suspens : tout le plan est coché, pas les tâches d'une autre source
  expect(planFini([...plan, { id: 'task-1', nom: 'x', etat: 'attente' }]).map(t => t.etat)).toEqual(['faite', 'faite', 'faite', 'attente'])
  // une tâche qu'on n'a pas vue naître (session reprise) apparaît quand même
  expect(majTache([], { taskId: '7', status: 'in_progress' })).toEqual([{ id: 'task-7', nom: 'Tâche 7', etat: 'encours' }])
  // les tâches de Claude Code ne se mêlent pas aux restes d'un plan
  expect(ajouteTache(plan, '1', 'Nouvelle').map(t => t.id)).toEqual(['task-1'])
  // liste pleine : la plus ancienne laisse sa place, la nouvelle s'affiche
  let l = ajouteTache([], 0, 'premiere')
  for (let i = 1; i <= MAX_TACHES; i++) l = ajouteTache(l, i, `t${i}`)
  expect(l.length).toBe(MAX_TACHES)
  expect(l[0]!.nom).toBe('t1')
  expect(l[MAX_TACHES - 1]!.nom).toBe(`t${MAX_TACHES}`)
  // un caractère de contrôle (interdit en XML) ne casse pas le dessin
  const [sale] = depuisTodos([{ content: 'a\u0001b\u0000c', status: 'pending' }])
  expect(sale!.nom).toBe('a b c')
  // l'étape en cours est l'orbe qui respire (120 points), animé seulement pendant le travail
  const anime = svgTaches(plan, true).svg
  expect(anime).toContain('class="orbe"')
  expect(anime.match(/<circle [^>]*fill-opacity/g)?.length).toBe(120)
  expect(anime).toContain('class="o1"')
  expect(anime).toContain('@keyframes orbe1')
  expect(anime).toContain('prefers-reduced-motion')
  const fige = svgTaches(plan, false).svg
  expect(fige).toContain('class="orbe"')
  expect(fige).not.toContain('class="o1"')
  // sans étape en cours, pas une ligne de l'orbe
  expect(svgTaches(suitPlan(plan, { done: [2] }), true).svg).not.toContain('orbe')
  // trois orbes au plus ; même 40 étapes en cours tiennent dans la limite du moteur
  const enCours = Array.from({ length: MAX_TACHES }, (_, i) => ({ id: `task-${i}`, nom: `t${i}`, etat: 'encours' as const }))
  const lourd = svgTaches(enCours, true).svg
  expect(lourd.match(/class="orbe"/g)?.length).toBe(3)
  expect(lourd.length).toBeLessThan(131_072)
})

test('bandeau : TodoWrite et TaskList suivis, pas la liste d’un sous-agent, et vidés au /clear', async ($, on) => {
  bandeauVide(on as never)
  on('tool.call', { tool: 'TodoWrite' }, ($, e) => ({ result: { oldTodos: [], newTodos: e.todos } }))
  on('tool.call', { tool: 'TaskList' }, () => ({
    result: { tasks: [{ id: '3', subject: 'Recaler la liste', status: 'in_progress', blockedBy: [] }] },
  }))
  on('turn.complete', () => ({ text: '' }))
  on('session.end', ($, e) => ({ sessionId: e.sessionId }))
  const todos = [
    { content: 'Lire le code', status: 'completed', activeForm: 'Lecture du code' },
    { content: 'Corriger le bug', status: 'in_progress', activeForm: 'Correction du bug' },
  ]
  await $.tool.call({ tool: 'TodoWrite', todos })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const alt = async () => String((await ui.find({ type: 'Svg' }))?.props?.alt ?? '')
  expect(await alt()).toBe('Tâches 1/2 : Lire le code (faite), Corriger le bug (en cours)')

  // la liste d'un sous-agent ne remplace pas celle de la session
  await $.tool.call({ tool: 'TodoWrite', todos: [{ content: 'Fouiller', status: 'in_progress', activeForm: 'Fouille' }], agentId: 'a1' })
  expect(await alt()).toBe('Tâches 1/2 : Lire le code (faite), Corriger le bug (en cours)')

  // tour interrompu : l'étape en cours repasse en attente
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: true, turnId: 't1', reason: 'aborted' })
  expect(await alt()).toBe('Tâches 1/2 : Lire le code (faite), Corriger le bug (à faire)')

  // un message glissé par le moteur ne vide pas un plan, même fini
  await $.tool.call({ tool: 'TodoWrite', todos: todos.map(t => ({ ...t, status: 'completed' })) })
  await $.prompt.submit({ text: 'rappel', isMeta: true })
  expect(await alt()).toContain('Tâches 2/2')

  // TaskList recale la liste sur les tâches de Claude Code
  await $.tool.call({ tool: 'TaskList' })
  expect(await alt()).toBe('Tâches 0/1 : Recaler la liste (en cours)')

  // /clear : nouvelle conversation, plus de pastilles
  await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } })
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  await ui.unmount()
})

test('bandeau : Claude clôt son travail sans cocher ses dernières étapes, le plan s’affiche fini', async ($, on) => {
  bandeauVide(on as never)
  on('tool.call', { tool: 'mcp__ccd_turn__update_plan' }, () => ({ result: { ok: true } }))
  on('tool.call', { tool: 'mcp__ccd_turn__wrap_up' }, () => ({ result: { ok: true } }))
  const appel = (tool: string, args: Record<string, unknown>) => $.tool.call({ tool, tool_use_id: tool, ...args } as never)
  const etapes = ['Plafonner', 'Déployer', 'Autoriser', 'Lancer', 'Colorer', 'Vérifier']
  const plan = (faites: number) =>
    etapes.map((content, i) => ({ content, status: i < faites ? 'completed' : i === faites ? 'in_progress' : 'pending' }))
  await appel('mcp__ccd_turn__update_plan', { items: plan(2), scope: 'continuation' })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const alt = async () => String((await ui.find({ type: 'Svg' }))?.props?.alt ?? '')

  // un récap qui te pose une question : les étapes restantes t'attendent vraiment
  await appel('mcp__ccd_turn__wrap_up', { recap: 'la fenêtre d’autorisation attend ta validation', ask: 'Tu me dis quand c’est validé ?' })
  expect(await alt()).toContain('Tâches 2/6')

  // le vrai cas : 4 faites, la 5e en cours, la 6e à faire, puis le récap final sans question
  await appel('mcp__ccd_turn__update_plan', { items: plan(4), scope: 'continuation' })
  expect(await alt()).toContain('Tâches 4/6')
  await appel('mcp__ccd_turn__wrap_up', { recap: 'le tri tourne et les couleurs sont appliquées' })
  expect(await alt()).toContain('Tâches 6/6')
  await ui.unmount()
})

// ------------------------------------------- conso, quotas, minuteur, build, sous-agents

/** Un montant au millionième près (les flottants ne tombent pas juste) */
const millioniemes = (x: number | null | undefined) => Math.round((x ?? NaN) * 1e6)

test('prix : le coût d’une réponse au tarif API, et son écriture en euros', async () => {
  const u = (entree: number, lu: number, ecrit: number, sortie: number) => ({ entree, lu, ecrit, sortie })
  // tarifs officiels au million de tokens (pricing du 17/10/2026)
  expect(coutReponse('claude-opus-5-5', u(1e6, 0, 0, 0))).toBe(4)
  expect(millioniemes(coutReponse('claude-opus-5-5', u(0, 1e6, 1e6, 1e6)))).toBe(millioniemes(0.2 + 5 + 20))
  expect(millioniemes(coutReponse('claude-sonnet-5-5', u(0, 1e6, 0, 0)))).toBe(millioniemes(0.1))
  expect(millioniemes(coutReponse('claude-fable-5-1', u(0, 1e6, 0, 1e6)))).toBe(millioniemes(0.25 + 50))
  // Haiku : au-delà de 100 000 tokens de prompt (cache compris), toute la requête au tarif long
  expect(millioniemes(coutReponse('claude-haiku-5-5', u(50_000, 40_000, 0, 0)))).toBe(millioniemes(0.0054))
  expect(millioniemes(coutReponse('claude-haiku-5-5', u(150_000, 0, 0, 0)))).toBe(millioniemes(0.075))
  expect(coutReponse('modele-maison-7b', u(1e6, 0, 0, 0))).toBe(null)
  expect(euros(1.1253)).toBe('1,00 €')
  expect(euros(0.004)).toBe('< 0,01 €')
  expect([tokensCourts(1_284_512), tokensCourts(9_400), tokensCourts(25_000), tokensCourts(850)]).toEqual(['1,3 M', '9,4 k', '25 k', '850'])
})

test('conso : le tour d’après /cost, sinon estimé, et l’alerte de conversation lourde', async () => {
  // le moteur tient /cost : le tour vaut la différence depuis son début
  let c = debutTour(null, 10)
  c = ajouteReponse(c, 'claude-opus-5-5', { entree: 2_000, lu: 500_000, ecrit: 10_000, sortie: 3_000 }, true, 10.5)
  expect(millioniemes(c.tour?.dollars)).toBe(millioniemes(0.5))
  expect(c.tour?.estime).toBe(false)
  expect(texteConso(c)).toBe('tour 515 k · 0,44 €')
  expect(estLourde(c)).toBe(true)
  expect(titreConso(c)).toContain('d’après /cost')
  expect(titreConso(c)).toContain('⚠ Chaque réponse relit 512 k tokens')
  // un sous-agent répond après la fin du tour : seule la session compte
  c = finTour(c, 10.5)!
  c = ajouteReponse(c, 'claude-haiku-5-5', { entree: 1_000, lu: 0, ecrit: 0, sortie: 100 }, false, 10.6)
  expect(c.tour?.enCours).toBe(false)
  expect(texteConso(c)).toBe('tour 515 k · 0,44 €')
  expect(millioniemes(c.session.dollars)).toBe(millioniemes(10.6))
  // sans /cost : estimé avec la grille de prix
  const e = ajouteReponse(debutTour(null, null), 'claude-sonnet-5-5', { entree: 1_000, lu: 100_000, ecrit: 0, sortie: 1_000 }, true, null)
  expect(millioniemes(e.tour?.dollars)).toBe(millioniemes(0.022))
  expect(titreConso(e)).toContain('estimation d’après les tarifs API')
  expect(estLourde(e)).toBe(false)
})

test('quotas : la projection au survol des jauges', async () => {
  const quand = (ms: number) => new Date(ms).toISOString().slice(11, 16)
  const fin = Date.UTC(2026, 9, 17, 15, 0)
  const u = (p: number) => ({ fiveHour: { percent: p, resetsAt: new Date(fin).toISOString() }, sevenDay: null, contextPercent: 29 })
  const a = (p: number, maintenant: number) => titreJauge(jauges(u(p), maintenant)[0]!, maintenant, quand)
  // mi-fenêtre (12:30) : 30 % → environ 60 % au reset
  expect(a(30, fin - 2.5 * 3600_000)).toBe('Quota 5 h : 30 % utilisés · reset 15:00\nÀ ce rythme : environ 60 % au reset. Tu tiens.')
  // 70 % à mi-fenêtre : la limite tombe à 10:00 + 2 h 30 × 100/70, vers 13:34 ; et pour revenir
  // dans le rythme, le trait doit rattraper la barre : 70 % de 5 h après 10:00, soit 13:30, dans 1 h
  expect(a(70, fin - 2.5 * 3600_000)).toBe(
    "Quota 5 h : 70 % utilisés · reset 15:00\nÀ ce rythme : 100 % vers 13:34, avant le reset.\nPause pour revenir dans le rythme : 1 h 00 (jusqu'à 13:30)",
  )
  expect(a(80, fin - 2.5 * 3600_000)).toContain("Pause pour revenir dans le rythme : 1 h 30 (jusqu'à 14:00)")
  // sur 7 jours : 70 % consommés, 65 % du temps écoulé, 5 % d'une semaine à attendre
  const sem = (maintenant: number) =>
    titreJauge(jauges({ fiveHour: null, sevenDay: { percent: 70, resetsAt: new Date(fin).toISOString() }, contextPercent: null }, maintenant)[0]!, maintenant, quand)
  expect(sem(fin - 0.35 * 7 * 24 * 3600_000)).toContain('Pause pour revenir dans le rythme : 8 h 24 (jusqu')
  // dans le rythme : rien à attendre
  expect(a(30, fin - 2.5 * 3600_000)).not.toContain('Pause')
  expect(a(10, fin - 4.9 * 3600_000)).toContain('Trop tôt dans la fenêtre')
  const ctx = jauges(u(30), fin - 3600_000).find(j => j.nom === 'ctx')!
  expect(titreJauge(ctx, fin, quand, { tokens: 290_000, window: 1_000_000 })).toBe('Contexte : 29 % de la fenêtre (290 k sur 1 M tokens)')
})

test('pause : sa durée en minutes, en heures, en jours', () => {
  expect(dureePause(25 * 60_000)).toBe('25 min')
  expect(dureePause(8.4 * 3600_000)).toBe('8 h 24')
  expect(dureePause(30 * 3600_000)).toBe('1 j 6 h')
})

test('minuteur : depuis quand une étape avance, en combien de temps elle s’est faite', async () => {
  let l = horodate([], [{ id: 'plan-1', nom: 'Lire', etat: 'encours' }, { id: 'plan-2', nom: 'Corriger', etat: 'attente' }], 1_000)
  expect(l[0]!.debut).toBe(1_000)
  // ce qui dure encore se compte à la minute (le bandeau se redessine chaque minute)
  expect(pastillesTaches(l, 125_000)[0]!.titre).toMatch(/^Lire — en cours depuis \d\d:\d\d \(2 min\)$/)
  expect(pastillesTaches(l, 125_000)[1]!.titre).toBe('Corriger — à faire')
  // la même étape renvoyée dans une nouvelle liste garde son heure de début
  l = horodate(l, [{ id: 'plan-1', nom: 'Lire', etat: 'faite' }, { id: 'plan-2', nom: 'Corriger', etat: 'encours' }], 61_000)
  expect(pastillesTaches(l, 61_000)[0]!.titre).toBe('Lire — faite en 1 min')
  expect(l[1]!.debut).toBe(61_000)
})

test('build : ce qui se construit, et le verdict de sa sortie', async () => {
  expect(estBuild('./gradlew assembleDebug')).toBe(true)
  expect(estBuild('.\\gradlew.bat :app:testDebugUnitTest --no-daemon')).toBe(true)
  expect(estBuild('flutter build apk --release')).toBe(true)
  expect(estBuild('./gradlew --stop')).toBe(false)
  expect(estBuild('git status')).toBe(false)
  expect(quoiBuild('./gradlew :app:assembleDebug --no-daemon')).toBe(':app:assembleDebug')
  expect(quoiBuild('flutter build apk --release')).toBe('flutter build apk')
  const echec = analyse('> Task :app:compileDebugKotlin FAILED\ne: file:///C:/proj/app/src/Main.kt:3:5 Unresolved reference: foo\n\nBUILD FAILED in 12s', false)
  expect(echec).toEqual({ etat: 'echec', detail: ':app:compileDebugKotlin — Unresolved reference: foo' })
  expect(analyse('BUILD SUCCESSFUL in 41s\n37 actionable tasks', false).etat).toBe('ok')
  expect(analyse('√ Built build\\app\\outputs\\flutter-apk\\app-release.apk (21.4MB)', false).etat).toBe('ok')
  expect(analyse('rien de clair', true).etat).toBe('echec')
  // une sortie qui ne tranche pas (tronquée par un | grep) : « terminé », ni vert ni rouge
  expect(analyse('rien de clair', false).etat).toBe('fini')
  // une séquence de couleur ou un caractère de contrôle ne passe pas dans le dessin
  expect(analyse('\u001b[31merror: classe\u0007 introuvable\u001b[0m\nBUILD FAILED', false).detail).toBe('classe introuvable')
  // seule la commande réellement lancée compte, pas un fichier gradlew qu'on manipule
  for (const pasUnBuild of ['git add gradlew gradlew.bat', 'chmod +x gradlew', 'cat release.ps1', 'git commit -m "fix gradlew"', './gradlew tasks --all', './gradlew -p app tasks']) {
    expect(estBuild(pasUnBuild)).toBe(false)
  }
  expect(estBuild('JAVA_HOME=/opt/jbr ./gradlew assembleDebug')).toBe(true)
  expect(estBuild("$env:JAVA_HOME = 'C:\\jbr'; & .\\gradlew.bat test")).toBe(true)
  expect(quoiBuild('export JAVA_HOME="/opt/jbr"; ./gradlew assembleDebug 2>&1 | tail -20')).toBe('assembleDebug')
  expect(quoiBuild('./gradlew -p app --tests MaClasse testDebugUnitTest')).toBe('testDebugUnitTest')
  expect(sortieFond('Command running in background with ID: b1. Output is being written to: C:\\tmp\\b1.output')).toBe('C:\\tmp\\b1.output')
})

test('sous-agents : leur pastille à la couleur du modèle, leur mission et leur durée', async () => {
  let l = ajouteAgent([], { id: 'a1', type: 'eclaireur', mission: 'fouille le projet', modele: 'claude-haiku-5-5' }, 0)
  l = ajouteAgent(l, { id: 'a2', type: 'relecteur', mission: 'relis le diff', modele: 'claude-sonnet-5-5' }, 0)
  l = finAgent(l, 'a1', undefined, 130_000)
  const p = pastillesAgents(l, 140_000)
  expect(p[0]).toEqual({ id: 'agent-a1', titre: 'Eclaireur · Haiku 5.5 — fouille le projet\nFini en 2 min 10 s', forme: 'faite', teinte: '#9CB86A' })
  expect(p[1]!.forme).toBe('encours')
  expect(p[1]!.teinte).toBe('#E9A27F')
  expect(nettoieAgents(l).map(a => a.id)).toEqual(['a2'])
  // arrêté sur une erreur ou un refus : il n'a pas « fini », sa pastille le dit
  const enErreur = pastillesAgents(finAgent(l, 'a2', causeDe('error'), 150_000), 150_000)[1]!
  expect(enErreur.forme).toBe('attente')
  expect(enErreur.titre).toContain('Arrêté sur une erreur')
  expect(causeDe('answer')).toBe(undefined)
  expect(causeDe('refusal')).toBe('refus')
})

test('relecture : arrondis, conso stable d’un tour à l’autre, limite atteinte, minuteur d’une étape renommée', async () => {
  expect([tokensCourts(9_999), tokensCourts(999_999), tokensCourts(1_000_000)]).toEqual(['10 k', '1 M', '1 M'])
  expect(euros(2_000 * 1.1253)).toBe('2 000 €')
  // l'ambre d'une conversation lourde ne s'éteint pas au début du tour suivant
  let c = ajouteReponse(debutTour(null, 1), 'claude-opus-5-5', { entree: 0, lu: 500_000, ecrit: 0, sortie: 10 }, true, 1.2)
  c = debutTour(finTour(c, 1.2), 1.2)
  expect(estLourde(c)).toBe(true)
  // le coût mesuré par le moteur après le tour fait foi
  expect(mesureCout(c, 1.5)?.tour?.dollars).toBeDefined()
  expect(millioniemes(mesureCout(c, 1.5)?.tour?.dollars)).toBe(millioniemes(0.3))
  // à 100 %, ce n'est plus une projection
  const fin = Date.UTC(2026, 9, 17, 15, 0)
  const pleine = jauges({ fiveHour: { percent: 100, resetsAt: new Date(fin).toISOString() }, sevenDay: null, contextPercent: null }, fin - 3600_000)[0]!
  expect(titreJauge(pleine, fin - 3600_000, ms => new Date(ms).toISOString().slice(11, 16))).toContain('Limite atteinte')
  // sans l'heure (une image générée hors session), pas de projection
  expect(titreJauge(pleine, undefined, ms => String(ms))).not.toContain('rythme')
  // une étape renommée en cours de route garde son heure de début
  let l = horodate([], [{ id: 'plan-1', nom: 'Lire', etat: 'encours' }], 1_000)
  l = horodate(l, [{ id: 'plan-1', nom: 'Lire le code', etat: 'encours' }], 5_000)
  expect(l[0]!.debut).toBe(1_000)
})

test('outils : ce que fait un appel, en quelques mots, sans ses secrets', async () => {
  expect(decrit({ tool: 'Read', file_path: 'C:/proj/app/src/Main.kt' })).toBe('Lecture · Main.kt')
  expect(decrit({ tool: 'Bash', command: './gradlew assembleDebug', description: 'Build debug' })).toBe('Bash · Build debug')
  expect(decrit({ tool: 'WebFetch', url: 'https://exemple.org/docs/page?x=1' })).toBe('Page web · exemple.org')
  expect(decrit({ tool: 'Agent', subagent_type: 'eclaireur', description: 'fouille le projet' })).toBe('Sous-agent eclaireur · fouille le projet')
  expect(decrit({ tool: 'mcp__github__create_issue' })).toBe('github · create_issue')
  // ce qui ressemble à un secret ne s'affiche pas, même au survol
  const curl = decrit({ tool: 'Bash', command: 'curl -H "Authorization: Bearer abc123def" "https://moi:motdepasse@exemple.org/api?token=zz9&x=1"' })
  for (const secret of ['abc123def', 'motdepasse', 'zz9']) expect(curl).not.toContain(secret)
  expect(decrit({ tool: 'WebFetch', url: 'https://moi:motdepasse@exemple.org/page' })).toBe('Page web · exemple.org')
  expect(decrit({ tool: 'Bash', command: 'git push --password=hunter2 origin' })).not.toContain('hunter2')
  // les formats courants relevés à la relecture : le secret ne reste pas visible
  const bash = (command: string) => decrit({ tool: 'Bash', command })
  const ps = (command: string) => decrit({ tool: 'PowerShell', command })
  const fuites: [string, string][] = [
    [bash('export GEMINI_API_KEY="AIzaSyD-exemple1234567890abcdef"'), 'AIzaSyD-exemple'],
    [ps("$env:GITHUB_TOKEN = 'ghp_exemple1234567890abcdef'"), 'ghp_exemple'],
    [bash(`curl -d '{"password":"hunter2"}' https://exemple.org`), 'hunter2'],
    [ps('Invoke-RestMethod -Headers @{Authorization="Bearer abc123def"} https://exemple.org'), 'abc123def'],
    [bash('curl -H "Authorization: abc123def" https://exemple.org'), 'abc123def'],
    [bash('git clone https://ghp_exemple1234567890@github.com/moi/depot'), 'ghp_exemple'],
    [bash('curl https://moi:p@ss@exemple.org/x'), 'ss@'],
    [bash('curl -u admin:s3cret https://exemple.org'), 's3cret'],
    [bash('curl "https://maps.exemple.org/api?key=AIzaSyD-exemple1234567890abcdef"'), 'AIzaSyD-exemple'],
    [bash('echo ghp_exemple1234567890abcdef | gh auth login --with-token'), 'ghp_exemple'],
    [bash('aws configure set aws_access_key_id AKIAexemple0123456'), 'exemple0123456'],
    [bash('SECRET_KEY=abc123def python manage.py runserver'), 'abc123def'],
    [bash('sqlcmd "Server=x;Uid=sa;Pwd=hunter2;Database=y"'), 'hunter2'],
  ]
  for (const [libelle, secret] of fuites) expect(libelle).not.toContain(secret)
  // … sans masquer ce qui n'en est pas
  for (const commande of ['git commit -m "fix refresh-token expiry"', 'git push -u origin main', 'git status', './gradlew assembleDebug', 'keytool -genkey -keystore release.jks']) {
    expect(bash(commande)).toBe(`Bash · ${commande}`)
  }
  expect(ps('$pwd = Get-Location')).toBe('PowerShell · $pwd = Get-Location')
  // l'hôte d'une page : sans identifiants, ni bout de mot de passe pris pour un port
  expect(decrit({ tool: 'WebFetch', url: 'https://moi:pa/ss@exemple.org/x' })).toBe('Page web · moi')
  expect(decrit({ tool: 'WebFetch', url: 'http://localhost:3000/x' })).toBe('Page web · localhost:3000')
  expect(decrit({ tool: 'WebFetch', url: 'https://www.npmjs.com/package/@scope/pkg' })).toBe('Page web · www.npmjs.com')
  // masqué avant d'être coupé : un secret à cheval sur la coupe ne fuit pas à moitié
  expect(decrit({ tool: 'Bash', command: `${'x'.repeat(90)} https://moi:motdepasse@exemple.org` })).not.toContain('motde')
  // le JAVA_HOME que le garde-fou ajoute n'est pas ce que Claude a demandé
  expect(decrit({ tool: 'Bash', command: 'export JAVA_HOME="C:/jbr"; ./gradlew assembleDebug' })).toBe('Bash · ./gradlew assembleDebug')
  // tenue de liste, question pour toi, plan à valider : pas d'onde
  for (const outil of ['TaskCreate', 'AskUserQuestion', 'ExitPlanMode', 'EnterPlanMode']) expect(estDiscret(outil)).toBe(true)
  expect(estDiscret('Bash')).toBe(false)
  // un libellé à rallonge est coupé à 120 caractères
  expect(Array.from(decrit({ tool: 'Agent', subagent_type: 'x'.repeat(60), description: 'y'.repeat(100) })).length).toBe(120)
})

test('sonar : un outil lancé par un sous-agent fait partir une onde, recalée sur son heure', async () => {
  let l = ajouteAgent([], { id: 'a1', type: 'eclaireur', mission: 'fouille', modele: 'claude-haiku-5-5' }, 0)
  l = pingAgent(l, 'a1', 1_000, 'Recherche · jauges')
  l = pingAgent(l, 'a1', 1_500, 'Lecture · jauges.ts')
  const p = pastillesAgents(l, 1_800)[0]!
  expect(p.ondes).toEqual([800, 300])
  expect(p.titre).toContain('2 outils lancés, le dernier : Lecture · jauges.ts')
  // arrêté sur une erreur : son dernier outil reste dit
  expect(pastillesAgents(finAgent(l, 'a1', 'erreur', 2_000), 2_000)[0]!.titre).toContain('Arrêté sur une erreur en 2 s\n2 outils lancés, le dernier : Lecture · jauges.ts')
  const { svg } = svgPastilles([[p]], true)
  expect(svg).toContain('animation-delay:-800ms;stroke:#9CB86A')
  expect(svg).toContain('animation-delay:-300ms')
  expect(svg).toContain('@keyframes onde')
  // une fois l'onde passée, plus rien à dessiner
  expect(svgPastilles([[pastillesAgents(l, 5_000)[0]!]], true).svg).not.toContain('class="onde"')
})

test('bandeau : chaque outil d’un sous-agent fait partir une onde de sa pastille', async ($, on) => {
  bandeauVide(on as never)
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'a1' }))
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: 'ok', stderr: '', interrupted: false } }))
  let ecritures = 0
  on('state.set', ($, e, next) => {
    if ((e as { key?: string }).key === 'agents') ecritures++
    return next(e)
  })
  await $.agent.spawn({ prompt: 'relis', subagentType: 'relecteur', description: 'relis le diff' } as never)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const source = async () => String((await ui.findAll({ type: 'Svg' })).find(s => String(s.props?.alt).startsWith('Sous-agents'))?.props?.source)
  expect(await source()).not.toContain('class="onde"')
  // un outil de la conversation principale : pas d'onde
  await $.tool.call({ tool: 'Bash', command: 'git status', description: 'État git' })
  expect(await source()).not.toContain('class="onde"')
  await $.tool.call({ tool: 'Bash', command: 'git diff', description: 'Diff', agentId: 'a1' } as never)
  expect(await source()).toContain('class="onde"')
  expect(await source()).toContain('1 outil lancé, le dernier : Bash · Diff')
  // un sous-agent pas encore vu n'a pas de pastille : son outil n'écrit rien
  // (le compteur, lui, a bien vu les écritures du sous-agent connu)
  expect(ecritures).toBeGreaterThan(0)
  const avant = ecritures
  await $.tool.call({ tool: 'Bash', command: 'ls', description: 'Liste', agentId: 'inconnu' } as never)
  expect(ecritures).toBe(avant)
  await ui.unmount()
})

test('bandeau : un build interrompu ou refusé ne passe pas au rouge', async ($, on) => {
  bandeauVide(on as never)
  let reponse: Record<string, unknown> = {
    result: { stdout: '> Task :app:compileDebugKotlin FAILED\n\nBUILD FAILED in 3s', stderr: '', interrupted: false },
  }
  on('tool.call', { tool: 'Bash' }, () => reponse as never)
  await $.tool.call({ tool: 'Bash', command: './gradlew assembleDebug' })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const alt = async () => String((await ui.find({ type: 'Svg' }))?.props?.alt ?? '')
  expect(await alt()).toContain('échoué')
  // refusé (pas lancé) : on garde le verdict du build d'avant
  reponse = { deny: 'refusé' }
  await $.tool.call({ tool: 'Bash', command: './gradlew assembleRelease' })
  expect(await alt()).toContain('Build assembleDebug — échoué')
  // interrompu en cours : ni réussi ni échoué
  reponse = { result: { stdout: '', stderr: '', interrupted: true } }
  await $.tool.call({ tool: 'Bash', command: './gradlew assembleRelease' })
  expect(await alt()).toContain('Build assembleRelease — interrompu')
  await ui.unmount()
})

test('bandeau : un build de fond n’est pas déclaré fini sans la liste du moteur, et un sous-agent fini avant d’être vu', async ($, on) => {
  bandeauVide(on as never)
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: '', stderr: '', interrupted: false, backgroundTaskId: 'b1' } }))
  on('classic.Stop', () => ({}))
  on('turn.complete', () => ({ text: '' }))
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'a7' }))
  await $.tool.call({ tool: 'Bash', command: './gradlew assembleRelease', run_in_background: true })
  await $.classic.Stop({ stop_hook_active: false } as never)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const alt = async () => String((await ui.find({ type: 'Svg' }))?.props?.alt ?? '')
  expect(await alt()).toContain('en cours depuis')
  // sa fin arrive avant que son départ ne soit enregistré : il apparaît fini, pas « en cours » pour toujours
  await $.turn.complete({ answer: 'fait', durationMs: 1, isAborted: false, turnId: 't2', reason: 'answer', agentId: 'a7' } as never)
  await $.agent.spawn({ prompt: 'relis', subagentType: 'relecteur', description: 'relis le diff' } as never)
  expect(await alt()).toContain('Relecteur (fini)')
  await ui.unmount()
})

test('bandeau : la conso du tour en direct, au tarif API, et l’alerte de conversation lourde', async ($, on) => {
  bandeauVide(on as never)
  let cout = 2
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 0, window: 1_000_000, percent: 0 }, rateLimits: [], cost: { usd: cout } } }))
  on('turn.start', () => ({ turnId: 't1' }))
  on('turn.complete', () => ({ text: '' }))
  // la réponse simulée rappelle le pas auquel elle répond
  on('turn.step', async function* ($: unknown, e: { turnId: string; index: number }) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn',
      usage: { model: 'claude-opus-5-5', input_tokens: 2_000, output_tokens: 3_000, cache_read_input_tokens: 500_000, cache_creation_input_tokens: 10_000 },
    }
  } as never)
  await $.turn.start({ turnId: 't1' } as never)
  cout = 2.5
  const pas = $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 2 } as never)
  for await (const _ of pas) void _
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const svg = await ui.find({ type: 'Svg' })
  expect(svg?.props?.isInteractive).toBe(true)
  expect(String(svg?.props?.alt)).toContain('Conso : tour 515 k · 0,44 €')
  const source = String(svg?.props?.source)
  expect(source).toContain('d’après /cost')
  expect(source).toContain('class="pc attention"')
  await ui.unmount()
  const term = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await term.find({ type: 'Text', text: /tour 515 k · 0,44 €/ })).toBeDefined()
  await term.unmount()
})

test('bandeau : les sous-agents en pastilles, puis effacés au message suivant', async ($, on) => {
  bandeauVide(on as never)
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: 'a1' }))
  on('turn.complete', () => ({ text: '' }))
  await $.agent.spawn({ prompt: 'fouille', subagentType: 'eclaireur', description: 'fouille le projet' } as never)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const svg = async () => await ui.find({ type: 'Svg' })
  expect(String((await svg())?.props?.alt)).toBe('Sous-agents : Eclaireur (en cours)')
  expect(String((await svg())?.props?.source)).toContain('--teinte:#9CB86A')
  await $.turn.complete({ answer: 'fait', durationMs: 1, isAborted: false, turnId: 't9', reason: 'answer', agentId: 'a1' } as never)
  expect(String((await svg())?.props?.alt)).toBe('Sous-agents : Eclaireur (fini)')
  expect(String((await svg())?.props?.source)).toContain('fill="#9CB86A"')
  await $.prompt.submit({ text: 'la suite' })
  expect(await svg()).toBeUndefined()
  await ui.unmount()
})

test('bandeau : un build qui échoue, en pastille rouge avec sa première erreur', async ($, on) => {
  bandeauVide(on as never)
  on('tool.call', { tool: 'Bash' }, () => ({
    result: { stdout: '> Task :app:compileDebugKotlin FAILED\ne: file:///C:/proj/Main.kt:3:5 Unresolved reference: foo\n\nBUILD FAILED in 12s', stderr: '', interrupted: false },
  }))
  await $.tool.call({ tool: 'Bash', command: './gradlew assembleDebug' })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const svg = await ui.find({ type: 'Svg' })
  expect(String(svg?.props?.alt)).toContain('Build assembleDebug — échoué')
  expect(String(svg?.props?.source)).toContain(':app:compileDebugKotlin — Unresolved reference: foo')
  expect(String(svg?.props?.source)).toContain('#ef5b5f')
  await ui.unmount()
})

test('bandeau : un build en tâche de fond, suivi jusqu’à sa fin', async ($, on) => {
  bandeauVide(on as never)
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: '', stderr: '', interrupted: false, backgroundTaskId: 'b1' } }))
  on('classic.Stop', () => ({}))
  await $.tool.call({ tool: 'Bash', command: './gradlew assembleRelease', run_in_background: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const alt = async () => String((await ui.find({ type: 'Svg' }))?.props?.alt ?? '')
  expect(await alt()).toContain('Build assembleRelease — en cours depuis')
  expect(await alt()).toContain('en tâche de fond')
  // toujours dans la liste du moteur : il tourne encore
  await $.classic.Stop({ stop_hook_active: false, background_tasks: [{ id: 'b1', type: 'shell', status: 'running', description: 'build' }] } as never)
  expect(await alt()).toContain('en cours depuis')
  // sorti de la liste : il est fini
  await $.classic.Stop({ stop_hook_active: false, background_tasks: [] } as never)
  expect(await alt()).toContain('Build assembleRelease — terminé')
  await ui.unmount()
})

test('rangement : 5 minutes après que tout est fini, les pastilles finies s’en vont', async () => {
  const M = 60_000
  const echec = { quoi: 'assembleDebug', debut: 0, fin: M, etat: 'echec' as const }
  // un tour en cours : rien ne se range
  expect(aRanger(20 * M, null, echec, [], [])).toBeNull()
  // fini depuis 4 min : trop tôt ; depuis 5 min : la croix rouge s'en va
  expect(aRanger(6 * M, 2 * M, echec, [], [])).toBeNull()
  expect(aRanger(7 * M, 2 * M, echec, [], [])).toEqual({ build: true, agents: false, taches: false })
  // un build ou un sous-agent qui tourne encore : rien n'est fini
  expect(aRanger(30 * M, 2 * M, { ...echec, etat: 'encours' }, [], [])).toBeNull()
  const agent = { id: 'a1', type: 'eclaireur', mission: 'fouille', modele: 'claude-haiku-5-5', debut: 0, etat: 'encours' as const }
  expect(aRanger(30 * M, 2 * M, echec, [agent], [])).toBeNull()
  // un sous-agent qui a fini après le tour : le délai part de sa fin
  const fini = { ...agent, etat: 'faite' as const, fin: 4 * M }
  expect(aRanger(8 * M, 2 * M, echec, [fini], [])).toBeNull()
  expect(aRanger(9 * M, 2 * M, echec, [fini], [])).toEqual({ build: true, agents: true, taches: false })
  // une liste faite s'en va aussi ; une liste qui t'attend encore reste, sans retenir le reste
  const faite = [{ id: 'plan-1', nom: 'Lire', etat: 'faite' as const, debut: 0, fin: M }]
  expect(aRanger(9 * M, 2 * M, null, [], faite)).toEqual({ build: false, agents: false, taches: true })
  const ouverte = [...faite, { id: 'plan-2', nom: 'Corriger', etat: 'attente' as const }]
  expect(aRanger(9 * M, 2 * M, null, [], ouverte)).toBeNull()
  expect(aRanger(9 * M, 2 * M, echec, [], ouverte)).toEqual({ build: true, agents: false, taches: false })
})

test('bandeau : 5 minutes après que tout est fini, la croix rouge d’un build échoué et la liste faite s’en vont', async ($, on) => {
  const horloge = bandeauVide(on as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  // l'ouverture de session enregistre /tel et /atelier, puis lance le minuteur d'une minute
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('turn.start', () => ({ turnId: 't1' }))
  on('turn.complete', () => ({ text: '' }))
  on('tool.call', { tool: 'Bash' }, () => ({
    result: { stdout: '> Task :app:compileDebugKotlin FAILED\n\nBUILD FAILED in 3s', stderr: '', interrupted: false },
  }))
  on('tool.call', { tool: 'mcp__ccd_turn__update_plan' }, () => ({ result: { ok: true } }))
  await $.session.start({ cwd: 'C:/vide', surface: 'desktop', isInteractive: true })
  const finTour = (turnId: string) => $.turn.complete({ answer: 'fait', durationMs: 1, isAborted: false, turnId, reason: 'answer' } as never)
  await $.turn.start({ turnId: 't1' } as never)
  await $.tool.call({ tool: 'Bash', command: './gradlew assembleDebug' })
  await $.tool.call({ tool: 'mcp__ccd_turn__update_plan', tool_use_id: 'plan', items: [{ content: 'Lire le code', status: 'completed' }], scope: 'first_task' } as never)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const pastilles = async () => String((await ui.findAll({ type: 'Svg' })).find(s => /Build|Tâches/.test(String(s.props?.alt)))?.props?.alt ?? '')
  expect(await pastilles()).toContain('Build assembleDebug — échoué')
  expect(await pastilles()).toContain('Tâches 1/1')
  // Claude travaille encore 10 min : elles restent
  await horloge.advance(10 * 60_000)
  expect(await pastilles()).toContain('échoué')
  await finTour('t1')
  // 4 min de pause, puis un tour de 10 min : rien ne se range pendant qu'il travaille
  await horloge.advance(4 * 60_000)
  await $.turn.start({ turnId: 't2' } as never)
  await horloge.advance(10 * 60_000)
  expect(await pastilles()).toContain('échoué')
  await finTour('t2')
  // 4 min après la fin du tour : encore là ; passé 5 min : parties
  await horloge.advance(4 * 60_000)
  expect(await pastilles()).toContain('Tâches 1/1')
  await horloge.advance(2 * 60_000)
  expect(await pastilles()).toBe('')
  await ui.unmount()
})

test('bandeau : une vieille croix rouge, d’avant le rechargement du mod, s’en va aussi', async ($, on) => {
  const horloge = bandeauVide(on as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: 'BUILD FAILED in 3s', stderr: '', interrupted: false } }))
  // un build échoué, puis le mod rechargé (session.start revient) sans tour depuis
  await $.tool.call({ tool: 'Bash', command: './gradlew assembleDebug' })
  await $.session.start({ cwd: 'C:/vide', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const build = async () => (await ui.findAll({ type: 'Svg' })).find(s => String(s.props?.alt).includes('Build assembleDebug'))
  await horloge.advance(4 * 60_000)
  expect(await build()).toBeDefined()
  await horloge.advance(2 * 60_000)
  expect(await build()).toBeUndefined()
  await ui.unmount()
})

test('bande partagée : chaque élément du bandeau à la place où il est dessiné', async () => {
  const M = 60_000
  const usage = {
    fiveHour: { percent: 42, resetsAt: new Date(4 * 3600_000).toISOString() },
    sevenDay: { percent: 10, resetsAt: new Date(6 * 24 * 3600_000).toISOString() },
    contextPercent: null,
  }
  const plan = planBandeau(
    {
      android: null,
      git: null,
      usage,
      taches: [
        { id: 'plan-1', nom: 'Lire', etat: 'faite', debut: 0, fin: M },
        { id: 'plan-2', nom: 'Corriger', etat: 'encours', debut: M },
      ],
      conso: null,
      build: { quoi: 'assembleDebug', debut: 0, fin: M, etat: 'echec' },
      agents: [{ id: 'a1', type: 'eclaireur', mission: 'fouille', modele: 'claude-haiku-5-5', debut: 0, etat: 'encours' }],
      busy: null,
    },
    2 * M,
  )
  const s = sceneDuBandeau(plan, quandDe(2 * M))
  expect(s.lignes).toEqual(['quotas', 'pastilles'])
  const ou = (id: string) => s.elements.find(x => x.id === id)
  // les jauges sur l'avant-dernière ligne, l'une après l'autre
  // 42 % au bout d'un cinquième de la fenêtre : le rythme la met à l'ambre
  // les places à l'échelle où l'app les montre (dessins posés à 17 px de haut pour 18 unités)
  const ech = (v: number) => +(v * ECHELLE).toFixed(1)
  const brutes = svgJauges(plan.jauges, quandDe(2 * M)).places
  expect(ou('jauge-5h')).toMatchObject({ genre: 'jauge', x: 0, ligne: 1, etat: 'attention', hauteur: HAUTEUR_DESSIN, largeur: ech(brutes[0]!.largeur) })
  expect(ou('jauge-7j')!.x).toBe(ech(brutes[0]!.largeur + 14))
  // les pastilles en bas : le build, un trait, les tâches, un trait, les sous-agents
  expect(ou('build')).toMatchObject({ genre: 'build', etat: 'echec', x: 0, largeur: 16.1, ligne: 0 })
  expect(ou('tache-plan-1')).toMatchObject({ genre: 'tache', etat: 'faite', x: 25.5 })
  expect(ou('tache-plan-2')).toMatchObject({ genre: 'tache', etat: 'encours', x: 41.6 })
  // ni le nom des étapes ni la mission des sous-agents ne quittent le bandeau
  expect('titre' in ou('tache-plan-2')!).toBe(false)
  // le dessin de chaque élément, à l'identique et sans infobulle, pour que Clawd le promène : rien du nom des étapes ni des missions
  const j5 = ou('jauge-5h')!.dessin!
  expect(j5).toContain(`viewBox="0 0 ${brutes[0]!.largeur} 18"`)
  // la jauge seule : son nom, sa barre ambre, son pourcentage, rien des autres
  expect(j5).toContain('>5 h<')
  expect(j5).toContain('fill="#f2b33d"')
  expect(j5).toContain('42 %')
  expect(j5).not.toContain('7 j')
  expect(ou('jauge-7j')!.dessin).toContain('>7 j<')
  expect(ou('tache-plan-1')!.dessin).toContain('viewBox="0 0 17 18"')
  expect(ou('build')!.dessin).toContain('#ef5b5f')
  for (const el of s.elements) expect(el.dessin ?? '').not.toMatch(/<title|Lire|Corriger|fouille|assembleDebug/)
  // la conso : son dessin seul, son texte
  const avecConso = planBandeau({ android: null, git: null, usage, taches: [], conso: ajouteReponse(debutTour(null, 1), 'claude-opus-5-5', { entree: 2_000, lu: 180_000, ecrit: 9_000, sortie: 6_000 }, true, 1.4), build: null, agents: [], busy: null }, 2 * M)
  const conso = sceneDuBandeau(avecConso, quandDe(2 * M)).elements.find(x => x.id === 'conso')!
  expect(conso.dessin).toMatch(/viewBox="0 0 [0-9]+ 18"/)
  expect(conso.dessin).toContain('tour 197 k')
  expect(conso.dessin).not.toContain('5 h')
  // l'orbe en cours (~24 Ko) : Clawd dessine la sienne
  expect(ou('tache-plan-2')!.dessin).toBeUndefined()
  expect(ou('agent-a1')!.dessin).toBeUndefined()
  expect(ou('agent-a1')).toMatchObject({ genre: 'agent', etat: 'encours', x: 67.1, teinte: '#9CB86A' })
  // ce que Clawd tient n'est plus dessiné, mais sa place reste : le suivant ne bouge pas
  const caches = new Set(['tache-plan-2'])
  const dessin = svgPastilles(plan.groupes, false, caches)
  expect(dessin.svg).not.toContain('Corriger')
  expect(dessin.places.find(x => x.id === 'agent-a1')!.x).toBe(71)
  const sansJauge = svgJauges(plan.jauges, quandDe(2 * M), { caches: new Set(['jauge-5h']) })
  expect(sansJauge.svg).not.toContain('>5 h<')
  expect(ech(sansJauge.places.find(x => x.id === 'jauge-7j')!.x)).toBe(ou('jauge-7j')!.x)
  // ce que Clawd écrit dans son état, nettoyé ; un emprunt échu ne cache plus rien (un Clawd planté ne bloque pas le bandeau)
  expect([...empruntsDe([{ id: 'build', jusqua: 10 }, { id: 'conso', jusqua: 4 }, 'tache-plan-1', null, { id: 3, jusqua: 10 }], 5)]).toEqual(['build'])
  expect([...empruntsDe('build', 0)]).toEqual([])
  // son numéro sur toute la bande : un SVG, une hauteur raisonnable, pas encore fini
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="64"/>'
  expect(grandeSceneDe({ svg, hauteur: 64, fin: 10 }, 5)).toEqual({ svg, hauteur: 64 })
  expect(grandeSceneDe({ svg, hauteur: 64, fin: 4 }, 5)).toBeNull()
  expect(grandeSceneDe({ svg: '<div/>', hauteur: 64, fin: 10 }, 5)).toBeNull()
  expect(grandeSceneDe({ svg, hauteur: 900, fin: 10 }, 5)).toBeNull()
  expect(grandeSceneDe({ svg: `<svg>${'x'.repeat(131_072)}</svg>`, hauteur: 64, fin: 10 }, 5)).toBeNull()
})

test('bandeau : la bande partagée est publiée, ce que Clawd tient n’est plus dessiné, et son numéro couvre la bande', async ($, on) => {
  const horloge = bandeauVide(on as never)
  on('tool.call', { tool: 'mcp__ccd_turn__update_plan' }, () => ({ result: { ok: true } }))
  let tenus: { id: string; jusqua: number }[] = []
  let numero: { svg: string; hauteur: number; fin: number } | null = null
  on('state.get', ($, e, next) =>
    e.plugin === 'clawd' && e.key === 'emprunts'
      ? { value: { value: tenus, version: 1 } }
      : e.plugin === 'clawd' && e.key === 'grandeScene'
        ? { value: { value: numero, version: 1 } }
        : next(e),
  )
  let publiee: unknown = null
  on('state.set', ($, e, next) => {
    if ((e as { key?: string }).key === 'scene') publiee = (e as { value?: unknown }).value
    return next(e)
  })
  await $.tool.call({
    tool: 'mcp__ccd_turn__update_plan',
    tool_use_id: 'plan',
    items: [
      { content: 'Lire le code', status: 'completed' },
      { content: 'Corriger le bug', status: 'in_progress' },
    ],
    scope: 'first_task',
  } as never)
  // la bande partagée dit où est chaque étape
  await horloge.settle()
  expect(publiee).toMatchObject({ lignes: ['pastilles'], elements: [{ id: 'tache-plan-1', x: 0, ligne: 0 }, { id: 'tache-plan-2', x: 16.1, etat: 'encours' }] })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const source = async () => String((await ui.find({ type: 'Svg' }))?.props?.source)
  expect(await source()).toContain('Corriger le bug')
  expect((await ui.find({ type: 'Svg' }))?.props).toMatchObject({ height: HAUTEUR_DESSIN, width: 32.1 })
  // Clawd prend l'étape en cours : atelier ne la dessine plus
  tenus = [{ id: 'tache-plan-2', jusqua: horloge.now() + 10_000 }]
  // et son numéro (son dessin) : posé par-dessus toute la bande, dans notre rangée
  numero = { svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="64"/>', hauteur: 64, fin: horloge.now() + 10_000 }
  const ui2 = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(String((await ui2.find({ type: 'Svg' }))?.props?.source)).not.toContain('Corriger le bug')
  expect(String((await ui2.find({ type: 'Svg' }))?.props?.source)).toContain('Lire le code')
  expect(String((await ui2.find({ type: 'Svg' }))?.props?.alt)).toContain('Clawd joue avec : tache-plan-2')
  const grande = (await ui2.find({ key: 'grande-scene' })) as { props?: Record<string, unknown>; children?: { props?: Record<string, unknown> }[] } | undefined
  expect(grande?.props).toMatchObject({ position: 'absolute', left: 0, right: 0, bottom: 0 })
  // à la largeur de la bande en px (120 cases), pour que le dessin la couvre à l'échelle 1
  expect(grande?.children?.[0]?.props).toMatchObject({ source: numero.svg, height: 64, width: 948 })
  await ui2.unmount()
  // passé l'échéance (un Clawd planté), tout revient : l'étape redessinée, plus de numéro
  await horloge.advance(11_000)
  const ui3 = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(String((await ui3.find({ type: 'Svg' }))?.props?.source)).toContain('Corriger le bug')
  expect(await ui3.find({ key: 'grande-scene' })).toBeUndefined()
  await ui.unmount()
  await ui3.unmount()
})

test('conseil : la demande jugée, la réponse de Haiku lue, et ce que le bandeau en dit', async () => {
  // une demande courte continue la précédente, une commande n'en est pas une
  expect(aJuger('oui vas-y')).toBe(false)
  expect(aJuger('/clawd montre cadre, et regarde bien partout')).toBe(false)
  expect(aJuger('  corrige le bug du minuteur dans taches.ts  ')).toBe(true)
  expect(familleDe('claude-opus-5-5[1m]')).toBe('opus')
  expect(familleDe('claude-mythos-5-1')).toBe('fable')
  expect(familleDe(null)).toBeNull()
  // le JSON, même entouré de texte ; la raison nettoyée et tenue courte
  expect(lisConseil('Voici : {"modele":" Sonnet ","effort":"MEDIUM","raison":"petite\\nretouche   locale"} voilà')).toEqual({ modele: 'sonnet', effort: 'medium', raison: 'petite retouche locale' })
  expect(lisConseil('{"modele":"opus","effort":"high","raison":"' + 'x'.repeat(200) + '"}')?.raison).toHaveLength(80)
  expect(lisConseil('{"modele":"opus","effort":"high"}')).toEqual({ modele: 'opus', effort: 'high', raison: '' })
  expect(lisConseil('{"modele":"gpt","effort":"medium"}')).toBeNull()
  expect(lisConseil('{"modele":"opus","effort":"ultra"}')).toBeNull()
  expect(lisConseil('{"modele":"opus","effort":"high"')).toBeNull()
  expect(lisConseil('pas de JSON')).toBeNull()
  // dans un bloc ```json, une accolade dans la raison, un modèle écrit en entier
  expect(lisConseil('```json\n{"modele":"sonnet","effort":"low","raison":"un {objet} à renommer"}\n```')).toEqual({ modele: 'sonnet', effort: 'low', raison: 'un {objet} à renommer' })
  expect(lisConseil('{"modele":"Opus 5.5","effort":"high"}')?.modele).toBe('opus')
  // ce qui vient de toi seulement : ni routine, ni autre session, ni plugin
  expect(['composer', 'bridge', 'plugin', 'scheduled-trigger', 'peer', 'sdk', 'channel'].map(kind => deToi({ kind }))).toEqual([true, true, false, false, false, false, false])
  expect(deToi(undefined)).toBe(false)
  // montré seulement quand ce n'est pas ce qui tourne
  const c = { modele: 'sonnet', effort: 'medium', raison: 'petite retouche' } as const
  expect(conseilAffiche(null, { modele: 'claude-opus-5-5', effort: 'high' })).toBeNull()
  expect(conseilAffiche(c, { modele: 'claude-sonnet-5-5', effort: 'medium' })).toBeNull()
  expect(conseilAffiche(c, { modele: 'claude-sonnet-5-5', effort: null })).toBeNull()
  expect(conseilAffiche(c, { modele: 'claude-sonnet-5-5', effort: 'high' })?.texte).toBe('💡 Sonnet · Moyen')
  // les efforts dits comme dans le sélecteur de l'app
  expect(conseilAffiche(c, { modele: 'claude-opus-5-5', effort: 'xhigh' })).toEqual({
    texte: '💡 Sonnet · Moyen',
    titre: 'Conseil pour la suite : Sonnet 5.5, effort Moyen (petite retouche)\nEn ce moment : Opus 5.5 · Extra',
  })
  expect(['low', 'medium', 'high', 'xhigh', 'max', 'autre'].map(nomEffort)).toEqual(['Faible', 'Moyen', 'Élevé', 'Extra', 'Max', 'autre'])
  expect(conseilAffiche({ ...c, raison: '' }, { modele: 'opus', effort: null })?.titre).toBe('Conseil pour la suite : Sonnet 5.5, effort Moyen\nEn ce moment : opus')
  // ce qui tourne est inconnu : la puce resterait là pour rien
  expect(conseilAffiche(c, { modele: null, effort: null })).toBeNull()
  expect(conseilAffiche(c, { modele: 'passerelle-maison', effort: 'high' })).toBeNull()
  // ce que Haiku sait du travail, et la demande coupée à 2000 caractères
  // une demande écrite après un long collage : son début et sa fin
  expect(coupe('a'.repeat(1500) + 'b'.repeat(1500))).toBe(`${'a'.repeat(1000)}\n[…]\n${'b'.repeat(1000)}`)
  // compté en caractères, sans couper un émoji en deux
  expect(coupe('😀'.repeat(1500))).toBe('😀'.repeat(1500))
  expect(coupe('😀'.repeat(2500))).toBe(`${'😀'.repeat(1000)}\n[…]\n${'😀'.repeat(1000)}`)
  expect(coupe('x'.repeat(50_000)).length).toBe(2000 + '\n[…]\n'.length)
  const p = promptConseil('é'.repeat(3000), { projet: 'Android', etapes: 2, buildRate: true, sousAgents: 1, quotaSerre: true })
  expect(p).toContain('Le quota est serré')
  expect(p).toContain('Contexte : projet Android ; plan en cours : 2 étape(s) ; dernier build raté ; sous-agents au travail : 1.')
  expect(p).toContain(`<demande>\n${'é'.repeat(1000)}\n[…]\n${'é'.repeat(1000)}\n</demande>`)
  expect(promptConseil('x', { projet: 'autre', etapes: 0, buildRate: false, sousAgents: 0, quotaSerre: false })).toContain('Le quota va bien')
})

test('bandeau : le conseil de modèle de Haiku, montré quand il diffère de ce qui tourne', async ($, on) => {
  const horloge = bandeauVide(on as never)
  const demandes: { model: string; prompt: string; effort?: unknown; maxTokens?: number }[] = []
  let reponse = 'Voici : {"modele":"sonnet","effort":"medium","raison":"petite retouche locale"}'
  let repond = true
  let attente: Promise<void> | null = null
  on('model.complete', async ($, e) => {
    demandes.push({ model: e.model, prompt: e.prompt, effort: e.effort, maxTokens: e.maxTokens })
    const texte = reponse
    if (attente) await attente
    return {
      value: repond
        ? { isAnswered: true, text: texte, usage: { input_tokens: 300, output_tokens: 30, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } }
        : { isAnswered: false, reason: 'api-error', status: 529, error: 'overloaded' },
    } as never
  })
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.end', ($, e) => ({ sessionId: e.sessionId }))
  on('turn.step', async function* ($: unknown, e: { turnId: string; index: number }) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' }
  } as never)
  const conseilMontre = async (surface: 'desktop' | 'terminal') => {
    const ui = await $.ui.mount({ ...BAND, surface })
    const r =
      surface === 'desktop'
        ? { alt: String((await ui.find({ type: 'Svg' }))?.props?.alt ?? ''), source: String((await ui.find({ type: 'Svg' }))?.props?.source ?? '') }
        : { alt: (await ui.find({ type: 'Text', text: /💡/ }))?.text ?? '', source: '' }
    await ui.unmount()
    return r
  }

  const toi = { kind: 'composer' } as const
  const demande = (text: string) => $.prompt.submit({ text, origin: toi } as never)
  // une demande courte continue la précédente, un message du moteur n'est pas une demande : pas de Haiku
  await demande('oui vas-y')
  await $.prompt.submit({ text: 'rappel du moteur, assez long pour être jugé', isMeta: true, origin: toi } as never)
  // ni ce qui ne vient pas de toi : une routine, un plugin (le bouton « Commit + push »)
  await $.prompt.submit({ text: 'la routine de chaque matin, assez longue', origin: { kind: 'scheduled-trigger' } } as never)
  await $.prompt.submit({ text: 'Pousse les commits en attente et vérifie que le push est bien passé.', origin: { kind: 'plugin', plugin: 'atelier', asUser: true } } as never)
  await horloge.settle()
  expect(demandes).toHaveLength(0)

  // une vraie demande : Haiku la lit, avec le contexte, sans retarder le tour
  await demande('renomme le bouton Masquer en Cacher dans register.tsx')
  await horloge.settle()
  expect(demandes).toHaveLength(1)
  expect(demandes[0]).toMatchObject({ model: 'haiku', effort: 'low', maxTokens: 150 })
  expect(demandes[0].prompt).toContain('<demande>\nrenomme le bouton Masquer en Cacher dans register.tsx\n</demande>')
  expect(demandes[0].prompt).toContain('projet autre ; plan en cours : 0 étape(s) ; dernier build sans échec ; sous-agents au travail : 0.')
  // la session tourne en Opus : le conseil diffère, il s'affiche, sa raison au survol
  const d = await conseilMontre('desktop')
  expect(d.alt).toBe('Conseil : 💡 Sonnet · Moyen')
  expect(d.source).toContain('Conseil pour la suite : Sonnet 5.5, effort Moyen (petite retouche locale)\nEn ce moment : Opus 5.5</title>')
  expect(d.source).toContain('class="cs"')
  expect((await conseilMontre('terminal')).alt).toBe('💡 Sonnet · Moyen')

  // une requête part en Opus high : noté, montré au survol
  for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', effort: 'high', messageCount: 2 } as never)) void _
  expect((await conseilMontre('desktop')).source).toContain('En ce moment : Opus 5.5 · Élevé')
  // tu passes en Sonnet medium : c'est ce qu'il faut, plus rien à dire (et sans rien d'autre, plus de bandeau)
  for await (const _ of $.turn.step({ turnId: 't1', index: 1, model: 'claude-sonnet-5-5', effort: 'medium', messageCount: 4 } as never)) void _
  expect((await conseilMontre('desktop')).alt).toBe('')
  expect((await conseilMontre('terminal')).alt).toBe('')
  // la requête d'un sous-agent ne dit pas ce qui tourne
  for await (const _ of $.turn.step({ turnId: 't1', index: 2, model: 'claude-haiku-5-5', effort: 'low', messageCount: 2, agentId: 'a1' } as never)) void _
  expect((await conseilMontre('desktop')).alt).toBe('')

  // seule la dernière demande compte : la réponse en retard d'une demande d'avant n'écrase pas la nouvelle
  let libere = () => {}
  reponse = '{"modele":"haiku","effort":"low","raison":"simple question"}'
  attente = new Promise<void>(r => (libere = r))
  await demande('c’est quoi la différence entre merge et rebase ?')
  await horloge.settle()
  attente = null
  reponse = '{"modele":"opus","effort":"xhigh","raison":"débogage sur plusieurs fichiers"}'
  await demande('le build plante au hasard, trouve pourquoi et corrige')
  await horloge.settle()
  libere()
  await horloge.settle()
  expect(demandes).toHaveLength(3)
  expect((await conseilMontre('desktop')).alt).toBe('Conseil : 💡 Opus · Extra')

  // Haiku sans réponse : plus de conseil (celui d'avant parlait de la demande d'avant)
  repond = false
  await demande('ajoute un test pour le conseil de modèle')
  await horloge.settle()
  expect((await conseilMontre('desktop')).alt).toBe('')

  // /clear : le conseil de l'autre conversation s'en va, même encore en route
  repond = true
  await demande('refais toute l’architecture du mod en trois couches')
  await horloge.settle()
  expect((await conseilMontre('terminal')).alt).toBe('💡 Opus · Extra')
  attente = new Promise<void>(r => (libere = r))
  await demande('refais toute l’architecture du mod en trois couches, encore')
  await horloge.settle()
  await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } })
  libere()
  await horloge.settle()
  expect((await conseilMontre('terminal')).alt).toBe('')
  // bandeau masqué : personne ne verrait le conseil, Haiku n'est pas appelé
  const avant = demandes.length
  await $.command.run({ command: 'atelier', args: '', origin: { kind: 'composer' } })
  await demande('encore une demande assez longue pour être jugée')
  await horloge.settle()
  expect(demandes).toHaveLength(avant)
})

test('bande partagée : la puce du conseil de modèle aussi, avec son dessin, cachée quand Clawd la tient', () => {
  const M = 60_000
  const conseil = { texte: '💡 Sonnet · Moyen', titre: 'Conseil pour la suite : Sonnet 5.5, effort Moyen' }
  const plan = planBandeau({ android: null, git: null, usage: null, taches: [], conso: null, build: null, agents: [], busy: null, conseil }, 2 * M)
  const el = sceneDuBandeau(plan, quandDe(2 * M)).elements.find(x => x.id === 'conseil')!
  expect(el).toMatchObject({ genre: 'conseil', x: 0, ligne: 0, hauteur: HAUTEUR_DESSIN })
  expect(el.dessin).toContain('>💡 Sonnet · Moyen<')
  expect(el.dessin).not.toContain('<title')
  // Clawd la tient : sa place reste, vide
  expect(svgJauges([], quandDe(2 * M), { conseil, caches: new Set(['conseil']) }).svg).not.toContain('Sonnet')
})
