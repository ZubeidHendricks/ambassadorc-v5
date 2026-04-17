/**
 * Maps FoxPro SQL Server tables to PostgreSQL sync_* staging tables.
 * Each entry defines:
 *  - sourceTable: SQL Server table name
 *  - destTable:   PostgreSQL staging table name (created automatically)
 *  - pkColumn:    Primary key column used for upsert / change detection
 *  - orderBy:     Column used to detect new/modified rows on incremental sync
 *  - label:       Human-readable label for the UI
 */
export interface TableMapping {
  sourceTable: string;
  destTable: string;
  pkColumn: string;
  orderBy?: string;
  label: string;
  category: "ambassador" | "sales" | "payments" | "policies" | "operations";
  /** Override default 50-row batch (use smaller for wide/slow tables) */
  batchSize?: number;
  /**
   * Skip COUNT(*) pre-query (expensive on unindexed tables) and skip
   * ORDER BY on the SELECT so SQL Server returns rows in heap order
   * (fastest path). On first run the dest table is fully loaded.
   * On subsequent runs, if dateColumn is set, only rows updated within
   * the last incrementalDays days are fetched (bandwidth saving mode).
   */
  streamDump?: boolean;
  /**
   * SQL Server column to use for incremental window filter on streamDump tables.
   * e.g. "LastUpdated" or "Date". Once the initial full-load checkpoint exists,
   * only rows WHERE [dateColumn] >= DATEADD(day, -incrementalDays, GETDATE())
   * are fetched, avoiding a full table scan every day.
   */
  dateColumn?: string;
  /**
   * How many days back the incremental window looks. Defaults to 3 (so we
   * always overlap by 2 days to catch any late-arriving updates).
   */
  incrementalDays?: number;
}

export const TABLE_MAPPINGS: TableMapping[] = [
  // ─── Ambassador / Lead tables ─────────────────────────────────────────────
  {
    sourceTable: "am_reg",
    destTable: "sync_am_reg",
    pkColumn: "id",
    orderBy: "DateCreated",
    label: "Ambassador Registrations",
    category: "ambassador",
  },
  {
    sourceTable: "am_amleads",
    destTable: "sync_am_amleads",
    pkColumn: "id",
    orderBy: "DateCreated",
    label: "Ambassador Leads",
    category: "ambassador",
  },
  {
    sourceTable: "am_amleadsbatch",
    destTable: "sync_am_amleadsbatch",
    pkColumn: "id",
    label: "Ambassador Lead Batches",
    category: "ambassador",
  },
  {
    sourceTable: "am_leadsreceived",
    destTable: "sync_am_leadsreceived",
    pkColumn: "id",
    label: "Leads Received",
    category: "ambassador",
  },
  {
    sourceTable: "AmbassadorAgents",
    destTable: "sync_ambassador_agents",
    pkColumn: "id",
    orderBy: "DateAssigned",
    label: "Ambassador Agents",
    category: "ambassador",
  },
  {
    sourceTable: "AmbassadorSMSDelivery",
    destTable: "sync_ambassador_sms_delivery",
    pkColumn: "id",
    label: "Ambassador SMS Delivery",
    category: "ambassador",
  },

  // ─── Sales tables ─────────────────────────────────────────────────────────
  {
    sourceTable: "SalesData",
    destTable: "sync_sales_data",
    pkColumn: "id",
    label: "Sales Data (clients)",
    category: "sales",
    streamDump: true,   // 60-col wide table, no index on id — heap-order stream
    dateColumn: "LastUpdated", // incremental filter after initial full load
    incrementalDays: 3,
  },
  {
    sourceTable: "SalesLeads",
    destTable: "sync_sales_leads",
    pkColumn: "id",
    label: "Sales Leads",
    category: "sales",
    streamDump: true,   // wide table, no index on id — heap-order stream
    dateColumn: "LastUpdated", // incremental filter after initial full load
    incrementalDays: 3,
  },
  {
    sourceTable: "SalesHistory",
    destTable: "sync_sales_history",
    pkColumn: "id",
    orderBy: "Date",
    label: "Sales History / Audit",
    category: "sales",
  },
  {
    sourceTable: "SalesTransactions",
    destTable: "sync_sales_transactions",
    pkColumn: "id",
    label: "Sales Transactions",
    category: "sales",
  },
  {
    sourceTable: "SalesCampaigns",
    destTable: "sync_sales_campaigns",
    pkColumn: "id",
    label: "Sales Campaigns",
    category: "sales",
  },
  {
    sourceTable: "SalesProductionDates",
    destTable: "sync_sales_production_dates",
    pkColumn: "id",
    label: "Sales Production Dates",
    category: "sales",
  },
  {
    sourceTable: "LeadsData",
    destTable: "sync_leads_data",
    pkColumn: "id",
    label: "Leads Data",
    category: "sales",
  },
  {
    sourceTable: "MarketingData",
    destTable: "sync_marketing_data",
    pkColumn: "id",
    label: "Marketing Data",
    category: "sales",
  },

  // ─── Payment tables ───────────────────────────────────────────────────────
  {
    sourceTable: "SagePayTransactions",
    destTable: "sync_sagepay_transactions",
    pkColumn: "id",
    orderBy: "Date",
    label: "SagePay Transactions",
    category: "payments",
    streamDump: true,   // 353k rows, no index on id — heap-order stream
    dateColumn: "Date", // incremental filter after initial full load
    incrementalDays: 3,
  },
  {
    sourceTable: "SageBatchHistory",
    destTable: "sync_sage_batch_history",
    pkColumn: "id",
    label: "SagePay Batch History",
    category: "payments",
  },
  {
    sourceTable: "QLinkBatchHistory",
    destTable: "sync_qlink_batch_history",
    pkColumn: "id",
    orderBy: "Date",
    label: "QLink Batch History",
    category: "payments",
  },
  {
    sourceTable: "InvoiceData",
    destTable: "sync_invoice_data",
    pkColumn: "id",
    orderBy: "DateCreated",
    label: "Invoice Data",
    category: "payments",
  },
  {
    sourceTable: "Invoices",
    destTable: "sync_invoices",
    pkColumn: "id",
    label: "Invoices",
    category: "payments",
  },

  // ─── Policy tables ────────────────────────────────────────────────────────
  {
    sourceTable: "PremiumUpdates",
    destTable: "sync_premium_updates",
    pkColumn: "id",
    label: "Premium Updates",
    category: "policies",
  },
  {
    sourceTable: "WelcomePackHistory",
    destTable: "sync_welcome_pack_history",
    pkColumn: "id",
    orderBy: "Date",
    label: "Welcome Pack History",
    category: "policies",
  },
  {
    sourceTable: "VitalConsultPolicies",
    destTable: "sync_vital_policies",
    pkColumn: "id",
    label: "VitalConsult Policies",
    category: "policies",
  },
  {
    sourceTable: "VitalConsultPolicyPremiumHistory",
    destTable: "sync_vital_policy_premium_history",
    pkColumn: "id",
    label: "VitalConsult Premium History",
    category: "policies",
  },
  {
    sourceTable: "VitalConsultPolicyTransactions",
    destTable: "sync_vital_policy_transactions",
    pkColumn: "id",
    label: "VitalConsult Policy Transactions",
    category: "policies",
  },
  {
    sourceTable: "VitalConsultPolicyStatusHistory",
    destTable: "sync_vital_policy_status_history",
    pkColumn: "id",
    label: "VitalConsult Status History",
    category: "policies",
  },

  // ─── Operations ───────────────────────────────────────────────────────────
  {
    sourceTable: "fb_PolicyIncrease",
    destTable: "sync_fb_policy_increase",
    pkColumn: "increase1",
    label: "FoxBilling Policy Increases",
    category: "operations",
  },
  {
    sourceTable: "SignFoxbill",
    destTable: "sync_sign_foxbill",
    pkColumn: "id",
    label: "FoxBilling Signatures",
    category: "operations",
  },
  {
    sourceTable: "fb_SignFoxbill",
    destTable: "sync_fb_sign_foxbill",
    pkColumn: "id",
    label: "FoxBilling Sign Records",
    category: "operations",
  },
  {
    sourceTable: "StatusAudit",
    destTable: "sync_status_audit",
    pkColumn: "id",
    label: "Status Audit Log",
    category: "operations",
  },
];
