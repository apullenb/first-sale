import { loadEnvConfig } from "@next/env";
import { DEMO_BUSINESSES } from "@/data/personas";
import { getDb } from "./client";
import { businesses, products } from "./schema";

loadEnvConfig(process.cwd());

// Loads the three demo businesses. Safe to run more than once.
async function seed() {
  const db = getDb();

  for (const business of DEMO_BUSINESSES) {
    await db
      .insert(businesses)
      .values({ id: business.id, isDemo: true, profile: business.profile })
      .onConflictDoNothing();

    await db
      .insert(products)
      .values(business.products.map((product) => ({ ...product, id: `${business.id}-${product.id}`, businessId: business.id })))
      .onConflictDoNothing();
  }

  console.log(`Seeded ${DEMO_BUSINESSES.length} demo businesses.`);
}

seed()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
