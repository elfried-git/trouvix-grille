import {
  type AdminRoomInfo,
  configureGame,
  getPendingDeletedArchivedRoomCodes,
  getPendingArchivedRooms,
  getBenchouAvatar,
  io,
  markArchivedRoomsDeleted,
  markArchivedRoomsPersisted,
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
  put<T>(key: string, value: T): Promise<void>
  list<T>(options?: { prefix?: string }): Promise<Map<string, T>>
  delete(keys: string | string[]): Promise<boolean | number>
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
    if (url.pathname === '/reviews' || url.pathname.startsWith('/reviews/')) {
      const id = env.GAME.idFromName('trouvix-game-coordinator')
      return env.GAME.get(id).fetch(request)
    }
    if (url.pathname !== '/ws' || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return jsonResponse(404, { error: 'Not found' })
    }

    const id = env.GAME.idFromName('trouvix-game-coordinator')
    return env.GAME.get(id).fetch(request)
  },
}

export class GameCoordinatorV2 {
  private initialization: Promise<void> | null = null
  private readonly adminPin: string

  constructor(private state: DurableObjectState, env: Env) {
    this.adminPin = env.BENCHOU_PIN || '331991'
    configureGame({ benchouPin: env.BENCHOU_PIN, appUrl: env.APP_URL })
  }

  private ensureInitialized(): Promise<void> {
    if (!this.initialization) this.initialization = this.initialize()
    return this.initialization
  }

  private async initialize(): Promise<void> {
    io.reset()
    const [snapshot, avatar] = await Promise.all([
      this.state.storage.get<string>('game-state'),
      this.state.storage.get<string>('benchou-avatar'),
    ])
    const history = await this.state.storage.list<AdminRoomInfo>({ prefix: 'room-history:' })
    restoreGameState(snapshot, avatar, [...history.values()])
    if (avatar === undefined) {
      await this.state.storage.put('benchou-avatar', getBenchouAvatar())
    }

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
      const deletedRoomCodes = getPendingDeletedArchivedRoomCodes()
      if (deletedRoomCodes.length > 0) {
        await this.state.storage.delete(deletedRoomCodes.map((roomCode) => `room-history:${roomCode}`))
        markArchivedRoomsDeleted(deletedRoomCodes)
      }
      const history = getPendingArchivedRooms()
      for (const room of history) {
        await this.state.storage.put(`room-history:${room.roomCode}`, room)
        markArchivedRoomsPersisted([room.roomCode])
      }
      await this.state.storage.put('game-state', serializeGameState())
    } catch (error) {
      console.error('[durable-object] could not persist game state or room history:', error)
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
      return this.handleReviewsRequest(request)
    }

    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]
    this.state.acceptWebSocket(server)
    io.connect(server)
    return new Response(null, { status: 101, webSocket: client } as ResponseInit & { webSocket: WebSocket })
  }

  private async handleReviewsRequest(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname.replace(/\/$/, '')
    const method = request.method.toUpperCase()
    const isAdmin = request.headers.get('x-benchou-pin') === this.adminPin
    const adminRequired = method === 'PATCH' || method === 'DELETE' || (method === 'GET' && url.searchParams.get('all') === 'true')
    if (adminRequired && !isAdmin) return jsonResponse(401, { error: 'Code PIN incorrect' })

    try {
      if (path === '/reviews' && method === 'GET') {
        const stored = await this.state.storage.list<Record<string, unknown>>({ prefix: 'review:' })
        const all = url.searchParams.get('all') === 'true'
        const reviews = [...stored.values()]
          .filter((review) => all || review.visible === true)
          .sort((a, b) => Number(b.adminLiked) - Number(a.adminLiked) || String(b.createdAt).localeCompare(String(a.createdAt)))
          .slice(0, 200)
        return jsonResponse(200, { reviews })
      }

      if (path === '/reviews' && method === 'POST') {
        const body = await request.json().catch(() => null) as { rating?: unknown; comment?: unknown } | null
        const rating = Number(body?.rating)
        const comment = typeof body?.comment === 'string' ? body.comment.trim().slice(0, 500) : ''
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
          return jsonResponse(400, { error: 'La note doit être entre 1 et 5 étoiles.' })
        }
        const review = {
          id: crypto.randomUUID(),
          authorName: 'Anonyme',
          rating,
          comment,
          createdAt: new Date().toISOString(),
          visible: true,
          adminLiked: false,
        }
        await this.state.storage.put(`review:${review.id}`, review)
        return jsonResponse(201, { review })
      }

      if (path === '/reviews' && method === 'DELETE') {
        const body = await request.json().catch(() => null) as { ids?: unknown } | null
        const ids = Array.isArray(body?.ids)
          ? [...new Set(body.ids.filter((id): id is string => typeof id === 'string' && id.length > 0))]
          : []
        if (ids.length === 0 || ids.length > 200) return jsonResponse(400, { error: 'Sélection d’avis invalide.' })
        const existing = await Promise.all(ids.map((id) => this.state.storage.get(`review:${id}`)))
        const existingKeys = ids.filter((_, index) => existing[index] !== undefined).map((id) => `review:${id}`)
        if (existingKeys.length > 0) await this.state.storage.delete(existingKeys)
        return jsonResponse(200, { ok: true, deletedCount: existing.filter((review) => review !== undefined).length })
      }

      const match = path.match(/^\/reviews\/([^/]+)$/)
      if (match && method === 'PATCH') {
        const id = decodeURIComponent(match[1])
        const existing = await this.state.storage.get<Record<string, unknown>>(`review:${id}`)
        if (!existing) return jsonResponse(404, { error: 'Avis introuvable.' })
        const body = await request.json().catch(() => ({})) as { visible?: unknown; adminLiked?: unknown }
        const review = {
          ...existing,
          ...(typeof body.visible === 'boolean' ? { visible: body.visible } : {}),
          ...(typeof body.adminLiked === 'boolean' ? { adminLiked: body.adminLiked } : {}),
        }
        await this.state.storage.put(`review:${id}`, review)
        return jsonResponse(200, { review })
      }

      if (match && method === 'DELETE') {
        const id = decodeURIComponent(match[1])
        const existing = await this.state.storage.get(`review:${id}`)
        if (existing === undefined) return jsonResponse(404, { error: 'Avis introuvable.' })
        await this.state.storage.delete(`review:${id}`)
        return jsonResponse(200, { ok: true })
      }

      return jsonResponse(404, { error: 'Not found' })
    } catch (error) {
      console.error('[durable-object] review storage error:', error)
      return jsonResponse(500, { error: 'Impossible de traiter les avis.' })
    }
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
