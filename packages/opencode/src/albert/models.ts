// Model discovery for the Albert provider: GET {base}/models, keep the chat
// models, cache the answer for offline starts. No model id is hard-coded.
import fs from "node:fs/promises"
import path from "node:path"
import type { Model } from "@kilocode/sdk/v2"
import { Schema } from "effect"
import { ID, dir } from "./catalog"

const item = Schema.Struct({
  id: Schema.String,
  type: Schema.optional(Schema.String),
  owned_by: Schema.optional(Schema.String),
  max_context_length: Schema.optional(Schema.NullOr(Schema.Number)),
  max_model_len: Schema.optional(Schema.NullOr(Schema.Number)),
  context_length: Schema.optional(Schema.NullOr(Schema.Number)),
  aliases: Schema.optional(Schema.NullOr(Schema.Array(Schema.String))),
})

const response = Schema.Struct({ data: Schema.Array(item) })
const decode = Schema.decodeUnknownSync(response)

type Item = typeof item.Type

// Albert also serves embeddings, transcription and reranking models; only
// models that answer /chat/completions are offered to the agent. A model
// without a type (other OpenAI-compatible servers) is assumed to be a chat model.
const chat = new Set(["text-generation", "image-text-to-text"])

function cache() {
  return path.join(dir(), "models.json")
}

function build(entry: Item, url: string): Model {
  const image = entry.type === "image-text-to-text"
  return {
    id: entry.id,
    providerID: ID,
    name: entry.id,
    api: { id: entry.id, url, npm: "@ai-sdk/openai-compatible" },
    status: "active",
    headers: {},
    options: {},
    cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
    limit: {
      context: entry.max_context_length ?? entry.max_model_len ?? entry.context_length ?? 0,
      output: 0,
    },
    capabilities: {
      temperature: true,
      reasoning: false,
      attachment: image,
      toolcall: true,
      input: { text: true, audio: false, image, video: false, pdf: false },
      output: { text: true, audio: false, image: false, video: false, pdf: false },
      interleaved: false,
    },
    release_date: "",
  }
}

export function parse(body: unknown, url: string) {
  return Object.fromEntries(
    decode(body)
      .data.filter((entry) => entry.type === undefined || chat.has(entry.type))
      .map((entry) => [entry.id, build(entry, url)]),
  )
}

export async function get(url: string, key: string | undefined) {
  const res = await fetch(`${url}/models`, {
    headers: key ? { Authorization: `Bearer ${key}` } : {},
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Albert /models answered HTTP ${res.status}`)
  const body: unknown = await res.json()
  const models = parse(body, url)
  await fs.mkdir(dir(), { recursive: true })
  await fs.writeFile(cache(), JSON.stringify(body))
  return models
}

export async function cached(url: string) {
  const text = await fs.readFile(cache(), "utf8").catch(() => undefined)
  if (!text) return {}
  return parse(JSON.parse(text), url)
}

export * as AlbertModels from "./models"
