// atelier : le copilote de l'atelier Android.
//
// 1. Bandeau au-dessus du prompt : version déclarée / dernier APK / version
//    installée sur le tel (+ bouton Installer), état git (+ bouton Commit +
//    push), jauges des quotas 5 h / 7 j et du contexte, et dessous la liste de
//    tâches de Claude en pastilles (son nom au survol, cochée en vert une fois
//    faite).
// 2. Garde-fous sur Bash et PowerShell : JBR d'Android Studio cassé corrigé,
//    JAVA_HOME ajouté à gradlew, commandes destructrices soumises à ton accord,
//    secrets bloqués avant commit/push, push non demandé confirmé, pas
//    d'attente bloquante, pas de `bash` WSL depuis PowerShell.
//    adb et le JBR sont trouvés tout seuls (Windows, macOS, Linux).
// 3. Rappels : réponse en anglais détectée, version bumpée sans CHANGELOG,
//    seuils de quota franchis.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ToolCallResult } from 'claude-code'

import type { AtelierAgent, AtelierAndroid, AtelierBuild, AtelierConso, AtelierGit, AtelierTache, AtelierUsage } from '../types'
import { ajouteAgent, causeDe, couleurModele, finAgent, nettoieAgents, pingAgent, resumeAgents } from './agents'
import { analyse, estBuild, pastilleBuild, quoiBuild, sortieFond } from './build'
import { aJuger, conseilAffiche, deToi, lisConseil, promptConseil } from './conseil'
import { ajouteReponse, debutTour, finTour, mesureCout, tokensDe } from './conso'
import { COULEURS, jauges, resumeJauges, svgJauges, texteJauges } from './jauges'
import { decrit, estDiscret } from './outils'
import { svgPastilles } from './pastilles'
import { aRanger } from './rangement'
import { CELLULE, ECHELLE, HAUTEUR_DESSIN, empruntsDe, grandeSceneDe, planBandeau, quandDe, sceneDuBandeau } from './scene'
import { aChanger, commandeSuite, texteGachis } from './suite'
import { ajouteTache, depuisTaskList, depuisTodos, horodate, interrompue, majTache, planFini, resumeTaches, suitPlan, texteTaches, toutFait } from './taches'

type $ = EngineInterface

const android = atom({ plugin: 'atelier', key: 'android' } as const, null)
const git = atom({ plugin: 'atelier', key: 'git' } as const, null)
const usage = atom({ plugin: 'atelier', key: 'usage' } as const, null)
const taches = atom({ plugin: 'atelier', key: 'taches' } as const, [])
const conso = atom({ plugin: 'atelier', key: 'conso' } as const, null)
const build = atom({ plugin: 'atelier', key: 'build' } as const, null)
const agents = atom({ plugin: 'atelier', key: 'agents' } as const, [])
const finDuTour = atom({ plugin: 'atelier', key: 'finDuTour' } as const, null)
const scene = atom({ plugin: 'atelier', key: 'scene' } as const, null)
/** Ce que Clawd tient en ce moment : son état à lui, qu'atelier lit seulement */
const empruntsClawd = atom({ plugin: 'clawd', key: 'emprunts' } as const, [])
/** Le numéro que Clawd joue sur toute la bande (son dessin) : atelier le pose par-dessus ses lignes */
const grandeSceneClawd = atom({ plugin: 'clawd', key: 'grandeScene' } as const, null)
const conseil = atom({ plugin: 'atelier', key: 'conseil' } as const, null)
const reglage = atom({ plugin: 'atelier', key: 'reglage' } as const, null)
const SANS_REGLAGE = { modele: null, effort: null }
/** Avance d'un cran par minute : le bandeau se redessine même sans nouvelle donnée */
const minute = atom({ plugin: 'atelier', key: 'minute' } as const, 0)
const busy = atom({ plugin: 'atelier', key: 'busy' } as const, null)
const isHidden = atom({ plugin: 'atelier', key: 'isHidden' } as const, false)
const clignote = atom({ plugin: 'atelier', key: 'clignote' } as const, false)

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

/**
 * Le script Gradle sans ses commentaires : un exemple en commentaire n'est pas
 * la version. Les chaînes sont recopiées telles quelles, sinon le `/*` d'une
 * glob comme `include("lib/*.so")` ouvrirait un faux commentaire qui avalerait
 * la suite du script.
 */
function sansCommentaires(t: string): string {
  let out = ''
  let i = 0
  while (i < t.length) {
    const c = t[i]!
    if (c === '"' || c === "'") {
      // une chaîne, jusqu'à son guillemet (ou la fin de la ligne si elle n'en a pas)
      let j = i + 1
      while (j < t.length && t[j] !== c && t[j] !== '\n') j += t[j] === '\\' ? 2 : 1
      out += t.slice(i, j + 1)
      i = j + 1
    } else if (c === '/' && t[i + 1] === '/') {
      while (i < t.length && t[i] !== '\n') i++
    } else if (c === '/' && t[i + 1] === '*') {
      const fin = t.indexOf('*/', i + 2)
      i = fin < 0 ? t.length : fin + 2
    } else {
      out += c
      i++
    }
  }
  return out
}

/** Une valeur écrite en dur, pas un gabarit Kotlin comme `"$major.$minor.$patch"` */
const enDur = (v: string | undefined) => (v && !v.includes('$') ? v : null)

/**
 * Version calculée par le script (`versionName = maVariable`) : on la lit dans
 * un fichier de propriétés du projet (version.properties, gradle.properties),
 * en `versionName=…` ou en `versionMajor` / `versionMinor` / `versionPatch`.
 */
async function versionDesProprietes($: $, dossiers: readonly string[]) {
  for (const d of dossiers) {
    for (const f of ['version.properties', 'gradle.properties']) {
      const t = await readText($, `${d}/${f}`)
      if (!t) continue
      const cle = (re: RegExp) => t.match(re)?.[1]?.trim()
      const nom = enDur(cle(/^\s*versionName\s*[=:]\s*(.+)$/im)?.replace(/^["']|["']$/g, ''))
      const code = Number(cle(/^\s*versionCode\s*[=:]\s*(\d+)/im) ?? NaN)
      const [maj, min, pat] = ['major', 'minor', 'patch'].map(k => cle(new RegExp(`^\\s*(?:version)?[._-]?${k}\\s*[=:]\\s*(\\d+)`, 'im')))
      const versionName = nom ?? (maj !== undefined && min !== undefined && pat !== undefined ? `${maj}.${min}.${pat}` : null)
      if (versionName) return { versionName, versionCode: Number.isNaN(code) ? null : code }
    }
  }
  return null
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

/**
 * Met la liste de tâches à jour (avec l'heure des débuts et des fins) sans
 * jamais gêner l'outil : une pastille ratée ne casse pas l'appel.
 */
async function majTaches($: $, f: (l: readonly AtelierTache[]) => AtelierTache[]) {
  try {
    const maintenant = await $.clock.now()
    await update($, taches, l => horodate(l, f(l), maintenant))
    void publieScene($)
  } catch {
    // module rechargé en plein appel : la liste se recalera au suivant
  }
}

/** De même pour la conso, le build et les sous-agents */
async function majConso($: $, f: (c: AtelierConso | null) => AtelierConso | null) {
  try {
    await update($, conso, f)
    void publieScene($)
  } catch {
    // idem
  }
}
async function majBuild($: $, f: (b: AtelierBuild | null) => AtelierBuild | null) {
  try {
    await update($, build, f)
    void publieScene($)
  } catch {
    // idem
  }
}
async function majAgents($: $, f: (l: readonly AtelierAgent[]) => AtelierAgent[]) {
  try {
    await update($, agents, f)
    void publieScene($)
  } catch {
    // idem
  }
}

async function noteFinDuTour($: $, t: number | null) {
  try {
    await update($, finDuTour, () => t)
  } catch {
    // idem
  }
}

/**
 * Le conseil de modèle pour une demande : Haiku la lit, avec le contexte du
 * travail (projet, plan, build, sous-agents, quotas), et dit quel modèle et
 * quel effort suffisent. Quelques centaines de tokens de Haiku par demande ;
 * seul le dernier demandé compte.
 */
let dernierConseil = 0
async function conseille($: $, texte: string) {
  const n = ++dernierConseil
  try {
    // avant la première requête, le modèle de la session (l'effort viendra avec elle)
    if (!(await read($, reglage))) {
      const m = await $.session.model().catch(() => null)
      await update($, reglage, r => r ?? { modele: m, effort: null })
    }
    const maintenant = await $.clock.now()
    const u = await read($, usage)
    const contexte = {
      projet: (await read($, android)) ? 'Android' : 'autre',
      etapes: (await read($, taches)).filter(t => t.etat !== 'faite').length,
      buildRate: (await read($, build))?.etat === 'echec',
      sousAgents: (await read($, agents)).filter(a => a.etat === 'encours').length,
      quotaSerre: u ? jauges(u, maintenant).some(j => j.nom !== 'ctx' && j.niveau !== 'ok') : false,
    }
    const r = await $.model.complete({ model: 'haiku', prompt: promptConseil(texte, contexte), effort: 'low', maxTokens: 150, timeoutMs: 20_000 })
    if (n !== dernierConseil) return
    // sans réponse lisible, plus de conseil : celui d'avant parlait de la demande d'avant
    const c = r.isAnswered ? lisConseil(r.text) : null
    await update($, conseil, () => c)
    void publieScene($)
  } catch {
    // pas de conseil cette fois (ni celui de la demande d'avant)
    if (n === dernierConseil) {
      await update($, conseil, () => null).catch(() => {})
      void publieScene($)
    }
  }
}

/**
 * La bande partagée, telle que le bandeau la dessine sur desktop (null quand
 * il ne dessine rien) : écrite seulement quand elle change. Un dessin ne peut
 * pas écrire, d'où cet appel après chaque écriture qui le change, et chaque
 * minute ; des appels rapprochés n'en font qu'un.
 */
let sceneEcrite: string | null = null
let publication: Promise<void> | null = null
let aRepublier = false
function publieScene($: $): Promise<void> {
  if (publication) {
    aRepublier = true
    return publication
  }
  publication = (async () => {
    try {
      do {
        aRepublier = false
        await publieUneFois($)
      } while (aRepublier)
    } finally {
      publication = null
    }
  })()
  return publication
}
async function publieUneFois($: $) {
  try {
    const maintenant = await $.clock.now()
    const plan = (await read($, isHidden))
      ? null
      : planBandeau(
          {
            android: await read($, android),
            git: await read($, git),
            usage: await read($, usage),
            taches: await read($, taches),
            conso: await read($, conso),
            build: await read($, build),
            agents: await read($, agents),
            busy: await read($, busy),
            conseil: conseilAffiche(await read($, conseil), (await read($, reglage)) ?? SANS_REGLAGE),
          },
          maintenant,
        )
    // bande vide ou masquée : une bande sans élément (pas null), pour dire qu'atelier est là et pose
    // lui-même le numéro de Clawd sur toute la largeur (null : pas d'atelier, Clawd le pose seul)
    const s = plan && plan.lignes.length > 0 ? sceneDuBandeau(plan, quandDe(maintenant)) : { lignes: [], elements: [] }
    const texte = JSON.stringify(s)
    if (texte === sceneEcrite) return
    await update($, scene, () => s)
    sceneEcrite = texte
  } catch {
    // la bande se recalera au prochain changement
  }
}

/** 5 minutes après que tout est fini, les pastilles finies s'en vont (appelé chaque minute) */
async function rangeLesFinis($: $) {
  try {
    const maintenant = await $.clock.now()
    const r = aRanger(maintenant, await read($, finDuTour), await read($, build), await read($, agents), await read($, taches))
    if (!r) return
    // ce qui a recommencé entre-temps reste
    if (r.build) await majBuild($, b => (b?.etat === 'encours' ? b : null))
    if (r.agents) await majAgents($, l => l.filter(a => a.etat === 'encours'))
    if (r.taches) await majTaches($, l => (toutFait(l) ? [] : [...l]))
  } catch {
    // le rangement attendra la minute suivante
  }
}

/** Ce que la session a coûté jusqu'ici au tarif de l'API, d'après /cost, ou null si le moteur ne le tient pas */
async function coutSession($: $): Promise<number | null> {
  try {
    const c = (await $.session.usage()).cost?.usd
    return typeof c === 'number' && Number.isFinite(c) ? c : null
  } catch {
    return null
  }
}

/** Les sous-agents dont la fin est arrivée avant que leur départ ne soit enregistré */
const finisAvantNaissance = new Map<string, { cause: AtelierAgent['cause']; fin: number }>()
/** Au-delà, les plus anciennes s'oublient (un départ refusé plus haut n'arrive jamais) */
const MAX_FINIS_AVANT_NAISSANCE = 20

/** La date de dernière écriture d'un fichier (la fin d'un build de fond), ou null */
async function dateDe($: $, chemin: string): Promise<number | null> {
  const p = slash(chemin)
  const i = p.lastIndexOf('/')
  if (i < 0) return null
  try {
    return (await $.fs.list(p.slice(0, i))).find(x => x.name === p.slice(i + 1))?.mtimeMs ?? null
  } catch {
    return null
  }
}

/** L'heure, ou null quand l'horloge manque (un test qui ne la simule pas) */
async function maintenantOuRien($: $): Promise<number | null> {
  try {
    return await $.clock.now()
  } catch {
    return null
  }
}

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

  const gradle = sansCommentaires((await readText($, projet.gradle)) ?? '')
  const appId = gradle.match(/applicationId\s*=?\s*["']([^"']+)["']/)?.[1] ?? null
  let versionName = [...gradle.matchAll(/versionName\s*=?\s*["']([^"']+)["']/g)].map(m => enDur(m[1])).find(v => v) ?? null
  let versionCode = Number(gradle.match(/versionCode\s*=?\s*(\d+)/)?.[1] ?? NaN)
  if (projet.pubspec) {
    const pub = (await readText($, projet.pubspec)) ?? ''
    const m = pub.match(/^version:\s*([\w.\-]+)(?:\+(\d+))?/m)
    if (m) {
      versionName = m[1] ?? versionName
      versionCode = Number(m[2] ?? NaN)
    }
  }
  if (!versionName && !projet.pubspec) {
    // calculée par le script : on la lit dans ses propriétés
    const v = await versionDesProprietes($, [cwd, `${cwd}/app`])
    if (v) {
      versionName = v.versionName
      if (Number.isNaN(versionCode) && v.versionCode !== null) versionCode = v.versionCode
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
  'version.properties',
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
      .some(l => /^\+(?!\+)/.test(l) && (/versionName|versionCode|^\+version:|"version"\s*:|appVersion|__version__|VERSION\s*=/.test(l) || /version[._-]?(major|minor|patch)\s*[=:]/i.test(l)))
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
  contexte?: { tokens?: number; window?: number },
): AtelierUsage {
  const pick = (kind: string) => {
    const w = rateLimits.find(r => r.kind === kind)
    return w ? { percent: w.percentUsed, resetsAt: w.resetsAt } : null
  }
  return {
    fiveHour: pick('five_hour'),
    sevenDay: pick('seven_day'),
    contextPercent,
    ...(typeof contexte?.tokens === 'number' ? { contextTokens: contexte.tokens } : {}),
    ...(typeof contexte?.window === 'number' ? { contextWindow: contexte.window } : {}),
  }
}

/** Relit les quotas à la demande (gratuit) : bouton ↻, chaque minute, ouverture de session. */
async function rafraichirUsage($: $) {
  try {
    const u = await $.session.usage()
    if (u.rateLimits.length === 0 && u.context.percent === undefined) return
    await update($, usage, () => usageDepuis(u.rateLimits, u.context.percent ?? null, u.context))
    void publieScene($)
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
      void publieScene($)
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
  void publieScene($)
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
    void publieScene($)
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
    } else if (/\bgit\s+push\b/.test(cmd) && !DEMANDE_GIT.test(lastPrompt)) {
      // un commit se défait ; un push, beaucoup moins : seul le push demande l'accord
      const ok = await confirm($, 'Claude veut faire un `git push` sans que tu l’aies demandé. Autoriser ?')
      if (!ok) return { deny: 'L’utilisateur n’a pas demandé de push : propose-le au lieu de le faire.' }
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
  // un build en pastille : l'orbe pendant qu'il tourne, puis son verdict
  // (l'orbe part avant l'invite de permission, s'il y en a une : le moteur ne dit pas quand elle est acceptée)
  const debutBuild = estBuild(verdict.command) ? await maintenantOuRien($) : null
  const precedent = debutBuild !== null ? await read($, build) : null
  const ceBuild = (b: AtelierBuild | null) => b !== null && b.debut === debutBuild
  if (debutBuild !== null) await majBuild($, () => ({ quoi: quoiBuild(verdict.command), debut: debutBuild, etat: 'encours' }))
  let ran: ToolCallResult
  try {
    ran = await go(verdict.command)
  } catch (erreur) {
    // le moteur a levé : la pastille ne reste pas « en cours » pour toujours
    if (debutBuild !== null) await majBuild($, b => (ceBuild(b) ? { ...(b as AtelierBuild), etat: 'fini', detail: 'interrompu' } : b))
    throw erreur
  }
  if (debutBuild !== null) {
    const fin = (await maintenantOuRien($)) ?? debutBuild
    const resultat = ran.result as { stdout?: string; stderr?: string; interrupted?: boolean; backgroundTaskId?: string } | undefined
    const sortie = `${resultat?.stdout ?? ''}\n${resultat?.stderr ?? ''}`
    if (ran.deny !== undefined || (ran.isError === true && !sortie.trim() && !resultat?.backgroundTaskId)) {
      // refusé, ou jamais lancé : on revient au build d'avant
      await majBuild($, b => (ceBuild(b) ? precedent : b))
    } else if (resultat?.backgroundTaskId) {
      // en tâche de fond : on le suit jusqu'à sa fin (classic.Stop)
      const fond = { id: resultat.backgroundTaskId, sortie: sortieFond(ran.text), commande: verdict.command.slice(0, 300) }
      await majBuild($, b => (ceBuild(b) ? { ...(b as AtelierBuild), fond } : b))
    } else if (resultat?.interrupted || (ran.isError === true && /interrupt|aborted/i.test(ran.text ?? ''))) {
      // (sur une erreur, le moteur ne donne que le texte, jamais l'enregistrement de l'outil : l'Échap se lit dans le texte)
      await majBuild($, b => (ceBuild(b) ? { ...(b as AtelierBuild), etat: 'fini', detail: 'interrompu', fin } : b))
    } else {
      const v = analyse(`${sortie}\n${ran.text ?? ''}`, ran.isError === true)
      await majBuild($, b => (ceBuild(b) ? { ...(b as AtelierBuild), ...v, fin } : b))
    }
  }
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
    // la bande partagée tout de suite (vide au départ) : Clawd sait qu'atelier est là et ne pose pas son numéro en double
    void publieScene($)
    void refresh($)
    // une session neuve ou un module rechargé, sans fin de tour connue : le
    // délai du rangement part d'ici (sinon une vieille croix rouge attendrait
    // la fin du prochain tour)
    if ((await read($, finDuTour).catch(() => null)) === null) await noteFinDuTour($, await maintenantOuRien($))
    // chaque minute : quotas relus, pastilles finies rangées, et le bandeau
    // redessiné (une fenêtre qui vient de se réinitialiser repasse à 0 %, le
    // trait du temps avance)
    // le bouton « Nouvelle conversation » clignote tant que continuer ici coûte trop (une bascule par seconde) ; sinon, rien n'est redessiné
    $.clock.every(1000, () => {
      void (async () => {
        if (aChanger(await read($, usage), await read($, conso))) await update($, clignote, v => !v)
        else if (await read($, clignote)) await update($, clignote, () => false)
      })().catch(() => {})
    })
    $.clock.every(60_000, () => {
      void rafraichirUsage($)
        .then(() => rangeLesFinis($))
        .then(() => publieScene($))
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
    void publieScene($)
    void refresh($)
    const manifest = await readText($, `${$.plugin.root}/.claude-plugin/plugin.json`)
    const version = manifest?.match(/"version"\s*:\s*"([^"]+)"/)?.[1] ?? '?'
    return {
      text: `${hidden ? 'Bandeau atelier masqué (/atelier pour le ré-afficher).' : 'Bandeau atelier affiché.'} — atelier v${version}`,
    }
  })

  on('prompt.submit', async ($, e, next) => {
    lastPrompt = e.text
    // un plan entièrement fait laisse la place au suivant (pas sur un message
    // que le moteur glisse lui-même : tu n'as pas encore vu le plan fini)
    if (!e.isMeta) {
      await majTaches($, l => (toutFait(l) ? [] : [...l]))
      await majAgents($, nettoieAgents)
      // le modèle et l'effort qui suffisent pour ce que tu demandes (Haiku le lit, sans retarder le tour) ;
      // pas pour une routine, une autre session ou un plugin, ni bandeau masqué : du quota pour rien
      if (!e.command && deToi(e.origin) && aJuger(e.text) && !(await read($, isHidden))) void conseille($, e.text)
    }
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

  // ---------------------------------------------- la liste de tâches de Claude

  // La liste de l'app desktop et celle de TodoWrite appartiennent à une
  // boucle : celle d'un sous-agent ne remplace pas celle de la session.
  on('tool.call', { tool: 'mcp__ccd_turn__update_plan' }, async ($, e, next) => {
    const r = await next(e)
    if (e.agentId === undefined && r.deny === undefined && !r.isError) await majTaches($, l => suitPlan(l, e))
    return r
  })
  // Claude clôt son travail (wrap_up) sans question pour toi : rien n'est en
  // suspens, le plan est fini, même s'il a oublié de cocher les dernières
  // étapes. Avec une question, les étapes restantes t'attendent : elles restent.
  on('tool.call', { tool: 'mcp__ccd_turn__wrap_up' }, async ($, e, next) => {
    const r = await next(e)
    if (e.agentId === undefined && r.deny === undefined && !r.isError && !e.ask) await majTaches($, planFini)
    return r
  })
  on('tool.call', { tool: 'TodoWrite' }, async ($, e, next) => {
    const r = await next(e)
    if (e.agentId === undefined && r.deny === undefined && !r.isError) await majTaches($, () => depuisTodos(e.todos))
    return r
  })
  // les tâches de Claude Code sont celles de toute la session, sous-agents compris
  on('tool.call', { tool: 'TaskCreate' }, async ($, e, next) => {
    const r = await next(e)
    if (r.deny === undefined && !r.isError) await majTaches($, l => ajouteTache(l, r.result?.task?.id, r.result?.task?.subject ?? e.subject))
    return r
  })
  on('tool.call', { tool: 'TaskUpdate' }, async ($, e, next) => {
    const r = await next(e)
    // l'outil peut répondre sans erreur mais sans rien changer (`success: false`)
    if (r.deny === undefined && !r.isError && r.result?.success !== false) await majTaches($, l => majTache(l, e))
    return r
  })
  on('tool.call', { tool: 'TaskList' }, async ($, e, next) => {
    const r = await next(e)
    if (r.deny === undefined && !r.isError && Array.isArray(r.result?.tasks)) await majTaches($, () => depuisTaskList(r.result.tasks))
    return r
  })

  // ------------------------------------------------- la conso, en direct

  // un tour de la conversation principale commence : ses compteurs repartent de zéro
  on('turn.start', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId === undefined) {
      // Claude travaille : rien ne se range
      await noteFinDuTour($, null)
      const cout = await coutSession($)
      await majConso($, c => debutTour(c, cout))
    }
    return r
  })
  // chaque réponse de l'API (sous-agents compris) : ses tokens, et ce qu'elle coûterait
  on('turn.step', async function* ($, e, next) {
    // ce qui tourne vraiment : le modèle et l'effort de la requête (pour le conseil de modèle)
    if (e.agentId === undefined) {
      try {
        const effort = typeof e.effort === 'string' ? e.effort : null
        const avant = await read($, reglage)
        if (avant?.modele !== e.model || avant?.effort !== effort) {
          await update($, reglage, () => ({ modele: e.model, effort }))
          void publieScene($)
        }
      } catch {
        // il sera noté à la requête suivante
      }
    }
    const r = yield* next(e)
    try {
      if (r?.usage) {
        const u = r.usage
        const cout = await coutSession($)
        await majConso($, c => ajouteReponse(c, u.model, tokensDe(u), e.agentId === undefined, cout))
      }
    } catch {
      // la conso attendra la réponse suivante
    }
    return r
  })

  // ------------------------------------------------- le sonar des sous-agents

  // chaque outil qu'un sous-agent lance fait partir une onde de sa pastille
  // (dès la demande, avant l'invite de permission : un appel refusé ensuite en fait partir une aussi)
  on('tool.call', async ($, e, next) => {
    const agent = e.agentId
    if (agent === undefined || estDiscret(typeof e.tool === 'string' ? e.tool : '')) return next(e)
    const maintenant = await maintenantOuRien($)
    // un sous-agent pas encore enregistré n'a pas de pastille : rien à écrire
    if (maintenant !== null && (await read($, agents).catch(() => [])).some(a => a.id === agent)) {
      const outil = decrit(e as unknown as Record<string, unknown>)
      await majAgents($, l => pingAgent(l, agent, maintenant, outil))
    }
    return next(e)
  })

  // ------------------------------------------------- les sous-agents

  on('agent.spawn', async ($, e, next) => {
    const r = await next(e)
    if (r.deny === undefined && r.agentId) {
      const id = r.agentId
      const maintenant = (await maintenantOuRien($)) ?? 0
      // un sous-agent qui a déjà fini (échec immédiat) avant que ce crochet ne l'ajoute
      const dejaFini = finisAvantNaissance.get(id)
      finisAvantNaissance.delete(id)
      await majAgents($, l => {
        const avec = ajouteAgent(l, { id, type: e.subagentType, mission: e.description, modele: r.model }, maintenant)
        return dejaFini ? finAgent(avec, id, dejaFini.cause, dejaFini.fin) : avec
      })
    }
    return r
  })

  // ------------------------------------------------- un build en tâche de fond

  // à chaque fin de tour, le moteur liste ce qui tourne encore : un build qui
  // n'y est plus est fini, et sa sortie dit s'il a réussi
  on('classic.Stop', async ($, e, next) => {
    const r = await next(e)
    try {
      const b = await read($, build)
      // sans la liste, on ne sait rien : on attend le tour suivant
      if (b?.etat === 'encours' && b.fond && e.background_tasks !== undefined) {
        const fond = b.fond
        const termine = /^(completed|failed|killed|stopped|error)$/i
        const encore = e.background_tasks.some(
          x => (x.id === fond.id || (x.type === 'shell' && !!fond.commande && !!x.command?.includes(fond.commande.slice(0, 120)))) && !termine.test(x.status),
        )
        if (!encore) {
          const sortie = fond.sortie ? await readText($, fond.sortie) : null
          const v = sortie ? analyse(sortie, false) : { etat: 'fini' as const }
          const fin = (fond.sortie ? await dateDe($, fond.sortie) : null) ?? (await maintenantOuRien($)) ?? b.debut
          await majBuild($, x => (x && x.fond?.id === fond.id ? { ...x, ...v, fin } : x))
        }
      }
    } catch {
      // le build se recalera au tour suivant
    }
    return r
  })

  on('turn.complete', async ($, e, next) => {
    const ran = await next(e)
    if (e.agentId !== undefined) {
      // un sous-agent a fini (ou a été interrompu)
      const id = e.agentId
      const maintenant = (await maintenantOuRien($)) ?? 0
      // en erreur ou sur un refus, il n'a pas « fini » : sa pastille le dit
      const cause = e.isAborted ? 'interruption' : causeDe(e.reason)
      const connu = (await read($, agents)).some(a => a.id === id)
      if (connu) await majAgents($, l => finAgent(l, id, cause, maintenant))
      else {
        finisAvantNaissance.set(id, { cause, fin: maintenant })
        for (const vieux of finisAvantNaissance.keys()) {
          if (finisAvantNaissance.size <= MAX_FINIS_AVANT_NAISSANCE) break
          finisAvantNaissance.delete(vieux)
        }
      }
    }
    if (e.agentId === undefined) {
      // le délai du rangement part d'ici
      const fin = await maintenantOuRien($)
      if (fin !== null) await noteFinDuTour($, fin)
      const cout = await coutSession($)
      await majConso($, c => finTour(c, cout))
      // tour interrompu : l'étape en cours n'avance plus
      if (e.isAborted) await majTaches($, interrompue)
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

  // /clear ou une reprise : le processus continue sur une autre conversation, qui a sa propre liste
  on('session.end', async ($, e, next) => {
    finisAvantNaissance.clear()
    // un conseil encore en route parlait de l'autre conversation
    dernierConseil++
    await Promise.all([majTaches($, () => []), majAgents($, () => []), majConso($, () => null), update($, conseil, () => null).catch(() => {})])
    void publieScene($)
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    const u = usageDepuis(e.rateLimits, e.context.percent ?? null, e.context)
    await update($, usage, () => u)
    void publieScene($)
    const cout = e.cost?.usd
    if (typeof cout === 'number' && Number.isFinite(cout)) await majConso($, c => mesureCout(c, cout))

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
    if (e.props.hasSurvey) return next(e)
    // ce que dessinent les autres mods (clawd) reste TOUJOURS au même endroit de
    // l'arbre, bande vide, masquée ou non : sinon l'app recrée leur image, et une
    // animation en cours (ses cartons) repart de son début
    // le numéro que Clawd joue sur toute la bande (son dessin, qu'il publie) :
    // posé par-dessus nos lignes, dans notre rangée, la seule qui couvre la bande
    const numeroDeClawd = async (maintenant: number) => {
      const gs = e.surface === 'desktop' ? grandeSceneDe(await read($, grandeSceneClawd), maintenant) : null
      if (!gs) return null
      const { Box, Svg } = $.ui.resolve(e)
      // la bande ne se mesure qu'en cases : sa largeur en px, pour que le dessin la couvre à l'échelle 1
      return (
        <Box key="grande-scene" position="absolute" left={0} right={0} bottom={0}>
          <Svg source={gs.svg} alt="Clawd joue sur la bande" width={Math.round(e.props.bodyColumns * CELLULE)} height={gs.hauteur} />
        </Box>
      )
    }
    const enveloppe = async () => {
      const dessous = await next(e)
      if (dessous === null || dessous === undefined) return dessous
      const { Box } = $.ui.resolve(e)
      // bande vide ou masquée : son numéro reste à nous (la bande partagée, vide, le lui dit)
      const grandeScene = await numeroDeClawd(await $.clock.now())
      return (
        <Box flexDirection="row" alignItems="flex-end">
          <Box flexDirection="column" flexGrow={1} />
          {dessous}
          {grandeScene}
        </Box>
      )
    }
    if (await read($, isHidden)) return enveloppe()
    const a = await read($, android)
    const g = await read($, git)
    const u = await read($, usage)
    await read($, minute) // redessin chaque minute
    const enCours = await read($, busy)
    const lt = await read($, taches)
    const c = await read($, conso)
    const b = await read($, build)
    const la = await read($, agents)
    const maintenant = await $.clock.now()
    // le même plan que la bande partagée (scene.ts) : ce que Clawd y lit est ce qui est dessiné
    const ca = conseilAffiche(await read($, conseil), (await read($, reglage)) ?? SANS_REGLAGE)
    const plan = planBandeau({ android: a, git: g, usage: u, taches: lt, conso: c, build: b, agents: la, busy: enCours, conseil: ca }, maintenant)
    // rien à montrer : le moteur dessine (et la bande partagée est vide)
    if (plan.lignes.length === 0) return enveloppe()
    // on compose au lieu de remplacer : ce que dessinent les autres mods
    // (clawd) se place à droite de nos lignes, posé sur le bord du bas
    const dessous = await next(e)

    const { Box, Text, Button } = $.ui.resolve(e)

    // quotas et contexte en jauges : un dessin sur desktop, des blocs ▰▱ ailleurs
    const lj = plan.jauges
    const quand = quandDe(maintenant)
    // la conso du tour (et son coût au tarif de l'API) après les jauges
    const pastilleC = plan.conso
    // ce que Clawd tient en ce moment : sa place reste, vide, jusqu'à ce qu'il le rende
    const caches = empruntsDe(await read($, empruntsClawd), maintenant)
    // dit aussi dans le texte alternatif : ce qui n'est pas dessiné reste annoncé
    const joueAvec = caches.size ? `Clawd joue avec : ${[...caches].join(', ')}` : ''
    let quotas: JSX.Element | null = null
    if ((lj.length > 0 || pastilleC || plan.conseil) && e.surface === 'desktop') {
      const { Svg } = $.ui.resolve(e)
      const dessin = svgJauges(lj, quand, { maintenant, contexte: u ? { tokens: u.contextTokens, window: u.contextWindow } : undefined, conso: pastilleC, conseil: plan.conseil, caches })
      const alt = [lj.length > 0 ? resumeJauges(lj, quand) : '', pastilleC ? `Conso : ${pastilleC.texte}` : '', plan.conseil ? `Conseil : ${plan.conseil.texte}` : '', joueAvec]
        .filter(Boolean)
        .join(' · ')
      // interactif : le survol d'une jauge dit sa projection, celui de la conso son détail
      quotas = <Svg source={dessin.svg} alt={alt} width={+(dessin.largeur * ECHELLE).toFixed(1)} height={HAUTEUR_DESSIN} isInteractive />
    } else if (lj.length > 0 || pastilleC || plan.conseil) {
      quotas = (
        <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
          {texteJauges(lj, quand).map(j => (
            <Text color={j.niveau === 'ok' ? undefined : COULEURS[j.niveau]} dimColor={j.niveau === 'ok'}>
              {j.texte}
            </Text>
          ))}
          {pastilleC && (
            <Text color={pastilleC.lourde ? COULEURS.attention : undefined} dimColor={!pastilleC.lourde}>
              {pastilleC.texte}
            </Text>
          )}
          {plan.conseil && <Text color="#b085f5">{plan.conseil.texte}</Text>}
        </Box>
      )
    }

    // la liste de tâches en pastilles : le nom d'une étape au survol (d'où
    // isInteractive) sur desktop, des ◌ ◐ ✔ ailleurs
    // le build en cours ou son verdict (un réussi s'efface au bout de 10 min)
    const bv = plan.build
    const enFond = bv?.etat === 'encours'
    const glypheBuild = (x: AtelierBuild) => (
      <Text color={x.etat === 'echec' ? COULEURS.critique : x.etat === 'ok' ? COULEURS.ok : undefined} dimColor={x.etat === 'fini'}>
        {` ${x.etat === 'encours' ? '◐' : x.etat === 'echec' ? '✖' : '✔'} build`}
      </Text>
    )
    let pastilleB: JSX.Element | null = null
    if (bv && a && e.surface === 'desktop') {
      const { Svg } = $.ui.resolve(e)
      const p = pastilleBuild(bv, maintenant)
      const dessin = svgPastilles([[p]], enFond, caches)
      pastilleB = <Svg source={dessin.svg} alt={p.titre} width={+(dessin.largeur * ECHELLE).toFixed(1)} height={HAUTEUR_DESSIN} isInteractive />
    } else if (bv && a) {
      pastilleB = glypheBuild(bv)
    }

    const groupes = plan.groupes
    let ronds: JSX.Element | null = null
    if (groupes.length > 0 && e.surface === 'desktop') {
      const { Svg } = $.ui.resolve(e)
      const dessin = svgPastilles(groupes, e.props.isWorking === true || (enFond && !a), caches)
      const alt = [bv && !a ? pastilleBuild(bv, maintenant).titre : '', lt.length > 0 ? resumeTaches(lt) : '', la.length > 0 ? resumeAgents(la) : '', joueAvec]
        .filter(Boolean)
        .join(' · ')
      ronds = <Svg source={dessin.svg} alt={alt} width={+(dessin.largeur * ECHELLE).toFixed(1)} height={HAUTEUR_DESSIN} isInteractive />
    } else if (groupes.length > 0) {
      ronds = (
        <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
          {bv && !a && glypheBuild(bv)}
          {texteTaches(lt).map(t => (
            <Text color={t.etat === 'faite' ? COULEURS.ok : undefined} dimColor={t.etat === 'attente'}>
              {t.texte}
            </Text>
          ))}
          {la.map(x => (
            <Text color={couleurModele(x.modele)} dimColor={x.etat === 'interrompu'}>
              {x.etat === 'encours' ? '◐' : x.etat === 'faite' ? '✔' : '◌'}
            </Text>
          ))}
        </Box>
      )
    }

    const grandeScene = await numeroDeClawd(maintenant)

    // ↻ et Masquer : au bout de la ligne git, courte ; sur celle des quotas (sans git), ils la faisaient
    // passer à la ligne quand elle était longue, et la bande changeait de forme
    // une conversation neuve : discret d'habitude, il clignote quand continuer ici coûte trop (le moment d'en changer)
    const lourd = aChanger(u, c)
    const allume = lourd && (await read($, clignote))
    const nouvelle = (
      <Button
        key="nouvelle"
        label="Nouvelle conversation"
        hotkey="n"
        plain
        dimColor={!lourd}
        onPress={async () => {
          const noms = (await $.command.list().catch(() => [])).map(c => c.name)
          await $.command.run({ command: commandeSuite(noms) }).catch(err => {
            $.ui.toast(`Nouvelle conversation impossible pour l’instant : ${String(err).slice(0, 120)}`, { timeoutMs: 8000 })
          })
        }}
      >
        <Text color={allume ? 'yellow' : undefined} bold={lourd} dimColor={lourd && !allume}>
          {lourd ? `🆕 Nouvelle conversation (${texteGachis(u, c)})` : '🆕'}
        </Text>
      </Button>
    )
    const commandes = (
      <Box flexDirection="row" alignItems="center">
        <Text> </Text>
        {nouvelle}
        <Text> </Text>
        <Button key="refresh" label="↻" plain dimColor onPress={() => refresh($)} />
        <Button
          key="hide"
          label="Masquer"
          role="dismiss"
          dimColor
          onPress={async () => {
            await update($, isHidden, () => true)
            void publieScene($)
            // sans ça, rien ne dit comment le faire revenir
            $.ui.toast('Bandeau atelier masqué : tape /atelier pour le ré-afficher', { timeoutMs: 8000 })
          }}
        />
      </Box>
    )

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
              {pastilleB}
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
            <Box key="ligne-git" flexDirection="row" flexWrap="wrap">
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
              {commandes}
            </Box>
          )}
          {quotas && (
            <Box key="ligne-quotas" flexDirection="row" flexWrap="wrap" alignItems="center">
              {quotas}
              {!g && commandes}
            </Box>
          )}
          {ronds && (
            <Box flexDirection="row" alignItems="center">
              {ronds}
            </Box>
          )}
          {enCours && <Text color="cyan">⏳ {enCours}</Text>}
        </Box>
        {dessous}
        {grandeScene}
      </Box>
    )
  })
}
