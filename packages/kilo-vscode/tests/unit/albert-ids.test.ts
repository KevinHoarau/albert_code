import { describe, expect, it } from "bun:test"
import fs from "node:fs"
import path from "node:path"
import { contributed, ids } from "../../script/albert-ids"

const manifest = JSON.parse(fs.readFileSync(path.join(import.meta.dir, "../../package.json"), "utf8"))

describe("albert identifiers", () => {
  it("moves every contributed identifier out of Kilo's namespace", () => {
    const renamed = JSON.parse(ids(JSON.stringify(manifest)))
    const all = contributed(renamed)
    expect(all.length).toBeGreaterThan(50)
    expect(all.filter((id) => /^kilo/i.test(id))).toEqual([])
  })

  it("renames identifiers used at runtime and nothing else", () => {
    expect(ids('getConfiguration("kilo-code.new")')).toBe('getConfiguration("albert-code")')
    expect(ids("`kilo-code.new.${suffix}`")).toBe("`albert-code.${suffix}`")
    expect(ids('"kilo-code.SidebarProvider.focus"')).toBe('"albert-code.SidebarProvider.focus"')
    expect(ids('setContext("kilo-code.agentTerminalFocus", true)')).toBe(
      'setContext("albert-code.agentTerminalFocus", true)',
    )
    expect(ids('{ type: "kilo-worktree-run" }')).toBe('{ type: "albert-worktree-run" }')
    expect(ids('const STATE_FILE = "agent-manager.json"')).toBe('const STATE_FILE = "albert-agent-manager.json"')
    expect(ids("albert-agent-manager.json")).toBe("albert-agent-manager.json")
    expect(ids('getExtension("kilocode.kilo-code")')).toBe(`getExtension("${manifest.publisher}.${manifest.name}")`)
    for (const text of ["kilocode.kilo-code-bot", "vscode://kilocode.kilo-code/", ".kilo/worktrees", "KILO_APP_NAME", "kilo-code-bot", "@kilocode/sdk"]) {
      expect(ids(text)).toBe(text)
    }
  })
})
