// Ce que fait un appel d'outil, en quelques mots : l'infobulle d'un sous-agent
// (le sonar) dit le dernier outil qu'il a lancé. Les secrets aux formats
// courants (jetons, mots de passe, clés d'API) n'y apparaissent pas.

/**
 * Les outils de tenue de liste (ils ont leurs pastilles), et ceux où c'est toi
 * qu'on attend (une question, un plan à valider) : pas du travail, pas d'onde.
 */
const DISCRETS = new Set([
  'TodoWrite',
  'TaskCreate',
  'TaskUpdate',
  'TaskList',
  'TaskGet',
  'ToolSearch',
  'AskUserQuestion',
  'ExitPlanMode',
  'EnterPlanMode',
  'mcp__ccd_turn__update_plan',
  'mcp__ccd_turn__wrap_up',
])
export const estDiscret = (outil: string) => DISCRETS.has(outil)

const propre = (v: unknown, max: number) =>
  typeof v === 'string'
    ? Array.from(
        v
          .replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '')
          .replace(/[\u0000-\u001f\u007f-\u009f\ufffe\uffff]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim(),
      )
        .slice(0, max)
        .join('')
    : ''
const court = (s: string, max: number) => Array.from(s).slice(0, max).join('')

/** Ce qui annonce un secret : `GITHUB_TOKEN=`, `"password":`, `SECRET_KEY=`, `?key=`, `Pwd=` (pas `$pwd`, le dossier courant de PowerShell) */
const NOM_SECRET = String.raw`(?:token|password|passwd|(?<!\$)pwd|secret|api[_-]?key|access[_-]?key|\bkey)[\w-]*`
/** Une valeur s'arrête au premier blanc, guillemet ou séparateur de paramètres ou de champs */
const VALEUR = String.raw`[^\s"'&;,}]+`
const AUTORISATION = new RegExp(String.raw`(authorization["']?\s*[=:]\s*["']?(?:(?:bearer|basic|token|digest)\s+)?)${VALEUR}`, 'gi')
const PARAMETRE = new RegExp(String.raw`(${NOM_SECRET}["']?\s*[=:]\s*["']?)${VALEUR}`, 'gi')

/**
 * Ce qui ressemble à un secret ne s'affiche pas, même au survol. Les formats
 * courants seulement : identifiants d'une URL, en-tête d'autorisation, jeton,
 * mot de passe ou clé passés en paramètre, `curl -u`, et les jetons aux
 * préfixes connus (GitHub, GitLab, Slack, Google, AWS, npm, `sk-`).
 */
export const masque = (s: string) =>
  s
    // https://moi:motdepasse@hote, https://ghp_…@github.com : jusqu'au dernier @ avant le chemin
    .replace(/:\/\/[^/\s?#]*@/g, '://•••@')
    .replace(AUTORISATION, '$1•••')
    .replace(PARAMETRE, '$1•••')
    // une option en tête de mot, pas le « -token » de « refresh-token »
    .replace(/((?:^|\s)--?(?:password|passwd|token|secret|api-key)(?:=|\s+))\S+/gi, '$1•••')
    // curl -u moi:motdepasse, pas « git push -u origin »
    .replace(/((?:^|\s)(?:-u|--user)(?:=|\s+))[^\s:]+:\S+/g, '$1•••')
    .replace(/\b(gh[pousr]_|github_pat_|glpat-|xox[abposr]-|AIza|AKIA|ASIA|npm_|sk-)[A-Za-z0-9_-]{8,}/g, '$1•••')
/** Les préfixes que le garde-fou ajoute lui-même à une commande (JAVA_HOME) : pas ce que Claude a demandé */
const sansPrefixe = (s: string) => s.replace(/^(?:export JAVA_HOME="[^"]*";\s*|\$env:JAVA_HOME = '[^']*';\s*)/, '')
const fichier = (v: unknown) => court(propre(v, 300).split(/[\\/]/).pop() ?? '', 80)
/** L'hôte d'une URL, sans ses identifiants ; un « port » qui n'est pas un nombre est un bout de mot de passe mal formé */
function hote(v: unknown): string {
  const h = (propre(v, 300).replace(/^[a-z]+:\/\//i, '').split(/[/?#]/)[0] ?? '').replace(/^.*@/, '')
  return h.startsWith('[') ? h : h.replace(/:(?!\d*$).*$/, '')
}

/** Ce que fait un appel, d'après ses arguments : secrets masqués, 120 caractères au plus */
export const decrit = (e: Record<string, unknown>) => court(masque(enLong(e)), 120)

function enLong(e: Record<string, unknown>): string {
  const outil = typeof e.tool === 'string' ? e.tool : '?'
  switch (outil) {
    case 'Read':
    case 'NotebookRead':
      return `Lecture · ${fichier(e.file_path ?? e.notebook_path)}`
    case 'Grep':
    case 'Glob':
    case 'LS':
      return `${outil === 'Grep' ? 'Recherche' : 'Fichiers'} · ${propre(e.pattern ?? e.path, 80)}`
    case 'Edit':
    case 'MultiEdit':
    case 'Write':
    case 'NotebookEdit':
      return `${outil === 'Write' ? 'Écriture' : 'Édition'} · ${fichier(e.file_path ?? e.notebook_path)}`
    case 'Bash':
    case 'PowerShell':
      // la commande entière d'abord : masquée avant d'être coupée, un secret à cheval sur la coupe ne fuit pas à moitié
      return `${outil} · ${propre(e.description, 80) || sansPrefixe(propre(e.command, 200))}`
    case 'WebFetch':
      return `Page web · ${hote(e.url)}`
    case 'WebSearch':
      return `Recherche web · ${propre(e.query, 80)}`
    case 'Agent':
    case 'Task':
      return `Sous-agent ${propre(e.subagent_type, 40) || 'agent'} · ${propre(e.description, 80)}`
  }
  const mcp = /^mcp__(.+?)__(.+)$/.exec(outil)
  if (mcp) return `${propre(mcp[1], 40)} · ${propre(mcp[2], 60)}`
  return propre(outil, 60)
}
