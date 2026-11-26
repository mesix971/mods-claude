// Le thème de l'app aux couleurs de Clawd : son terracotta en accent, des
// gris chauds tirés de sa teinte (la nuit au coin de son feu, le jour sur du
// papier crème). Des données seulement : l'app les peint (bureau et mobile).
import type { ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'

// (ses propres couleurs, `PAL` dans sprite.ts : son orange, son rouge, son vert, son jaune foncé, son lilas)
const { theme, problems } = makeColors({
  label: 'Clawd',
  roles: { accent: '#D97758', danger: '#E5484D', success: '#4CC38A', warning: '#E0A030', pro: '#C39BFF' },
  light: {
    gray: {
      anchors: {
        'surface-0': '#f1e7dc',
        'surface-1': '#f6eee5',
        'surface-2': '#fbf6f0',
        'text-primary': '#2b1f1a',
        'text-secondary': '#55443b',
        'text-muted': '#6d5a50',
      },
    },
  },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#1c1614',
        'surface-1': '#241d1a',
        'surface-2': '#2c2420',
        'surface-3': '#342a26',
        'text-primary': '#f3e8e0',
        'text-secondary': '#d3c3b8',
        'text-muted': '#ae9d92',
      },
    },
  },
})

/** Son thème entier (ses couleurs, et son feu de camp en fond : fond.ts), et ce que le système de design en dit (une ligne « Desktop won't paint » : l'app l'ignorerait) */
export const THEME_CLAWD: ThemeSetArgs = { colors: theme, backdrop: { scene: 'feu' } }
export const PROBLEMES_THEME: readonly string[] = problems
