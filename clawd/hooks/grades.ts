// Ses grades et ses hauts faits : ce que son niveau veut dire (Apprenti,
// Compagnon… Légende), et ce que vous avez vécu ensemble (une première
// délivrance, 1 000 outils lancés, une semaine de suite…). Des tables de
// données : register.tsx les lit (la cérémonie d'un grade, l'annonce d'un
// haut fait, /clawd et son livret). Un haut fait nouveau : une ligne dans
// FAITS.

/** Ses grades, du premier au plus haut : le niveau où il le devient, et son nom */
export const GRADES: readonly { niveau: number; nom: string }[] = [
  { niveau: 1, nom: 'Apprenti' },
  { niveau: 5, nom: 'Compagnon' },
  { niveau: 10, nom: 'Artisan' },
  { niveau: 20, nom: 'Maître' },
  { niveau: 30, nom: 'Grand Maître' },
  { niveau: 50, nom: 'Légende' },
]

/** Son grade au niveau `n` (null : pas encore de grade) */
export const gradeDe = (n: number) => [...GRADES].reverse().find(g => n >= g.niveau)?.nom ?? null

/** Le prochain grade après le niveau `n`, et le niveau qu'il faut (null : il les a tous) */
export const prochainGrade = (n: number) => GRADES.find(g => g.niveau > n) ?? null

/** Ce qu'il a compté de votre vie commune (gardé d'une session à l'autre), et le moment présent */
export type Comptes = {
  /** outils lancés ensemble (les tiens et ceux de tes sous-agents) */
  outils: number
  sessions: number
  caresses: number
  /** séries d'échecs enfin passées (sa délivrance) */
  delivrances: number
  /** la plus longue série d'échecs qu'il a vue se réparer */
  pireSerie: number
  /** pushs réussis aujourd'hui */
  pushsDuJour: number
  /** jours de suite ensemble, et le record */
  serie: number
  meilleureSerie: number
  /** jours depuis son adoption (la première fois qu'il t'a vu) */
  joursEnsemble: number
  /** l'heure (0 à 23) */
  heure: number
}

/** Un haut fait : son nom, son emoji, sa rareté, et quand il est gagné (d'après ce qu'il a compté) */
export type Fait = { id: string; titre: string; emoji: string; rarete: 'commun' | 'rare' | 'épique' | 'légendaire'; gagne: (c: Comptes) => boolean }

/** Ses hauts faits, des plus courants aux plus rares */
export const FAITS: readonly Fait[] = [
  { id: 'noctambule', titre: 'Noctambule : une session entre 2 h et 5 h du matin', emoji: '🦉', rarete: 'commun', gagne: c => c.heure >= 2 && c.heure < 5 },
  { id: 'mille-outils', titre: '1 000 outils lancés ensemble', emoji: '🧰', rarete: 'commun', gagne: c => c.outils >= 1000 },
  { id: 'delivrance', titre: 'Première délivrance : une série d’échecs enfin passée', emoji: '🎆', rarete: 'commun', gagne: c => c.delivrances >= 1 },
  { id: 'un-mois', titre: 'Un mois ensemble', emoji: '📅', rarete: 'rare', gagne: c => c.joursEnsemble >= 30 },
  { id: 'semaine', titre: 'Une semaine de suite ensemble', emoji: '🔥', rarete: 'rare', gagne: c => c.serie >= 7 },
  { id: 'pushs', titre: 'Dix pushs dans la journée', emoji: '🚀', rarete: 'rare', gagne: c => c.pushsDuJour >= 10 },
  { id: 'cent-caresses', titre: 'Cent caresses', emoji: '💗', rarete: 'rare', gagne: c => c.caresses >= 100 },
  { id: 'cent-sessions', titre: 'Cent sessions ensemble', emoji: '🗓', rarete: 'rare', gagne: c => c.sessions >= 100 },
  { id: 'phenix', titre: 'Phénix : cinq échecs d’affilée, puis la réparation', emoji: '🐦‍🔥', rarete: 'épique', gagne: c => c.pireSerie >= 5 },
  { id: 'dix-mille-outils', titre: '10 000 outils lancés ensemble', emoji: '🏗', rarete: 'épique', gagne: c => c.outils >= 10_000 },
  { id: 'mois-de-suite', titre: 'Un mois de suite ensemble', emoji: '🌋', rarete: 'légendaire', gagne: c => c.serie >= 30 },
  { id: 'anniversaire', titre: 'Un an ensemble', emoji: '🎂', rarete: 'légendaire', gagne: c => c.joursEnsemble >= 365 },
]

/** Les hauts faits gagnés d'après ce qu'il a compté, qu'il n'avait pas encore (`deja` : leurs id) */
export const nouveauxFaits = (c: Comptes, deja: ReadonlySet<string>) => FAITS.filter(f => !deja.has(f.id) && f.gagne(c))
