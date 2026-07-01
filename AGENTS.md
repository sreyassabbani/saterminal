# Git

- Commit regularly.
- Commit messages should split "what" from "why/how":
  - First line: conventional commit summary.
  - Following lines: concise reasons and implementation notes.
- Prefer backticks for paths, commands, package names, settings, and other literal identifiers that are easier to recognize that way.

```text
feat(darwin/packages): add `btop` and `macmon`

- `btop` and `macmon` provide terminal-based system monitoring
- install them through `environment.systemPackages` so they are available system-wide
- both packages resolve from the pinned nixpkgs set, so no unstable package source is needed
```

```text
chore(repo): remove unused `documents/` directory

- no Nix modules, package config, or templates reference `documents/`
- the directory only contained standalone agent/document notes
- removing it keeps the repo focused on active configuration
```
