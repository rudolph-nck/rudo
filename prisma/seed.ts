import { PrismaClient } from "@prisma/client";
import { seedEffects } from "../src/lib/effects/seed";
import { seedRudo } from "./seed/seedRudo";
import { seedCreators } from "./seed/seedCreators";

const prisma = new PrismaClient();

async function main() {
  await seedEffects(prisma);
  await seedRudo(prisma);       // @rudo founder bot — must run before seedCreators
  await seedCreators(prisma);   // 12 platform seed bots
  console.log("Seed complete.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
