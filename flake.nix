{
  inputs = {
    nixpkgs.url = "https://flakehub.com/f/DeterminateSystems/nixpkgs-weekly/0.tar.gz";
    flake-utils.url = "github:numtide/flake-utils";
    bun2nix = {
      url = "github:nix-community/bun2nix?ref=2.1.1";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      nixpkgs,
      flake-utils,
      bun2nix,
      ...
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [ bun2nix.overlays.default ];
        };
        saterminal = pkgs.callPackage ./nix/package.nix { };
      in
      {
        packages.default = saterminal;

        apps.default = flake-utils.lib.mkApp {
          drv = saterminal;
        };

        devShells.default = pkgs.mkShell {
          packages = [
            pkgs.bun
            pkgs.bun2nix
          ];
        };
      }
    );
}
