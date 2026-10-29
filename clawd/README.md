# Clawd

A tiny pixel-art Claude who lives above your prompt and silently acts out your
Claude Code session, in 73 animated scenes and no text.

Unofficial, fan-made project by mesix971. Not affiliated with or endorsed by
Anthropic.

## What he does

- At rest, he walks around and keeps himself busy: coffee, guitar, fishing,
  juggling, reading, dancing. His mood (energy, boredom, joy) picks what. At
  night, he sleeps until you come back.
- While Claude works, he moves boxes from one pile to the other, with a thought
  bubble showing what Claude is doing. Now and then a box falls from the sky
  and he opens it instead: a jack-in-the-box, nesting boxes, a drum solo, a
  podium that gives way under him.
- Big moments get their own scene: a hammer during builds, a checklist during
  tests, a paper plane for pushes, confetti when it passes, a rain cloud when
  it breaks, stamping on a pile of paper during compaction, a raised paw while
  a permission is waiting.
- Each subagent arrives as a mini-Clawd in its model's color and mimes what its
  agent does. When it finishes, it hands its work back and leaves in one of
  five ways.
- He sweats as the context fills up, wears an autopilot visor in auto or
  bypass mode, and earns experience from tool calls: each new level drops a
  star from the sky, and the medal on his belly upgrades at levels 1, 5, 10
  and 20.
- With the atelier mod from the same marketplace, he plays short gags across
  its band (he steals the loading orb, makes the pills pop like popcorn) and
  always puts everything back.

Hover him for ♥ (pet), 🎲 (new activity), 🕺 (dance) and ⭐ (level).
`/clawd` shows his level and mood, `/clawd montre <scene>` plays a scene, and
`/clawd voit` explains what he sees on atelier's band (the keywords and
replies are in French).

## Install

```bash
claude plugin marketplace add mesix971/mods-claude
claude plugin install clawd@mods-claude
```

Requires Claude Code 2.1.287 or later (mods). The full animation shows in the
desktop app's Code tab; the terminal gets a block logo, an emoji for what he is
doing, and one ▪ per subagent.

## What it reads, runs and stores

Clawd makes no model calls and no network requests, and launches no
processes. It follows session events: tool calls and their results (to tell a
passing build from a failing one), your prompts, subagents, compaction and
permission requests. It reads what Claude Code provides: the current model,
the permission mode, the context and rate-limit figures, the list of
subagents, and the band published by atelier. It keeps its petting count,
experience, mood and a few dates (such as your last visit) in the plugin
store. Command replies are in French; the drawing itself has no text.

It never reads the text of your prompts or of Claude's answers. Its hooks
never change what Claude does: prompts, tool calls, subagent launches and
permission requests go on unchanged. The permission-request hook decides
nothing: it
raises his paw while the dialog waits, then passes the request on as it
came. The subagent hook reads the new agent's id and model, to give its
mini-Clawd the right color. It reads no credential, and `www.w3.org` appears
in its code only as the namespace of the SVG drawings.

All 73 scenes are shown in the [project's README](https://github.com/mesix971/mods-claude#clawd).

## License

MIT
