import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// Benchou Ferrari PIN
const BENCHOU_PIN = process.env.BENCHOU_PIN || "331991";

function validatePin(req: NextRequest): boolean {
  const pin = req.headers.get("x-benchou-pin");
  return !!pin && pin === BENCHOU_PIN;
}

// ===== POST /api/reviews/[id]/reject — admin only =====
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!validatePin(req)) {
      return NextResponse.json({ error: "Code PIN incorrect" }, { status: 401 });
    }

    const { id } = await params;

    // Optional adminNote (max 300 chars)
    let adminNote: string | null = null;
    try {
      const body = await req.json();
      if (body && typeof body === "object" && "adminNote" in body) {
        const note = (body as { adminNote?: unknown }).adminNote;
        if (typeof note === "string") {
          const trimmed = note.trim().slice(0, 300);
          adminNote = trimmed.length > 0 ? trimmed : null;
        }
      }
    } catch {
      // Body may be empty — that's fine
    }

    const db = getDb();
    const review = await db.review.findUnique({
      where: { id },
      select: { id: true, name: true, rating: true, comment: true, status: true, createdAt: true },
    });

    if (!review) {
      return NextResponse.json({ error: "Avis introuvable" }, { status: 404 });
    }

    const updated = await db.review.update({
      where: { id },
      data: {
        status: "rejected",
        adminNote,
        validatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        rating: true,
        comment: true,
        status: true,
        adminNote: true,
        createdAt: true,
        validatedAt: true,
      },
    });

    return NextResponse.json({ ok: true, review: updated });
  } catch (err) {
    console.error("[reviews/reject POST] error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
