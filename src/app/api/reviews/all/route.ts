import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const BENCHOU_PIN = process.env.BENCHOU_PIN || "331991";

function validatePin(req: NextRequest): boolean {
  const pin = req.headers.get("x-benchou-pin");
  return !!pin && pin === BENCHOU_PIN;
}

export async function GET(req: NextRequest) {
  try {
    if (!validatePin(req)) {
      return NextResponse.json({ error: "Code PIN incorrect" }, { status: 401 });
    }

    const reviews = await db.review.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      select: {
        id: true, name: true, rating: true, comment: true,
        status: true, createdAt: true, validatedAt: true,
      },
    });

    return NextResponse.json({ reviews });
  } catch (err) {
    console.error("[reviews/all GET] error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}