// Albert Code identifiers. The sources keep Kilo's VS Code identifiers
// (kilo-code.new.*) to stay close to upstream; the packaged extension renames
// them so it can be installed next to Kilo Code without sharing a command,
// view, view container, panel type, context key, setting or task type, nor the
// Agent Manager state of a project (.kilo/agent-manager.json).
import manifest from "../package.json"

// The extension looks itself up by Kilo's extension id (version, keybindings,
// settings reset): in the package that id must be Albert Code's own.
const self = `${manifest.publisher}.${manifest.name}`

export function ids(text: string) {
  return text
    .replace(/(["'`])kilocode\.kilo-code\1/g, `$1${self}$1`)
    .replace(/kilo-code\.new\b/g, "albert-code")
    .replace(/kilo-code(?=\.SidebarProvider|-ActivityBar|\.agentTerminalFocus|\.nextEdit)/g, "albert-code")
    .replace(/kilo-worktree-(?=setup|run)/g, "albert-worktree-")
    .replace(/(?<![\w-])agent-manager\.json/g, "albert-agent-manager.json")
}

// Identifiers a manifest contributes to VS Code.
export function contributed(manifest: { contributes?: Record<string, unknown> }): string[] {
  const c = (manifest.contributes ?? {}) as Record<string, unknown>
  const list = (value: unknown) => (Array.isArray(value) ? (value as Record<string, unknown>[]) : [])
  const config = Array.isArray(c.configuration) ? c.configuration : [c.configuration ?? {}]
  return [
    ...list(c.commands).map((item) => String(item.command)),
    ...list(c.submenus).map((item) => String(item.id)),
    ...list(c.keybindings).map((item) => String(item.command)),
    ...list(c.taskDefinitions).map((item) => String(item.type)),
    ...Object.values((c.viewsContainers ?? {}) as Record<string, unknown>).flatMap((group) =>
      list(group).map((item) => String(item.id)),
    ),
    ...Object.keys((c.views ?? {}) as Record<string, unknown>),
    ...Object.values((c.views ?? {}) as Record<string, unknown>).flatMap((group) =>
      list(group).map((item) => String(item.id)),
    ),
    ...(config as { properties?: Record<string, unknown> }[]).flatMap((block) => Object.keys(block.properties ?? {})),
  ]
}
