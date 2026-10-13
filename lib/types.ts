import { z } from "zod";

export const CURRENCIES = ["VND", "THB", "LAK", "USD", "EUR", "CZK"] as const;
export const CurrencySchema = z.enum(CURRENCIES);
export type Currency = z.infer<typeof CurrencySchema>;

export const PRIMARY_CATEGORIES = [
  "Transportation",
  "Restaurants",
  "Drinks",
  "Coffee",
  "Groceries",
  "Accommodation",
  "Flights",
] as const;
export type PrimaryCategory = (typeof PRIMARY_CATEGORIES)[number];

export const EXPENSE_CATEGORIES = [
  "Transportation",
  "Restaurants",
  "Drinks",
  "Coffee",
  "Groceries",
  "Accommodation",
  "Flights",
  "🍺 Pivo & Bar",
  "🍜 Gastro & Jídlo",
  "🚕 Doprava",
  "🏨 Ubytování",
  "🎟️ Zážitky",
  "🛒 Ostatní",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const LocationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});
export type Location = z.infer<typeof LocationSchema>;

export const ExpenseSchema = z.object({
  id: z.string().optional(),
  amountOriginal: z.number(),
  currency: CurrencySchema,
  amountCZK: z.number(),
  category: z.string(),
  note: z.string(),
  merchant: z.string().optional(),
  createdAt: z.string(),
  location: LocationSchema.optional(),
});

export type Expense = z.infer<typeof ExpenseSchema>;
