# saterminal

SAT practice that stays on your computer. The app ships with a compressed question bank, works without an account or network connection, and records progress in a local SQLite database.

The project name is styled **saterminal**. The command-line executable is `sat`.

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

Build and run the packaged application directly with Nix:

```sh
nix build
./result/bin/sat --help
```

The first launch asks before creating `~/.saterminal`. Choose a focus, press Enter, and start answering. Everything needed for practice is already in the package.

Practice deliberately hides difficulty, domain, and skill while a question is active. The header shows only the running timer. After submitting, the answer screen restores the complete question beside the marked choices and explanation, then reveals timing and question metadata for review.

## Useful commands

Running `sat` opens normal practice. Reports use the richer terminal layout by default; no `-p` flag is necessary.

```sh
sat                 # choose a focus and practice
sat review          # revisit eligible missed and corrected questions
sat weak            # rank the skills that need attention
sat stats           # accuracy, timing, streak, and activity
sat history         # recent question outcomes
sat history --wrong --since 2w
sat focus           # inspect the active focus
sat config          # inspect local preferences
```

Every report also supports:

```sh
sat stats --plain    # compact, stable text
sat stats --json     # machine-readable output
sat stats --no-color
NO_COLOR=1 sat weak
```

Use `sat <command> --help` for command-specific filters.

## Review spacing

A missed or corrected question enters `sat review` only after both default spacing requirements are met:

- at least 7 days have passed since its latest answer;
- at least 100 answer events were recorded after that answer.

This prevents an immediate retry from masquerading as durable recall. Change either threshold with:

```sh
sat config set --minimum-days 14
sat config set --minimum-answers-after 200
sat config set --minimum-days 14 --minimum-answers-after 200
sat config reset
```

## Result detail

Choose how much learner-facing context appears after an answer:

```sh
sat config set --result-detail brief     # time
sat config set --result-detail standard  # time and difficulty (default)
sat config set --result-detail detailed  # time, difficulty, and taxonomy
```

The verdict, answer choices, and explanation remain visible at every level. Internal question IDs stay available through `sat show`, not the result screen.

## Preferences file

You can also edit `~/.saterminal/preferences.json` directly:

```json
{
  "$schema": "./preferences.schema.json",
  "review": {
    "minimumDays": 7,
    "minimumAnswersAfter": 100
  },
  "display": {
    "resultDetail": "standard"
  }
}
```

Set `display.resultDetail` to `brief`, `standard`, or `detailed` to control answer-result context. Brief shows time, standard adds difficulty, and detailed adds taxonomy codes and labels. The adjacent JSON Schema provides editor validation, descriptions, and completions. Omitted values use their defaults. Unknown, negative, fractional, or malformed values are rejected with the path to the invalid file.

## Interactive keys

The footer always shows the keys available on the current screen. The common ones are:

| Key | Action |
| --- | --- |
| `j` / `k`, arrows | Move through focus options and answers; scroll the active review pane |
| `Tab`, left/right | Move between focus groups or question/answer panes |
| `Space` | Toggle a focus option; pause a running question timer |
| `Enter` | Start, submit, continue, or open a history item |
| `A`–`D` | Select an answer directly |
| `[` / `]`, Page Up/Down | Scroll the active question, answer, or explanation pane |
| `t` | Show or hide the timer while actively answering |
| `f` / `h` / `s` / `p` | Focus / history / summary / practice |
| `q` | Quit |

Questions containing HTML tables can be opened on Practice SAT with `o`; the rest of the practice flow remains local.

## Local data

- `~/.saterminal/sat.db` contains focus, latest outcomes, and answer events.
- `~/.saterminal/.ignore` keeps the generated cache out of supporting editor file pickers.
- `~/.saterminal/preferences.json` contains optional review-spacing and display preferences.
- `~/.saterminal/preferences.schema.json` provides local editor validation and completions.
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
  preferences/ validated local user preferences
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
nix build
./result/bin/sat --version
```

When `bun.lock` changes, regenerate the committed Nix dependency expression before building:

```sh
nix develop -c bun run nix:deps
```
