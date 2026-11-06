// albert_change - new file: session ingest, remote control and session export are removed.
import { expect, test } from "bun:test"
import { IngestQueue } from "../../src/kilo-sessions/ingest-queue"
import { RemoteWS } from "../../src/kilo-sessions/remote-ws"
import { resolveEndpoint } from "../../src/kilocode/session-export/worker/endpoint"

test("the ingest queue never asks for a client and never sends", async () => {
  const asked: string[] = []
  const queue = IngestQueue.create({
    getShare: async () => {
      asked.push("share")
      return { ingestPath: "/api/session/x/ingest" }
    },
    getClient: async () => {
      asked.push("client")
      return { url: "https://ingest.invalid", fetch: () => Promise.reject(new Error("sent")) }
    },
    log: { error: () => {} },
  })
  expect(await queue.sync("ses_1", [{ type: "session_open", data: {} }])).toBe(false)
  await queue.flush("ses_1")
  await queue.drain()
  expect(asked).toEqual([])
})

test("remote control cannot open a socket", () => {
  expect(() => RemoteWS.connect({} as RemoteWS.Options)).toThrow("Remote control is not available")
})

test("session export has no upload endpoint", () => {
  expect(resolveEndpoint({})).toBe("")
  expect(resolveEndpoint({ env: "https://supermassive-black-hole.kiloapps.io/v1/session-export/batch" })).toBe("")
})
