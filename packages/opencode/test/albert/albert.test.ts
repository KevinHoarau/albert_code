// albert_change - new file
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { AlbertConfig } from "../../src/albert/config"
import { AlbertModels } from "../../src/albert/models"
import { provider } from "../../src/albert/catalog"
import type { Config } from "../../src/config/config"

const saved = { ...process.env }

beforeEach(() => {
  process.env.ALBERT_CODE = "1"
  delete process.env.ALBERT_BASE_URL
})

afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]
  Object.assign(process.env, saved)
})

describe("albert config", () => {
  test("keeps only the Albert provider, local MCP servers and local instructions", () => {
    const cfg = AlbertConfig.apply({
      enabled_providers: ["kilo", "openai"],
      disabled_providers: ["albert"],
      provider: { openai: { options: { apiKey: "x" } }, albert: { options: { timeout: 5 } } },
      model: "openai/gpt-5",
      small_model: "albert/some-model",
      share: "auto",
      autoupdate: true,
      instructions: ["https://example.com/rules.md", "docs/rules.md"],
      mcp: {
        remote: { type: "remote", url: "https://mcp.example.com" },
        local: { type: "local", command: ["node", "server.js"] },
      },
      permission: {},
    } as unknown as Config.Info)
    expect(cfg.enabled_providers).toEqual(["albert"])
    expect(cfg.disabled_providers).toEqual([])
    expect(Object.keys(cfg.provider ?? {})).toEqual(["albert"])
    expect(cfg.provider?.albert?.options?.baseURL).toBe("https://albert.api.etalab.gouv.fr/v1")
    expect(cfg.provider?.albert?.options?.timeout).toBe(5)
    expect(cfg.model).toBeUndefined()
    expect(cfg.small_model).toBe("albert/some-model")
    expect(cfg.share).toBe("disabled")
    expect(cfg.autoupdate).toBe(false)
    expect(cfg.instructions).toEqual(["docs/rules.md"])
    expect(Object.keys(cfg.mcp ?? {})).toEqual(["local"])
    expect(cfg.tools?.webfetch).toBe(false)
    expect(cfg.tools?.websearch).toBe(false)
    expect(cfg.permission?.bash).toBe("ask")
  })

  test("respects an explicit bash permission", () => {
    const cfg = AlbertConfig.apply({ permission: { bash: { "git status": "allow" } } } as unknown as Config.Info)
    expect(cfg.permission?.bash).toEqual({ "git status": "allow" })
  })

  test("refuses a base URL outside the allowlist", () => {
    process.env.ALBERT_BASE_URL = "https://api.openai.com/v1"
    expect(() => AlbertConfig.apply({} as Config.Info)).toThrow()
  })

  test("drops network tools", () => {
    expect(AlbertConfig.keep({ id: "webfetch" })).toBe(false)
    expect(AlbertConfig.keep({ id: "websearch" })).toBe(false)
    expect(AlbertConfig.keep({ id: "repo_clone" })).toBe(false)
    expect(AlbertConfig.keep({ id: "bash" })).toBe(true)
    expect(AlbertConfig.keep({ id: "write" })).toBe(true)
  })

  test("is inert outside an Albert Code entry point", () => {
    delete process.env.ALBERT_CODE
    const cfg = AlbertConfig.apply({ share: "auto" } as Config.Info)
    expect(cfg.share).toBe("auto")
    expect(AlbertConfig.keep({ id: "webfetch" })).toBe(true)
  })
})

describe("albert models", () => {
  test("keeps chat models from /v1/models and ignores the others", () => {
    const models = AlbertModels.parse(
      {
        data: [
          { id: "chat-a", type: "text-generation", max_context_length: 128000 },
          { id: "vision-b", type: "image-text-to-text" },
          { id: "embed-c", type: "text-embeddings-inference" },
          { id: "asr-d", type: "automatic-speech-recognition" },
          { id: "plain-e" },
        ],
      },
      "https://albert.api.etalab.gouv.fr/v1",
    )
    expect(Object.keys(models).sort()).toEqual(["chat-a", "plain-e", "vision-b"])
    expect(models["chat-a"]?.limit.context).toBe(128000)
    expect(models["vision-b"]?.capabilities.input.image).toBe(true)
    expect(models["chat-a"]?.api.npm).toBe("@ai-sdk/openai-compatible")
  })

  test("the local catalog declares Albert without any model", () => {
    expect(provider().models).toEqual({})
    expect(provider().api).toBe("https://albert.api.etalab.gouv.fr/v1")
  })
})
