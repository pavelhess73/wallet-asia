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
import { Expense, Currency, ExpenseCategory, getCategoryDefinition } from "@/lib/types";
import {
  Search,
  Loader2,
  X,
  ReceiptText,
  BarChart3,
  BookOpen,
  UtensilsCrossed,
  Train,
  Hotel,
  Wine,
  Plane,
  ShoppingCart,
  Tag,
  ArrowLeft,
  RotateCcw,
  Filter,
} from "lucide-react";

// Pomocná funkce pro formátování čísel v českém formátu
const formatNumber = (val: number, maxDecimals = 0): string =>
  new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: maxDecimals }).format(val);

// Pomocná funkce pro datum
function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("cs-CZ", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
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

// Kategorizační metadata sjednocená přes lib/types
function getCategoryInfo(rawCategory: string) {
  const def = getCategoryDefinition(rawCategory);
  return {
    label: def.label,
    icon: CATEGORY_ICONS[def.id] || Tag,
    colorClass: def.circleBg,
  };
}

const QUICK_FILTERS = [
  { id: "Gastro", label: "🍜 Gastro" },
  { id: "Doprava", label: "🚕 Doprava" },
  { id: "Ubytování", label: "🏨 Ubytování" },
  { id: ">500 Kč", label: "💰 >500 Kč" },
] as const;

export default function SearchPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [queryText, setQueryText] = useState<string>("");

  // Rychlý filtr
  const [selectedQuickFilter, setSelectedQuickFilter] = useState<string | null>(null);

  // 1. Živá data z Firestore přes onSnapshot
  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(db, "expenses"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched: Expense[] = snapshot.docs.map((docSnapshot) => {
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
            location: data.location || undefined,
          };
        });

        setExpenses(fetched);
        setIsLoading(false);
      },
      (error) => {
        console.error("Chyba při načítání výdajů pro vyhledávání:", error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Reakce na změnu v textovém poli
  const handleInputChange = (value: string) => {
    setQueryText(value);
  };

  // Přepnutí rychlého filtru
  const toggleQuickFilter = (filterId: string) => {
    setSelectedQuickFilter((prev) => (prev === filterId ? null : filterId));
  };

  // Vymazání vyhledávání
  const handleClearSearch = () => {
    setQueryText("");
    setSelectedQuickFilter(null);
  };

  // Výpočet filtrovaných výdajů (okamžitá reakce na psaní + rychlé filtry)
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      // Filtr podle rychlého filtru
      if (selectedQuickFilter) {
        const catNorm = (e.category || "").toLowerCase();
        if (selectedQuickFilter === "Gastro") {
          const isGastro =
            catNorm.includes("gastro") ||
            catNorm.includes("jídlo") ||
            catNorm.includes("jidlo") ||
            catNorm.includes("restaurant") ||
            catNorm.includes("oběd") ||
            catNorm.includes("večeře") ||
            catNorm.includes("🍜");
          if (!isGastro) return false;
        } else if (selectedQuickFilter === "Doprava") {
          const isTransport =
            catNorm.includes("doprav") ||
            catNorm.includes("transport") ||
            catNorm.includes("taxi") ||
            catNorm.includes("grab") ||
            catNorm.includes("vlak") ||
            catNorm.includes("autobus") ||
            catNorm.includes("letenk") ||
            catNorm.includes("🚕");
          if (!isTransport) return false;
        } else if (selectedQuickFilter === "Ubytování") {
          const isAccom =
            catNorm.includes("ubytov") ||
            catNorm.includes("accommodat") ||
            catNorm.includes("hotel") ||
            catNorm.includes("hostel") ||
            catNorm.includes("airbnb") ||
            catNorm.includes("🏨");
          if (!isAccom) return false;
        } else if (selectedQuickFilter === ">500 Kč") {
          if ((e.amountCZK || 0) <= 500) return false;
        }
      }

      // Textový filtr podle poznámky, kategorie a místa
      if (queryText.trim()) {
        const q = queryText.trim().toLowerCase();
        const matchNote = (e.note || "").toLowerCase().includes(q);
        const matchCategory = (e.category || "").toLowerCase().includes(q);
        const matchMerchant = (e.merchant || "").toLowerCase().includes(q);
        return matchNote || matchCategory || matchMerchant;
      }

      return true;
    });
  }, [expenses, selectedQuickFilter, queryText]);

  // Celkový součet vyhledaných výdajů v CZK
  const totalCZK = useMemo(() => {
    return filteredExpenses.reduce((acc, curr) => acc + (curr.amountCZK || 0), 0);
  }, [filteredExpenses]);

  return (
    <div className="min-h-screen bg-[#F8F6F4] text-slate-800 antialiased font-sans flex flex-col justify-between">
      <main className="max-w-md mx-auto sm:max-w-lg w-full px-4 pt-6 pb-28 flex flex-col gap-4">
        {/* HORNÍ HLAVIČKA */}
        <header className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="h-9 w-9 rounded-full bg-white border border-slate-200/80 shadow-xs flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors"
              title="Zpět do peněženky"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1">
                <Search className="h-3 w-3" />
                <span>Vyhledávání</span>
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Hledat výdaje
              </h1>
            </div>
          </div>

          {(queryText || selectedQuickFilter) && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="text-xs text-slate-400 hover:text-rose-600 flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-white"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </button>
          )}
        </header>

        {/* VYHLEDÁVACÍ FORMULÁŘ */}
        <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-2.5">
          <div className="relative flex items-center">
            <Search className="h-4 w-4 absolute left-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={queryText}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Hledat výdaj, např. pivo, večeře v Bangkoku..."
              className="w-full bg-white rounded-2xl border border-slate-200/80 pl-10 pr-10 py-3 text-sm text-slate-900 shadow-xs placeholder:text-slate-400 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 transition-all"
            />
            {queryText && (
              <button
                type="button"
                onClick={() => handleInputChange("")}
                className="absolute right-3 text-slate-400 hover:text-slate-600 p-1"
                title="Vymazat text"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* RYCHLÉ FILTRY */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
            <div className="text-[11px] font-semibold text-slate-400 shrink-0 mr-1 flex items-center gap-1">
              <Filter className="h-3 w-3" />
              <span>Rychlé filtry:</span>
            </div>
            {QUICK_FILTERS.map((filter) => {
              const isActive = selectedQuickFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => toggleQuickFilter(filter.id)}
                  className={`text-xs py-1.5 px-3 rounded-full shrink-0 border transition-all cursor-pointer ${
                    isActive
                      ? "bg-rose-50 border-rose-300 text-rose-700 font-bold shadow-xs scale-102"
                      : "bg-white border-slate-200/80 text-slate-600 hover:border-slate-300 font-medium"
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </form>

        {/* SOUHRNNÝ PANEL S INDIKACÍ VÝSLEDKŮ A CELKOVÝM SOUČTEM */}
        <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-100 flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium">Nalezeno:</span>
              <span className="text-xs font-bold text-slate-900">
                {filteredExpenses.length}{" "}
                {filteredExpenses.length === 1
                  ? "výdaj"
                  : filteredExpenses.length >= 2 && filteredExpenses.length <= 4
                  ? "výdaje"
                  : "výdajů"}
              </span>
            </div>
            {queryText.trim() ? (
              <span className="text-[11px] text-slate-400 mt-0.5">
                Textový filtr: &quot;{queryText.trim()}&quot;
              </span>
            ) : selectedQuickFilter ? (
              <span className="text-[11px] text-slate-400 mt-0.5">
                Kategorie: {selectedQuickFilter}
              </span>
            ) : (
              <span className="text-[11px] text-slate-400 mt-0.5">
                Všechny zaznamenané výdaje
              </span>
            )}
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider block">
              Celkový součet
            </span>
            <span className="text-base sm:text-lg font-black text-slate-900 tracking-tight text-rose-600">
              {formatNumber(totalCZK)} Kč
            </span>
          </div>
        </div>

        {/* SEZNAM NALEZENÝCH VÝDAJŮ */}
        {isLoading ? (
          <div className="bg-white rounded-2xl p-8 border border-slate-100 text-center flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 text-rose-500 animate-spin" />
            <span className="text-xs text-slate-400 font-medium">
              Načítám výdaje z databáze...
            </span>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-slate-100 text-center flex flex-col items-center justify-center gap-3">
            <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
              <Search className="h-6 w-6 stroke-[1.5]" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">
                Žádné odpovídající výdaje
              </p>
              <p className="text-xs text-slate-400 mt-0.5 max-w-xs mx-auto">
                Zkuste změnit hledaný výraz nebo zvolit jiný rychlý filtr.
              </p>
            </div>
            {(queryText || selectedQuickFilter) && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="mt-1 text-xs text-rose-600 font-bold hover:underline"
              >
                Zobrazit všechny výdaje
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xs border border-slate-100 divide-y divide-slate-100 overflow-hidden">
            {filteredExpenses.map((expense) => {
              const meta = getCategoryInfo(expense.category);
              const IconComp = meta.icon;

              return (
                <div
                  key={expense.id ?? `${expense.createdAt}-${expense.note}`}
                  className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                >
                  {/* Levá část: Ikona kategorie + popis a detail */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${meta.colorClass}`}
                    >
                      <IconComp className="h-5 w-5 stroke-[2.2]" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {expense.note}
                      </p>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate mt-0.5">
                        <span className="font-medium text-slate-500">
                          {meta.label}
                        </span>
                        {expense.merchant && (
                          <>
                            <span>•</span>
                            <span className="truncate">{expense.merchant}</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{formatDate(expense.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Pravá část: Částka v CZK a původní měně */}
                  <div className="text-right shrink-0 flex flex-col items-end">
                    <div className="text-sm font-black text-slate-900 tracking-tight">
                      {formatNumber(expense.amountCZK)} Kč
                    </div>
                    {expense.currency !== "CZK" && expense.amountOriginal > 0 && (
                      <div className="text-[10px] text-slate-400 font-medium font-mono">
                        {formatNumber(expense.amountOriginal, 0)} {expense.currency}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* SPODNÍ NAVIGAČNÍ LIŠTA S AKTIVNÍ IKONOU SEARCH */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-lg">
        <div className="max-w-md mx-auto sm:max-w-lg px-6 py-2.5 flex items-center justify-between">
          <Link
            href="/"
            className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ReceiptText className="h-5 w-5" />
            <span className="text-[10px]">Entries</span>
          </Link>

          <Link
            href="/stats"
            className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <BarChart3 className="h-5 w-5" />
            <span className="text-[10px]">Stats</span>
          </Link>

          <Link
            href="/services"
            className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <BookOpen className="h-5 w-5" />
            <span className="text-[10px]">Služby</span>
          </Link>

          <Link
            href="/search"
            className="flex flex-col items-center gap-0.5 text-rose-600 font-bold transition-colors"
            aria-current="page"
          >
            <Search className="h-5 w-5 stroke-[2.4]" />
            <span className="text-[10px]">Search</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
