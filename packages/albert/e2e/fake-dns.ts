// DNS server for the isolated network namespace. It records every query (any
// query means something tried to resolve a name) and answers A queries with a
// sink address, so that a resolved name also produces a connection attempt the
// packet counter can see.

const sink = [10, 66, 0, 9]

function name(buf: Buffer, start: number) {
  const labels: string[] = []
  let at = start
  while (at < buf.length && buf[at] !== 0) {
    const len = buf[at]!
    labels.push(buf.subarray(at + 1, at + 1 + len).toString("latin1"))
    at += len + 1
  }
  return { name: labels.join("."), end: at + 1 }
}

export function answer(query: Buffer) {
  const q = name(query, 12)
  const type = query.readUInt16BE(q.end)
  const question = query.subarray(12, q.end + 4)
  const a = type === 1
  const head = Buffer.alloc(12)
  query.copy(head, 0, 0, 2)
  head.writeUInt16BE(0x8180, 2)
  head.writeUInt16BE(1, 4)
  head.writeUInt16BE(a ? 1 : 0, 6)
  const record = a
    ? Buffer.from([0xc0, 0x0c, 0, 1, 0, 1, 0, 0, 0, 60, 0, 4, ...sink])
    : Buffer.alloc(0)
  return { name: q.name, type, packet: Buffer.concat([head, question, record]) }
}

if (import.meta.main) {
  const log = process.env.DNS_LOG!
  const file = Bun.file(log)
  const seen: string[] = []
  await Bun.udpSocket({
    hostname: "127.0.0.1",
    port: 53,
    socket: {
      data(socket, data, port, address) {
        const out = answer(Buffer.from(data))
        seen.push(JSON.stringify({ name: out.name, type: out.type, time: new Date().toISOString() }))
        void Bun.write(file, seen.join("\n") + "\n")
        socket.send(out.packet, port, address)
      },
    },
  })
  console.log("dns ready")
}
