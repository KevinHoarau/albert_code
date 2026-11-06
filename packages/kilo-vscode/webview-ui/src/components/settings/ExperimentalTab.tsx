import { Component, For, Show, createMemo } from "solid-js"
import { Switch } from "@kilocode/kilo-ui/switch"
import { TextField } from "@kilocode/kilo-ui/text-field"
import { Card } from "@kilocode/kilo-ui/card"
import { useConfig } from "../../context/config"
import { useLanguage } from "../../context/language"
import { TOOLS } from "@albert-code/guard/tools" // albert_change
import SettingsRow from "./SettingsRow"
import PatternList from "./PatternList"

const ExperimentalTab: Component = () => {
  const { config, settings, updateConfig, applySetting } = useConfig()
  const language = useLanguage()
  const experimental = createMemo(() => config().experimental ?? {})
  // albert_change - tools removed by Albert Code are pinned off: no toggle for them
  const tools = createMemo(() => Object.entries(config().tools ?? {}).filter(([name]) => !TOOLS.includes(name)))

  const updateExperimental = (key: string, value: unknown) => {
    updateConfig({
      experimental: { ...experimental(), [key]: value },
    })
  }

  return (
    <div>
      <Card>
        {/* albert_change - remote control and sharing removed */}
        <SettingsRow
          title={language.t("settings.experimental.formatter.title")}
          description={language.t("settings.experimental.formatter.description")}
        >
          <Switch
            checked={config().formatter !== false}
            onChange={(checked) => updateConfig({ formatter: checked ? {} : false })}
            hideLabel
          >
            {language.t("settings.experimental.formatter.title")}
          </Switch>
        </SettingsRow>

        <SettingsRow
          title={language.t("settings.experimental.lsp.title")}
          description={language.t("settings.experimental.lsp.description")}
        >
          <Switch
            checked={config().lsp !== false}
            onChange={(checked) => updateConfig({ lsp: checked ? {} : false })}
            hideLabel
          >
            {language.t("settings.experimental.lsp.title")}
          </Switch>
        </SettingsRow>

        <SettingsRow
          title={language.t("settings.experimental.batch.title")}
          description={language.t("settings.experimental.batch.description")}
        >
          <Switch
            checked={experimental().batch_tool ?? false}
            onChange={(checked) => updateExperimental("batch_tool", checked)}
            hideLabel
          >
            {language.t("settings.experimental.batch.title")}
          </Switch>
        </SettingsRow>

        {/* albert_change - image generation removed */}
        <SettingsRow
          title={language.t("settings.experimental.nativeNotebookTools.title")}
          description={language.t("settings.experimental.nativeNotebookTools.description")}
        >
          <Switch
            checked={experimental().native_notebook_tools ?? false}
            onChange={(checked) => updateExperimental("native_notebook_tools", checked)}
            hideLabel
          >
            {language.t("settings.experimental.nativeNotebookTools.title")}
          </Switch>
        </SettingsRow>

        <SettingsRow
          title={language.t("settings.experimental.continueOnDeny.title")}
          description={language.t("settings.experimental.continueOnDeny.description")}
        >
          <Switch
            checked={experimental().continue_loop_on_deny ?? false}
            onChange={(checked) => updateExperimental("continue_loop_on_deny", checked)}
            hideLabel
          >
            {language.t("settings.experimental.continueOnDeny.title")}
          </Switch>
        </SettingsRow>

        {/* albert_change - code mode removed (its tool reaches remote OpenAPI catalogs) */}
        <SettingsRow
          title={language.t("settings.experimental.claudeMigration.title")}
          description={language.t("settings.experimental.claudeMigration.description")}
        >
          <Switch
            checked={settings().claudeMigration === true}
            onChange={(checked) => applySetting("claudeMigration", checked, "experimental.claudeMigration")}
            hideLabel
          >
            {language.t("settings.experimental.claudeMigration.title")}
          </Switch>
        </SettingsRow>

        <SettingsRow
          title={language.t("settings.experimental.conversationPromptHistory.title")}
          description={language.t("settings.experimental.conversationPromptHistory.description")}
        >
          <Switch
            checked={settings().conversationPromptHistory === true}
            onChange={(checked) =>
              applySetting("conversationPromptHistory", checked, "experimental.conversationPromptHistory")
            }
            hideLabel
          >
            {language.t("settings.experimental.conversationPromptHistory.title")}
          </Switch>
        </SettingsRow>

        {/* albert_change - integrated browser removed */}
        <SettingsRow
          title={language.t("settings.experimental.mcpTimeout.title")}
          description={language.t("settings.experimental.mcpTimeout.description")}
          last
        >
          <TextField
            value={String(experimental().mcp_timeout ?? 60000)}
            onChange={(val) => {
              const num = parseInt(val, 10)
              if (!isNaN(num) && num > 0) {
                updateExperimental("mcp_timeout", num)
              }
            }}
          />
        </SettingsRow>
      </Card>

      <h4
        style={{ "margin-top": "16px", "margin-bottom": "8px" }}
        data-search-label={language.t("settings.experimental.globIncludeIgnored.title")}
      >
        {language.t("settings.experimental.globIncludeIgnored.title")}
      </h4>
      <PatternList
        patterns={experimental().glob_include_ignored ?? []}
        description={language.t("settings.experimental.globIncludeIgnored.description")}
        placeholder="e.g. packages/*/dist"
        onChange={(patterns) => updateExperimental("glob_include_ignored", patterns)}
      />

      {/* Tool toggles */}
      <Show when={tools().length > 0}>
        <h4 style={{ "margin-top": "16px", "margin-bottom": "8px" }}>
          {language.t("settings.experimental.toolToggles")}
        </h4>
        <Card>
          <For each={tools()}>
            {([name, enabled], index) => (
              <SettingsRow title={name} description="" last={index() >= tools().length - 1}>
                <Switch
                  checked={enabled}
                  onChange={(checked) => updateConfig({ tools: { ...config().tools, [name]: checked } })}
                  hideLabel
                >
                  {name}
                </Switch>
              </SettingsRow>
            )}
          </For>
        </Card>
      </Show>
    </div>
  )
}

export default ExperimentalTab
