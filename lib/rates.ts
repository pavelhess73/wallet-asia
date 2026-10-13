/**
 * Správa a kešování směnných kurzů pro Asia Travel Wallet
 */

export const CACHE_STORAGE_KEY = "cached_exchange_rates";

export const SUPPORTED_CURRENCIES = [
  "THB",
  "VND",
  "LAK",
  "USD",
  "EUR",
  "CZK",
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export type ExchangeRates = Record<string, number>;

/**
 * Pevně nastavené výchozí kurzy vztažené k 1 CZK (1 CZK = X dané měny)
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

/**
 * Získá aktuální směnné kurzy vztažené k CZK (1 CZK = X dané měny).
 * Dotáže se na bezplatné API (s automatickým záložním endpointem)
 * a při úspěchu uloží kurzy do localStorage pod klíčem 'cached_exchange_rates'.
 * Pokud síťové volání selže, načte a vrátí kurzy z localStorage.
 * Pokud v paměti nic není, použije pevně nastavené výchozí kurzy.
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

        // Offline Fallback: Uložení do localStorage
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(
              CACHE_STORAGE_KEY,
              JSON.stringify(rates)
            );
          } catch (storageError) {
            console.warn("Nepodařilo se uložit kurzy do localStorage:", storageError);
          }
        }

        return rates;
      }
    } catch (networkError) {
      console.warn(`Chyba při dotazu na kurzové API (${url}):`, networkError);
      // Pokračujeme na další záložní endpoint
    }
  }

  // 1. Offline Fallback: Načtení z localStorage
  if (typeof window !== "undefined") {
    try {
      const cached = window.localStorage.getItem(CACHE_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === "object") {
          return {
            ...DEFAULT_EXCHANGE_RATES,
            ...parsed,
          };
        }
      }
    } catch (cacheError) {
      console.warn("Nepodařilo se načíst kešované kurzy z localStorage:", cacheError);
    }
  }

  // 2. Offline Fallback: Pevně nastavené výchozí kurzy
  return { ...DEFAULT_EXCHANGE_RATES };
}

export const fetchExchangeRates = getExchangeRates;

/**
 * Pomocná funkce pro spolehlivý přepočet částky mezi měnami.
 * Kurzy v 'rates' jsou vztaženy k CZK (1 CZK = rates[currency]).
 *
 * @param amount Částka k převodu
 * @param fromCurrency Zdrojová měna (např. 'THB', 'VND', 'USD', 'EUR')
 * @param toCurrency Cílová měna (výchozí 'CZK')
 * @param rates Objekt se směnnými kurzy
 * @returns Přepočtená částka zaokrouhlená na 2 desetinná místa
 */
export function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string = "CZK",
  rates: Record<string, number> = DEFAULT_EXCHANGE_RATES
): number {
  if (typeof amount !== "number" || isNaN(amount) || amount === 0) {
    return 0;
  }

  const from = fromCurrency.toUpperCase().trim();
  const to = toCurrency.toUpperCase().trim();

  if (from === to) {
    return Math.round(amount * 100) / 100;
  }

  const effectiveRates = {
    ...DEFAULT_EXCHANGE_RATES,
    ...rates,
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
