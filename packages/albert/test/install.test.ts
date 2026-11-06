import { expect, test } from "bun:test"
import path from "node:path"

// install() mutates process globals, so it runs in a child process.
const script = `
import { install } from ${JSON.stringify(path.join(import.meta.dir, "../src/install.ts"))}
install()
import http from "node:http"
import https from "node:https"
import net from "node:net"
import dns from "node:dns"
const results = {}
const probe = async (name, fn) => {
  try { await fn(); results[name] = "allowed" } catch (err) { results[name] = err?.code ?? String(err) }
}
await probe("fetch", () => fetch("https://exfil.invalid/"))
await probe("http", () => http.get("http://exfil.invalid/"))
await probe("https", () => https.request("https://exfil.invalid/"))
await probe("net", () => net.connect(443, "exfil.invalid"))
await probe("socket", () => new net.Socket().connect(443, "exfil.invalid"))
await probe("websocket", () => new WebSocket("wss://exfil.invalid/"))
await probe("dns", () => dns.promises.lookup("exfil.invalid"))
await probe("bunconnect", () => Bun.connect({ hostname: "exfil.invalid", port: 443, socket: { data() {} } }))
const srv = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => new Response("ok") })
await probe("loopback", async () => { if ((await (await fetch("http://127.0.0.1:" + srv.port)).text()) !== "ok") throw new Error("bad") })
srv.stop(true)
console.log(JSON.stringify(results))
`

test("install() guards every client of the process", async () => {
  const proc = Bun.spawn([process.execPath, "-e", script], { stdout: "pipe", stderr: "pipe" })
  const out = await new Response(proc.stdout).text()
  const err = await new Response(proc.stderr).text()
  await proc.exited
  const results = JSON.parse(out.trim().split("\n").at(-1) ?? "{}")
  for (const key of ["fetch", "http", "https", "net", "socket", "websocket", "dns", "bunconnect"]) {
    expect({ key, value: results[key] }).toEqual({ key, value: "ALBERT_NETWORK_BLOCKED" })
  }
  expect(results.loopback).toBe("allowed")
  expect(err).toContain("[albert-guard] blocked")
})
