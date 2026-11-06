// Single source of truth for the hosts Albert Code may reach at runtime.
// Everything else is refused by the guard (see guard.ts).

export const HOST = "albert.api.etalab.gouv.fr"
export const BASE = `https://${HOST}/v1`

// Hosts reachable on 443 besides loopback. Albert is the only entry; the
// base URL setting can move the path but never the host.
export const HOSTS: readonly string[] = [HOST]

const local = new Set(["file:", "data:", "blob:", "about:"])
const web = new Set(["http:", "https:", "ws:", "wss:"])

function bare(host: string) {
  return host.replace(/^\[|\]$/g, "").toLowerCase()
}

export function loopback(host: string) {
  const h = bare(host)
  if (h === "localhost" || h === "::1" || h === "0:0:0:0:0:0:0:1") return true
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true
  return /^::ffff:127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)
}

export function remote(host: string, port?: number | string) {
  const h = bare(host)
  if (!HOSTS.includes(h)) return false
  return port === undefined || port === "" || Number(port) === 443
}

// A URL is allowed when it stays on the machine, or targets Albert over TLS.
export function allowed(target: string | URL) {
  const url = (() => {
    if (target instanceof URL) return target
    if (!URL.canParse(target)) return undefined
    return new URL(target)
  })()
  if (!url) return false
  if (local.has(url.protocol)) return true
  if (!web.has(url.protocol)) return false
  if (loopback(url.hostname)) return true
  if (url.protocol !== "https:" && url.protocol !== "wss:") return false
  return remote(url.hostname, url.port)
}

// The Albert base URL may only point at Albert over HTTPS, or at loopback
// (the end-to-end test replaces Albert with a local OpenAI-compatible server).
export function permitted(url: URL) {
  if (url.username || url.password) return false
  if (url.protocol === "https:" && remote(url.hostname, url.port)) return true
  return (url.protocol === "http:" || url.protocol === "https:") && loopback(url.hostname)
}

export function base(env: Record<string, string | undefined> = process.env) {
  const raw = env.ALBERT_BASE_URL?.trim()
  if (!raw) return BASE
  if (!URL.canParse(raw)) throw new Error(`ALBERT_BASE_URL is not a valid URL`)
  const url = new URL(raw)
  if (!permitted(url)) throw new Error(`ALBERT_BASE_URL must target https://${HOST} (got ${url.origin})`)
  return url.toString().replace(/\/+$/, "")
}
