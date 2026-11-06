// Local model catalog. It only declares the Albert provider: model ids are
// never hard-coded and come from GET /v1/models (see models.ts), with the last
// successful answer cached on disk for offline starts.
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { base } from "@albert-code/guard/policy"

export const ID = "albert"
export const KEY = "ALBERT_API_KEY"

export function dir() {
  const root = process.env.XDG_CACHE_HOME?.trim() || path.join(os.homedir(), ".cache")
  return path.join(root, "albert-code")
}

export function provider() {
  return {
    id: ID,
    name: "Albert",
    description: "Albert API (OpenAI-compatible)",
    env: [KEY],
    npm: "@ai-sdk/openai-compatible",
    api: base(),
    models: {},
  }
}

// Written synchronously at startup, before ModelsDev reads KILO_MODELS_PATH.
export function write() {
  const file = path.join(dir(), "catalog.json")
  fs.mkdirSync(dir(), { recursive: true })
  fs.writeFileSync(file, JSON.stringify({ [ID]: provider() }, null, 2))
  return file
}
