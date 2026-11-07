import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { NextRequest } from "next/server";

export interface StoredReview {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
  visible: boolean;
  adminLiked: boolean;
}

const localFile = path.join(process.cwd(), ".data", "reviews.json");
const BENCHOU_PIN = process.env.BENCHOU_PIN || "331991";

export function getAdminPin(): string {
  return BENCHOU_PIN;
}

export function hashPin(pin: string): string {
  return crypto.createHash("sha256").update(pin.trim()).digest("hex");
}

export function isValidAdminPin(pin: string | null): boolean {
  return Boolean(pin && pin.trim() === BENCHOU_PIN);
}

export function isValidAdminPinOrHash(pinOrHash: string | null): boolean {
  if (!pinOrHash) return false;
  const clean = pinOrHash.trim();
  if (clean === BENCHOU_PIN) return true;
  const expectedHash = hashPin(BENCHOU_PIN);
  return clean.toLowerCase() === expectedHash.toLowerCase();
}

// Secret for HMAC signing of ephemeral session tokens
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || crypto.createHash("sha256").update(`${BENCHOU_PIN}-trouvix-admin-salt`).digest("hex");

export function createAdminSessionToken(): string {
  const timestamp = Date.now();
  const payload = `benchou:${timestamp}`;
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  return `${Buffer.from(payload).toString("base64url")}.${signature}`;
}

export function verifyAdminSessionToken(token: string | null | undefined): boolean {
  if (!token) return false;
  try {
    const [b64Payload, signature] = token.split(".");
    if (!b64Payload || !signature) return false;
    const payload = Buffer.from(b64Payload, "base64url").toString("utf8");
    const [prefix, timeStr] = payload.split(":");
    if (prefix !== "benchou" || !timeStr) return false;
    const timestamp = parseInt(timeStr, 10);
    if (Number.isNaN(timestamp)) return false;
    // Expire token after 24 hours
    if (Date.now() - timestamp > 24 * 60 * 60 * 1000) return false;
    const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expectedSig, "hex"));
  } catch {
    return false;
  }
}

export function isAdminAuthorized(req: NextRequest): boolean {
  // 1. HttpOnly session cookie
  const sessionCookie = req.cookies.get("benchou_session")?.value;
  if (sessionCookie && verifyAdminSessionToken(sessionCookie)) return true;

  // 2. Authorization Bearer header
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const bearer = authHeader.slice(7).trim();
    if (verifyAdminSessionToken(bearer)) return true;
  }

  // 3. Fallback to x-benchou-pin or hash
  const pinHeader = req.headers.get("x-benchou-pin");
  if (pinHeader && isValidAdminPinOrHash(pinHeader)) return true;

  return false;
}

export function getProductionReviewsUrl(pathname: string): string {
  const base = (process.env.NEXT_PUBLIC_GAME_SERVICE_URL || "https://trouvix-game-service.trouvix-grille.workers.dev").replace(/\/+$/, "");
  return `${base}${pathname}`;
}

export async function readLocalReviews(): Promise<StoredReview[]> {
  try {
    const contents = await readFile(localFile, "utf8");
    const parsed: unknown = JSON.parse(contents);
    return Array.isArray(parsed) ? parsed as StoredReview[] : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeLocalReviews(reviews: StoredReview[]): Promise<void> {
  await mkdir(path.dirname(localFile), { recursive: true });
  await writeFile(localFile, JSON.stringify(reviews, null, 2), "utf8");
}

export async function listLocalReviews(all: boolean): Promise<StoredReview[]> {
  const reviews = await readLocalReviews();
  return sortReviews(reviews.filter((review) => all || review.visible));
}

export async function createLocalReview(rating: number, comment: string): Promise<StoredReview> {
  const reviews = await readLocalReviews();
  const review: StoredReview = {
    id: crypto.randomUUID(),
    authorName: "Anonyme",
    rating,
    comment,
    createdAt: new Date().toISOString(),
    visible: true,
    adminLiked: false,
  };
  reviews.push(review);
  await writeLocalReviews(reviews);
  return review;
}

export async function updateLocalReview(id: string, changes: { visible?: boolean; adminLiked?: boolean }): Promise<StoredReview | null> {
  const reviews = await readLocalReviews();
  const review = reviews.find((item) => item.id === id);
  if (!review) return null;
  Object.assign(review, changes);
  await writeLocalReviews(reviews);
  return review;
}

export async function deleteLocalReviews(ids: string[]): Promise<number> {
  const reviews = await readLocalReviews();
  const selected = new Set(ids);
  const remaining = reviews.filter((review) => !selected.has(review.id));
  const deleted = reviews.length - remaining.length;
  await writeLocalReviews(remaining);
  return deleted;
}

export function sortReviews<T extends Pick<StoredReview, "adminLiked" | "createdAt">>(reviews: T[]): T[] {
  return reviews.sort((a, b) => Number(b.adminLiked) - Number(a.adminLiked) || b.createdAt.localeCompare(a.createdAt)).slice(0, 200);
}
