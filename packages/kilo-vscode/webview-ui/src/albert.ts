// Albert Code: settings tabs of removed features (third-party providers and
// accounts, web search/fetch and browser, inline autocomplete).
export const removed: ReadonlySet<string> = new Set(["providers", "browser", "autocomplete"])

export function tab(value: string) {
  return removed.has(value) ? "models" : value
}

// Kilo account, cloud history and import, remote control, Kilo notifications
// and Kilo support links. Always false in Albert Code: the UI is hidden.
export const kilo = false
