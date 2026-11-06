import { describe, expect, it } from "bun:test"
import { brand } from "../../src/albert/brand"
import { resolveTemplate } from "../../webview-ui/src/context/language-utils"

describe("albert brand", () => {
  it("renames the product in UI strings", () => {
    expect(brand("Welcome to Kilo")).toBe("Welcome to Albert Code")
    expect(brand("Kilo pauses and shows you its plan")).toBe("Albert Code pauses and shows you its plan")
    expect(brand("Start Kilo Code with auto-approve")).toBe("Start Albert Code with auto-approve")
    expect(brand("Kilo's settings")).toBe("Albert Code's settings")
  })

  it("leaves keys, paths and identifiers alone", () => {
    for (const text of [".kilo/agent-manager.json", "kilo-code.new.fontSize", "aboutKiloCode", "@kilocode/sdk", "kilo serve"]) {
      expect(brand(text)).toBe(text)
    }
  })

  it("is applied to every resolved webview string", () => {
    expect(resolveTemplate("Kilo uses {{model}}", { model: "m" })).toBe("Albert Code uses m")
  })
})
