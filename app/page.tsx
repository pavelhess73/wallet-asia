"use client";

import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Currency,
  Expense,
  CURRENCIES,
  EXPENSE_CATEGORIES,
} from "@/lib/types";
import {
  Wallet,
  Receipt,
  MapPin,
  Calendar,
  Sparkles,
  Loader2,
  Plus,
  Coins,
  Store,
  Tag,
  AlertCircle,
} from "lucide-react";

// Orientační kurzy: 1000 VND = 0.95 CZK, 1 THB = 0.68 CZK, 1000 LAK = 1.1 CZK, 1 USD = 23 CZK, 1 CZK = 1 CZK
const EXCHANGE_RATES: Record<Currency, number> = {
  VND: 0.95 / 1000,
  THB: 0.68,
  LAK: 1.1 / 1000,
  USD: 23,
  CZK: 1,
};

const CURRENCY_FLAGS: Record<Currency, string> = {
  VND: "🇻🇳 VND",
  THB: "🇹🇭 THB",
  LAK: "🇱🇦 LAK",
  USD: "🇺🇸 USD",
  CZK: "🇨🇿 CZK",
};

export default function AsiaTravelWallet() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states
  const [amountOriginal, setAmountOriginal] = useState<string>("");
  const [currency, setCurrency] = useState<Currency>("VND");
  const [note, setNote] = useState<string>("");
  const [merchant, setMerchant] = useState<string>("");
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);

  // Real-time listener pro kolekci expenses seřazenou podle createdAt sestupně
  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(db, "expenses"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedExpenses: Expense[] = snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data();
          return {
            id: docSnapshot.id,
            amountOriginal: Number(data.amountOriginal) || 0,
            currency: (data.currency as Currency) || "CZK",
            amountCZK: Number(data.amountCZK) || 0,
            category: data.category || "🛒 Ostatní",
            note: data.note || "",
            merchant: data.merchant || undefined,
            createdAt: data.createdAt || new Date().toISOString(),
          };
        });

        setExpenses(fetchedExpenses);
        setIsLoading(false);
      },
      (error) => {
        console.error("Chyba při načítání výdajů:", error);
        setErrorMessage("Nepodařilo se načíst výdaje z databáze.");
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Živý orientační přepočet na CZK pro náhled
  const previewAmountCZK = amountOriginal && !isNaN(Number(amountOriginal))
    ? Math.round(Number(amountOriginal) * (EXCHANGE_RATES[currency] ?? 1) * 100) / 100
    : 0;

  // Celkový součet v CZK
  const totalCZK = expenses.reduce((acc, curr) => acc + (curr.amountCZK || 0), 0);

  // Odeslání formuláře
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const numericAmount = parseFloat(amountOriginal);
    if (!amountOriginal || isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMessage("Zadejte platnou částku vyšší než 0.");
      return;
    }

    if (!note.trim()) {
      setErrorMessage("Zadejte popis výdaje.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const rate = EXCHANGE_RATES[currency] ?? 1;
      const calculatedCZK = Math.round(numericAmount * rate * 100) / 100;

      const expensePayload: Record<string, unknown> = {
        amountOriginal: numericAmount,
        currency,
        amountCZK: calculatedCZK,
        category,
        note: note.trim(),
        createdAt: new Date().toISOString(),
      };

      if (merchant.trim()) {
        expensePayload.merchant = merchant.trim();
      }

      await addDoc(collection(db, "expenses"), expensePayload);

      // Vyčištění formuláře
      setAmountOriginal("");
      setNote("");
      setMerchant("");
    } catch (error) {
      console.error("Chyba při ukládání výdaje:", error);
      setErrorMessage("Chyba při ukládání do Firestore. Zkontrolujte připojení.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatNumber = (val: number, maxDecimals = 2) => {
    return new Intl.NumberFormat("cs-CZ", {
      maximumFractionDigits: maxDecimals,
    }).format(val);
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat("cs-CZ", {
        day: "numeric",
        month: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
    } catch {
      return isoString;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-zinc-950 text-slate-100 antialiased selection:bg-emerald-500/30">
      {/* Horní dekorativní záře */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-emerald-500/10 blur-[120px] rounded-full" />
        <div className="absolute top-96 -right-20 w-[400px] h-[300px] bg-cyan-500/10 blur-[130px] rounded-full" />
      </div>

      <div className="relative mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12 flex flex-col gap-8">
        {/* HLAVIČKA S CELKOVÝM SOUČTEM */}
        <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/20">
                <Wallet className="h-6 w-6 stroke-[2.2]" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  Asia Travel Wallet
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium border border-emerald-500/30">
                    Online
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-400">
                  Přehled cestovních výdajů v reálném čase
                </p>
              </div>
            </div>
          </div>

          {/* Karta celkové útraty */}
          <div className="mt-4 pt-5 border-t border-white/5 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
                <Coins className="h-3.5 w-3.5 text-emerald-400" />
                Celkem utraceno (orientačně v CZK)
              </span>
              <div className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300">
                {formatNumber(totalCZK)} <span className="text-xl sm:text-2xl text-emerald-400">Kč</span>
              </div>
            </div>
            <div className="text-xs text-slate-400 font-medium">
              Celkem záznamů: <span className="text-white font-semibold">{expenses.length}</span>
            </div>
          </div>
        </header>

        {/* Chybová hláška */}
        {errorMessage && (
          <div className="flex items-center gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-300 backdrop-blur-md">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
            <span className="text-sm">{errorMessage}</span>
          </div>
        )}

        {/* FORMULÁŘ PRO ZADÁNÍ VÝDAJE */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-7 backdrop-blur-xl shadow-xl">
          <div className="flex items-center gap-2 mb-6">
            <Plus className="h-5 w-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Zadat nový výdaj</h2>
          </div>

          <form onSubmit={handleManualSubmit} className="flex flex-col gap-5">
            {/* Částka & Měna */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Částka <span className="text-emerald-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    placeholder="Např. 120000"
                    value={amountOriginal}
                    onChange={(e) => setAmountOriginal(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-base text-white placeholder-slate-500 outline-none transition focus:border-emerald-500/50 focus:bg-white/[0.08] focus:ring-2 focus:ring-emerald-500/20"
                  />
                  {previewAmountCZK > 0 && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-1 rounded-lg">
                      ≈ {formatNumber(previewAmountCZK)} Kč
                    </div>
                  )}
                </div>
              </div>

              {/* Měna */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Měna <span className="text-emerald-400">*</span>
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-3 gap-1 p-1 rounded-2xl border border-white/10 bg-white/[0.03]">
                  {CURRENCIES.map((curr) => (
                    <button
                      type="button"
                      key={curr}
                      onClick={() => setCurrency(curr)}
                      className={`py-2 px-2 text-xs font-semibold rounded-xl transition-all ${
                        currency === curr
                          ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30 scale-[1.02]"
                          : "text-slate-300 hover:text-white hover:bg-white/[0.05]"
                      }`}
                    >
                      {curr}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Popis výdaje */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Popis <span className="text-emerald-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="Např. Bún chả na ulici, lístek na vlak..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-emerald-500/50 focus:bg-white/[0.08] focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>

            {/* Podnik / Místo */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Podnik / Místo <span className="text-slate-500">(volitelné)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Store className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  placeholder="Např. 7-Eleven, Hanoi Old Quarter Coffee..."
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.05] pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-emerald-500/50 focus:bg-white/[0.08] focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>

            {/* Kategorie */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Kategorie <span className="text-emerald-400">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {EXPENSE_CATEGORIES.map((cat) => (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`py-2.5 px-3 rounded-2xl text-xs sm:text-sm font-medium border text-left transition-all flex items-center justify-between ${
                      category === cat
                        ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-sm shadow-emerald-500/20 ring-1 ring-emerald-500/40"
                        : "bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    <span>{cat}</span>
                    {category === cat && (
                      <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0 ml-1" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Tlačítko Odeslat */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 px-6 py-3.5 text-base font-bold text-slate-950 shadow-lg shadow-emerald-500/25 transition-all hover:opacity-95 hover:shadow-emerald-500/40 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Ukládám do Firestore...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  <span>Přidat výdaj</span>
                </>
              )}
            </button>
          </form>
        </section>

        {/* SEZNAM VÝDAJŮ */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">Poslední výdaje</h2>
            </div>
            <span className="text-xs text-slate-400">
              Seřazeno od nejnovějších
            </span>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-white/5 bg-white/[0.02] py-16 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-400 mb-3" />
              <p className="text-sm">Načítám výdaje z Firestore...</p>
            </div>
          ) : expenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/[0.02] py-16 text-center text-slate-400 px-4">
              <Receipt className="h-10 w-10 text-slate-600 mb-3" />
              <p className="text-base font-medium text-slate-300">Zatím žádné výdaje</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Použij formulář výše k zapsání prvního nákupu, jídla nebo lístku v Asii.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {expenses.map((expense) => (
                <article
                  key={expense.id ?? `${expense.createdAt}-${expense.note}`}
                  className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 backdrop-blur-md transition-all hover:bg-white/[0.06] hover:border-white/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Horní řádek: Kategorie & Datum */}
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                          <Tag className="h-3 w-3" />
                          {expense.category}
                        </span>

                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                          <Calendar className="h-3 w-3" />
                          {formatDate(expense.createdAt)}
                        </span>
                      </div>

                      {/* Popis */}
                      <h3 className="text-base font-semibold text-white tracking-tight break-words">
                        {expense.note}
                      </h3>

                      {/* Podnik / Místo */}
                      {expense.merchant && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                          <MapPin className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate">{expense.merchant}</span>
                        </p>
                      )}
                    </div>

                    {/* Částky */}
                    <div className="text-right shrink-0 flex flex-col items-end">
                      <div className="text-lg font-bold text-white tracking-tight">
                        {formatNumber(expense.amountCZK)} <span className="text-xs text-emerald-400">Kč</span>
                      </div>
                      <div className="text-xs text-slate-400 font-medium">
                        {formatNumber(expense.amountOriginal)} {expense.currency}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
