// albert_change - telemetry removed: no client, no identity, nothing leaves the
// machine. The API is kept so that call sites inherited from Kilo stay untouched.
import { TelemetryEvent } from "./events.js"

export interface TelemetryProperties {
  appName: string
  appVersion: string
  platform: string
  os_name: string
  os_version: string
  os_arch: string
  editorName?: string
  vscodeVersion?: string
  aauClientToken?: string
}

export type ReviewCommand = "review"

export interface IndexingTelemetryProperties extends Record<string, unknown> {
  source: "scan" | "watcher"
  provider: string
  vectorStore: "lancedb" | "qdrant"
  modelId?: string
  trigger?: "background" | "manual"
  mode?: "full" | "incremental"
}

export interface IndexingCompletedTelemetryProperties extends IndexingTelemetryProperties {
  trigger: "background" | "manual"
  mode: "full" | "incremental"
  filesIndexed: number
  filesDiscovered: number
  totalBlocks: number
  batchErrors: number
}

export interface IndexingFileCountTelemetryProperties extends IndexingTelemetryProperties {
  mode: "full" | "incremental"
  discovered: number
  candidate: number
}

export interface IndexingRetryTelemetryProperties extends IndexingTelemetryProperties {
  mode: "full" | "incremental"
  attempt: number
  maxRetries: number
  batchSize: number
  error: string
}

export interface IndexingErrorTelemetryProperties extends IndexingTelemetryProperties {
  location: string
  error: string
  retryCount?: number
  maxRetries?: number
}

/** One explicit MCP sign-in attempt admitted by the CLI runtime. Never carries server names, URLs, or OAuth secrets. */
export interface McpAuthStartedProperties extends Record<string, unknown> {
  schemaVersion: number
  attemptId: string
  /** The client opens the authorization URL itself (editors, console) instead of the CLI process. */
  external: boolean
}

export interface McpAuthCompletedProperties extends McpAuthStartedProperties {
  outcome: "success" | "failure" | "denied" | "cancelled" | "timeout" | "superseded" | "interrupted"
  phase:
    | "prepare"
    | "callback_setup"
    | "authorization"
    | "token_exchange"
    | "credential_store"
    | "reconnect"
    | "tool_discovery"
  oauthOutcome: "success" | "failure" | "not_performed" | "not_reached"
  connectionOutcome: "connected" | "failed" | "needs_auth" | "needs_client_registration" | "not_attempted"
  errorCode?: string
  redirect: boolean
  durationMs: number
  /** `verified` only when the effective config matches a public marketplace MCP method. */
  attribution: "verified" | "unknown"
  itemType?: "mcp"
  itemId?: string
  methodId?: string
  methodName?: string
  oauthRequirement?: string
  authHandler?: string
}

export namespace Telemetry {
  let startTime = 0

  export async function init(_options: { dataPath: string; version: string; enabled: boolean }): Promise<void> {
    startTime = Date.now()
  }

  export function setEnabled(_value: boolean) {}

  export function isEnabled(): boolean {
    return false
  }

  export async function updateIdentity(_token: string | null, _accountId?: string): Promise<void> {}

  export function track(_event: TelemetryEvent, _properties?: Record<string, unknown>) {}

  // CLI Lifecycle
  export function trackCliStart() {
    track(TelemetryEvent.CLI_START)
  }

  // Upload queued events without blocking. Call after bootstrap so the flush
  // overlaps with command execution and shutdown() stays fast (#10242).
  export function flushInBackground() {}

  export function trackCliExit(exitCode?: number) {
    track(TelemetryEvent.CLI_EXIT, {
      duration: Date.now() - startTime,
      exitCode,
    })
  }

  // Sessions
  export function trackSessionStart(sessionId: string, model?: string, provider?: string) {
    track(TelemetryEvent.SESSION_START, { sessionId, model, provider })
  }

  export function trackSessionEnd(
    sessionId: string,
    stats: {
      messageCount?: number
      inputTokens?: number
      outputTokens?: number
      duration?: number
    },
  ) {
    track(TelemetryEvent.SESSION_END, { sessionId, ...stats })
  }

  export function trackSessionMessage(sessionId: string, source: "user" | "assistant") {
    track(TelemetryEvent.SESSION_MESSAGE, { sessionId, source })
  }

  // LLM
  export function trackLlmCompletion(properties: {
    taskId?: string
    mode?: "review"
    feature?: "code_reviews"
    command?: ReviewCommand
    tool?: "suggest"
    apiProvider: string
    modelId: string
    inputTokens?: number
    outputTokens?: number
    cacheReadTokens?: number
    cacheWriteTokens?: number
    cost?: number
    completionTime?: number
    duration?: number
  }) {
    track(TelemetryEvent.LLM_COMPLETION, properties)
  }

  // Features
  export function trackCommandUsed(command: string) {
    track(TelemetryEvent.COMMAND_USED, { command })
  }

  export function trackToolUsed(tool: string, sessionId?: string) {
    track(TelemetryEvent.TOOL_USED, { tool, sessionId })
  }

  export function trackAgentUsed(agent: string, sessionId?: string) {
    track(TelemetryEvent.AGENT_USED, { agent, sessionId })
  }

  export function trackPlanFollowup(
    sessionId: string,
    choice: "new_session" | "continue" | "keep_refining" | "custom" | "dismissed",
  ) {
    track(TelemetryEvent.PLAN_FOLLOWUP, { sessionId, choice })
  }

  export function trackSuggestionAccepted(properties: {
    sessionId: string
    requestId: string
    index: number
    tool: "suggest"
    command: ReviewCommand
    actionCount?: number
  }) {
    track(TelemetryEvent.SUGGESTION_ACCEPTED, properties)
  }

  export function trackSuggestionShown(properties: {
    sessionId: string
    requestId: string
    index: number
    tool: "suggest"
    command: ReviewCommand
    actionCount?: number
  }) {
    track(TelemetryEvent.SUGGESTION_SHOWN, properties)
  }

  export function trackIndexingStarted(properties: IndexingTelemetryProperties) {
    track(TelemetryEvent.INDEXING_STARTED, properties)
  }

  export function trackIndexingCompleted(properties: IndexingCompletedTelemetryProperties) {
    track(TelemetryEvent.INDEXING_COMPLETED, properties)
  }

  export function trackIndexingFileCount(properties: IndexingFileCountTelemetryProperties) {
    track(TelemetryEvent.INDEXING_FILE_COUNT, properties)
  }

  export function trackIndexingBatchRetry(properties: IndexingRetryTelemetryProperties) {
    track(TelemetryEvent.INDEXING_BATCH_RETRY, properties)
  }

  export function trackIndexingError(properties: IndexingErrorTelemetryProperties) {
    track(TelemetryEvent.INDEXING_ERROR, properties)
  }

  // Share
  export function trackShareCreated(sessionId: string) {
    track(TelemetryEvent.SHARE_CREATED, { sessionId })
  }

  export function trackShareDeleted(sessionId: string) {
    track(TelemetryEvent.SHARE_DELETED, { sessionId })
  }

  // MCP
  export function trackMcpServerConnected(server: string) {
    track(TelemetryEvent.MCP_SERVER_CONNECTED, { server })
  }

  export function trackMcpServerError(server: string, error?: string) {
    track(TelemetryEvent.MCP_SERVER_ERROR, { server, error })
  }

  export function trackMcpAuthStarted(properties: McpAuthStartedProperties) {
    track(TelemetryEvent.MCP_AUTH_STARTED, properties)
  }

  export function trackMcpAuthCompleted(properties: McpAuthCompletedProperties) {
    track(TelemetryEvent.MCP_AUTH_COMPLETED, properties)
  }

  // Remote
  export function trackRemoteConnectionOpened() {
    track(TelemetryEvent.REMOTE_CONNECTION_OPENED)
  }

  // Auth
  export function trackAuthSuccess(provider: string) {
    track(TelemetryEvent.AUTH_SUCCESS, { provider })
  }

  export function trackAuthLogout(provider: string) {
    track(TelemetryEvent.AUTH_LOGOUT, { provider })
  }

  // Errors
  export function trackError(error: string, context?: string) {
    track(TelemetryEvent.ERROR, { error, context })
  }

  // Feedback
  export interface FeedbackProperties extends Record<string, unknown> {
    providerID: string
    modelID: string
    variant?: string
    rating: "up" | "down" | "cleared"
    previousRating?: "up" | "down"
    sessionID?: string
    messageID?: string
    parentMessageID?: string
  }

  export function trackFeedback(props: FeedbackProperties) {
    track(TelemetryEvent.FEEDBACK_SUBMITTED, props)
  }

  export async function shutdown(_timeoutMs?: number): Promise<void> {}
}
