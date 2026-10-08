// clawd : le petit Claude orange qui vit à droite du bandeau, au-dessus du
// prompt. Pas un mot : tout passe par ses gestes.
//
// Au repos, il se balade sur sa petite scène, puis s'occupe (café, jonglage,
// pêche, guitare, lecture…). Au travail, il déménage ses cartons, et une
// bulle au-dessus de sa tête montre ce que je fais (loupe, crayon…) sans
// l'interrompre. Les grosses réactions ont leur scène : il tape au marteau
// pendant un build, fait la fête quand ça passe, s'assoit sous son nuage quand
// ça casse… Il s'endort quand tu ne fais rien. Chaque sous-agent
// arrive en mini-Clawd qui mime ce que fait son agent, sous l'œil de Clawd,
// chef de chantier. Survole-le : ♥ pour le caresser, 🎲 pour qu'il change
// d'activité.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ToolCallResult } from 'claude-code'

import type { ClawdAnim, ClawdCopain } from '../types'
import { ACTIVITES, CLAWD_TEXTE, EMOJI, EN_BULLE, TAILLE, dureeScene, svgBulle, svgScene, teinte } from './sprite'
import type { Bulle } from './sprite'

type $ = EngineInterface

const passage = atom({ plugin: 'clawd', key: 'passage' } as const, null)
const activite = atom({ plugin: 'clawd', key: 'activite' } as const, null)
const dort = atom({ plugin: 'clawd', key: 'dort' } as const, false)
const fatigue = atom({ plugin: 'clawd', key: 'fatigue' } as const, false)
const caresses = atom({ plugin: 'clawd', key: 'caresses' } as const, 0)
const copains = atom({ plugin: 'clawd', key: 'copains' } as const, [])
const modele = atom({ plugin: 'clawd', key: 'modele' } as const, null)

const SOMMEIL_MS = 10 * 60_000
const LONG_TOUR_MS = 2 * 60_000
const LONG = 15 * 60_000

let derniereActivite = 0
let derniereScene: ClawdAnim | null = null
/** Au repos il alterne : sa balade entière, puis une activité, puis la balade… */
let finActivite = 0
let vertigeMontre = false
let couchePropose = false
/**
 * Temps déjà joué de son déménagement (ms). Après une grosse réaction, un
 * rechargement du mod ou une nouvelle session, il reprend là où il en était :
 * il finit toujours ses allers-retours au lieu de recommencer par l'aller.
 */
let boulotJoue = 0
let boulotDepuis: number | null = null
/** Relu une fois par chargement ; noté au plus toutes les 5 s pendant qu'il bosse */
let boulotLu = false
let boulotNote = 0
/** La bulle affichée, et où en était sa scène quand elle est apparue (s) */
let bulleVue: { id: number; deja: number } | null = null

const pioche = <T,>(l: readonly T[]) => l[Math.floor(Math.random() * l.length)]!

/** Joue une scène passagère, effacée au bout de `ms` (si rien ne l'a remplacée). */
async function scene($: $, anim: ClawdAnim, ms = 4000) {
  const id = Math.random()
  await update($, passage, () => ({ id, anim }))
  $.clock.after(ms, () => {
    void update($, passage, p => (p?.id === id ? null : p)).catch(() => {})
  })
  return id
}

async function reveil($: $) {
  derniereActivite = await $.clock.now()
  if (await read($, dort)) await update($, dort, () => false)
}

/** Tire une activité au sort (jamais deux fois la même d'affilée). */
function tirage() {
  const anim = pioche(ACTIVITES.filter(n => n !== derniereScene))
  derniereScene = anim
  return { anim }
}

/**
 * Compte le temps passé à déménager et dit où reprendre la scène (en
 * secondes) : ses cartons restent où il les a laissés.
 */
function reprise(anim: ClawdAnim, maintenant: number) {
  // l'horloge est repartie de zéro : on recommence au début
  if (boulotDepuis !== null && maintenant < boulotDepuis) {
    boulotDepuis = null
    boulotJoue = 0
  }
  if (anim === 'boulot') {
    if (boulotDepuis === null) boulotDepuis = maintenant
  } else if (boulotDepuis !== null) {
    boulotJoue += maintenant - boulotDepuis
    boulotDepuis = null
  }
  return boulotJoue / 1000
}

/** Où en est son déménagement à cet instant (s), pour qu'une bulle le suive. */
const boulotEnCours = (maintenant: number) => (boulotJoue + (boulotDepuis === null ? 0 : maintenant - boulotDepuis)) / 1000

/** Relit où en était son déménagement (une fois par chargement du mod). */
async function relitBoulot($: $) {
  if (boulotLu) return
  boulotLu = true
  const sauve = await $.store.get('boulot')
  if (typeof sauve === 'number' && sauve >= 0) boulotJoue = boulotNote = sauve
}

/** Note où il en est : dès qu'il s'arrête, sinon toutes les 5 s au plus. */
function noteBoulot($: $, maintenant: number) {
  const progres = Math.round(boulotEnCours(maintenant) * 1000)
  if (progres === boulotNote || (boulotDepuis !== null && progres - boulotNote < 5000)) return
  boulotNote = progres
  void $.store.set('boulot', progres).catch(() => {})
}

/** Lance une activité (ou la balade si `null`) pour sa durée naturelle. */
async function occupe($: $, prochaine: { anim: ClawdAnim } | null) {
  finActivite = (await $.clock.now()) + dureeScene(prochaine?.anim ?? 'balade') * 1000
  await update($, activite, () => prochaine)
}

// ------------------------------------------------- réactions aux commandes

const BUILD = /gradlew\S*\s+.*\b(assemble|bundle|build)\w*|flutter\s+build|release\.ps1/i
const TESTS = /gradlew\S*\s+.*\btest\w*|flutter\s+test|pytest|npm\s+(run\s+)?test|plugin\s+test/i
const DEPENDANCES =
  /\b(npm|pnpm|bun)\s+(install|i|ci|add)\b|\byarn(\s+(install|add)\b|\s*$)|\b(flutter|dart)\s+pub\s+(get|add|upgrade)\b|\bpip3?\s+install\b|\buv\s+(sync|add|pip\s+install)\b|\bpoetry\s+(install|add)\b/i
/** Les scènes des commandes qui durent : une demande de permission ne les remplace pas */
const LONGUES: readonly ClawdAnim[] = ['build', 'tests', 'deballe', 'push', 'tel']

async function avantShell($: $, cmd: string) {
  if (BUILD.test(cmd)) return scene($, 'build', LONG)
  if (TESTS.test(cmd)) return scene($, 'tests', LONG)
  if (/\bgit\s+push\b/.test(cmd)) return scene($, 'push', 60_000)
  if (/\badb\b.*\binstall\b/.test(cmd)) return scene($, 'tel', 3 * 60_000)
  if (DEPENDANCES.test(cmd)) return scene($, 'deballe', LONG)
}

async function finEnCours($: $) {
  const p = await read($, passage)
  if (p && LONGUES.includes(p.anim)) await update($, passage, () => null)
}

/** L'action qu'il attendait est faite (ou refusée) : il baisse la patte. */
async function finAttente($: $) {
  const p = await read($, passage)
  if (p?.anim === 'attend') await update($, passage, q => (q?.id === p.id ? null : q))
}

async function apresShell($: $, cmd: string, r: ToolCallResult) {
  if (r.deny !== undefined) return scene($, 'alerte', 5000)
  const ok = r.isError !== true
  if (BUILD.test(cmd) || TESTS.test(cmd) || /\bgit\s+push\b/.test(cmd)) {
    return scene($, ok ? 'fete' : 'triste', ok ? 6000 : 7000)
  }
  if (/\badb\b.*\binstall\b/.test(cmd)) {
    return ok && /Success/.test(r.text ?? '') ? scene($, 'fete', 5000) : scene($, 'triste', 6000)
  }
  if (/\bgit\s+commit\b/.test(cmd) && ok) return scene($, 'ecoute', 2500)
  await finEnCours($)
  if (!ok) return scene($, 'surpris', 3000)
}

/** Le mini-Clawd du sous-agent `agentId` change d'occupation (sans redessin inutile). */
async function copainFait($: $, agentId: string, fait: ClawdCopain['fait']) {
  const equipe = await read($, copains)
  if (!equipe.some(c => c.id === agentId && c.fait !== fait)) return
  await update($, copains, l => l.map(c => (c.id === agentId ? { ...c, fait } : c)))
}

async function shell($: $, cmd: string, agentId: string | undefined, go: () => Promise<ToolCallResult>) {
  await reveil($)
  // une commande d'un sous-agent : c'est son mini-Clawd qui s'y colle
  if (agentId) {
    await copainFait($, agentId, BUILD.test(cmd) || TESTS.test(cmd) ? 'build' : 'marche')
    return go()
  }
  await avantShell($, cmd)
  const r = await go()
  await apresShell($, cmd, r).catch(() => {})
  return r
}

// ------------------------------------------------------------------ hooks

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const ran = await next(e)
    derniereActivite = await $.clock.now()
    // son déménagement reprend où il l'avait laissé à la dernière session
    boulotLu = false
    boulotDepuis = null
    await relitBoulot($)
    // sa couleur suit le modèle qui tourne
    const m = await $.session.model().catch(() => null)
    if (m) await update($, modele, () => m)
    const total = await $.store.get('caresses')
    await update($, caresses, () => (typeof total === 'number' ? total : 0))
    await scene($, 'coucou', 4000)

    $.clock.every(60_000, () => {
      void (async () => {
        if ((await $.clock.now()) - derniereActivite > SOMMEIL_MS && !(await read($, dort))) {
          await update($, activite, () => null)
          await update($, dort, () => true)
        }
      })().catch(() => {})
    })

    // au repos : sa balade, puis une activité au hasard, puis la balade…
    await occupe($, null)
    $.clock.every(2000, () => {
      void (async () => {
        if ((await read($, dort)) || (await read($, passage))) return
        if ((await $.clock.now()) < finActivite) return
        await occupe($, (await read($, activite)) ? null : tirage())
      })().catch(() => {})
    })
    return ran
  })

  on('prompt.submit', async ($, e, next) => {
    await reveil($)
    await occupe($, null)
    const heure = new Date(await $.clock.now()).getHours()
    if (heure >= 1 && heure < 6 && !couchePropose) {
      couchePropose = true
      await scene($, 'nuit', 6000)
    } else {
      await scene($, 'ecoute', 1800)
    }
    return next(e)
  })

  on('tool.call', { tool: 'Bash' }, ($, e, next) => shell($, e.command, e.agentId, () => next(e)))
  on('tool.call', { tool: 'PowerShell' }, ($, e, next) => shell($, e.command, e.agentId, () => next(e)))

  on('tool.call', { tool: /^(Edit|Write|NotebookEdit)$/ }, async ($, e, next) => {
    await reveil($)
    if (e.agentId) await copainFait($, e.agentId, 'ecrit')
    else await scene($, 'ecrit', 3500)
    return next(e)
  })

  on('tool.call', { tool: /^(Read|Grep|Glob|WebSearch|WebFetch)$/ }, async ($, e, next) => {
    await reveil($)
    if (e.agentId) await copainFait($, e.agentId, 'cherche')
    else await scene($, 'cherche', 2500)
    return next(e)
  })

  // Un sous-agent démarre : un mini-Clawd arrive et se met au boulot
  on('classic.SubagentStart', async ($, e, next) => {
    await reveil($)
    await update($, copains, l => [...l.filter(c => c.id !== e.agent_id), { id: e.agent_id, type: e.agent_type, fait: 'marche' as const }])
    return next(e)
  })

  // Il a fini : son mini-Clawd repart, et Clawd lui fait coucou
  on('classic.SubagentStop', async ($, e, next) => {
    const ran = await next(e)
    if ((await read($, copains)).some(c => c.id === e.agent_id)) {
      await update($, copains, l => l.filter(c => c.id !== e.agent_id))
      await scene($, 'coucou', 1500)
    }
    return ran
  })

  on('turn.complete', async ($, e, next) => {
    const ran = await next(e)
    if (e.agentId !== undefined) return ran
    derniereActivite = await $.clock.now()
    if (e.isAborted) await scene($, 'surpris', 4000)
    else if (e.reason === 'error') await scene($, 'triste', 6000)
    else if (e.durationMs > LONG_TOUR_MS) await scene($, 'fete', 6000)
    else {
      const p = await read($, passage)
      // ne pas écraser une fête de build/push qui vient d'arriver
      if (!p || ['cherche', 'ecrit', 'attend', 'question'].includes(p.anim)) await scene($, 'ecoute', 2500)
    }
    return ran
  })

  // La conversation se compacte : il saute sur la pile de feuilles pour la
  // tasser tant que ça dure, puis montre le petit paquet qu'il en a fait
  on('session.compact', async ($, e, next) => {
    // ni les calculs faits d'avance, ni les compactages des sous-agents
    if (e.trigger === 'precompute' || e.agentId !== undefined) return next(e)
    await reveil($)
    const id = await scene($, 'tasse', LONG)
    try {
      const r = await next(e)
      if (r.skip === undefined) {
        // le contexte est redescendu : il pourra de nouveau avoir le vertige
        vertigeMontre = false
        await scene($, 'paquet', 6000)
      } else await update($, passage, p => (p?.id === id ? null : p))
      return r
    } catch (err) {
      await scene($, 'triste', 6000)
      throw err
    }
  })

  // Une action se termine (autorisée ou refusée) : il n'attend plus ta réponse
  on('tool.call', async ($, e, next) => {
    try {
      return await next(e)
    } finally {
      await finAttente($).catch(() => {})
    }
  })

  // Claude attend ta permission : il se tourne vers toi, lève la patte et tape
  // du pied. Une commande qui dure (build, tests…) garde sa scène : le mod ne
  // sait pas quand tu réponds, il resterait la patte levée pendant tout le build.
  on('classic.PermissionRequest', async ($, e, next) => {
    const r = await next(e)
    // une règle a déjà tranché : pas de boîte de dialogue, rien à attendre
    if (r.decision !== undefined || r.block !== undefined) return r
    await reveil($)
    const p = await read($, passage)
    if (!p || !LONGUES.includes(p.anim)) await scene($, 'attend', LONG)
    return r
  })

  // Claude te pose une question : il brandit sa pancarte « ? » jusqu'à ta réponse
  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    await reveil($)
    const id = await scene($, 'question', LONG)
    try {
      return await next(e)
    } finally {
      await update($, passage, p => (p?.id === id ? null : p)).catch(() => {})
    }
  })

  // Le modèle change : sa couleur avec
  on('classic.PostModelSwitch', async ($, e, next) => {
    const ran = await next(e)
    await update($, modele, () => e.to_model)
    return ran
  })

  on('session.measure', async ($, e, next) => {
    const cinqH = e.rateLimits.find(w => w.kind === 'five_hour')?.percentUsed ?? 0
    const épuisé = cinqH >= 90
    if (épuisé !== (await read($, fatigue))) await update($, fatigue, () => épuisé)
    if ((e.context.percent ?? 0) >= 85 && !vertigeMontre) {
      vertigeMontre = true
      await scene($, 'vertige', 6000)
    }
    return next(e)
  })

  // ------------------------------------------------------------ dessin

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const dessous = await next(e)
    const p = await read($, passage)
    const a = await read($, activite)
    const endormi = await read($, dort)
    const épuisé = await read($, fatigue)
    const faits = (await read($, copains)).map(c => c.fait)

    // ce qu'il fait en fond ; des sous-agents tournent : il dirige le chantier
    // (et ne s'endort pas)
    const fond: ClawdAnim =
      faits.length > 0 ? 'chef' : endormi ? 'dodo' : e.props.isWorking ? 'boulot' : épuisé ? 'fatigue' : (a?.anim ?? 'balade')
    // au travail, une petite réaction s'affiche en bulle au-dessus de sa tête :
    // il continue sa scène au lieu de s'interrompre (les grosses gardent la leur)
    const bulle: Bulle | null =
      p && (fond === 'boulot' || fond === 'chef') && (EN_BULLE as readonly ClawdAnim[]).includes(p.anim) ? (p.anim as Bulle) : null
    const anim: ClawdAnim = bulle ? fond : (p?.anim ?? fond)
    const couleur = teinte((await read($, modele)) ?? (await $.session.model().catch(() => null)))
    await relitBoulot($)
    const maintenant = await $.clock.now()
    const deja = reprise(anim, maintenant)
    noteBoulot($, maintenant)
    // la bulle part d'où en est sa scène quand elle apparaît, puis la suit
    if (!bulle || !p) bulleVue = null
    else if (bulleVue?.id !== p.id) bulleVue = { id: p.id, deja: boulotEnCours(maintenant) }

    const caresser = async () => {
      const n = (await update($, caresses, c => c + 1)) ?? 0
      await $.store.set('caresses', n)
      await reveil($)
      await scene($, 'coeur', 3000)
    }
    const occupeToi = async () => {
      await reveil($)
      await update($, passage, () => null)
      await occupe($, tirage())
    }

    // Ce que les autres dessinent (le bandeau d'atelier…) prend toute la
    // largeur ; Clawd se tient à droite, posé sur le bord du bas.
    const { Box, Button } = $.ui.resolve(e)
    const boutons = (
      <Box position="absolute" top={0} left={0} display="none" hover={{ display: 'flex' }} flexDirection="row">
        <Button key="caresse" label="♥" plain onPress={caresser} />
        <Button key="occupe" label="🎲" plain onPress={occupeToi} />
      </Box>
    )

    if (e.surface === 'desktop') {
      const { Svg } = $.ui.resolve(e)
      return (
        <Box flexDirection="row" alignItems="flex-end">
          <Box flexDirection="column" flexGrow={1}>
            {dessous}
          </Box>
          <Box key="clawd" flexShrink={0}>
            <Svg
              source={svgScene(anim, faits, anim === 'boulot' ? deja : 0, couleur)}
              alt={`Clawd : ${anim}${faits.length ? ` (+${faits.length} copains)` : ''}`}
              width={TAILLE.largeur}
              height={TAILLE.hauteur}
            />
            {bulle && bulleVue && (
              // posée sur sa scène, dans son propre dessin : la scène ne redémarre pas
              <Box key="bulle" position="absolute" top={0} left={0}>
                <Svg
                  source={svgBulle(anim, bulle, bulleVue.deja)}
                  alt={`Bulle : ${bulle}`}
                  width={TAILLE.largeur}
                  height={TAILLE.hauteur}
                />
              </Box>
            )}
            {boutons}
          </Box>
        </Box>
      )
    }

    const { Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" alignItems="flex-end">
        <Box flexDirection="column" flexGrow={1}>
          {dessous}
        </Box>
        <Box key="clawd" flexShrink={0} flexDirection="row" alignItems="center">
          {faits.length > 0 && <Text color={couleur.O}>{`${'▪'.repeat(Math.min(faits.length, 5))} `}</Text>}
          {EMOJI[bulle ?? anim] !== '' && <Text dimColor>{`${EMOJI[bulle ?? anim]} `}</Text>}
          <Box flexDirection="column">
            {CLAWD_TEXTE.map(l => (
              <Text color={couleur.O}>{l}</Text>
            ))}
          </Box>
          {boutons}
        </Box>
      </Box>
    )
  })
}
