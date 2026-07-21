# `saterminal`

SAT practice that stays on your computer. The app ships with a compressed question bank (3K+ questions, ~2MB), works without an account or network connection, and records progress in a local SQLite database (stored in `~/.saterminal`).

If you ever need to study one question at a time, you shouldn't be downloading worksheets or navigating a clunky and ever-changing website. You also don't need to see question metadata while reading questions (somehow this is an issue on many SAT practice websites).

## Get started

```sh
npm i -g saterminal
```

OR

```sh
brew install sreyassabbani/tap/saterminal
```

Now, you can run `sat` anywhere.

### Local data

The first launch asks before creating `~/.saterminal`.

- `sat.db` contains some settings & user history.
- `.ignore` keeps the generated cache out of supporting editor file pickers.
- `preferences.json` & `preferences.schema.json` (you can manipulate these files via the TUI or CLI as well)
- `cache/question-bank.json` is the local unzipped question bank.

Deleting `~/.saterminal` resets local progress: no cloud account, sync service, server, or auth layer.

## Useful commands

Running `sat` opens the interactive study home. Reports use the richer terminal layout by default; no `-p` flag is necessary.

```sh
sat                              # open practice, review, progress, or settings
sat review                       # revisit eligible missed and corrected questions
sat weak                         # rank the skills that need attention
sat stats                        # accuracy, timing, streak, and activity
sat history                      # recent question outcomes
sat history --wrong --since 2w
sat focus                        # inspect the active focus
sat config                       # inspect local preferences
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

- at least X days have passed since its latest answer;
- at least Y answer events were recorded after that answer.

X and Y are defined in `preferences.json`, and are defaulted to 7 and 100, respectively. This prevents an immediate retry from masquerading as durable recall. Change either threshold with:

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
| `m` | Return to the study home |
| `f` / `h` / `s` / `p` | Focus / history / summary / practice |
| `q` | Quit |

Questions containing HTML tables can be opened on Practice SAT with `o`; the rest of the practice flow remains local.

## Development

Enable the development shell once with `direnv allow` or prefix individual commands with `nix develop -c`. Install dependencies before running the application from source:

```sh
bun i
bun run start
```

`bun run start` runs the TypeScript entry point directly. Pass CLI arguments with `bun run start -- --help`.

### Build artifacts

Use `bun run build` when you need a standalone native executable for the current machine:

```sh
bun run build
./dist/sat --version
```

This writes a compiled, minified Bun executable to `dist/sat`. It bundles the application, its dependencies, and the Bun runtime.

Use `nix build` to build the reproducible Nix package:

```sh
nix build
./result/bin/sat --version
nix run . -- --help
```

The Nix package does not use `dist/sat`. Instead, `result/bin/sat` is a small launcher that runs the packaged TypeScript source with the packaged Bun runtime and dependencies in the Nix store. Both build paths run the same CLI, but they produce different kinds of artifacts.

### Maintain the question bank

Refresh the bundled bank for a future release with:

```sh
nix develop -c bun run update-bank
```

This is the only normal source workflow that contacts the upstream Practice SAT service. It downloads, normalizes, and writes `data/question-bank.json.zst`.

### Verify changes

Verifying once before publishing is enough.

```sh
nix develop -c bun run typecheck
nix develop -c bun test
nix develop -c bun run src/cli/index.ts --help
nix develop -c bun run build
./dist/sat --version
nix build
./result/bin/sat --version
nix run . -- --version
```

When `bun.lock` changes, regenerate the committed Nix dependency expression before building:

```sh
nix develop -c bun run nix:deps
```

### Publishing

CD for `npm` is set up with `.github/workflows/publish.yml`, so release by creating a SemVer tag:

```sh
bun pm version <increment>
```

The increment follows SemVer: `major`, `minor`, or `patch`. This commits the version change and creates its annotated `v…` tag.

Push the commit and its release tag together:

```sh
git push --follow-tags
```
