# Environment

I use Nix & `direnv`. Glance `flake.nix` initially at once.

# Git

- Commit regularly.
- Prefer subsystem-first commit subjects over Conventional Commits.
  - Use `subsystem: concise change`.
  - Do not default to `feat(...)`, `fix(...)`, `chore(...)`, etc.
  - Pick the subsystem people would search for later: `cli`, `state`, `tui`, `api`, `docs`, `nix`, `test`, or a narrower module when useful.
- Keep messages compact.
  - A good small commit can be only a subject line.
  - Add a body when the reason, tradeoff, or implementation detail matters.
  - Body bullets should explain why/how, not repeat the subject.
- Prefer backticks for paths, commands, package names, settings, and other literal identifiers when they improve scanability.

```text
cli: render activity as square heatmap

- use one colored square per day instead of intensity glyphs
- keep empty days visible as gray cells
- orient the grid by week columns and weekday rows
```

```text
state: record attempt events

- keep `attempts.csv` as the latest per-question snapshot
- append every answer to `events.csv` for streaks and activity
```

```text
docs: tighten commit guidance
```

- Do not force a three-bullet format. Use fewer bullets, more bullets, or none based on the commit.
