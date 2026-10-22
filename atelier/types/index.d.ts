// Contrat d'état du mod atelier : ce que le bandeau lit.

export type AtelierAndroid = {
  /** applicationId lu dans le build.gradle(.kts) */
  appId: string | null
  /** versionName / versionCode déclarés (gradle ou pubspec) */
  versionName: string | null
  versionCode: number | null
  /** Dernier APK construit (hors androidTest) */
  apk: { path: string; name: string; version: string | null; mtimeMs: number } | null
  /** Téléphone branché (premier appareil adb en état "device") */
  device: { serial: string; model: string } | null
  /** Ce qui est installé sur le tel, null si absent */
  installed: { pkg: string; versionName: string; versionCode: number; updatedMs: number | null } | null
  /** Vrai quand l'APK est plus récent ou d'une autre version que l'install */
  isPhoneStale: boolean
}

export type AtelierGit = {
  branch: string
  changed: number
  ahead: number
  hasUpstream: boolean
  hasRemote: boolean
  /** Alertes de cohérence version/CHANGELOG */
  warnings: string[]
}

export type AtelierUsage = {
  fiveHour: { percent: number; resetsAt?: string } | null
  sevenDay: { percent: number; resetsAt?: string } | null
  contextPercent: number | null
  /** Les tokens du contexte et la taille de sa fenêtre, quand le moteur les donne */
  contextTokens?: number
  contextWindow?: number
}

/** Une étape de la liste de tâches de Claude, dessinée en pastille sous les jauges */
export type AtelierTache = {
  /** `plan-2` (liste de l'app desktop), `task-7` (TaskCreate), `todo-1` (TodoWrite) */
  id: string
  /** Ce que l'étape fait : affiché au survol de sa pastille */
  nom: string
  etat: 'attente' | 'encours' | 'faite'
  /** Quand elle a commencé, quand elle s'est finie (ms), pour le minuteur du survol */
  debut?: number
  fin?: number
}

/** Les 4 compteurs de tokens d'une réponse de l'API, ou leur somme */
export type AtelierTokens = {
  /** Entrée hors cache */
  entree: number
  /** Relus depuis le cache */
  lu: number
  /** Écrits dans le cache */
  ecrit: number
  /** Générés */
  sortie: number
}

/** Ce que consomme la session, tour par tour, et ce que ça coûterait au tarif de l'API */
export type AtelierConso = {
  /** Le tour en cours, ou le dernier fini */
  tour: {
    tokens: AtelierTokens
    /** En dollars, d'après /cost (le moteur), sinon estimé avec la grille de prix */
    dollars: number
    estime: boolean
    enCours: boolean
    /** Le prompt de la dernière réponse de la conversation principale (entrée + cache) */
    dernierPrompt: number
    /** Ce que la conversation principale a relu pendant le tour (la somme de ses prompts), et en combien de requêtes */
    relu?: number
    requetes?: number
  } | null
  session: { tokens: AtelierTokens; dollars: number; estime: boolean }
  /** Le coût de la session (/cost) au début du tour, pour en déduire celui du tour */
  coutDebut: number | null
  /**
   * Il est temps de changer de conversation : allumé à la fin du premier tour
   * qui gâche trop, il le reste tant que le contexte reste gros (un petit tour
   * ne l'éteint pas) ; éteint quand le contexte redescend (conversation neuve)
   */
  signale?: boolean
  /** La somme estimée du tour (grille de prix), quand /cost manque */
  estimeTour: number
}

/** Le dernier build (gradlew, flutter), en pastille */
export type AtelierBuild = {
  /** Ce qui est construit, en court (« assembleDebug ») */
  quoi: string
  debut: number
  fin?: number
  etat: 'encours' | 'ok' | 'echec' | 'fini'
  /** La tâche qui a échoué et la première erreur, au survol */
  detail?: string
  /** Lancé en tâche de fond : son id, le fichier où s'écrit sa sortie, et sa commande (pour le retrouver) */
  fond?: { id: string; sortie: string | null; commande?: string }
}

/** Un sous-agent lancé par Claude, en pastille à la couleur de son modèle */
export type AtelierAgent = {
  id: string
  /** Son type (« eclaireur », « relecteur », « general-purpose »…) */
  type: string
  /** Sa mission, en quelques mots */
  mission: string
  modele: string
  debut: number
  fin?: number
  etat: 'encours' | 'faite' | 'interrompu'
  /** Pourquoi il s'est arrêté avant la fin */
  cause?: 'interruption' | 'erreur' | 'refus'
  /** Le sonar : combien d'outils il a lancés, les derniers instants où il en a lancé un, et le dernier */
  appels?: number
  pings?: number[]
  dernierOutil?: string
}

/** Un élément du bandeau qu'un autre mod du dépôt (Clawd) peut viser */
export type AtelierElement = {
  /** `jauge-5h`, `jauge-7j`, `jauge-contexte`, `conso`, `conseil` (la puce 💡 du conseil de modèle), `tache-<id>`, `agent-<id>`, `build`, `nouvelle` (le bouton 🆕, quand il est temps de changer de conversation) */
  id: string
  genre: 'jauge' | 'conso' | 'conseil' | 'tache' | 'agent' | 'build' | 'bouton'
  /**
   * Ce qu'il montre : `attente` (le rond en pointillé), `encours` (l'orbe),
   * `faite` (la coche), `echec` (la croix) ; pour une jauge son niveau (`ok`,
   * `attention`, `critique`) ; pour la conso `ok` ou `lourde` ; pour le bouton
   * 🆕 `a-montrer` (il n'est publié que quand il est temps de le montrer)
   */
  etat: string
  /** Sa place dans le dessin desktop : en px CSS depuis le bord gauche du bandeau */
  x: number
  largeur: number
  /** Sa ligne, comptée depuis le bas du bandeau (0 : la dernière) */
  ligne: number
  /** La couleur d'un sous-agent (son modèle) */
  teinte?: string
  /** La hauteur (px CSS) où son dessin est posé : `x` et `largeur` sont à la même échelle */
  hauteur?: number
  /**
   * Son dessin seul, tel qu'atelier le dessine, sans infobulle : un SVG de
   * `largeur` × 18 (viewBox `0 0 largeur 18`), pour qu'un autre mod le
   * promène à l'identique ; absent pour l'orbe en cours (trop lourde)
   */
  dessin?: string
}

/** La bande partagée : ce qu'atelier dessine, ligne par ligne, et où */
export type AtelierScene = {
  /** Les lignes du bandeau, de haut en bas */
  lignes: ('android' | 'git' | 'quotas' | 'pastilles' | 'occupe')[]
  elements: AtelierElement[]
}

declare module 'claude-code' {
  interface PluginState {
    atelier: {
      android: AtelierAndroid | null
      git: AtelierGit | null
      usage: AtelierUsage | null
      /** La liste de tâches de Claude, dans l'ordre (vide : pas de pastilles) */
      taches: AtelierTache[]
      conso: AtelierConso | null
      build: AtelierBuild | null
      agents: AtelierAgent[]
      /** La bande partagée, pour Clawd : ce que le bandeau dessine et où (null : rien, ou masqué) */
      scene: AtelierScene | null
      /** Le dernier conseil de modèle (Haiku a lu la demande) : le modèle et l'effort qui suffisent, et pourquoi */
      conseil: { modele: 'haiku' | 'sonnet' | 'opus' | 'fable'; effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max'; raison: string } | null
      /** Ce qui tourne : le modèle et l'effort des requêtes de la conversation, notés à chaque requête */
      reglage: { modele: string | null; effort: string | null } | null
      /** L'heure où le dernier tour de Claude a fini (null pendant un tour, ou avant le premier) */
      finDuTour: number | null
      /** Avance d'un cran par minute, pour redessiner le bandeau */
      minute: number
      busy: string | null
      isHidden: boolean
    }
    /** Le contrat de Clawd (l'autre mod du dépôt), qu'atelier lit seulement */
    clawd: {
      /** Ce qu'il tient en ce moment, chacun jusqu'à une échéance (ms) : atelier ne le dessine plus jusque-là */
      emprunts: { id: string; jusqua: number }[]
      /** Le numéro qu'il joue sur toute la bande : son dessin (SVG), sa hauteur (px) et sa fin (ms) */
      grandeScene: { svg: string; hauteur: number; fin: number } | null
    }
  }
}
