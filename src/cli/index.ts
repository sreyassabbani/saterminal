#!/usr/bin/env bun
import Pastel from "pastel";

const cli = new Pastel({
  name: "sat",
  description: "Local-first SAT practice in your terminal",
  importMeta: import.meta,
});

await cli.run();
