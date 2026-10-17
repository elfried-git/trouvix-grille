type Handler = (...args: any[]) => void
type Packet = { t: string; e?: string; d?: any; a?: string; id?: string }

function encodeValue(value: any): any {
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    const bytes = value instanceof ArrayBuffer
      ? new Uint8Array(value)
      : new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
    let binary = ''
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + 0x8000, bytes.length)))
    }
    return { __trouvixBinary: true, data: btoa(binary) }
  }
  if (Array.isArray(value)) return value.map(encodeValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encodeValue(item)]))
  }
  return value
}

function decodeValue(value: any): any {
  if (Array.isArray(value)) return value.map(decodeValue)
  if (value && typeof value === 'object') {
    if (value.__trouvixBinary === true && typeof value.data === 'string') {
      const raw = atob(value.data)
      const bytes = new Uint8Array(raw.length)
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
      return bytes.buffer
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decodeValue(item)]))
  }
  return value
}

export class SocketIOServerCompat {
  private connectionHandler?: (socket: CompatSocket) => void
  readonly clients = new Map<string, CompatSocket>()
  readonly rooms = new Map<string, Set<string>>()
  readonly sockets = { sockets: this.clients }

  on(event: string, handler: (socket: CompatSocket) => void) {
    if (event === 'connection') this.connectionHandler = handler
    return this
  }

  connect(ws: WebSocket, attachment?: Record<string, any>, announce = true) {
    const socket = new CompatSocket(this, ws, attachment)
    this.clients.set(socket.id, socket)
    this.join(socket, socket.id)
    if (announce) ws.send(JSON.stringify({ t: 'connect', id: socket.id }))
    this.connectionHandler?.(socket)
    return socket
  }

  reset() {
    this.clients.clear()
    this.rooms.clear()
  }

  receive(socket: CompatSocket, raw: string | ArrayBuffer) {
    let packet: Packet
    try {
      packet = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw))
    } catch {
      return
    }
    if (packet.t !== 'event' || !packet.e) return
    const data = decodeValue(packet.d)
    const ack = typeof packet.a === 'string'
      ? (response: any) => socket.send({ t: 'ack', a: packet.a, d: response })
      : undefined
    socket.dispatch(packet.e, data, ack)
  }

  receiveWebSocket(ws: WebSocket, raw: string | ArrayBuffer) {
    const socket = [...this.clients.values()].find((candidate) => candidate.matches(ws))
    if (socket) this.receive(socket, raw)
  }

  disconnect(socket: CompatSocket, reason = 'transport close') {
    if (!this.clients.has(socket.id)) return
    socket.dispatch('disconnect', reason)
    this.clients.delete(socket.id)
    for (const room of [...socket.joinedRooms]) socket.leave(room)
  }

  disconnectWebSocket(ws: WebSocket, reason = 'transport close') {
    const socket = [...this.clients.values()].find((candidate) => candidate.matches(ws))
    if (socket) this.disconnect(socket, reason)
  }

  emit(event: string, payload?: any) {
    for (const socket of this.clients.values()) socket.emit(event, payload)
  }

  to(room: string) {
    return { emit: (event: string, payload?: any) => this.emitToRoom(room, event, payload) }
  }

  in(room: string) {
    return { socketsLeave: (roomToLeave: string) => {
      for (const id of [...(this.rooms.get(room) ?? [])]) this.clients.get(id)?.leave(roomToLeave)
    } }
  }

  close(callback?: () => void) {
    for (const socket of [...this.clients.values()]) socket.disconnect(true)
    callback?.()
  }

  emitToRoom(room: string, event: string, payload?: any, exceptId?: string) {
    for (const id of this.rooms.get(room) ?? []) {
      if (id !== exceptId) this.clients.get(id)?.emit(event, payload)
    }
  }

  join(socket: CompatSocket, room: string) {
    let members = this.rooms.get(room)
    if (!members) this.rooms.set(room, members = new Set())
    members.add(socket.id)
    socket.joinedRooms.add(room)
  }

  leave(socket: CompatSocket, room: string) {
    socket.joinedRooms.delete(room)
    const members = this.rooms.get(room)
    members?.delete(socket.id)
    if (members?.size === 0) this.rooms.delete(room)
  }
}

export class CompatSocket {
  readonly id: string
  readonly joinedRooms = new Set<string>()
  private handlers = new Map<string, Handler[]>()
  private attachment: Record<string, any>

  constructor(private io: SocketIOServerCompat, private ws: WebSocket, attachment?: Record<string, any>) {
    this.id = typeof attachment?.id === 'string' ? attachment.id : crypto.randomUUID()
    this.attachment = { ...(attachment ?? {}), id: this.id }
    this.setAttachment(this.attachment)
  }

  getAttachment() { return this.attachment }

  setAttachment(value: Record<string, any>) {
    this.attachment = value
    const serializableSocket = this.ws as WebSocket & { serializeAttachment?: (attachment: unknown) => void }
    serializableSocket.serializeAttachment?.(value)
  }

  on(event: string, handler: Handler) {
    const handlers = this.handlers.get(event) ?? []
    handlers.push(handler)
    this.handlers.set(event, handlers)
    return this
  }

  dispatch(event: string, ...args: any[]) {
    for (const handler of this.handlers.get(event) ?? []) handler(...args)
  }

  emit(event: string, payload?: any) {
    this.send({ t: 'event', e: event, d: payload })
  }

  send(packet: Packet) {
    if (this.ws.readyState !== WebSocket.OPEN) return
    try { this.ws.send(JSON.stringify(encodeValue(packet))) } catch { /* closing connection */ }
  }

  matches(ws: WebSocket) { return this.ws === ws }

  join(room: string) { this.io.join(this, room) }
  leave(room: string) { this.io.leave(this, room) }

  to(room: string) {
    return { emit: (event: string, payload?: any) => this.io.emitToRoom(room, event, payload, this.id) }
  }

  disconnect(close = false) {
    this.io.disconnect(this, 'server namespace disconnect')
    if (close && this.ws.readyState < WebSocket.CLOSING) this.ws.close(1000, 'server disconnect')
  }
}
