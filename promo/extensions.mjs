// Node ne résout pas un import relatif sans extension (`./sprite`), que le
// moteur de Claude Code accepte : ce crochet lui ajoute « .ts » quand le
// fichier existe. vitrine.mts l'enregistre pour charger bande.ts.
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export async function resolve(specifier, context, nextResolve) {
  if (/^\.{1,2}\//.test(specifier) && !/\.[a-z]+$/i.test(specifier) && context.parentURL) {
    const url = new URL(`${specifier}.ts`, context.parentURL)
    if (existsSync(fileURLToPath(url))) return nextResolve(url.href, context)
  }
  return nextResolve(specifier, context)
}
