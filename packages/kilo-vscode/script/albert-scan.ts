#!/usr/bin/env bun
// Searches a VSIX for the hosts listed in NETWORK.md and prints where they
// appear (extension host bundle, webview bundles, CLI binary).
//   bun script/albert-scan.ts out/albert-code-linux-x64.vsix
//
// A string in the bundle is not a flow: the runtime guard and the isolated E2E
// test decide what is reachable. This report is the input for that review.
// The scan fails only when a host that must have been removed with its code
// (telemetry, session ingest) is still present in a shipped file.
import { $ } from "bun"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const vsix = path.resolve(process.argv[2] ?? "")
if (!fs.existsSync(vsix)) throw new Error(`usage: albert-scan.ts <vsix>`)

export const hosts = [
  "albert.api.etalab.gouv.fr",
  "api.kilo.ai",
  "app.kilo.ai",
  "ai-gateway.kilo.ai",
  "kilo.ai",
  "ingest.kilosessions.ai",
  "cloud-agent-next.kilosessions.ai",
  "kiloapps.io",
  "opncd.ai",
  "opencode.ai",
  "us.i.posthog.com",
  "posthog.com",
  "models.dev",
  "registry.npmjs.org",
  "api.github.com",
  "raw.githubusercontent.com",
  "mcp.exa.ai",
  "search.parallel.ai",
  "openrouter.ai",
  "api.openai.com",
  "api.anthropic.com",
  "api.githubcopilot.com",
  "chatgpt.com",
  "api.voyageai.com",
  "download-cdn.jetbrains.com",
  "api.releases.hashicorp.com",
  "formulae.brew.sh",
]

// Removed together with their code: they must not remain in any shipped file.
const removed = ["us.i.posthog.com", "ingest.kilosessions.ai", "supermassive-black-hole.kiloapps.io"]

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "albert-scan-"))
await $`unzip -q ${vsix} -d ${dir}`
const ext = path.join(dir, "extension")

function group(file: string) {
  const rel = path.relative(ext, file)
  if (rel === "bin/kilo") return "cli binary"
  if (rel === "dist/extension.js") return "extension host"
  if (rel.startsWith("dist/")) return "webview / workers"
  return "other"
}

const files = [...new Bun.Glob("**/*").scanSync({ cwd: ext, onlyFiles: true })].map((file) => path.join(ext, file))
const found = new Map<string, Map<string, number>>()
for (const file of files) {
  const text = group(file) === "cli binary" ? (await $`strings -n 6 ${file}`.text()) : fs.readFileSync(file, "latin1")
  for (const host of [...hosts, ...removed]) {
    const count = text.split(host).length - 1
    if (!count) continue
    const row = found.get(host) ?? new Map<string, number>()
    row.set(group(file), (row.get(group(file)) ?? 0) + count)
    found.set(host, row)
  }
}

console.log(`| Host | Extension host | Webview / workers | CLI binary | Other |`)
console.log(`|---|---|---|---|---|`)
for (const host of [...hosts, ...removed]) {
  const row = found.get(host)
  const cell = (name: string) => String(row?.get(name) ?? 0)
  console.log(`| ${host} | ${cell("extension host")} | ${cell("webview / workers")} | ${cell("cli binary")} | ${cell("other")} |`)
}

fs.rmSync(dir, { recursive: true, force: true })
const left = removed.filter((host) => found.has(host))
if (left.length) {
  console.error(`removed hosts still present: ${left.join(", ")}`)
  process.exit(1)
}
