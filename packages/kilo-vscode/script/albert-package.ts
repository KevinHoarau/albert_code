#!/usr/bin/env bun
// Builds the Albert Code VSIX, one per target (linux-x64 and win32-x64 by default):
//   bun script/albert-package.ts [--target=linux-x64] [--target=win32-x64] [--rebuild-cli]
//
// 1. builds each target's CLI binary (packages/opencode) unless it exists. The
//    linux CLI needs Zig ($ZIG) for its Bubblewrap helper; the Windows CLI is
//    cross-built and needs the Windows native packages
//    (bun install --frozen-lockfile --os='*' --cpu='*');
// 2. checks types, lints and bundles the extension (production), once;
// 3. for each target, copies the CLI and its resources to bin/, adds ripgrep
//    (checksum-pinned), and ships no ffmpeg and no Playwright runtime;
// 4. packages out/albert-code-<target>.vsix with vsce and scans it for hosts
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
const bin = path.join(root, "bin")
const out = path.join(root, "out")

// ripgrep 15.1.0 release assets; the API URL is the same asset, used as fallback.
const all = {
  "linux-x64": {
    cli: "cli-linux-x64",
    exe: "kilo",
    rg: {
      url: "https://github.com/BurntSushi/ripgrep/releases/download/15.1.0/ripgrep-15.1.0-x86_64-unknown-linux-musl.tar.gz",
      api: "https://api.github.com/repos/BurntSushi/ripgrep/releases/assets/307306614",
      sha256: "1c9297be4a084eea7ecaedf93eb03d058d6faae29bbc57ecdaf5063921491599",
      member: "ripgrep-15.1.0-x86_64-unknown-linux-musl/rg",
    },
  },
  "win32-x64": {
    cli: "cli-windows-x64",
    exe: "kilo.exe",
    rg: {
      url: "https://github.com/BurntSushi/ripgrep/releases/download/15.1.0/ripgrep-15.1.0-x86_64-pc-windows-msvc.zip",
      api: "https://api.github.com/repos/BurntSushi/ripgrep/releases/assets/307305871",
      sha256: "124510b94b6baa3380d051fdf4650eaa80a302c876d611e9dba0b2e18d87493a",
      member: "ripgrep-15.1.0-x86_64-pc-windows-msvc/rg.exe",
    },
  },
}
type Target = keyof typeof all

const asked = process.argv.filter((arg) => arg.startsWith("--target=")).map((arg) => arg.slice("--target=".length))
for (const name of asked) if (!(name in all)) throw new Error(`unknown target ${name} (known: ${Object.keys(all)})`)
const targets = (asked.length ? asked : Object.keys(all)) as Target[]

for (const target of targets) {
  const cli = path.join(opencode, "dist", "@kilocode", all[target].cli, "bin", all[target].exe)
  if (existsSync(cli) && !process.argv.includes("--rebuild-cli")) continue
  console.log(`Building the ${target} CLI binary...`)
  await $`bun run script/build.ts --target=${target} --skip-install`.cwd(opencode)
}

for (const dir of [bin, path.join(root, "dist"), out]) rmSync(dir, { recursive: true, force: true })
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

// GitHub release downloads sometimes answer 502/504: retry, and fall back to
// the API endpoint of the same asset. The checksum decides what is accepted.
async function download(urls: string[], left = 3): Promise<Buffer> {
  for (const url of urls) {
    const res = await fetch(url, { headers: { Accept: "application/octet-stream" } }).catch(
      (err: unknown) => new Response(String(err), { status: 599 }),
    )
    if (res.ok) return Buffer.from(await res.arrayBuffer())
    console.log(`ripgrep download answered HTTP ${res.status} (${url})`)
  }
  if (left <= 1) throw new Error("ripgrep download failed")
  await Bun.sleep(10_000)
  return download(urls, left - 1)
}

// vsce reads package.json from the extension directory: the renamed manifest is
// swapped in for the packaging only.
const manifest = path.join(root, "package.json")
const source = await Bun.file(manifest).text()

for (const target of targets) {
  const spec = all[target]
  const cli = path.join(opencode, "dist", "@kilocode", spec.cli, "bin", spec.exe)
  const vsix = path.join(out, `albert-code-${target}.vsix`)

  console.log(`\n[${target}] Copying the CLI binary and its resources...`)
  rmSync(bin, { recursive: true, force: true })
  mkdirSync(bin, { recursive: true })
  const dest = path.join(bin, spec.exe)
  await $`cp ${cli} ${dest}`
  await copyTreeSitterResources(cli, dest)
  await copySandboxResources(cli, dest)
  await copyKiloSandboxWorker(cli, dest)
  chmodSync(dest, 0o755)

  console.log(`[${target}] Adding ripgrep...`)
  const archive = await download([spec.rg.url, spec.rg.api])
  const sum = createHash("sha256").update(archive).digest("hex")
  if (sum !== spec.rg.sha256) throw new Error(`ripgrep checksum mismatch for ${target}: ${sum}`)
  const tmp = path.join(out, path.basename(spec.rg.url))
  await Bun.write(tmp, archive)
  if (tmp.endsWith(".zip")) await $`unzip -q -o ${tmp} ${spec.rg.member} -d ${out}`
  else await $`tar -xzf ${tmp} -C ${out} ${spec.rg.member}`
  const rg = path.join(bin, path.basename(spec.rg.member))
  await $`cp ${path.join(out, spec.rg.member)} ${rg}`
  chmodSync(rg, 0o755)
  rmSync(tmp)
  rmSync(path.join(out, path.dirname(spec.rg.member)), { recursive: true, force: true })

  console.log(`[${target}] Packaging...`)
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
}
