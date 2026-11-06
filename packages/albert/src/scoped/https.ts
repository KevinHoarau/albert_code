import real from "node:https"
import { getter, requester } from "../guard"

export * from "node:https"
export const request = requester(real.request, "https:")
export const get = getter<typeof real.get>(request)
export default { ...real, request, get }
