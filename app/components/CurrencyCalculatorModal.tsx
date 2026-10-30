"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  fetchExchangeRates,
  convertAmount,
  convertToCZK,
  DEFAULT_EXCHANGE_RATES,
  ExchangeRates,
  formatRatesAge,
  saveRatesDate,
  getCachedRatesDate,
} from "@/lib/currency";
import { formatNumber } from "@/lib/formatters";
import { Currency } from "@/lib/types";
import { X, RefreshCw, ArrowLeftRight, Loader2 } from "lucide-react";

// ─── Konstanty ───────────────────────────────────────────────────────────────

const CURRENCIES: { code: Currency; flag: string; symbol: string; name: string }[] = [
  { code: "THB", flag: "🇹🇭", symbol: "฿",  name: "Baht"   },
  { code: "VND", flag: "🇻🇳", symbol: "₫",  name: "Dong"   },
  { code: "LAK", flag: "🇱🇦", symbol: "₭",  name: "Kip"    },
  { code: "USD", flag: "🇺🇸", symbol: "$",  name: "Dollar" },
  { code: "EUR", flag: "🇪🇺", symbol: "€",  name: "Euro"   },
  { code: "CZK", flag: "🇨🇿", symbol: "Kč", name: "Koruna" },
];

// Rychlé částky pro každou měnu
const QUICK_AMOUNTS: Record<Currency, number[]> = {
  THB: [50, 100, 200, 500, 1000],
  VND: [20000, 50000, 100000, 200000, 500000],
  LAK: [10000, 20000, 50000, 100000, 200000],
  USD: [1, 5, 10, 20, 50],
  EUR: [1, 5, 10, 20, 50],
  CZK: [50, 100, 200, 500, 1000],
};

// Kompaktní formátování rychlých částek
function formatQuick(amount: number, currency: Currency): string {
  if ((currency === "VND" || currency === "LAK") && amount >= 1000) {
    return `${(amount / 1000).toFixed(0)}k`;
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(0)}k`;
  }
  return String(amount);
}

// Formátování směnného kurzu (zobrazovaná přesnost)
function formatRate(val: number): string {
  if (val >= 1000) return formatNumber(val, 0);
  if (val >= 10) return formatNumber(val, 2);
  if (val >= 1) return formatNumber(val, 3);
  return formatNumber(val, 4);
}

// ─── Komponenta ──────────────────────────────────────────────────────────────

interface Props {
  defaultFrom?: Currency;
  onClose: () => void;
}

export default function CurrencyCalculatorModal({ defaultFrom = "THB", onClose }: Props) {
  const [from, setFrom] = useState<Currency>(defaultFrom);
  const [to, setTo] = useState<Currency>("CZK");
  const [amount, setAmount] = useState<string>("");
  const [rates, setRates] = useState<ExchangeRates>(DEFAULT_EXCHANGE_RATES);
  const [ratesDate, setRatesDate] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  // Načti kurzy při otevření
  const loadRates = useCallback(async (force = false) => {
    setIsRefreshing(true);
    setIsOffline(false);
    try {
      const fresh = await fetchExchangeRates();
      setRates(fresh);
      if (force) {
        saveRatesDate();
        setRatesDate(new Date().toISOString());
      } else {
        const cached = getCachedRatesDate();
        if (!cached) {
          saveRatesDate();
          setRatesDate(new Date().toISOString());
        } else {
          setRatesDate(cached);
        }
      }
    } catch {
      setIsOffline(true);
      setRatesDate(getCachedRatesDate());
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRates(false);
  }, [loadRates]);

  // Výsledek přepočtu s použitím convertToCZK / convertAmount
  const result = useMemo(() => {
    const num = parseFloat(amount.replace(",", "."));
    if (!amount || isNaN(num) || num <= 0) return null;
    if (to === "CZK") {
      return convertToCZK(num, from, rates);
    }
    return convertAmount(num, from, to, rates);
  }, [amount, from, to, rates]);

  // Zobrazovaný kurz
  const displayRate = useMemo(
    () => (to === "CZK" ? convertToCZK(1, from, rates) : convertAmount(1, from, to, rates)),
    [from, to, rates]
  );

  // Prohození měn
  const swapCurrencies = () => {
    setFrom(to);
    setTo(from);
  };

  // Přidání rychlé částky
  const addQuickAmount = (val: number) => {
    const current = parseFloat(amount.replace(",", ".")) || 0;
    setAmount(String(current + val));
  };

  // Zkontroluj, zda from !== to a pokud ano, nastav to na CZK nebo THB
  const handleFromChange = (code: Currency) => {
    setFrom(code);
    if (code === to) setTo(code === "CZK" ? "THB" : "CZK");
  };
  const handleToChange = (code: Currency) => {
    setTo(code);
    if (code === from) setFrom(code === "CZK" ? "THB" : "CZK");
  };

  const fromInfo = CURRENCIES.find((c) => c.code === from)!;
  const toInfo = CURRENCIES.find((c) => c.code === to)!;

  const resultDecimals = to === "USD" || to === "EUR" ? 2 : 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-[3px] p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden animate-in slide-in-from-bottom-5 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Hlavička ── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <span className="text-xl">🧮</span>
              Kalkulačka měn
            </h2>
            <p
              className={`text-[10px] mt-0.5 font-medium flex items-center gap-1.5 ${
                isOffline ? "text-amber-500" : "text-slate-400"
              }`}
            >
              {isRefreshing ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" /> Aktualizuji kurzy…
                </>
              ) : isOffline ? (
                <>
                  <span>⚠️</span> Offline – {formatRatesAge(ratesDate)}
                </>
              ) : (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                  {formatRatesAge(ratesDate)}
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => loadRates(true)}
              disabled={isRefreshing}
              className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors disabled:opacity-50"
              title="Aktualizovat kurzy"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-5">
          {/* ── Vstupní částka ── */}
          <div className="relative">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Částka
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-2xl font-black text-slate-300 select-none pointer-events-none">
                {fromInfo.symbol}
              </span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9.,]/g, "");
                  setAmount(v);
                }}
                className="w-full pl-12 pr-4 py-4 text-3xl font-black text-slate-900 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-rose-400 focus:bg-white transition-all placeholder:text-slate-200 tracking-tight"
                autoFocus
              />
              {amount && (
                <button
                  type="button"
                  onClick={() => setAmount("")}
                  className="absolute right-3 h-7 w-7 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-500 flex items-center justify-center transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* ── Výběr ZE měny ── */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Z měny
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {CURRENCIES.map((c) => {
                const active = from === c.code;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => handleFromChange(c.code)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                      active
                        ? "bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-400/30"
                        : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-base leading-none">{c.flag}</span>
                    <span>{c.code}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Tlačítko prohození ── */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <button
              type="button"
              onClick={swapCurrencies}
              className="h-9 w-9 rounded-full bg-gradient-to-br from-rose-500 to-pink-500 text-white shadow-md shadow-rose-400/30 flex items-center justify-center transition-all hover:shadow-rose-400/50 active:scale-95"
              title="Prohodit měny"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </button>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* ── Výběr DO měny ── */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Do měny
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {CURRENCIES.map((c) => {
                const active = to === c.code;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => handleToChange(c.code)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                      active
                        ? "bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-400/20"
                        : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-base leading-none">{c.flag}</span>
                    <span>{c.code}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Výsledek ── */}
          <div
            className={`rounded-2xl p-4 border-2 transition-colors ${
              result !== null
                ? "bg-gradient-to-br from-rose-50 to-pink-50 border-rose-200"
                : "bg-slate-50 border-slate-200"
            }`}
          >
            {result !== null ? (
              <>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-sm font-bold text-slate-500">
                    {amount} {fromInfo.flag} {fromInfo.code}
                  </span>
                  <span className="text-slate-400">=</span>
                  <span className="text-3xl font-black text-slate-900 tracking-tight">
                    {formatNumber(result, resultDecimals)}
                    <span className="text-lg font-bold text-slate-500 ml-1.5">
                      {toInfo.symbol}
                    </span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 font-medium">
                  1 {from} = {formatRate(displayRate)} {to}
                  {"  ·  "}
                  1 {to} ={" "}
                  {formatRate(
                    from === "CZK" ? convertToCZK(1, to, rates) : convertAmount(1, to, from, rates)
                  )}{" "}
                  {from}
                </p>
              </>
            ) : (
              <div className="text-center py-3">
                <p className="text-3xl font-black text-slate-200 tracking-tight">–</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  1 {from} = {formatRate(displayRate)} {to}
                </p>
              </div>
            )}
          </div>

          {/* ── Rychlé částky ── */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Rychlé částky ({from})
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {QUICK_AMOUNTS[from].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => addQuickAmount(val)}
                  className="px-3 py-1.5 rounded-full bg-white border border-slate-200 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 text-slate-600 text-xs font-bold transition-all active:scale-95"
                >
                  +{formatQuick(val, from)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAmount("")}
                className="px-3 py-1.5 rounded-full bg-white border border-slate-200 hover:border-slate-300 text-slate-400 text-xs font-bold transition-all"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
