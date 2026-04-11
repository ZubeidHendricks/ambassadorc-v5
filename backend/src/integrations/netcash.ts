/**
 * Netcash Integration Service
 *
 * Provides bank account verification, ID number validation, and bank/branch
 * lookups via the Netcash API.
 *
 * Configuration is read from IntegrationConfig (name = "NETCASH").
 */

import prisma from "../lib/prisma.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface NetcashConfig {
  baseUrl: string;
  serviceKey: string;
  accountNumber: string;
}

export interface ValidationResult {
  valid: boolean;
  accountExists: boolean;
  accountOpen: boolean;
  idMatch: boolean;
  responseCode: string;
  responseMessage: string;
}

export interface IdValidationResult {
  valid: boolean;
  dateOfBirth: string;
  gender: string;
  citizenship: string;
  responseCode: string;
}

export interface Bank {
  code: string;
  name: string;
  universalBranchCode: string;
}

export interface Branch {
  branchCode: string;
  branchName: string;
  bankName: string;
  suburb: string;
  city: string;
}

// ── Service ────────────────────────────────────────────────────────────────

export class NetcashService {
  // ── Config ──

  async getConfig(): Promise<NetcashConfig> {
    const row = await prisma.integrationConfig.findUnique({
      where: { name: "NETCASH" },
    });

    if (!row || row.status !== "ACTIVE") {
      throw new Error("Netcash integration is not configured or inactive");
    }

    const creds = row.credentials as Record<string, any>;
    return {
      baseUrl: row.baseUrl,
      serviceKey: creds.serviceKey,
      accountNumber: creds.accountNumber ?? "",
    };
  }

  // ── Bank Account Validation ──

  async validateBankAccount(
    accountNumber: string,
    branchCode: string,
    accountType: string
  ): Promise<ValidationResult> {
    const cfg = await this.getConfig();

    const res = await fetch(`${cfg.baseUrl}/BankAccountVerification/Validate`, {
      method: "POST",
      headers: this.buildHeaders(cfg),
      body: JSON.stringify({
        ServiceKey: cfg.serviceKey,
        AccountNumber: accountNumber,
        BranchCode: branchCode,
        AccountType: this.mapAccountType(accountType),
      }),
    });

    const data = await res.json();

    await this.audit("NETCASH_BANK_VALIDATION", {
      accountNumber: `***${accountNumber.slice(-4)}`,
      branchCode,
      responseCode: data.ResponseCode,
    });

    return {
      valid: data.ResponseCode === "0" || data.ResponseCode === "00",
      accountExists: data.AccountExists === true || data.AccountExists === "true",
      accountOpen: data.AccountOpen === true || data.AccountOpen === "true",
      idMatch: data.IdMatch === true || data.IdMatch === "true",
      responseCode: data.ResponseCode ?? "",
      responseMessage: data.ResponseMessage ?? data.Description ?? "",
    };
  }

  // ── ID Number Validation ──

  async validateIdNumber(idNumber: string): Promise<IdValidationResult> {
    const cfg = await this.getConfig();

    const res = await fetch(`${cfg.baseUrl}/IDVerification/Validate`, {
      method: "POST",
      headers: this.buildHeaders(cfg),
      body: JSON.stringify({
        ServiceKey: cfg.serviceKey,
        IdNumber: idNumber,
      }),
    });

    const data = await res.json();

    await this.audit("NETCASH_ID_VALIDATION", {
      idNumber: `***${idNumber.slice(-4)}`,
      responseCode: data.ResponseCode,
    });

    // Parse SA ID number for basic info
    const dobStr = idNumber.substring(0, 6);
    const genderDigit = parseInt(idNumber.charAt(6), 10);
    const citizenDigit = parseInt(idNumber.charAt(10), 10);

    return {
      valid: data.ResponseCode === "0" || data.ResponseCode === "00",
      dateOfBirth: data.DateOfBirth ?? `19${dobStr.substring(0, 2)}-${dobStr.substring(2, 4)}-${dobStr.substring(4, 6)}`,
      gender: genderDigit >= 5 ? "Male" : "Female",
      citizenship: citizenDigit === 0 ? "SA Citizen" : "Permanent Resident",
      responseCode: data.ResponseCode ?? "",
    };
  }

  // ── Bank List ──

  async getBankList(): Promise<Bank[]> {
    const cfg = await this.getConfig();

    const res = await fetch(`${cfg.baseUrl}/Banks/List`, {
      method: "GET",
      headers: this.buildHeaders(cfg),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(`Netcash getBankList failed: ${JSON.stringify(data)}`);
    }

    return (data.Banks ?? data ?? []).map((b: any) => ({
      code: b.BankCode ?? b.Code,
      name: b.BankName ?? b.Name,
      universalBranchCode: b.UniversalBranchCode ?? b.BranchCode ?? "",
    }));
  }

  // ── Branch List ──

  async getBranchList(bankName: string, suburb?: string): Promise<Branch[]> {
    const cfg = await this.getConfig();

    const params = new URLSearchParams({ BankName: bankName });
    if (suburb) params.append("Suburb", suburb);

    const res = await fetch(`${cfg.baseUrl}/Banks/Branches?${params.toString()}`, {
      method: "GET",
      headers: this.buildHeaders(cfg),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(`Netcash getBranchList failed: ${JSON.stringify(data)}`);
    }

    return (data.Branches ?? data ?? []).map((b: any) => ({
      branchCode: b.BranchCode,
      branchName: b.BranchName,
      bankName: b.BankName ?? bankName,
      suburb: b.Suburb ?? "",
      city: b.City ?? "",
    }));
  }

  // ── Private Helpers ──

  private buildHeaders(cfg: NetcashConfig): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "X-Service-Key": cfg.serviceKey,
    };
  }

  private mapAccountType(type: string): string {
    const mapping: Record<string, string> = {
      SAVINGS: "1",
      CURRENT: "2",
      CHEQUE: "2",
      TRANSMISSION: "3",
    };
    return mapping[type.toUpperCase()] ?? "1";
  }

  private async audit(action: string, details: any): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action,
          entity: "Integration",
          entityId: "NETCASH",
          details,
        },
      });
    } catch {
      // Never throw from audit
    }
  }
}

export const netcashService = new NetcashService();
