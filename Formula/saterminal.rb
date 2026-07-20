class Saterminal < Formula
  desc "Local-first SAT practice in the terminal"
  homepage "https://github.com/sreyassabbani/saterminal"
  url "https://registry.npmjs.org/saterminal/-/saterminal-0.6.1.tgz"
  sha256 "992627553028cb9b3128dd60cbaa0ae2e977d4692ab2884adb95755dc73a243e"
  license "MIT"

  depends_on "bun"

  def install
    system "bun", "install", "--production"
    libexec.install Dir["*"]
    bin.write_env_script libexec/"src/cli/index.ts", PATH: Formula["bun"].opt_bin
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/sat --version")
  end
end
