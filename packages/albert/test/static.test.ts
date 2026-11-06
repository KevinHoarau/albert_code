import { expect, test } from "bun:test"
import path from "node:path"

const root = path.join(import.meta.dir, "../..")

// Runtime code shipped in the CLI and the extension.
const dirs = [
  "opencode/src",
  "core/src",
  "llm/src",
  "server/src",
  "plugin/src",
  "codemode/src",
  "kilo-gateway/src",
  "kilo-indexing/src",
  "kilo-memory/src",
  "kilo-sandbox/src",
  "kilo-vscode/src",
]

// Entry points that install() cannot wrap because the runtime freezes them.
const frozen = /\bBun\.fetch\b/

test("runtime code never uses entry points the guard cannot wrap", async () => {
  const hits: string[] = []
  for (const dir of dirs) {
    for await (const file of new Bun.Glob("**/*.{ts,tsx}").scan({ cwd: path.join(root, dir) })) {
      if (/(^|\/)(test|__tests__)\/|\.test\.|\.spec\./.test(file)) continue
      const text = await Bun.file(path.join(root, dir, file)).text()
      if (frozen.test(text)) hits.push(`${dir}/${file}`)
    }
  }
  expect(hits).toEqual([])
})
