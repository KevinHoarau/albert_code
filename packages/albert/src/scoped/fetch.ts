// Scoped replacements injected by esbuild into one bundle (see the VS Code
// extension's esbuild.js). The process globals stay untouched.
import { fetcher, socket } from "../guard"

const real = globalThis.fetch
export const fetch = fetcher(real)
export const WebSocket = globalThis.WebSocket ? socket(globalThis.WebSocket, "websocket") : undefined
