// Albert Code: API key, API URL and the models Albert reports. The key is sent
// once to the extension host (SecretStorage) and never comes back.
import { Component, For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import { Button } from "@kilocode/kilo-ui/button"
import { Card } from "@kilocode/kilo-ui/card"
import { TextField } from "@kilocode/kilo-ui/text-field"
import { useLanguage } from "../../context/language"
import { useProvider } from "../../context/provider"
import { useVSCode } from "../../context/vscode"
import type { AlbertStatusMessage } from "../../types/messages"
import SettingsRow from "./SettingsRow"

const muted = {
  "font-size": "var(--kilo-font-size-12)",
  color: "var(--vscode-descriptionForeground)",
} as const

const AlbertTab: Component = () => {
  const vscode = useVSCode()
  const language = useLanguage()
  const provider = useProvider()
  const [status, setStatus] = createSignal<AlbertStatusMessage>()
  const [key, setKey] = createSignal("")
  const [url, setUrl] = createSignal("")

  onMount(() => {
    const off = vscode.onMessage((message) => {
      if (message.type !== "albertStatus") return
      setStatus(message)
      setUrl(message.url === message.default ? "" : message.url)
    })
    onCleanup(off)
    vscode.postMessage({ type: "requestAlbertStatus" })
  })

  const models = createMemo(() =>
    Object.values(provider.providers().albert?.models ?? {}).sort((a, b) => a.id.localeCompare(b.id)),
  )

  const changed = () => url().trim() !== (status()?.url === status()?.default ? "" : (status()?.url ?? ""))
  const apply = () => vscode.postMessage({ type: "setAlbertUrl", url: url().trim() })

  const save = () => {
    if (!key().trim()) return
    vscode.postMessage({ type: "setAlbertKey", key: key() })
    setKey("")
  }

  return (
    <div>
      <p style={{ ...muted, margin: "0 0 12px 0", "line-height": "1.5" }}>
        {language.t("settings.albert.description")}
      </p>
      <Card>
        <SettingsRow
          title={language.t("settings.albert.apiKey.title")}
          description={`${language.t("settings.albert.apiKey.description")} — ${language.t(
            `settings.albert.apiKey.${status()?.key ?? "none"}`,
          )}`}
        >
          <div style={{ display: "flex", gap: "8px", "align-items": "center" }}>
            <TextField
              type="password"
              value={key()}
              placeholder={language.t("settings.albert.apiKey.placeholder")}
              onChange={setKey}
              hideLabel
              label={language.t("settings.albert.apiKey.title")}
            />
            <Button variant="primary" size="small" disabled={!key().trim()} onClick={save}>
              {language.t("settings.albert.apiKey.save")}
            </Button>
            <Show when={status()?.key === "secret"}>
              <Button
                variant="secondary"
                size="small"
                onClick={() => vscode.postMessage({ type: "setAlbertKey", key: "" })}
              >
                {language.t("settings.albert.apiKey.remove")}
              </Button>
            </Show>
          </div>
        </SettingsRow>
        <SettingsRow
          title={language.t("settings.albert.url.title")}
          description={status()?.error ?? language.t("settings.albert.url.description")}
          last
        >
          <div style={{ display: "flex", gap: "8px", "align-items": "center" }}>
            <TextField
              value={url()}
              placeholder={status()?.default ?? "https://albert.api.etalab.gouv.fr/v1"}
              onChange={setUrl}
              hideLabel
              label={language.t("settings.albert.url.title")}
            />
            <Button variant="secondary" size="small" disabled={!changed()} onClick={apply}>
              {language.t("settings.albert.apiKey.save")}
            </Button>
          </div>
        </SettingsRow>
      </Card>

      <h4 style={{ "margin-top": "16px", "margin-bottom": "8px" }}>{language.t("settings.albert.models.title")}</h4>
      <Card>
        <p style={{ ...muted, margin: "0 0 8px 0" }}>{language.t("settings.albert.models.description")}</p>
        <Show when={models().length > 0} fallback={<p style={muted}>{language.t("settings.albert.models.none")}</p>}>
          <For each={models()}>
            {(model, index) => (
              <SettingsRow title={model.id} last={index() === models().length - 1}>
                <span style={muted}>{model.limit?.context ? `${Math.round(model.limit.context / 1024)}k` : ""}</span>
              </SettingsRow>
            )}
          </For>
        </Show>
      </Card>
    </div>
  )
}

export default AlbertTab
