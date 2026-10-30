import { z } from "zod";

export const CURRENCIES = ["VND", "THB", "LAK", "USD", "EUR", "CZK"] as const;
export const CurrencySchema = z.enum(CURRENCIES);
export type Currency = z.infer<typeof CurrencySchema>;

export interface CurrencyRate {
  currency: Currency;
  rate: number;
}

export type ExchangeRates = Record<string, number>;

export const EXPENSE_CATEGORIES = [
  "Gastro",
  "Doprava",
  "Ubytování",
  "Bar",
  "Zážitky",
  "Nákupy",
  "Různé",
] as const;

export const ExpenseCategorySchema = z.enum(EXPENSE_CATEGORIES);
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface CategoryDefinition {
  id: ExpenseCategory;
  label: string;
  emoji: string;
  iconName: string;
  badgeBg: string;
  circleBg: string;
  barColor: string;
}

export const CATEGORY_DEFINITIONS: Record<ExpenseCategory, CategoryDefinition> = {
  Gastro: {
    id: "Gastro",
    label: "Gastro",
    emoji: "🍜",
    iconName: "UtensilsCrossed",
    badgeBg: "bg-rose-50 text-rose-700 border-rose-200",
    circleBg: "bg-rose-100 text-rose-600",
    barColor: "bg-rose-500",
  },
  Doprava: {
    id: "Doprava",
    label: "Doprava",
    emoji: "🛵",
    iconName: "Train",
    badgeBg: "bg-orange-50 text-orange-700 border-orange-200",
    circleBg: "bg-orange-100 text-orange-600",
    barColor: "bg-orange-500",
  },
  Ubytování: {
    id: "Ubytování",
    label: "Ubytování",
    emoji: "🏨",
    iconName: "Hotel",
    badgeBg: "bg-blue-50 text-blue-700 border-blue-200",
    circleBg: "bg-blue-100 text-blue-600",
    barColor: "bg-blue-500",
  },
  Bar: {
    id: "Bar",
    label: "Bar & Pivo",
    emoji: "🍺",
    iconName: "Wine",
    badgeBg: "bg-purple-50 text-purple-700 border-purple-200",
    circleBg: "bg-purple-100 text-purple-600",
    barColor: "bg-purple-500",
  },
  Zážitky: {
    id: "Zážitky",
    label: "Zážitky",
    emoji: "✈️",
    iconName: "Plane",
    badgeBg: "bg-sky-50 text-sky-700 border-sky-200",
    circleBg: "bg-sky-100 text-sky-600",
    barColor: "bg-sky-500",
  },
  Nákupy: {
    id: "Nákupy",
    label: "Nákupy",
    emoji: "🛒",
    iconName: "ShoppingCart",
    badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
    circleBg: "bg-emerald-100 text-emerald-600",
    barColor: "bg-emerald-500",
  },
  Různé: {
    id: "Různé",
    label: "Různé",
    emoji: "🏷️",
    iconName: "Tag",
    badgeBg: "bg-slate-50 text-slate-700 border-slate-200",
    circleBg: "bg-slate-100 text-slate-600",
    barColor: "bg-slate-500",
  },
};

export const CATEGORY_LIST: CategoryDefinition[] = EXPENSE_CATEGORIES.map(
  (cat) => CATEGORY_DEFINITIONS[cat]
);

/**
 * Normalizuje libovolný text kategorie (včetně starých českých i anglických názvů)
 * na jednotnou definici kategorie (CategoryDefinition).
 */
export function getCategoryDefinition(rawCategory?: string): CategoryDefinition {
  const norm = (rawCategory || "").toLowerCase().trim();

  if (
    norm.includes("gastro") ||
    norm.includes("jídlo") ||
    norm.includes("jidlo") ||
    norm.includes("restaurant") ||
    norm.includes("oběd") ||
    norm.includes("večeře") ||
    norm.includes("food") ||
    norm.includes("🍜") ||
    norm.includes("🍽️")
  ) {
    return CATEGORY_DEFINITIONS.Gastro;
  }

  if (
    norm.includes("doprav") ||
    norm.includes("transport") ||
    norm.includes("vlak") ||
    norm.includes("taxi") ||
    norm.includes("grab") ||
    norm.includes("autobus") ||
    norm.includes("scooter") ||
    norm.includes("skútr") ||
    norm.includes("skutr") ||
    norm.includes("🛵") ||
    norm.includes("🚕") ||
    norm.includes("🚆")
  ) {
    return CATEGORY_DEFINITIONS.Doprava;
  }

  if (
    norm.includes("ubytov") ||
    norm.includes("accommodat") ||
    norm.includes("hotel") ||
    norm.includes("hostel") ||
    norm.includes("airbnb") ||
    norm.includes("🏨")
  ) {
    return CATEGORY_DEFINITIONS.Ubytování;
  }

  if (
    norm.includes("bar") ||
    norm.includes("pivo") ||
    norm.includes("drink") ||
    norm.includes("alkohol") ||
    norm.includes("koktejl") ||
    norm.includes("beer") ||
    norm.includes("🍺") ||
    norm.includes("🍸") ||
    norm.includes("🍷")
  ) {
    return CATEGORY_DEFINITIONS.Bar;
  }

  if (
    norm.includes("zážit") ||
    norm.includes("zazit") ||
    norm.includes("flight") ||
    norm.includes("letenk") ||
    norm.includes("let") ||
    norm.includes("výlet") ||
    norm.includes("vylet") ||
    norm.includes("vstup") ||
    norm.includes("aerolink") ||
    norm.includes("✈️") ||
    norm.includes("🎟️")
  ) {
    return CATEGORY_DEFINITIONS.Zážitky;
  }

  if (
    norm.includes("nákup") ||
    norm.includes("nakup") ||
    norm.includes("grocer") ||
    norm.includes("coffee") ||
    norm.includes("káv") ||
    norm.includes("kav") ||
    norm.includes("cafe") ||
    norm.includes("market") ||
    norm.includes("7-eleven") ||
    norm.includes("obchod") ||
    norm.includes("🛒") ||
    norm.includes("☕")
  ) {
    return CATEGORY_DEFINITIONS.Nákupy;
  }

  return CATEGORY_DEFINITIONS.Různé;
}

export const PAYMENT_METHODS = [
  { id: "cash", label: "Hotovost", icon: "💵" },
  { id: "card", label: "Karta", icon: "💳" },
] as const;

export const PaymentMethodSchema = z.enum(["cash", "card"]);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const ExpenseSchema = z.object({
  id: z.string().optional(),
  amountOriginal: z.number(),
  currency: CurrencySchema,
  amountCZK: z.number(),
  category: z.string(),
  note: z.string(),
  merchant: z.string().optional(),
  createdAt: z.string(),
  paymentMethod: PaymentMethodSchema.optional(),
});

export type Expense = z.infer<typeof ExpenseSchema>;

// ─────────────────────────────────────────────
//  Modul Deník Služeb
// ─────────────────────────────────────────────

export const SERVICE_CATEGORIES = [
  "Masáže",
  "Ubytování",
  "Prádelna",
  "Půjčovna",
  "Výlety",
  "Zdraví",
  "Jiné",
] as const;

/** Klíče statického číselníku (jen pro SERVICE_CATEGORY_DEFS) */
export type ServiceCatKey = (typeof SERVICE_CATEGORIES)[number];

export interface ServiceCategoryDef {
  id: ServiceCatKey;
  emoji: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const SERVICE_CATEGORY_DEFS: Record<ServiceCatKey, ServiceCategoryDef> = {
  Masáže:    { id: "Masáže",    emoji: "💆", color: "text-pink-700",    bgColor: "bg-pink-50",    borderColor: "border-pink-200" },
  Ubytování: { id: "Ubytování", emoji: "🏨", color: "text-blue-700",   bgColor: "bg-blue-50",   borderColor: "border-blue-200"  },
  Prádelna:  { id: "Prádelna",  emoji: "🫧", color: "text-cyan-700",   bgColor: "bg-cyan-50",   borderColor: "border-cyan-200"  },
  Půjčovna:  { id: "Půjčovna",  emoji: "🛵", color: "text-orange-700", bgColor: "bg-orange-50", borderColor: "border-orange-200" },
  Výlety:    { id: "Výlety",    emoji: "⛵", color: "text-sky-700",    bgColor: "bg-sky-50",    borderColor: "border-sky-200"   },
  Zdraví:    { id: "Zdraví",    emoji: "💊", color: "text-green-700",  bgColor: "bg-green-50",  borderColor: "border-green-200" },
  Jiné:      { id: "Jiné",      emoji: "🏷️", color: "text-slate-700",  bgColor: "bg-slate-50",  borderColor: "border-slate-200" },
};

// ─── Dynamické uživatelské kategorie (Firestore) ───────────────────────────

/** Uživatelsky spravovaná kategorie uložená ve Firestore */
export interface ServiceCategory {
  id: string;          // Firestore document ID
  name: string;        // Název kategorie, např. "Kadeřník"
  icon: string;        // Emoji, např. "✂️"
  isDefault?: boolean; // Předdefinovaná kategorie (seedovaná)
  order?: number;      // Pořadí zobrazení
}

/** Výchozí seedovací seznam synchronizovaný se statickým číselníkem */
export const DEFAULT_SERVICE_CATEGORIES: Omit<ServiceCategory, "id">[] = [
  { name: "Masáže",    icon: "💆", isDefault: true, order: 0 },
  { name: "Ubytování", icon: "🏨", isDefault: true, order: 1 },
  { name: "Prádelna",  icon: "🫧", isDefault: true, order: 2 },
  { name: "Půjčovna",  icon: "🛵", isDefault: true, order: 3 },
  { name: "Výlety",    icon: "⛵", isDefault: true, order: 4 },
  { name: "Zdraví",    icon: "💊", isDefault: true, order: 5 },
  { name: "Jiné",      icon: "🏷️", isDefault: true, order: 6 },
];

/** Cyklická paleta pro uživatelské (ne-defaultní) kategorie */
const USER_CAT_PALETTE = [
  { color: "text-violet-700", bgColor: "bg-violet-50", borderColor: "border-violet-200" },
  { color: "text-amber-700",  bgColor: "bg-amber-50",  borderColor: "border-amber-200"  },
  { color: "text-teal-700",   bgColor: "bg-teal-50",   borderColor: "border-teal-200"   },
  { color: "text-rose-700",   bgColor: "bg-rose-50",   borderColor: "border-rose-200"   },
  { color: "text-indigo-700", bgColor: "bg-indigo-50", borderColor: "border-indigo-200" },
  { color: "text-lime-700",   bgColor: "bg-lime-50",   borderColor: "border-lime-200"   },
];

/** Vrátí Tailwind třídy pro libovolnou kategorii (statickou i uživatelskou) */
export function getServiceCatStyle(
  cat: ServiceCategory
): { color: string; bgColor: string; borderColor: string } {
  const staticKey = cat.name as ServiceCatKey;
  if (SERVICE_CATEGORY_DEFS[staticKey]) {
    const def = SERVICE_CATEGORY_DEFS[staticKey];
    return { color: def.color, bgColor: def.bgColor, borderColor: def.borderColor };
  }
  const idx = (cat.order ?? 0) % USER_CAT_PALETTE.length;
  return USER_CAT_PALETTE[idx];
}

export interface ServiceEntry {
  id: string;
  name: string;        // NÁZEV (např. "Massage World")
  location: string;    // MÍSTO (např. "Chiang Mai - Old City")
  category: string;    // TYP SLUŽBY
  items: string[];     // KONKRÉTNÍ SLUŽBY (pole řádků)
  price: number;       // CENA
  currency: string;    // MĚNA
  rating: number;      // SPOKOJENOST (1–5)
  note?: string;       // Poznámka / heslo / kontakt
  createdAt: string;   // ISO Date string
  paymentMethod?: PaymentMethod; // Způsob platby (hotovost vs. karta)
}
