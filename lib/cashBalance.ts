import { CashWithdrawal, Expense, ServiceEntry } from "@/lib/types";

/**
 * Struktura pro přehled o hotovostním zůstatku jedné měny.
 */
export interface CurrencyCashBalance {
  currency: string;
  totalWithdrawn: number;    // Celková dotace hotovosti (suma targetAmount z výběrů/směn)
  totalSpent: number;        // Celková útrata v hotovosti (expenses + services kde paymentMethod === 'cash')
  balance: number;           // Aktuální zůstatek v peněžence: Dotace − Hotovostní útrata
  withdrawalCount: number;   // Počet evidovaných výběrů/směn
  cashExpensesCount: number; // Počet hotovostních výdajů
  cashServicesCount: number; // Počet hotovostních služeb
  status: "healthy" | "low" | "negative"; // Stav hotovosti pro barevné odlišení
}

/**
 * Pomocná funkce určující, zda je platba hotovostní.
 * Podporuje explicitní 'cash' i implicitní hotovost (pokud není označeno jako 'card').
 */
export function isCashPayment(paymentMethod?: string | null): boolean {
  if (!paymentMethod) return true;
  return paymentMethod.toLowerCase() === "cash";
}

/**
 * Normalizuje kód měny na velká písmena bez mezer.
 */
function normCur(c?: string | null): string {
  return (c || "").toUpperCase().trim();
}

/**
 * Spočítá stav hotovosti pro konkrétní zadanou měnu.
 *
 * - Celková dotace hotovosti: Suma targetAmount ze všech cash_withdrawals dané měny.
 * - Celková útrata v hotovosti: Suma částek z expenses a services, kde paymentMethod === 'cash' a shoduje se měna.
 * - Aktuální zůstatek v peněžence: Dotace − Hotovostní útrata.
 */
export function calculateCashBalanceForCurrency(
  currency: string,
  withdrawals: CashWithdrawal[],
  expenses: Expense[],
  services: ServiceEntry[] = []
): CurrencyCashBalance {
  const targetCur = normCur(currency);

  // 1. Celková dotace hotovosti (Suma targetAmount ze všech cash_withdrawals dané měny)
  let totalWithdrawn = 0;
  let withdrawalCount = 0;

  for (const w of withdrawals) {
    if (normCur(w.targetCurrency) === targetCur) {
      totalWithdrawn += Number(w.targetAmount) || 0;
      withdrawalCount += 1;
    }
  }

  // 2. Celková útrata v hotovosti (expenses + services kde paymentMethod === 'cash' a shoduje se měna)
  let totalSpent = 0;
  let cashExpensesCount = 0;
  let cashServicesCount = 0;

  for (const exp of expenses) {
    if (normCur(exp.currency) === targetCur && isCashPayment(exp.paymentMethod)) {
      totalSpent += Number(exp.amountOriginal) || 0;
      cashExpensesCount += 1;
    }
  }

  for (const s of services) {
    if (normCur(s.currency) === targetCur && isCashPayment(s.paymentMethod)) {
      totalSpent += Number(s.price) || 0;
      cashServicesCount += 1;
    }
  }

  // 3. Aktuální zůstatek v peněžence
  const balance = totalWithdrawn - totalSpent;

  // 4. Určení stavu pro barevné odlišení:
  // - negative: zůstatek je záporný (přečerpáno nebo nezaevidovaný výběr)
  // - low: zbývá méně než 20 % vybrané hotovosti nebo zbývá méně než definovaný minimální limit
  // - healthy: dostatek hotovosti (zelená)
  let status: "healthy" | "low" | "negative" = "healthy";

  if (balance < 0) {
    status = "negative";
  } else if (totalWithdrawn > 0 && balance / totalWithdrawn <= 0.2) {
    status = "low";
  } else if (totalWithdrawn === 0 && totalSpent > 0) {
    status = "negative";
  }

  return {
    currency: targetCur,
    totalWithdrawn,
    totalSpent,
    balance,
    withdrawalCount,
    cashExpensesCount,
    cashServicesCount,
    status,
  };
}

/**
 * Vrátí seznam všech aktivních měn, které mají buď zaevidovaný výběr/směnu,
 * nebo hotovostní útratu.
 */
export function getActiveCashCurrencies(
  withdrawals: CashWithdrawal[],
  expenses: Expense[],
  services: ServiceEntry[] = []
): string[] {
  const currencies = new Set<string>();

  for (const w of withdrawals) {
    if (w.targetCurrency) {
      currencies.add(normCur(w.targetCurrency));
    }
  }

  for (const e of expenses) {
    if (isCashPayment(e.paymentMethod) && e.currency) {
      currencies.add(normCur(e.currency));
    }
  }

  for (const s of services) {
    if (isCashPayment(s.paymentMethod) && s.currency) {
      currencies.add(normCur(s.currency));
    }
  }

  // Standardní priorita populárních měn v aplikaci
  const preferredOrder = ["THB", "VND", "LAK", "USD", "EUR", "CZK"];
  const list = Array.from(currencies);

  return list.sort((a, b) => {
    const idxA = preferredOrder.indexOf(a);
    const idxB = preferredOrder.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });
}

/**
 * Spočítá stav hotovosti pro všechny aktivní měny.
 */
export function calculateCashBalances(
  withdrawals: CashWithdrawal[],
  expenses: Expense[],
  services: ServiceEntry[] = []
): Record<string, CurrencyCashBalance> {
  const activeCurrencies = getActiveCashCurrencies(withdrawals, expenses, services);
  const result: Record<string, CurrencyCashBalance> = {};

  for (const cur of activeCurrencies) {
    result[cur] = calculateCashBalanceForCurrency(cur, withdrawals, expenses, services);
  }

  return result;
}
