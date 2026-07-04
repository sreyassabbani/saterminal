why?

- i don't like how the official SAT question bank forces u to download PDFs
- official SAT question bank + other third party question readers display the question difficulty and other metadata (their UIs are also quite chopped)
- used to use oneprep until i heard they started AI-generating questions, sooo...

usage

```sh
sat sync
sat
```

`sat sync` downloads a local plain JSON question bank cache into `~/.saterminal/userlocal/cache/`. Practice and review read from that local cache.

The package ships `data/question-bank.json.zst` as the initial bank. On first use, Sat materializes it into a plain JSON cache at `~/.saterminal/userlocal/cache/question-bank.json` so regular practice reads directly from local JSON. `sat sync` refreshes that user-local JSON cache from Practice SAT.
