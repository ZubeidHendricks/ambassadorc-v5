/**
 * SagePay Integration Service
 *
 * Handles payment processing through the SagePay gateway including:
 * - Merchant statement retrieval (polling pattern)
 * - Batch debit-order file uploads
 * - Webhook / callback processing
 * - Bank account validation via NIWS
 * - Bank list retrieval
 * - Transaction synchronisation
 *
 * Configuration is read from IntegrationConfig (name = "SAGEPAY").
 */

import prisma from "../lib/prisma.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface SagePayConfig {
  baseUrl: string;
  merchantId: string;
  merchantKey: string;
  serviceKey: string;
  testMode: boolean;
}

export interface DebitOrderRecord {
  policyId: number;
  clientId: number;
  accountHolder: string;
  bankName: string;
  branchCode: string;
  accountNumber: string;
  accountType: string;
  amount: number;
  reference: string;
}

export interface MerchantStatement {
  pollingId: string;
  transactions: {
    date: string;
    reference: string;
    amount: number;
    status: string;
    responseCode: string;
  }[];
}

export interface ValidationResult {
  valid: boolean;
  accountExists: boolean;
  accountOpen: boolean;
  accountType: string;
  responseCode: string;
  responseMessage: string;
}

export interface Bank {
  code: string;
  name: string;
  universalBranchCode: string;
}

// ── Service ────────────────────────────────────────────────────────────────

export class SagePayService {
  // ── Config ──

  async getConfig(): Promise<SagePayConfig> {
    const row = await prisma.integrationConfig.findUnique({
      where: { name: "SAGEPAY" },
    });

    if (!row || row.status !== "ACTIVE") {
      throw new Error("SagePay integration is not configured or inactive");
    }

    const creds = row.credentials as Record<string, any>;
    return {
      baseUrl: row.baseUrl,
      merchantId: creds.merchantId,
      merchantKey: creds.merchantKey,
      serviceKey: creds.serviceKey ?? "",
      testMode: (row.settings as any)?.testMode ?? true,
    };
  }

  // ── Merchant Statement Request ──

  async requestMerchantStatement(fromDate: Date, toDate: Date): Promise<string> {
    const cfg = await this.getConfig();

    const res = await fetch(`${cfg.baseUrl}/Merchant/Statement/Request`, {
      method: "POST",
      headers: this.buildHeaders(cfg),
      body: JSON.stringify({
        MerchantId: cfg.merchantId,
        FromDate: fromDate.toISOString().split("T")[0],
        ToDate: toDate.toISOString().split("T")[0],
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      await this.audit("SAGEPAY_STATEMENT_REQUEST_FAIL", data);
      throw new Error(`SagePay statement request failed: ${JSON.stringify(data)}`);
    }

    await this.audit("SAGEPAY_STATEMENT_REQUESTED", { pollingId: data.PollingId });
    return data.PollingId;
  }

  // ── Retrieve Statement ──

  async retrieveStatement(pollingId: string): Promise<MerchantStatement> {
    const cfg = await this.getConfig();

    const res = await fetch(`${cfg.baseUrl}/Merchant/Statement/Retrieve/${pollingId}`, {
      method: "GET",
      headers: this.buildHeaders(cfg),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(`SagePay statement retrieval failed: ${JSON.stringify(data)}`);
    }

    const transactions = (data.Transactions ?? []).map((t: any) => ({
      date: t.Date,
      reference: t.Reference,
      amount: parseFloat(t.Amount),
      status: t.Status,
      responseCode: t.ResponseCode,
    }));

    return { pollingId, transactions };
  }

  // ── Batch Debit Order Upload ──

  async uploadBatchFile(records: DebitOrderRecord[]): Promise<{ batchRef: string }> {
    const cfg = await this.getConfig();
    const batchRef = `SPBATCH-${Date.now()}`;

    const payload = {
      MerchantId: cfg.merchantId,
      BatchReference: batchRef,
      DebitOrders: records.map((r) => ({
        AccountHolder: r.accountHolder,
        BankName: r.bankName,
        BranchCode: r.branchCode,
        AccountNumber: r.accountNumber,
        AccountType: r.accountType,
        Amount: r.amount.toFixed(2),
        Reference: r.reference,
      })),
    };

    const res = await fetch(`${cfg.baseUrl}/Batch/Upload`, {
      method: "POST",
      headers: this.buildHeaders(cfg),
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      await this.audit("SAGEPAY_BATCH_UPLOAD_FAIL", { batchRef, error: data });
      throw new Error(`SagePay batch upload failed: ${JSON.stringify(data)}`);
    }

    // Record file export
    await prisma.fileExport.create({
      data: {
        fileName: `${batchRef}.json`,
        direction: "OUTBOUND",
        entryCount: records.length,
        description: `SagePay debit order batch`,
        importType: "SAGEPAY",
        status: "COMPLETED",
        processedAt: new Date(),
      },
    });

    await this.audit("SAGEPAY_BATCH_UPLOADED", { batchRef, recordCount: records.length });

    return { batchRef };
  }

  // ── Process Webhook Callback ──

  async processCallback(data: any): Promise<void> {
    const transactionRef = data.TransactionRef ?? data.Reference;
    const status = data.Status ?? data.ResultCode === "0" ? "SUCCESSFUL" : "FAILED";

    await prisma.sagePayTransaction.create({
      data: {
        transactionRef,
        policyId: data.PolicyId ? parseInt(data.PolicyId, 10) : null,
        clientId: data.ClientId ? parseInt(data.ClientId, 10) : null,
        amount: parseFloat(data.Amount ?? "0"),
        status,
        gateway: "SAGEPAY",
        responseCode: data.ResultCode ?? data.ResponseCode,
        responseMessage: data.ResultMessage ?? data.ResponseMessage,
        batchRef: data.BatchReference,
      },
    });

    await this.audit("SAGEPAY_CALLBACK_PROCESSED", {
      transactionRef,
      status,
      amount: data.Amount,
    });
  }

  // ── Bank Account Validation (NIWS) ──

  async validateBankAccount(
    accountNumber: string,
    branchCode: string,
    accountType: string
  ): Promise<ValidationResult> {
    const cfg = await this.getConfig();

    const res = await fetch(`${cfg.baseUrl}/NIWS/Validate`, {
      method: "POST",
      headers: this.buildHeaders(cfg),
      body: JSON.stringify({
        MerchantId: cfg.merchantId,
        AccountNumber: accountNumber,
        BranchCode: branchCode,
        AccountType: accountType,
      }),
    });

    const data = await res.json();

    await this.audit("SAGEPAY_BANK_VALIDATION", {
      accountNumber: `***${accountNumber.slice(-4)}`,
      responseCode: data.ResponseCode,
    });

    return {
      valid: data.ResponseCode === "0",
      accountExists: data.AccountExists === true,
      accountOpen: data.AccountOpen === true,
      accountType: data.AccountType ?? accountType,
      responseCode: data.ResponseCode ?? "",
      responseMessage: data.ResponseMessage ?? "",
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
      throw new Error(`SagePay getBankList failed: ${JSON.stringify(data)}`);
    }

    return (data.Banks ?? data ?? []).map((b: any) => ({
      code: b.Code ?? b.BankCode,
      name: b.Name ?? b.BankName,
      universalBranchCode: b.UniversalBranchCode ?? b.BranchCode ?? "",
    }));
  }

  // ── Sync Transactions ──

  async syncTransactions(): Promise<{ imported: number }> {
    const cfg = await this.getConfig();

    // Fetch last 7 days of transactions
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 7);

    const pollingId = await this.requestMerchantStatement(fromDate, toDate);

    // Wait briefly then retrieve (in production, use scheduled polling)
    await new Promise((r) => setTimeout(r, 3000));

    const statement = await this.retrieveStatement(pollingId);
    let imported = 0;

    for (const tx of statement.transactions) {
      const exists = await prisma.sagePayTransaction.findFirst({
        where: { transactionRef: tx.reference },
      });

      if (!exists) {
        await prisma.sagePayTransaction.create({
          data: {
            transactionRef: tx.reference,
            amount: tx.amount,
            status: tx.status,
            gateway: "SAGEPAY",
            responseCode: tx.responseCode,
          },
        });
        imported++;
      }
    }

    await prisma.integrationConfig.update({
      where: { name: "SAGEPAY" },
      data: { lastSyncAt: new Date() },
    });

    await this.audit("SAGEPAY_SYNC_COMPLETED", { imported, totalInStatement: statement.transactions.length });

    return { imported };
  }

  // ── Private Helpers ──

  private buildHeaders(cfg: SagePayConfig): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${cfg.merchantId}:${cfg.merchantKey}`).toString("base64")}`,
    };
  }

  private async audit(action: string, details: any): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action,
          entity: "Integration",
          entityId: "SAGEPAY",
          details,
        },
      });
    } catch {
      // Never throw from audit
    }
  }
}

export const sagePayService = new SagePayService();
