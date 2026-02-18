import { PrismaClient } from "@prisma/client";
import { seedEffects } from "../src/lib/effects/seed";

const prisma = new PrismaClient();

async function main() {
  await seedEffects(prisma);
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
