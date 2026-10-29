# atelier

A project band above the Claude Code prompt for Android developers, plus
guardrails on shell commands. The interface is in French.

Unofficial, fan-made project by mesix971. Not affiliated with or endorsed by
Anthropic.

## The band

- 📱 The app version declared in the project (Gradle script, `pubspec.yaml` or
  `version.properties`), the last APK built and the version installed on the
  connected phone, with **Install** and **Launch** buttons.
- 🌿 Git: branch, changes, commits ahead or behind, with **Commit + push**,
  **Pull** and **Push** buttons.
- Gauges for the 5-hour and 7-day quotas and for the context window. On hover,
  each one projects when you will reach 100 % at the current pace.
- The live cost of the turn at API prices, in euros.
- Model advice: Claude Haiku reads each request you type and suggests a model
  and an effort level when they differ from what is running.
- Claude's task list, its subagents and Gradle or Flutter builds, as small
  pills.
- 🆕 opens a new conversation.

## Guardrails

- It asks before destructive commands (`pm clear`, `uninstall`,
  `connectedAndroidTest`, force push, `reset --hard`…).
- It also asks before secrets (`local.properties`, keystores,
  `google-services.json`, `.env`) go into a commit or a push, and before a
  push you did not ask for.
- It refuses `bash` launched from PowerShell, and foreground waits of 20
  seconds or more.
- It finds adb and Android Studio's JBR by itself. It rewrites a command that
  points to a broken JBR, and adds `JAVA_HOME` to `gradlew` when it is missing.
- If Claude answers in English, it adds a short reminder to the next turn to
  answer in French.

`/tel` installs the latest APK; `/atelier` shows or hides the band.

## Install

```bash
claude plugin marketplace add mesix971/mods-claude
claude plugin install atelier@mods-claude
```

Requires Claude Code 2.1.287 or later (mods).

## What it reads, runs and sends

- **Local commands**:
  - `git`: status, remote and diff. Commit, push and pull run only when you
    press their buttons; push and pull talk to your git remote.
  - `adb`: lists devices and packages and reads the installed version
    (`dumpsys`). Install and launch run only when you press their buttons
    or type `/tel`.
- **Files and environment**: it reads project files to find the app version,
  lists folders to locate adb and the JBR, and reads `ANDROID_HOME`,
  `ANDROID_SDK_ROOT`, `JAVA_HOME`, `LOCALAPPDATA` and your home folder path.
- **Model calls**: one call to Claude Haiku through Claude Code per request you
  type, for the model advice. That is a few hundred tokens on your Claude
  account. Routines, other sessions, plugins and a hidden band make no call.
- **Session figures**: the quota and cost figures that Claude Code provides.
  It makes no other network request, and keeps its state in Claude Code's
  plugin state.

## License

MIT. The "breathing" orb comes from
[thinking-orbs](https://github.com/Jakubantalik/thinking-orbs) by Jakub
Antalik (MIT); its notice is in `hooks/orbe.ts`.
