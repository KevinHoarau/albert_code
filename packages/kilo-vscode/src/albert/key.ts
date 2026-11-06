// Albert API key and base URL. The key lives in VS Code SecretStorage, with
// ALBERT_API_KEY from the environment as a fallback. It is only ever handed to
// the CLI through its environment and is never logged.
import * as vscode from "vscode"
import { BASE, base } from "@albert-code/guard/policy"

const SECRET = "albert-code.apiKey"
export const SETTING = "albertCode.apiBaseUrl"

export async function read(context: vscode.ExtensionContext) {
  return (await context.secrets.get(SECRET)) || process.env.ALBERT_API_KEY?.trim() || undefined
}

export function url() {
  const value = vscode.workspace.getConfiguration().get<string>(SETTING, BASE)?.trim()
  return base({ ALBERT_BASE_URL: value || BASE })
}

// Albert variables for `kilo serve`. The caller passes the whole child
// environment through `child()` from @albert-code/guard/env, which also drops
// Kilo endpoints and credentials and forces the kill switches.
export async function vars(context: vscode.ExtensionContext): Promise<Record<string, string>> {
  const key = await read(context)
  return { ALBERT_BASE_URL: url(), ...(key && { ALBERT_API_KEY: key }) }
}

// The CLI reads the key and URL at startup, so a change asks for a reload.
async function reload() {
  const choice = await vscode.window.showInformationMessage(
    "Albert Code: reload the window to apply the new Albert settings.",
    "Reload",
  )
  if (choice === "Reload") await vscode.commands.executeCommand("workbench.action.reloadWindow")
}

export function register(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("kilo-code.new.setAlbertApiKey", async () => {
      const value = await vscode.window.showInputBox({
        title: "Albert API key",
        prompt: "Stored in VS Code SecretStorage. Leave empty to remove it.",
        password: true,
        ignoreFocusOut: true,
      })
      if (value === undefined) return
      if (value.trim()) await context.secrets.store(SECRET, value.trim())
      if (!value.trim()) await context.secrets.delete(SECRET)
    }),
    context.secrets.onDidChange((event) => {
      if (event.key === SECRET) void reload()
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(SETTING)) void reload()
    }),
  )
  void read(context).then(async (key) => {
    if (key) return
    const choice = await vscode.window.showInformationMessage(
      "Albert Code needs an Albert API key to reach albert.api.etalab.gouv.fr.",
      "Set API key",
    )
    if (choice === "Set API key") await vscode.commands.executeCommand("kilo-code.new.setAlbertApiKey")
  })
}
