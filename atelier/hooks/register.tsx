// atelier : le copilote de l'atelier Android.
//
// 1. Bandeau au-dessus du prompt : version déclarée / dernier APK / version
//    installée sur le tel (+ bouton Installer), état git (+ bouton Commit +
//    push), jauges des quotas 5 h / 7 j et du contexte.
// 2. Garde-fous sur Bash et PowerShell : JBR d'Android Studio cassé corrigé,
//    JAVA_HOME ajouté à gradlew, commandes destructrices soumises à ton accord,
//    secrets bloqués avant commit/push, commit non demandé confirmé, pas
//    d'attente bloquante, pas de `bash` WSL depuis PowerShell.
//    adb et le JBR sont trouvés tout seuls (Windows, macOS, Linux).
// 3. Rappels : réponse en anglais détectée, version bumpée sans CHANGELOG,
//    seuils de quota franchis.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ToolCallResult } from 'claude-code'

import type { AtelierAndroid, AtelierGit, AtelierUsage } from '../types'
import { COULEURS, jauges, resumeJauges, svgJauges, texteJauges } from './jauges'

type $ = EngineInterface

const android = atom({ plugin: 'atelier', key: 'android' } as const, null)
const git = atom({ plugin: 'atelier', key: 'git' } as const, null)
const usage = atom({ plugin: 'atelier', key: 'usage' } as const, null)
/** Avance d'un cran par minute : le bandeau se redessine même sans nouvelle donnée */
const minute = atom({ plugin: 'atelier', key: 'minute' } as const, 0)
const busy = atom({ plugin: 'atelier', key: 'busy' } as const, null)
const isHidden = atom({ plugin: 'atelier', key: 'isHidden' } as const, false)

// ---------------------------------------------------------------- utilitaires

const slash = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '')

async function run($: $, argv: string[], timeoutMs = 10_000) {
  try {
    return await $.process.run(argv, { timeoutMs })
  } catch {
    return null
  }
}

async function readText($: $, path: string) {
  try {
    return await $.fs.read(path)
  } catch {
    return null
  }
}

async function firstExisting($: $, paths: readonly (string | null | undefined)[]) {
  for (const p of paths) {
    if (p && (await $.fs.exists(p).catch(() => false))) return p
  }
  return null
}

// ------------------------------------------ outils Android, trouvés tout seuls

/** adb : SDK déclaré, puis emplacements standard (Windows, macOS, Linux), sinon le PATH. */
async function trouverAdb($: $): Promise<string> {
  const sdks = [await $.env.get('ANDROID_HOME'), await $.env.get('ANDROID_SDK_ROOT')].filter((v): v is string => !!v).map(slash)
  const local = await $.env.get('LOCALAPPDATA')
  const maison = (await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE'))
  const trouve = await firstExisting($, [
    ...sdks.flatMap(s => [`${s}/platform-tools/adb.exe`, `${s}/platform-tools/adb`]),
    local && `${slash(local)}/Android/Sdk/platform-tools/adb.exe`,
    maison && `${slash(maison)}/Library/Android/sdk/platform-tools/adb`,
    maison && `${slash(maison)}/Android/Sdk/platform-tools/adb`,
  ])
  return trouve ?? 'adb'
}

/**
 * Le JBR d'Android Studio qui marche (son dossier contient lib/jvm.cfg). Sous
 * Windows on regarde tous les dossiers d'Android Studio : selon l'installation
 * il s'appelle « Android Studio », « Android Studio1 », « …Preview »…
 */
async function trouverJbr($: $): Promise<string | null> {
  const candidats: string[] = []
  for (const racine of ['C:/Program Files/Android', 'C:/Program Files (x86)/Android']) {
    try {
      for (const e of await $.fs.list(racine)) if (e.kind === 'dir') candidats.push(`${racine}/${e.name}/jbr`)
    } catch {
      // pas d'Android Studio ici
    }
  }
  const maison = (await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE'))
  candidats.push('/Applications/Android Studio.app/Contents/jbr/Contents/Home', '/opt/android-studio/jbr')
  if (maison) candidats.push(`${slash(maison)}/android-studio/jbr`)
  const cfg = await firstExisting($, candidats.map(c => `${c}/lib/jvm.cfg`))
  return cfg ? cfg.replace(/\/lib\/jvm\.cfg$/, '') : null
}

const hhmm = (ms: number) => {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']

// ----------------------------------------------------------------- Android

type Projet = { gradle: string; apkDir: string; pubspec: string | null }

async function detectProjet($: $, cwd: string): Promise<Projet | null> {
  const natif = await firstExisting($, [`${cwd}/app/build.gradle.kts`, `${cwd}/app/build.gradle`])
  if (natif) return { gradle: natif, apkDir: `${cwd}/app/build/outputs/apk`, pubspec: null }

  const flutter = await firstExisting($, [
    `${cwd}/android/app/build.gradle.kts`,
    `${cwd}/android/app/build.gradle`,
  ])
  if (flutter && (await $.fs.exists(`${cwd}/pubspec.yaml`))) {
    return { gradle: flutter, apkDir: `${cwd}/build/app/outputs/flutter-apk`, pubspec: `${cwd}/pubspec.yaml` }
  }
  return null
}

async function findApks($: $, dir: string, depth = 0): Promise<{ path: string; name: string; mtimeMs: number }[]> {
  if (depth > 3) return []
  let entries
  try {
    entries = await $.fs.list(dir)
  } catch {
    return []
  }
  const out: { path: string; name: string; mtimeMs: number }[] = []
  for (const en of entries) {
    if (en.kind === 'dir' && en.name !== 'androidTest') {
      out.push(...(await findApks($, `${dir}/${en.name}`, depth + 1)))
    } else if (en.kind === 'file' && en.name.endsWith('.apk') && !en.name.includes('androidTest')) {
      out.push({ path: `${dir}/${en.name}`, name: en.name, mtimeMs: en.mtimeMs })
    }
  }
  return out
}

/** Horloge du tel → epoch : `date` du tel donne l'heure locale et l'epoch. */
async function phoneClockOffset($: $, adb: string, serial: string) {
  const r = await run($, [adb, '-s', serial, 'shell', 'date', '+%s_%Y-%m-%dT%H:%M:%S'])
  const m = r?.stdout.trim().match(/^(\d+)_(\S+)$/)
  if (!m) return null
  // décalage = heure locale lue comme UTC − vrai epoch
  return Date.parse(`${m[2]}Z`) - Number(m[1]) * 1000
}

async function refreshAndroid($: $, cwd: string): Promise<AtelierAndroid | null> {
  const projet = await detectProjet($, cwd)
  if (!projet) return null

  const gradle = (await readText($, projet.gradle)) ?? ''
  const appId = gradle.match(/applicationId\s*=?\s*["']([^"']+)["']/)?.[1] ?? null
  let versionName = gradle.match(/versionName\s*=?\s*["']([^"']+)["']/)?.[1] ?? null
  let versionCode = Number(gradle.match(/versionCode\s*=?\s*(\d+)/)?.[1] ?? NaN)
  if (projet.pubspec) {
    const pub = (await readText($, projet.pubspec)) ?? ''
    const m = pub.match(/^version:\s*([\w.\-]+)(?:\+(\d+))?/m)
    if (m) {
      versionName = m[1] ?? versionName
      versionCode = Number(m[2] ?? NaN)
    }
  }
  const debugSuffix = gradle.match(/debug\s*\{[^}]*applicationIdSuffix\s*=?\s*["']([^"']+)["']/)?.[1] ?? ''

  const apks = (await findApks($, projet.apkDir)).sort((a, b) => b.mtimeMs - a.mtimeMs)
  const top = apks[0]
  const apk = top
    ? { ...top, version: top.name.match(/-(\d[\w.\-]*?)\.apk$/)?.[1] ?? null }
    : null

  const info: AtelierAndroid = {
    appId,
    versionName,
    versionCode: Number.isNaN(versionCode) ? null : versionCode,
    apk,
    device: null,
    installed: null,
    isPhoneStale: false,
  }

  const adb = await trouverAdb($)
  const devices = await run($, [adb, 'devices', '-l'], 8000)
  const line = devices?.stdout.split(/\r?\n/).find(l => /\sdevice(\s|$)/.test(l) && !l.startsWith('List'))
  if (!line) return info
  const serial = line.split(/\s+/)[0] ?? ''
  info.device = { serial, model: line.match(/model:(\S+)/)?.[1]?.replace(/_/g, ' ') ?? serial }
  if (!appId) return info

  const pkgs = await run($, [adb, '-s', serial, 'shell', 'pm', 'list', 'packages', appId])
  const listed = (pkgs?.stdout ?? '')
    .split(/\r?\n/)
    .filter(l => l.startsWith('package:'))
    .map(l => l.slice('package:'.length).trim())
  const isDebugApk = apk ? /[\\/]debug[\\/]|debug/i.test(apk.path) : false
  const pkg =
    isDebugApk && debugSuffix && listed.includes(appId + debugSuffix)
      ? appId + debugSuffix
      : listed.includes(appId)
        ? appId
        : listed.find(p => p.startsWith(appId))
  if (!pkg) {
    info.isPhoneStale = apk !== null
    return info
  }

  const dump = await run($, [adb, '-s', serial, 'shell', 'dumpsys', 'package', pkg])
  const out = dump?.stdout ?? ''
  const vName = out.match(/versionName=(\S+)/)?.[1] ?? '?'
  const vCode = Number(out.match(/versionCode=(\d+)/)?.[1] ?? 0)
  const updated = out.match(/lastUpdateTime=(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d)/)
  let updatedMs: number | null = null
  if (updated) {
    const offset = await phoneClockOffset($, adb, serial)
    if (offset !== null) updatedMs = Date.parse(`${updated[1]}T${updated[2]}Z`) - offset
  }
  info.installed = { pkg, versionName: vName, versionCode: vCode, updatedMs }

  if (apk) {
    const otherVersion = apk.version !== null && apk.version !== vName
    // 2 min de marge : l'install suit le build de peu
    const newerApk = updatedMs !== null && apk.mtimeMs > updatedMs + 120_000
    info.isPhoneStale = otherVersion || newerApk
  }
  return info
}

// --------------------------------------------------------------------- git

const VERSION_FILES = [
  'app/build.gradle.kts',
  'app/build.gradle',
  'pubspec.yaml',
  'lib/constantes.dart',
  'manifest.json',
  'version.py',
  'package.json',
]

async function refreshGit($: $, cwd: string): Promise<AtelierGit | null> {
  const st = await run($, ['git', '-C', cwd, 'status', '--porcelain=v1', '-b'])
  if (!st || st.exitCode !== 0) return null
  const lines = st.stdout.split(/\r?\n/).filter(Boolean)
  const head = lines[0] ?? ''
  const files = lines.slice(1).map(l => l.slice(3).replace(/^"|"$/g, ''))
  const branch = head.replace(/^## (No commits yet on )?/, '').split('...')[0]?.trim() ?? '?'
  const remote = await run($, ['git', '-C', cwd, 'remote'])

  const warnings: string[] = []
  const touched = files.filter(f => VERSION_FILES.includes(f))
  if (touched.length > 0) {
    const diff = await run($, ['git', '-C', cwd, 'diff', 'HEAD', '-U0', '--', ...touched])
    const bumped = (diff?.stdout ?? '')
      .split(/\r?\n/)
      .some(l => /^\+(?!\+)/.test(l) && /versionName|versionCode|^\+version:|"version"\s*:|appVersion|__version__|VERSION\s*=/.test(l))
    if (bumped && !files.some(f => /(^|\/)CHANGELOG\.md$/i.test(f))) {
      warnings.push('version bumpée mais CHANGELOG.md pas touché')
    }
    if (
      bumped &&
      touched.includes('pubspec.yaml') !== touched.includes('lib/constantes.dart') &&
      (await $.fs.exists(`${cwd}/lib/constantes.dart`))
    ) {
      warnings.push('pubspec.yaml et appVersion (lib/constantes.dart) pas bumpés ensemble')
    }
  }

  return {
    branch,
    changed: files.length,
    ahead: Number(head.match(/ahead (\d+)/)?.[1] ?? 0),
    hasUpstream: head.includes('...'),
    hasRemote: (remote?.stdout.trim() ?? '') !== '',
    warnings,
  }
}

// ----------------------------------------------------------------- refresh

/** Les quotas et le contexte, tels que la dernière réponse de l'API les a donnés. */
function usageDepuis(
  rateLimits: readonly { kind: string; percentUsed: number; resetsAt?: string }[],
  contextPercent: number | null,
): AtelierUsage {
  const pick = (kind: string) => {
    const w = rateLimits.find(r => r.kind === kind)
    return w ? { percent: w.percentUsed, resetsAt: w.resetsAt } : null
  }
  return { fiveHour: pick('five_hour'), sevenDay: pick('seven_day'), contextPercent }
}

/** Relit les quotas à la demande (gratuit) : bouton ↻, chaque minute, ouverture de session. */
async function rafraichirUsage($: $) {
  try {
    const u = await $.session.usage()
    if (u.rateLimits.length === 0 && u.context.percent === undefined) return
    await update($, usage, () => usageDepuis(u.rateLimits, u.context.percent ?? null))
  } catch {
    // pas encore de réponse de l'API dans cette session : rien à afficher
  }
}

let refreshing: Promise<void> | null = null

function refresh($: $) {
  // un seul rafraîchissement à la fois : les suivants attendent le même
  refreshing ??= (async () => {
    await rafraichirUsage($)
    try {
      const cwd = slash(await $.session.cwd())
      const [a, g] = await Promise.all([refreshAndroid($, cwd), refreshGit($, cwd)])
      await update($, android, () => a)
      await update($, git, () => g)
    } catch {
      // module rechargé ou session fermée en plein rafraîchissement : on laisse tomber
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

async function installApk($: $) {
  const a = await read($, android)
  if (!a?.apk) return 'Pas d’APK construit dans ce projet.'
  if (!a.device) return 'Aucun téléphone branché (adb devices vide).'
  await update($, busy, () => `Installation de ${a.apk!.name}…`)
  try {
    const r = await run($, [await trouverAdb($), '-s', a.device.serial, 'install', '-r', a.apk.path], 180_000)
    const out = `${r?.stdout ?? ''}\n${r?.stderr ?? ''}`
    if (r && /Success/.test(out)) {
      await refresh($)
      return `✅ ${a.apk.name} installé sur ${a.device.model}`
    }
    if (/INSTALL_FAILED_UPDATE_INCOMPATIBLE/.test(out)) {
      // désinstaller effacerait les données de l'app : jamais sans toi
      return '❌ Signature différente (debug ↔ release). Il faudrait désinstaller l’app, ce qui EFFACE ses données : à toi de décider.'
    }
    if (/INSTALL_FAILED_VERSION_DOWNGRADE/.test(out)) {
      return '❌ Version plus ancienne que celle du tel (downgrade refusé).'
    }
    return `❌ Échec : ${out.match(/Failure \[[^\]]+\]/)?.[0] ?? (out.trim().split(/\r?\n/).pop() ?? 'adb muet')}`
  } finally {
    await update($, busy, () => null)
  }
}

async function launchApp($: $) {
  const a = await read($, android)
  if (!a?.device || !a.installed) return
  await run($, [
    await trouverAdb($), '-s', a.device.serial, 'shell', 'monkey', '-p', a.installed.pkg,
    '-c', 'android.intent.category.LAUNCHER', '1',
  ])
}

// ------------------------------------------------------------ garde-fous

const DESTRUCTIF: [RegExp, string][] = [
  [/\bpm\s+clear\b/, 'efface toutes les données de l’app sur le tel'],
  [/\b(adb\b.*\buninstall|pm\s+uninstall)\b/, 'désinstalle une app (données perdues)'],
  [/\bconnected(AndroidTest|Check)\b/, 'les tests instrumentés peuvent vider les données de l’app installée'],
  [/\bgit\s+push\b.*(\s--force\b|\s-f\b|\s--force-with-lease\b)/, 'push forcé : réécrit l’historique distant'],
  [/\bgit\s+reset\s+--hard\b/, 'jette les modifications non commitées'],
  [/\bgit\s+clean\s+-\w*f/, 'supprime les fichiers non suivis'],
  [/\bgit\s+branch\s+-D\b/, 'supprime une branche non fusionnée'],
  [/\bgit\s+checkout\s+(--\s+)?\.(\s|$)|\bgit\s+restore\s+\.(\s|$)/, 'annule toutes les modifications en cours'],
  [/\bClear-RecycleBin\b|\bFormat-Volume\b|\bformat\s+[a-z]:/i, 'suppression définitive'],
  [/\badb\b.*\bshell\b.*\brm\s+-r/, 'supprime des fichiers sur le tel'],
]

const SECRET = /(^|\/)(local\.properties|google-services\.json|key\.properties|\.env(\.(?!example$|sample$)[^/]+)?)$|\.(jks|keystore)$/i

async function secretsAboutToLeave($: $, command: string) {
  const cwd = slash(await $.session.cwd())
  const lists: string[] = []
  const add = async (argv: string[]) => {
    const r = await run($, ['git', '-C', cwd, ...argv])
    if (r?.exitCode === 0) lists.push(...r.stdout.split(/\r?\n/).filter(Boolean))
  }
  if (/\bgit\s+push\b/.test(command)) {
    await add(['ls-files'])
  }
  if (/\bgit\s+commit\b/.test(command)) {
    await add(['diff', '--cached', '--name-only'])
    // `git add -A && git commit`, `commit -a` : ce qui n'est pas encore indexé part aussi
    if (/\bgit\s+add\s+(-A|--all|\.)|\bcommit\s+(-\w*a|--all)\b/.test(command)) {
      await add(['ls-files', '--others', '--modified', '--exclude-standard'])
    }
  }
  return [...new Set(lists.filter(f => SECRET.test(f)))]
}

async function confirm($: $, question: string) {
  try {
    return (await $.ui.ask(question, ['Autoriser', 'Refuser'])) === 'Autoriser'
  } catch {
    return false // fenêtre fermée, ou pas d'humain (-p) : on refuse
  }
}

let lastPrompt = ''
let jbrToastShown = false

const DEMANDE_GIT = /commit|push|pouss|envoie|\b(oui|ok|go|vas[- ]y|valide)\b/i

async function guard(
  $: $,
  tool: 'Bash' | 'PowerShell',
  command: string,
  isBackground: boolean,
): Promise<{ deny: string; command?: undefined } | { command: string; deny?: undefined }> {
  let cmd = command

  // Un JBR d'Android Studio cassé dans la commande (dossier sans lib/jvm.cfg,
  // vu après certaines mises à jour) → on met celui qui marche. Les chemins
  // avec espaces ne sont pris qu'entre guillemets, pour ne jamais avaler un
  // morceau de la commande.
  const chemins = [
    ...[...cmd.matchAll(/["']((?:[A-Za-z]:)?[\\/][^"'\n]*?[\\/]jbr)(?=[\\/"'])/g)].map(m => m[1]!),
    ...[...cmd.matchAll(/(?:^|[\s=])((?:[A-Za-z]:)?[\\/][^\s"';&|]*[\\/]jbr)(?=[\\/\s;&|]|$)/g)].map(m => m[1]!),
  ].filter(c => /android[ -]?studio/i.test(c))
  const jbr = chemins.length > 0 || /gradlew/.test(cmd) ? await trouverJbr($) : null
  if (jbr) {
    for (const c of new Set(chemins)) {
      if (slash(c) === jbr || (await $.fs.exists(`${slash(c)}/lib/jvm.cfg`))) continue
      cmd = cmd.split(c).join(c.includes('\\') ? jbr.replace(/\//g, '\\') : jbr)
      if (!jbrToastShown) {
        $.ui.toast(`atelier : JBR introuvable remplacé par ${jbr}`)
        jbrToastShown = true
      }
    }
  }

  // gradlew sans JAVA_HOME valable : on lui donne le JBR d'Android Studio
  if (jbr && /gradlew/.test(cmd) && !/JAVA_HOME/.test(cmd)) {
    const javaHome = await $.env.get('JAVA_HOME')
    if (!javaHome || !(await $.fs.exists(`${slash(javaHome)}/lib/jvm.cfg`))) {
      cmd =
        tool === 'Bash'
          ? `export JAVA_HOME="${jbr}"; ${cmd}`
          : `$env:JAVA_HOME = '${jbr.replace(/\//g, '\\')}'; ${cmd}`
    }
  }

  if (tool === 'PowerShell') {
    if (/(^|[;|&\s])(bash|wsl)(\.exe)?\s+(-c|-lc|\S+\.sh)\b/.test(cmd)) {
      return { deny: '`bash` lancé depuis PowerShell ouvre WSL sur ce PC : utilise directement l’outil Bash (Git Bash).' }
    }
    const sleep = cmd.match(/Start-Sleep\s+(?:-(s|Seconds|ms|Milliseconds)\s+)?(\d+)/i)
    if (sleep && !isBackground) {
      const secs = /^m/i.test(sleep[1] ?? '') ? Number(sleep[2]) / 1000 : Number(sleep[2])
      if (secs >= 20) {
        return {
          deny: `Attente bloquante de ${Math.round(secs)} s refusée : lance la tâche avec run_in_background (ou Monitor) et laisse la notification te réveiller.`,
        }
      }
    }
  }

  for (const [re, why] of DESTRUCTIF) {
    if (re.test(cmd)) {
      const ok = await confirm($, `⚠️ Commande destructrice (${why}) :\n${cmd.slice(0, 300)}\nAutoriser ?`)
      if (!ok) return { deny: `Refusé par l’utilisateur via le garde-fou atelier (${why}). Ne réessaie pas sans son accord explicite.` }
      break
    }
  }

  if (/\bgit\s+(commit|push)\b/.test(cmd)) {
    const leaks = await secretsAboutToLeave($, cmd)
    if (leaks.length > 0) {
      const ok = await confirm($, `🔑 Fichiers sensibles sur le point de partir dans git : ${leaks.join(', ')}. Autoriser quand même ?`)
      if (!ok) {
        return {
          deny: `Secrets détectés (${leaks.join(', ')}) : ajoute-les au .gitignore et retire-les de l’index (git rm --cached) avant de committer/pousser.`,
        }
      }
    } else if (!DEMANDE_GIT.test(lastPrompt)) {
      const ok = await confirm($, `Claude veut faire un \`git ${cmd.match(/\bgit\s+(commit|push)/)?.[1]}\` sans que tu l’aies demandé. Autoriser ?`)
      if (!ok) return { deny: 'L’utilisateur n’a pas demandé de commit/push : propose-le au lieu de le faire.' }
    }
  }

  return { command: cmd }
}

const TOUCHE_ETAT = /gradlew|\badb\b|flutter|\bgit\b|release\.ps1|build\.gradle|pubspec/i
const BUILD_APK = /assemble\w*|flutter\s+build\s+apk|release\.ps1|installDebug/i

async function shell(
  $: $,
  tool: 'Bash' | 'PowerShell',
  command: string,
  isBackground: boolean,
  go: (command: string) => Promise<ToolCallResult>,
): Promise<ToolCallResult> {
  const verdict = await guard($, tool, command, isBackground)
  if (verdict.deny !== undefined) return { deny: verdict.deny }
  const ran = await go(verdict.command)
  if (TOUCHE_ETAT.test(verdict.command)) {
    void refresh($)
      .then(async () => {
        const a = await read($, android)
        if (BUILD_APK.test(verdict.command) && !ran.isError && a?.device && a.isPhoneStale && a.apk) {
          $.ui.toast(`📦 ${a.apk.name} prêt — « Installer sur le tel » dans le bandeau, ou /tel`, { timeoutMs: 8000 })
        }
      })
      .catch(() => {})
  }
  return ran
}

// -------------------------------------------------------------- français

const FR = /\b(le|la|les|des|une|est|pas|que|qui|pour|dans|sur|avec|cette|sont|tu|je|fait|mais|aussi|être|c'est|j'ai|ton|ta|tes)\b/gi
const EN = /\b(the|is|are|was|this|that|with|you|and|not|have|will|it's|i'm|can|should|would|which|there|let me|now)\b/gi

function isEnglish(answer: string) {
  const prose = answer
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/\S+[\\/]\S+/g, ' ')
  const fr = prose.match(FR)?.length ?? 0
  const en = prose.match(EN)?.length ?? 0
  return en >= 8 && en > fr * 2
}

let rappelFrancais = false
let dernieresAlertes = ''
const seuilsVus = new Set<string>()

// ------------------------------------------------------------------ hooks

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'tel', description: 'Installe le dernier APK du projet sur le téléphone branché' })
    await $.command.register({ name: 'atelier', description: 'Affiche/masque le bandeau atelier et le rafraîchit' })
    const ran = await next(e)
    void refresh($)
    // chaque minute : quotas relus, et le bandeau redessiné (une fenêtre qui
    // vient de se réinitialiser repasse à 0 %, le trait du temps avance)
    $.clock.every(60_000, () => {
      void rafraichirUsage($)
        .then(() => update($, minute, n => n + 1))
        .catch(() => {})
    })
    return ran
  })

  on('command.run', { command: 'tel' }, async $ => {
    await refresh($)
    const msg = await installApk($)
    $.ui.toast(msg)
    return { text: msg }
  })

  on('command.run', { command: 'atelier' }, async $ => {
    const hidden = await update($, isHidden, h => !h)
    void refresh($)
    const manifest = await readText($, `${$.plugin.root}/.claude-plugin/plugin.json`)
    const version = manifest?.match(/"version"\s*:\s*"([^"]+)"/)?.[1] ?? '?'
    return {
      text: `${hidden ? 'Bandeau atelier masqué (/atelier pour le ré-afficher).' : 'Bandeau atelier affiché.'} — atelier v${version}`,
    }
  })

  on('prompt.submit', async ($, e, next) => {
    lastPrompt = e.text
    if (!rappelFrancais) return next(e)
    rappelFrancais = false
    return next({
      ...e,
      context: [
        ...(e.context ?? []),
        'Rappel (mod atelier) : ta dernière réponse était en anglais. Réponds en français, y compris les messages de progression (cf. CLAUDE.md).',
      ],
    })
  })

  on('tool.call', { tool: 'Bash' }, ($, e, next) =>
    shell($, 'Bash', e.command, e.run_in_background === true, command => next({ ...e, command })),
  )
  on('tool.call', { tool: 'PowerShell' }, ($, e, next) =>
    shell($, 'PowerShell', e.command, e.run_in_background === true, command => next({ ...e, command })),
  )

  on('turn.complete', async ($, e, next) => {
    const ran = await next(e)
    if (e.agentId === undefined) {
      if (!e.isAborted && isEnglish(e.answer)) {
        rappelFrancais = true
        $.ui.toast('atelier : réponse en anglais détectée, rappel envoyé au prochain message')
      }
      void refresh($)
        .then(async () => {
          // un toast seulement quand l'alerte change, pas à chaque tour
          const now = ((await read($, git))?.warnings ?? []).join('|')
          if (now !== dernieresAlertes) {
            dernieresAlertes = now
            for (const w of now ? now.split('|') : []) $.ui.toast(`⚠️ ${w}`, { timeoutMs: 8000 })
          }
        })
        .catch(() => {})
    }
    return ran
  })

  on('session.measure', async ($, e, next) => {
    const u = usageDepuis(e.rateLimits, e.context.percent ?? null)
    await update($, usage, () => u)

    for (const [label, w] of [['5 h', u.fiveHour], ['7 j', u.sevenDay]] as const) {
      if (!w) continue
      for (const seuil of [80, 95]) {
        const id = `${label}:${seuil}:${w.resetsAt ?? ''}`
        if (w.percent >= seuil && !seuilsVus.has(id)) {
          seuilsVus.add(id)
          const reset = w.resetsAt ? ` (reset ${hhmm(Date.parse(w.resetsAt))})` : ''
          $.ui.toast(`⏳ Quota ${label} à ${Math.round(w.percent)} %${reset}`, { timeoutMs: 10_000 })
        }
      }
    }
    return next(e)
  })

  // ------------------------------------------------------------ bandeau

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isHidden))) return next(e)
    const a = await read($, android)
    const g = await read($, git)
    const u = await read($, usage)
    await read($, minute) // redessin chaque minute
    const enCours = await read($, busy)
    if (!a && !g && !u) return next(e)
    // on compose au lieu de remplacer : ce que dessinent les autres mods
    // (clawd) se place à droite de nos lignes, posé sur le bord du bas
    const dessous = await next(e)

    const { Box, Text, Button } = $.ui.resolve(e)

    // quotas et contexte en jauges : un dessin sur desktop, des blocs ▰▱ ailleurs
    const maintenant = await $.clock.now()
    const lj = u ? jauges(u, maintenant) : []
    // l'heure d'un reset, avec le jour quand il est loin (fenêtre de 7 j)
    const quand = (ms: number) => (ms - maintenant > 20 * 3600_000 ? `${JOURS[new Date(ms).getDay()]} ` : '') + hhmm(ms)
    let quotas: JSX.Element | null = null
    if (lj.length > 0 && e.surface === 'desktop') {
      const { Svg } = $.ui.resolve(e)
      const dessin = svgJauges(lj, quand)
      quotas = <Svg source={dessin.svg} alt={resumeJauges(lj, quand)} width={dessin.largeur} height={18} />
    } else if (lj.length > 0) {
      quotas = (
        <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
          {texteJauges(lj, quand).map(j => (
            <Text color={j.niveau === 'ok' ? undefined : COULEURS[j.niveau]} dimColor={j.niveau === 'ok'}>
              {j.texte}
            </Text>
          ))}
        </Box>
      )
    }

    return (
      <Box flexDirection="row" alignItems="flex-end">
        <Box flexDirection="column" flexGrow={1}>
          {a && (
            <Box flexDirection="row" flexWrap="wrap">
              <Text bold>{`📱 ${a.versionName ?? '?'}${a.versionCode !== null ? ` (${a.versionCode})` : ''}`}</Text>
              <Text dimColor>
                {a.apk
                  ? `  · APK ${a.apk.version ?? a.apk.name} ${hhmm(a.apk.mtimeMs)}`
                  : '  · pas d’APK construit'}
              </Text>
              {a.device ? (
                a.installed ? (
                  <Text color={a.isPhoneStale ? 'yellow' : 'green'}>
                    {`  · tel ${a.installed.versionName}${a.installed.updatedMs ? ` ${hhmm(a.installed.updatedMs)}` : ''} `}
                    {a.isPhoneStale ? '⚠ pas à jour ' : '✓ '}
                  </Text>
                ) : (
                  <Text color="yellow">{`  · pas installée sur ${a.device.model} `}</Text>
                )
              ) : (
                <Text dimColor>  · tel non branché </Text>
              )}
              {a.device && a.apk && !enCours && (
                <Button
                  key="install"
                  label="Installer sur le tel"
                  hotkey="i"
                  variant={a.isPhoneStale ? 'primary' : 'secondary'}
                  dimColor={!a.isPhoneStale}
                  onPress={async () => $.ui.toast(await installApk($), { timeoutMs: 8000 })}
                />
              )}
              {a.device && a.installed && !enCours && (
                <Button key="launch" label="Lancer" hotkey="l" dimColor onPress={() => launchApp($)} />
              )}
            </Box>
          )}
          {g && (
            <Box flexDirection="row" flexWrap="wrap">
              <Text>🌿 {g.branch}</Text>
              <Text dimColor={g.changed === 0}>{`  · ${g.changed} modif${g.changed > 1 ? 's' : ''}`}</Text>
              {g.hasRemote && (
                <Text color={g.ahead > 0 || !g.hasUpstream ? 'yellow' : undefined} dimColor={g.ahead === 0 && g.hasUpstream}>
                  {!g.hasUpstream
                    ? '  · branche jamais poussée '
                    : g.ahead > 0
                      ? `  · ${g.ahead} commit${g.ahead > 1 ? 's' : ''} non poussé${g.ahead > 1 ? 's' : ''} `
                      : '  · à jour avec GitHub '}
                </Text>
              )}
              {g.warnings.map(w => (
                <Text color="yellow">{`  · ⚠ ${w}`}</Text>
              ))}
              {(g.changed > 0 || g.ahead > 0) && !e.props.isWorking && (
                <Button
                  key="commit"
                  label={g.changed > 0 ? 'Commit + push' : 'Push'}
                  hotkey="c"
                  dimColor
                  onPress={() =>
                    $.prompt.submit({
                      text:
                        g.changed > 0
                          ? 'Commit (message conventionnel en français) et pousse les changements en cours, puis vérifie que le push est bien passé.'
                          : 'Pousse les commits en attente et vérifie que le push est bien passé.',
                      asUser: true,
                    })
                  }
                />
              )}
            </Box>
          )}
          {quotas && (
            <Box flexDirection="row" flexWrap="wrap" alignItems="center">
              {quotas}
              <Text> </Text>
              <Button key="refresh" label="↻" plain dimColor onPress={() => refresh($)} />
              <Button key="hide" label="Masquer" role="dismiss" dimColor onPress={() => update($, isHidden, () => true)} />
            </Box>
          )}
          {enCours && <Text color="cyan">⏳ {enCours}</Text>}
        </Box>
        {dessous}
      </Box>
    )
  })
}
