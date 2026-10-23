"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Currency,
  Expense,
  CURRENCIES,
  ExpenseCategory,
  CATEGORY_LIST,
  getCategoryDefinition,
} from "@/lib/types";
import {
  fetchExchangeRates,
  convertAmount,
  DEFAULT_EXCHANGE_RATES,
  ExchangeRates,
} from "@/lib/rates";
import {
  Loader2,
  Plus,
  Coins,
  Calendar,
  Train,
  UtensilsCrossed,
  Wine,
  Coffee,
  ShoppingCart,
  Hotel,
  Plane,
  Tag,
  Store,
  X,
  AlertCircle,
  CheckCircle2,
  ReceiptText,
  BarChart3,
  BookOpen,
  Search,
  Pencil,
  Trash2,
} from "lucide-react";

const CATEGORY_ICONS: Record<ExpenseCategory, React.ComponentType<{ className?: string }>> = {
  Gastro: UtensilsCrossed,
  Doprava: Train,
  Ubytování: Hotel,
  Bar: Wine,
  Zážitky: Plane,
  Nákupy: ShoppingCart,
  Různé: Tag,
};

// Rychlé šablony (Quick Presets) pro okamžité zadávání nejčastějších výdajů
export interface QuickPreset {
  id: string;
  emoji: string;
  label: string;
  category: ExpenseCategory;
  defaultNote: string;
  defaultMerchant?: string;
  defaultCurrency?: Currency;
}

export const QUICK_PRESETS: QuickPreset[] = [
  {
    id: "food",
    emoji: "🍜",
    label: "Jídlo",
    category: "Gastro",
    defaultNote: "Jídlo",
  },
  {
    id: "beer",
    emoji: "🍺",
    label: "Pivo",
    category: "Bar",
    defaultNote: "Pivo",
  },
  {
    id: "transport",
    emoji: "🛵",
    label: "Doprava",
    category: "Doprava",
    defaultNote: "Doprava",
  },
  {
    id: "coffee",
    emoji: "☕",
    label: "Káva",
    category: "Nákupy",
    defaultNote: "Káva",
  },
  {
    id: "seven_eleven",
    emoji: "🛒",
    label: "7-Eleven",
    category: "Nákupy",
    defaultNote: "7-Eleven",
    defaultMerchant: "7-Eleven",
  },
];

export default function MainWallet() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Hydration guard – datumové formátování je locale-závislé a musí běžet
  // výhradně na klientovi. Zabraňuje Hydration Error #441.
  const [isClient, setIsClient] = useState<boolean>(false);

  // GPS poloha – automaticky vyžádaná při mountu
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Stav pro modální okno formuláře (přidání i editace)
  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const amountInputRef = useRef<HTMLInputElement | null>(null);

  // Stavové proměnné pro formulář
  const [amountOriginal, setAmountOriginal] = useState<string>("");
  const [currency, setCurrency] = useState<Currency>("VND");
  const [note, setNote] = useState<string>("");
  const [merchant, setMerchant] = useState<string>("");
  const [manualCategory, setManualCategory] = useState<ExpenseCategory>("Gastro");

  // Stav pro aktuální měnové kurzy
  const [rates, setRates] = useState<ExchangeRates>(DEFAULT_EXCHANGE_RATES);

  // Nastavení isClient po mountu – po tomto bodě je bezpečné počítat
  // locale-závislé datumové řetězce bez rizika Hydration Error #441.
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Načtení a kešování směnných kurzů při načtení komponenty
  useEffect(() => {
    fetchExchangeRates()
      .then((fetchedRates) => {
        if (fetchedRates) {
          setRates(fetchedRates);
        }
      })
      .catch((err) => {
        console.warn("Chyba při načítání kurzů:", err);
      });
  }, []);

  // Vyžádání GPS polohy při mountu (tiché – nezobrazuje chybu uživateli)
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        // Oprávnění zamítnuto nebo poloha nedostupná – ignorujeme tiše
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

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
            category: data.category || "Ostatní",
            note: data.note || "",
            merchant: data.merchant || undefined,
            createdAt: data.createdAt || new Date().toISOString(),
            location:
              data.location?.lat != null && data.location?.lng != null
                ? { lat: Number(data.location.lat), lng: Number(data.location.lng) }
                : undefined,
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

  // Pomocné formátování čísel a měn
  const formatNumber = (val: number, maxDecimals = 0) => {
    return new Intl.NumberFormat("cs-CZ", {
      maximumFractionDigits: maxDecimals,
    }).format(val);
  };

  // Výpočet Total (celkový součet v CZK)
  const totalCZK = useMemo(() => {
    return expenses.reduce((acc, curr) => acc + (curr.amountCZK || 0), 0);
  }, [expenses]);

  // Pomocná funkce pro kontrolu dneška
  const isTodayDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const now = new Date();
      return (
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    } catch {
      return false;
    }
  };

  // Výpočet Today (dnešní utracená částka v CZK)
  // Závisí na lokálním čase – počítá se až po mountu (isClient).
  const { todayCZK, todayCount } = useMemo(() => {
    if (!isClient) return { todayCZK: 0, todayCount: 0 };
    const todayExpenses = expenses.filter((e) => isTodayDate(e.createdAt));
    const sum = todayExpenses.reduce((acc, curr) => acc + (curr.amountCZK || 0), 0);
    return { todayCZK: sum, todayCount: todayExpenses.length };
  }, [expenses, isClient]);

  // Čistý feed výdajů seskupených přímo podle dnů (createdAt).
  // Locale-závislé labely ('Dnes', 'Včera', Intl.DateTimeFormat) se počítají
  // AŽ po mountu (isClient = true), aby nedošlo k Hydration Error #441.
  const groupedExpenses = useMemo(() => {
    const groups: {
      [dateKey: string]: {
        label: string;
        totalCZK: number;
        items: Expense[];
      };
    } = {};

    expenses.forEach((exp) => {
      let dateKey = "unknown";
      let label = "";

      try {
        const d = new Date(exp.createdAt);
        if (!isNaN(d.getTime())) {
          dateKey = d.toISOString().split("T")[0];

          if (isClient) {
            const now = new Date();
            const isCurrentDay =
              d.getDate() === now.getDate() &&
              d.getMonth() === now.getMonth() &&
              d.getFullYear() === now.getFullYear();

            const yesterday = new Date();
            yesterday.setDate(now.getDate() - 1);
            const isYesterday =
              d.getDate() === yesterday.getDate() &&
              d.getMonth() === yesterday.getMonth() &&
              d.getFullYear() === yesterday.getFullYear();

            const formattedDay = new Intl.DateTimeFormat("cs-CZ", {
              day: "numeric",
              month: "long",
            }).format(d);

            if (isCurrentDay) {
              label = `Dnes • ${formattedDay}`;
            } else if (isYesterday) {
              label = `Včera • ${formattedDay}`;
            } else {
              label = formattedDay;
            }
          } else {
            // Server / pre-hydration: prázdný label – klient doplní po mountu
            label = dateKey;
          }
        }
      } catch {
        dateKey = "unknown";
        label = "";
      }

      if (!groups[dateKey]) {
        groups[dateKey] = {
          label,
          totalCZK: 0,
          items: [],
        };
      }

      groups[dateKey].items.push(exp);
      groups[dateKey].totalCZK += exp.amountCZK || 0;
    });

    return Object.entries(groups).map(([dateKey, group]) => ({
      dateKey,
      ...group,
    }));
  }, [expenses, isClient]);

  // Živý přepočet pro náhled v ručním formuláři
  const numericAmount = parseFloat(amountOriginal);
  const previewAmountCZK =
    !isNaN(numericAmount) && numericAmount > 0
      ? convertAmount(numericAmount, currency, "CZK", rates)
      : 0;

  // Zobrazení toastu o úspěchu
  const showSuccess = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // Otevření modálu pro nový výdaj
  const handleOpenCreate = () => {
    setEditingExpense(null);
    setAmountOriginal("");
    setNote("");
    setMerchant("");
    setManualCategory("Gastro");
    setIsManualModalOpen(true);
    setTimeout(() => {
      amountInputRef.current?.focus();
    }, 80);
  };

  // Aplikace rychlé šablony (Quick Preset) s přímým zaměřením do pole částky
  const handleApplyPreset = (preset: QuickPreset) => {
    setEditingExpense(null);
    setAmountOriginal("");
    setManualCategory(preset.category);
    setNote(preset.defaultNote);
    setMerchant(preset.defaultMerchant || "");
    if (preset.defaultCurrency) {
      setCurrency(preset.defaultCurrency);
    }
    setIsManualModalOpen(true);
    setTimeout(() => {
      amountInputRef.current?.focus();
    }, 80);
  };

  // Otevření modálu pro úpravu existujícího výdaje
  const handleOpenEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setAmountOriginal(expense.amountOriginal.toString());
    setCurrency(expense.currency);
    setNote(expense.note);
    setMerchant(expense.merchant || "");
    const def = getCategoryDefinition(expense.category);
    setManualCategory(def.id);
    setIsManualModalOpen(true);
    setTimeout(() => {
      amountInputRef.current?.focus();
    }, 80);
  };

  // Mazání výdaje z Firestore
  const handleDelete = async (id?: string) => {
    if (!id) return;
    const confirmed = window.confirm("Opravdu chcete tento výdaj smazat?");
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "expenses", id));
      showSuccess("Výdaj byl smazán");
    } catch (err) {
      console.error("Chyba při mazání výdaje:", err);
      setErrorMessage("Nepodařilo se smazat výdaj.");
    }
  };

  // Odeslání formuláře (nový záznam i aktualizace existujícího)
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
      const calculatedCZK = convertAmount(numericAmount, currency, "CZK", rates);

      if (editingExpense && editingExpense.id) {
        // AKTUALIZACE EXISTUJÍCÍHO VÝDAJE
        const expenseRef = doc(db, "expenses", editingExpense.id);
        const updatePayload: Record<string, unknown> = {
          amountOriginal: numericAmount,
          currency,
          amountCZK: calculatedCZK,
          category: manualCategory,
          note: note.trim(),
        };

        if (merchant.trim()) {
          updatePayload.merchant = merchant.trim();
        } else {
          updatePayload.merchant = "";
        }

        await updateDoc(expenseRef, updatePayload);
        showSuccess(`Výdaj upraven: ${note.trim()} (${formatNumber(calculatedCZK)} Kč)`);
      } else {
        // PŘIDÁNÍ NOVÉHO VÝDAJE
        const expensePayload: Record<string, unknown> = {
          amountOriginal: numericAmount,
          currency,
          amountCZK: calculatedCZK,
          category: manualCategory,
          note: note.trim(),
          createdAt: new Date().toISOString(),
        };

        if (merchant.trim()) {
          expensePayload.merchant = merchant.trim();
        }

        if (currentLocation) {
          expensePayload.location = currentLocation;
        }

        await addDoc(collection(db, "expenses"), expensePayload);
        showSuccess(`Přidán výdaj: ${note.trim()} (${formatNumber(calculatedCZK)} Kč)`);
      }

      // Vyčištění a zavření
      setAmountOriginal("");
      setNote("");
      setMerchant("");
      setEditingExpense(null);
      setIsManualModalOpen(false);
    } catch (error) {
      console.error("Chyba při ukládání výdaje:", error);
      setErrorMessage("Chyba při ukládání do Firestore. Zkontrolujte připojení.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F6F4] text-slate-800 antialiased selection:bg-rose-500/20 pb-44">
      {/* Toast notifikace úspěchu */}
      {successToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-slate-900 text-white px-4 py-2.5 shadow-xl text-xs sm:text-sm font-medium animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{successToast}</span>
        </div>
      )}

      <main className="max-w-md mx-auto px-4 pt-6 flex flex-col gap-5 sm:max-w-lg">
        {/* HLAVIČKA */}
        <header className="flex flex-col gap-1 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider uppercase text-rose-500 flex items-center gap-1.5">
              <span>🌏</span>
              <span>Cestovní Peněženka</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200/60">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Thajsko, Laos, Vietnam
          </h1>
          <p className="text-xs text-slate-500">
            Aktuální přehled cestovních financí v CZK
          </p>
        </header>

        {/* CHYBOVÁ HLÁŠKA */}
        {errorMessage && (
          <div className="flex items-start gap-2.5 rounded-2xl bg-rose-50 border border-rose-200 p-3.5 text-rose-800 text-xs sm:text-sm">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 hover:text-rose-700 text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* POUZE ČISTÉ KARTY TOTAL A TODAY NAHOŘE */}
        <div className="grid grid-cols-2 gap-3">
          {/* Total Karta (Celkem Kč) */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Total (Celkem)
              </span>
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
                Celkem {expenses.length} výdajů
              </p>
            </div>
          </div>

          {/* Today Karta (Dnes Kč) */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-500">
                Today (Dnes)
              </span>
              <div className="h-7 w-7 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">
                <Calendar className="h-3.5 w-3.5" />
              </div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-rose-600 tracking-tight">
                {formatNumber(todayCZK)}{" "}
                <span className="text-xs font-semibold text-rose-400">Kč</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                {todayCount} dnes
              </p>
            </div>
          </div>
        </div>

        {/* ČISTÝ FEED VÝDAJŮ SESKUPENÝCH PODLE DNŮ */}
        <div className="flex flex-col gap-4">
          {isLoading ? (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-rose-500 mb-2" />
              <p className="text-xs font-medium">Načítám výdaje...</p>
            </div>
          ) : groupedExpenses.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center text-slate-400">
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                <Tag className="h-6 w-6" />
              </div>
              <p className="text-sm font-bold text-slate-700">Zatím žádné výdaje</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Zatím nemáš žádné výdaje. Přidej první výdaj tlačítkem + nebo rychlou šablonou.
              </p>
            </div>
          ) : (
            groupedExpenses.map((group) => (
              <section key={group.dateKey} className="flex flex-col gap-1.5">
                {/* Hlavička dne: Datum vlevo ('Dnes • 11. října'), celková částka za den vpravo */}
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-slate-500 tracking-wide">
                    {isClient ? group.label : group.dateKey}
                  </span>
                  <span className="text-xs font-black text-slate-800 tracking-tight">
                    {formatNumber(group.totalCZK)} Kč
                  </span>
                </div>

                {/* Karta se záznamy daného dne */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                  {group.items.map((expense) => {
                    const def = getCategoryDefinition(expense.category);
                    const IconComp = CATEGORY_ICONS[def.id] || Tag;

                    return (
                      <div
                        key={expense.id ?? `${expense.createdAt}-${expense.note}`}
                        onClick={() => handleOpenEdit(expense)}
                        className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors cursor-pointer group"
                      >
                        {/* Levá část: Kulatá ikona kategorie + popisy */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* Kulatá ikona kategorie */}
                          <div
                            className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${def.circleBg}`}
                          >
                            <IconComp className="h-5 w-5 stroke-[2.2]" />
                          </div>

                          {/* Popis a detail */}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-slate-900 truncate group-hover:text-rose-600 transition-colors">
                              {expense.note}
                            </p>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate mt-0.5">
                              <span className="font-medium text-slate-500">
                                {def.label}
                              </span>
                                {expense.merchant && (
                                  <>
                                    <span>•</span>
                                    <span className="truncate">{expense.merchant}</span>
                                  </>
                                )}
                                {expense.currency !== "CZK" && (
                                  <>
                                    <span>•</span>
                                    <span className="font-mono text-slate-400">
                                      {formatNumber(expense.amountOriginal, 0)} {expense.currency}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Pravá část: Částka v CZK + Ikony Edit & Delete */}
                          <div className="text-right shrink-0 flex flex-col items-end">
                            <div className="text-sm font-black text-slate-900 tracking-tight">
                              {formatNumber(expense.amountCZK)} Kč
                            </div>
                            {expense.currency !== "CZK" && (
                              <div className="text-[10px] text-slate-400 font-medium">
                                {formatNumber(expense.amountOriginal, 0)} {expense.currency}
                              </div>
                            )}

                            {/* Akční tlačítka pro Úpravu & Smazání */}
                            <div className="flex items-center gap-1 mt-1 opacity-80 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEdit(expense);
                                }}
                                className="p-1 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                                title="Upravit výdaj"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(expense.id);
                                }}
                                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                title="Smazat výdaj"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))
            )}
          </div>
        </main>

      {/* SPODNÍ FIXOVANÁ SEKCE (RYCHLÉ ŠABLONY + DOMINANTNÍ TLAČÍTKO NOVÝ VÝDAJ + SPODNÍ NAVIGACE, z-index 50) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
        {/* Lišta s rychlými šablonami (Quick Presets) */}
        <div className="max-w-md mx-auto px-4 pb-2 pointer-events-auto sm:max-w-lg">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {QUICK_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className="shrink-0 px-3.5 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-md shadow-slate-200/50 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-600 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                title={`Rychle přidat: ${preset.label}`}
              >
                <span className="text-sm">{preset.emoji}</span>
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Dominantní plovoucí tlačítko: + Nový výdaj */}
        <div className="max-w-md mx-auto px-4 pb-3 flex justify-end pointer-events-auto sm:max-w-lg">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="h-13 px-6 rounded-full bg-gradient-to-r from-rose-500 via-rose-600 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-xl shadow-rose-500/35 flex items-center gap-2.5 font-bold text-sm tracking-wide transition-all duration-200 active:scale-95 cursor-pointer border border-white/20 hover:shadow-rose-500/50"
            title="Přidat nový výdaj"
          >
            <div className="h-7 w-7 rounded-full bg-white/25 flex items-center justify-center shrink-0">
              <Plus className="h-5 w-5 stroke-[2.8]" />
            </div>
            <span>Nový výdaj</span>
          </button>
        </div>

        {/* Spodní elegantní navigace: Entries, Služby, Stats, Search */}
        <nav className="bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-lg pointer-events-auto">
          <div className="max-w-md mx-auto sm:max-w-lg px-6 py-2 flex items-center justify-between">
            <Link
              href="/"
              className="flex flex-col items-center gap-0.5 text-rose-600 font-bold transition-colors"
              aria-current="page"
            >
              <ReceiptText className="h-5 w-5" />
              <span className="text-[10px]">Entries</span>
            </Link>

            <Link
              href="/services"
              className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <BookOpen className="h-5 w-5" />
              <span className="text-[10px]">Služby</span>
            </Link>

            <Link
              href="/stats"
              className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-rose-600 transition-colors"
            >
              <BarChart3 className="h-5 w-5" />
              <span className="text-[10px]">Stats</span>
            </Link>

            <Link
              href="/search"
              className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-rose-600 transition-colors"
            >
              <Search className="h-5 w-5" />
              <span className="text-[10px]">Search</span>
            </Link>
          </div>
        </nav>
      </div>

      {/* MODÁLNÍ LIST / BOTTOM SHEET PRO RUČNÍ FORMULÁŘ & ÚPRAVU */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/40 backdrop-blur-xs p-0 sm:p-4">
          <div
            className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 p-5 sm:p-6 flex flex-col gap-4 animate-in slide-in-from-bottom-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Hlavička modálu */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  {editingExpense ? "Upravit výdaj" : "Nový výdaj"}
                </h3>
                <p className="text-xs text-slate-400">
                  {editingExpense
                    ? "Upravte částku, měnu, popis nebo kategorii"
                    : "Zadejte částku a zvolte kategorii"}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsManualModalOpen(false);
                  setEditingExpense(null);
                }}
                className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="flex flex-col gap-4">
              {/* Rychlé šablony (Quick Presets) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Rychlé šablony
                </label>
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  {QUICK_PRESETS.map((preset) => {
                    const isPresetActive =
                      manualCategory === preset.category && note === preset.defaultNote;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleApplyPreset(preset)}
                        className={`shrink-0 px-2.5 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                          isPresetActive
                            ? "bg-rose-50 border-rose-300 text-rose-700 shadow-xs ring-1 ring-rose-300"
                            : "bg-slate-50 border-slate-200/80 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <span className="text-sm">{preset.emoji}</span>
                        <span>{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Výběr kategorie s lucide ikonami */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Kategorie
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {CATEGORY_LIST.map((cat) => {
                    const IconComp = CATEGORY_ICONS[cat.id] || Tag;
                    const isSelected = manualCategory === cat.id;

                    return (
                      <button
                        type="button"
                        key={cat.id}
                        onClick={() => setManualCategory(cat.id)}
                        className={`p-2 rounded-xl text-left border flex flex-col items-center gap-1 transition-all ${
                          isSelected
                            ? "bg-rose-50 border-rose-400 text-rose-700 shadow-xs ring-1 ring-rose-400"
                            : "bg-slate-50 border-slate-200/70 text-slate-600 hover:bg-slate-100/70"
                        }`}
                      >
                        <div
                          className={`h-8 w-8 rounded-full flex items-center justify-center ${
                            isSelected ? "bg-rose-500 text-white" : "bg-white text-slate-600 shadow-xs"
                          }`}
                        >
                          <IconComp className="h-4 w-4" />
                        </div>
                        <span className="text-[11px] font-semibold text-center truncate w-full">
                          {cat.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Částka & Měna */}
              <div>
                <div className="grid grid-cols-5 gap-2">
                  <div className="col-span-3">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Částka *
                    </label>
                    <div className="relative">
                      <input
                        ref={amountInputRef}
                        type="number"
                        step="any"
                        min="0"
                        required
                        placeholder="Např. 80"
                        value={amountOriginal}
                        onChange={(e) => setAmountOriginal(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-base font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:bg-white"
                      />
                      {previewAmountCZK > 0 && currency !== "CZK" && (
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                          ≈ {formatNumber(previewAmountCZK)} Kč
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Měna *
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as Currency)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white"
                    >
                      {CURRENCIES.map((curr) => (
                        <option key={curr} value={curr}>
                          {curr}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Informace o použitém kurzu a přepočtu */}
                {currency !== "CZK" && (
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">
                    {numericAmount > 0 && previewAmountCZK > 0 ? (
                      <>
                        Přepočet: {amountOriginal} {currency} ≈ {formatNumber(previewAmountCZK)} CZK{" "}
                        <span className="text-slate-400">
                          (kurz 1 CZK = {rates[currency] ? (rates[currency] >= 100 ? Math.round(rates[currency]).toLocaleString("cs-CZ") : rates[currency].toFixed(2)) : "1"} {currency})
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-400">
                        Kurz 1 CZK = {rates[currency] ? (rates[currency] >= 100 ? Math.round(rates[currency]).toLocaleString("cs-CZ") : rates[currency].toFixed(2)) : "1"} {currency}
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/* Popis */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Popis výdaje *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Např. Pad Thai na trhu, vlak do Chiang Mai..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:bg-white"
                />
              </div>

              {/* Podnik / Místo */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Místo / Podnik <span className="text-slate-400 lowercase">(volitelné)</span>
                </label>
                <div className="relative">
                  <Store className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Např. 7-Eleven, Night Market..."
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Odeslat tlačítko */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 w-full py-3 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 active:scale-[0.99] text-white font-bold text-sm shadow-md shadow-rose-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Ukládám...</span>
                  </>
                ) : (
                  <>
                    {editingExpense ? (
                      <>
                        <Pencil className="h-4 w-4" />
                        <span>Uložit změny</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 stroke-[2.5]" />
                        <span>Uložit výdaj</span>
                      </>
                    )}
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
