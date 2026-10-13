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
import { Expense, Currency } from "@/lib/types";
import {
  ReceiptText,
  BarChart3,
  Map,
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

function resolveStandardCategory(rawCategory: string): {
  groupName: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  barColor: string;
} {
  const norm = (rawCategory || "").toLowerCase();

  if (
    norm.includes("gastro") ||
    norm.includes("jídlo") ||
    norm.includes("jidlo") ||
    norm.includes("restaurant") ||
    norm.includes("oběd") ||
    norm.includes("večeře")
  ) {
    return { groupName: "Gastro", icon: UtensilsCrossed, colorClass: "bg-rose-100 text-rose-600", barColor: "bg-rose-500" };
  }
  if (
    norm.includes("doprav") || norm.includes("transport") ||
    norm.includes("vlak") || norm.includes("taxi") ||
    norm.includes("grab") || norm.includes("autobus")
  ) {
    return { groupName: "Doprava", icon: Train, colorClass: "bg-orange-100 text-orange-600", barColor: "bg-orange-500" };
  }
  if (
    norm.includes("ubytov") || norm.includes("accommodat") ||
    norm.includes("hotel") || norm.includes("hostel") || norm.includes("airbnb")
  ) {
    return { groupName: "Ubytování", icon: Hotel, colorClass: "bg-blue-100 text-blue-600", barColor: "bg-blue-500" };
  }
  if (
    norm.includes("bar") || norm.includes("pivo") ||
    norm.includes("drink") || norm.includes("alkohol") || norm.includes("koktejl")
  ) {
    return { groupName: "Bar & Pivo", icon: Wine, colorClass: "bg-purple-100 text-purple-600", barColor: "bg-purple-500" };
  }
  if (
    norm.includes("zážit") || norm.includes("zazit") ||
    norm.includes("flight") || norm.includes("letenk") ||
    norm.includes("let") || norm.includes("výlet") || norm.includes("vstup")
  ) {
    return { groupName: "Zážitky & Lety", icon: Plane, colorClass: "bg-sky-100 text-sky-600", barColor: "bg-sky-500" };
  }
  if (
    norm.includes("coffee") || norm.includes("káv") || norm.includes("kav") ||
    norm.includes("grocer") || norm.includes("nákup") ||
    norm.includes("market") || norm.includes("7-eleven")
  ) {
    return { groupName: "Nákupy & Káva", icon: ShoppingCart, colorClass: "bg-emerald-100 text-emerald-600", barColor: "bg-emerald-500" };
  }

  return { groupName: "Ostatní", icon: Tag, colorClass: "bg-slate-100 text-slate-600", barColor: "bg-slate-500" };
}

export default function StatsView() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const totalCZK = useMemo(
    () => expenses.reduce((acc, curr) => acc + (curr.amountCZK || 0), 0),
    [expenses]
  );

  const uniqueDaysCount = useMemo(() => {
    const daySet = new Set<string>();
    expenses.forEach((e) => {
      try {
        const d = new Date(e.createdAt);
        if (!isNaN(d.getTime())) daySet.add(d.toISOString().split("T")[0]);
      } catch { /* ignore */ }
    });
    return daySet.size;
  }, [expenses]);

  const averageDailyCZK = useMemo(
    () => (uniqueDaysCount === 0 ? 0 : Math.round(totalCZK / uniqueDaysCount)),
    [totalCZK, uniqueDaysCount]
  );

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
      const { groupName, icon, colorClass, barColor } = resolveStandardCategory(e.category);
      if (!map[groupName]) {
        map[groupName] = { totalCZK: 0, count: 0, icon, colorClass, barColor };
      }
      map[groupName].totalCZK += e.amountCZK || 0;
      map[groupName].count += 1;
    });

    return Object.entries(map)
      .map(([name, data]) => ({
        name,
        totalCZK: data.totalCZK,
        percent: totalCZK > 0 ? Math.round((data.totalCZK / totalCZK) * 100) : 0,
        count: data.count,
        icon: data.icon,
        colorClass: data.colorClass,
        barColor: data.barColor,
      }))
      .sort((a, b) => b.totalCZK - a.totalCZK);
  }, [expenses, totalCZK]);

  const currencyTotals = useMemo(() => {
    const targetCurrencies: Currency[] = ["THB", "VND", "LAK", "USD", "EUR", "CZK"];
    const sums: Record<Currency, number> = { THB: 0, VND: 0, LAK: 0, USD: 0, EUR: 0, CZK: 0 };
    expenses.forEach((e) => {
      if (sums[e.currency] !== undefined) sums[e.currency] += e.amountOriginal || 0;
    });
    return targetCurrencies.map((curr) => ({ currency: curr, total: sums[curr] }));
  }, [expenses]);

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

        {/* SOUHRNNÉ KARTY */}
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
                Celkem {expenses.length} položek
              </p>
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

        {/* ROZPAD PODLE MĚN */}
        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <CircleDollarSign className="h-3.5 w-3.5 text-slate-400" />
              <span>Rozpad podle původních měn</span>
            </h2>
            <span className="text-[11px] text-slate-400">V originální měně</span>
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
          <Link href="/map" className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-slate-600 transition-colors">
            <Map className="h-5 w-5" />
            <span className="text-[10px]">Map</span>
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
