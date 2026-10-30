/**
 * Správa, kešování a přepočty směnných kurzů pro Asia Travel Wallet.
 * Single source of truth pro konverzi měn napříč celou aplikací.
 */

import { Currency, CURRENCIES, ExchangeRates } from "@/lib/types";

export const CACHE_STORAGE_KEY = "cached_exchange_rates";
export const CACHE_STORAGE_KEY_DATE = "cached_exchange_rates_date";

export const SUPPORTED_CURRENCIES = CURRENCIES;
export type SupportedCurrency = Currency;

export type { ExchangeRates };

/**
 * Pevně nastavené výchozí kurzy vztažené k 1 CZK (1 CZK = X dané měny).
 * Použijí se při výpadku sítě a prázdné offline keši.
 */
export const DEFAULT_EXCHANGE_RATES: ExchangeRates = {
  CZK: 1,
  THB: 1.54,
  VND: 1186.5,
  LAK: 1020.0,
  USD: 0.0458,
  EUR: 0.041,
};

// ─── Bezpečný přístup k localStorage (SSR kompatibilní) ──────────────────────

function getLocalStorageItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setLocalStorageItem(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch (err) {
    console.warn(`Nepodařilo se uložit ${key} do localStorage:`, err);
  }
}

/**
 * Načte uložené datum poslední aktualizace kurzů.
 */
export function getCachedRatesDate(): string | null {
  return getLocalStorageItem(CACHE_STORAGE_KEY_DATE);
}

/**
 * Uloží aktuální časové razítko aktualizace kurzů.
 */
export function saveRatesDate(isoDate?: string): void {
  setLocalStorageItem(CACHE_STORAGE_KEY_DATE, isoDate || new Date().toISOString());
}

/**
 * Formátuje stáří stažených kurzů pro zobrazení v UI.
 */
export function formatRatesAge(iso: string | null): string {
  if (!iso) return "kurzy z offline cache";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin < 2) return "Kurzy právě aktualizovány";
    if (diffMin < 60) return `Kurzy aktualizovány před ${diffMin} min`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24) {
      const timeStr = d.toLocaleTimeString("cs-CZ", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `Kurzy aktualizovány dnes v ${timeStr}`;
    }
    const dateStr = d.toLocaleDateString("cs-CZ", {
      day: "numeric",
      month: "short",
    });
    return `Kurzy ze dne ${dateStr}`;
  } catch {
    return "kurzy z cache";
  }
}

/**
 * Načte kešované kurzy z localStorage s fallbackem na výchozí.
 */
export function getCachedExchangeRates(): ExchangeRates {
  const cached = getLocalStorageItem(CACHE_STORAGE_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === "object") {
        return {
          ...DEFAULT_EXCHANGE_RATES,
          ...parsed,
        };
      }
    } catch {
      // Ignorovat poškozenou cache
    }
  }
  return { ...DEFAULT_EXCHANGE_RATES };
}

// Lokální v-paměti držené kurzy inicializované z cache nebo defaults
let activeExchangeRates: ExchangeRates = { ...DEFAULT_EXCHANGE_RATES };
if (typeof window !== "undefined") {
  activeExchangeRates = getCachedExchangeRates();
}

/**
 * Získá aktuálně aktivní směnné kurzy.
 */
export function getActiveExchangeRates(): ExchangeRates {
  return { ...activeExchangeRates };
}

/**
 * Nastaví aktivní kurzy a synchronizuje je do mezipaměti.
 */
export function setActiveExchangeRates(rates: ExchangeRates): void {
  activeExchangeRates = {
    ...DEFAULT_EXCHANGE_RATES,
    ...rates,
  };
  setLocalStorageItem(CACHE_STORAGE_KEY, JSON.stringify(activeExchangeRates));
  saveRatesDate();
}

/**
 * Získá aktuální směnné kurzy vztažené k CZK (1 CZK = X dané měny).
 * Dotáže se na bezplatné API (s automatickým záložním endpointem)
 * a při úspěchu uloží kurzy do localStorage.
 * Pokud síťové volání selže, načte a vrátí kurzy z localStorage či výchozí kurzy.
 */
export async function getExchangeRates(): Promise<ExchangeRates> {
  const apiEndpoints = [
    "https://api.exchangerate-api.com/v4/latest/CZK",
    "https://open.er-api.com/v6/latest/CZK",
  ];

  for (const url of apiEndpoints) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      const rawRates = data?.rates;

      if (rawRates && typeof rawRates === "object") {
        const rates: ExchangeRates = {
          CZK: Number(rawRates.CZK) || 1,
          THB: Number(rawRates.THB) || DEFAULT_EXCHANGE_RATES.THB,
          VND: Number(rawRates.VND) || DEFAULT_EXCHANGE_RATES.VND,
          LAK: Number(rawRates.LAK) || DEFAULT_EXCHANGE_RATES.LAK,
          USD: Number(rawRates.USD) || DEFAULT_EXCHANGE_RATES.USD,
          EUR: Number(rawRates.EUR) || DEFAULT_EXCHANGE_RATES.EUR,
        };

        setActiveExchangeRates(rates);
        return rates;
      }
    } catch (networkError) {
      console.warn(`Chyba při dotazu na kurzové API (${url}):`, networkError);
    }
  }

  // Offline Fallback
  return getCachedExchangeRates();
}

export const fetchExchangeRates = getExchangeRates;

/**
 * Obecný přepočet částky mezi dvěma libovolnými měnami.
 * Kurzy v 'rates' jsou vztaženy k 1 CZK (1 CZK = rates[currency]).
 */
export function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string = "CZK",
  rates?: Record<string, number>
): number {
  if (typeof amount !== "number" || isNaN(amount) || amount === 0) {
    return 0;
  }

  const from = (fromCurrency || "CZK").toUpperCase().trim();
  const to = (toCurrency || "CZK").toUpperCase().trim();

  if (from === to) {
    return Math.round(amount * 100) / 100;
  }

  const effectiveRates: Record<string, number> = {
    ...DEFAULT_EXCHANGE_RATES,
    ...(rates || activeExchangeRates),
  };

  const fromRate = effectiveRates[from];
  const toRate = effectiveRates[to];

  if (!fromRate || !toRate || fromRate <= 0 || toRate <= 0) {
    console.warn(`Nenalezen platný kurz pro měnu: ${from} -> ${to}`);
    return Math.round(amount * 100) / 100;
  }

  // 1 CZK = effectiveRates[currency]
  // Převod ze zdrojové měny na CZK:
  const amountInCZK = from === "CZK" ? amount : amount / fromRate;

  // Převod z CZK na cílovou měnu:
  const result = to === "CZK" ? amountInCZK : amountInCZK * toRate;

  return Math.round(result * 100) / 100;
}

/**
 * UNIFIKOVANÁ FUNKCE pro přepočet částky v libovolné měně do CZK.
 * Jediný zdroj pravdy pro převod do české koruny v celé aplikaci.
 *
 * @param amount Částka v původní měně
 * @param currency Kód původní měny (např. 'THB', 'VND', 'LAK', 'USD', 'EUR', 'CZK')
 * @param rates Volitelné kurzy (pokud nejsou předány, použijí se aktuálně aktivní kurzy)
 * @returns Částka v CZK zaokrouhlená na 2 desetinná místa (nebo celé koruny podle potřeby)
 */
export function convertToCZK(
  amount: number,
  currency: string,
  rates?: Record<string, number>
): number {
  return convertAmount(amount, currency, "CZK", rates);
}

