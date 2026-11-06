// Runs inside the VS Code extension host (--extensionTestsPath): opens the
// Albert Code sidebar so the webview connects and the CLI starts, then waits
// until vscode.ts has finished its checks (it creates E2E_DONE). When vscode.ts
// creates E2E_SETTINGS, it also opens the settings panel for a second capture.
const fs = require("node:fs")
const vscode = require("vscode")

exports.run = async () => {
  await vscode.commands.executeCommand("kilo-code.SidebarProvider.focus")
  const done = process.env.E2E_DONE
  const settings = process.env.E2E_SETTINGS
  const end = Date.now() + 150_000
  let opened = false
  while (Date.now() < end && !(done && fs.existsSync(done))) {
    if (!opened && settings && fs.existsSync(settings)) {
      opened = true
      await vscode.commands.executeCommand("kilo-code.new.settingsButtonClicked")
    }
    await new Promise((r) => setTimeout(r, 500))
  }
}
