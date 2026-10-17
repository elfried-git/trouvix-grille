import {
  configureGame,
  io,
  restoreGameState,
  runScheduledMaintenance,
  serializeGameState,
} from './cloudflare-game'

interface Env {
  GAME: DurableObjectNamespace
  BENCHOU_PIN?: string
  APP_URL?: string
}

interface DurableObjectNamespace {
  idFromName(name: string): unknown
  get(id: unknown): { fetch(request: Request): Promise<Response> }
}

interface DurableObjectStorage {
  get<T>(key: string): Promise<T | undefined>
  put(key: string, value: string): Promise<void>
  setAlarm(timestamp: number): Promise<void>
  deleteAlarm(): Promise<void>
}

interface DurableObjectState {
  storage: DurableObjectStorage
  acceptWebSocket(socket: WebSocket): void
  getWebSockets(): WebSocket[]
}

declare const WebSocketPair: { new (): { 0: WebSocket; 1: WebSocket } }

const jsonResponse = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  },
})

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/health' || url.pathname === '/') {
      return jsonResponse(200, { status: 'ok', service: 'trouvix-game-service', time: new Date().toISOString() })
    }
    if (url.pathname !== '/ws' || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return jsonResponse(404, { error: 'Not found' })
    }

    const id = env.GAME.idFromName('trouvix-game-coordinator')
    return env.GAME.get(id).fetch(request)
  },
}

export class GameCoordinator {
  private initialization: Promise<void> | null = null

  constructor(private state: DurableObjectState, env: Env) {
    configureGame({ benchouPin: env.BENCHOU_PIN, appUrl: env.APP_URL })
  }

  private ensureInitialized(): Promise<void> {
    if (!this.initialization) this.initialization = this.initialize()
    return this.initialization
  }

  private async initialize(): Promise<void> {
    io.reset()
    const snapshot = await this.state.storage.get<string>('game-state')
    restoreGameState(snapshot)

    // Hibernated WebSockets remain connected. Recreate their in-memory server
    // sockets and room listeners from their small per-connection attachments.
    for (const webSocket of this.state.getWebSockets()) {
      const attachment = (webSocket as WebSocket & { deserializeAttachment?: () => Record<string, any> }).deserializeAttachment?.()
      io.connect(webSocket, attachment, false)
    }

    const maintenance = runScheduledMaintenance()
    if (snapshot !== undefined || maintenance.changed) await this.persistSnapshot()
    await this.scheduleAlarm(maintenance.nextAt)
  }

  private async persistSnapshot(): Promise<void> {
    try {
      await this.state.storage.put('game-state', serializeGameState())
    } catch (error) {
      // A user-uploaded avatar can make the snapshot exceed DO's value limit.
      // Keep the live game running and report the durability problem clearly.
      console.error('[durable-object] could not persist game state:', error)
    }
  }

  private async scheduleAlarm(nextAt: number | null): Promise<void> {
    if (nextAt === null) {
      await this.state.storage.deleteAlarm()
      return
    }
    await this.state.storage.setAlarm(nextAt)
  }

  private async persistAndSchedule(shouldPersist: boolean): Promise<void> {
    const maintenance = runScheduledMaintenance()
    if (shouldPersist || maintenance.changed) await this.persistSnapshot()
    await this.scheduleAlarm(maintenance.nextAt)
  }

  async fetch(request: Request): Promise<Response> {
    await this.ensureInitialized()
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return jsonResponse(426, { error: 'WebSocket upgrade required' })
    }

    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]
    this.state.acceptWebSocket(server)
    io.connect(server)
    return new Response(null, { status: 101, webSocket: client } as ResponseInit & { webSocket: WebSocket })
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    await this.ensureInitialized()
    const beforeMessage = runScheduledMaintenance()
    if (beforeMessage.changed) await this.persistSnapshot()
    await this.scheduleAlarm(beforeMessage.nextAt)
    io.receiveWebSocket(socket, message)

    let eventName = ''
    try {
      eventName = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message)).e ?? ''
    } catch { /* ignore malformed packets; the adapter already rejects them */ }
    const isReadOnlyOrEphemeral = [
      'list-public-rooms', 'public-list-rooms', 'admin-list-rooms',
      'voice-start', 'voice-stop', 'voice-audio',
    ].includes(eventName)
    await this.persistAndSchedule(!isReadOnlyOrEphemeral)
  }

  async webSocketClose(socket: WebSocket, code: number, reason: string): Promise<void> {
    await this.ensureInitialized()
    const beforeClose = runScheduledMaintenance()
    if (beforeClose.changed) await this.persistSnapshot()
    await this.scheduleAlarm(beforeClose.nextAt)
    io.disconnectWebSocket(socket, `${code}: ${reason}`)
    await this.persistAndSchedule(true)
  }

  async webSocketError(socket: WebSocket): Promise<void> {
    await this.ensureInitialized()
    const beforeError = runScheduledMaintenance()
    if (beforeError.changed) await this.persistSnapshot()
    await this.scheduleAlarm(beforeError.nextAt)
    io.disconnectWebSocket(socket, 'websocket error')
    await this.persistAndSchedule(true)
  }

  async alarm(): Promise<void> {
    await this.ensureInitialized()
    const maintenance = runScheduledMaintenance()
    if (maintenance.changed) await this.persistSnapshot()
    await this.scheduleAlarm(maintenance.nextAt)
  }
}
