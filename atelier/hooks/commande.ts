// Lire une commande shell (Bash ou PowerShell) comme le shell la lirait, assez
// pour les garde-fous : ses commandes simples, chacune avec son outil en tête.
// Une règle ne vise que le bon outil (`git push`, `./gradlew`, `adb`) : un
// message de commit, un `grep connectedCheck` ou le corps d'un heredoc qui
// citent une commande ne posent plus de question, et ne bloquent plus le tour.

/** Une commande simple : son texte, son outil (nom de fichier en minuscules, sans extension), ses mots, et les variables posées devant (`X=1 cmd`) */
export type Simple = { texte: string; tete: string; mots: string[]; env: string[] }

/** Le shell qui lit la commande : en PowerShell, l'antislash n'échappe rien (c'est l'accent grave) */
export type Shell = 'Bash' | 'PowerShell'

/** Les outils qui exécutent du code reçu en argument : là, on lit tout le texte, par prudence */
const INTERPRETES = new Set([
  'bash', 'sh', 'zsh', 'dash', 'pwsh', 'powershell', 'cmd', 'wsl', 'node', 'python', 'python3', 'py', 'perl', 'ruby',
  'eval', 'xargs', 'ssh', 'invoke-expression', 'iex', 'invoke-command', 'icm', 'start-process', 'saps', 'start-job',
])

/**
 * Ce qu'on saute devant l'outil : les préfixes qui lancent la commande qui
 * suit (avec leurs options et leurs nombres : `timeout 60`, `nice -n 10`), et
 * les mots de contrôle (`if git push -f; then …`)
 */
const PREFIXES = new Set(['sudo', 'time', 'nohup', 'env', 'command', 'exec', 'nice', 'timeout', 'stdbuf', 'then', 'else', 'elif', 'do', 'if', 'while', 'until', 'try', 'finally', '!'])
/** Des préfixes qui ne prennent ni option ni nombre */
const NUS = new Set(['&', '.', '{', '('])

/** Coupe le texte en mots, hors guillemets (les guillemets sont retirés des mots) */
export function mots(texte: string, shell: Shell = 'Bash'): string[] {
  const out: string[] = []
  let mot = ''
  let dans: '"' | "'" | null = null
  let commence = false
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i]!
    if (dans) {
      if (c === dans) dans = null
      else if (shell === 'Bash' && c === '\\' && dans === '"' && (texte[i + 1] === '"' || texte[i + 1] === '\\')) mot += texte[++i]
      else mot += c
      continue
    }
    if (c === '"' || c === "'") {
      dans = c
      commence = true
      continue
    }
    if (/\s/.test(c)) {
      if (commence) out.push(mot)
      mot = ''
      commence = false
      continue
    }
    mot += c
    commence = true
  }
  if (commence) out.push(mot)
  return out
}

/** Le nom d'un outil : `./gradlew`, `"C:\…\git.exe"`, `.\gradlew.bat` → gradlew, git */
const nomOutil = (mot: string) =>
  (mot.split(/[\\/]/).pop() ?? '')
    .toLowerCase()
    .replace(/\.(exe|bat|cmd|ps1|sh)$/, '')

/** L'outil d'une commande simple (variables d'environnement et préfixes sautés), et ses mots */
export function simple(texte: string, shell: Shell = 'Bash'): Simple {
  const m = mots(texte, shell)
  const env: string[] = []
  let i = 0
  while (i < m.length) {
    const w = m[i]!
    if (/^[A-Za-z_]\w*=/.test(w)) {
      env.push(w)
      i++
    } else if (NUS.has(w)) i++
    else if (PREFIXES.has(w.toLowerCase())) {
      i++
      // ses options et ses nombres
      while (i < m.length && /^(-|\d)/.test(m[i]!)) i++
    } else break
  }
  return { texte, tete: nomOutil(m[i] ?? ''), mots: m.slice(i + 1), env }
}

/**
 * Retire les corps de heredoc : des données (un message de commit, un
 * fichier), sauf quand ils nourrissent un interprète (bash, python…) : là,
 * c'est du code, rendu à part pour être lu en entier par prudence.
 */
function sansHeredocs(cmd: string): { texte: string; code: Simple[] } {
  const code: Simple[] = []
  const texte = cmd.replace(/<<-?\s*(['"]?)([A-Za-z_]\w*)\1([^\n]*)\n([\s\S]*?)\n[ \t]*\2[ \t]*(?=\n|$)/g, (_tout, _q, _fin, suite: string, corps: string, decalage: number) => {
    const debut = cmd.lastIndexOf('\n', decalage) + 1
    const tete = simple(cmd.slice(debut, decalage).split(/&&|\|\||[;|]/).pop() ?? '').tete
    if (INTERPRETES.has(tete)) code.push({ texte: corps, tete, mots: [], env: [] })
    return suite
  })
  return { texte, code }
}

/** La fin d'un `$(…)` qui s'ouvre en `i` (l'index de sa parenthèse fermante, ou la fin du texte) */
function finSousCommande(s: string, i: number): number {
  let profondeur = 0
  let dans: '"' | "'" | null = null
  for (let j = i; j < s.length; j++) {
    const c = s[j]!
    if (dans) {
      if (c === dans) dans = null
      continue
    }
    if (c === '"' || c === "'") dans = c
    else if (c === '(') profondeur++
    else if (c === ')' && --profondeur === 0) return j
  }
  return s.length - 1
}

/**
 * Les commandes simples d'une commande : coupée sur `&&`, `||`, `;`, `|`, `&`
 * et les retours à la ligne (en PowerShell, aussi sur les blocs `{ … }` :
 * `if ($?) { git push -f }`), hors guillemets ; les lignes continuées sont
 * rejointes. Ce qu'exécutent `$(…)` et les accents graves (Bash) est lu comme
 * des commandes, en plus de la commande qui les contient.
 */
export function segments(cmd: string, shell: Shell = 'Bash'): Simple[] {
  // une ligne continuée (`\` en Bash, l'accent grave en PowerShell) n'en fait qu'une
  const jointe = cmd.replace(shell === 'Bash' ? /\\\r?\n/g : /`\r?\n/g, ' ')
  const { texte: s, code } = sansHeredocs(jointe)
  const out: string[] = []
  const dedans: string[] = []
  let cour = ''
  let dans: '"' | "'" | null = null
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!
    // ce qu'exécute un `$(…)` (aussi entre guillemets doubles) : des commandes à lire
    if (dans !== "'" && c === '$' && s[i + 1] === '(') {
      const j = finSousCommande(s, i + 1)
      dedans.push(s.slice(i + 2, j))
      cour += s.slice(i, j + 1)
      i = j
      continue
    }
    if (shell === 'Bash' && dans !== "'" && c === '`') {
      const j = s.indexOf('`', i + 1)
      const fin = j < 0 ? s.length : j
      dedans.push(s.slice(i + 1, fin))
      cour += s.slice(i, fin + 1)
      i = fin
      continue
    }
    if (dans) {
      if (c === dans) dans = null
      else if (shell === 'Bash' && c === '\\' && dans === '"' && (s[i + 1] === '"' || s[i + 1] === '\\')) {
        cour += c + s[i + 1]
        i++
        continue
      }
      cour += c
      continue
    }
    if (c === '"' || c === "'") {
      dans = c
      cour += c
      continue
    }
    const bloc = shell === 'PowerShell' && (c === '{' || c === '}')
    if (bloc || c === ';' || c === '|' || c === '&' || c === '\n') {
      // `&` du call operator PowerShell (`& "C:\…\adb.exe" …`) : en tête de commande, ce n'est pas une coupure
      if (c === '&' && s[i + 1] !== '&' && !cour.trim() && s[i - 1] !== '>') {
        cour += c
        continue
      }
      // redirections `2>&1`, `>&2`, `&>` : pas des coupures
      if (c === '&' && (s[i - 1] === '>' || s[i + 1] === '>')) {
        cour += c
        continue
      }
      out.push(cour)
      cour = ''
      if ((c === '&' || c === '|') && s[i + 1] === c) i++
      continue
    }
    cour += c
  }
  out.push(cour)
  // un groupe `( … )` ou `{ … }` : ses parenthèses ne font pas partie des commandes
  const simples = out
    .map(t => t.trim().replace(/^[({]+\s*/, '').replace(/\s*[)}]+$/, ''))
    .filter(Boolean)
    .map(t => simple(t, shell))
  return [...simples, ...dedans.flatMap(d => segments(d, shell)), ...code]
}

/** Un appel de git : sa sous-commande, ses arguments, et le dossier qu'il vise (`-C`), s'il le dit */
export type AppelGit = { sous: string; args: string[]; dossier: string | null }

/** Lit un appel de git (options globales `-C`, `-c`, `--git-dir=…` sautées) */
export function appelGit(s: Simple): AppelGit | null {
  if (s.tete !== 'git') return null
  let dossier: string | null = null
  let i = 0
  while (i < s.mots.length && s.mots[i]!.startsWith('-')) {
    const o = s.mots[i]!
    if (o === '-C') dossier = s.mots[++i] ?? null
    else if (o === '-c') i++
    i++
  }
  const sous = s.mots[i]
  return sous ? { sous, args: s.mots.slice(i + 1), dossier } : null
}

const optionCourte = (a: string, lettre: string) => /^-[A-Za-z]+$/.test(a) && a.includes(lettre)

/** Ce qu'une commande git détruit, s'il y a de quoi demander : la raison, sinon null */
function gitDestructif(g: AppelGit): string | null {
  const { sous, args } = g
  if (sous === 'push' && args.some(a => /^--force(-with-lease|-if-includes)?(=|$)/.test(a) || optionCourte(a, 'f') || /^\+\S/.test(a))) {
    return 'push forcé : réécrit l’historique distant'
  }
  if (sous === 'reset' && args.includes('--hard')) return 'jette les modifications non commitées'
  if (sous === 'clean' && args.some(a => a === '--force' || optionCourte(a, 'f'))) return 'supprime les fichiers non suivis'
  if (sous === 'branch' && args.some(a => a === '-D' || (optionCourte(a, 'D')) || (a === '--delete' && args.includes('--force')))) {
    return 'supprime une branche non fusionnée'
  }
  const chemins = args.filter(a => !a.startsWith('-'))
  // (`restore --staged .` ne fait que désindexer : rien de perdu)
  const surLeDisque = sous === 'checkout' || (sous === 'restore' && (!args.includes('--staged') || args.some(a => a === '--worktree' || a === '-W')))
  if (surLeDisque && chemins.includes('.')) return 'annule toutes les modifications en cours'
  return null
}

/** Les règles d'avant, sur tout le texte : pour ce qu'un interprète exécute (`bash -c "…"`, `node -e`…) */
const PRUDENCE: [RegExp, string][] = [
  [/\bpm\s+clear\b/, 'efface toutes les données de l’app sur le tel'],
  [/\b(adb\b.*\buninstall|pm\s+uninstall)\b/, 'désinstalle une app (données perdues)'],
  [/\bconnected(AndroidTest|Check)\b/, 'les tests instrumentés peuvent vider les données de l’app installée'],
  [/\bgit\s+push\b[^|;&\n]*\s(--force\b|-\w*f\b|\+\S)/, 'push forcé : réécrit l’historique distant'],
  [/\bgit\s+reset\s+--hard\b/, 'jette les modifications non commitées'],
  [/\bgit\s+clean\s+-\w*f/, 'supprime les fichiers non suivis'],
  [/\bgit\s+branch\s+-D\b/, 'supprime une branche non fusionnée'],
  [/\bgit\s+checkout\s+(--\s+)?\.(\s|$)|\bgit\s+restore\s+\.(\s|$)/, 'annule toutes les modifications en cours'],
  [/\bClear-RecycleBin\b|\bFormat-Volume\b|\bformat\s+[a-z]:/i, 'suppression définitive'],
  [/\badb\b.*\bshell\b.*\brm\s+-\w*r/, 'supprime des fichiers sur le tel'],
]

/** Pourquoi une commande simple détruit quelque chose, sinon null */
function raisonDe(s: Simple): string | null {
  if (INTERPRETES.has(s.tete)) return PRUDENCE.find(([re]) => re.test(s.texte))?.[1] ?? null
  const g = appelGit(s)
  if (g) return gitDestructif(g)
  if (s.tete === 'adb' || s.tete === 'pm') {
    if (/\bpm\s+clear\b/.test(s.texte) || (s.tete === 'pm' && s.mots[0] === 'clear')) return 'efface toutes les données de l’app sur le tel'
    if (s.mots.includes('uninstall')) return 'désinstalle une app (données perdues)'
    if (/\bshell\b.*\brm\s+-\w*r/.test(s.texte)) return 'supprime des fichiers sur le tel'
    return null
  }
  if ((s.tete === 'gradlew' || s.tete === 'gradle') && s.mots.some(a => /^(:?[\w-]+:)*connected\w*(AndroidTest|Check)$/.test(a))) {
    return 'les tests instrumentés peuvent vider les données de l’app installée'
  }
  if (s.tete === 'clear-recyclebin' || s.tete === 'format-volume' || (s.tete === 'format' && s.mots.some(a => /^[a-z]:$/i.test(a)))) {
    return 'suppression définitive'
  }
  return null
}

/** Ce qu'une commande détruit : la raison de la première règle qui la vise, et la commande simple en cause ; sinon null */
export function destructif(cmd: string, shell: Shell = 'Bash'): { raison: string; texte: string } | null {
  for (const s of segments(cmd, shell)) {
    const raison = raisonDe(s)
    if (raison) return { raison, texte: s.texte }
  }
  return null
}

/**
 * Un `commit` ou un `push` de git, et le dépôt qu'il vise (null : celui de
 * la session). Pour un commit, ce qui part en plus de l'index : `tout`, les
 * modifications pas encore indexées (`git add -A`, `-u` ou `.` avant, ou
 * `commit -a`) ; `nonSuivis`, les fichiers pas encore suivis (`git add -A`
 * ou `.`) ; `ajoutes`, les chemins qu'un `git add` de la commande nomme.
 */
export type EnvoiGit = { sous: 'commit' | 'push'; depot: string | null; tout: boolean; nonSuivis: boolean; ajoutes: string[] }

/** Un chemin du shell en chemin Windows : `/c/Users` → `C:/Users`, guillemets et antislashs normalisés */
export const cheminWindows = (p: string) => p.replace(/\\/g, '/').replace(/^\/([a-zA-Z])(\/|$)/, (_, l: string, s: string) => `${l.toUpperCase()}:${s || '/'}`)

const absolu = (p: string) => /^[a-zA-Z]:\//.test(p) || p.startsWith('//')

/**
 * Les commits et les pushs d'une commande, chacun avec son dépôt : le `-C` de
 * l'appel, sinon le dernier `cd` qui le précède (relatif : depuis le dossier
 * courant à ce moment-là), sinon null. `tout` : ce qui n'est pas encore indexé
 * part aussi (`git add -A` avant, ou `commit -a`).
 */
export function envoisGit(cmd: string, dossierSession: string, shell: Shell = 'Bash', maison?: string): EnvoiGit[] {
  const out: EnvoiGit[] = []
  let ici: string | null = null
  const resout = (p: string) => {
    const c = cheminWindows(p)
    if (absolu(c)) return c
    return `${(ici ?? cheminWindows(dossierSession)).replace(/\/+$/, '')}/${c}`
  }
  const ajoutTout = new Set<string>()
  const ajoutNonSuivis = new Set<string>()
  const ajouts = new Map<string, string[]>()
  for (const s of segments(cmd, shell)) {
    if (['cd', 'set-location', 'push-location', 'pushd', 'sl'].includes(s.tete)) {
      const brute = s.mots.filter(a => !a.startsWith('-'))[0]
      // `~` : ton dossier personnel, s'il est connu (sinon on ne sait pas où, le dépôt de la session par prudence)
      const cible = brute && /^~([\\/]|$)/.test(brute) ? (maison ? `${maison}${brute.slice(1)}` : undefined) : brute
      if (cible && !cible.includes('$')) ici = resout(cible)
      continue
    }
    if (INTERPRETES.has(s.tete)) {
      // ce qu'un interprète lance : on ne sait pas où, le dépôt de la session par prudence
      const m = s.texte.match(/\bgit\s+(commit|push)\b/g) ?? []
      for (const v of m) out.push({ sous: v.endsWith('push') ? 'push' : 'commit', depot: null, tout: true, nonSuivis: true, ajoutes: [] })
      continue
    }
    const g = appelGit(s)
    if (!g) continue
    const depot = g.dossier ? resout(g.dossier) : ici
    const cle = depot ?? ''
    if (g.sous === 'add') {
      if (g.args.some(a => a === '-A' || a === '--all' || a === '.' || a === '-u' || a === '--update')) ajoutTout.add(cle)
      if (g.args.some(a => a === '-A' || a === '--all' || a === '.')) ajoutNonSuivis.add(cle)
      const noms = g.args.filter(a => !a.startsWith('-') && a !== '.').map(a => a.replace(/\\/g, '/').replace(/^\.\//, ''))
      ajouts.set(cle, [...(ajouts.get(cle) ?? []), ...noms])
    }
    if (g.sous === 'commit' || g.sous === 'push') {
      const commit = g.sous === 'commit'
      const tout = commit && (ajoutTout.has(cle) || g.args.some(a => a === '--all' || optionCourte(a, 'a')))
      out.push({ sous: g.sous, depot, tout, nonSuivis: commit && ajoutNonSuivis.has(cle), ajoutes: commit ? (ajouts.get(cle) ?? []) : [] })
    }
  }
  return out
}

/**
 * Le total des attentes en tête de commande (secondes) : `Start-Sleep` et ses
 * abréviations (`-s`, `-Sec`, `-m`, `-Milliseconds`, `-Seconds:5`), l'alias
 * `sleep` ; une boucle d'attente compte comme bloquante (une attente dedans
 * peut tourner sans fin).
 */
export function attenteBloquante(cmd: string): number {
  let total = 0
  // (une boucle se lit hors des textes entre guillemets : un « do » dans un message n'en est pas une)
  const code = cmd.replace(/"[^"]*"|'[^']*'/g, '""')
  for (const m of cmd.matchAll(/(?:^|[;&|{(\n])\s*(?:Start-)?Sleep\s+(?:-([A-Za-z]+)(?::\s*|\s+))?(\d+(?:\.\d+)?)/gi)) {
    total += /^m/i.test(m[1] ?? '') ? Number(m[2]) / 1000 : Number(m[2])
  }
  if (/\b(while|do|until)\b[^\n]*[{(][\s\S]*\b(Start-)?Sleep\b/i.test(code) && total > 0) total = Math.max(total, 600)
  if (/\bStart-Sleep\s+-Duration\b/i.test(cmd)) total = Math.max(total, 20)
  return total
}

/**
 * La commande porte-t-elle ton accord au garde-fou global (`GARDE_FOU_OK=1`
 * posé devant une commande, ou `$env:GARDE_FOU_OK = 1` en PowerShell) ? Cité
 * dans un message de commit, il ne compte pas.
 */
export function consentiGardeFou(cmd: string, shell: Shell = 'Bash'): boolean {
  return segments(cmd, shell).some(s => s.env.some(w => /^GARDE_FOU_OK=1$/i.test(w)) || /^\$env:GARDE_FOU_OK\s*=\s*['"]?1['"]?$/i.test(s.texte.trim()))
}
