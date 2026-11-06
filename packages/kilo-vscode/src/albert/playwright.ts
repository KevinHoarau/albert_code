// Substituted for playwright-core in the extension bundle: Albert Code ships no
// browser automation, so no browser or Playwright runtime is ever downloaded.
export const chromium = {
  launch(): never {
    throw new Error("Browser automation is not available in Albert Code")
  },
}
