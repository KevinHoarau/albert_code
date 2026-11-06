// Attributes what the namespace observed: DNS queries (dns.log, one sink
// address per name), packets captured on the sink link (sink.pcap) and guard
// refusals (guard.log). Exits 1 when anything is not explained by the
// tolerated VS Code / Electron hosts (vscode mode) or when anything at all was
// observed (cli mode).
import fs from "node:fs"
import path from "node:path"

const [root, mode] = process.argv.slice(2) as [string, string]
const read = (file: string) =>
  fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file), "utf8").split("\n").filter(Boolean) : []

const core = new Set(
  mode === "vscode"
    ? fs
        .readFileSync(path.join(import.meta.dir, "vscode-core-hosts.txt"), "utf8")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
    : [],
)

const queries = read("dns.log").map((line) => JSON.parse(line) as { name: string; address: string })
const owner = new Map(queries.map((query) => [query.address, query.name]))
const capture = fs.existsSync(path.join(root, "sink.pcap"))
  ? Bun.spawnSync(["tcpdump", "-n", "-r", path.join(root, "sink.pcap")]).stdout.toString().split("\n").filter(Boolean)
  : []
const packets = capture.map((line) => {
  const dst = / > ([0-9a-f.:]+?)(\.\d+)?: /.exec(line)?.[1] ?? "?"
  return owner.get(dst) ?? dst
})

const names = [...new Set(queries.map((query) => query.name))]
const counted = read("packets").at(0) ?? "0"
const unexplained = [
  ...(mode === "cli" && counted !== "0" ? [`${counted} outbound packets`] : []),
  ...names.filter((name) => !core.has(name)).map((name) => `dns ${name}`),
  ...[...new Set(packets)].filter((name) => !core.has(name)).map((name) => `packets to ${name}`),
  ...read("guard.log").map((line) => `guard ${line}`),
]

console.log(`dns names          : ${names.join(", ") || "none"}`)
const counts = packets.reduce((map, name) => map.set(name, (map.get(name) ?? 0) + 1), new Map<string, number>())
console.log(`captured packets   : ${[...counts].map(([name, n]) => `${name}=${n}`).join(", ") || "none"}`)
if (mode === "vscode") console.log(`tolerated (VS Code core): ${[...core].join(", ")}`)
if (unexplained.length) {
  console.log("not explained:")
  for (const item of unexplained) console.log(`  ${item}`)
  process.exit(1)
}
