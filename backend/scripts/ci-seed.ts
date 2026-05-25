/**
 * CI seed — minimal, self-contained data for the E2E suite.
 *
 * The normal seed (src/seed.ts) imports FoxPro CSV exports that aren't in the
 * repo, so it's a no-op in CI. This script upserts exactly what the Playwright
 * tests need against a fresh ephemeral Postgres:
 *   • admin user (matches auth.setup.ts: 0800000000 / Admin@2024)
 *   • a call-centre agent (with a daily lead quota)
 *   • a product (so Product Capture can submit)
 *   • a QA-approved sale (so "Run Midnight Export" has something to batch)
 *   • a few unassigned NEW leads (for the dialler / quota panel)
 *
 * Idempotent — safe to run repeatedly.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminHash = await bcrypt.hash("Admin@2024", 12);
  const admin = await prisma.ambassador.upsert({
    where: { mobileNo: "0800000000" },
    update: { role: "ADMIN", isActive: true, passwordHash: adminHash },
    create: {
      firstName: "Admin", lastName: "User", mobileNo: "0800000000",
      passwordHash: adminHash, province: "GAUTENG", department: "Operations",
      role: "ADMIN", acceptTerms: true, isActive: true,
    },
  });

  const agentHash = await bcrypt.hash("Agent@2024", 12);
  await prisma.ambassador.upsert({
    where: { mobileNo: "0810000001" },
    update: { role: "AGENT", isActive: true, dailyLeadQuota: 10 },
    create: {
      firstName: "Test", lastName: "Agent", mobileNo: "0810000001",
      passwordHash: agentHash, province: "WESTERN_CAPE", department: "Call Centre",
      role: "AGENT", acceptTerms: true, isActive: true, dailyLeadQuota: 10,
    },
  });

  const product = await prisma.product.upsert({
    where: { code: "LS24" },
    update: {},
    create: { name: "Life Saver 24", code: "LS24", type: "LIFE_COVER", premiumAmount: 259, isActive: true },
  });

  const client = await prisma.client.upsert({
    where: { idNumber: "9001015000088" },
    update: {},
    create: { firstName: "Seed", lastName: "Client", idNumber: "9001015000088", cellphone: "0820000000", province: "GAUTENG" },
  });

  const existingSale = await prisma.sale.findFirst({ where: { clientId: client.id, status: "QA_APPROVED" } });
  if (!existingSale) {
    await prisma.sale.create({
      data: { clientId: client.id, productId: product.id, agentId: admin.id, status: "QA_APPROVED", foxStatus: "QC", collectionMethod: "PERSAL", premiumAmount: 259 },
    });
  }

  const openLeads = await prisma.lead.count({ where: { assignedAgentId: null, status: "NEW" } });
  if (openLeads < 5) {
    await prisma.lead.createMany({
      data: Array.from({ length: 5 }, (_, i) => ({
        ambassadorId: admin.id, firstName: `Lead${i}`, lastName: "Test",
        contactNo: `08300000${i}${i}`, type: "REFERRAL_LEAD" as const, status: "NEW" as const,
      })),
    });
  }

  console.log("CI seed complete: admin, agent, product, QA-approved sale, leads.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
