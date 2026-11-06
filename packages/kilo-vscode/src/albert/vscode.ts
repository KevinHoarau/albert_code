// Substituted for the `vscode` module in the extension bundle (see
// script/albert-esbuild.js). Everything is the real API except
// workspace.getConfiguration, which applies the pinned settings.
import * as real from "vscode"
import { pin } from "./settings"

export * from "vscode"

function getConfiguration(section?: string, scope?: real.ConfigurationScope | null) {
  return pin(real.workspace.getConfiguration(section, scope), section)
}

// Same as for configurations: derive instead of proxying, whatever the
// property descriptors of the real API object are.
export const workspace: typeof real.workspace = Object.create(real.workspace, {
  getConfiguration: { value: getConfiguration, enumerable: true },
})
