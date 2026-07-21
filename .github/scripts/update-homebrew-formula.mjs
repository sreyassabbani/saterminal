import { readFileSync, writeFileSync } from "node:fs";

const [formulaPath, version, sha256] = process.argv.slice(2);

if (!formulaPath || !version || !/^[0-9a-f]{64}$/.test(sha256 ?? "")) {
  throw new Error("usage: update-homebrew-formula.mjs <formula> <version> <sha256>");
}

const tarballUrl = `https://registry.npmjs.org/saterminal/-/saterminal-${version}.tgz`;
const source = readFileSync(formulaPath, "utf8");
const urlPattern = /^  url "https:\/\/registry\.npmjs\.org\/saterminal\/-\/saterminal-[^"]+\.tgz"$/m;
const sha256Pattern = /^  sha256 "[0-9a-f]{64}"$/m;
const currentUrl = source.match(urlPattern)?.[0];
const currentSha256 = source.match(sha256Pattern)?.[0];

if (!currentUrl || !currentSha256) {
  throw new Error(`could not find the expected url and sha256 fields in ${formulaPath}`);
}

const nextUrl = `  url "${tarballUrl}"`;
const nextSha256 = `  sha256 "${sha256}"`;

if (currentUrl === nextUrl) {
  if (currentSha256 !== nextSha256) {
    throw new Error(`published checksum for saterminal ${version} does not match ${formulaPath}`);
  }
  process.exit(0);
}

const updated = source
  .replace(urlPattern, nextUrl)
  .replace(sha256Pattern, nextSha256)
  .replace(/^  revision \d+\n/m, "");

writeFileSync(formulaPath, updated);
