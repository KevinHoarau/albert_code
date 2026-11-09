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

// Where the key comes from, without ever exposing it.
export async function source(context: vscode.ExtensionContext): Promise<"secret" | "env" | "none"> {
  if (await context.secrets.get(SECRET)) return "secret"
  if (process.env.ALBERT_API_KEY?.trim()) return "env"
  return "none"
}

export async function store(context: vscode.ExtensionContext, value: string) {
  if (value.trim()) return context.secrets.store(SECRET, value.trim())
  return context.secrets.delete(SECRET)
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

// The CLI reads the key and URL at startup: a change restarts it. Changes are
// applied one after the other so a quick edit never races a restart.
function apply(restart: () => Promise<void>) {
  let queue = Promise.resolve()
  return () => {
    queue = queue
      .then(restart)
      .then(() => {
        vscode.window.setStatusBarMessage("Albert Code: new Albert settings applied.", 5000)
      })
      .catch((err) => {
        console.error("[Albert Code] Backend restart failed:", err)
        void vscode.window.showErrorMessage("Albert Code: the backend did not restart with the new Albert settings.")
      })
  }
}

export function register(context: vscode.ExtensionContext, restart: () => Promise<void>) {
  const changed = apply(restart)
  context.subscriptions.push(
    vscode.commands.registerCommand("kilo-code.new.setAlbertApiKey", async () => {
      const value = await vscode.window.showInputBox({
        title: "Albert API key",
        prompt: "Stored in VS Code SecretStorage. Leave empty to remove it.",
        password: true,
        ignoreFocusOut: true,
      })
      if (value === undefined) return
      await store(context, value)
    }),
    context.secrets.onDidChange((event) => {
      if (event.key === SECRET) changed()
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(SETTING)) changed()
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
