import path from "path"
import { fileURLToPath } from "url"
import { parseModelsSnapshot } from "../src/kilocode/provider/models-snapshot-shape" // kilocode_change

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dir = path.resolve(__dirname, "..")

process.chdir(dir)

const modelsUrl = process.env.KILO_MODELS_URL || "https://models.dev"
// kilocode_change start
const cacheFile = path.resolve(dir, "node_modules/.cache/models-dev-api.json")
// albert_change start - the embedded snapshot only declares Albert; models come from /v1/models
const { provider } = await import("../src/albert/catalog")
const albert = JSON.stringify({ albert: provider() })
// albert_change end
const raw = await (async () => {
  if (!process.env.MODELS_DEV_API_JSON) return albert // albert_change
  if (process.env.MODELS_DEV_API_JSON) {
    return await Bun.file(process.env.MODELS_DEV_API_JSON).text()
  }
  const cached = Bun.file(cacheFile)
  try {
    if (await cached.exists()) {
      const st = await cached.stat()
      if (st && Date.now() - st.mtimeMs < 6 * 3600 * 1000) {
        return await cached.text()
      }
    }
  } catch (err) {
    console.warn("[generate] cache read check failed, fetching live", err)
  }
  try {
    const res = await fetch(`${modelsUrl}/api.json`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) throw new Error(`Failed to fetch models.dev snapshot: HTTP ${res.status}`)
    const text = await res.text()
    try {
      await Bun.write(cacheFile, text)
    } catch (err) {
      console.warn("[generate] cache write failed", err)
    }
    return text
  } catch (err) {
    try {
      if (await cached.exists()) return await cached.text()
    } catch (fallbackErr) {
      console.warn("[generate] cache fallback read failed", fallbackErr)
    }
    throw err
  }
})()
export const modelsData = raw === albert ? albert : JSON.stringify(parseModelsSnapshot(raw).data) // albert_change - no model to validate
// kilocode_change end
console.log("Loaded models.dev snapshot")
