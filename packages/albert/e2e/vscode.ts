// VS Code smoke test, run inside the isolated namespace by run.sh --vscode.
// Starts VS Code on a blank profile with the Albert Code VSIX, lets the
// extension activate and spawn its CLI against the fake Albert, captures the
// VS Code window, then checks the extension host log.
import fs from "node:fs"
import path from "node:path"
import { start as fake } from "./fake-albert"

const root = process.env.E2E_ROOT!
const code = process.env.CODE_BIN ?? "code"
const ud = process.env.E2E_UD || path.join(root, "ud")
const ext = path.join(root, "ext")
const work = path.join(root, "work")
const home = path.join(root, "home")
const done = path.join(root, "done")
const installed = fs.readdirSync(ext).find((name) => name.startsWith("albert-code.albert-code-"))

function check(ok: unknown, what: string): asserts ok {
  if (!ok) throw new Error(`assertion failed: ${what}`)
  console.log(`ok - ${what}`)
}

async function until(fn: () => boolean | Promise<boolean>, ms: number) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await fn()) return true
    await Bun.sleep(500)
  }
  return false
}

fs.mkdirSync(work, { recursive: true })
fs.writeFileSync(path.join(work, "README.md"), "# vscode e2e\n")
const albert = fake({ dir: work })

// VS Code's own services (updates, marketplace, experiments, telemetry) are
// turned off so the namespace only sees what the extension does.
fs.mkdirSync(path.join(ud, "User"), { recursive: true })
fs.writeFileSync(
  path.join(ud, "User", "settings.json"),
  JSON.stringify(
    {
      "albertCode.apiBaseUrl": albert.url,
      "telemetry.telemetryLevel": "off",
      "update.mode": "none",
      "extensions.autoCheckUpdates": false,
      "extensions.autoUpdate": false,
      "extensions.ignoreRecommendations": true,
      "workbench.enableExperiments": false,
      "workbench.settings.enableNaturalLanguageSearch": false,
      "workbench.startupEditor": "none",
      "workbench.tips.enabled": false,
      "npm.fetchOnlinePackageInfo": false,
      "git.autofetch": false,
      "chat.disableAIFeatures": true,
      "security.workspace.trust.enabled": false,
    },
    null,
    2,
  ),
)

const proc = Bun.spawn(
  // The namespace maps the user to root, which Electron only accepts without
  // its renderer sandbox; this only concerns the test, not the network check.
  [
    code,
    "--no-sandbox",
    "--user-data-dir",
    ud,
    "--extensions-dir",
    ext,
    "--new-window",
    "--disable-gpu",
    "--skip-release-notes",
    `--extensionDevelopmentPath=${path.join(ext, installed!)}`,
    `--extensionTestsPath=${path.join(import.meta.dir, "vscode-runner.cjs")}`,
    work,
  ],
  {
    env: {
      PATH: process.env.PATH,
      HOME: home,
      DISPLAY: process.env.DISPLAY,
      XAUTHORITY: process.env.XAUTHORITY,
      ALBERT_API_KEY: "e2e-key",
      ALBERT_GUARD_LOG: process.env.ALBERT_GUARD_LOG,
      E2E_DONE: done,
    },
    stdout: Bun.file(path.join(root, "code.out")),
    stderr: Bun.file(path.join(root, "code.err")),
  },
)
const spawned = await until(() => {
  const out = Bun.spawnSync(["pgrep", "-f", `${ext}/.*/bin/kilo serve`])
  return out.exitCode === 0
}, 90_000)
check(spawned, "the extension activated and spawned its embedded CLI")

const discovered = await until(() => albert.calls.some((call) => call.path === "/v1/models"), 60_000)
check(discovered, "the embedded CLI read the models from the (fake) Albert API")
await Bun.sleep(8_000)

// Capture only the VS Code test window, never the rest of the screen.
const shot = path.join(root, "vscode.xwd")
const tree = Bun.spawnSync(["xwininfo", "-root", "-tree"]).stdout.toString()
const id = tree
  .split("\n")
  .find((line) => line.includes("Extension Development Host") && line.includes("Visual Studio Code"))
  ?.trim()
  .split(" ")[0]
const xwd = id ? Bun.spawnSync(["xwd", "-silent", "-id", id, "-out", shot]) : undefined
console.log(xwd?.exitCode === 0 ? `screenshot: ${shot}` : "screenshot: window not found")

const logs = [...new Bun.Glob("**/*.log").scanSync({ cwd: path.join(ud, "logs") })].map((file) =>
  path.join(ud, "logs", file),
)
const host = logs.filter((file) => /exthost/i.test(file)).map((file) => fs.readFileSync(file, "utf8")).join("\n")
check(/albert-code/.test(host), "the extension host log mentions albert-code")
check(!/Activating extension 'albert-code.albert-code' failed/.test(host), "the extension activated without error")

fs.writeFileSync(done, "")
await Promise.race([proc.exited, Bun.sleep(30_000)])
proc.kill("SIGTERM")
albert.server.stop(true)
console.log("vscode smoke passed")
