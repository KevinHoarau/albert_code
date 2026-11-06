#!/usr/bin/env bun
// Builds the Albert Code VSIX for linux-x64:
//   bun script/albert-package.ts
//
// 1. builds the CLI binary (packages/opencode, needs Zig: set $ZIG) unless it exists;
// 2. checks types, lints and bundles the extension (production);
// 3. copies the CLI and its resources to bin/, adds ripgrep (checksum-pinned),
//    and ships no ffmpeg and no Playwright runtime;
// 4. packages out/albert-code-linux-x64.vsix with vsce and scans it for hosts
//    (script/albert-scan.ts).
// Network access is only needed here, at build time (npm registry, GitHub releases).
import { $ } from "bun"
import { createHash } from "node:crypto"
import { chmodSync, existsSync, mkdirSync, rmSync } from "node:fs"
import path from "node:path"
import {
  copyKiloSandboxWorker,
  copySandboxResources,
  copyTreeSitterResources,
} from "../src/services/cli-backend/cli-resources"
import { ids } from "./albert-ids"

const root = path.join(import.meta.dir, "..")
const opencode = path.join(root, "..", "opencode")
const target = "linux-x64"
const cli = path.join(opencode, "dist", "@kilocode", "cli-linux-x64", "bin", "kilo")
const bin = path.join(root, "bin")
const out = path.join(root, "out")
const vsix = path.join(out, `albert-code-${target}.vsix`)

const rg = {
  url: "https://github.com/BurntSushi/ripgrep/releases/download/15.1.0/ripgrep-15.1.0-x86_64-unknown-linux-musl.tar.gz",
  sha256: "1c9297be4a084eea7ecaedf93eb03d058d6faae29bbc57ecdaf5063921491599",
  member: "ripgrep-15.1.0-x86_64-unknown-linux-musl/rg",
}

if (!existsSync(cli) || process.argv.includes("--rebuild-cli")) {
  console.log("Building the CLI binary...")
  await $`bun run script/build.ts --single --skip-install`.cwd(opencode)
}

for (const dir of [bin, path.join(root, "dist"), out]) rmSync(dir, { recursive: true, force: true })
mkdirSync(bin, { recursive: true })
mkdirSync(out, { recursive: true })

console.log("Checking and bundling the extension...")
await $`bun run prepare:sdk`.cwd(root)
await $`bun run check-types`.cwd(root)
await $`bun run check-types:webview`.cwd(root)
await $`bun run lint`.cwd(root)
await $`node esbuild.js --production`.cwd(root)

// Own VS Code identifiers, so Albert Code can run next to Kilo Code.
console.log("Renaming VS Code identifiers...")
for (const file of new Bun.Glob("dist/**/*.{js,mjs,cjs,json,html,css}").scanSync({ cwd: root })) {
  const full = path.join(root, file)
  const text = await Bun.file(full).text()
  const next = ids(text)
  if (next !== text) await Bun.write(full, next)
}

console.log("Copying the CLI binary and its resources...")
const dest = path.join(bin, "kilo")
await $`cp ${cli} ${dest}`
await copyTreeSitterResources(cli, dest)
await copySandboxResources(cli, dest)
await copyKiloSandboxWorker(cli, dest)
chmodSync(dest, 0o755)

console.log("Adding ripgrep...")
const archive = Buffer.from(await (await fetch(rg.url)).arrayBuffer())
const sum = createHash("sha256").update(archive).digest("hex")
if (sum !== rg.sha256) throw new Error(`ripgrep checksum mismatch: ${sum}`)
const tmp = path.join(out, "rg.tar.gz")
await Bun.write(tmp, archive)
await $`tar -xzf ${tmp} -C ${out} ${rg.member}`
await $`cp ${path.join(out, rg.member)} ${path.join(bin, "rg")}`
chmodSync(path.join(bin, "rg"), 0o755)
rmSync(tmp)
rmSync(path.join(out, path.dirname(rg.member)), { recursive: true, force: true })

console.log("Packaging...")
// vsce reads package.json from the extension directory: the renamed manifest is
// swapped in for the packaging only.
const manifest = path.join(root, "package.json")
const source = await Bun.file(manifest).text()
await Bun.write(manifest, ids(source))
try {
  await $`${path.join(root, "node_modules", ".bin", "vsce")} package --no-dependencies --skip-license --target ${target} -o ${vsix}`
    .cwd(root)
    .env({ ...process.env, npm_config_ignore_scripts: "true" })
} finally {
  await Bun.write(manifest, source)
}

await $`bun script/albert-scan.ts ${vsix}`.cwd(root)
console.log(`VSIX: ${vsix}`)
