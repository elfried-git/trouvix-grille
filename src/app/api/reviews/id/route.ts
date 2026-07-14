import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// DELETE /api/reviews/[id] — supprime un avis (réservé admin)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID manquant." }, { status: 400 });
    }

    // Vérifie que l'avis existe
    const existing = await db.review.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Avis introuvable." }, { status: 404 });
    }

    await db.review.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[reviews] DELETE error:", err);
    return NextResponse.json(
      { error: "Impossible de supprimer l'avis." },
      { status: 500 }
    );
  }
}