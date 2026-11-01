import { prisma } from "../backend/dist/core/config/db.js";

async function main() {
  console.log("Adding resolutionNotes to incidents table...");
  await prisma.$executeRawUnsafe(`ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "resolutionNotes" TEXT;`);
  console.log("Column added successfully!");
  const cols = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'incidents' AND column_name = 'resolutionNotes';
  `);
  console.log("Verified column in DB:", cols);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
