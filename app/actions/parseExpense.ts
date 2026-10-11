"use server";

import { GoogleGenAI, Type } from "@google/genai";
import { Currency, ExpenseCategory } from "@/lib/types";

// Orientační kurzy: 1000 VND = 0.95 CZK, 1 THB = 0.68 CZK, 1000 LAK = 1.1 CZK, 1 USD = 23 CZK
const EXCHANGE_RATES: Record<Currency, number> = {
  VND: 0.95 / 1000,
  THB: 0.68,
  LAK: 1.1 / 1000,
  USD: 23,
  CZK: 1,
};

interface FirestoreExpensePayload {
  amountOriginal: number;
  currency: Currency;
  amountCZK: number;
  category: ExpenseCategory | string;
  note: string;
  merchant?: string;
  createdAt: string;
}

interface RawAIExpenseOutput {
  amountOriginal: number;
  currency: Currency;
  category: ExpenseCategory;
  note: string;
  merchant?: string;
}

/**
 * Zpracuje uživatelský text pomocí Gemini a vrátí objekt připravený pro uložení do Firestore.
 */
export async function parseAIExpense(userInput: string): Promise<FirestoreExpensePayload> {
  if (!userInput || !userInput.trim()) {
    throw new Error("Uživatelský vstup nesmí být prázdný.");
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Chybí GEMINI_API_KEY v konfiguraci prostředí.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const expenseSchema = {
    type: Type.OBJECT,
    properties: {
      amountOriginal: {
        type: Type.NUMBER,
        description: "Číslo částky, např. 150000 z '150k' nebo '150 000'",
      },
      currency: {
        type: Type.STRING,
        enum: ["VND", "THB", "LAK", "USD", "CZK"],
        description: "Měna výdaje: VND, THB, LAK, USD nebo CZK",
      },
      category: {
        type: Type.STRING,
        enum: [
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
        ],
        description: "Jedna z předdefinovaných kategorií výdaje: Transportation, Restaurants, Drinks, Coffee, Groceries, Accommodation, Flights",
      },
      note: {
        type: Type.STRING,
        description: "Stručný český popis výdaje",
      },
      merchant: {
        type: Type.STRING,
        description: "Volitelný název podniku, restaurace, obchodu nebo služby",
      },
    },
    required: ["amountOriginal", "currency", "category", "note"],
  };

  const systemPrompt = `Jsi inteligentní asistent pro Asia Travel Wallet, který zpracovává výdaje z cest po jihovýchodní Asii (Vietnam, Thajsko, Laos) a dalších měnách (USD, CZK).
Z textu uživatele extrahuj přesné informace:
- 'amountOriginal': číselná hodnota. Převáděj zkratky jako '150k' na 150000, '35k' na 35000 atd.
- 'currency': měna z povolených hodnot ('VND' | 'THB' | 'LAK' | 'USD' | 'CZK'). Pokud uživatel měnu neuvede, urči ji podle kontextu lokace nebo typu měny ('k' bez specifikace obvykle značí VND nebo THB dle kontextu, např. Pho Bo / Bia Hoi = VND).
- 'category': vyber nejvhodnější kategorii z: 'Transportation' (doprava, taxi, vlak, autobus), 'Restaurants' (jídlo, restaurace, pouliční stánky), 'Drinks' (pivo, bar, alkohol), 'Coffee' (káva, kavárny), 'Groceries' (potraviny, nákupy v 7-Eleven/obchodech), 'Accommodation' (hotel, hostel), 'Flights' (letenky).
- 'note': stručný český popis výdaje.
- 'merchant': název podniku nebo obchodu, pokud byl zmíněn (např. '7-Eleven', 'Bia Hoi', 'Grab', 'Pho 10').`;

  // Dostupné modely v @google/genai v1beta API
  const candidateModels = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
  ];

  let rawJsonText: string | null = null;
  let lastError: unknown = null;

  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: `${systemPrompt}\n\nUživatelský vstup:\n${userInput.trim()}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: expenseSchema,
        },
      });

      if (response.text) {
        rawJsonText = response.text;
        break;
      }
    } catch (err) {
      lastError = err;
      // Zkoušíme další model z candidate listu
      continue;
    }
  }

  if (!rawJsonText) {
    console.error("Chyba při volání Gemini API:", lastError);
    throw new Error(
      `Nepodařilo se zpracovat výdaj pomocí Gemini AI. ${
        lastError instanceof Error ? lastError.message : ""
      }`
    );
  }

  let parsed: RawAIExpenseOutput;
  try {
    parsed = JSON.parse(rawJsonText) as RawAIExpenseOutput;
  } catch (parseErr) {
    console.error("Neplatný JSON z Gemini:", rawJsonText, parseErr);
    throw new Error("Gemini AI nevrátilo platný JSON formát.");
  }

  const rate = EXCHANGE_RATES[parsed.currency] ?? 1;
  const amountCZK = Math.round(parsed.amountOriginal * rate * 100) / 100;

  const result: FirestoreExpensePayload = {
    amountOriginal: parsed.amountOriginal,
    currency: parsed.currency,
    amountCZK,
    category: parsed.category,
    note: parsed.note,
    createdAt: new Date().toISOString(),
  };

  if (parsed.merchant && parsed.merchant.trim()) {
    result.merchant = parsed.merchant.trim();
  }

  return result;
}
