// albert_change - telemetry is removed: every entry point is inert.
import { expect, test } from "bun:test"
import pkg from "../../package.json"
import { Identity, Telemetry } from "../index"
import { TelemetryEvent } from "../events"

test("telemetry never sends anything and never identifies the user", async () => {
  const fetch = globalThis.fetch
  const calls: unknown[] = []
  globalThis.fetch = Object.assign(
    (...args: unknown[]) => {
      calls.push(args)
      return Promise.reject(new Error("no network"))
    },
    { preconnect: fetch.preconnect },
  ) as typeof fetch
  await Telemetry.init({ dataPath: "/nonexistent", version: "1", enabled: true })
  Telemetry.setEnabled(true)
  Telemetry.track(TelemetryEvent.CLI_START, { secret: "x" })
  Telemetry.trackCliStart()
  await Telemetry.updateIdentity("token")
  Telemetry.flushInBackground()
  await Telemetry.shutdown()
  globalThis.fetch = fetch
  expect(Telemetry.isEnabled()).toBe(false)
  expect(await Identity.getMachineId()).toBeUndefined()
  expect(calls).toEqual([])
})

test("the PostHog client is no longer a dependency", () => {
  expect(JSON.stringify(pkg)).not.toContain("posthog")
})
