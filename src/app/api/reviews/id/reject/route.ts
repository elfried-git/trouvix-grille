import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const BENCHOU_PIN = process.env.BENCHOU_PIN || "331991";

function validatePin(req: NextRequest): boolean {
  const pin = req.headers.get("x-benchou-pin");
  return !!pin && pin === BENCHOU_PIN;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!validatePin(req)) {
      return NextResponse.json({ error: "Code PIN incorrect" }, { status: 401 });
    }

    const { id } = await params;
    let adminNote: string | undefined;
    try {
      const body = await req.json();
      if (typeof body?.adminNote === "string") {
        adminNote = body.adminNote.trim().slice(0, 300) || undefined;
      }
    } catch {}

    const review = await db.review.findUnique({
      where: { id },
      select: { id: true, name: true, rating: true, comment: true, status: true, createdAt: true },
    });

    if (!review) {
      return NextResponse.json({ error: "Avis introuvable" }, { status: 404 });
    }

    const updated = await db.review.update({
      where: { id },
      data: { status: "rejected", adminNote: adminNote || null, validatedAt: new Date() },
      select: { id: true, name: true, rating: true, comment: true, status: true, createdAt: true, validatedAt: true },
    });

    return NextResponse.json({ ok: true, review: updated });
  } catch (err) {
    console.error("[reviews/reject POST] error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}