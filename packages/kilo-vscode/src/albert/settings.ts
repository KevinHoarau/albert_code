// Settings Albert Code pins regardless of user, workspace or policy values.
// They gate features that would reach a server other than Albert. The esbuild
// build routes every `vscode` import of the extension through ./vscode.ts,
// which applies them to workspace.getConfiguration().

export const forced: Readonly<Record<string, unknown>> = {
  "kilo-code.new.experimental.browserAutomation": false,
  "kilo-code.new.browserAutomation.enabled": false,
  "kilo-code.new.autocomplete.enableAutoTrigger": false,
  "kilo-code.new.autocomplete.enableChatAutocomplete": false,
  "kilo-code.new.autocomplete.enableSmartInlineTaskKeybinding": false,
  "kilo-code.new.indexing.showButtonWhenDisabled": false,
}

type Configuration = {
  get<T>(key: string, fallback?: T): T | undefined
  has(key: string): boolean
}

function join(section: string | undefined, key: string) {
  return section ? `${section}.${key}` : key
}

// Reads of a nested object (getConfiguration("kilo-code.new").get("browserAutomation"))
// get the pinned leaves merged in.
function nested(full: string, value: unknown) {
  const prefix = `${full}.`
  const leaves = Object.entries(forced).filter((entry) => entry[0].startsWith(prefix))
  if (leaves.length === 0) return value
  const out: Record<string, unknown> = value && typeof value === "object" ? { ...(value as object) } : {}
  for (const [key, pinned] of leaves) {
    const parts = key.slice(prefix.length).split(".")
    const last = parts.pop()!
    const parent = parts.reduce<Record<string, unknown>>((node, part) => {
      const next = node[part]
      node[part] = next && typeof next === "object" ? { ...(next as object) } : {}
      return node[part] as Record<string, unknown>
    }, out)
    parent[last] = pinned
  }
  return out
}

export function pin<T extends Configuration>(cfg: T, section?: string): T {
  return new Proxy(cfg, {
    get(target, prop, receiver) {
      if (prop === "get") {
        return (key: string, fallback?: unknown) => {
          const full = join(section, key)
          if (full in forced) return forced[full]
          return nested(full, target.get(key, fallback))
        }
      }
      return Reflect.get(target, prop, receiver)
    },
  })
}
