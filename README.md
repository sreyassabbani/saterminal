# Why?

- i don't like how the official SAT question bank forces u to download PDFs
- official SAT question bank + other third party question readers display the question difficulty and other metadata (their UIs are also quite chopped)
- used to use oneprep until i heard they started AI-generating questions, sooo...
- also this works completely offline!

# Usage

```sh
sat
```

## Question Bank

The package ships `data/question-bank.json.zst` as the initial bank. On first use, `saterminal` materializes it into a plain JSON cache at `~/.saterminal/cache/question-bank.json` so regular practice reads directly from local JSON.

## For maintainers

```sh
bun run update-bank
```

This refreshes `data/question-bank.json.zst` from Practice SAT for the next package release.
