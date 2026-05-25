/**
 * South African ID number validation & extraction.
 * Format: YYMMDD SSSS C A Z  (13 digits)
 *   YYMMDD = date of birth
 *   SSSS   = gender sequence (0000–4999 female, 5000–9999 male)
 *   C      = citizenship (0 = SA citizen, 1 = permanent resident)
 *   A      = usually 8
 *   Z      = Luhn check digit
 * Mirrors the FoxPro `IDNumber()` validation step.
 */
export interface SaIdInfo {
  valid: boolean;
  reason?: string;
  dateOfBirth?: string; // ISO YYYY-MM-DD
  age?: number;
  gender?: "Male" | "Female";
  citizenship?: "SA Citizen" | "Permanent Resident";
}

/** Luhn checksum used by SA ID numbers. */
function luhnValid(id: string): boolean {
  let sum = 0;
  let alternate = false;
  for (let i = id.length - 1; i >= 0; i--) {
    let n = parseInt(id.charAt(i), 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

export function validateSaId(raw: string | null | undefined): SaIdInfo {
  const id = (raw ?? "").replace(/\s/g, "");
  if (!/^\d{13}$/.test(id)) {
    return { valid: false, reason: "ID number must be exactly 13 digits." };
  }

  const yy = parseInt(id.slice(0, 2), 10);
  const mm = parseInt(id.slice(2, 4), 10);
  const dd = parseInt(id.slice(4, 6), 10);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) {
    return { valid: false, reason: "ID number contains an invalid date of birth." };
  }

  // Pivot the 2-digit year around the current year.
  const nowYY = new Date().getFullYear() % 100;
  const century = yy <= nowYY ? 2000 : 1900;
  const year = century + yy;
  const dob = new Date(Date.UTC(year, mm - 1, dd));
  if (dob.getUTCMonth() !== mm - 1 || dob.getUTCDate() !== dd) {
    return { valid: false, reason: "ID number contains an impossible date." };
  }

  if (!luhnValid(id)) {
    return { valid: false, reason: "ID number failed the checksum (Luhn) test." };
  }

  const genderSeq = parseInt(id.slice(6, 10), 10);
  const citizen = id.charAt(10);
  const isoDob = dob.toISOString().slice(0, 10);
  const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000));

  return {
    valid: true,
    dateOfBirth: isoDob,
    age,
    gender: genderSeq >= 5000 ? "Male" : "Female",
    citizenship: citizen === "0" ? "SA Citizen" : "Permanent Resident",
  };
}
