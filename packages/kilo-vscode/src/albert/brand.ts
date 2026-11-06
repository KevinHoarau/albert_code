// Albert Code branding for translated UI strings. Applied where strings are
// resolved (webview resolveTemplate, extension host t()), so that the
// translation files inherited from Kilo stay untouched. Translation keys and
// paths (kilo-code.*, .kilo/, aboutKiloCode) are not matched: only the product
// name as a word.
export function brand(text: string) {
  return text
    .replace(/\bKilo ?Code\b/g, "Albert Code")
    .replace(/(?<![\w./@-])Kilo(?![\w./-])/g, "Albert Code")
}
