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
  } | null
  session: { tokens: AtelierTokens; dollars: number; estime: boolean }
  /** Le coût de la session (/cost) au début du tour, pour en déduire celui du tour */
  coutDebut: number | null
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
      /** L'heure où le dernier tour de Claude a fini (null pendant un tour, ou avant le premier) */
      finDuTour: number | null
      /** Avance d'un cran par minute, pour redessiner le bandeau */
      minute: number
      busy: string | null
      isHidden: boolean
    }
  }
}
