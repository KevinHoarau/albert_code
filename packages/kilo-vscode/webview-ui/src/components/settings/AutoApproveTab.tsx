import { Component, createMemo } from "solid-js"

import { useConfig } from "../../context/config"
import PermissionEditor from "./PermissionEditor"
import { DEFAULT_RULES } from "./permission-utils"
import { useLanguage } from "../../context/language"

// albert_change - the session cost alert is removed: Albert usage is not billed per token here
const AutoApproveTab: Component = () => {
  const { config, updateConfig } = useConfig()
  const language = useLanguage()

  const permissions = createMemo(() => config().permission ?? {})

  return (
    <div>
      <PermissionEditor
        permissions={permissions()}
        rules={DEFAULT_RULES}
        description={language.t("settings.autoApprove.description")}
        inherited
        showDefaultLevel
        onChange={(patch) => updateConfig({ permission: patch })}
      />
    </div>
  )
}

export default AutoApproveTab
