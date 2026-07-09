import { db } from "../src/lib/db";
import { CARDS } from "../src/lib/cards-data";

async function main() {
  console.log(`Seeding ${CARDS.length} cards...`);

  // Clean existing cards
  await db.card.deleteMany({});

  // Insert all cards
  for (const card of CARDS) {
    await db.card.create({
      data: {
        category: card.category,
        prompt: card.prompt,
        answer: card.answer ?? null,
        points: card.points,
      },
    });
  }

  const counts = await db.card.groupBy({
    by: ["category"],
    _count: true,
  });
  console.log("Seeded cards by category:", counts);
  console.log("Done!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
