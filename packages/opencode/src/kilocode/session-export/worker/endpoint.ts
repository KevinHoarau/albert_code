// albert_change - session export removed: no upload endpoint
export const defaultEndpoint = ""

const hosts = new Set<string>()

export function resolveEndpoint(opts: { endpoint?: string; env?: string; allowCustom?: boolean }): string {
  const endpoint = opts.endpoint ?? opts.env ?? defaultEndpoint
  if (opts.allowCustom) return endpoint
  try {
    const url = new URL(endpoint)
    if (url.protocol !== "https:") return defaultEndpoint
    if (!hosts.has(url.hostname)) return defaultEndpoint
    return endpoint
  } catch {
    return defaultEndpoint
  }
}
