// Minimal OpenAI-compatible server standing in for Albert in tests.
// It serves /v1/models and /v1/chat/completions (streaming or not) and
// scripts one tool call: a user message containing WRITE_FILE makes the model
// call the `write` tool, then answer once the tool result comes back.

type Message = { role: string; content?: unknown; tool_calls?: unknown[] }
type Body = { model: string; stream?: boolean; messages: Message[]; tools?: { function: { name: string } }[] }

export const MODEL = "fake-chat-model"

function text(content: unknown): string {
  if (typeof content === "string") return content
  if (Array.isArray(content)) return content.map((part) => (part as { text?: string }).text ?? "").join("")
  return ""
}

function reply(body: Body, dir: string) {
  const last = body.messages.at(-1)
  const prompt = body.messages.map((m) => text(m.content)).join("\n")
  const tools = new Set((body.tools ?? []).map((t) => t.function.name))
  if (last?.role === "user" && text(last.content).includes("WRITE_FILE") && tools.has("write")) {
    return {
      tool: {
        id: "call_e2e_1",
        name: "write",
        args: JSON.stringify({ filePath: `${dir}/hello.txt`, content: "hello from the fake model\n" }),
      },
    }
  }
  if (/commit message/i.test(prompt)) return { content: "feat: add hello file" }
  if (/title/i.test(prompt) && !tools.size) return { content: "E2E session" }
  if (last?.role === "tool") return { content: "The file has been written." }
  return { content: "Hello from the fake Albert server." }
}

export function start(opts: { port?: number; dir: string; log?: (line: string) => void }) {
  const calls: { path: string; model?: string }[] = []
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: opts.port ?? 0,
    async fetch(req): Promise<Response> {
      const url = new URL(req.url)
      opts.log?.(`${req.method} ${url.pathname}`)
      if (url.pathname === "/v1/models") {
        calls.push({ path: url.pathname })
        return Response.json({
          object: "list",
          data: [
            { id: MODEL, object: "model", owned_by: "test", type: "text-generation", max_context_length: 32768 },
            { id: "fake-embeddings", object: "model", owned_by: "test", type: "text-embeddings-inference" },
          ],
        })
      }
      if (url.pathname !== "/v1/chat/completions" || req.method !== "POST") {
        return new Response("not found", { status: 404 })
      }
      const body = (await req.json()) as Body
      calls.push({ path: url.pathname, model: body.model })
      const out = reply(body, opts.dir)
      const id = `chatcmpl-${calls.length}`
      const created = Math.floor(Date.now() / 1000)
      const usage = { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      const message = out.tool
        ? {
            role: "assistant",
            content: null,
            tool_calls: [{ id: out.tool.id, type: "function", function: { name: out.tool.name, arguments: out.tool.args } }],
          }
        : { role: "assistant", content: out.content }
      const finish = out.tool ? "tool_calls" : "stop"
      if (!body.stream) {
        return Response.json({
          id,
          object: "chat.completion",
          created,
          model: body.model,
          choices: [{ index: 0, message, finish_reason: finish }],
          usage,
        })
      }
      const chunks = [
        { choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }] },
        out.tool
          ? {
              choices: [
                {
                  index: 0,
                  delta: {
                    tool_calls: [
                      { index: 0, id: out.tool.id, type: "function", function: { name: out.tool.name, arguments: out.tool.args } },
                    ],
                  },
                  finish_reason: null,
                },
              ],
            }
          : { choices: [{ index: 0, delta: { content: out.content }, finish_reason: null }] },
        { choices: [{ index: 0, delta: {}, finish_reason: finish }], usage },
      ]
      const data = chunks
        .map((chunk) => `data: ${JSON.stringify({ id, object: "chat.completion.chunk", created, model: body.model, ...chunk })}\n\n`)
        .join("")
      return new Response(`${data}data: [DONE]\n\n`, { headers: { "content-type": "text/event-stream" } })
    },
  })
  return { server, calls, url: `http://127.0.0.1:${server.port}/v1` }
}

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 0)
  const fake = start({ port, dir: process.env.FAKE_DIR ?? process.cwd(), log: (line) => console.error(line) })
  console.log(fake.url)
}
