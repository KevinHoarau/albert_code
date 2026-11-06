import real from "node:tls"
import { connector } from "../guard"

export * from "node:tls"
export const connect = connector(real.connect, "tls")
export default { ...real, connect }
