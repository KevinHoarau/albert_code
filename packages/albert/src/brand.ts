// Albert Code branding of user-visible text inherited from Kilo: "Kilo Code"
// and the word "Kilo" become "Albert Code". Identifiers, keys, paths and URLs
// (KiloProvider, kilo-code.*, .kilo/, aboutKiloCode, Kilo-Org) are not matched.
export function brand(text: string) {
  return text.replace(/\bKilo ?Code\b/g, "Albert Code").replace(/(?<![\w./@-])Kilo(?![\w./-])/g, "Albert Code")
}
