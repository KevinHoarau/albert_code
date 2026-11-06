// Environment imposed on the embedded CLI. The extension applies it when it
// spawns `kilo serve`, and the CLI applies it again to itself at startup, so a
// user environment can never re-enable a remote feature.

export const forced: Readonly<Record<string, string>> = {
  // Marks a process started through an Albert Code entry point (see active()).
  ALBERT_CODE: "1",
  KILO_DISABLE_SESSION_INGEST: "true",
  KILO_DISABLE_SHARE: "true",
  KILO_DISABLE_MODELS_FETCH: "true",
  KILO_DISABLE_AUTOUPDATE: "true",
  KILO_DISABLE_LSP_DOWNLOAD: "true",
  KILO_DISABLE_DEFAULT_PLUGINS: "true",
  KILO_DISABLE_CODEBASE_INDEXING: "true",
  KILO_TELEMETRY_LEVEL: "off",
  KILO_EXPERIMENTAL_WORKSPACES: "false",
  KILO_EXPERIMENTAL_WEBSOCKETS: "false",
  KILO_ENABLE_EXA: "false",
  KILO_ENABLE_PARALLEL: "false",
  KILO_EXPERIMENTAL_EXA: "false",
  KILO_EXPERIMENTAL_PARALLEL: "false",
  KILO_AUTO_SHARE: "false",
}

// Variables that would point a client at another server, or hand it a Kilo
// credential. They are removed rather than overridden.
export const removed: readonly string[] = [
  "KILO_API_KEY",
  "KILO_CONSOLE_TOKEN",
  "KILO_ORG_ID",
  "KILO_SESSION_INGEST_URL",
  "KILO_MODELS_URL",
  "KILO_MARKETPLACE_BASE_URL",
  "KILO_WEBSEARCH_PROVIDER",
  "KILO_BROWSER_BROKER_URL",
  "KILO_BROWSER_BROKER_TOKEN",
  "KILO_REMOTE",
  "KILO_CLOUD_AGENT",
  "KILOCODE_TOKEN",
  "OTEL_EXPORTER_OTLP_ENDPOINT",
  "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT",
  "OTEL_EXPORTER_OTLP_LOGS_ENDPOINT",
  "OTEL_EXPORTER_OTLP_METRICS_ENDPOINT",
  "OTEL_EXPORTER_OTLP_HEADERS",
]

// True in every process started through an Albert Code entry point: the CLI
// sets it on itself before loading anything else. Upstream unit tests, which
// import modules directly, keep testing upstream behaviour.
export function active(env: Record<string, string | undefined> = process.env) {
  return env.ALBERT_CODE === "1"
}

// Mutates `env` in place (process.env inside the CLI) and returns it.
export function enforce<T extends Record<string, string | undefined>>(env: T) {
  for (const key of removed) delete env[key]
  Object.assign(env, forced)
  return env
}

// Pure variant for building a child process environment.
export function child(env: Record<string, string | undefined>) {
  return enforce({ ...env })
}
