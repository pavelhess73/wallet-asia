"use server";

import { GoogleGenAI, Type } from "@google/genai";
import { Currency, ExpenseCategory } from "@/lib/types";

// Orientační kurzy: 1000 VND = 0.95 CZK, 1 THB = 0.68 CZK, 1000 LAK = 1.1 CZK, 1 USD = 23 CZK, 1 CZK = 1 CZK
export const EXCHANGE_RATES: Record<Currency, number> = {
  VND: 0.95 / 1000,
  THB: 0.68,
  LAK: 1.1 / 1000,
  USD: 23,
  CZK: 1,
};

export interface FirestoreAudioExpensePayload {
  amountOriginal: number;
  currency: Currency;
  amountCZK: number;
  category: ExpenseCategory | string;
  note: string;
  merchant?: string;
  createdAt: string;
}

interface RawAIAudioOutput {
  amountOriginal: number;
  currency: Currency;
  category: ExpenseCategory;
  note: string;
  merchant?: string;
}

/**
 * Zpracuje hlasovou nahrávku (base64 audio) pomocí Gemini AI a vrátí strukturovaný objekt pro Firestore.
 *
 * @param base64Audio Řetězec s base64 daty zvuku (může obsahovat i 'data:audio/...;base64,' prefix)
 * @param mimeType MIME typ nahrávky, výchozí je 'audio/webm' (např. 'audio/webm', 'audio/mp3', 'audio/wav', 'audio/m4a')
 */
export async function parseAudioExpense(
  base64Audio: string,
  mimeType: string = "audio/webm"
): Promise<FirestoreAudioExpensePayload> {
  if (!base64Audio || !base64Audio.trim()) {
    throw new Error("Hlasová nahrávka nesmí být prázdná.");
  }

  const apiKey =
    process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Chybí GEMINI_API_KEY v konfiguraci prostředí.");
  }

  // Očištění base64 řetězce od Data URL hlavičky a detekce MIME typu
  let cleanBase64 = base64Audio.trim();
  let effectiveMimeType = mimeType || "audio/webm";

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

  // Schéma odpovědi pro strukturovaný JSON výstup
  const audioExpenseSchema = {
    type: Type.OBJECT,
    properties: {
      amountOriginal: {
        type: Type.NUMBER,
        description:
          "Číselná hodnota částky zmíněné v nahrávce (např. 150000 z 'sto padesát tisíc' nebo '150k')",
      },
      currency: {
        type: Type.STRING,
        enum: ["THB", "VND", "LAK", "USD", "CZK"],
        description: "Měna výdaje: THB, VND, LAK, USD nebo CZK",
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
        description: "Stručný český popis toho, co uživatel v nahrávce říkal",
      },
      merchant: {
        type: Type.STRING,
        description:
          "Případně zmíněný podnik, restaurace, obchod, služba nebo lokace",
      },
    },
    required: ["amountOriginal", "currency", "category", "note"],
  };

  const promptText = `Jsi inteligentní asistent pro hlasové zaznamenávání výdajů v aplikaci Asia Travel Wallet.
Poslechni si přiloženou zvukovou nahrávku, ve které uživatel popisuje svůj výdaj (česky, slovensky nebo s anglickými výrazy).
Analyzuj mluvené slovo a extrahuj následující data:
1. 'amountOriginal': Číselná hodnota částky. Převeď slovní čísla i zkratky na čisté číslo (např. 'sto padesát tisíc' -> 150000, 'třicet pět k' -> 35000, 'dvacet pět' -> 25).
2. 'currency': Měna z povolených hodnot ('THB' | 'VND' | 'LAK' | 'USD' | 'CZK').
   - Pokud uživatel řekne bahty/THB -> THB
   - Pokud řekne dongy/VND -> VND
   - Pokud řekne kipy/LAK -> LAK
   - Pokud řekne dolary/USD -> USD
   - Pokud řekne koruny/Kč -> CZK
   - Pokud měnu neřekne, odvoď ji z kontextu (např. 'k' u pho bo / Vietnam -> VND, pad thai / Thajsko -> THB).
3. 'category': Vyber přesně jednu z kategorií:
   - '🍺 Pivo & Bar' (pivo, bar, drinky, alkohol, noční život, hospoda)
   - '🍜 Gastro & Jídlo' (jídlo, restaurace, street food, snídaně, oběd, večeře, káva)
   - '🚕 Doprava' (Grab, taxi, tuk tuk, autobus, vlak, trajekt, lístky na dopravu, palivo)
   - '🏨 Ubytování' (hotel, hostel, resort, ubytování, guesthouse)
   - '🎟️ Zážitky' (vstupy, výlety, památky, masáže, potápění, atrakce)
   - '🛒 Ostatní' (nákup v 7-Eleven, potraviny, drogerie, suvenýry, SIM karta, nákupy)
4. 'note': Stručný, výstižný český popis nákupu (např. 'Oběd v restauraci', 'Pivo Chang', 'Grab taxi na letiště', 'Nákup v 7-Eleven').
5. 'merchant': Název podniku, restaurace, obchodu, služby nebo lokace, pokud byla zmíněna (např. '7-Eleven', 'Grab', 'Bia Hoi', 'Khao San Road').`;

  const candidateModels = ["gemini-2.5-flash", "gemini-3.8-flash"];

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
          responseSchema: audioExpenseSchema,
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
    console.error("Chyba při zpracování hlasové nahrávky přes Gemini API:", lastError);
    throw new Error(
      `Nepodařilo se zpracovat hlasovou nahrávku pomocí Gemini AI. ${
        lastError instanceof Error ? lastError.message : ""
      }`
    );
  }

  let parsed: RawAIAudioOutput;
  try {
    let cleanText = rawJsonText.trim();
    if (cleanText.startsWith("```")) {
      cleanText = cleanText
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();
    }
    parsed = JSON.parse(cleanText) as RawAIAudioOutput;
  } catch (parseErr) {
    console.error("Neplatný JSON z Gemini při zpracování audia:", rawJsonText, parseErr);
    throw new Error("Gemini AI nevrátilo platný JSON formát.");
  }

  const rate = EXCHANGE_RATES[parsed.currency] ?? 1;
  const amountCZK = Math.round(parsed.amountOriginal * rate * 100) / 100;

  const result: FirestoreAudioExpensePayload = {
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
