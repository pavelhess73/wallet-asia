"use client";

import { useState, useMemo, useEffect } from "react";
import {
  CashWithdrawal,
  Currency,
  CURRENCIES,
  Expense,
  ServiceEntry,
} from "@/lib/types";
import {
  addCashWithdrawal,
  updateCashWithdrawal,
  deleteCashWithdrawal,
} from "@/lib/cashWithdrawalsStore";
import {
  calculateCashBalanceForCurrency,
} from "@/lib/cashBalance";
import {
  formatNumber,
  formatCurrency,
  formatDateCzech,
} from "@/lib/formatters";
import {
  X,
  Banknote,
  Landmark,
  ArrowRightLeft,
  Plus,
  Trash2,
  Pencil,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Calendar,
  Receipt,
  Sparkles,
  TrendingUp,
} from "lucide-react";

const CURRENCY_FLAGS: Record<string, string> = {
  THB: "🇹🇭",
  VND: "🇻🇳",
  LAK: "🇱🇦",
  USD: "🇺🇸",
  EUR: "🇪🇺",
  CZK: "🇨🇿",
};

interface CashWithdrawalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  withdrawals: CashWithdrawal[];
  expenses: Expense[];
  services?: ServiceEntry[];
  initialCurrency?: string;
  initialTab?: "history" | "new";
}

export default function CashWithdrawalsModal({
  isOpen,
  onClose,
  withdrawals,
  expenses,
  services = [],
  initialCurrency = "THB",
  initialTab = "history",
}: CashWithdrawalsModalProps) {
  const [activeTab, setActiveTab] = useState<"history" | "new">(initialTab);
  const [selectedCurrencyFilter, setSelectedCurrencyFilter] = useState<string>(initialCurrency);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<"atm" | "exchange">("atm");
  const [targetAmount, setTargetAmount] = useState<string>("");
  const [targetCurrency, setTargetCurrency] = useState<string>(initialCurrency);
  const [sourceAmount, setSourceAmount] = useState<string>("");
  const [sourceCurrency, setSourceCurrency] = useState<string>("CZK");
  const [atmFee, setAtmFee] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      if (initialCurrency) {
        setTargetCurrency(initialCurrency);
        setSelectedCurrencyFilter(initialCurrency);
      }
    }
  }, [isOpen, initialTab, initialCurrency]);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // Reset formuláře
  const resetForm = () => {
    setEditingId(null);
    setType("atm");
    setTargetAmount("");
    setTargetCurrency(selectedCurrencyFilter || "THB");
    setSourceAmount("");
    setSourceCurrency("CZK");
    setAtmFee("");
    setDate(new Date().toISOString().split("T")[0]);
    setNote("");
    setErrorMessage(null);
  };

  const handleStartEdit = (w: CashWithdrawal) => {
    setEditingId(w.id || null);
    setType(w.type);
    setTargetAmount(w.targetAmount ? String(w.targetAmount) : "");
    setTargetCurrency(w.targetCurrency || "THB");
    setSourceAmount(w.sourceAmount !== undefined ? String(w.sourceAmount) : "");
    setSourceCurrency(w.sourceCurrency || "CZK");
    setAtmFee(w.atmFee !== undefined ? String(w.atmFee) : "");
    setDate(w.date || new Date().toISOString().split("T")[0]);
    setNote(w.note || "");
    setActiveTab("new");
  };

  // Živý přepočet efektivního kurzu
  const computedRate = useMemo(() => {
    const target = parseFloat(targetAmount.replace(",", "."));
    const source = parseFloat(sourceAmount.replace(",", "."));
    if (!isNaN(target) && target > 0 && !isNaN(source) && source > 0) {
      const ratePerTarget = source / target;
      const ratePerSource = target / source;
      return {
        ratePerTarget,
        ratePerSource,
      };
    }
    return null;
  }, [targetAmount, sourceAmount]);

  // Seznam unikátních měn z výběrů pro filtrování v historii
  const availableCurrencies = useMemo(() => {
    const set = new Set<string>();
    CURRENCIES.forEach((c) => set.add(c));
    withdrawals.forEach((w) => {
      if (w.targetCurrency) set.add(w.targetCurrency.toUpperCase());
    });
    return Array.from(set);
  }, [withdrawals]);

  // Filtrovaná historie
  const filteredWithdrawals = useMemo(() => {
    if (!selectedCurrencyFilter || selectedCurrencyFilter === "ALL") {
      return withdrawals;
    }
    return withdrawals.filter(
      (w) => (w.targetCurrency || "").toUpperCase() === selectedCurrencyFilter.toUpperCase()
    );
  }, [withdrawals, selectedCurrencyFilter]);

  // Aktuální stav pro vybranou měnu
  const currentBalance = useMemo(() => {
    const cur = selectedCurrencyFilter && selectedCurrencyFilter !== "ALL"
      ? selectedCurrencyFilter
      : targetCurrency || "THB";
    return calculateCashBalanceForCurrency(cur, withdrawals, expenses, services);
  }, [selectedCurrencyFilter, targetCurrency, withdrawals, expenses, services]);

  // Uložení formuláře
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numTarget = parseFloat(targetAmount.replace(",", "."));
    if (isNaN(numTarget) || numTarget <= 0) {
      setErrorMessage("Zadejte platnou získanou částku větší než 0.");
      return;
    }

    const numSource = sourceAmount.trim() ? parseFloat(sourceAmount.replace(",", ".")) : undefined;
    const numAtmFee = atmFee.trim() ? parseFloat(atmFee.replace(",", ".")) : undefined;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (editingId) {
        await updateCashWithdrawal(editingId, {
          type,
          targetAmount: numTarget,
          targetCurrency: targetCurrency.toUpperCase(),
          sourceAmount: numSource !== undefined && !isNaN(numSource) ? numSource : undefined,
          sourceCurrency: sourceAmount.trim() ? sourceCurrency.toUpperCase() : undefined,
          atmFee: numAtmFee !== undefined && !isNaN(numAtmFee) ? numAtmFee : undefined,
          date,
          note: note.trim(),
        });
        showToast("Záznam byl úspěšně aktualizován.");
      } else {
        await addCashWithdrawal({
          type,
          targetAmount: numTarget,
          targetCurrency: targetCurrency.toUpperCase(),
          sourceAmount: numSource !== undefined && !isNaN(numSource) ? numSource : undefined,
          sourceCurrency: sourceAmount.trim() ? sourceCurrency.toUpperCase() : undefined,
          atmFee: numAtmFee !== undefined && !isNaN(numAtmFee) ? numAtmFee : undefined,
          date,
          note: note.trim(),
          createdAt: new Date().toISOString(),
        });
        showToast(`Přidán výběr: +${formatNumber(numTarget)} ${targetCurrency}`);
      }

      resetForm();
      setActiveTab("history");
    } catch (err) {
      console.error("Chyba při ukládání výběru:", err);
      setErrorMessage("Nepodařilo se uložit záznam. Zkontrolujte připojení.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id?: string) => {
    if (!id) return;
    if (!window.confirm("Opravdu chcete smazat tento záznam výběru/směny?")) return;

    setDeletingId(id);
    try {
      await deleteCashWithdrawal(id);
      showToast("Záznam byl smazán.");
    } catch (err) {
      console.error("Chyba při mazání výběru:", err);
      alert("Nepodařilo se smazat záznam.");
    } finally {
      setDeletingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 max-h-[92vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        
        {/* Hlavička modálu */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Banknote className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Hotovostní Rozpočet</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                  ATM & Směny
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Evidence dotací hotovosti a výpočet zůstatku v peněžence
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-slate-200/70 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
            title="Zavřít"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Přepínač záložek: Přehled & Historie / Nový záznam */}
        <div className="px-4 pt-3 pb-2 border-b border-slate-100 flex items-center gap-2 shrink-0 bg-white">
          <button
            type="button"
            onClick={() => {
              setActiveTab("history");
              resetForm();
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "history"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Receipt className="h-3.5 w-3.5" />
            <span>Historie výběrů ({withdrawals.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("new");
              if (!editingId) resetForm();
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "new"
                ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/50"
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{editingId ? "Upravit záznam" : "Přidat výběr / směnu"}</span>
          </button>
        </div>

        {/* Notifikace o úspěchu / chybě */}
        {successToast && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{successToast}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        {/* Tělo modálu – scrollovatelný obsah */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* ════════════════════════════════════════════════════════════════════
              ZÁLOŽKA 1: PŘEHLED A HISTORIE VÝBĚRŮ
             ════════════════════════════════════════════════════════════════════ */}
          {activeTab === "history" && (
            <div className="space-y-4">
              
              {/* Výběr měny pro zobrazení zůstatku */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                  Měna:
                </span>
                {availableCurrencies.map((cur) => (
                  <button
                    key={cur}
                    type="button"
                    onClick={() => setSelectedCurrencyFilter(cur)}
                    className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition-all ${
                      selectedCurrencyFilter === cur
                        ? "bg-slate-900 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <span>{CURRENCY_FLAGS[cur] || "💰"} {cur}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSelectedCurrencyFilter("ALL")}
                  className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition-all ${
                    selectedCurrencyFilter === "ALL"
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Všechny
                </button>
              </div>

              {/* Karta zůstatku pro vybranou měnu */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-4 shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
                  <span className="font-bold flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                    <span>{CURRENCY_FLAGS[currentBalance.currency] || "💰"}</span>
                    <span>Stav hotovosti ({currentBalance.currency})</span>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      currentBalance.status === "healthy"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : currentBalance.status === "low"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                    }`}
                  >
                    {currentBalance.status === "healthy"
                      ? "Dostatek"
                      : currentBalance.status === "low"
                      ? "Nízký zůstatek"
                      : "Přečerpáno"}
                  </span>
                </div>

                <div className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-2">
                  {formatCurrency(currentBalance.balance, currentBalance.currency)}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/60 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Celkem vybráno (dotace)</span>
                    <span className="font-bold text-emerald-400">
                      +{formatNumber(currentBalance.totalWithdrawn)} {currentBalance.currency}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Útrata v hotovosti</span>
                    <span className="font-bold text-rose-300">
                      -{formatNumber(currentBalance.totalSpent)} {currentBalance.currency}
                    </span>
                  </div>
                </div>

                {currentBalance.totalWithdrawn > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span>Zbývá z rozpočtu</span>
                      <span>
                        {Math.max(0, Math.round((currentBalance.balance / currentBalance.totalWithdrawn) * 100))}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          currentBalance.status === "healthy"
                            ? "bg-emerald-400"
                            : currentBalance.status === "low"
                            ? "bg-amber-400"
                            : "bg-rose-400"
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(0, (currentBalance.balance / currentBalance.totalWithdrawn) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Seznam výběrů */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
                  <span>Záznamy výběrů a směn ({filteredWithdrawals.length})</span>
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setActiveTab("new");
                    }}
                    className="text-emerald-600 hover:text-emerald-700 flex items-center gap-1 text-[11px]"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Nový výběr</span>
                  </button>
                </div>

                {filteredWithdrawals.length === 0 ? (
                  <div className="bg-slate-50 rounded-2xl p-6 text-center border border-slate-100">
                    <Banknote className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700">Zatím žádné výběry z ATM ani směny</p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                      Zaevidujte svůj první výběr z bankomatu nebo směnu peněz pro přesný přehled hotovosti v kapse.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        resetForm();
                        setActiveTab("new");
                      }}
                      className="mt-3 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5 shadow-sm"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Zadat první výběr</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredWithdrawals.map((w) => {
                      const isAtm = w.type === "atm";
                      const rate =
                        w.sourceAmount && w.targetAmount > 0
                          ? w.sourceAmount / w.targetAmount
                          : null;

                      return (
                        <div
                          key={w.id}
                          className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm flex items-start justify-between gap-3 hover:border-slate-200 transition-all"
                        >
                          {/* Ikona & Popis */}
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div
                              className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 ${
                                isAtm
                                  ? "bg-blue-50 text-blue-600 border border-blue-100"
                                  : "bg-amber-50 text-amber-600 border border-amber-100"
                              }`}
                            >
                              {isAtm ? (
                                <Landmark className="h-5 w-5" />
                              ) : (
                                <ArrowRightLeft className="h-5 w-5" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                    isAtm
                                      ? "bg-blue-100/70 text-blue-700"
                                      : "bg-amber-100/70 text-amber-700"
                                  }`}
                                >
                                  {isAtm ? "🏦 Bankomat (ATM)" : "💱 Směnárna"}
                                </span>
                                <span className="text-[11px] text-slate-400 font-medium">
                                  {formatDateCzech(w.date)}
                                </span>
                              </div>

                              <div className="mt-1">
                                <div className="text-base font-black text-emerald-600 tracking-tight">
                                  +{formatCurrency(w.targetAmount, w.targetCurrency)}
                                </div>
                              </div>

                              {/* Podrobnosti: kurz, poplatek, poznámka */}
                              <div className="mt-1 space-y-0.5 text-[11px] text-slate-500">
                                {w.sourceAmount !== undefined && (
                                  <div className="flex items-center gap-1 text-slate-600 font-medium">
                                    <span>Strženo:</span>
                                    <span className="font-bold">
                                      {formatCurrency(w.sourceAmount, w.sourceCurrency || "CZK")}
                                    </span>
                                    {rate && (
                                      <span className="text-slate-400 font-mono text-[10px]">
                                        (kurz: {rate < 1 ? rate.toFixed(4) : rate.toFixed(2)}{" "}
                                        {w.sourceCurrency || "CZK"}/{w.targetCurrency})
                                      </span>
                                    )}
                                  </div>
                                )}

                                {w.atmFee !== undefined && w.atmFee > 0 && (
                                  <div className="text-rose-600 font-medium flex items-center gap-1">
                                    <span>Poplatek ATM:</span>
                                    <span className="font-bold">
                                      {formatCurrency(w.atmFee, w.targetCurrency)}
                                    </span>
                                  </div>
                                )}

                                {w.note && (
                                  <div className="text-slate-500 italic">
                                    „{w.note}“
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Akce: Upravit & Smazat */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(w)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                              title="Upravit"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(w.id)}
                              disabled={deletingId === w.id}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                              title="Smazat"
                            >
                              {deletingId === w.id ? (
                                <Loader2 className="h-4 w-4 animate-spin text-rose-500" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              ZÁLOŽKA 2: FORMULÁŘ PRO NOVÝ / UPRAVOVANÝ VÝBĚR
             ════════════════════════════════════════════════════════════════════ */}
          {activeTab === "new" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Typ výběru: Bankomat vs. Směnárna */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Typ transakce
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setType("atm")}
                    className={`py-2.5 px-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      type === "atm"
                        ? "bg-blue-50 border-blue-300 text-blue-700 shadow-sm"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Landmark className="h-4 w-4" />
                    <span>🏦 Bankomat (ATM)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType("exchange")}
                    className={`py-2.5 px-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      type === "exchange"
                        ? "bg-amber-50 border-amber-300 text-amber-700 shadow-sm"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                    <span>💱 Směnárna</span>
                  </button>
                </div>
              </div>

              {/* Získaná hotovost (targetAmount & targetCurrency) */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Vybraná hotovost *
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder="např. 10000"
                      value={targetAmount}
                      onChange={(e) => setTargetAmount(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-base font-bold text-slate-900 bg-slate-50/50"
                    />
                  </div>
                  <select
                    value={targetCurrency}
                    onChange={(e) => setTargetCurrency(e.target.value)}
                    className="w-28 px-3 py-2.5 rounded-2xl border border-slate-200 bg-white font-bold text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Strženo z účtu / zaplaceno (volitelné: sourceAmount & sourceCurrency) */}
              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span>Strženo z účtu / zaplaceno</span>
                    <span className="text-[10px] text-slate-400 font-normal">(volitelné)</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Pro výpočet reálného kurzu</span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="number"
                    step="any"
                    placeholder="např. 6850"
                    value={sourceAmount}
                    onChange={(e) => setSourceAmount(e.target.value)}
                    className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-semibold text-slate-900 bg-white"
                  />
                  <select
                    value={sourceCurrency}
                    onChange={(e) => setSourceCurrency(e.target.value)}
                    className="w-28 px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="CZK">CZK</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    {CURRENCIES.filter((c) => c !== "CZK" && c !== "EUR" && c !== "USD").map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Živý náhled kurzu */}
                {computedRate && (
                  <div className="text-[11px] text-emerald-700 bg-emerald-50/80 rounded-xl p-2 border border-emerald-100 flex items-center gap-1.5 font-medium">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>
                      Reálný kurz: 1 {targetCurrency} ={" "}
                      <strong>
                        {computedRate.ratePerTarget < 1
                          ? computedRate.ratePerTarget.toFixed(4)
                          : computedRate.ratePerTarget.toFixed(2)}{" "}
                        {sourceCurrency}
                      </strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Poplatek ATM (volitelné v lokální měně) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Poplatek bankomatu ({targetCurrency})
                  </label>
                  <span className="text-[10px] text-slate-400">volitelné</span>
                </div>
                <input
                  type="number"
                  step="any"
                  placeholder={targetCurrency === "THB" ? "např. 220" : "0"}
                  value={atmFee}
                  onChange={(e) => setAtmFee(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-semibold text-slate-900 bg-slate-50/50"
                />

                {/* Rychlá nápověda pro běžné ATM poplatky v JV Asii */}
                {type === "atm" && targetCurrency === "THB" && (
                  <button
                    type="button"
                    onClick={() => setAtmFee("220")}
                    className="mt-1.5 text-[11px] text-slate-500 hover:text-emerald-600 inline-flex items-center gap-1"
                  >
                    <span>💡 Doplnit 220 THB (standardní fee thajských ATM)</span>
                  </button>
                )}
                {type === "atm" && targetCurrency === "VND" && (
                  <button
                    type="button"
                    onClick={() => setAtmFee("50000")}
                    className="mt-1.5 text-[11px] text-slate-500 hover:text-emerald-600 inline-flex items-center gap-1"
                  >
                    <span>💡 Doplnit 50 000 VND (běžný ATM fee)</span>
                  </button>
                )}
              </div>

              {/* Datum a Poznámka */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Datum *
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-medium text-slate-800 bg-slate-50/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Poznámka / Místo
                  </label>
                  <input
                    type="text"
                    placeholder="např. Bangkok Bank, letiště..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-medium text-slate-800 bg-slate-50/50"
                  />
                </div>
              </div>

              {/* Tlačítka Uložit / Zrušit */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setActiveTab("history");
                  }}
                  className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Ukládám...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{editingId ? "Uložit změny" : "Uložit výběr / směnu"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
