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
- With **Clawd** from the same marketplace, a tiny pixel-art Claude lives at
  the end of the band and plays short gags across it (he steals the loading
  orb, makes the pills pop like popcorn), then puts everything back. Each mod
  also works on its own.

## Guardrails

- It asks before destructive commands (`pm clear`, `uninstall`,
  `connectedAndroidTest`, force push, `reset --hard`…).
- It also asks before secrets (`local.properties`, keystores,
  `google-services.json`, `.env`) go into a commit or a push, and before a
  push you did not ask for.
- It refuses `bash` or `wsl` launched from PowerShell, and PowerShell
  foreground waits (`Start-Sleep`) of 20 seconds or more.
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

## What it runs, sends and reads

### Programs it runs

Only `git` and `adb`, each with fixed arguments:

- `git status --porcelain=v1 -b` and `git remote`, to draw the git line of the
  band, and `git diff HEAD -U0` on the version files you changed (Gradle
  script, `pubspec.yaml`…), to spot a version bump without a changelog entry.
- Before a `git commit` or `git push` that Claude runs: `git ls-files`,
  `git ls-files --others --exclude-standard` and `git diff --name-only` (staged
  or not), to list the files it would send and warn you about secrets.
- Every git call uses `--no-optional-locks`, so it never locks your repository.
- `adb devices -l`, then on the phone `date`, `pm list packages` and
  `dumpsys package`, to read the installed version.
- `adb install -r` with the latest APK, only when you press **Install** or
  type `/tel`.
- `adb shell monkey -p <package> -c android.intent.category.LAUNCHER 1`, only
  when you press **Launch**.

### What it sends, and where

- **To Claude Haiku, through Claude Code**: for the model advice, each request
  you type (its first and last 1,000 characters when it is longer than 2,000
  characters). It also sends the project type, the number of open plan steps,
  whether the last build failed, the number of running subagents and whether
  your quota is tight. That is a few hundred tokens on your Claude account.
  Requests under 25 characters, slash commands, routines, other sessions,
  plugins and a hidden band send nothing.
- **To Claude, as if you typed it**: the **Commit + push**, **Commit**,
  **Pull** and **Push** buttons each submit one fixed request, written in
  French. It asks Claude to commit, pull or push, and to check that a push or
  a pull went through. Nothing from the conversation is added. Claude then
  runs git with its usual permissions, and push and pull talk to your git
  remote.
- **Slash commands**: 🆕 runs `/suite` when a command with that name exists
  (yours or another plugin's). Otherwise it asks you first, then runs
  `/clear`.

It makes no network request of its own. `www.w3.org` appears in its code only
as the namespace of its SVG drawings.

### What its hooks change

- **Bash and PowerShell commands**: it rewrites a command in two cases, plus a
  third with the `garde_fou_ok` option below.
  - A path to a broken Android Studio JBR is replaced with the working one.
  - A `gradlew` command gets `JAVA_HOME` set to that JBR when yours is missing
    or broken.
- **Option `garde_fou_ok`** (off by default): for a guard script of your own
  that reads `GARDE_FOU_OK=1`.
  - When it is on, a command that sets this flag (`GARDE_FOU_OK=1 …`,
    `export GARDE_FOU_OK=1; …`, or `$env:GARDE_FOU_OK = 1` in PowerShell)
    skips atelier's secrets check. After you approve secret files in its
    dialog, atelier adds the flag to that command.
  - When it is off, atelier ignores the flag and never adds it.
  - Set it in `/config`. It is a JSON boolean: a value of another type written
    by hand in `settings.json` stops atelier from loading, guardrails
    included.
- It refuses `bash` or `wsl` launched from PowerShell, and PowerShell
  foreground waits of 20 seconds or more, and tells Claude why.
- It asks you in a dialog before a destructive command, before secret files go
  into a commit or a push, and before a push you did not ask for. It never
  approves anything for you: a command it lets through still goes through
  Claude Code's own permission checks.
- **Your prompts** go on unchanged, except after an answer in English. The next
  prompt then carries one line of context that asks Claude to answer in
  French.
- **Subagent launches** go on unchanged. It only reads the new agent's type,
  task description, id and model, for its pill on the band.
- `/tel` and `/atelier` are its own commands, and its own hooks answer them.

### What it reads

- The project files that hold the app version (Gradle scripts,
  `pubspec.yaml`, `version.properties`, `gradle.properties`), the APK output
  folder, and the folders where adb and Android Studio's JBR usually live.
- The environment variables `ANDROID_HOME`, `ANDROID_SDK_ROOT`, `JAVA_HOME`,
  `LOCALAPPDATA`, `HOME` and `USERPROFILE`, only to find adb and the JBR.
- The quota, context and cost figures that Claude Code provides, and Claude's
  task list and subagents, for the band.
- The output of the build commands it follows, to tell a success from a
  failure, and the text of Claude's answers, to spot one in English.
- Its own `plugin.json`, for its version.

It stores and sends no token, password or key: it reads `gradle.properties`
only for the app version. Those words appear in its code only to mask secrets
in the commands it shows on the band, and to spot secret files before a
commit. It writes no file, and keeps its state in Claude Code's plugin state.

## License

MIT. The "breathing" orb comes from
[thinking-orbs](https://github.com/Jakubantalik/thinking-orbs) by Jakub
Antalik (MIT); its notice is in `hooks/orbe.ts`.
