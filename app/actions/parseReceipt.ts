"use server";

import { GoogleGenAI, Type } from "@google/genai";
import { Currency, ExpenseCategory } from "@/lib/types";

// Orientační kurzy: 1000 VND = 0.95 CZK, 1 THB = 0.68 CZK, 1000 LAK = 1.1 CZK, 1 USD = 23 CZK, 1 CZK = 1 CZK
const EXCHANGE_RATES: Record<Currency, number> = {
  VND: 0.95 / 1000,
  THB: 0.68,
  LAK: 1.1 / 1000,
  USD: 23,
  CZK: 1,
};

interface FirestoreReceiptExpensePayload {
  amountOriginal: number;
  currency: Currency;
  amountCZK: number;
  category: ExpenseCategory | string;
  note: string;
  merchant?: string;
  createdAt: string;
}

interface RawAIReceiptOutput {
  amountOriginal: number;
  currency: Currency;
  category: ExpenseCategory;
  note: string;
  merchant?: string;
}

/**
 * Zpracuje fotku účtenky (base64) pomocí Gemini Vision a vrátí strukturovaný objekt pro Firestore.
 *
 * @param base64Image Řetězec s base64 daty obrázku (může obsahovat i 'data:image/...;base64,' prefix)
 * @param mimeType MIME typ obrázku, např. 'image/jpeg', 'image/png' (volitelné, jinak se detekuje)
 */
export async function parseReceiptImage(
  base64Image: string,
  mimeType = "image/jpeg"
): Promise<FirestoreReceiptExpensePayload> {
  if (!base64Image || !base64Image.trim()) {
    throw new Error("Obrázek účtenky nesmí být prázdný.");
  }

  const apiKey =
    process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Chybí GEMINI_API_KEY v konfiguraci prostředí.");
  }

  // Očištění base64 řetězce od Data URL hlavičky a detekce MIME typu
  let cleanBase64 = base64Image.trim();
  let effectiveMimeType = mimeType || "image/jpeg";

  if (cleanBase64.startsWith("data:")) {
    const commaIndex = cleanBase64.indexOf(",");
    if (commaIndex !== -1) {
      const header = cleanBase64.substring(5, commaIndex);
      const detectedMime = header.split(";")[0];
      if (detectedMime) {
        effectiveMimeType = detectedMime;
      }
      cleanBase64 = cleanBase64.substring(commaIndex + 1);
    }
  }

  const ai = new GoogleGenAI({ apiKey });

  // Schéma odpovědi pro vynucení strukturovaného JSON výstupu
  const receiptSchema = {
    type: Type.OBJECT,
    properties: {
      amountOriginal: {
        type: Type.NUMBER,
        description: "Celková konečná částka na účtence (Total / Grand Total / Celkem)",
      },
      currency: {
        type: Type.STRING,
        enum: ["VND", "THB", "LAK", "USD", "CZK"],
        description: "Měna účtenky: VND, THB, LAK, USD nebo CZK",
      },
      category: {
        type: Type.STRING,
        enum: [
          "🍺 Pivo & Bar",
          "🍜 Gastro & Jídlo",
          "🚕 Doprava",
          "🏨 Ubytování",
          "🎟️ Zážitky",
          "🛒 Ostatní",
        ],
        description:
          "Přesně jedna kategorie: '🍺 Pivo & Bar', '🍜 Gastro & Jídlo', '🚕 Doprava', '🏨 Ubytování', '🎟️ Zážitky', '🛒 Ostatní'",
      },
      note: {
        type: Type.STRING,
        description:
          "Stručný český popis nákupu (např. 'Oběd v restauraci', 'Nákup v supermarketu')",
      },
      merchant: {
        type: Type.STRING,
        description:
          "Název podniku, restaurace nebo obchodu přečtený z hlavičky účtenky",
      },
    },
    required: ["amountOriginal", "currency", "category", "note"],
  };

  const promptText = `Jsi asistent pro skenování účtenek pro aplikaci Asia Travel Wallet.
Důkladně analyzuj přiloženou fotografii účtenky a extrahuj následující data:
1. 'merchant': Název podniku, restaurace nebo obchodu přečtený z hlavičky účtenky. Pokud není jasný, uveď typ podniku nebo lokalitu.
2. 'amountOriginal': Celková konečná částka k úhradě (Total, Grand Total, Tong cong, Baht, atd.) jako čisté číslo.
3. 'currency': Měna z povolených hodnot ('VND' | 'THB' | 'LAK' | 'USD' | 'CZK'). Odvoď ji z textu, symbolů (₫, ฿, ₭, $, Kč) nebo z kontextu země (Vietnam -> VND, Thajsko -> THB, Laos -> LAK).
4. 'category': Vyber přesně jednu z možností:
   - '🍜 Gastro & Jídlo' (restaurace, bistra, pouliční jídlo, kavárny, obědy, večeře)
   - '🍺 Pivo & Bar' (bary, pivo, alkoholické nápoje, noční kluby)
   - '🚕 Doprava' (taxi, Grab, vlaky, autobusy, trajekty, palivo)
   - '🏨 Ubytování' (hotel, hostel, resort, ubytovací poplatky)
   - '🎟️ Zážitky' (vstupy, výlety, památky, masáže, atrakce)
   - '🛒 Ostatní' (potraviny ze 7-Eleven, drogérie, suvenýry, nákupy)
5. 'note': Stručný výstižný český popis nákupu (např. 'Oběd v restauraci', 'Nákup v 7-Eleven', 'Káva a dezert', 'Lístek na vlak').`;

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
        contents: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: effectiveMimeType,
            },
          },
          {
            text: promptText,
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: receiptSchema,
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
    console.error("Chyba při skenování účtenky přes Gemini API:", lastError);
    throw new Error(
      `Nepodařilo se rozpoznat účtenku pomocí Gemini AI. ${
        lastError instanceof Error ? lastError.message : ""
      }`
    );
  }

  let parsed: RawAIReceiptOutput;
  try {
    parsed = JSON.parse(rawJsonText) as RawAIReceiptOutput;
  } catch (parseErr) {
    console.error("Neplatný JSON z Gemini při čtení účtenky:", rawJsonText, parseErr);
    throw new Error("Gemini AI nevrátilo platný JSON formát účtenky.");
  }

  const rate = EXCHANGE_RATES[parsed.currency] ?? 1;
  const amountCZK = Math.round(parsed.amountOriginal * rate * 100) / 100;

  const result: FirestoreReceiptExpensePayload = {
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
