import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// PATCH /api/reviews/[id] — met à jour un avis (réservé admin)
// Body: { visible?: boolean, adminLiked?: boolean }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID manquant." }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const data: { visible?: boolean; adminLiked?: boolean } = {};

    if (typeof body.visible === "boolean") {
      data.visible = body.visible;
    }
    if (typeof body.adminLiked === "boolean") {
      data.adminLiked = body.adminLiked;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Rien à mettre à jour." }, { status: 400 });
    }

    const existing = await db.review.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Avis introuvable." }, { status: 404 });
    }

    const updated = await db.review.update({
      where: { id },
      data,
    });

    return NextResponse.json({ review: updated });
  } catch (err) {
    console.error("[reviews] PATCH error:", err);
    return NextResponse.json(
      { error: "Impossible de mettre à jour l'avis." },
      { status: 500 }
    );
  }
}

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
