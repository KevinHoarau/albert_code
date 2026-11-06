// The only provider plugin loaded by Albert Code.
import type { Hooks } from "@kilocode/plugin"
import * as Log from "@opencode-ai/core/util/log"
import { base } from "@albert-code/guard/policy"
import { ID, KEY } from "./catalog"
import { AlbertModels } from "./models"

const log = Log.create({ service: "albert" })

export async function AlbertPlugin(): Promise<Hooks> {
  return {
    provider: {
      id: ID,
      async models(_provider, ctx) {
        const url = base()
        const key = ctx.auth?.type === "api" ? ctx.auth.key : process.env[KEY]
        return AlbertModels.get(url, key).catch(async (err) => {
          log.warn("albert model discovery failed, using the cached list", { err: String(err) })
          return AlbertModels.cached(url)
        })
      },
    },
  }
}
