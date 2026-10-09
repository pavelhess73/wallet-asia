import { z } from "zod";

export const CURRENCIES = ["VND", "THB", "LAK", "USD", "CZK"] as const;
export const CurrencySchema = z.enum(CURRENCIES);
export type Currency = z.infer<typeof CurrencySchema>;

export const EXPENSE_CATEGORIES = [
  "🍺 Pivo & Bar",
  "FC Gastro & Jídlo",
  "🚕 Doprava",
  "🏨 Ubytování",
  "🎟️ Zážitky",
  "🛒 Ostatní",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const ExpenseSchema = z.object({
  id: z.string().optional(),
  amountOriginal: z.number(),
  currency: CurrencySchema,
  amountCZK: z.number(),
  category: z.string(),
  note: z.string(),
  merchant: z.string().optional(),
  createdAt: z.string(),
});

export type Expense = z.infer<typeof ExpenseSchema>;
