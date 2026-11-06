// Albert Code build plugin for the extension host bundle.
//
// The VS Code extension host is shared with other extensions, so the network
// guard cannot patch process globals there. Instead, inside this bundle only:
// - node:http, https, net, tls and dns resolve to guarded wrappers;
// - fetch / WebSocket (free or through globalThis) resolve to guarded ones
//   (see `inject` and `define` in esbuild.js);
// - `vscode` resolves to a wrapper that pins the settings of removed features;
// - playwright-core resolves to a stub, so no browser runtime is shipped.
const path = require("node:path")

const scoped = path.join(__dirname, "..", "..", "albert", "src", "scoped")
const albert = path.join(__dirname, "..", "src", "albert")
const wrapper = path.join(albert, "vscode.ts")

module.exports = {
  scoped,
  inject: [path.join(scoped, "fetch.ts")],
  define: { "globalThis.fetch": "fetch", "globalThis.WebSocket": "WebSocket" },
  plugin: {
    name: "albert-guard",
    setup(build) {
      build.onResolve({ filter: /^(node:)?(http|https|net|tls|dns)$/ }, (args) => {
        if (args.importer.startsWith(scoped)) return undefined
        return { path: path.join(scoped, `${args.path.replace(/^node:/, "")}.ts`) }
      })
      build.onResolve({ filter: /^vscode$/ }, (args) => {
        if (args.importer === wrapper) return { path: "vscode", external: true }
        return { path: wrapper }
      })
      build.onResolve({ filter: /^playwright-core$/ }, () => ({ path: path.join(albert, "playwright.ts") }))
    },
  },
}
