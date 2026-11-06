import real from "node:net"
import { connector } from "../guard"

export * from "node:net"
export const connect = connector(real.connect, "tcp")
export const createConnection = connector(real.createConnection, "tcp")

// Socket#connect is reached through `new net.Socket().connect(...)`, which
// bypasses net.connect. The subclass keeps instanceof checks working.
export class Socket extends real.Socket {
  override connect(...args: unknown[]) {
    return connector(super.connect as (...args: never[]) => this, "tcp").apply(this, args as never[])
  }
}
export const Stream = Socket
export default { ...real, connect, createConnection, Socket, Stream }
