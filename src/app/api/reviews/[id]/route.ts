import { NextRequest, NextResponse } from "next/server";
import { getProductionReviewsUrl, isValidAdminPin, updateLocalReview, deleteLocalReviews } from "@/lib/review-storage";

export const runtime = "nodejs";

const isProduction = process.env.NODE_ENV === "production";

async function proxyToGameService(path: string, method: string, req: NextRequest, body?: unknown) {
  try {
    const response = await fetch(getProductionReviewsUrl(path), {
      method,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(req.headers.get("x-benchou-pin") ? { "x-benchou-pin": req.headers.get("x-benchou-pin")! } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch (error) {
    console.error("[reviews] game-service request failed:", error);
    return NextResponse.json({ error: "Service des avis temporairement indisponible." }, { status: 503 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const changes: { visible?: boolean; adminLiked?: boolean } = {};
  if (typeof body.visible === "boolean") changes.visible = body.visible;
  if (typeof body.adminLiked === "boolean") changes.adminLiked = body.adminLiked;
  if (Object.keys(changes).length === 0) {
    return NextResponse.json({ error: "Rien à mettre à jour." }, { status: 400 });
  }

  if (isProduction) return proxyToGameService(`/reviews/${encodeURIComponent(id)}`, "PATCH", req, changes);
  if (!isValidAdminPin(req.headers.get("x-benchou-pin"))) {
    return NextResponse.json({ error: "Code PIN incorrect" }, { status: 401 });
  }
  try {
    const review = await updateLocalReview(id, changes);
    return review
      ? NextResponse.json({ review })
      : NextResponse.json({ error: "Avis introuvable." }, { status: 404 });
  } catch (error) {
    console.error("[reviews] local PATCH error:", error);
    return NextResponse.json({ error: "Impossible de mettre à jour l'avis." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (isProduction) return proxyToGameService(`/reviews/${encodeURIComponent(id)}`, "DELETE", req);
  if (!isValidAdminPin(req.headers.get("x-benchou-pin"))) {
    return NextResponse.json({ error: "Code PIN incorrect" }, { status: 401 });
  }
  try {
    const deletedCount = await deleteLocalReviews([id]);
    return deletedCount
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: "Avis introuvable." }, { status: 404 });
  } catch (error) {
    console.error("[reviews] local DELETE error:", error);
    return NextResponse.json({ error: "Impossible de supprimer l'avis." }, { status: 500 });
  }
}
