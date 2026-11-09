// End-to-end scenario run inside the isolated network namespace (see run.sh).
// It drives the real CLI binary the way the VS Code extension does: start,
// providers from the fake Albert, session with a tool call, commit message,
// restart, then checks that the session survived.
import fs from "node:fs"
import path from "node:path"
import { child } from "../src/env"
import { MODEL, start as fake } from "./fake-albert"

const bin = process.env.KILO_BIN!
const root = process.env.E2E_ROOT!
const work = path.join(root, "work")
const home = path.join(root, "home")
const password = "e2e-password"
const auth = `Basic ${Buffer.from(`kilo:${password}`).toString("base64")}`

function check(ok: unknown, what: string): asserts ok {
  if (!ok) throw new Error(`assertion failed: ${what}`)
  console.log(`ok - ${what}`)
}

function git(...args: string[]) {
  const out = Bun.spawnSync(["git", ...args], { cwd: work, env: { ...process.env, HOME: home } })
  if (out.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${out.stderr.toString()}`)
  return out.stdout.toString().trim()
}

async function serve(url: string) {
  const env = child({
    PATH: process.env.PATH,
    HOME: home,
    XDG_CONFIG_HOME: path.join(home, ".config"),
    XDG_DATA_HOME: path.join(home, ".local/share"),
    XDG_CACHE_HOME: path.join(home, ".cache"),
    XDG_STATE_HOME: path.join(home, ".local/state"),
    KILO_SERVER_PASSWORD: password,
    KILO_CLIENT: "vscode",
    KILO_PLATFORM: "vscode",
    ALBERT_BASE_URL: url,
    ALBERT_API_KEY: "e2e-key",
    ALBERT_GUARD_LOG: process.env.ALBERT_GUARD_LOG,
    // Windows (windows.ps1): Winsock needs SystemRoot, and the profile folders
    // point inside the test root like HOME does.
    ...(process.platform === "win32"
      ? {
          SystemRoot: process.env.SystemRoot,
          SystemDrive: process.env.SystemDrive,
          windir: process.env.windir,
          ComSpec: process.env.ComSpec,
          PATHEXT: process.env.PATHEXT,
          USERPROFILE: home,
          APPDATA: path.join(home, "AppData", "Roaming"),
          LOCALAPPDATA: path.join(home, "AppData", "Local"),
          TEMP: path.join(root, "tmp"),
          TMP: path.join(root, "tmp"),
        }
      : {}),
  })
  const proc = Bun.spawn([bin, "serve", "--port", "0"], { cwd: work, env, stdout: "pipe", stderr: "pipe" })
  const log = fs.createWriteStream(path.join(root, "serve.log"), { flags: "a" })
  const reader = proc.stdout.getReader()
  const decoder = new TextDecoder()
  void new Response(proc.stderr).text().then((text) => log.write(text))
  const port = await (async () => {
    let buf = ""
    const deadline = Date.now() + 60_000
    while (Date.now() < deadline) {
      const next = await reader.read()
      if (next.done) break
      buf += decoder.decode(next.value)
      log.write(decoder.decode(next.value))
      const match = /listening on http:\/\/127\.0\.0\.1:(\d+)/.exec(buf)
      if (match) return Number(match[1])
    }
    throw new Error(`kilo serve did not start:\n${buf}`)
  })()
  void (async () => {
    while (true) {
      const next = await reader.read()
      if (next.done) return
      log.write(decoder.decode(next.value))
    }
  })()
  const base = `http://127.0.0.1:${port}`
  const call = async (method: string, route: string, body?: unknown) => {
    const sep = route.includes("?") ? "&" : "?"
    const res = await fetch(`${base}${route}${sep}directory=${encodeURIComponent(work)}`, {
      method,
      headers: { authorization: auth, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`${method} ${route} -> ${res.status}: ${text}`)
    return text ? JSON.parse(text) : undefined
  }
  return { proc, call }
}

async function main() {
  fs.mkdirSync(work, { recursive: true })
  fs.mkdirSync(home, { recursive: true })
  fs.mkdirSync(path.join(root, "tmp"), { recursive: true })
  git("init", "-q", "-b", "main")
  git("config", "user.email", "e2e@example.invalid")
  git("config", "user.name", "E2E")
  fs.writeFileSync(path.join(work, "README.md"), "# e2e\n")
  git("add", "-A")
  git("commit", "-q", "-m", "init")

  const albert = fake({ dir: work })

  // 1. Startup: Albert is the only provider and its models come from /v1/models.
  const first = await serve(albert.url)
  const providers = await first.call("GET", "/config/providers")
  const ids = providers.providers.map((item: { id: string }) => item.id)
  check(ids.length === 1 && ids[0] === "albert", `only the albert provider is offered (got ${ids.join(",")})`)
  const models = Object.keys(providers.providers[0].models)
  check(models.length === 1 && models[0] === MODEL, `models come from /v1/models (got ${models.join(",")})`)

  // 2. Session with a tool call (the fake model calls `write`).
  const session = await first.call("POST", "/session", {})
  const reply = await first.call("POST", `/session/${session.id}/message`, {
    model: { providerID: "albert", modelID: MODEL },
    parts: [{ type: "text", text: "Please WRITE_FILE now" }],
  })
  check(fs.existsSync(path.join(work, "hello.txt")), "the write tool created hello.txt")
  const text = reply.parts.filter((part: { type: string }) => part.type === "text").map((part: { text: string }) => part.text)
  check(text.join("").includes("The file has been written."), "the model answered after the tool result")
  const messages = await first.call("GET", `/session/${session.id}/message`)
  const tools = messages.flatMap((msg: { parts: { type: string; tool?: string }[] }) =>
    msg.parts.filter((part) => part.type === "tool").map((part) => part.tool),
  )
  check(tools.includes("write"), "the session records the write tool call")

  // 3. Title generated by an Albert model.
  const titled = await (async () => {
    for (let i = 0; i < 40; i++) {
      const info = await first.call("GET", `/session/${session.id}`)
      if (info.title === "E2E session") return true
      await Bun.sleep(250)
    }
    return false
  })()
  check(titled, "the session title comes from the Albert model")

  // 4. Commit message generated by an Albert model, then committed locally.
  const commit = await first.call("POST", "/commit-message", { path: work })
  check(commit.message === "feat: add hello file", `commit message from the model (got ${JSON.stringify(commit.message)})`)
  git("add", "-A")
  git("commit", "-q", "-m", commit.message)
  check(git("log", "-1", "--format=%s") === "feat: add hello file", "the commit was created")

  // 5. Restart: the local session is still there.
  first.proc.kill("SIGTERM")
  await first.proc.exited
  const second = await serve(albert.url)
  const sessions = await second.call("GET", "/session")
  check(
    sessions.some((item: { id: string }) => item.id === session.id),
    "the session survives a restart",
  )
  const again = await second.call("GET", `/session/${session.id}/message`)
  check(again.length >= 2, "its messages survive a restart")
  second.proc.kill("SIGTERM")
  await second.proc.exited

  check(albert.calls.some((call) => call.path === "/v1/chat/completions"), "the fake Albert served the chat")
  albert.server.stop(true)

  // Negative check: a deliberate leak that bypasses the in-process guard. The
  // harness must report it (run.sh exits non-zero).
  if (process.env.E2E_LEAK === "1") {
    console.log("leak - spawning an unguarded process that resolves and connects to an external host")
    Bun.spawnSync([process.execPath, "-e", "await fetch('https://leak.example.org/').catch(() => {})"], {
      env: { PATH: process.env.PATH, HOME: home },
    })
  }
}

await main()
console.log("scenario passed")
