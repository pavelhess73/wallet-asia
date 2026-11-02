"use client";

import { useState, useMemo } from "react";
import { CashWithdrawal, Expense, ServiceEntry } from "@/lib/types";
import {
  calculateCashBalances,
  getActiveCashCurrencies,
} from "@/lib/cashBalance";
import { formatNumber, formatCurrency } from "@/lib/formatters";
import {
  Banknote,
  Plus,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Landmark,
} from "lucide-react";

const CURRENCY_FLAGS: Record<string, string> = {
  THB: "🇹🇭",
  VND: "🇻🇳",
  LAK: "🇱🇦",
  USD: "🇺🇸",
  EUR: "🇪🇺",
  CZK: "🇨🇿",
};

interface CashWalletCardProps {
  withdrawals: CashWithdrawal[];
  expenses: Expense[];
  services?: ServiceEntry[];
  onOpenModal: (tab?: "history" | "new", currency?: string) => void;
}

export default function CashWalletCard({
  withdrawals,
  expenses,
  services = [],
  onOpenModal,
}: CashWalletCardProps) {
  // Spočítáme zůstatky pro všechny aktivní měny
  const balances = useMemo(() => {
    return calculateCashBalances(withdrawals, expenses, services);
  }, [withdrawals, expenses, services]);

  const activeCurrencies = useMemo(() => {
    return getActiveCashCurrencies(withdrawals, expenses, services);
  }, [withdrawals, expenses, services]);

  // Výchozí vybraná měna (první aktivní, nebo THB, nebo VND)
  const [selectedCurrency, setSelectedCurrency] = useState<string>("THB");

  // Pokud vybraná měna není mezi aktivními, zvolíme první dostupnou
  const currentCurrency = useMemo(() => {
    if (activeCurrencies.length === 0) return "THB";
    if (activeCurrencies.includes(selectedCurrency)) return selectedCurrency;
    return activeCurrencies[0];
  }, [activeCurrencies, selectedCurrency]);

  const curBalance = balances[currentCurrency] || {
    currency: currentCurrency,
    totalWithdrawn: 0,
    totalSpent: 0,
    balance: 0,
    withdrawalCount: 0,
    cashExpensesCount: 0,
    cashServicesCount: 0,
    status: "healthy",
  };

  const hasAnyActivity = activeCurrencies.length > 0 || withdrawals.length > 0;

  // Procento zbývající hotovosti
  const remainingPercent =
    curBalance.totalWithdrawn > 0
      ? Math.max(0, Math.min(100, Math.round((curBalance.balance / curBalance.totalWithdrawn) * 100)))
      : curBalance.balance > 0
      ? 100
      : 0;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col gap-3 relative overflow-hidden transition-all hover:border-slate-200">
      
      {/* Hlavička widgetu */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Banknote className="h-4 w-4" />
          </div>
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
              HOTOVOST V PENĚŽENCE
            </span>
          </div>
        </div>

        {/* Tlačítko Historie & Přidat */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onOpenModal("history", currentCurrency)}
            className="text-[11px] font-bold text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
            title="Historie výběrů a směn"
          >
            <Receipt className="h-3 w-3 text-slate-400" />
            <span>Historie</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenModal("new", currentCurrency)}
            className="h-7 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-sm shadow-emerald-600/20 flex items-center gap-1 transition-all active:scale-95"
            title="Přidat výběr / směnu"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Výběr / Směna</span>
          </button>
        </div>
      </div>

      {/* Přepínač aktivních měn (pokud je jich více než 1) */}
      {activeCurrencies.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {activeCurrencies.map((cur) => {
            const b = balances[cur];
            const isSelected = cur === currentCurrency;
            return (
              <button
                key={cur}
                type="button"
                onClick={() => setSelectedCurrency(cur)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 transition-all flex items-center gap-1 ${
                  isSelected
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span>{CURRENCY_FLAGS[cur] || "💰"}</span>
                <span>{cur}</span>
                {b && (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ml-0.5 ${
                      b.status === "healthy"
                        ? "bg-emerald-400"
                        : b.status === "low"
                        ? "bg-amber-400"
                        : "bg-rose-400"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Tělo widgetu se zůstatkem */}
      {!hasAnyActivity && curBalance.totalWithdrawn === 0 && curBalance.totalSpent === 0 ? (
        <div
          onClick={() => onOpenModal("new", currentCurrency)}
          className="bg-slate-50/70 hover:bg-emerald-50/50 rounded-xl p-3 border border-dashed border-slate-200 text-center cursor-pointer transition-colors"
        >
          <p className="text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5">
            <Landmark className="h-3.5 w-3.5 text-emerald-600" />
            <span>Evidujte si výběry z ATM a směny</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Klikněte pro zadání prvního výběru a sledujte reálný hotovostní zůstatek.
          </p>
        </div>
      ) : (
        <div
          onClick={() => onOpenModal("history", currentCurrency)}
          className="cursor-pointer group"
        >
          {/* Hlavní zůstatek s vlajkou a indikátorem stavu */}
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 group-hover:text-emerald-700 transition-colors">
                {formatNumber(curBalance.balance)}
              </span>
              <span className="text-sm font-bold text-slate-500">
                {curBalance.currency}
              </span>
              <span className="text-base ml-0.5">
                {CURRENCY_FLAGS[curBalance.currency] || ""}
              </span>
            </div>

            {/* Stavový štítek: Zelená / Oranžová / Červená */}
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                curBalance.status === "healthy"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : curBalance.status === "low"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}
            >
              {curBalance.status === "healthy" ? (
                <>
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  <span>Dostatek hotovosti</span>
                </>
              ) : curBalance.status === "low" ? (
                <>
                  <AlertTriangle className="h-3 w-3 text-amber-600" />
                  <span>Nízký zůstatek ({remainingPercent} %)</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-3 w-3 text-rose-600" />
                  <span>Přečerpáno</span>
                </>
              )}
            </span>
          </div>

          {/* Kontextový popisek např: Zbývá 3 550 THB z vybraných 10 000 THB */}
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
            <span>
              {curBalance.totalWithdrawn > 0 ? (
                <>
                  Zbývá <strong className="text-slate-700">{formatNumber(curBalance.balance)} {curBalance.currency}</strong> z vybraných {formatNumber(curBalance.totalWithdrawn)} {curBalance.currency}
                </>
              ) : (
                <>
                  Utraceno v hotovosti: {formatNumber(curBalance.totalSpent)} {curBalance.currency}
                </>
              )}
            </span>
            <span className="text-[10px] text-slate-400 group-hover:text-slate-600 font-medium inline-flex items-center gap-0.5">
              <span>Detail</span>
              <ChevronRight className="h-3 w-3" />
            </span>
          </div>

          {/* Progress bar zaplnění rozpočtu */}
          {curBalance.totalWithdrawn > 0 && (
            <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-700 ease-out ${
                  curBalance.status === "healthy"
                    ? "bg-emerald-500"
                    : curBalance.status === "low"
                    ? "bg-amber-500"
                    : "bg-rose-500"
                }`}
                style={{ width: `${remainingPercent}%` }}
              />
            </div>
          )}

          {/* Upozornění při nízkém zůstatku nebo přečerpání */}
          {curBalance.status === "low" && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50/80 px-2.5 py-1 rounded-lg border border-amber-200/60">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
              <span>Doporučujeme brzy vybrat z bankomatu nebo směnit hotovost.</span>
            </div>
          )}
          {curBalance.status === "negative" && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-rose-700 bg-rose-50/80 px-2.5 py-1 rounded-lg border border-rose-200/60">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-600" />
              <span>Hotovost je v mínusu. Nezapomněli jste zaevidovat výběr z ATM?</span>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
