import { describe, expect, test } from "bun:test"
import { BASE, HOST, allowed, base, loopback, permitted } from "../src/policy"

describe("policy", () => {
  test("allows loopback on any port and protocol", () => {
    expect(allowed("http://127.0.0.1:4096/session")).toBe(true)
    expect(allowed("ws://localhost:1234/")).toBe(true)
    expect(allowed("http://[::1]:80/")).toBe(true)
    expect(loopback("127.5.6.7")).toBe(true)
  })

  test("allows Albert over TLS on 443 only", () => {
    expect(allowed(`https://${HOST}/v1/models`)).toBe(true)
    expect(allowed(`https://${HOST}:443/v1/models`)).toBe(true)
    expect(allowed(`http://${HOST}/v1/models`)).toBe(false)
    expect(allowed(`https://${HOST}:8443/v1/models`)).toBe(false)
  })

  test("refuses every other host", () => {
    for (const url of [
      "https://api.kilo.ai/api/profile",
      "https://ingest.kilosessions.ai/",
      "https://us.i.posthog.com/batch",
      "https://models.dev/api.json",
      "https://registry.npmjs.org/",
      "https://albert.api.etalab.gouv.fr.evil.example/v1",
      "https://evil.example/?u=https://albert.api.etalab.gouv.fr",
      "http://0.0.0.0:80/",
      "http://10.0.0.1/",
      "ftp://127.0.0.1/",
      "not a url",
    ]) {
      expect(allowed(url)).toBe(false)
    }
  })

  test("keeps local schemes", () => {
    expect(allowed("data:text/plain,hello")).toBe(true)
    expect(allowed("file:///tmp/x")).toBe(true)
  })

  test("base URL defaults to Albert and can only move to Albert or loopback", () => {
    expect(base({})).toBe(BASE)
    expect(base({ ALBERT_BASE_URL: `https://${HOST}/v2/` })).toBe(`https://${HOST}/v2`)
    expect(base({ ALBERT_BASE_URL: "http://127.0.0.1:9999/v1" })).toBe("http://127.0.0.1:9999/v1")
    expect(() => base({ ALBERT_BASE_URL: "https://api.openai.com/v1" })).toThrow()
    expect(() => base({ ALBERT_BASE_URL: `http://${HOST}/v1` })).toThrow()
    expect(() => base({ ALBERT_BASE_URL: "nope" })).toThrow()
    expect(permitted(new URL(`https://user:pw@${HOST}/v1`))).toBe(false)
  })
})
