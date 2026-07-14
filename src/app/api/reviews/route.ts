import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Helper : extrait un message d'erreur lisible
function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

// GET /api/reviews — liste publique de tous les avis (auto-visibles, pas de modération)
export async function GET() {
  try {
    const reviews = await db.review.findMany({
      orderBy: { createdAt: "desc" },
      take: 200, // limite raisonnable
    });
    return NextResponse.json({ reviews });
  } catch (err) {
    console.error("[reviews] GET error:", err);
    return NextResponse.json(
      {
        error: "Impossible de charger les avis.",
        detail: errMsg(err),
      },
      { status: 500 }
    );
  }
}

// POST /api/reviews — crée un avis (auto-visible immédiatement)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
    }

    const authorName = (body.authorName ?? "").toString().trim().slice(0, 40);
    const ratingRaw = Number(body.rating);
    const comment = (body.comment ?? "").toString().trim().slice(0, 50);

    // Validation : rating entre 1 et 5, commentaire non vide
    if (!Number.isInteger(ratingRaw) || ratingRaw < 1 || ratingRaw > 5) {
      return NextResponse.json(
        { error: "La note doit être entre 1 et 5 étoiles." },
        { status: 400 }
      );
    }
    if (!comment) {
      return NextResponse.json(
        { error: "Le commentaire est obligatoire." },
        { status: 400 }
      );
    }

    const review = await db.review.create({
      data: {
        authorName: authorName || "Anonyme",
        rating: ratingRaw,
        comment,
      },
    });

    return NextResponse.json({ review }, { status: 201 });
  } catch (err) {
    console.error("[reviews] POST error:", err);
    return NextResponse.json(
      {
        error: "Impossible d'enregistrer l'avis.",
        detail: errMsg(err),
      },
      { status: 500 }
    );
  }
}