// Applied to the merged configuration after every source has been read, so no
// user, project or managed file can re-enable a remote feature.
import type { Config } from "@/config/config"
import { active } from "@albert-code/guard/env"
import { base } from "@albert-code/guard/policy"
import { ID, KEY } from "./catalog"

// Tools that reach a server other than Albert, or a Kilo service.
export const TOOLS: readonly string[] = [
  "webfetch",
  "websearch",
  "codesearch",
  "repo_clone",
  "repo_overview",
  "generate_image",
  "browser_open",
  "notify_user",
  "send_file",
  "link_pr",
  "semantic_search",
  "execute",
]

const remote = /^[a-z][a-z0-9+.-]*:\/\//i

function own(model: string | null | undefined) {
  if (model == null) return model
  return model.startsWith(`${ID}/`) ? model : undefined
}

export function enforce(cfg: Config.Info) {
  cfg.enabled_providers = [ID]
  cfg.disabled_providers = (cfg.disabled_providers ?? []).filter((id) => id !== ID)
  const current = cfg.provider?.[ID]
  cfg.provider = {
    [ID]: {
      ...current,
      name: "Albert",
      npm: "@ai-sdk/openai-compatible",
      api: base(),
      env: [KEY],
      options: { ...current?.options, baseURL: base() },
    },
  }
  cfg.model = own(cfg.model)
  cfg.small_model = own(cfg.small_model)
  cfg.subagent_model = own(cfg.subagent_model)
  cfg.memory_model = own(cfg.memory_model)

  cfg.share = "disabled"
  cfg.autoshare = false
  cfg.autoupdate = false
  cfg.remote_control = false
  cfg.web_search = false
  cfg.enterprise = undefined
  cfg.instructions = cfg.instructions?.filter((item) => !remote.test(item))
  if (cfg.skills) cfg.skills = { ...cfg.skills, urls: [] }
  cfg.mcp = Object.fromEntries(
    Object.entries(cfg.mcp ?? {}).filter((entry) => {
      const value = entry[1] as { type?: string } | null
      return value == null || value.type === "local"
    }),
  ) as Config.Info["mcp"]

  cfg.tools = { ...cfg.tools, ...Object.fromEntries(TOOLS.map((id) => [id, false])) }
  // The guard cannot see what shell commands do: every command asks first
  // unless the user explicitly configured bash permissions.
  cfg.permission = { ...cfg.permission, bash: cfg.permission?.bash ?? "ask" }
  return cfg
}

export function apply(cfg: Config.Info) {
  return active() ? enforce(cfg) : cfg
}

export function keep(tool: { id: string }) {
  return !active() || !TOOLS.includes(tool.id)
}

export * as AlbertConfig from "./config"
