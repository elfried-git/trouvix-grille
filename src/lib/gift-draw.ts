// Tirage Cadeau Noël — règles partagées par le client et les serveurs de jeu.
// Chacun offre à quelqu'un et reçoit de quelqu'un, sans jamais s'offrir à soi-même
// ni former de paire réciproque (A -> B et B -> A). Le nombre de participants est pair.

export const GIFT_TITLE = "Cadeau Noël";
export const GIFT_MIN_PARTICIPANTS = 6;
export const GIFT_MAX_PARTICIPANTS = 10;
export const GIFT_NAME_MIN_LENGTH = 2;
export const GIFT_NAME_MAX_LENGTH = 20;
export const GIFT_ALLOWED_CAPACITIES = [6, 8, 10] as const;

export interface GiftParticipant {
  id: string;
  name: string;
  isHost: boolean;
}

export interface GiftAssignment {
  giverId: string;
  receiverId: string;
}

/** Un tirage terminé, tel que l'admin le consulte (noms uniquement, aucun identifiant secret). */
export interface GiftHistoryEntry {
  id: string;
  code: string;
  capacity: number;
  hostName: string;
  createdAt: number;
  drawnAt: number;
  participants: { name: string; isHost: boolean }[];
  /** giver offre à receiver. */
  pairs: { giver: string; receiver: string }[];
}

/** Vue publique d'un espace : aucun identifiant secret n'y figure. */
export interface GiftSpaceView {
  code: string;
  title: string;
  capacity: number;
  /** Places réservées : l'hôte doit aussi valider son nom. */
  hostRegistered: boolean;
  participants: GiftParticipant[];
  drawn: boolean;
  drawnAt: number | null;
  assignments: GiftAssignment[];
}

/** Ce que le serveur renvoie au client qui fait la demande. */
export interface GiftYou {
  participantId: string | null;
  isHost: boolean;
}

export function isValidCapacity(value: unknown): value is number {
  return typeof value === "number"
    && Number.isInteger(value)
    && value >= GIFT_MIN_PARTICIPANTS
    && value <= GIFT_MAX_PARTICIPANTS
    && value % 2 === 0;
}

/** Nettoie un nom saisi : espaces superflus retirés, longueur bornée. */
export function normalizeGiftName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/\s+/g, " ").trim();
}

export function validateGiftName(raw: unknown): { ok: true; name: string } | { ok: false; error: string } {
  const name = normalizeGiftName(raw);
  const length = Array.from(name).length;
  if (length < GIFT_NAME_MIN_LENGTH) {
    return { ok: false, error: `Le nom doit faire au moins ${GIFT_NAME_MIN_LENGTH} caractères.` };
  }
  if (length > GIFT_NAME_MAX_LENGTH) {
    return { ok: false, error: `Le nom ne doit pas dépasser ${GIFT_NAME_MAX_LENGTH} caractères.` };
  }
  return { ok: true, name };
}

/** Mélange uniformément (Fisher-Yates) avec une source cryptographique. */
export function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  const random = new Uint32Array(1);
  for (let i = result.length - 1; i > 0; i--) {
    crypto.getRandomValues(random);
    const j = random[0] % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Tirage aléatoire : chaque personne offre à quelqu'un d'autre, et reçoit de
 * quelqu'un d'autre. Personne ne s'offre à soi-même, et deux personnes ne
 * s'offrent jamais l'une à l'autre (pas de A→B avec B→A).
 * Lève une erreur si aucun tirage ne respecte ces règles.
 */
export function drawGifts(participantIds: readonly string[]): GiftAssignment[] {
  if (new Set(participantIds).size !== participantIds.length) throw new Error("Identifiants en double.");
  if (
    participantIds.length < GIFT_MIN_PARTICIPANTS
    || participantIds.length > GIFT_MAX_PARTICIPANTS
    || participantIds.length % 2 !== 0
  ) {
    throw new Error("Il faut un nombre pair de participants, entre 6 et 10.");
  }
  const n = participantIds.length;
  // receiverOf[i] = j : la personne i offre à la personne j. Chacun donne une
  // fois et reçoit une fois. Recherche avec retour arrière : n est petit (≤ 10).
  const receiverOf: number[] = new Array(n).fill(-1);
  const used: boolean[] = new Array(n).fill(false);

  const canGive = (i: number, j: number): boolean => {
    if (i === j || used[j]) return false;
    return receiverOf[j] !== i; // j offre déjà à i : paire réciproque
  };

  // L'ordre des donneurs est mélangé pour ne pas favoriser les premiers inscrits.
  const order = shuffle(Array.from({ length: n }, (_, k) => k));
  const solveInOrder = (step: number): boolean => {
    if (step === n) return true;
    const giver = order[step];
    for (const j of shuffle(Array.from({ length: n }, (_, k) => k))) {
      if (!canGive(giver, j)) continue;
      receiverOf[giver] = j;
      used[j] = true;
      if (solveInOrder(step + 1)) return true;
      used[j] = false;
      receiverOf[giver] = -1;
    }
    return false;
  };

  if (!solveInOrder(0)) throw new Error("Aucun tirage possible.");
  return participantIds.map((giverId, i) => ({ giverId, receiverId: participantIds[receiverOf[i]] }));
}

/** Vérifie qu'un tirage respecte les règles (utile pour les tests et le serveur). */
export function isValidDraw(
  participantIds: readonly string[],
  assignments: readonly GiftAssignment[],
): boolean {
  if (participantIds.length % 2 !== 0 || assignments.length !== participantIds.length) return false;
  const giveCount = new Map<string, number>();
  const receiveCount = new Map<string, number>();
  const receiverOf = new Map<string, string>();
  for (const { giverId, receiverId } of assignments) {
    if (giverId === receiverId) return false;
    giveCount.set(giverId, (giveCount.get(giverId) ?? 0) + 1);
    receiveCount.set(receiverId, (receiveCount.get(receiverId) ?? 0) + 1);
    receiverOf.set(giverId, receiverId);
  }
  for (const id of participantIds) {
    if (giveCount.get(id) !== 1 || receiveCount.get(id) !== 1) return false;
    // Pas de réciprocité : si A offre à B, B n'offre pas à A.
    if (receiverOf.get(receiverOf.get(id) ?? "") === id) return false;
  }
  return true;
}