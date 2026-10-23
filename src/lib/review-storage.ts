import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

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

export function isValidAdminPin(pin: string | null): boolean {
  return Boolean(pin && pin === BENCHOU_PIN);
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
