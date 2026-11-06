import real from "node:http"
import { getter, requester } from "../guard"

export * from "node:http"
export const request = requester(real.request, "http:")
export const get = getter<typeof real.get>(request)
export default { ...real, request, get }
