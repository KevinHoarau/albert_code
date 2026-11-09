// A new Albert key or URL restarts the backend instead of reloading the window.
import { describe, expect, test } from "bun:test"
import { KiloConnectionService } from "../../src/services/cli-backend/connection-service"

type Inner = {
  state: string
  rootDirectory: string | undefined
  serverManager: { dispose(): void }
  doConnect(dir: string): Promise<void>
  setState(state: string): void
}

function setup(state: string) {
  const service = new KiloConnectionService({} as ConstructorParameters<typeof KiloConnectionService>[0])
  const inner = service as unknown as Inner
  const log: string[] = []
  inner.state = state
  inner.rootDirectory = "/tmp/project"
  inner.serverManager = { dispose: () => log.push("dispose") }
  inner.doConnect = async (dir) => {
    log.push(`connect ${dir}`)
    inner.setState("connected")
  }
  service.onStateChange((value) => log.push(`state ${value}`))
  service.onEvent((event, dir) => log.push(`event ${event.type} ${dir}`))
  return { service, log }
}

describe("KiloConnectionService.restart", () => {
  test("replaces a running backend, then asks webviews to refetch everything", async () => {
    const ctx = setup("connected")
    await ctx.service.restart()
    expect(ctx.log).toEqual([
      "dispose",
      "state connecting",
      "connect /tmp/project",
      "state connected",
      "event global.disposed global",
    ])
    ctx.service.dispose()
  })

  test("does not start a backend that is not running", async () => {
    for (const state of ["disconnected", "error"]) {
      const ctx = setup(state)
      await ctx.service.restart()
      expect(ctx.log).toEqual(["dispose"])
      ctx.service.dispose()
    }
  })
})
