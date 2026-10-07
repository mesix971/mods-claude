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
}

declare module 'claude-code' {
  interface PluginState {
    atelier: {
      android: AtelierAndroid | null
      git: AtelierGit | null
      usage: AtelierUsage | null
      /** Avance d'un cran par minute, pour redessiner le bandeau */
      minute: number
      busy: string | null
      isHidden: boolean
    }
  }
}
