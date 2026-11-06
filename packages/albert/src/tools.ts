// Agent tools that reach a server other than Albert, or a Kilo service. The CLI
// removes them from the registry and the settings UI never offers them.
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
