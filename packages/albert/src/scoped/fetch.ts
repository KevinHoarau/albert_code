// Scoped replacements injected by esbuild into one bundle (see the VS Code
// extension's esbuild.js). The process globals stay untouched.
import { fetcher, socket } from "../guard"

// Read through Reflect: the build defines `globalThis.fetch` as the guarded one.
const real = Reflect.get(globalThis, "fetch") as typeof globalThis.fetch
export const fetch = fetcher(real)
const ws = Reflect.get(globalThis, "WebSocket") as typeof globalThis.WebSocket | undefined
export const WebSocket = ws ? socket(ws, "websocket") : undefined
