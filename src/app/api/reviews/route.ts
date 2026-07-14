import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// ===== Profanity filter (basic French + English) =====
const PROFANITY = [
  "putain", "merde", "connard", "connasse", "salope", "encule", "enculé",
  "ntm", "fdp", "pute", "bitch", "fuck", "shit", "asshole", "bastard",
  "dick", "pussy", "cunt", "crisse", "tabarnak",
];

function containsProfanity(text: string): boolean {
  const lower = text.toLowerCase();
  const normalized = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const word of PROFANITY) {
    const w = word.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const re = new RegExp(`(^|\\W)${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\W|$)`, "i");
    if (re.test(lower) || (w.length <= 4 && normalized.includes(w))) {
      return true;
    }
  }
  return false;
}

// ===== In-memory rate limiter =====
const rateLimitMap = new Map<string, { count: number; firstAt: number }>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 3;

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return (req as unknown as { ip?: string }).ip || "unknown";
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.firstAt > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, firstAt: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

// ===== POST /api/reviews — submit a new review =====
export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
    }
    const { name, rating, comment } = (body || {}) as {
      name?: unknown; rating?: unknown; comment?: unknown;
    };

    if (typeof name !== "string") {
      return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });
    }
    const trimmedName = name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 40) {
      return NextResponse.json({ error: "Le nom doit contenir entre 1 et 40 caractères" }, { status: 400 });
    }

    if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "La note doit être un entier entre 1 et 5" }, { status: 400 });
    }

    if (typeof comment !== "string") {
      return NextResponse.json({ error: "Le commentaire est requis" }, { status: 400 });
    }
    const trimmedComment = comment.trim();
    if (trimmedComment.length < 3 || trimmedComment.length > 500) {
      return NextResponse.json({ error: "Le commentaire doit contenir entre 3 et 500 caractères" }, { status: 400 });
    }

    if (containsProfanity(trimmedName) || containsProfanity(trimmedComment)) {
      return NextResponse.json({ error: "Votre avis contient des mots inappropriés. Merci de le reformuler." }, { status: 400 });
    }

    const ip = getClientIp(req);
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: "Trop d'avis envoyés. Réessayez dans quelques minutes." }, { status: 429 });
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await db.review.findMany({
      where: { createdAt: { gte: oneHourAgo } },
      select: { name: true, comment: true },
    });
    const lowerName = trimmedName.toLowerCase();
    const lowerComment = trimmedComment.toLowerCase();
    const existing = recent.find(
      (r) => r.name.toLowerCase() === lowerName && r.comment.toLowerCase() === lowerComment
    );
    if (existing) {
      return NextResponse.json({ error: "Vous avez déjà envoyé cet avis." }, { status: 400 });
    }

    const review = await db.review.create({
      data: { name: trimmedName, rating, comment: trimmedComment, status: "pending" },
      select: { id: true, status: true },
    });

    return NextResponse.json({ ok: true, id: review.id, status: review.status }, { status: 201 });
  } catch (err) {
    console.error("[reviews POST] error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

// ===== GET /api/reviews — list approved reviews with stats =====
export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const pageParam = url.searchParams.get("page");
    const limitParam = url.searchParams.get("limit");
    let page = Number.parseInt(pageParam || "1", 10);
    let limit = Number.parseInt(limitParam || "20", 10);
    if (!Number.isFinite(page) || page < 1) page = 1;
    if (!Number.isFinite(limit) || limit < 1) limit = 20;
    if (limit > 50) limit = 50;

    const [reviews, total, distributionRows] = await Promise.all([
      db.review.findMany({
        where: { status: "approved" },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, name: true, rating: true, comment: true, createdAt: true },
      }),
      db.review.count({ where: { status: "approved" } }),
      db.review.groupBy({
        by: ["rating"],
        _count: { _all: true },
        where: { status: "approved" },
      }),
    ]);

    const distribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sum = 0;
    for (const row of distributionRows) {
      distribution[row.rating] = row._count._all;
      sum += row.rating * row._count._all;
    }
    const average = total > 0 ? Math.round((sum / total) * 10) / 10 : 0;

    return NextResponse.json({ reviews, average, total, distribution, page, limit });
  } catch (err) {
    console.error("[reviews GET] error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}