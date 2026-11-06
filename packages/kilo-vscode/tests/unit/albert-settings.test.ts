import { describe, expect, it } from "bun:test"
import { forced, pin } from "../../src/albert/settings"

// A configuration shaped like VS Code's: frozen, with non-configurable methods.
function config(values: Record<string, unknown>, section?: string) {
  const prefix = section ? `${section}.` : ""
  return Object.freeze({
    get: (key: string, fallback?: unknown) => values[prefix + key] ?? fallback,
    has: (key: string) => prefix + key in values,
  })
}

describe("albert pinned settings", () => {
  it("overrides pinned keys on a frozen configuration", () => {
    const cfg = pin(config({ "kilo-code.new.browserAutomation.enabled": true }, "kilo-code.new.browserAutomation"), "kilo-code.new.browserAutomation")
    expect(cfg.get("enabled", true)).toBe(false)
    expect(cfg.has("enabled")).toBe(true)
  })

  it("leaves other keys alone", () => {
    const cfg = pin(config({ "kilo-code.new.fontSize": 15 }, "kilo-code.new"), "kilo-code.new")
    expect(cfg.get("fontSize", 13)).toBe(15)
    expect(cfg.get("missing", "x")).toBe("x")
  })

  it("pins leaves inside nested objects", () => {
    const cfg = pin(
      config({ "kilo-code.new.experimental": { browserAutomation: true, other: 1 } }, "kilo-code"),
      "kilo-code",
    )
    expect(cfg.get("new.experimental")).toEqual({ browserAutomation: false, other: 1 })
  })

  it("pins every removed feature off", () => {
    for (const value of Object.values(forced)) expect(value).toBe(false)
  })
})
