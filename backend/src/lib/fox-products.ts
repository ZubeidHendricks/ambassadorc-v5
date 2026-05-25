/**
 * FoxPro product-capture catalog.
 * Drives the per-product capture forms (Life Saver 24 / Life Saver Legal /
 * LegalNet / Five-In-One) — premiums from ZUBEID.xlsx and the FoxPro book.
 *
 * `type` matches the Prisma `ProductType` enum; `code` is the unique product
 * code used to resolve/upsert the `products` row at capture time.
 */
export type CollectionMethod = "DEBIT_ORDER" | "PERSAL";

export interface ProductVariant {
  tierName: string;
  premium: number;
}

export interface FoxProduct {
  code: string;
  name: string;
  type: "LIFE_COVER" | "LEGAL" | "SOS" | "FIVE_IN_ONE" | "SHORT_TERM" | "CONSULT";
  /** Collection methods this product can be captured under. */
  methods: CollectionMethod[];
  variants: ProductVariant[];
}

export const FOX_PRODUCTS: FoxProduct[] = [
  {
    code: "LS24",
    name: "Life Saver 24",
    type: "LIFE_COVER",
    methods: ["DEBIT_ORDER", "PERSAL"],
    variants: [
      { tierName: "Basic", premium: 259 },
      { tierName: "Plus", premium: 349 },
    ],
  },
  {
    code: "LSLEGAL",
    name: "Life Saver Legal",
    type: "LEGAL",
    methods: ["DEBIT_ORDER", "PERSAL"],
    variants: [
      { tierName: "Basic", premium: 179 },
      { tierName: "Plus", premium: 299 },
    ],
  },
  {
    code: "LEGALNET",
    name: "LegalNet",
    type: "LEGAL",
    methods: ["DEBIT_ORDER", "PERSAL"],
    variants: [
      { tierName: "R99", premium: 99 },
      { tierName: "R109", premium: 109 },
      { tierName: "R119", premium: 119 },
      { tierName: "R129", premium: 129 },
      { tierName: "R139", premium: 139 },
      { tierName: "R149", premium: 149 },
      { tierName: "R159", premium: 159 },
      { tierName: "R169", premium: 169 },
      { tierName: "R179", premium: 179 },
    ],
  },
  {
    code: "5IN1",
    name: "Five-In-One",
    type: "FIVE_IN_ONE",
    methods: ["DEBIT_ORDER", "PERSAL"],
    variants: [{ tierName: "Standard", premium: 199 }],
  },
];

export function getFoxProduct(code: string): FoxProduct | undefined {
  return FOX_PRODUCTS.find((p) => p.code === code);
}

export function getVariantPremium(code: string, tierName: string): number | undefined {
  return getFoxProduct(code)?.variants.find((v) => v.tierName === tierName)?.premium;
}
