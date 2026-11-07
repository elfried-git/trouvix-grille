import { NextRequest, NextResponse } from "next/server";
import {
  createLocalReview,
  deleteLocalReviews,
  getAdminPin,
  getProductionReviewsUrl,
  isAdminAuthorized,
  listLocalReviews,
} from "@/lib/review-storage";

export const runtime = "nodejs";

const isProduction = process.env.NODE_ENV === "production";

async function proxyToGameService(path: string, method: string, req: NextRequest, body?: unknown) {
  try {
    const isAuthorized = isAdminAuthorized(req);
    const pinHeader = isAuthorized ? getAdminPin() : req.headers.get("x-benchou-pin");
    const response = await fetch(getProductionReviewsUrl(path), {
      method,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(pinHeader ? { "x-benchou-pin": pinHeader } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch (error) {
    console.error("[reviews] game-service request failed:", error);
    return NextResponse.json({ error: "Service des avis temporairement indisponible." }, { status: 503 });
  }
}

export async function GET(req: NextRequest) {
  const all = new URL(req.url).searchParams.get("all") === "true";
  if (all && !isAdminAuthorized(req)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  }
  if (isProduction) {
    return proxyToGameService(`/reviews${all ? "?all=true" : ""}`, "GET", req);
  }
  try {
    return NextResponse.json({ reviews: await listLocalReviews(all) });
  } catch (error) {
    console.error("[reviews] local GET error:", error);
    return NextResponse.json({ error: "Impossible de charger les avis." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const rating = Number(body?.rating);
  const comment = typeof body?.comment === "string" ? body.comment.trim().slice(0, 500) : "";
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "La note doit être entre 1 et 5 étoiles." }, { status: 400 });
  }

  if (isProduction) return proxyToGameService("/reviews", "POST", req, { rating, comment });
  try {
    const review = await createLocalReview(rating, comment);
    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    console.error("[reviews] local POST error:", error);
    return NextResponse.json({ error: "Impossible d'enregistrer l'avis." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids)
    ? [...new Set<string>((body.ids as unknown[]).filter((id): id is string => typeof id === "string" && id.length > 0))]
    : [];
  if (ids.length === 0 || ids.length > 200) {
    return NextResponse.json({ error: "Sélection d’avis invalide." }, { status: 400 });
  }

  if (isProduction) return proxyToGameService("/reviews", "DELETE", req, { ids });
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  }
  try {
    const deletedCount = await deleteLocalReviews(ids);
    return NextResponse.json({ ok: true, deletedCount });
  } catch (error) {
    console.error("[reviews] local DELETE error:", error);
    return NextResponse.json({ error: "Impossible de supprimer les avis." }, { status: 500 });
  }
}
