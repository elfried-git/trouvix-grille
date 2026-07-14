import { createServer } from 'http'
import { Server } from 'socket.io'

// ====== Game constants (must match the client store exactly) ======
const ROWS = 10
const COLS = 10
const TURN_SECONDS = 10
const RESOLVE_MS = 1700 // celebration lock after a square
const BOARD_FULL_RESOLVE_MS = 1200
const BENCHOU_PIN = process.env.BENCHOU_PIN || '331991' // Secret PIN (override via env in production)
const TICK_MS = 500 // 500ms = good balance between smoothness and memory
const TICK_DT = TICK_MS / 1000 // 0.5 seconds
const MAX_PLAYERS = 8
const PORT = parseInt(process.env.PORT || '3003', 10)

// ====== Types ======
type GridCell = string | null
type Phase = 'lobby' | 'playing' | 'gameover'

interface Player {
  id: string
  name: string
  color: string
  emoji: string // emoji string OR data URL (uploaded photo) OR public asset URL
  score: number
  alignments: number
  isAI?: boolean
  connected?: boolean // false when the player has disconnected mid-game (kept for score tracking)
}

interface SetupPlayer {
  name: string
  color: string
  emoji: string
}

interface CellCoord {
  row: number
  col: number
}

interface FormedSquare {
  cells: CellCoord[]
  playerId: string
}

interface GameState {
  phase: Phase
  players: Player[]
  currentPlayerIndex: number
  grid: GridCell[][]
  turnTimeLeft: number
  statusMessage: string
  winnerId: string | null
  lastSquareCells: CellCoord[] | null
  lastSquareerId: string | null
  formedSquares: FormedSquare[]
  resolving: boolean
  isPaused: boolean
  totalRounds: number
  currentRound: number
  lastDelta: { playerId: string; delta: number } | null
}

interface Room {
  roomCode: string
  hostId: string
  totalRounds: number
  state: GameState
}

// socket.id -> { roomCode, playerId }
interface SocketBinding {
  roomCode: string
  playerId: string
}

// ====== In-memory stores ======
const rooms = new Map<string, Room>()
const socketBindings = new Map<string, SocketBinding>()

// ====== Challenge system (Benchou Ferrari notifications) ======
interface Challenge {
  id: string
  roomCode: string
  challengerName: string
  challengerColor: string
  challengerEmoji: string
  totalRounds: number
  createdAt: number
  status: 'pending' | 'accepted' | 'expired'
}
const challenges = new Map<string, Challenge>()
let benchouSocketId: string | null = null // socket.id of the connected Benchou Ferrari

// ====== Helpers ======
function makeId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

function emptyGrid(): GridCell[][] {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => null as GridCell)
  )
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS
}

// Check the 4 possible 2x2 blocks the freshly placed pawn could belong to.
function checkSquare(
  grid: GridCell[][],
  row: number,
  col: number,
  playerId: string
): CellCoord[] | null {
  const offsets: [number, number][] = [
    [0, 0],   // pawn is top-left
    [0, -1],  // pawn is top-right
    [-1, 0],  // pawn is bottom-left
    [-1, -1], // pawn is bottom-right
  ]
  for (const [dr, dc] of offsets) {
    const r0 = row + dr
    const c0 = col + dc
    if (!inBounds(r0, c0) || !inBounds(r0 + 1, c0 + 1)) continue
    const cells = [
      { row: r0, col: c0 },
      { row: r0, col: c0 + 1 },
      { row: r0 + 1, col: c0 },
      { row: r0 + 1, col: c0 + 1 },
    ]
    if (cells.every((cell) => grid[cell.row][cell.col] === playerId)) {
      return cells
    }
  }
  return null
}

function isBoardFull(grid: GridCell[][]): boolean {
  return grid.every((row) => row.every((c) => c !== null))
}

function computeWinner(players: Player[]): string | null {
  if (players.length === 0) return null
  let best = players[0]
  for (const p of players) if (p.score > best.score) best = p
  return best.id
}

// 6 uppercase alphanumeric chars, no confusing chars (0/O/1/I)
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function generateRoomCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)]
  }
  return code
}

function uniqueRoomCode(): string {
  let code = generateRoomCode()
  while (rooms.has(code)) code = generateRoomCode()
  return code
}

function makePlayer(setup: SetupPlayer): Player {
  return {
    id: makeId(),
    name: (setup.name || '').trim() || `Joueur ${Math.floor(Math.random() * 100)}`,
    color: setup.color,
    emoji: setup.emoji || '',
    score: 0,
    alignments: 0,
    isAI: (setup as any).isAI ?? false,
    connected: true,
  }
}

function freshState(): GameState {
  return {
    phase: 'lobby',
    players: [],
    currentPlayerIndex: 0,
    grid: emptyGrid(),
    turnTimeLeft: TURN_SECONDS,
    statusMessage: '',
    winnerId: null,
    lastSquareCells: null,
    lastSquareerId: null,
    formedSquares: [],
    resolving: false,
    isPaused: false,
    totalRounds: 10,
    currentRound: 0,
    lastDelta: null,
  }
}

// Shape broadcast to clients.
// Lightweight clone: only clone what changes between ticks (grid, players, formedSquares)
function publicState(room: Room): any {
  const s = room.state
  let tiedPlayerIds: string[] = []
  if (s.phase === 'gameover' && s.players.length > 0) {
    const connected = s.players.filter((p) => p.connected !== false)
    if (connected.length > 0) {
      const maxScore = Math.max(...connected.map((p) => p.score))
      tiedPlayerIds = connected.filter((p) => p.score === maxScore).map((p) => p.id)
    }
  }
  return {
    roomCode: room.roomCode,
    hostId: room.hostId,
    totalRounds: room.totalRounds,
    phase: s.phase,
    players: s.players.map((p) => ({ ...p })),
    currentPlayerIndex: s.currentPlayerIndex,
    grid: s.grid.map((row) => [...row]),
    turnTimeLeft: Math.round(s.turnTimeLeft * 10) / 10, // round to 1 decimal (reduces JSON size)
    statusMessage: s.statusMessage,
    winnerId: s.winnerId,
    tiedPlayerIds: [...tiedPlayerIds],
    lastSquareCells: s.lastSquareCells ? s.lastSquareCells.map((c) => ({ ...c })) : null,
    lastSquareerId: s.lastSquareerId,
    formedSquares: s.formedSquares.map((sq) => ({ cells: sq.cells, playerId: sq.playerId })),
    resolving: s.resolving,
    isPaused: s.isPaused,
    currentRound: s.currentRound,
    lastDelta: s.lastDelta ? { ...s.lastDelta } : null,
  }
}

function broadcastState(room: Room): void {
  io.to(room.roomCode).emit('state-update', { state: publicState(room) })
}

function findRoom(roomCode: string): Room | undefined {
  return rooms.get(roomCode)
}

function reassignHost(room: Room): void {
  if (room.state.players.length === 0) {
    room.hostId = ''
    return
  }
  if (!room.state.players.some((p) => p.id === room.hostId)) {
    room.hostId = room.state.players[0].id
    console.log(`[room ${room.roomCode}] host reassigned to ${room.hostId}`)
  }
}

function removePlayerFromRoom(room: Room, playerId: string): boolean {
  const idx = room.state.players.findIndex((p) => p.id === playerId)
  if (idx === -1) return false
  room.state.players.splice(idx, 1)
  // Fix currentPlayerIndex if needed
  if (room.state.players.length === 0) {
    room.state.currentPlayerIndex = 0
  } else if (idx < room.state.currentPlayerIndex) {
    room.state.currentPlayerIndex -= 1
  } else if (room.state.currentPlayerIndex >= room.state.players.length) {
    room.state.currentPlayerIndex = room.state.currentPlayerIndex % room.state.players.length
  }
  reassignHost(room)
  return true
}

function nextPlayerIndex(room: Room): number {
  const n = room.state.players.length
  if (n === 0) return 0
  return (room.state.currentPlayerIndex + 1) % n
}

// ====== HTTP + Socket.io setup ======
const httpServer = createServer((req, res) => {
  // Health check endpoint — Railway uses this to verify the service is alive
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', service: 'trouvix-game-service', time: new Date().toISOString() }))
    return
  }
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})
const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ====== Admin helpers ======
interface AdminRoomInfo {
  roomCode: string
  hostName: string
  hostId: string
  playerCount: number
  maxPlayers: number
  phase: string
  totalRounds: number
  currentRound: number
  players: { id: string; name: string; color: string; emoji: string; score: number; connected: boolean; isAI: boolean }[]
  createdAt: number
}

function getAdminRoomList(): AdminRoomInfo[] {
  return Array.from(rooms.values()).map((room) => ({
    roomCode: room.roomCode,
    hostName: room.state.players.find((p) => p.id === room.hostId)?.name ?? 'Inconnu',
    hostId: room.hostId,
    playerCount: room.state.players.filter((p) => p.connected !== false).length,
    maxPlayers: MAX_PLAYERS,
    phase: room.state.phase,
    totalRounds: room.totalRounds,
    currentRound: room.state.currentRound,
    players: room.state.players.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      emoji: p.emoji,
      score: p.score,
      connected: p.connected !== false,
      isAI: p.isAI ?? false,
    })),
    createdAt: Date.now(), // approximate
  }))
}

function sendAdminRoomList(socket: any): void {
  socket.emit('admin-rooms-update', { rooms: getAdminRoomList() })
}

// Broadcast admin room list to Benchou if online
function broadcastAdminRoomList(): void {
  if (benchouSocketId) {
    sendAdminRoomList(io.sockets.sockets.get(benchouSocketId))
  }
}

// ====== Connection handling ======
io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id}`)

  // ---- create-room ----
  socket.on(
    'create-room',
    (payload: { player: SetupPlayer; totalRounds: number }, ack?: (res: any) => void) => {
      try {
        const totalRounds = payload?.totalRounds
        if (![5, 10, 15].includes(totalRounds)) {
          if (ack) ack({ error: 'Le nombre de rounds doit être 5, 10 ou 15' })
          else socket.emit('error', { message: 'Le nombre de rounds doit être 5, 10 ou 15' })
          return
        }
        const player = makePlayer(payload.player)
        const roomCode = uniqueRoomCode()
        const room: Room = {
          roomCode,
          hostId: player.id,
          totalRounds,
          state: freshState(),
        }
        room.state.totalRounds = totalRounds
        room.state.players.push(player)
        room.state.statusMessage = `Salon créé. En attente de joueurs... (hôte: ${player.name})`
        rooms.set(roomCode, room)
        socket.join(roomCode)
        socketBindings.set(socket.id, { roomCode, playerId: player.id })
        console.log(`[room ${roomCode}] created by ${player.name} (${player.id}), totalRounds=${totalRounds}`)
        if (ack) ack({ roomCode, playerId: player.id })
        broadcastState(room); broadcastAdminRoomList()
      } catch (err) {
        console.error('[create-room] error', err)
        if (ack) ack({ error: 'Erreur interne' })
        else socket.emit('error', { message: 'Erreur interne' })
      }
    }
  )

  // ---- register-as-benchou ----
  // Benchou Ferrari identifies himself with a secret PIN to receive challenge notifications + admin access.
  socket.on('register-as-benchou', (payload: { pin?: string }, ack?: (res: any) => void) => {
    const pin = payload?.pin
    if (!pin || pin !== BENCHOU_PIN) {
      console.log(`[benchou] Failed registration attempt — wrong PIN from socket ${socket.id}`)
      if (ack) ack({ error: 'Code PIN incorrect. Accès refusé.' })
      return
    }
    benchouSocketId = socket.id
    ;(socket as any).__isBenchou = true
    console.log(`[benchou] Benchou Ferrari authenticated & online (socket ${socket.id})`)
    // Send all pending challenges
    const pending = Array.from(challenges.values()).filter((c) => c.status === 'pending')
    if (ack) ack({ ok: true, pendingChallenges: pending })
    pending.forEach((c) => {
      socket.emit('benchou-challenge', { challenge: c })
    })
    // Send admin room list
    sendAdminRoomList(socket)
  })

  // ---- admin-list-rooms ----
  // Benchou Ferrari requests the full list of active rooms.
  socket.on('admin-list-rooms', (_payload: any, ack?: (res: any) => void) => {
    if (!(socket as any).__isBenchou) {
      if (ack) ack({ error: 'Accès refusé. PIN requis.' })
      return
    }
    if (ack) ack({ rooms: getAdminRoomList() })
  })

  // ---- admin-delete-room ----
  // Benchou Ferrari deletes a room. The room code becomes invalid immediately.
  socket.on('admin-delete-room', (payload: { roomCode: string }, ack?: (res: any) => void) => {
    if (!(socket as any).__isBenchou) {
      if (ack) ack({ error: 'Accès refusé.' })
      return
    }
    const code = (payload?.roomCode || '').toUpperCase()
    const room = rooms.get(code)
    if (!room) {
      if (ack) ack({ error: 'Salon introuvable.' })
      return
    }
    // Notify all players in the room that it was deleted
    io.to(code).emit('room-deleted', { roomCode: code, message: 'Le salon a été supprimé par l\'administrateur.' })
    // Disconnect all sockets from the room
    io.in(code).socketsLeave(code)
    // Delete the room
    rooms.delete(code)
    // Also delete any pending challenges for this room
    for (const [chId, ch] of challenges.entries()) {
      if (ch.roomCode === code) {
        ch.status = 'expired'
      }
    }
    console.log(`[admin] Room ${code} deleted by Benchou Ferrari`)
    if (ack) ack({ ok: true, rooms: getAdminRoomList() })
  })

  // ---- admin-kick-player ----
  // Benchou Ferrari kicks a player from a room.
  socket.on('admin-kick-player', (payload: { roomCode: string; playerId: string }, ack?: (res: any) => void) => {
    if (!(socket as any).__isBenchou) {
      if (ack) ack({ error: 'Accès refusé.' })
      return
    }
    const code = (payload?.roomCode || '').toUpperCase()
    const playerId = payload?.playerId
    const room = rooms.get(code)
    if (!room) {
      if (ack) ack({ error: 'Salon introuvable.' })
      return
    }
    // Find the player's socket via socketBindings
    let kickedSocket: any = null
    for (const [sockId, binding] of socketBindings.entries()) {
      if (binding.roomCode === code && binding.playerId === playerId) {
        kickedSocket = sockId
        break
      }
    }
    if (kickedSocket) {
      // Emit kick event to the player
      io.to(kickedSocket).emit('kicked', { roomCode: code, message: 'Vous avez été expulsé du salon par l\'administrateur.' })
      // Remove from room
      const sock = io.sockets.sockets.get(kickedSocket)
      if (sock) sock.leave(code)
    }
    // Mark player as disconnected in the room state
    const player = room.state.players.find((p) => p.id === playerId)
    if (player) {
      player.connected = false
      // If lobby phase, remove entirely
      if (room.state.phase === 'lobby') {
        room.state.players = room.state.players.filter((p) => p.id !== playerId)
      }
    }
    room.state.statusMessage = `Un joueur a été expulsé par l'administrateur.`
    console.log(`[admin] Player ${playerId} kicked from room ${code} by Benchou Ferrari`)
    broadcastState(room); broadcastAdminRoomList()
    if (ack) ack({ ok: true, rooms: getAdminRoomList() })
  })

  // ---- admin-join-room ----
  // Benchou Ferrari joins a room directly (as a player, not as host).
  socket.on('admin-join-room', (payload: { roomCode: string }, ack?: (res: any) => void) => {
    if (!(socket as any).__isBenchou) {
      if (ack) ack({ error: 'Accès refusé.' })
      return
    }
    const code = (payload?.roomCode || '').toUpperCase()
    const room = rooms.get(code)
    if (!room) {
      if (ack) ack({ error: 'Salon introuvable.' })
      return
    }
    if (room.state.phase !== 'lobby') {
      if (ack) ack({ error: 'La partie a déjà commencé' })
      return
    }
    if (room.state.players.length >= MAX_PLAYERS) {
      if (ack) ack({ error: 'Le salon est complet' })
      return
    }
    // Check if Benchou is already in the room
    if (room.state.players.some((p) => p.name === 'Benchou Ferrari')) {
      if (ack) ack({ error: 'Benchou Ferrari est déjà dans ce salon.' })
      return
    }
    const BENCHOU_COLORS = ['#b8860b', '#0f766e', '#6d28d9', '#0e7490', '#166534', '#1e3a8a']
    const taken = new Set(room.state.players.map((p) => p.color))
    const benchouColor = BENCHOU_COLORS.find((c) => !taken.has(c)) ?? '#b8860b'
    const benchou: Player = {
      id: makeId(),
      name: 'Benchou Ferrari',
      color: benchouColor,
      emoji: '/benchou-ferrari-small.jpg',
      score: 0,
      alignments: 0,
      isAI: false,
      connected: true,
    }
    room.state.players.push(benchou)
    socket.join(code)
    socketBindings.set(socket.id, { roomCode: code, playerId: benchou.id })
    room.state.statusMessage = `Benchou Ferrari a rejoint le salon ! (${room.state.players.length}/${MAX_PLAYERS})`
    console.log(`[admin] Benchou Ferrari joined room ${code}`)
    if (ack) ack({ ok: true, roomCode: code, playerId: benchou.id })
    broadcastState(room); broadcastAdminRoomList()
  })

  // ---- public-list-rooms ----
  // Anyone can see the list of public rooms (room code + host name + player count).
  // Joining still requires the correct code.
  socket.on('public-list-rooms', (_payload: any, ack?: (res: any) => void) => {
    const publicRooms = Array.from(rooms.values()).map((room) => ({
      roomCode: room.roomCode,
      hostName: room.state.players.find((p) => p.id === room.hostId)?.name ?? 'Inconnu',
      playerCount: room.state.players.filter((p) => p.connected !== false).length,
      maxPlayers: MAX_PLAYERS,
      phase: room.state.phase,
      totalRounds: room.totalRounds,
    }))
    if (ack) ack({ rooms: publicRooms })
  })

  // ---- challenge-benchou ----
  // A player challenges Benchou Ferrari to a game. Creates a room + sends notification.
  socket.on(
    'challenge-benchou',
    (payload: { player: SetupPlayer; totalRounds: number }, ack?: (res: any) => void) => {
      try {
        const totalRounds = payload?.totalRounds
        if (![5, 10, 15].includes(totalRounds)) {
          if (ack) ack({ error: 'Le nombre de rounds doit être 5, 10 ou 15' })
          return
        }
        const player = makePlayer(payload.player)
        const roomCode = uniqueRoomCode()
        const room: Room = {
          roomCode,
          hostId: player.id,
          totalRounds,
          state: freshState(),
        }
        room.state.totalRounds = totalRounds
        room.state.players.push(player)
        room.state.statusMessage = `En attente de Benchou Ferrari... (hôte: ${player.name})`
        rooms.set(roomCode, room)
        socket.join(roomCode)
        socketBindings.set(socket.id, { roomCode, playerId: player.id })

        // Create the challenge
        const challenge: Challenge = {
          id: makeId(),
          roomCode,
          challengerName: player.name,
          challengerColor: player.color,
          challengerEmoji: player.emoji,
          totalRounds,
          createdAt: Date.now(),
          status: 'pending',
        }
        challenges.set(challenge.id, challenge)

        console.log(`[challenge] ${player.name} challenged Benchou Ferrari — room ${roomCode}`)

        // Notify Benchou in real-time if online
        if (benchouSocketId) {
          io.to(benchouSocketId).emit('benchou-challenge', { challenge })
          console.log(`[challenge] notification sent to Benchou (online)`)
        }

        // Call the email/webhook API (fire-and-forget)
        fetch(`http://localhost:3000/api/notify-benchou`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            challengerName: player.name,
            roomCode,
            totalRounds,
            challengeId: challenge.id,
          }),
        }).catch(() => {}) // ignore errors — email is best-effort

        if (ack) ack({ roomCode, playerId: player.id, challengeId: challenge.id })
        broadcastState(room); broadcastAdminRoomList()
      } catch (err) {
        console.error('[challenge-benchou] error', err)
        if (ack) ack({ error: 'Erreur interne' })
      }
    }
  )

  // ---- accept-challenge ----
  // Benchou Ferrari accepts a challenge and joins the room.
  socket.on(
    'accept-challenge',
    (payload: { challengeId: string }, ack?: (res: any) => void) => {
      try {
        const challenge = challenges.get(payload?.challengeId)
        if (!challenge) {
          if (ack) ack({ error: 'Défi introuvable' })
          return
        }
        if (challenge.status !== 'pending') {
          if (ack) ack({ error: 'Défi déjà ' + (challenge.status === 'accepted' ? 'accepté' : 'expiré') })
          return
        }
        const room = findRoom(challenge.roomCode)
        if (!room) {
          if (ack) ack({ error: "Le salon n'existe plus" })
          challenge.status = 'expired'
          return
        }
        if (room.state.phase !== 'lobby') {
          if (ack) ack({ error: 'La partie a déjà commencé' })
          return
        }
        // Pick Benchou's color (gold by default, fallback to first free)
        const BENCHOU_COLORS = ['#b8860b', '#0f766e', '#6d28d9', '#0e7490', '#166534', '#1e3a8a']
        const taken = new Set(room.state.players.map((p) => p.color))
        const benchouColor = BENCHOU_COLORS.find((c) => !taken.has(c)) ?? '#b8860b'
        const benchou: Player = {
          id: makeId(),
          name: 'Benchou Ferrari',
          color: benchouColor,
          emoji: '/benchou-ferrari-small.jpg',
          score: 0,
          alignments: 0,
          isAI: false, // Benchou is a REAL person, not an AI!
        }
        room.state.players.push(benchou)
        socket.join(room.roomCode)
        socketBindings.set(socket.id, { roomCode: room.roomCode, playerId: benchou.id })
        challenge.status = 'accepted'
        room.state.statusMessage = `Benchou Ferrari a rejoint le salon ! (${room.state.players.length}/8)`
        console.log(`[challenge] Benchou Ferrari accepted challenge — room ${room.roomCode}`)
        if (ack) ack({ ok: true, roomCode: room.roomCode, playerId: benchou.id })
        broadcastState(room); broadcastAdminRoomList()
      } catch (err) {
        console.error('[accept-challenge] error', err)
        if (ack) ack({ error: 'Erreur interne' })
      }
    }
  )

  // ---- decline-challenge ----
  // Benchou Ferrari declines a challenge. The challenger is notified.
  socket.on(
    'decline-challenge',
    (payload: { challengeId: string }, ack?: (res: any) => void) => {
      try {
        const challenge = challenges.get(payload?.challengeId)
        if (!challenge) {
          if (ack) ack({ error: 'Défi introuvable' })
          return
        }
        challenge.status = 'expired'
        console.log(`[challenge] Benchou Ferrari DECLINED challenge from ${challenge.challengerName}`)

        // Notify the challenger that the challenge was declined
        // Find the challenger's socket via the room
        const room = findRoom(challenge.roomCode)
        if (room) {
          // Emit to the room — the challenger will receive it
          io.to(challenge.roomCode).emit('challenge-declined', {
            challengeId: challenge.id,
            challengerName: challenge.challengerName,
          })
          // Update room status message
          room.state.statusMessage = `Benchou Ferrari a décliné le défi. Tu peux quitter le salon.`
          broadcastState(room); broadcastAdminRoomList()
        }

        if (ack) ack({ ok: true })
      } catch (err) {
        console.error('[decline-challenge] error', err)
        if (ack) ack({ error: 'Erreur interne' })
      }
    }
  )

  // ---- join-room ----
  socket.on(
    'join-room',
    (payload: { roomCode: string; player: SetupPlayer }, ack?: (res: any) => void) => {
      try {
        const code = (payload?.roomCode || '').toUpperCase()
        const room = findRoom(code)
        if (!room) {
          if (ack) ack({ error: 'Salon introuvable' })
          else socket.emit('error', { message: 'Salon introuvable' })
          return
        }
        if (room.state.phase !== 'lobby') {
          if (ack) ack({ error: 'La partie a déjà commencé' })
          else socket.emit('error', { message: 'La partie a déjà commencé' })
          return
        }
        if (room.state.players.length >= MAX_PLAYERS) {
          if (ack) ack({ error: 'Le salon est complet' })
          else socket.emit('error', { message: 'Le salon est complet' })
          return
        }
        const color = payload.player?.color
        if (color && room.state.players.some((p) => p.color === color)) {
          if (ack) ack({ error: 'Couleur déjà prise' })
          else socket.emit('error', { message: 'Couleur déjà prise' })
          return
        }
        const player = makePlayer(payload.player)
        room.state.players.push(player)
        socket.join(code)
        socketBindings.set(socket.id, { roomCode: code, playerId: player.id })
        room.state.statusMessage = `${player.name} a rejoint le salon. (${room.state.players.length}/${MAX_PLAYERS})`
        console.log(`[room ${code}] ${player.name} (${player.id}) joined`)
        if (ack) ack({ playerId: player.id })
        // Notify others, then full state to everyone
        socket.to(code).emit('player-joined', { player })
        broadcastState(room); broadcastAdminRoomList()
      } catch (err) {
        console.error('[join-room] error', err)
        if (ack) ack({ error: 'Erreur interne' })
        else socket.emit('error', { message: 'Erreur interne' })
      }
    }
  )

  // ---- rejoin-room (reconnect) ----
  socket.on(
    'rejoin-room',
    (payload: { roomCode: string; playerId: string }, ack?: (res: any) => void) => {
      try {
        const code = (payload?.roomCode || '').toUpperCase()
        const playerId = payload?.playerId
        const room = findRoom(code)
        if (!room) {
          if (ack) ack({ ok: false, error: 'Salon introuvable' })
          return
        }
        const exists = room.state.players.some((p) => p.id === playerId)
        if (!exists) {
          if (ack) ack({ ok: false, error: 'Player not in room' })
          return
        }
        socket.join(code)
        socketBindings.set(socket.id, { roomCode: code, playerId })
        console.log(`[room ${code}] player ${playerId} rejoined via socket ${socket.id}`)
        if (ack) ack({ ok: true })
        broadcastState(room); broadcastAdminRoomList()
      } catch (err) {
        console.error('[rejoin-room] error', err)
        if (ack) ack({ ok: false, error: 'Erreur interne' })
      }
    }
  )

  // ---- start-game (host only) ----
  socket.on('start-game', (_payload: any, ack?: (res: any) => void) => {
    const binding = socketBindings.get(socket.id)
    if (!binding) {
      socket.emit('error', { message: "Vous n'êtes pas dans un salon" })
      return
    }
    const room = findRoom(binding.roomCode)
    if (!room) return
    if (room.hostId !== binding.playerId) {
      socket.emit('error', { message: "Seul l'hôte peut lancer la partie" })
      return
    }
    if (room.state.phase !== 'lobby') {
      socket.emit('error', { message: 'La partie a déjà commencé ou est terminée' })
      return
    }
    if (room.state.players.length < 2) {
      socket.emit('error', { message: 'Il faut au moins 2 joueurs pour commencer' })
      if (ack) ack({ error: 'Il faut au moins 2 joueurs pour commencer' })
      return
    }
    room.state.phase = 'playing'
    room.state.currentPlayerIndex = 0
    room.state.grid = emptyGrid()
    room.state.turnTimeLeft = TURN_SECONDS
    room.state.winnerId = null
    room.state.lastSquareCells = null
    room.state.lastSquareerId = null
    room.state.formedSquares = []
    room.state.resolving = false
    room.state.isPaused = false
    room.state.currentRound = 0
    room.state.lastDelta = null
    const first = room.state.players[0]
    room.state.statusMessage = `${first.name} commence ! 10 secondes par coup. ⏱️`
    console.log(`[room ${room.roomCode}] game started (${room.state.players.length} players, ${room.totalRounds} rounds)`)
    if (ack) ack({ ok: true })
    broadcastState(room); broadcastAdminRoomList()
  })

  // ---- place-pawn ----
  socket.on('place-pawn', (payload: { row: number; col: number }, ack?: (res: any) => void) => {
    const binding = socketBindings.get(socket.id)
    if (!binding) {
      if (ack) ack({ error: "Vous n'êtes pas dans un salon" })
      return
    }
    const room = findRoom(binding.roomCode)
    if (!room) {
      if (ack) ack({ error: "Le salon n'existe plus" })
      return
    }
    const s = room.state
    if (s.phase !== 'playing') {
      if (ack) ack({ error: "La partie n'est pas en cours" })
      return
    }
    if (s.resolving) {
      if (ack) ack({ error: "Attendez la fin de la célébration" })
      return
    }
    if (s.isPaused) {
      if (ack) ack({ error: "La partie est en pause" })
      return
    }
    const row = payload?.row
    const col = payload?.col
    if (typeof row !== 'number' || typeof col !== 'number' || !inBounds(row, col)) {
      if (ack) ack({ error: "Case invalide" })
      return
    }
    const cur = s.players[s.currentPlayerIndex]
    if (!cur) {
      if (ack) ack({ error: "Aucun joueur actif" })
      return
    }
    // Allow the host to play on behalf of AI players
    if (cur.id !== binding.playerId) {
      if (cur.isAI && room.hostId === binding.playerId) {
        // Host is playing for an AI — OK
      } else {
        if (ack) ack({ error: "Ce n'est pas votre tour" })
        return
      }
    }
    if (s.grid[row][col] !== null) {
      if (ack) ack({ error: "Case déjà occupée" })
      return
    }

    // Acknowledge success immediately — the client knows the move was accepted
    if (ack) ack({ ok: true })

    // Place pawn directly on the grid (no clone — single-threaded, safe)
    s.grid[row][col] = cur.id
    const square = checkSquare(s.grid, row, col, cur.id)

    if (square) {
      // Square formed: +1 score, currentRound++, brief resolve, then either gameover or next player.
      const playerIdx = s.players.findIndex((p) => p.id === cur.id)
      if (playerIdx >= 0) {
        s.players[playerIdx].score += 1
        s.players[playerIdx].alignments += 1
      }
      s.lastSquareCells = square
      s.lastSquareerId = cur.id
      s.formedSquares.push({ cells: square, playerId: cur.id })
      s.resolving = true
      s.lastDelta = { playerId: cur.id, delta: 1 }
      s.currentRound += 1
      s.statusMessage = `🟦 ${cur.name} forme un carré ! +1 point (Carré ${s.currentRound}/${s.totalRounds})`
      console.log(`[room ${room.roomCode}] SQUARE by ${cur.name} at (${row},${col}) — carré ${s.currentRound}/${s.totalRounds}`)
      broadcastState(room); broadcastAdminRoomList()

      setTimeout(() => {
        const r2 = findRoom(binding.roomCode)
        if (!r2) return
        const st = r2.state
        if (st.phase !== 'playing') return
        st.resolving = false
        st.lastSquareCells = null
        if (st.currentRound >= st.totalRounds) {
          const winnerId = computeWinner(st.players)
          st.phase = 'gameover'
          st.winnerId = winnerId
          st.statusMessage = `Match terminé après ${st.totalRounds} carrés ! 🏆`
          console.log(`[room ${r2.roomCode}] GAME OVER (rounds reached) winner=${winnerId}`)
          broadcastState(r2)
          return
        }
        const nextIndex = nextPlayerIndex(r2)
        const next = st.players[nextIndex]
        st.currentPlayerIndex = nextIndex
        st.turnTimeLeft = TURN_SECONDS
        st.statusMessage = `Carré ${st.currentRound}/${st.totalRounds} — à ${next?.name ?? '?'} ! ⏱️`
        broadcastState(r2)
      }, RESOLVE_MS)
      return
    }

    // No square: check board full
    if (isBoardFull(s.grid)) {
      s.resolving = true
      const winnerId = computeWinner(s.players)
      s.statusMessage = 'Plateau plein ! Fin du match.'
      broadcastState(room); broadcastAdminRoomList()
      setTimeout(() => {
        const r2 = findRoom(binding.roomCode)
        if (!r2) return
        const st = r2.state
        if (st.phase !== 'playing') return
        st.phase = 'gameover'
        st.winnerId = winnerId
        st.resolving = false
        st.lastSquareCells = null
        st.statusMessage = 'Plateau plein — match terminé ! 🏆'
        console.log(`[room ${r2.roomCode}] GAME OVER (board full) winner=${winnerId}`)
        broadcastState(r2)
      }, BOARD_FULL_RESOLVE_MS)
      return
    }

    // No square, board not full: next player
    const nextIndex = nextPlayerIndex(room)
    const next = s.players[nextIndex]
    s.currentPlayerIndex = nextIndex
    s.turnTimeLeft = TURN_SECONDS
    s.statusMessage = `À ${next?.name ?? '?'} de jouer. ⏱️`
    broadcastState(room); broadcastAdminRoomList()
  })

  // ---- toggle-pause (host only) ----
  socket.on('toggle-pause', () => {
    const binding = socketBindings.get(socket.id)
    if (!binding) return
    const room = findRoom(binding.roomCode)
    if (!room) return
    if (room.hostId !== binding.playerId) {
      socket.emit('error', { message: "Seul l'hôte peut mettre en pause" })
      return
    }
    const s = room.state
    if (s.phase !== 'playing' || s.resolving) return
    const next = !s.isPaused
    s.isPaused = next
    s.statusMessage = next
      ? '⏸️ Partie en pause.'
      : `${s.players[s.currentPlayerIndex]?.name ?? ''} reprend. ⏱️`
    broadcastState(room); broadcastAdminRoomList()
  })

  // ---- end-game (host only) ----
  socket.on('end-game', () => {
    const binding = socketBindings.get(socket.id)
    if (!binding) return
    const room = findRoom(binding.roomCode)
    if (!room) return
    if (room.hostId !== binding.playerId) {
      socket.emit('error', { message: "Seul l'hôte peut terminer la partie" })
      return
    }
    const s = room.state
    s.phase = 'gameover'
    s.winnerId = computeWinner(s.players)
    s.resolving = false
    s.isPaused = false
    s.statusMessage = 'Partie terminée !'
    console.log(`[room ${room.roomCode}] game ended by host, winner=${s.winnerId}`)
    broadcastState(room); broadcastAdminRoomList()
  })

  // ---- restart (host only) ----
  socket.on('restart', () => {
    const binding = socketBindings.get(socket.id)
    if (!binding) return
    const room = findRoom(binding.roomCode)
    if (!room) return
    if (room.hostId !== binding.playerId) {
      socket.emit('error', { message: "Seul l'hôte peut relancer" })
      return
    }
    // Keep players, reset everything else, go back to lobby.
    const keptPlayers = room.state.players.map((p) => ({
      ...p,
      score: 0,
      alignments: 0,
    }))
    room.state = freshState()
    room.state.players = keptPlayers
    room.state.totalRounds = room.totalRounds
    room.state.statusMessage = 'Retour au salon. L’hôte peut relancer la partie.'
    console.log(`[room ${room.roomCode}] restarted to lobby (${keptPlayers.length} players kept)`)
    broadcastState(room); broadcastAdminRoomList()
  })

  // ---- rematch-tied (host only) ----
  // Restarts the game with ONLY the tied players (those sharing the max score).
  // Eliminated players are dropped. Repeat until a single winner emerges.
  socket.on('rematch-tied', () => {
    const binding = socketBindings.get(socket.id)
    if (!binding) return
    const room = findRoom(binding.roomCode)
    if (!room) return
    if (room.hostId !== binding.playerId) {
      socket.emit('error', { message: "Seul l'hôte peut lancer le challenge décisif" })
      return
    }
    const s = room.state
    if (s.phase !== 'gameover') {
      socket.emit('error', { message: "La partie n'est pas terminée" })
      return
    }
    if (s.players.length === 0) return
    const maxScore = Math.max(...s.players.map((p) => p.score))
    const tied = s.players.filter((p) => p.score === maxScore)
    if (tied.length <= 1) {
      socket.emit('error', { message: 'Aucune égalité à départager' })
      return
    }
    // Keep only tied players, reset their scores, start a new game
    const keptTied = tied.map((p) => ({ ...p, score: 0, alignments: 0 }))
    room.state.phase = 'playing'
    room.state.players = keptTied
    room.state.currentPlayerIndex = 0
    room.state.grid = emptyGrid()
    room.state.turnTimeLeft = TURN_SECONDS
    room.state.winnerId = null
    room.state.lastSquareCells = null
    room.state.lastSquareerId = null
    room.state.formedSquares = []
    room.state.resolving = false
    room.state.isPaused = false
    room.state.currentRound = 0
    room.state.lastDelta = null
    const first = keptTied[0]
    room.state.statusMessage = `Challenge décisif ! À ${first?.name ?? '?'} de jouer. ⏱️`
    console.log(`[room ${room.roomCode}] TIEBREAKER: ${keptTied.length} tied players (${keptTied.map((p) => p.name).join(', ')})`)
    broadcastState(room); broadcastAdminRoomList()
  })

  // ---- leave-room ----
  socket.on('leave-room', () => {
    const binding = socketBindings.get(socket.id)
    if (!binding) return
    handleLeave(socket, binding)
  })

  // ---- disconnect ----
  socket.on('disconnect', () => {
    const binding = socketBindings.get(socket.id)
    console.log(`[socket] disconnected: ${socket.id}`)
    if (benchouSocketId === socket.id) {
      benchouSocketId = null
      console.log(`[benchou] Benchou Ferrari went offline`)
    }
    if (!binding) return
    handleLeave(socket, binding)
  })

  socket.on('error', (err: any) => {
    console.error(`[socket ${socket.id}] error:`, err)
  })
})

function handleLeave(socket: any, binding: SocketBinding): void {
  const code = binding.roomCode
  const playerId = binding.playerId
  socketBindings.delete(socket.id)
  socket.leave(code)
  const room = findRoom(code)
  if (!room) return

  // During a game (playing/gameover): DON'T delete the player — mark as disconnected.
  // This preserves scores, grid pawns, and indices. The game continues with remaining players.
  if (room.state.phase === 'playing' || room.state.phase === 'gameover') {
    const player = room.state.players.find((p) => p.id === playerId)
    if (player) {
      player.connected = false
      console.log(`[room ${code}] player ${player.name} disconnected mid-game (marked inactive)`)

      // Count still-connected players
      const connectedPlayers = room.state.players.filter((p) => p.connected !== false)
      
      if (room.state.phase === 'playing') {
        if (connectedPlayers.length <= 1) {
          // Only 1 (or 0) player left → end the game
          const winnerId = connectedPlayers.length === 1 ? connectedPlayers[0].id : computeWinner(room.state.players)
          room.state.phase = 'gameover'
          room.state.winnerId = winnerId
          room.state.resolving = false
          room.state.statusMessage = `${player.name} a quitté la partie. Fin du match.`
          console.log(`[room ${code}] GAME OVER — ${player.name} left, ${connectedPlayers.length} connected player(s) remaining`)
          socket.to(code).emit('player-left', { playerId, playerName: player.name, gameOver: true })
          broadcastState(room); broadcastAdminRoomList()
          return
        } else {
          // 2+ players still connected → game continues
          // If it was the disconnected player's turn, pass to the next connected player
          const cur = room.state.players[room.state.currentPlayerIndex]
          if (cur && (cur.id === playerId || cur.connected === false)) {
            // Find next connected player
            let nextIdx = room.state.currentPlayerIndex
            for (let i = 0; i < room.state.players.length; i++) {
              nextIdx = (nextIdx + 1) % room.state.players.length
              if (room.state.players[nextIdx].connected !== false) break
            }
            room.state.currentPlayerIndex = nextIdx
            room.state.turnTimeLeft = TURN_SECONDS
            const next = room.state.players[nextIdx]
            room.state.statusMessage = `${player.name} a quitté. À ${next?.name ?? '?'} de jouer. ⏱️`
          } else {
            room.state.statusMessage = `${player.name} a quitté la partie. Le jeu continue.`
          }
          socket.to(code).emit('player-left', { playerId, playerName: player.name, gameOver: false })
          broadcastState(room); broadcastAdminRoomList()
          return
        }
      }
      // gameover phase: just mark disconnected, broadcast
      socket.to(code).emit('player-left', { playerId, playerName: player.name })
      broadcastState(room); broadcastAdminRoomList()
      return
    }
  }

  // Lobby phase: remove the player entirely (original behavior)
  const removed = removePlayerFromRoom(room, playerId)
  if (removed) {
    console.log(`[room ${code}] player ${playerId} left (${room.state.players.length} remaining)`)
    socket.to(code).emit('player-left', { playerId, playerName: room.state.players.find(p => p.id === playerId)?.name })
  }
  if (room.state.players.length === 0) {
    rooms.delete(code)
    console.log(`[room ${code}] deleted (empty)`)
    return
  }
  broadcastState(room); broadcastAdminRoomList()
}

// ====== Server-side timer (optimized: only broadcast on second change) ======
setInterval(() => {
  for (const room of rooms.values()) {
    const s = room.state
    if (s.phase !== 'playing' || s.resolving || s.isPaused) continue
    if (s.players.length === 0) continue
    const tl = s.turnTimeLeft - TICK_DT
    if (tl <= 0) {
      // Time's up: pass the turn to the next CONNECTED player.
      let nextIdx = s.currentPlayerIndex
      for (let i = 0; i < s.players.length; i++) {
        nextIdx = (nextIdx + 1) % s.players.length
        if (s.players[nextIdx].connected !== false) break
      }
      const next = s.players[nextIdx]
      s.turnTimeLeft = TURN_SECONDS
      s.currentPlayerIndex = nextIdx
      s.statusMessage = `Temps écoulé ! À ${next?.name ?? '?'} de jouer. ⏱️`
      broadcastState(room); broadcastAdminRoomList()
    } else {
      s.turnTimeLeft = tl
      // Only broadcast when the integer second changes (reduces traffic by 50%)
      const oldSec = Math.ceil(tl + TICK_DT)
      const newSec = Math.ceil(tl)
      if (oldSec !== newSec || tl <= 0.5) {
        broadcastState(room); broadcastAdminRoomList()
      }
    }
  }
}, TICK_MS)

// ====== Boot ======
httpServer.listen(PORT, () => {
  console.log(`Trouvix game service on port ${PORT}`)
})

// ====== Graceful shutdown ======
function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down...`)
  io.close(() => {
    httpServer.close(() => {
      console.log('Trouvix game service closed')
      process.exit(0)
    })
  })
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// ====== Memory cleanup: remove empty/stale rooms every 5 minutes ======
const CLEANUP_INTERVAL = 5 * 60 * 1000 // 5 minutes
const STALE_ROOM_MS = 30 * 60 * 1000 // 30 minutes of inactivity = stale
setInterval(() => {
  let cleaned = 0
  for (const [code, room] of rooms.entries()) {
    // Delete empty rooms
    if (room.state.players.length === 0) {
      rooms.delete(code)
      cleaned++
      continue
    }
    // Delete stale rooms (no active game, created > 30 min ago)
    // We use the last status change as a proxy — if phase is lobby and older than 30 min, clean
    if (room.state.phase === 'lobby') {
      // Check if any player is still connected
      const hasConnected = room.state.players.some((p) => p.connected !== false)
      if (!hasConnected) {
        rooms.delete(code)
        cleaned++
      }
    }
  }
  if (cleaned > 0) {
    console.log(`[cleanup] Removed ${cleaned} stale room(s). Active rooms: ${rooms.size}`)
  }
}, CLEANUP_INTERVAL)
