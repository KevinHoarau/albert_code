// Messages of the "Albert" settings tab. The key never travels back to the
// webview: only where it comes from.
import * as vscode from "vscode"
import { BASE, base } from "@albert-code/guard/policy"
import * as Key from "./key"

type Post = (message: unknown) => void
type Message = { type?: unknown; key?: unknown; url?: unknown }

async function status(context: vscode.ExtensionContext, error?: string) {
  const url = vscode.workspace.getConfiguration().get<string>(Key.SETTING, BASE)?.trim() || BASE
  return { type: "albertStatus", key: await Key.source(context), url, default: BASE, error }
}

export async function handle(message: Message, context: vscode.ExtensionContext | undefined, post: Post) {
  if (!context) return false
  if (message.type === "requestAlbertStatus") {
    post(await status(context))
    return true
  }
  if (message.type === "setAlbertKey" && typeof message.key === "string") {
    await Key.store(context, message.key)
    post(await status(context))
    return true
  }
  if (message.type === "setAlbertUrl" && typeof message.url === "string") {
    const url = message.url.trim() || BASE
    const error = (() => {
      try {
        base({ ALBERT_BASE_URL: url })
        return undefined
      } catch (err) {
        return err instanceof Error ? err.message : String(err)
      }
    })()
    if (!error) {
      const value = url === BASE ? undefined : url
      await vscode.workspace.getConfiguration().update(Key.SETTING, value, vscode.ConfigurationTarget.Global)
    }
    post(await status(context, error))
    return true
  }
  return false
}
