/**
 * Jednotné formátovací funkce pro čísla, měny a datumy napříč aplikací Asia Travel Wallet.
 */

/**
 * Formátuje číslo v českém formátu s mezerou jako oddělovačem tisíců.
 *
 * @param amount Číslo k formátování
 * @param maxDecimals Maximální počet desetinných míst (výchozí 0)
 * @returns Např. "12 500" nebo "12,50"
 */
export function formatNumber(amount: number, maxDecimals: number = 0): string {
  if (typeof amount !== "number" || isNaN(amount)) {
    return "0";
  }

  const formatted = new Intl.NumberFormat("cs-CZ", {
    maximumFractionDigits: maxDecimals,
    minimumFractionDigits: 0,
  }).format(amount);

  // Nahradit nezlomitelné a úzké mezery standardní mezerou
  return formatted.replace(/[\u00A0\u202F]/g, " ");
}

/**
 * Formátuje částku v CZK do tvaru "12 500 Kč" s mezerou jako oddělovačem tisíců.
 *
 * @param amount Částka v CZK
 * @returns Např. "12 500 Kč"
 */
export function formatCZK(amount: number): string {
  if (typeof amount !== "number" || isNaN(amount)) {
    return "0 Kč";
  }

  return `${formatNumber(Math.round(amount), 0)} Kč`;
}

/**
 * Formátuje částku v cizí měně (např. THB, VND, LAK, USD, EUR) nebo CZK.
 *
 * @param amount Částka k formátování
 * @param currency Měnový kód (např. "THB", "VND", "LAK", "USD", "EUR", "CZK")
 * @param options Volitelné nastavení (compact: true zkrátí VND/LAK nad 1000 na "150k VND")
 * @returns Např. "80 THB", "150 000 VND", "150k VND", "25,50 USD", "12 500 Kč"
 */
export function formatCurrency(
  amount: number,
  currency: string,
  options?: { compact?: boolean }
): string {
  if (typeof amount !== "number" || isNaN(amount)) {
    return `0 ${currency || "CZK"}`;
  }

  const curr = (currency || "CZK").toUpperCase().trim();

  if (curr === "CZK") {
    return formatCZK(amount);
  }

  if (options?.compact && (curr === "VND" || curr === "LAK") && amount >= 1000) {
    const k = amount / 1000;
    const rounded = k % 1 === 0 ? k.toFixed(0) : k.toFixed(1);
    return `${rounded}k ${curr}`;
  }

  const decimals = curr === "USD" || curr === "EUR" ? 2 : 0;
  return `${formatNumber(amount, decimals)} ${curr}`;
}

/**
 * Formátuje datum do standardního českého tvaru (např. "11. 10. 2026").
 *
 * @param dateInput ISO řetězec, Date objekt nebo timestamp
 * @returns Např. "11. 10. 2026"
 */
export function formatDateCzech(dateInput: string | Date | number): string {
  try {
    const d = typeof dateInput === "object" ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) {
      return String(dateInput);
    }

    return new Intl.DateTimeFormat("cs-CZ", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
    })
      .format(d)
      .replace(/[\u00A0\u202F]/g, " ");
  } catch {
    return String(dateInput);
  }
}

/**
 * Formátuje datum relativně pro denní feedy výdajů:
 * - Dnes: "Dnes • 11. října"
 * - Včera: "Včera • 10. října"
 * - Ostatní dny: "9. října" (či "9. října 2025" při jiném roce)
 *
 * @param dateInput ISO řetězec, Date objekt nebo timestamp
 * @returns Relativní český text data
 */
export function formatRelativeDateCzech(dateInput: string | Date | number): string {
  try {
    const d = typeof dateInput === "object" ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) {
      return String(dateInput);
    }

    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    const formattedDayMonth = new Intl.DateTimeFormat("cs-CZ", {
      day: "numeric",
      month: "long",
      ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
    })
      .format(d)
      .replace(/[\u00A0\u202F]/g, " ");

    if (isToday) {
      return `Dnes • ${formattedDayMonth}`;
    }
    if (isYesterday) {
      return `Včera • ${formattedDayMonth}`;
    }

    return formattedDayMonth;
  } catch {
    return String(dateInput);
  }
}

