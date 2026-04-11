import prisma from "../lib/prisma";
import type { AgentResult } from "./index";

// ─── South African ID Validation ────────────────────────────────────────────

/**
 * Validates a South African ID number (13 digits).
 * Format: YYMMDD SSSS C A Z
 *   - YYMMDD: Date of birth
 *   - SSSS: Gender (0000-4999 female, 5000-9999 male)
 *   - C: Citizenship (0 = SA citizen, 1 = permanent resident)
 *   - A: Usually 8 (was used for racial classification, now unused)
 *   - Z: Checksum digit (Luhn algorithm)
 */
function validateSAIdNumber(idNumber: string): { valid: boolean; reason?: string } {
  // Must be exactly 13 digits
  if (!/^\d{13}$/.test(idNumber)) {
    return { valid: false, reason: "ID must be exactly 13 digits" };
  }

  // Extract date components
  const year = parseInt(idNumber.substring(0, 2), 10);
  const month = parseInt(idNumber.substring(2, 4), 10);
  const day = parseInt(idNumber.substring(4, 6), 10);

  // Validate month
  if (month < 1 || month > 12) {
    return { valid: false, reason: `Invalid month in ID: ${month}` };
  }

  // Validate day (basic check)
  if (day < 1 || day > 31) {
    return { valid: false, reason: `Invalid day in ID: ${day}` };
  }

  // More specific day validation per month
  const fullYear = year >= 0 && year <= 30 ? 2000 + year : 1900 + year;
  const daysInMonth = new Date(fullYear, month, 0).getDate();
  if (day > daysInMonth) {
    return {
      valid: false,
      reason: `Day ${day} is invalid for month ${month} (max ${daysInMonth})`,
    };
  }

  // Citizenship digit must be 0 or 1
  const citizenship = parseInt(idNumber.charAt(10), 10);
  if (citizenship !== 0 && citizenship !== 1) {
    return { valid: false, reason: `Invalid citizenship digit: ${citizenship}` };
  }

  // Luhn checksum validation
  let total = 0;
  let isSecond = false;

  for (let i = idNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(idNumber.charAt(i), 10);

    if (isSecond) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    total += digit;
    isSecond = !isSecond;
  }

  if (total % 10 !== 0) {
    return { valid: false, reason: "Luhn checksum failed" };
  }

  return { valid: true };
}

// ─── Required Field Checks ──────────────────────────────────────────────────

interface FieldIssue {
  field: string;
  issue: string;
}

function checkRequiredFields(client: {
  firstName: string;
  lastName: string;
  idNumber: string;
  cellphone: string;
  email: string | null;
  address1: string | null;
  province: string | null;
}): FieldIssue[] {
  const issues: FieldIssue[] = [];

  if (!client.firstName || client.firstName.trim().length < 2) {
    issues.push({ field: "firstName", issue: "Missing or too short (min 2 chars)" });
  }

  if (!client.lastName || client.lastName.trim().length < 2) {
    issues.push({ field: "lastName", issue: "Missing or too short (min 2 chars)" });
  }

  if (!client.idNumber || client.idNumber.trim().length === 0) {
    issues.push({ field: "idNumber", issue: "Missing ID number" });
  }

  if (!client.cellphone || client.cellphone.trim().length < 10) {
    issues.push({ field: "cellphone", issue: "Missing or invalid cellphone number" });
  }

  if (!client.address1 || client.address1.trim().length === 0) {
    issues.push({ field: "address1", issue: "Missing primary address" });
  }

  if (!client.province) {
    issues.push({ field: "province", issue: "Missing province" });
  }

  return issues;
}

// ─── QA Auto Checker Agent ──────────────────────────────────────────────────

export async function runQaAutoChecker(): Promise<AgentResult> {
  const actions: string[] = [];
  const errors: string[] = [];
  let processed = 0;

  try {
    // Find sales that are NEW and have no quality checks yet
    const uncheckedSales = await prisma.sale.findMany({
      where: {
        status: "NEW",
        qualityChecks: {
          none: {},
        },
      },
      include: {
        client: true,
        product: true,
      },
    });

    // We need a system checker account. Find or identify the first QA_OFFICER or ADMIN.
    const systemChecker = await prisma.ambassador.findFirst({
      where: {
        role: { in: ["QA_OFFICER", "ADMIN"] },
        isActive: true,
      },
      select: { id: true },
    });

    if (!systemChecker) {
      return {
        agentName: "qa-auto-checker",
        success: false,
        processed: 0,
        actions: [],
        errors: [
          "No QA_OFFICER or ADMIN account found. Cannot create QualityCheck records without a checker.",
        ],
        duration: 0,
      };
    }

    for (const sale of uncheckedSales) {
      try {
        const issues: string[] = [];

        // 1. Validate SA ID number
        const idValidation = validateSAIdNumber(sale.client.idNumber);
        if (!idValidation.valid) {
          issues.push(`ID Validation: ${idValidation.reason}`);
        }

        // 2. Check for duplicate clients (same idNumber or cellphone, different client ID)
        const duplicateByIdNumber = await prisma.client.findMany({
          where: {
            idNumber: sale.client.idNumber,
            id: { not: sale.client.id },
          },
          select: { id: true, firstName: true, lastName: true },
        });

        if (duplicateByIdNumber.length > 0) {
          const dupIds = duplicateByIdNumber.map((d) => `#${d.id}`).join(", ");
          issues.push(`Duplicate ID number found on client(s): ${dupIds}`);
        }

        const duplicateByCellphone = await prisma.client.findMany({
          where: {
            cellphone: sale.client.cellphone,
            id: { not: sale.client.id },
          },
          select: { id: true, firstName: true, lastName: true },
        });

        if (duplicateByCellphone.length > 0) {
          const dupIds = duplicateByCellphone.map((d) => `#${d.id}`).join(", ");
          issues.push(`Duplicate cellphone found on client(s): ${dupIds}`);
        }

        // 3. Missing required fields
        const fieldIssues = checkRequiredFields(sale.client);
        for (const fi of fieldIssues) {
          issues.push(`Missing field [${fi.field}]: ${fi.issue}`);
        }

        // 4. Premium amount matches product tier
        // Check if there is a policy for this client+product with a premium that
        // matches one of the product's premium tiers.
        const policy = await prisma.policy.findFirst({
          where: {
            clientId: sale.clientId,
            productId: sale.productId,
          },
          select: { premiumAmount: true },
        });

        if (policy) {
          const validTiers = await prisma.premiumTier.findMany({
            where: {
              productId: sale.productId,
              isActive: true,
            },
            select: { amount: true, tierName: true },
          });

          if (validTiers.length > 0) {
            const premiumNum = Number(policy.premiumAmount);
            const tierMatch = validTiers.some(
              (t) => Math.abs(Number(t.amount) - premiumNum) < 0.01
            );

            if (!tierMatch) {
              const validAmounts = validTiers
                .map((t) => `${t.tierName}: R${t.amount}`)
                .join(", ");
              issues.push(
                `Premium R${policy.premiumAmount} does not match any active tier [${validAmounts}]`
              );
            }
          }
        }

        // Determine auto-check status
        const autoStatus = issues.length === 0 ? "PASSED" : "FAILED";
        const notes =
          issues.length === 0
            ? "Auto QA: All checks passed."
            : `Auto QA: ${issues.length} issue(s) found.\n${issues.map((i, idx) => `${idx + 1}. ${i}`).join("\n")}`;

        // Create QualityCheck record
        await prisma.qualityCheck.create({
          data: {
            saleId: sale.id,
            checkerId: systemChecker.id,
            status: autoStatus,
            notes,
            checkedAt: new Date(),
          },
        });

        // If auto-passed, move the sale to QA_APPROVED; if failed, move to QA_REJECTED
        const newSaleStatus = autoStatus === "PASSED" ? "QA_APPROVED" : "QA_PENDING";
        await prisma.sale.update({
          where: { id: sale.id },
          data: { status: newSaleStatus },
        });

        processed++;
        actions.push(
          `Sale #${sale.id} — ${autoStatus} (${issues.length} issues) -> ${newSaleStatus}`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Failed to check Sale #${sale.id}: ${msg}`);
      }
    }

    return {
      agentName: "qa-auto-checker",
      success: errors.length === 0,
      processed,
      actions,
      errors,
      duration: 0,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      agentName: "qa-auto-checker",
      success: false,
      processed,
      actions,
      errors: [...errors, msg],
      duration: 0,
    };
  }
}
