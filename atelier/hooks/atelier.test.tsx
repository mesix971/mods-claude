// Tests du mod atelier : adb, git et le disque sont simulés avec de vraies
// sorties réelles d'adb et de git, anonymisées (app, appareil, utilisateur).
import { expect, mock, test } from 'claude-code/testing'

import { jauges } from './jauges'

const LOCALAPPDATA = 'C:/Users/dev/AppData/Local'
const ADB = `${LOCALAPPDATA}/Android/Sdk/platform-tools/adb.exe`
const CWD = 'C:/proj'
// 01/10/2026 01:52:28 heure de Paris (CEST, UTC+2)
const APK_MTIME = Date.UTC(2026, 8, 30, 23, 52, 28)

const GRADLE = `
android {
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
}`

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
    // quotas en jauges : dessin sur desktop (son texte alternatif dit tout), blocs ▰▱ en terminal
    if (surface === 'desktop') {
      const alt = String((await ui.find({ type: 'Svg' }))?.props?.alt ?? '')
      expect(alt).toContain('5 h 82 % → 23:10 (attention)')
      expect(alt).toContain('7 j 81 % → ven. 07:30 (attention)')
      expect(alt).toContain('contexte 45 %')
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

test('↻ relit les quotas, et une fenêtre déjà réinitialisée repart à 0 %', async ($, on) => {
  // 08:00 à Paris
  mock.clock(on as never, { now: Date.UTC(2026, 9, 7, 6, 0) })
  mock.env(on as never, {})
  on('session.cwd', () => ({ value: 'C:/vide' }))
  on('fs.exists', () => ({ value: false }))
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('ui.toast', () => ({ value: undefined }))
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
  // la dernière réponse de l'API dit 0 % partout : le bouton ↻ va la relire
  api = [
    { kind: 'five_hour', percentUsed: 0, resetsAt: '2026-10-07T11:00:00Z' },
    { kind: 'seven_day', percentUsed: 0, resetsAt: '2026-10-14T06:00:00Z' },
  ]
  await ui.press({ key: 'refresh' })
  expect(await alt()).toContain('7 j 0 %')
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

test('commit non demandé : confirmation ; demandé : direct', async ($, on) => {
  const { ran, asked } = shellStubs(on as never, { answer: 'Refuser' })
  await $.prompt.submit({ text: 'corrige le bug du minuteur' })
  await $.tool.call({ tool: 'Bash', command: 'git commit -am "fix: minuteur"' })
  expect(asked.length).toBe(1)
  expect(ran.length).toBe(0)
  await $.prompt.submit({ text: 'ok commit et pousse' })
  await $.tool.call({ tool: 'Bash', command: 'git push' })
  expect(ran).toEqual(['git push'])
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
