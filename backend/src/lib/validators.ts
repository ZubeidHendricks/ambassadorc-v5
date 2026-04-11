import { z } from "zod";

// ─── Shared Validators ─────────────────────────────────────────────────────

const southAfricanMobile = z
  .string()
  .regex(/^0\d{9}$/, "Mobile number must be 10 digits starting with 0 (SA format)");

const provinceEnum = z.enum([
  "EASTERN_CAPE",
  "FREE_STATE",
  "GAUTENG",
  "KWAZULU_NATAL",
  "LIMPOPO",
  "MPUMALANGA",
  "NORTH_WEST",
  "NORTHERN_CAPE",
  "WESTERN_CAPE",
]);

const positiveDecimal = z
  .number()
  .positive("Amount must be a positive number")
  .multipleOf(0.01, "Amount must have at most 2 decimal places");

const isoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}/, "Date must be in ISO format (YYYY-MM-DD)");

// ─── Auth Schemas ───────────────────────────────────────────────────────────

export const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  mobileNo: southAfricanMobile,
  password: z.string().min(6, "Password must be at least 6 characters"),
  province: provinceEnum,
  department: z.string().min(1, "Department is required").max(100),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the terms and conditions" }),
  }),
});

export const loginSchema = z.object({
  mobileNo: southAfricanMobile,
  password: z.string().min(1, "Password is required"),
});

// ─── Ambassador Schemas ─────────────────────────────────────────────────────

export const updateAmbassadorSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email("Invalid email address").max(255).optional().nullable(),
  province: provinceEnum.optional(),
  department: z.string().min(1).max(100).optional(),
  shopSteward: z.string().max(100).optional().nullable(),
  union: z.string().max(100).optional().nullable(),
  town: z.string().max(100).optional().nullable(),
  location: z.string().max(255).optional().nullable(),
});

export const changeMobileSchema = z.object({
  oldNumber: southAfricanMobile,
  newNumber: southAfricanMobile,
});

// ─── Referral Schemas ───────────────────────────────────────────────────────

const referralItem = z.object({
  refName: z.string().min(1, "Referral name is required").max(200),
  refContactNo: southAfricanMobile,
});

export const createReferralBatchSchema = z.object({
  batchName: z.string().min(1, "Batch name is required").max(255),
  referrals: z
    .array(referralItem)
    .min(1, "At least one referral is required")
    .max(10, "Maximum 10 referrals per batch"),
});

// ─── Lead Schemas ───────────────────────────────────────────────────────────

export const createLeadSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  contactNo: southAfricanMobile,
  preferredContact: z.string().max(50).optional().nullable(),
});

// ─── Client Schemas ─────────────────────────────────────────────────────────

export const createClientSchema = z.object({
  title: z.string().max(10).optional().nullable(),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  idNumber: z
    .string()
    .min(6, "ID number is required")
    .max(20, "ID number must be at most 20 characters"),
  cellphone: southAfricanMobile,
  email: z.string().email("Invalid email address").max(255).optional().nullable(),
  address1: z.string().max(255).optional().nullable(),
  address2: z.string().max(255).optional().nullable(),
  address3: z.string().max(255).optional().nullable(),
  addressCode: z.string().max(10).optional().nullable(),
  province: provinceEnum.optional().nullable(),
});

export const updateClientSchema = z.object({
  title: z.string().max(10).optional().nullable(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  cellphone: southAfricanMobile.optional(),
  email: z.string().email("Invalid email address").max(255).optional().nullable(),
  address1: z.string().max(255).optional().nullable(),
  address2: z.string().max(255).optional().nullable(),
  address3: z.string().max(255).optional().nullable(),
  addressCode: z.string().max(10).optional().nullable(),
  province: provinceEnum.optional().nullable(),
});

// ─── Product Schemas ────────────────────────────────────────────────────────

const productTypeEnum = z.enum([
  "LIFE_COVER",
  "LEGAL",
  "SOS",
  "FIVE_IN_ONE",
  "SHORT_TERM",
  "CONSULT",
]);

export const createProductSchema = z.object({
  name: z.string().min(1, "Product name is required").max(200),
  code: z.string().min(1, "Product code is required").max(50),
  type: productTypeEnum,
  premiumAmount: positiveDecimal,
  description: z.string().max(5000).optional().nullable(),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  code: z.string().min(1).max(50).optional(),
  type: productTypeEnum.optional(),
  premiumAmount: positiveDecimal.optional(),
  description: z.string().max(5000).optional().nullable(),
  isActive: z.boolean().optional(),
});

// ─── Premium Tier Schemas ───────────────────────────────────────────────────

export const createPremiumTierSchema = z.object({
  tierName: z.string().min(1, "Tier name is required").max(100),
  amount: positiveDecimal,
  effectiveDate: isoDateString,
});

export const updatePremiumTierSchema = z.object({
  tierName: z.string().min(1).max(100).optional(),
  amount: positiveDecimal.optional(),
  isActive: z.boolean().optional(),
  effectiveDate: isoDateString.optional(),
});

// ─── Policy Schemas ─────────────────────────────────────────────────────────

export const createPolicySchema = z.object({
  clientId: z.number().int().positive("Client ID is required"),
  productId: z.number().int().positive("Product ID is required"),
  premiumAmount: positiveDecimal,
});

export const updatePolicyStatusSchema = z.object({
  status: z.enum(["ACTIVE", "LAPSED", "CANCELLED", "PENDING"]),
});

// ─── Premium Change Schemas ─────────────────────────────────────────────────

export const premiumChangeRequestSchema = z.object({
  oldAmount: positiveDecimal,
  newAmount: positiveDecimal,
  reason: z.string().max(2000).optional().nullable(),
  effectiveDate: isoDateString,
});

export const approvePremiumChangeSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});

// ─── Payment Schemas ────────────────────────────────────────────────────────

export const createDebitOrderSchema = z.object({
  clientId: z.number().int().positive("Client ID is required"),
  policyId: z.number().int().positive("Policy ID is required"),
  bankName: z.string().min(1, "Bank name is required").max(100),
  accountNumber: z.string().min(1, "Account number is required").max(50),
  branchCode: z.string().min(1, "Branch code is required").max(20),
  accountType: z.string().min(1, "Account type is required").max(30),
  amount: positiveDecimal,
});

export const updateDebitOrderStatusSchema = z.object({
  status: z.enum(["ACTIVE", "PAUSED", "CANCELLED", "FAILED"]),
});

export const createPaymentSchema = z.object({
  policyId: z.number().int().positive("Policy ID is required"),
  clientId: z.number().int().positive("Client ID is required"),
  amount: positiveDecimal,
  paymentDate: isoDateString,
  gateway: z.enum(["SAGEPAY", "NETCASH", "MANUAL"]),
  reference: z.string().max(100).optional().nullable(),
});

// ─── Sale Schemas ───────────────────────────────────────────────────────────

export const createSaleSchema = z.object({
  clientId: z.number().int().positive("Client ID is required"),
  productId: z.number().int().positive("Product ID is required"),
  source: z.string().max(100).optional().nullable(),
});

export const updateSaleStatusSchema = z.object({
  status: z.enum([
    "NEW",
    "QA_PENDING",
    "QA_APPROVED",
    "QA_REJECTED",
    "ACTIVE",
    "CANCELLED",
  ]),
});

// ─── Campaign Schemas ───────────────────────────────────────────────────────

export const createCampaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required").max(200),
  description: z.string().max(5000).optional().nullable(),
  startDate: isoDateString,
  endDate: isoDateString.optional().nullable(),
});

export const updateCampaignSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  startDate: isoDateString.optional(),
  endDate: isoDateString.optional().nullable(),
  isActive: z.boolean().optional(),
});

// ─── Document Schemas ───────────────────────────────────────────────────────

export const createWelcomePackSchema = z.object({
  clientId: z.number().int().positive("Client ID is required"),
  policyId: z.number().int().positive("Policy ID is required"),
  templateName: z.string().max(200).optional(),
  type: z.enum(["HTML", "PDF"]).optional(),
});

export const recordSignatureSchema = z.object({
  signatureData: z.string().optional(),
});

export const requestCallbackSchema = z.object({
  requestedBy: z.string().max(200).optional(),
  staffEmail: z.string().email("Invalid email address").max(255).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

// ─── SMS Schemas ────────────────────────────────────────────────────────────

const smsTypeEnum = z.enum([
  "WELCOME",
  "QA_VERIFY",
  "PREMIUM_INCREASE",
  "CALLBACK",
  "AMBASSADOR",
  "AGENT_CAPTURE",
]);

export const sendSmsSchema = z.object({
  recipientNumber: southAfricanMobile,
  message: z.string().min(1, "Message is required").max(480),
  type: smsTypeEnum,
});

export const bulkSmsSchema = z.object({
  numbers: z
    .array(southAfricanMobile)
    .min(1, "At least one number is required")
    .max(1000, "Maximum 1000 recipients per batch"),
  message: z.string().min(1, "Message is required").max(480),
  type: smsTypeEnum,
});

// ─── QA Schemas ─────────────────────────────────────────────────────────────

export const createQaCheckSchema = z.object({
  saleId: z.number().int().positive("Sale ID is required"),
});

export const updateQaCheckSchema = z.object({
  status: z.enum(["PASSED", "FAILED", "ESCALATED"]),
  notes: z.string().max(5000).optional().nullable(),
});

// ─── Admin Schemas ──────────────────────────────────────────────────────────

export const updateAgentTierSchema = z.object({
  tier: z.string().min(1, "Tier is required").max(50),
});

export const updateAgentRoleSchema = z.object({
  role: z.enum(["AMBASSADOR", "AGENT", "ADMIN", "QA_OFFICER"]),
});
