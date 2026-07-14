import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const BENCHOU_PIN = process.env.BENCHOU_PIN || "331991";

function validatePin(req: NextRequest): boolean {
  const pin = req.headers.get("x-benchou-pin");
  return !!pin && pin === BENCHOU_PIN;
}

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