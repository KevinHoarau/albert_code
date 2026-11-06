import { RemoteProtocol } from "@/kilo-sessions/remote-protocol"
import { InstallationVersion } from "@opencode-ai/core/installation/version"

export namespace RemoteWS {
  export type SessionInfo = RemoteProtocol.SessionInfo

  export type Timers = {
    setTimeout: (fn: () => void, ms?: number) => unknown
    clearTimeout: (t: unknown) => void
    setInterval: (fn: () => void, ms?: number) => unknown
    clearInterval: (t: unknown) => void
  }

  export type Options = {
    url: string
    getToken: () => Promise<string | undefined>
    // kilocode_change - K1 W1: widened return type so the optional `instance`
    // advertisement (RemoteProtocol.Heartbeat.instance) flows through to the
    // wire unchanged when the gatherer provides it. Legacy callers
    // (older test mocks) still satisfy the contract by returning a bare
    // `{ sessions }` shape.
    getSessions: () => Promise<{ sessions: SessionInfo[]; instance?: RemoteProtocol.Heartbeat["instance"] }>
    log: {
      info: (...args: any[]) => void
      error: (...args: any[]) => void
      warn: (...args: any[]) => void
    }
    onMessage?: (msg: RemoteProtocol.Inbound) => void
    onOpen?: () => void
    onDisconnect?: () => void
    heartbeat?: number
    /** Wraps callbacks that need to run in a specific async context (e.g. Instance.provide) */
    withContext?: <R>(fn: () => R) => Promise<R> | R
    /** Called when the server permanently closes the connection (e.g. auth failure, conflict) */
    onClose?: (code: number, reason: string) => void
    /** Inactivity timeout in ms — force-close if no inbound message within this window */
    timeout?: number
    /** Injectable timer primitives for deterministic testing. Defaults to globals. */
    timers?: Timers
    /** Injectable clock for deterministic testing. Defaults to Date.now. */
    now?: () => number
    /** Token-acquisition deadline in ms. Defaults to 15_000. */
    tokenTimeout?: number
    /** Connection-attempt deadline (token acquisition through onopen) in ms. Defaults to 30_000. */
    connectTimeout?: number
    /** Session-gather deadline in ms. Defaults to 15_000. */
    gatherTimeout?: number
    /** Max unresolved gather operations before cycles send degraded heartbeats. Defaults to 4. */
    maxOutstandingGathers?: number
  }

  export type Connection = {
    readonly connectionId: string
    send(msg: RemoteProtocol.Outbound): void
    /**
     * Resolves when a heartbeat built from a FRESH gather has actually been
     * sent over a live socket. Degraded sends and non-live buffered sends
     * leave the returned promise pending; `close()` rejects it.
     *
     * When `opts.requireSessionId` is provided, the promise only resolves
     * when the sent fresh payload's session list contains that id. This
     * fences attach-announce waiters so a fresh heartbeat that legitimately
     * omits the announced id (e.g. the gather's `Effect.orElseSucceed`
     * filtered it out) does not falsely report the session as attached.
     *
     * When `opts.detachSessionId` is provided, the promise only resolves
     * when the sent fresh payload's session list DOES NOT contain that id
     * (the negative-containment fence used by K1 W1 session-detach).
     * Stale "still contains" cycles are rejected via requeue (handled
     * below) so the detach does not falsely report success while the
     * upstream side still observes the session.
     */
    heartbeat(opts?: { requireSessionId?: string; detachSessionId?: string }): Promise<void>
    close(): void
    readonly connected: boolean
  }

  // albert_change - remote control removed: no socket is ever opened.
  export function connect(_options: Options): Connection {
    throw new Error("Remote control is not available in Albert Code")
  }
}
