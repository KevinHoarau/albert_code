// Applies the guard to the whole process. Only for processes Albert Code owns
// (the embedded CLI and its workers): import this module before anything else
// so that no client can capture an unwrapped reference.

import dgram from "node:dgram"
import dns from "node:dns"
import http from "node:http"
import https from "node:https"
import { syncBuiltinESMExports } from "node:module"
import net from "node:net"
import tls from "node:tls"
import {
  connector,
  datagram,
  fetcher,
  getter,
  lookuper,
  reachable,
  report,
  requester,
  resolver,
  socket,
} from "./guard"

const mark = Symbol.for("albert-code.guard")

type Fn = (...args: never[]) => unknown

function patch(target: object | undefined, key: string, wrap: (real: Fn) => unknown) {
  if (!target) return
  const real = Reflect.get(target, key)
  if (typeof real !== "function") return
  const desc = Object.getOwnPropertyDescriptor(target, key)
  if (desc && !desc.writable && !desc.configurable) {
    // Bun.fetch is frozen; static checks (test/static.test.ts) forbid its use.
    unguarded.push(key)
    return
  }
  if (Reflect.set(target, key, wrap(real as Fn))) return
  Object.defineProperty(target, key, { value: wrap(real as Fn), configurable: true, writable: true })
}

// Entry points the runtime refuses to let us wrap.
export const unguarded: string[] = []

const resolvers = Object.keys(dns).filter((key) => key.startsWith("resolve") || key === "reverse")

export function install() {
  if (Reflect.get(globalThis, mark)) return
  Reflect.set(globalThis, mark, true)

  patch(globalThis, "fetch", (real) => fetcher(real))
  patch(globalThis, "WebSocket", (real) => socket(real as never, "websocket"))
  patch(globalThis, "EventSource", (real) => socket(real as never, "eventsource"))

  for (const [mod, proto] of [
    [http, "http:"],
    [https, "https:"],
  ] as const) {
    patch(mod, "request", (real) => requester(real, proto))
    patch(mod, "get", () => getter(Reflect.get(mod, "request") as Fn))
  }

  patch(net, "connect", (real) => connector(real, "tcp"))
  patch(net, "createConnection", (real) => connector(real, "tcp"))
  patch(net.Socket.prototype, "connect", (real) => connector(real, "tcp"))
  patch(tls, "connect", (real) => connector(real, "tls"))

  patch(dns, "lookup", (real) => lookuper(real))
  patch(dns.promises, "lookup", (real) => resolver(real))
  for (const key of resolvers) {
    patch(dns, key, (real) => resolver(real))
    patch(dns.promises, key, (real) => resolver(real))
    patch(dns.Resolver.prototype, key, (real) => resolver(real))
    patch(dns.promises.Resolver.prototype, key, (real) => resolver(real))
  }

  patch(dgram.Socket.prototype, "send", (real) => datagram(real, "send"))
  patch(dgram.Socket.prototype, "connect", (real) => datagram(real, "connect"))

  const bun = Reflect.get(globalThis, "Bun") as object | undefined
  if (bun) {
    patch(bun, "fetch", (real) => fetcher(real))
    patch(bun, "connect", (real) => (opts: { hostname?: string; port?: number; unix?: string }) => {
      const host = opts?.hostname ?? "localhost"
      if (!opts?.unix && !reachable(host, opts?.port)) throw report("tcp", `${host}:${opts?.port ?? ""}`)
      return Reflect.apply(real, bun, [opts])
    })
    patch(Reflect.get(bun, "dns") as object | undefined, "lookup", (real) => resolver(real))
  }

  syncBuiltinESMExports()
}
