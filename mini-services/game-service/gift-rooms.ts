// Duos Cadeaux — espaces de tirage au sort, partagés par le serveur local
// (Socket.IO) et le Worker Cloudflare (Durable Object). Le module ne dépend
// que d'une petite interface de socket, commune aux deux implémentations.

import {
  GIFT_MAX_PARTICIPANTS,
  GIFT_TITLE,
  type GiftAssignment,
  type GiftHistoryEntry,
  type GiftSpaceView,
  type GiftYou,
  drawGifts,
  isValidCapacity,
  validateGiftName,
} from '../../src/lib/gift-draw'

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
const SPACE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // un espace expire 7 jours après sa dernière modification
const MAX_SPACES = 300
const CLIENT_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/
const DISABLED_MESSAGE = 'Le cadeau de Noël n\'est pas disponible pour le moment.'

interface StoredParticipant {
  id: string
  /** Secret côté navigateur : ne jamais l'envoyer aux autres participants. */
  clientId: string
  name: string
  joinedAt: number
}

interface StoredSpace {
  code: string
  capacity: number
  hostClientId: string
  createdAt: number
  updatedAt: number
  participants: StoredParticipant[]
  assignments: GiftAssignment[] | null
  drawnAt: number | null
}

export interface GiftBroadcaster {
  to(room: string): { emit(event: string, payload?: any): void }
  /** Diffusion à tous les clients connectés. */
  emit?(event: string, payload?: any): void
}

export interface GiftSocket {
  id: string
  join(room: string): void
  on(event: string, handler: (...args: any[]) => void): unknown
  getAttachment?(): Record<string, any>
  setAttachment?(value: Record<string, any>): void
}

const spaces = new Map<string, StoredSpace>()

// Réglage global : le bouton Cadeau Noël est visible uniquement quand il est activé.
let giftEnabled = true

// Historique des tirages terminés : permanent, supprimé seulement à la demande de l'admin.
const history = new Map<string, GiftHistoryEntry>()
const pendingHistoryIds = new Set<string>()
const pendingDeletedHistoryIds = new Set<string>()

export function giftRoomOf(code: string): string {
  return `gift:${code}`
}

function randomString(length: number, alphabet: string): string {
  const bytes = new Uint32Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
}

function pruneExpired(now: number): void {
  for (const [code, space] of spaces) {
    if (now - space.updatedAt > SPACE_TTL_MS) spaces.delete(code)
  }
  // Garde-fou : si le stockage est saturé, on retire les espaces les plus anciens.
  if (spaces.size > MAX_SPACES) {
    const oldest = [...spaces.values()].sort((a, b) => a.updatedAt - b.updatedAt)
    for (const space of oldest.slice(0, spaces.size - MAX_SPACES)) spaces.delete(space.code)
  }
}

function isHostRegistered(space: StoredSpace): boolean {
  return space.participants.some((p) => p.clientId === space.hostClientId)
}

function toView(space: StoredSpace): GiftSpaceView {
  return {
    code: space.code,
    title: GIFT_TITLE,
    capacity: space.capacity,
    hostRegistered: isHostRegistered(space),
    participants: space.participants.map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.clientId === space.hostClientId,
    })),
    drawn: space.assignments !== null,
    drawnAt: space.drawnAt,
    assignments: space.assignments ?? [],
  }
}

function youFor(space: StoredSpace, clientId: string): GiftYou {
  const mine = space.participants.find((p) => p.clientId === clientId)
  return { participantId: mine?.id ?? null, isHost: clientId === space.hostClientId }
}

function readClientId(payload: any): string | null {
  const clientId = payload?.clientId
  return typeof clientId === 'string' && CLIENT_ID_PATTERN.test(clientId) ? clientId : null
}

function reply(ack: ((response: unknown) => void) | undefined, response: unknown): void {
  if (typeof ack === 'function') ack(response)
}

function broadcast(io: GiftBroadcaster, space: StoredSpace): void {
  io.to(giftRoomOf(space.code)).emit('gift:update', { view: toView(space) })
}

/** Abonne la socket à l'espace et retient l'espace pour une reconnexion. */
function subscribe(socket: GiftSocket, code: string): void {
  socket.join(giftRoomOf(code))
  socket.setAttachment?.({ ...(socket.getAttachment?.() ?? {}), giftCode: code })
}

function findSpace(code: unknown): StoredSpace | null {
  if (typeof code !== 'string') return null
  return spaces.get(code.toUpperCase()) ?? null
}

function closeSpace(io: GiftBroadcaster, space: StoredSpace, reason: 'host-left' | 'disabled'): void {
  spaces.delete(space.code)
  io.to(giftRoomOf(space.code)).emit('gift:closed', { code: space.code, reason })
}

function recordHistory(space: StoredSpace, drawnAt: number): void {
  const names = new Map(space.participants.map((p) => [p.id, p.name] as const))
  const host = space.participants.find((p) => p.clientId === space.hostClientId)
  const entry: GiftHistoryEntry = {
    id: randomString(12, ID_ALPHABET),
    code: space.code,
    capacity: space.capacity,
    hostName: host?.name ?? '',
    createdAt: space.createdAt,
    drawnAt,
    participants: space.participants.map((p) => ({ name: p.name, isHost: p.clientId === space.hostClientId })),
    pairs: (space.assignments ?? []).map((a) => ({
      giver: names.get(a.giverId) ?? '?',
      receiver: names.get(a.receiverId) ?? '?',
    })),
  }
  history.set(entry.id, entry)
  pendingHistoryIds.add(entry.id)
}

/** Vérifie si ce client peut (re)valider un nom dans cet espace. */
function registrationError(space: StoredSpace, clientId: string, name: string): string | null {
  const existing = space.participants.find((p) => p.clientId === clientId)
  const taken = space.participants.some(
    (p) => p.clientId !== clientId && p.name.toLocaleLowerCase('fr') === name.toLocaleLowerCase('fr'),
  )
  if (taken) return 'Ce prénom est déjà pris dans cet espace.'
  if (existing) return null
  if (space.assignments) return 'Le tirage a déjà eu lieu, les inscriptions sont closes.'
  if (space.participants.length >= space.capacity) return 'Cet espace est complet.'
  // Une place reste réservée à l'hôte tant qu'il n'a pas validé son nom.
  const hostIsPending = !isHostRegistered(space) && clientId !== space.hostClientId
  if (hostIsPending && space.participants.length >= space.capacity - 1) {
    return 'Il ne reste plus que la place réservée à l\'hôte.'
  }
  return null
}

/** Active ou désactive le bouton. Désactiver ferme tous les espaces en cours. */
function setGiftEnabled(io: GiftBroadcaster, enabled: boolean): void {
  giftEnabled = enabled
  if (!enabled) {
    for (const space of [...spaces.values()]) closeSpace(io, space, 'disabled')
  }
  io.emit?.('gift:enabled-changed', { enabled })
}

function historyList(): GiftHistoryEntry[] {
  return [...history.values()].sort((a, b) => b.drawnAt - a.drawnAt)
}

export function registerGiftHandlers(io: GiftBroadcaster, socket: GiftSocket): void {
  // Une socket restaurée après hibernation retrouve son espace.
  const restoredCode = socket.getAttachment?.()?.giftCode
  if (typeof restoredCode === 'string' && spaces.has(restoredCode)) socket.join(giftRoomOf(restoredCode))

  const isBenchou = (): boolean => Boolean((socket as any).__isBenchou)

  socket.on('gift:status', (_payload: any, ack?: (res: unknown) => void) => {
    reply(ack, { ok: true, enabled: giftEnabled })
  })

  socket.on('gift:create', (payload: any, ack?: (res: unknown) => void) => {
    if (!giftEnabled) return reply(ack, { error: DISABLED_MESSAGE })
    const clientId = readClientId(payload)
    if (!clientId) return reply(ack, { error: 'Session invalide, recharge la page.' })
    if (!isValidCapacity(payload?.capacity)) {
      return reply(ack, { error: `Choisis un nombre pair entre 6 et ${GIFT_MAX_PARTICIPANTS}.` })
    }
    const hostName = validateGiftName(payload?.hostName)
    if (!hostName.ok) return reply(ack, { error: hostName.error })
    const now = Date.now()
    pruneExpired(now)
    if (spaces.size >= MAX_SPACES) return reply(ack, { error: 'Trop d\'espaces actifs, réessaie plus tard.' })

    let code = randomString(6, ROOM_ALPHABET)
    while (spaces.has(code)) code = randomString(6, ROOM_ALPHABET)
    const space: StoredSpace = {
      code,
      capacity: payload.capacity,
      hostClientId: clientId,
      createdAt: now,
      updatedAt: now,
      participants: [{ id: randomString(10, ID_ALPHABET), clientId, name: hostName.name, joinedAt: now }],
      assignments: null,
      drawnAt: null,
    }
    spaces.set(code, space)
    subscribe(socket, code)
    reply(ack, { ok: true, view: toView(space), you: youFor(space, clientId) })
  })

  socket.on('gift:open', (payload: any, ack?: (res: unknown) => void) => {
    const space = findSpace(payload?.code)
    if (!space) return reply(ack, { error: 'Espace introuvable. Le lien est peut-être expiré.' })
    subscribe(socket, space.code)
    const clientId = readClientId(payload)
    reply(ack, {
      ok: true,
      view: toView(space),
      you: clientId ? youFor(space, clientId) : { participantId: null, isHost: false },
    })
  })

  socket.on('gift:register', (payload: any, ack?: (res: unknown) => void) => {
    const space = findSpace(payload?.code)
    if (!space) return reply(ack, { error: 'Espace introuvable. Le lien est peut-être expiré.' })
    const clientId = readClientId(payload)
    if (!clientId) return reply(ack, { error: 'Session invalide, recharge la page.' })
    const checked = validateGiftName(payload?.name)
    if (!checked.ok) return reply(ack, { error: checked.error })

    const error = registrationError(space, clientId, checked.name)
    if (error) return reply(ack, { error })

    const now = Date.now()
    const existing = space.participants.find((p) => p.clientId === clientId)
    if (existing) {
      existing.name = checked.name
    } else {
      space.participants.push({ id: randomString(10, ID_ALPHABET), clientId, name: checked.name, joinedAt: now })
    }
    space.updatedAt = now
    subscribe(socket, space.code)
    broadcast(io, space)
    reply(ack, { ok: true, view: toView(space), you: youFor(space, clientId) })
  })

  socket.on('gift:draw', (payload: any, ack?: (res: unknown) => void) => {
    const space = findSpace(payload?.code)
    if (!space) return reply(ack, { error: 'Espace introuvable. Le lien est peut-être expiré.' })
    const clientId = readClientId(payload)
    if (!clientId || clientId !== space.hostClientId) {
      return reply(ack, { error: 'Seul l\'hôte peut lancer le tirage.' })
    }
    if (space.assignments) return reply(ack, { error: 'Le tirage a déjà été effectué.' })
    if (!isHostRegistered(space) || space.participants.length !== space.capacity) {
      return reply(ack, { error: 'Le tirage se lance quand toutes les places sont remplies.' })
    }

    const now = Date.now()
    try {
      space.assignments = drawGifts(space.participants.map((p) => p.id))
    } catch (error) {
      return reply(ack, { error: error instanceof Error ? error.message : 'Tirage impossible.' })
    }
    space.drawnAt = now
    space.updatedAt = now
    recordHistory(space, now)
    subscribe(socket, space.code)
    broadcast(io, space)
    reply(ack, { ok: true, view: toView(space), you: youFor(space, clientId) })
  })

  // Fermeture : quand l'hôte quitte, l'espace disparaît pour tout le monde.
  socket.on('gift:close', (payload: any, ack?: (res: unknown) => void) => {
    const space = findSpace(payload?.code)
    if (!space) return reply(ack, { ok: true })
    const clientId = readClientId(payload)
    if (!clientId || clientId !== space.hostClientId) {
      return reply(ack, { error: 'Seul l\'hôte peut fermer l\'espace.' })
    }
    closeSpace(io, space, 'host-left')
    reply(ack, { ok: true })
  })

  // ---- Administration (Benchou Ferrari uniquement) ----

  socket.on('admin-gift-set-enabled', (payload: any, ack?: (res: unknown) => void) => {
    if (!isBenchou()) return reply(ack, { error: 'Accès refusé.' })
    if (typeof payload?.enabled !== 'boolean') return reply(ack, { error: 'Valeur invalide.' })
    setGiftEnabled(io, payload.enabled)
    reply(ack, { ok: true, enabled: giftEnabled })
  })

  socket.on('admin-gift-list-history', (_payload: any, ack?: (res: unknown) => void) => {
    if (!isBenchou()) return reply(ack, { error: 'Accès refusé.' })
    reply(ack, { ok: true, enabled: giftEnabled, entries: historyList(), spaces: spaces.size })
  })

  socket.on('admin-gift-delete-history', (payload: any, ack?: (res: unknown) => void) => {
    if (!isBenchou()) return reply(ack, { error: 'Accès refusé.' })
    const id = typeof payload?.id === 'string' ? payload.id : ''
    if (!history.has(id)) return reply(ack, { error: 'Tirage introuvable dans l\'historique.' })
    history.delete(id)
    pendingHistoryIds.delete(id)
    pendingDeletedHistoryIds.add(id)
    reply(ack, { ok: true, entries: historyList() })
  })
}

// ====== Persistance (snapshot du Durable Object, à côté des salons de jeu) ======

export function serializeGiftSpaces(now = Date.now()): StoredSpace[] {
  pruneExpired(now)
  return [...spaces.values()]
}

export function serializeGiftEnabled(): boolean {
  return giftEnabled
}

export function restoreGiftSettings(value: unknown): void {
  giftEnabled = typeof value === 'boolean' ? value : true
}

export function restoreGiftSpaces(value: unknown): void {
  spaces.clear()
  if (!Array.isArray(value)) return
  for (const raw of value as StoredSpace[]) {
    if (typeof raw?.code !== 'string' || !isValidCapacity(raw.capacity)) continue
    if (!Array.isArray(raw.participants)) continue
    spaces.set(raw.code, {
      ...raw,
      assignments: raw.assignments ?? null,
      drawnAt: raw.drawnAt ?? null,
    })
  }
}

export function restoreGiftHistory(entries: GiftHistoryEntry[]): void {
  history.clear()
  pendingHistoryIds.clear()
  pendingDeletedHistoryIds.clear()
  for (const entry of entries) {
    if (typeof entry?.id === 'string') history.set(entry.id, entry)
  }
}

/** Tirages à écrire dans le stockage depuis le dernier enregistrement. */
export function getPendingGiftHistory(): GiftHistoryEntry[] {
  return [...pendingHistoryIds]
    .map((id) => history.get(id))
    .filter((entry): entry is GiftHistoryEntry => entry !== undefined)
}

export function markGiftHistoryPersisted(ids: string[]): void {
  for (const id of ids) pendingHistoryIds.delete(id)
}

export function getPendingDeletedGiftHistoryIds(): string[] {
  return [...pendingDeletedHistoryIds]
}

export function markGiftHistoryDeleted(ids: string[]): void {
  for (const id of ids) pendingDeletedHistoryIds.delete(id)
}