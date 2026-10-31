// Contrat d'état du mod clawd : ce que le dessin lit.

/** Toutes les scènes que Clawd sait jouer. */
export type ClawdAnim =
  // au repos : sa balade chorégraphiée, et les activités tirées au sort
  | 'repos'
  | 'balade'
  | 'coucou'
  | 'danse'
  | 'jongle'
  | 'cafe'
  | 'lecture'
  | 'etirement'
  | 'corde'
  | 'bulles'
  | 'peche'
  | 'yoyo'
  | 'guitare'
  | 'arrosage'
  | 'ballon'
  | 'papillon'
  | 'promenade'
  | 'pirouette'
  // ses danses : clins d'œil aux emotes qu'on connaît (la danse du fil, le déhanché…) et au 6-7
  | 'floss'
  | 'orange'
  | 'defaut'
  | 'griddy'
  | 'takel'
  | 'sixseven'
  | 'gratte'
  | 'meditation'
  | 'cookie'
  | 'glace'
  // en réaction à la session
  | 'ecoute'
  | 'boulot'
  | 'marche'
  | 'ecrit'
  | 'cherche'
  | 'build'
  | 'tests'
  | 'push'
  | 'tel'
  | 'copain'
  | 'chef'
  // trois sous-agents ou plus : le chef sort son sifflet
  | 'sifflet'
  | 'fete'
  | 'triste'
  // une série d'échecs : il se décourage ; quand ça passe enfin, la délivrance
  | 'decourage'
  | 'delivrance'
  | 'alerte'
  | 'surpris'
  // Halloween : un commit réussi, il lâche un bonbon
  | 'bonbon'
  // le vendredi soir, il se détend sur un carton ; le lundi matin, il bâille
  | 'detente'
  | 'baille'
  | 'dodo'
  | 'fatigue'
  | 'vertige'
  // quand la conversation se compacte : il tasse la pile, puis montre le paquet
  | 'tasse'
  | 'paquet'
  // Claude attend ta permission, te pose une question, installe des dépendances
  | 'attend'
  | 'question'
  | 'deballe'
  // de temps en temps pendant ses cartons, il en fait autre chose : un diable à ressort en jaillit, des cartons
  // gigognes jusqu'à un tout petit cœur, il en joue comme d'un tambour, il monte dessus et le carton cède
  | 'colis'
  | 'gigogne'
  | 'tambour'
  | 'podium'
  | 'coeur'
  | 'nuit'
  // le premier réveil de la journée : bâillement, étirement, café
  | 'reveil'
  // deux heures de travail sans pause : il t'apporte un verre d'eau et s'étire
  | 'pause'
  // un sous-agent a fini : son mini-Clawd vient rendre son travail au chef
  | 'rapport'
  // un conflit git : il se cache derrière un carton, puis ressort soulagé quand c'est résolu
  | 'cache'
  | 'soulage'
  // le matin, il se souvient du moment fort de la veille : une victoire (souvenir), une galère pas finie (revanche)
  | 'souvenir'
  | 'revanche'
  // git : un pull qui ramène des nouveautés (un colis), une branche nouvelle (son drapeau)
  | 'livraison'
  | 'drapeau'
  // tu reviens après une longue absence : il t'a attendu (8 h), il saute de joie (un jour et demi)
  | 'attendu'
  | 'retrouvailles'
  // une visite rare au repos : un chat traverse sa scène (le jour), une étoile filante (le soir)
  | 'chat'
  | 'filante'
  // il monte de niveau : une étoile d'or lui tombe du ciel, il l'attrape, saute de joie, et son insigne change
  | 'niveau'

/** Une scène jouée par Clawd. */
export type ClawdScene = { anim: ClawdAnim }

/** Réaction passagère : elle s'efface toute seule au bout de quelques secondes. */
export type ClawdPassage = ClawdScene & { id: number }

/** Un sous-agent en cours, représenté par un mini-Clawd qui mime ce qu'il fait. */
export type ClawdCopain = {
  id: string
  type: string
  fait: 'marche' | 'cherche' | 'ecrit' | 'build'
  /** Le modèle de son sous-agent (sa couleur en dépend), s'il est connu */
  modele?: string
  /** Quand il est arrivé (pour reconnaître un mini dont le sous-agent est fini sans le dire) */
  depuis?: number
  /** Un agent de workflow : jamais dans `$.agent.list`, il attend son SubagentStop */
  workflow?: true
}

/**
 * Un élément de la bande d'atelier (sa bande partagée, `atelier.scene`) :
 * une jauge, la conso, une pastille (tâche, sous-agent, build), à sa place
 * dans le dessin (x et largeur en px CSS depuis le bord gauche de la bande,
 * `ligne` comptée depuis le bas). `etat` : `attente`, `encours` (l'orbe),
 * `faite`, `echec` ; pour une jauge son niveau ; pour la conso `ok` ou `lourde` ;
 * pour le bouton 🆕 (`nouvelle`, toujours publié) et le bouton Installer de la
 * ligne 📱 (`installer`, quand il est là) `a-montrer` ou `repos`.
 */
export type ElementBande = {
  id: string
  genre: 'jauge' | 'conso' | 'conseil' | 'tache' | 'agent' | 'build' | 'bouton'
  etat: string
  x: number
  largeur: number
  ligne: number
  /** Sa rangée en px (publiée par atelier) : `bas` du bas de la bande au bas de la rangée, `rangee` sa hauteur ; sinon au pas fixe de LIGNE */
  bas?: number
  rangee?: number
  teinte?: string
  /** La hauteur (px CSS) où atelier pose son dessin (18 par défaut) : `x` et `largeur` sont à la même échelle */
  hauteur?: number
  /** Son dessin seul, tel qu'atelier le dessine (un SVG de largeur × 18), pour le promener à l'identique ; absent pour l'orbe en cours */
  dessin?: string
}

/** Ce qu'atelier dessine sur la bande, ligne par ligne, et où (lu, jamais écrit) */
export type SceneBande = { lignes: string[]; elements: ElementBande[] }

/**
 * Un numéro sur toute la bande (bande.ts) : son nom, ce qu'il vise, ce qu'il
 * a vu sur la bande en commençant (le dessin n'en dépend plus ensuite), et
 * quand il commence et finit (ms).
 */
export type ClawdNumero = {
  id: number
  nom: string
  cibles?: ElementBande[]
  elements: ElementBande[]
  debut: number
  fin: number
  largeur?: number
  depart?: number
  /** Sa variante, tirée au sort au lancement (entre 0 et 1) : ses pas en tirent leurs variations */
  variante?: number
  /** Ce qu'il vient voir : l'id d'un élément qui vient de changer (une réaction) */
  vise?: string
  /** Ses minis dans le coin quand il a commencé (la couleur de chacun, null : la sienne) : ceux qui ne jouent pas regardent */
  figurants?: (string | null)[]
  /** L'id du sous-agent de chacun de ces minis, dans le même ordre : chacun va à SA pastille */
  minis?: string[]
}

declare module 'claude-code' {
  interface PluginState {
    clawd: {
      passage: ClawdPassage | null
      /** Activité tirée au sort quand rien ne se passe */
      activite: ClawdScene | null
      dort: boolean
      fatigue: boolean
      caresses: number
      /** Sous-agents en cours (un mini-Clawd chacun) */
      copains: ClawdCopain[]
      /** Le modèle qui tourne (sa couleur en dépend), null tant qu'on ne l'a pas lu */
      modele: string | null
      /** Le numéro qu'il joue sur toute la bande, s'il en joue un */
      numero: ClawdNumero | null
      /** Son mot de la nuit, pas encore lu : une bulle 💬 au-dessus de lui, qui le montre quand tu cliques */
      mot: { id: string; date: string; message: string } | null
      /**
       * Ce qu'il tient en ce moment : le nom de l'élément d'atelier, jusqu'à
       * quand au plus (ms ; passé ce temps, atelier le redessine, même si Clawd
       * a planté) et le numéro qui le tient
       */
      emprunts: { id: string; jusqua: number; numero: number }[]
      /**
       * Le dessin de son numéro, préparé une fois : atelier le pose par-dessus
       * toute la bande (sa rangée est la seule à la couvrir), recalé à chaque
       * dessin d'après son début (ms) : la racine du SVG porte `--t0:0s`, que
       * tout le dessin suit (l'app recrée l'image quand la bande change)
       */
      grandeScene: { id: number; svg: string; hauteur: number; debut: number; fin: number } | null
      /** Son coup d'œil : quelque chose vient de changer sur la bande, ses yeux s'y tournent (à sa gauche, ou au-dessus de lui) jusqu'à `jusqua` (ms) */
      regard: { vers: 'gauche' | 'haut'; jusqua: number } | null
      /** Claude agit sans te demander (mode auto ou bypass) : il porte sa visière de pilote automatique */
      pilote: boolean
      /** Le contexte se remplit : 0 rien, 1 une goutte de sueur (la moitié), 2 deux gouttes et les joues rouges (70 %) */
      sueur: 0 | 1 | 2
      /** Son niveau, d'après son expérience (gardée d'une session à l'autre) : l'insigne sur son ventre en dépend */
      niveau: number
    }
    /** La bande partagée d'atelier, l'autre mod du dépôt (il l'écrit, Clawd la lit) */
    atelier: {
      scene: SceneBande | null
      /** Son bandeau masqué (bouton « Masquer ») : /atelier le ré-affiche */
      isHidden: boolean
    }
  }
}
