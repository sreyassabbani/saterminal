{ bun2nix, lib }:
bun2nix.writeBunApplication {
  packageJson = ../package.json;
  src = lib.fileset.toSource {
    root = ../.;
    fileset = lib.fileset.unions [
      ../bun.lock
      ../data
      ../package.json
      ../src
      ../tsconfig.json
    ];
  };

  dontUseBunBuild = true;
  dontUseBunCheck = true;

  startScript = ''
    bun run src/cli/index.ts "$@"
  '';

  bunDeps = bun2nix.fetchBunDeps {
    bunNix = ./bun.nix;
  };

  postInstall = ''
    mv "$out/bin/saterminal" "$out/bin/sat"
  '';

  meta.mainProgram = "sat";
}
