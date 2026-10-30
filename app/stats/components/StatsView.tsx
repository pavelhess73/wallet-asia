"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Expense, Currency, ExpenseCategory, getCategoryDefinition, ServiceEntry, PaymentMethod } from "@/lib/types";
import {
  fetchExchangeRates,
  convertAmount,
  DEFAULT_EXCHANGE_RATES,
  ExchangeRates,
} from "@/lib/rates";
import { subscribeToServices } from "@/lib/servicesStore";
import {
  ReceiptText,
  BarChart3,
  BookOpen,
  Search,
  Loader2,
  TrendingUp,
  Coins,
  UtensilsCrossed,
  Train,
  Hotel,
  Wine,
  Plane,
  ShoppingCart,
  Tag,
  ArrowLeft,
  CircleDollarSign,
  AlertCircle,
  Wrench,
  Banknote,
  CreditCard,
} from "lucide-react";

export interface CategoryStat {
  name: string;
  totalCZK: number;
  percent: number;
  count: number;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  barColor: string;
}

const CATEGORY_ICONS: Record<ExpenseCategory, React.ComponentType<{ className?: string }>> = {
  Gastro: UtensilsCrossed,
  Doprava: Train,
  Ubytování: Hotel,
  Bar: Wine,
  Zážitky: Plane,
  Nákupy: ShoppingCart,
  Různé: Tag,
};

// Paleta barev pro typy služeb (cyklická)
const SERVICE_CAT_PALETTE = [
  { colorClass: "bg-pink-100 text-pink-600",     barColor: "bg-pink-500"   },
  { colorClass: "bg-blue-100 text-blue-600",     barColor: "bg-blue-500"   },
  { colorClass: "bg-cyan-100 text-cyan-600",     barColor: "bg-cyan-500"   },
  { colorClass: "bg-orange-100 text-orange-600", barColor: "bg-orange-500" },
  { colorClass: "bg-sky-100 text-sky-600",       barColor: "bg-sky-500"    },
  { colorClass: "bg-green-100 text-green-600",   barColor: "bg-green-500"  },
  { colorClass: "bg-violet-100 text-violet-600", barColor: "bg-violet-500" },
  { colorClass: "bg-amber-100 text-amber-600",   barColor: "bg-amber-500"  },
  { colorClass: "bg-teal-100 text-teal-600",     barColor: "bg-teal-500"   },
  { colorClass: "bg-slate-100 text-slate-600",   barColor: "bg-slate-500"  },
];

export default function StatsView() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [services, setServices] = useState<ServiceEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rates, setRates] = useState<ExchangeRates>(DEFAULT_EXCHANGE_RATES);

  // Load exchange rates
  useEffect(() => {
    fetchExchangeRates()
      .then((r) => { if (r) setRates(r); })
      .catch((err) => console.warn("Chyba pri nacitani kurzu:", err));
  }, []);

  // Load services via reactive listener
  useEffect(() => {
    const unsub = subscribeToServices(
      (data) => setServices(data),
      (err) => console.error("services listener (stats):", err)
    );
    return () => unsub();
  }, []);

  // Load expenses via onSnapshot
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
            category: data.category || "Ostatní",
            note: data.note || "",
            merchant: data.merchant || undefined,
            createdAt: data.createdAt || new Date().toISOString(),
            paymentMethod: data.paymentMethod === "card" ? "card" : "cash",
          };
        });

        setExpenses(fetchedExpenses);
        setIsLoading(false);
      },
      (error) => {
        console.error("Chyba při načítání statistik:", error);
        setErrorMessage("Nepodařilo se načíst data z databáze.");
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const formatNumber = (val: number, maxDecimals = 0) =>
    new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: maxDecimals }).format(val);

  // ── Expenses total ──────────────────────────────────────────────────────────
  const totalExpensesCZK = useMemo(
    () => expenses.reduce((acc, curr) => acc + (curr.amountCZK || 0), 0),
    [expenses]
  );

  // ── Services total ──────────────────────────────────────────────────────────
  const totalServicesCZK = useMemo(
    () => services.reduce((acc, s) => acc + convertAmount(s.price, s.currency, "CZK", rates), 0),
    [services, rates]
  );

  // ── Combined total ──────────────────────────────────────────────────────────
  const totalCZK = useMemo(() => totalExpensesCZK + totalServicesCZK, [totalExpensesCZK, totalServicesCZK]);

  // Unique active days – both collections
  const uniqueDaysCount = useMemo(() => {
    const daySet = new Set<string>();
    [...expenses, ...services].forEach((e) => {
      try {
        const d = new Date(e.createdAt);
        if (!isNaN(d.getTime())) daySet.add(d.toISOString().split("T")[0]);
      } catch { /* ignore */ }
    });
    return daySet.size;
  }, [expenses, services]);

  const averageDailyCZK = useMemo(
    () => (uniqueDaysCount === 0 ? 0 : Math.round(totalCZK / uniqueDaysCount)),
    [totalCZK, uniqueDaysCount]
  );

  // ── Expense category stats ──────────────────────────────────────────────────
  const categoryStats: CategoryStat[] = useMemo(() => {
    const map: {
      [name: string]: {
        totalCZK: number;
        count: number;
        icon: React.ComponentType<{ className?: string }>;
        colorClass: string;
        barColor: string;
      };
    } = {};

    expenses.forEach((e) => {
      const def = getCategoryDefinition(e.category);
      const icon = CATEGORY_ICONS[def.id] || Tag;
      if (!map[def.label]) {
        map[def.label] = {
          totalCZK: 0,
          count: 0,
          icon,
          colorClass: def.circleBg,
          barColor: def.barColor,
        };
      }
      map[def.label].totalCZK += e.amountCZK || 0;
      map[def.label].count += 1;
    });

    return Object.entries(map)
      .map(([name, data]) => ({
        name,
        totalCZK: data.totalCZK,
        percent: totalExpensesCZK > 0 ? Math.round((data.totalCZK / totalExpensesCZK) * 100) : 0,
        count: data.count,
        icon: data.icon,
        colorClass: data.colorClass,
        barColor: data.barColor,
      }))
      .sort((a, b) => b.totalCZK - a.totalCZK);
  }, [expenses, totalExpensesCZK]);

  // ── Service category stats ──────────────────────────────────────────────────
  const serviceCategoryStats = useMemo(() => {
    const map: Record<string, { totalCZK: number; count: number; paletteIdx: number }> = {};
    let catIndex = 0;
    const catOrder: string[] = [];

    services.forEach((s) => {
      const czk = convertAmount(s.price, s.currency, "CZK", rates);
      if (!map[s.category]) {
        map[s.category] = { totalCZK: 0, count: 0, paletteIdx: catIndex % SERVICE_CAT_PALETTE.length };
        catOrder.push(s.category);
        catIndex++;
      }
      map[s.category].totalCZK += czk;
      map[s.category].count += 1;
    });

    return catOrder
      .map((name) => ({
        name,
        totalCZK: map[name].totalCZK,
        percent: totalServicesCZK > 0 ? Math.round((map[name].totalCZK / totalServicesCZK) * 100) : 0,
        count: map[name].count,
        ...SERVICE_CAT_PALETTE[map[name].paletteIdx],
      }))
      .sort((a, b) => b.totalCZK - a.totalCZK);
  }, [services, rates, totalServicesCZK]);

  // ── Combined currency breakdown ─────────────────────────────────────────────
  const currencyTotals = useMemo(() => {
    const targetCurrencies: Currency[] = ["THB", "VND", "LAK", "USD", "EUR", "CZK"];
    const sums: Record<Currency, number> = { THB: 0, VND: 0, LAK: 0, USD: 0, EUR: 0, CZK: 0 };
    // Expenses – original amounts
    expenses.forEach((e) => {
      if (sums[e.currency] !== undefined) sums[e.currency] += e.amountOriginal || 0;
    });
    // Services – original amounts
    services.forEach((s) => {
      const cur = s.currency as Currency;
      if (sums[cur] !== undefined) sums[cur] += s.price || 0;
    });
    return targetCurrencies.map((curr) => ({ currency: curr, total: sums[curr] }));
  }, [expenses, services]);

  // ── Payment method stats (Hotovost vs. Karta) ──────────────────────────────
  const paymentMethodStats = useMemo(() => {
    let cashCZK = 0;
    let cashCount = 0;
    let cardCZK = 0;
    let cardCount = 0;

    expenses.forEach((e) => {
      const czk = e.amountCZK || 0;
      if (e.paymentMethod === "card") {
        cardCZK += czk;
        cardCount += 1;
      } else {
        cashCZK += czk;
        cashCount += 1;
      }
    });

    services.forEach((s) => {
      const czk = convertAmount(s.price, s.currency, "CZK", rates);
      if (s.paymentMethod === "card") {
        cardCZK += czk;
        cardCount += 1;
      } else {
        cashCZK += czk;
        cashCount += 1;
      }
    });

    const sumCZK = cashCZK + cardCZK;
    const cashPercent = sumCZK > 0 ? Math.round((cashCZK / sumCZK) * 100) : 0;
    const cardPercent = sumCZK > 0 ? Math.round((cardCZK / sumCZK) * 100) : 0;

    return {
      cash: {
        totalCZK: cashCZK,
        count: cashCount,
        percent: cashPercent,
      },
      card: {
        totalCZK: cardCZK,
        count: cardCount,
        percent: cardPercent,
      },
      totalCZK: sumCZK,
      totalCount: cashCount + cardCount,
    };
  }, [expenses, services, rates]);

  return (
    <div className="min-h-screen bg-[#F8F6F4] text-slate-800 antialiased selection:bg-rose-500/20 pb-28">
      <main className="max-w-md mx-auto px-4 pt-6 flex flex-col gap-5 sm:max-w-lg">
        {/* HLAVIČKA */}
        <header className="flex flex-col gap-1 pt-2">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-500 hover:text-rose-600 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Zpět na výdaje</span>
            </Link>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200/60">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Statistiky
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 mt-1">
            Přehled statistik
          </h1>
          <p className="text-xs text-slate-500">
            Detailní rozbor výdajů z výletu Thajsko, Laos, Vietnam
          </p>
        </header>

        {/* CHYBOVÁ HLÁŠKA */}
        {errorMessage && (
          <div className="flex items-start gap-2.5 rounded-2xl bg-rose-50 border border-rose-200 p-3.5 text-rose-800 text-xs">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
          </div>
        )}

        {/* SOUHRNNÉ KARTY – kombinované výdaje + služby */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Celkem</span>
              <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                <Coins className="h-3.5 w-3.5" />
              </div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {formatNumber(totalCZK)}{" "}
                <span className="text-xs font-semibold text-slate-400">Kč</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                {expenses.length} výdajů + {services.length} služeb
              </p>
              {totalServicesCZK > 0 && (
                <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                  Z toho služby: {formatNumber(totalServicesCZK)} Kč
                </p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-500">Denní průměr</span>
              <div className="h-7 w-7 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">
                <TrendingUp className="h-3.5 w-3.5" />
              </div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-rose-600 tracking-tight">
                {formatNumber(averageDailyCZK)}{" "}
                <span className="text-xs font-semibold text-rose-400">Kč / den</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                Za {uniqueDaysCount}{" "}
                {uniqueDaysCount === 1 ? "aktivní den" : uniqueDaysCount < 5 ? "aktivní dny" : "aktivních dnů"}
              </p>
            </div>
          </div>
        </div>

        {/* PŘEHLED PODLE KATEGORIÍ */}
        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Výdaje podle kategorií
            </h2>
            <span className="text-[11px] text-slate-400">Seřazeno sestupně</span>
          </div>

          {isLoading ? (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-rose-500 mb-2" />
              <p className="text-xs font-medium">Počítám statistiky...</p>
            </div>
          ) : categoryStats.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 text-center text-slate-400 text-xs">
              Zatím žádná data pro zobrazení statistik
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 flex flex-col gap-4">
              {categoryStats.map((item) => {
                const IconComp = item.icon;
                return (
                  <div key={item.name} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${item.colorClass}`}>
                          <IconComp className="h-4 w-4 stroke-[2.2]" />
                        </div>
                        <div className="truncate">
                          <span className="font-bold text-slate-900">{item.name}</span>
                          <span className="text-slate-400 text-[11px] ml-1.5">({item.count}×)</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-black text-slate-900 tracking-tight">
                          {formatNumber(item.totalCZK)} Kč
                        </span>
                        <span className="text-slate-400 font-semibold text-xs ml-1.5">
                          {item.percent}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full ${item.barColor} rounded-full transition-all duration-700 ease-out`}
                        style={{ width: `${Math.max(item.percent, 3)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ZPŮSOB PLATBY (HOTOVOST VS. KARTA) */}
        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5 text-slate-400" />
              <span>Způsob platby</span>
            </h2>
            <span className="text-[11px] text-slate-400">Výdaje + služby</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Hotovost Card */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Hotovost</span>
                  <div className="h-7 w-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Banknote className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {formatNumber(paymentMethodStats.cash.totalCZK)}{" "}
                  <span className="text-xs font-semibold text-slate-400">Kč</span>
                </div>
                <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400 font-medium">
                  <span>{paymentMethodStats.cash.count} položek</span>
                  <span className="font-bold text-emerald-600">{paymentMethodStats.cash.percent}%</span>
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden mt-3">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${Math.max(paymentMethodStats.cash.percent, paymentMethodStats.cash.totalCZK > 0 ? 4 : 0)}%` }}
                />
              </div>
            </div>

            {/* Karta Card */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Karta</span>
                  <div className="h-7 w-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                    <CreditCard className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {formatNumber(paymentMethodStats.card.totalCZK)}{" "}
                  <span className="text-xs font-semibold text-slate-400">Kč</span>
                </div>
                <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400 font-medium">
                  <span>{paymentMethodStats.card.count} položek</span>
                  <span className="font-bold text-blue-600">{paymentMethodStats.card.percent}%</span>
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden mt-3">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${Math.max(paymentMethodStats.card.percent, paymentMethodStats.card.totalCZK > 0 ? 4 : 0)}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* SLUŽBY PODLE TYPŮ */}
        {services.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5 text-slate-400" />
                <span>Služby podle typů</span>
              </h2>
              <span className="text-[11px] text-slate-400">
                {services.length} záznamů · {formatNumber(totalServicesCZK)} Kč
              </span>
            </div>

            {serviceCategoryStats.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 text-center text-slate-400 text-xs">
                Žádné záznamy služeb
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 flex flex-col gap-4">
                {serviceCategoryStats.map((item) => (
                  <div key={item.name} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${item.colorClass}`}>
                          <Wrench className="h-4 w-4 stroke-[2]" />
                        </div>
                        <div className="truncate">
                          <span className="font-bold text-slate-900">{item.name}</span>
                          <span className="text-slate-400 text-[11px] ml-1.5">({item.count}×)</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-black text-slate-900 tracking-tight">
                          {formatNumber(item.totalCZK)} Kč
                        </span>
                        <span className="text-slate-400 font-semibold text-xs ml-1.5">
                          {item.percent}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full ${item.barColor} rounded-full transition-all duration-700 ease-out`}
                        style={{ width: `${Math.max(item.percent, 3)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ROZPAD PODLE MĚN – výdaje + služby */}
        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <CircleDollarSign className="h-3.5 w-3.5 text-slate-400" />
              <span>Rozpad podle původních měn</span>
            </h2>
            <span className="text-[11px] text-slate-400">Výdaje + služby</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {currencyTotals.map(({ currency, total }) => {
              const meta: Record<Currency, { flag: string; symbol: string }> = {
                THB: { flag: "🇹🇭", symbol: "฿" },
                VND: { flag: "🇻🇳", symbol: "₫" },
                LAK: { flag: "🇱🇦", symbol: "₭" },
                USD: { flag: "🇺🇸", symbol: "$" },
                EUR: { flag: "🇪🇺", symbol: "€" },
                CZK: { flag: "🇨🇿", symbol: "Kč" },
              };
              const info = meta[currency];
              return (
                <div
                  key={currency}
                  className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100 flex flex-col justify-between gap-1"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-500 flex items-center gap-1">
                      <span>{info.flag}</span>
                      <span>{currency}</span>
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">{info.symbol}</span>
                  </div>
                  <div className="text-base sm:text-lg font-black text-slate-900 tracking-tight mt-1 truncate">
                    {formatNumber(total, currency === "USD" ? 2 : 0)}{" "}
                    <span className="text-xs font-semibold text-slate-400">{currency}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* SPODNÍ NAVIGAČNÍ LIŠTA */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-lg">
        <div className="max-w-md mx-auto sm:max-w-lg px-6 py-2.5 flex items-center justify-between">
          <Link href="/" className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-slate-600 transition-colors">
            <ReceiptText className="h-5 w-5" />
            <span className="text-[10px]">Entries</span>
          </Link>
          <Link href="/stats" className="flex flex-col items-center gap-0.5 text-rose-600 font-bold transition-colors">
            <BarChart3 className="h-5 w-5 stroke-[2.3]" />
            <span className="text-[10px]">Stats</span>
          </Link>
          <Link href="/services" className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-slate-600 transition-colors">
            <BookOpen className="h-5 w-5" />
            <span className="text-[10px]">Služby</span>
          </Link>
          <Link href="/search" className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-rose-600 transition-colors">
            <Search className="h-5 w-5" />
            <span className="text-[10px]">Search</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
