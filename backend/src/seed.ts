import { PrismaClient, Province } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const CSV_DIR = path.resolve(__dirname, "../../../AMBASSADORC_DB_Export");

function parseCSV(filename: string): Record<string, string>[] {
  const filepath = path.join(CSV_DIR, filename);
  if (!fs.existsSync(filepath)) {
    console.warn(`  CSV not found: ${filename}`);
    return [];
  }
  const content = fs.readFileSync(filepath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] || "";
    });
    return row;
  });
}

function mapProvince(raw: string): Province {
  const map: Record<string, Province> = {
    "eastern cape": Province.EASTERN_CAPE,
    "free state": Province.FREE_STATE,
    gauteng: Province.GAUTENG,
    "kwazulu-natal": Province.KWAZULU_NATAL,
    "kwazulu natal": Province.KWAZULU_NATAL,
    limpopo: Province.LIMPOPO,
    mpumalanga: Province.MPUMALANGA,
    "north west": Province.NORTH_WEST,
    "northern cape": Province.NORTHERN_CAPE,
    "western cape": Province.WESTERN_CAPE,
  };
  return map[raw.toLowerCase().trim()] || Province.GAUTENG;
}

async function main() {
  console.log("Seeding database from CSV exports...\n");

  // 1. Seed ambassadors from am_reg
  console.log("Importing ambassadors from am_reg.csv...");
  const regRows = parseCSV("am_reg.csv");
  const defaultHash = await bcrypt.hash("Welcome123", 12);

  let ambCount = 0;
  for (const row of regRows) {
    const mobile = (row.MobileNo || "").trim();
    if (!mobile || !/^0\d{9}$/.test(mobile)) continue;

    try {
      await prisma.ambassador.upsert({
        where: { mobileNo: mobile },
        update: {},
        create: {
          firstName: row.FirstName || "Unknown",
          lastName: row.LastName || "Unknown",
          mobileNo: mobile,
          passwordHash: defaultHash,
          province: mapProvince(row.Province || ""),
          department: row.Department || "",
          acceptTerms: true,
          isActive: true,
          createdAt: row.DateCreated ? new Date(row.DateCreated) : new Date(),
        },
      });
      ambCount++;
    } catch (e) {
      // skip duplicates
    }
  }
  console.log(`  Imported ${ambCount} ambassadors\n`);

  // 2. Enrich with ambassador profile data
  console.log("Enriching from am_ambassador.csv...");
  const ambRows = parseCSV("am_ambassador.csv");
  let enriched = 0;
  for (const row of ambRows) {
    const mobile = (row.MobileNo || "").trim();
    if (!mobile) continue;
    try {
      await prisma.ambassador.update({
        where: { mobileNo: mobile },
        data: {
          email: row.EmailAdd || undefined,
          shopSteward: row.ShopSteward || undefined,
          union: row.Union || undefined,
          town: row.Town || undefined,
          location: row.Location || undefined,
        },
      });
      enriched++;
    } catch {
      // ambassador not found
    }
  }
  console.log(`  Enriched ${enriched} ambassador profiles\n`);

  // 3. Import referral batches
  console.log("Importing referral batches from am_refbatch.csv...");
  const batchRows = parseCSV("am_refbatch.csv");
  let batchCount = 0;

  // Build ambassador ID map (old amregID → new DB ambassador)
  const allAmbassadors = await prisma.ambassador.findMany();
  // We map by looking up the original am_reg rows to match IDs
  const regIdToMobile: Record<string, string> = {};
  regRows.forEach((r, i) => {
    const id = r.id || r.ID || r.Id || String(i + 1);
    regIdToMobile[id] = (r.MobileNo || "").trim();
  });
  const mobileToAmbId: Record<string, number> = {};
  allAmbassadors.forEach((a) => {
    mobileToAmbId[a.mobileNo] = a.id;
  });

  for (const row of batchRows) {
    const oldRegId = row.amregID || row.AmregID || "";
    const mobile = regIdToMobile[oldRegId];
    const ambassadorId = mobile ? mobileToAmbId[mobile] : undefined;
    if (!ambassadorId) continue;

    try {
      const batch = await prisma.referralBatch.create({
        data: {
          ambassadorId,
          batchName: row.BatchName || `Batch-${batchCount + 1}`,
          createdAt: row.DateCreated ? new Date(row.DateCreated) : new Date(),
        },
      });

      // Create individual referrals from RefName1-10, RefContactNo1-10
      const referrals = [];
      for (let i = 1; i <= 10; i++) {
        const name = row[`RefName${i}`] || "";
        const contact = row[`RefContactNo${i}`] || "";
        if (name.trim() && contact.trim()) {
          referrals.push({
            batchId: batch.id,
            ambassadorId,
            refName: name.trim(),
            refContactNo: contact.trim(),
          });
        }
      }
      if (referrals.length > 0) {
        await prisma.referral.createMany({ data: referrals });
      }
      batchCount++;
    } catch {
      // skip errors
    }
  }
  console.log(`  Imported ${batchCount} referral batches\n`);

  // 4. Import leads
  console.log("Importing leads from am_amleads.csv...");
  const leadRows = parseCSV("am_amleads.csv");
  let leadCount = 0;
  for (const row of leadRows) {
    const oldRegId = row.amregID || row.AmregID || "";
    const mobile = regIdToMobile[oldRegId];
    const ambassadorId = mobile ? mobileToAmbId[mobile] : undefined;
    if (!ambassadorId) continue;

    try {
      await prisma.lead.create({
        data: {
          ambassadorId,
          firstName: row.NameFirst || row.FirstName || "Unknown",
          lastName: row.NameLast || row.LastName || "Unknown",
          contactNo: (row.Number || row.ContactNo || "").trim(),
          preferredContact: row.Preferred || "Call",
          datePaid: row.DatePaid ? new Date(row.DatePaid) : null,
          createdAt: row.DateCreated ? new Date(row.DateCreated) : new Date(),
        },
      });
      leadCount++;
    } catch {
      // skip
    }
  }
  console.log(`  Imported ${leadCount} leads\n`);

  console.log("Seed complete!");
  console.log(`  Ambassadors: ${ambCount}`);
  console.log(`  Referral Batches: ${batchCount}`);
  console.log(`  Leads: ${leadCount}`);
  console.log(`\nDefault password for all imported ambassadors: Welcome123`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
