// Runs inside the VS Code extension host (--extensionTestsPath): opens the
// Albert Code sidebar so the webview connects and the CLI starts, then waits
// until vscode.ts has finished its checks (it creates E2E_DONE).
const fs = require("node:fs")
const vscode = require("vscode")

exports.run = async () => {
  await vscode.commands.executeCommand("kilo-code.SidebarProvider.focus")
  const done = process.env.E2E_DONE
  const end = Date.now() + 150_000
  while (Date.now() < end && !(done && fs.existsSync(done))) await new Promise((r) => setTimeout(r, 500))
}
