import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

const BENCHOU_PIN = process.env.BENCHOU_PIN || "331991";

function validatePin(req: NextRequest): boolean {
  const pin = req.headers.get("x-benchou-pin");
  return !!pin && pin === BENCHOU_PIN;
}

// Helper : extrait un message d'erreur lisible
function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

// GET /api/reviews — liste publique des avis visibles uniquement
// Les avis masqués par l'admin (visible=false) ne sont pas retournés ici.
// Un paramètre ?all=true permet à l'admin de tout récupérer (pour le board admin).
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const all = searchParams.get("all") === "true";

    // Si l'admin demande tous les avis (y compris masqués), vérifier le PIN
    if (all && !validatePin(req)) {
      return NextResponse.json({ error: "Code PIN incorrect" }, { status: 401 });
    }

    const db = getDb();
    const reviews = await db.review.findMany({
      where: all ? undefined : { visible: true },
      orderBy: [{ adminLiked: "desc" }, { createdAt: "desc" }],
      take: 200,
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
    const comment = (body.comment ?? "").toString().trim().slice(0, 500);

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

    const db = getDb();
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