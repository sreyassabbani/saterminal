# saterminal

SAT practice that stays on your computer. The app ships with a compressed question bank, works without an account or network connection, and records progress in a local SQLite database.

It exists because studying one question at a time should not require downloading worksheets, navigating a website, or looking at difficulty metadata before answering.

## Get started

The development environment is defined by Nix and uses Bun throughout.

```sh
direnv allow
bun install
bun link
sat
```

Without direnv, enter the shell explicitly:

```sh
nix develop
bun install
bun run dev
```

The first launch asks before creating `~/.saterminal`. Choose a focus, press Enter, and start answering. Everything needed for practice is already in the package.

## Useful commands

Running `sat` opens normal practice. Reports use the richer terminal layout by default; no `-p` flag is necessary.

```sh
sat                 # choose a focus and practice
sat review          # revisit missed and corrected questions
sat weak            # rank the skills that need attention
sat stats           # accuracy, timing, streak, and activity
sat history         # recent question outcomes
sat history --wrong --since 2w
sat focus           # inspect the active focus
```

Every report also supports:

```sh
sat stats --plain    # compact, stable text
sat stats --json     # machine-readable output
sat stats --no-color
NO_COLOR=1 sat weak
```

Use `sat <command> --help` for command-specific filters.

## Interactive keys

The footer always shows the keys available on the current screen. The common ones are:

| Key | Action |
| --- | --- |
| `j` / `k`, arrows | Move through focus options, answers, or history |
| `Tab`, left/right | Move between focus groups |
| `Space` | Toggle a focus option; pause a running question timer |
| `Enter` | Start, submit, continue, or open a history item |
| `A`–`D` | Select an answer directly |
| `[` / `]`, Page Up/Down | Scroll a long question |
| `f` / `h` / `s` / `p` | Focus / history / summary / practice |
| `q` | Quit |

Questions containing HTML tables can be opened on Practice SAT with `o`; the rest of the practice flow remains local.

## Local data

- `~/.saterminal/sat.db` contains focus, latest outcomes, and answer events.
- `~/.saterminal/cache/question-bank.json` is the local materialized question bank.
- `data/question-bank.json.zst` is the bundled offline source used to create that cache.

Answer recording is transactional: the event history and latest per-question outcome either both commit or both roll back. Existing schema-version-one databases are migrated in place.

Deleting `~/.saterminal` resets local progress. There is deliberately no cloud account, sync service, server, or authentication layer.

## Project map

The source tree is organized by ownership rather than file size:

```text
src/
  questions/   normalized SAT questions, taxonomy, focus, local bank
  progress/    attempts and read-only analysis of recorded study
  practice/    live study workflows and outcome transitions
  database/    SQLite schema, migration, and repositories
  cli/         Pastel command routes and report presentation
  tui/         Ink application, screens, and terminal components
  text/        HTML/media normalization and terminal wrapping
  local-data/  local filesystem locations
```

Only the bank update script knows the upstream Practice SAT field names. Runtime code works with the normalized question model.

## Maintain the question bank

Refresh the bundled bank for a future release with:

```sh
nix develop -c bun run update-bank
```

This is the only normal workflow that needs the network. It downloads Practice SAT data, normalizes it, and writes `data/question-bank.json.zst`.

## Verify changes

```sh
nix develop -c bun run typecheck
nix develop -c bun test
nix develop -c bun run src/cli/index.ts --help
```
