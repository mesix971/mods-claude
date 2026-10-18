// Le build en pastille : l'orbe pendant qu'un gradlew ou un flutter build
// tourne, une coche verte avec sa durée quand il réussit, une croix rouge avec
// la tâche qui a échoué et la première erreur au survol.
//
// Un build lancé en tâche de fond est suivi jusqu'à sa fin : à chaque fin de
// tour, le moteur liste les tâches encore en cours. Quand le build n'y est
// plus, sa sortie (le fichier où elle s'écrit) dit s'il a réussi.

import type { AtelierBuild } from '../types'
import type { Pastille } from './pastilles'
import { duree, dureeCourte, heure } from './temps'

/** Un texte sûr à dessiner : sans séquence de couleur de terminal ni caractère de contrôle */
const propre = (s: string, max: number) =>
  Array.from(
    s
      .replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '')
      .replace(/[\u0000-\u001f\u007f-\u009f\ufffe\uffff]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
    .slice(0, max)
    .join('')

/** Les mots d'une commande, guillemets ôtés */
const mots = (s: string) => (s.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map(m => m.replace(/^["']|["']$/g, ''))
const nomDe = (chemin: string) => (chemin.split(/[\\/]/).pop() ?? '').toLowerCase()

/** Les options de Gradle suivies d'une valeur (le mot d'après n'est pas une tâche) */
const AVEC_VALEUR = new Set(['-p', '--project-dir', '--tests', '-x', '--exclude-task', '--console', '--max-workers', '-b', '--build-file', '-c', '--settings-file', '-g', '--gradle-user-home', '-i', '--init-script'])
/** Des appels de Gradle qui ne construisent rien */
const SANS_BUILD = new Set(['--stop', '--version', '-v', '--status', 'tasks', 'help', 'projects', 'properties'])

type Lancement = { outil: 'gradle' | 'flutter' | 'release'; args: string[] }

/** Les tâches d'un appel de Gradle : sans les options (ni leur valeur) ni les redirections */
function tachesGradle(args: readonly string[]): string[] {
  const taches: string[] = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!
    if (AVEC_VALEUR.has(a)) i++
    else if (!a.startsWith('-') && !/^\d*[<>]/.test(a) && !a.startsWith('&')) taches.push(a)
  }
  return taches
}

/**
 * La commande de build réellement lancée dans une ligne (séparée par ; && ||
 * |), pas un fichier gradlew qu'on ajoute à git ou qu'on rend exécutable.
 */
function lancement(commande: string): Lancement | null {
  for (const segment of commande.split(/&&|\|\||[;|\n]/)) {
    let m = mots(segment.trim().replace(/^&\s*/, ''))
    // affectations d'environnement en tête (JAVA_HOME=… ./gradlew)
    while (m.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(m[0]!)) m = m.slice(1)
    // enveloppes courantes : cmd /c, bash, sh, call, powershell -File
    const n0 = nomDe(m[0] ?? '')
    if ((n0 === 'cmd' || n0 === 'cmd.exe') && /^\/c$/i.test(m[1] ?? '')) m = m.slice(2)
    else if (n0 === 'bash' || n0 === 'sh' || n0 === 'call') m = m.slice(1)
    else if ((n0 === 'powershell' || n0 === 'pwsh' || n0 === 'powershell.exe') && /^-file$/i.test(m[1] ?? '')) m = m.slice(2)
    const exe = nomDe(m[0] ?? '')
    const args = m.slice(1)
    // un build : au moins une vraie tâche (pas --stop, tasks, help…)
    if (exe === 'gradlew' || exe === 'gradlew.bat') {
      if (tachesGradle(args).some(t => !SANS_BUILD.has(t.toLowerCase()))) return { outil: 'gradle', args }
      continue
    }
    if ((exe === 'flutter' || exe === 'flutter.bat') && /^(build|test)$/i.test(args[0] ?? '')) return { outil: 'flutter', args }
    if (exe === 'release.ps1') return { outil: 'release', args }
  }
  return null
}

/** Une commande qui construit ou teste le projet */
export const estBuild = (commande: string) => lancement(commande) !== null

/** Ce qui est construit, en court : les tâches Gradle (« assembleDebug »), « flutter build apk »… */
export function quoiBuild(commande: string): string {
  const l = lancement(commande)
  if (!l) return 'build'
  if (l.outil === 'flutter') return propre(`flutter ${l.args.slice(0, l.args[0]?.toLowerCase() === 'build' ? 2 : 1).join(' ')}`, 60)
  if (l.outil === 'release') return 'release.ps1'
  const taches = tachesGradle(l.args).slice(0, 3)
  return propre(taches.length ? taches.join(' ') : 'gradlew', 60)
}

/** Le fichier où s'écrit la sortie d'une commande lancée en tâche de fond, d'après la réponse de l'outil */
export const sortieFond = (texte: string | undefined) => texte?.match(/Output is being written to: (\S[^\r\n]*?)\s*$/m)?.[1]?.trim() ?? null

/**
 * Le verdict d'une sortie de build : réussi, échoué (avec la tâche et la
 * première erreur), ou « terminé » quand la sortie ne tranche pas (tronquée
 * par un `| grep`, par exemple).
 */
export function analyse(brute: string, enErreur: boolean): { etat: AtelierBuild['etat']; detail?: string } {
  // une console « rich » colore ses lignes : sans ses codes, « error: » reste en début de ligne
  const sortie = brute.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '')
  const tache = sortie.match(/> Task (\S+) FAILED/)?.[1]
  const erreur = (
    sortie.match(/^e: (?:file:\/\/\S+ )?(.+)$/m)?.[1] ??
    sortie.match(/^\* What went wrong:\s*\r?\n(.+)$/m)?.[1] ??
    sortie.match(/^\s*error: (.+)$/im)?.[1]
  )?.trim()
  const detail = propre([tache, erreur].filter(Boolean).join(' — '), 300) || undefined
  if (/BUILD FAILED|FAILURE: Build failed|Some tests failed|Gradle task \S+ failed/i.test(sortie)) return { etat: 'echec', detail }
  if (/BUILD SUCCESSFUL|All tests passed|[✓√] Built /.test(sortie)) return { etat: 'ok' }
  return enErreur ? { etat: 'echec', detail } : { etat: 'fini' }
}

/** Un build réussi ou terminé s'efface au bout de 10 minutes ; un échec reste jusqu'au build suivant, ou jusqu'au rangement (rangement.ts) */
export const buildVisible = (b: AtelierBuild | null, maintenant: number): b is AtelierBuild =>
  b !== null && (b.etat === 'encours' || b.etat === 'echec' || maintenant - (b.fin ?? b.debut) < 10 * 60_000)

export const pastilleBuild = (b: AtelierBuild, maintenant: number): Pastille => ({ id: 'build', ...pastilleSansNom(b, maintenant) })

function pastilleSansNom(b: AtelierBuild, maintenant: number): Pastille {
  const nom = `Build ${b.quoi}`
  if (b.etat === 'encours') {
    return { titre: `${nom} — en cours depuis ${heure(b.debut)} (${dureeCourte(maintenant - b.debut)})${b.fond ? ', en tâche de fond' : ''}`, forme: 'encours' }
  }
  const temps = b.fin !== undefined ? ` en ${duree(b.fin - b.debut)}, à ${heure(b.fin)}` : ''
  if (b.etat === 'ok') return { titre: `${nom} — réussi${temps}`, forme: 'faite' }
  if (b.etat === 'echec') return { titre: `${nom} — échoué${temps}${b.detail ? `\n${b.detail}` : ''}`, forme: 'echec' }
  return { titre: `${nom} — ${b.detail === 'interrompu' ? 'interrompu' : `terminé${temps} (sa sortie ne dit pas s’il a réussi)`}`, forme: 'faite', teinte: '#8b9097' }
}
