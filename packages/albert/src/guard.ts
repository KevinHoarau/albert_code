// Wrappers that refuse and log every outbound connection outside the policy.
// They never mutate anything by themselves: install.ts applies them to the
// process globals (CLI), and scoped/* applies them to one esbuild bundle
// (VS Code extension host, which is shared with other extensions).

import { appendFileSync } from "node:fs"
import { isIP } from "node:net"
import { HOSTS, allowed, loopback, remote } from "./policy"

export type Entry = { kind: string; target: string; time: string }

export const CODE = "ALBERT_NETWORK_BLOCKED"

export class Blocked extends Error {
  readonly code = CODE
  constructor(
    readonly kind: string,
    readonly target: string,
  ) {
    super(`Albert Code blocked outbound ${kind} to ${target}`)
    this.name = "AlbertNetworkBlocked"
  }
}

const seen: Entry[] = []
// Addresses returned by an allowed DNS lookup, so that a client which resolves
// first and then connects by IP still reaches Albert.
const ips = new Set<string>()

export function blocked() {
  return seen.slice()
}

// Query strings may carry tokens: only the origin and the path are logged.
function redact(target: string) {
  if (!target.includes("://") || !URL.canParse(target)) return target
  const url = new URL(target)
  return `${url.protocol}//${url.host}${url.pathname}`
}

export function report(kind: string, target: string) {
  const entry = { kind, target: redact(target), time: new Date().toISOString() }
  seen.push(entry)
  process.stderr.write(`[albert-guard] blocked ${entry.kind} ${entry.target}\n`)
  const file = process.env.ALBERT_GUARD_LOG
  if (file) {
    try {
      appendFileSync(file, JSON.stringify(entry) + "\n")
    } catch (err) {
      process.stderr.write(`[albert-guard] cannot write ${file}: ${String(err)}\n`)
    }
  }
  return new Blocked(entry.kind, entry.target)
}

function bare(host: string) {
  return host.replace(/^\[|\]$/g, "").toLowerCase()
}

export function reachable(host: string, port?: number | string) {
  if (loopback(host)) return true
  if (remote(host, port)) return true
  return ips.has(bare(host)) && (port === undefined || Number(port) === 443)
}

export function resolvable(host: string) {
  const h = bare(host)
  if (loopback(h) || HOSTS.includes(h)) return true
  return isIP(h) !== 0 && ips.has(h)
}

function remember(result: unknown) {
  if (typeof result === "string") return void ips.add(bare(result))
  if (!Array.isArray(result)) return
  for (const item of result) {
    if (typeof item === "string") ips.add(bare(item))
    if (item && typeof item === "object" && "address" in item && typeof item.address === "string") {
      ips.add(bare(item.address))
    }
  }
}

type Fn = (...args: never[]) => unknown
type Any = (...args: unknown[]) => unknown

function href(input: unknown) {
  if (typeof input === "string") return input
  if (input instanceof URL) return input.href
  if (input && typeof input === "object" && "url" in input && typeof input.url === "string") return input.url
  return String(input)
}

const moved = new Set([301, 302, 303, 307, 308])

// fetch follows redirects on its own, which would let an allowed host bounce
// a request anywhere. Redirects are followed here, one hop at a time, and
// each hop goes through the policy.
export function fetcher<T extends Fn>(real: T): T {
  const call = real as unknown as (input: unknown, init?: RequestInit) => Promise<Response>
  const go = async (input: unknown, init: RequestInit | undefined, hops: number): Promise<Response> => {
    const url = href(input)
    if (!allowed(url)) throw report("fetch", url)
    if (init?.redirect === "manual" || init?.redirect === "error") return call(input, init)
    const res = await call(input, { ...init, redirect: "manual" })
    const loc = res.headers.get("location")
    if (!moved.has(res.status) || !loc) return res
    const next = new URL(loc, url)
    if (!allowed(next)) throw report("redirect", next.href)
    if (hops >= 20) throw new TypeError("Too many redirects")
    const method = (init?.method ?? "GET").toUpperCase()
    const keep = res.status === 307 || res.status === 308 || method === "GET" || method === "HEAD"
    return go(next.href, keep ? init : { ...init, method: "GET", body: undefined }, hops + 1)
  }
  const wrapped = (input: unknown, init?: RequestInit) => go(input, init, 0)
  const preconnect = Reflect.get(real, "preconnect")
  if (typeof preconnect === "function") {
    Reflect.set(wrapped, "preconnect", (url: unknown, ...rest: unknown[]) => {
      if (!allowed(href(url))) throw report("preconnect", href(url))
      return Reflect.apply(preconnect, real, [url, ...rest])
    })
  }
  return wrapped as unknown as T
}

// WebSocket and EventSource constructors.
export function socket<T extends abstract new (...args: never[]) => unknown>(real: T, kind: string): T {
  return new Proxy(real, {
    construct(target, args, next) {
      const url = href(args[0])
      if (!allowed(url)) throw report(kind, url)
      return Reflect.construct(target, args, next)
    },
  })
}

type Opts = {
  protocol?: string | null
  host?: string | null
  hostname?: string | null
  port?: number | string | null
  socketPath?: string | null
  path?: string | null
}

function options(value: unknown): Opts | undefined {
  if (!value || typeof value !== "object" || value instanceof URL) return undefined
  return value as Opts
}

// http(s).request(url, options?, cb?) / request(options, cb?)
function destination(args: unknown[], protocol: string) {
  const first = args[0]
  const url = typeof first === "string" || first instanceof URL ? new URL(href(first)) : undefined
  const opts = options(url ? args[1] : first)
  if (opts?.socketPath) return undefined
  const proto = opts?.protocol ?? url?.protocol ?? protocol
  const host = opts?.hostname ?? opts?.host ?? url?.hostname ?? "localhost"
  const port = opts?.port ?? (url?.port || undefined)
  const shown = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host
  return `${proto}//${shown}${port ? `:${port}` : ""}/`
}

export function requester<T extends Fn>(real: T, protocol: "http:" | "https:"): T {
  return function (this: unknown, ...args: unknown[]) {
    const target = destination(args, protocol)
    if (target !== undefined && !allowed(target)) throw report(protocol.slice(0, -1), target)
    return Reflect.apply(real as unknown as Any, this, args)
  } as unknown as T
}

// http(s).get uses the module-internal request, so it is rebuilt on top of
// the wrapped one.
export function getter<T extends Fn>(request: Fn): T {
  return function (this: unknown, ...args: unknown[]) {
    const req = Reflect.apply(request as unknown as Any, this, args) as { end: () => void }
    req.end()
    return req
  } as unknown as T
}

// net.connect / net.createConnection / Socket#connect / tls.connect
function endpoint(raw: unknown[]) {
  const args = Array.isArray(raw[0]) ? (raw[0] as unknown[]) : raw
  const opts = options(args[0])
  if (opts) {
    if (opts.path) return undefined
    return { host: opts.host ?? "localhost", port: opts.port ?? undefined }
  }
  const first = args[0]
  if (typeof first === "string" && !/^\d+$/.test(first)) return undefined
  const host = typeof args[1] === "string" ? args[1] : "localhost"
  return { host, port: first as number | string }
}

export function connector<T extends Fn>(real: T, kind: string): T {
  return function (this: unknown, ...args: unknown[]) {
    const target = endpoint(args)
    if (target && !reachable(target.host, target.port ?? undefined)) {
      throw report(kind, `${target.host}:${target.port ?? ""}`)
    }
    return Reflect.apply(real as unknown as Any, this, args)
  } as unknown as T
}

// dns.lookup(host, options?, callback)
export function lookuper<T extends Fn>(real: T): T {
  return function (this: unknown, host: unknown, ...rest: unknown[]) {
    const cb = rest.at(-1)
    if (typeof cb !== "function") return Reflect.apply(real as unknown as Any, this, [host, ...rest])
    if (typeof host === "string" && resolvable(host)) {
      const done = (err: unknown, addr: unknown, family: unknown) => {
        if (!err) remember(addr)
        Reflect.apply(cb, undefined, [err, addr, family])
      }
      return Reflect.apply(real as unknown as Any, this, [host, ...rest.slice(0, -1), done])
    }
    const err = report("dns", String(host))
    process.nextTick(() => Reflect.apply(cb, undefined, [err]))
    return {}
  } as unknown as T
}

// dns.promises.lookup, Bun.dns.lookup and every resolve* variant
export function resolver<T extends Fn>(real: T): T {
  return function (this: unknown, host: unknown, ...rest: unknown[]) {
    if (typeof host !== "string" || !resolvable(host)) {
      const err = report("dns", String(host))
      const cb = rest.at(-1)
      if (typeof cb === "function") {
        process.nextTick(() => Reflect.apply(cb, undefined, [err]))
        return undefined
      }
      return Promise.reject(err)
    }
    const out = Reflect.apply(real as unknown as Any, this, [host, ...rest])
    if (out instanceof Promise) return out.then((addr) => (remember(addr), addr))
    return out
  } as unknown as T
}

// dgram Socket#send / Socket#connect: UDP is only allowed on loopback.
export function datagram<T extends Fn>(real: T, kind: "send" | "connect"): T {
  return function (this: unknown, ...args: unknown[]) {
    const address = (() => {
      if (kind === "connect") return typeof args[1] === "string" ? args[1] : undefined
      if (typeof args[2] === "number") return typeof args[4] === "string" ? args[4] : undefined
      return typeof args[2] === "string" ? args[2] : undefined
    })()
    if (address !== undefined && !loopback(address)) throw report("udp", address)
    return Reflect.apply(real as unknown as Any, this, args)
  } as unknown as T
}
