"use server";

import { GoogleGenAI, Type } from "@google/genai";
import { Expense } from "@/lib/types";

/**
 * Vyhledá a vyfiltruje výdaje pomocí Gemini AI na základě uživatelského dotazu.
 *
 * @param queryText Vyhledávací dotaz uživatele (např. "všechno pivo v Hanoji", "výdaje nad 500 Kč")
 * @param expenses Seznam všech výdajů
 * @returns Pole řetězců (string[]) obsahující ID vybraných výdajů
 */
export async function searchExpensesWithAI(
  queryText: string,
  expenses: Expense[]
): Promise<string[]> {
  const trimmedQuery = queryText?.trim();
  if (!trimmedQuery) {
    return [];
  }

  // Filtrujeme pouze výdaje s platným ID
  const validExpenses = (expenses || []).filter(
    (e): e is Expense & { id: string } => typeof e.id === "string" && e.id.length > 0
  );

  if (validExpenses.length === 0) {
    return [];
  }

  const apiKey =
    process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Chybí GEMINI_API_KEY v konfiguraci prostředí.");
  }

  // Seřadíme výdaje podle data sestupně (od nejnovějších)
  const sortedExpenses = [...validExpenses].sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime() || 0;
    const timeB = new Date(b.createdAt).getTime() || 0;
    return timeB - timeA;
  });

  // Připravíme seřazený seznam výdajů s relevantními informacemi pro AI
  const formattedExpenses = sortedExpenses.map((e) => ({
    ID: e.id,
    kategorie: e.category,
    "částka v CZK": e.amountCZK,
    poznámka: e.note,
    datum: e.createdAt,
    ...(e.merchant ? { podnik: e.merchant } : {}),
    ...(e.amountOriginal && e.currency
      ? { původníČástka: `${e.amountOriginal} ${e.currency}` }
      : {}),
  }));

  const ai = new GoogleGenAI({ apiKey });

  const responseSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.STRING,
    },
    description: "JSON pole obsahující ID vybraných výdajů, které odpovídají dotazu",
  };

  const prompt = `Analýzuj uživatelský dotaz a vyfiltruj ze seznamu pouze výdaje, které mu odpovídají. Vrát JSON pole obsahující ID vybraných výdajů.

Uživatelský dotaz:
"${trimmedQuery}"

Seznam výdajů:
${JSON.stringify(formattedExpenses, null, 2)}`;

  const candidateModels = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-1.5-flash",
  ];

  let rawJsonText: string | null = null;
  let lastError: unknown = null;

  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.1,
        },
      });

      if (response.text) {
        rawJsonText = response.text;
        break;
      }
    } catch (err) {
      lastError = err;
      continue;
    }
  }

  if (!rawJsonText) {
    console.error("Chyba při volání Gemini API pro vyhledávání:", lastError);
    throw new Error(
      `Nepodařilo se vyhledat výdaje pomocí Gemini AI. ${
        lastError instanceof Error ? lastError.message : ""
      }`
    );
  }

  let parsed: unknown;
  try {
    let cleanText = rawJsonText.trim();
    if (cleanText.startsWith("```")) {
      cleanText = cleanText
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();
    }
    parsed = JSON.parse(cleanText);
  } catch (parseErr) {
    console.error("Neplatný JSON z Gemini při vyhledávání:", rawJsonText, parseErr);
    throw new Error("Gemini AI nevrátilo platné JSON pole ID.");
  }

  let extractedIds: string[] = [];

  if (Array.isArray(parsed)) {
    extractedIds = parsed.filter(
      (item): item is string => typeof item === "string" && item.trim().length > 0
    );
  } else if (parsed && typeof parsed === "object") {
    const arrayProp = Object.values(parsed as Record<string, unknown>).find(
      Array.isArray
    );
    if (arrayProp) {
      extractedIds = arrayProp.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0
      );
    }
  }

  // Ověříme, že vrácená ID skutečně existují v předaném seznamu
  const validIdSet = new Set(validExpenses.map((e) => e.id));
  return extractedIds.filter((id) => validIdSet.has(id));
}
