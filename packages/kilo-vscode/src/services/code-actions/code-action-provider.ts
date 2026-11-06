import * as vscode from "vscode"

export class KiloCodeActionProvider implements vscode.CodeActionProvider {
  static readonly metadata: vscode.CodeActionProviderMetadata = {
    providedCodeActionKinds: [vscode.CodeActionKind.QuickFix, vscode.CodeActionKind.RefactorRewrite],
  }

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    if (range.isEmpty) return []

    const actions: vscode.CodeAction[] = []

    const add = new vscode.CodeAction("Add to Albert Code", vscode.CodeActionKind.RefactorRewrite) // albert_change
    add.command = { command: "kilo-code.new.addToContext", title: "Add to Albert Code" } // albert_change
    actions.push(add)

    const hasDiagnostics = context.diagnostics.length > 0

    if (hasDiagnostics) {
      const fix = new vscode.CodeAction("Fix with Albert Code", vscode.CodeActionKind.QuickFix) // albert_change
      fix.command = { command: "kilo-code.new.fixCode", title: "Fix with Albert Code" } // albert_change
      fix.isPreferred = true
      actions.push(fix)
    }

    if (!hasDiagnostics) {
      const explain = new vscode.CodeAction("Explain with Albert Code", vscode.CodeActionKind.RefactorRewrite) // albert_change
      explain.command = { command: "kilo-code.new.explainCode", title: "Explain with Albert Code" } // albert_change
      actions.push(explain)

      const improve = new vscode.CodeAction("Improve with Albert Code", vscode.CodeActionKind.RefactorRewrite) // albert_change
      improve.command = { command: "kilo-code.new.improveCode", title: "Improve with Albert Code" } // albert_change
      actions.push(improve)
    }

    return actions
  }
}
