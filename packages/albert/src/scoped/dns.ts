import real from "node:dns"
import { lookuper, resolver } from "../guard"

export * from "node:dns"
export const lookup = lookuper(real.lookup)
export const resolve = resolver(real.resolve)
export const resolve4 = resolver(real.resolve4)
export const resolve6 = resolver(real.resolve6)
export const resolveAny = resolver(real.resolveAny)
export const promises = {
  ...real.promises,
  lookup: resolver(real.promises.lookup),
  resolve: resolver(real.promises.resolve),
  resolve4: resolver(real.promises.resolve4),
  resolve6: resolver(real.promises.resolve6),
  resolveAny: resolver(real.promises.resolveAny),
}
export default { ...real, lookup, resolve, resolve4, resolve6, resolveAny, promises }
