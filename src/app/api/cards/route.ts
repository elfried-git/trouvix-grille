import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/cards?category=histoire — returns a random card from the category
export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category");

  if (!category) {
    // Return counts per category
    const grouped = await db.card.groupBy({
      by: ["category"],
      _count: true,
    });
    return NextResponse.json({ counts: grouped });
  }

  const validCategories = ["histoire", "geographie", "sciences", "arts", "sport", "joker"];
  if (!validCategories.includes(category)) {
    return NextResponse.json(
      { error: "Catégorie invalide" },
      { status: 400 }
    );
  }

  // Count cards in category
  const total = await db.card.count({ where: { category } });
  if (total === 0) {
    return NextResponse.json(
      { error: "Aucune carte dans cette catégorie" },
      { status: 404 }
    );
  }

  // Pick a random skip
  const skip = Math.floor(Math.random() * total);
  const card = await db.card.findFirst({
    where: { category },
    skip,
  });

  return NextResponse.json({ card });
}
