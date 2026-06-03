/**
 * South African ID number validation & extraction.
 * Format: YYMMDD SSSS C A Z (13 digits) — Luhn check digit.
 * Shared by the FoxPro Product Capture endpoint and the auto-QA checker.
 */
export interface SaIdInfo {
  valid: boolean;
  reason?: string;
  dateOfBirth?: string; // ISO YYYY-MM-DD
  age?: number;
  gender?: "Male" | "Female";
  citizenship?: "SA Citizen" | "Permanent Resident";
}

function luhnValid(id: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = id.length - 1; i >= 0; i--) {
    let n = parseInt(id.charAt(i), 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function validateSaId(raw: string | null | undefined): SaIdInfo {
  const id = (raw ?? "").replace(/\s/g, "");
  if (!/^\d{13}$/.test(id)) return { valid: false, reason: "ID number must be exactly 13 digits." };

  const yy = parseInt(id.slice(0, 2), 10);
  const mm = parseInt(id.slice(2, 4), 10);
  const dd = parseInt(id.slice(4, 6), 10);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return { valid: false, reason: "ID number contains an invalid date of birth." };

  const nowYY = new Date().getFullYear() % 100;
  const year = (yy <= nowYY ? 2000 : 1900) + yy;
  const dob = new Date(Date.UTC(year, mm - 1, dd));
  if (dob.getUTCMonth() !== mm - 1 || dob.getUTCDate() !== dd) return { valid: false, reason: "ID number contains an impossible date." };

  if (!luhnValid(id)) return { valid: false, reason: "ID number failed the checksum (Luhn) test." };

  const genderSeq = parseInt(id.slice(6, 10), 10);
  return {
    valid: true,
    dateOfBirth: dob.toISOString().slice(0, 10),
    age: Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000)),
    gender: genderSeq >= 5000 ? "Male" : "Female",
    citizenship: id.charAt(10) === "0" ? "SA Citizen" : "Permanent Resident",
  };
}
