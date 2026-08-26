/**
 * Minimal build step. Emits a build manifest so the release pipeline has an
 * artifact to point at, without pulling in a bundler (every extra toolchain is
 * another chance to reach a domain outside the AutoFab egress allowlist).
 */
const fs = require("node:fs");
const path = require("node:path");

const pkg = require("../package.json");

const outDir = path.join(__dirname, "..", "dist");
fs.mkdirSync(outDir, { recursive: true });

const manifest = {
  name: pkg.name,
  version: pkg.version,
  node: process.version,
  dependencies: Object.keys(pkg.dependencies ?? {}),
};

fs.writeFileSync(path.join(outDir, "build-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`wrote dist/build-manifest.json for ${pkg.name}@${pkg.version}\n`);
