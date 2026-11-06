import type { Component } from "solid-js"
import { useLanguage } from "../src/context/language"

export const DiffEndMarker: Component = () => {
  const { t } = useLanguage()

  return (
    <div class="am-diff-end-marker">
      {/* albert_change - Kilo mascot removed */}
      <p class="am-diff-end-text">{t("agentManager.review.endOfLongDiff")}</p>
    </div>
  )
}
