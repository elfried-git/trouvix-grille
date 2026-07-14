import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Benchou Ferrari PIN
const BENCHOU_PIN = process.env.BENCHOU_PIN || "331991";

function validatePin(req: NextRequest): boolean {
  const pin = req.headers.get("x-benchou-pin");
  return !!pin && pin === BENCHOU_PIN;
}

// ===== DELETE /api/reviews/[id] — admin only =====
// Permanently deletes a review regardless of its status (pending, approved, or
// rejected). Used by the Benchou Ferrari dashboard to remove inappropriate
// reviews that may have already been published.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!validatePin(req)) {
      return NextResponse.json({ error: "Code PIN incorrect" }, { status: 401 });
    }

    const { id } = await params;

    const review = await db.review.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!review) {
      return NextResponse.json({ error: "Avis introuvable" }, { status: 404 });
    }

    await db.review.delete({ where: { id } });

    return NextResponse.json({ ok: true, deletedId: id });
  } catch (err) {
    console.error("[reviews DELETE] error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
