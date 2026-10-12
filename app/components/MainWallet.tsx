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
import { parseAIExpense } from "@/app/actions/parseExpense";
import { parseReceiptImage } from "@/app/actions/parseReceipt";
import { parseAudioExpense } from "@/app/actions/parseAudioExpense";
import { Currency, Expense, CURRENCIES } from "@/lib/types";
import {
  Sparkles,
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
  Send,
  CheckCircle2,
  ReceiptText,
  BarChart3,
  Map,
  Search,
  MapPin,
  Pencil,
  Trash2,
  Camera,
  Mic,
} from "lucide-react";

// Orientační kurzy: 1000 VND = 0.95 CZK, 1 THB = 0.68 CZK, 1000 LAK = 1.1 CZK, 1 USD = 23 CZK, 1 CZK = 1 CZK
const EXCHANGE_RATES: Record<Currency, number> = {
  VND: 0.95 / 1000,
  THB: 0.68,
  LAK: 1.1 / 1000,
  USD: 23,
  CZK: 1,
};

// Seznam hlavních kategorií s ikonami a barvami
export const CATEGORY_DEFINITIONS = [
  {
    id: "Transportation",
    label: "Transportation",
    icon: Train,
    emoji: "🚆",
    circleBg: "bg-orange-100 text-orange-600",
    badgeBg: "bg-orange-50 text-orange-700 border-orange-200",
  },
  {
    id: "Restaurants",
    label: "Restaurants",
    icon: UtensilsCrossed,
    emoji: "🍽️",
    circleBg: "bg-rose-100 text-rose-600",
    badgeBg: "bg-rose-50 text-rose-700 border-rose-200",
  },
  {
    id: "Drinks",
    label: "Drinks",
    icon: Wine,
    emoji: "🍸",
    circleBg: "bg-purple-100 text-purple-600",
    badgeBg: "bg-purple-50 text-purple-700 border-purple-200",
  },
  {
    id: "Coffee",
    label: "Coffee",
    icon: Coffee,
    emoji: "☕",
    circleBg: "bg-amber-100 text-amber-800",
    badgeBg: "bg-amber-50 text-amber-800 border-amber-200",
  },
  {
    id: "Groceries",
    label: "Groceries",
    icon: ShoppingCart,
    emoji: "🛒",
    circleBg: "bg-emerald-100 text-emerald-600",
    badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    id: "Accommodation",
    label: "Accommodation",
    icon: Hotel,
    emoji: "🏨",
    circleBg: "bg-blue-100 text-blue-600",
    badgeBg: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    id: "Flights",
    label: "Flights",
    icon: Plane,
    emoji: "✈️",
    circleBg: "bg-sky-100 text-sky-600",
    badgeBg: "bg-sky-50 text-sky-700 border-sky-200",
  },
] as const;

// Inteligentní mapování libovolné kategorie (včetně starých českých s emoji)
function getCategoryMeta(catName: string) {
  const norm = (catName || "").toLowerCase();

  if (
    norm.includes("transport") ||
    norm.includes("doprav") ||
    norm.includes("vlak") ||
    norm.includes("taxi") ||
    norm.includes("grab") ||
    norm.includes("autobus")
  ) {
    return CATEGORY_DEFINITIONS[0]; // Transportation
  }
  if (
    norm.includes("restaurant") ||
    norm.includes("gastro") ||
    norm.includes("jídlo") ||
    norm.includes("jidlo") ||
    norm.includes("oběd") ||
    norm.includes("večeře")
  ) {
    return CATEGORY_DEFINITIONS[1]; // Restaurants
  }
  if (
    norm.includes("drink") ||
    norm.includes("pivo") ||
    norm.includes("bar") ||
    norm.includes("alkohol") ||
    norm.includes("koktejl")
  ) {
    return CATEGORY_DEFINITIONS[2]; // Drinks
  }
  if (
    norm.includes("coffee") ||
    norm.includes("káv") ||
    norm.includes("kav") ||
    norm.includes("cafe") ||
    norm.includes("espresso")
  ) {
    return CATEGORY_DEFINITIONS[3]; // Coffee
  }
  if (
    norm.includes("grocer") ||
    norm.includes("nákup") ||
    norm.includes("nakup") ||
    norm.includes("market") ||
    norm.includes("7-eleven") ||
    norm.includes("obchod")
  ) {
    return CATEGORY_DEFINITIONS[4]; // Groceries
  }
  if (
    norm.includes("accommodat") ||
    norm.includes("ubytov") ||
    norm.includes("hotel") ||
    norm.includes("hostel") ||
    norm.includes("airbnb")
  ) {
    return CATEGORY_DEFINITIONS[5]; // Accommodation
  }
  if (
    norm.includes("flight") ||
    norm.includes("letenk") ||
    norm.includes("let") ||
    norm.includes("aerolink")
  ) {
    return CATEGORY_DEFINITIONS[6]; // Flights
  }

  // Výchozí zástupná kategorie pro ostatní
  return {
    id: catName || "Other",
    label: catName || "Ostatní",
    icon: Tag,
    emoji: "🏷️",
    circleBg: "bg-slate-100 text-slate-600",
    badgeBg: "bg-slate-50 text-slate-700 border-slate-200",
  };
}

export default function MainWallet() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // GPS poloha – automaticky vyžádaná při mountu
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Aktivní záložka spodní navigace: Entries | Stats | Map | Search
  const [activeTab, setActiveTab] = useState<"entries" | "stats" | "map" | "search">("entries");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Stavové proměnné pro AI vstup a skenování účtenek
  const [aiInputText, setAiInputText] = useState<string>("");
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [isReceiptScanning, setIsReceiptScanning] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stavové proměnné pro nahrávání zvuku přes mikrofon
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isAudioProcessing, setIsAudioProcessing] = useState<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Stav pro modální okno formuláře (přidání i editace)
  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Stavové proměnné pro formulář
  const [amountOriginal, setAmountOriginal] = useState<string>("");
  const [currency, setCurrency] = useState<Currency>("VND");
  const [note, setNote] = useState<string>("");
  const [merchant, setMerchant] = useState<string>("");
  const [manualCategory, setManualCategory] = useState<string>("Restaurants");

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
  const { todayCZK, todayCount } = useMemo(() => {
    const todayExpenses = expenses.filter((e) => isTodayDate(e.createdAt));
    const sum = todayExpenses.reduce((acc, curr) => acc + (curr.amountCZK || 0), 0);
    return { todayCZK: sum, todayCount: todayExpenses.length };
  }, [expenses]);

  // Čistý feed výdajů seskupených přímo podle dnů (createdAt)
  const groupedExpenses = useMemo(() => {
    const groups: {
      [dateKey: string]: {
        label: string;
        totalCZK: number;
        items: Expense[];
      };
    } = {};

    expenses.forEach((exp) => {
      let dateKey = "Neznámé datum";
      let label = "Neznámé datum";

      try {
        const d = new Date(exp.createdAt);
        if (!isNaN(d.getTime())) {
          dateKey = d.toISOString().split("T")[0];

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
        }
      } catch {
        dateKey = "Neznámé datum";
        label = "Neznámé datum";
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
  }, [expenses]);

  // Statistiky podle kategorií pro záložku Stats
  const categoryStats = useMemo(() => {
    const map: { [cat: string]: { totalCZK: number; count: number } } = {};
    expenses.forEach((e) => {
      const meta = getCategoryMeta(e.category);
      if (!map[meta.label]) {
        map[meta.label] = { totalCZK: 0, count: 0 };
      }
      map[meta.label].totalCZK += e.amountCZK || 0;
      map[meta.label].count += 1;
    });
    return Object.entries(map).sort((a, b) => b[1].totalCZK - a[1].totalCZK);
  }, [expenses]);

  // Filtrované výdaje pro záložku Search
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return expenses;
    const q = searchQuery.toLowerCase();
    return expenses.filter(
      (e) =>
        e.note.toLowerCase().includes(q) ||
        (e.merchant && e.merchant.toLowerCase().includes(q)) ||
        e.category.toLowerCase().includes(q)
    );
  }, [expenses, searchQuery]);

  // Živý přepočet pro náhled v ručním formuláři
  const previewAmountCZK =
    amountOriginal && !isNaN(Number(amountOriginal))
      ? Math.round(Number(amountOriginal) * (EXCHANGE_RATES[currency] ?? 1) * 100) / 100
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
    setCurrency("VND");
    setNote("");
    setMerchant("");
    setManualCategory("Restaurants");
    setIsManualModalOpen(true);
  };

  // Otevření modálu pro úpravu existujícího výdaje
  const handleOpenEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setAmountOriginal(expense.amountOriginal.toString());
    setCurrency(expense.currency);
    setNote(expense.note);
    setMerchant(expense.merchant || "");
    const meta = getCategoryMeta(expense.category);
    setManualCategory(meta.id);
    setIsManualModalOpen(true);
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

  // Nahrání a zpracování fotografie účtenky přes Gemini Vision
  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsReceiptScanning(true);
    setErrorMessage(null);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      });

      const parsedReceipt = await parseReceiptImage(
        base64,
        file.type || "image/jpeg"
      );
      const receiptPayload = currentLocation
        ? { ...parsedReceipt, location: currentLocation }
        : parsedReceipt;
      await addDoc(collection(db, "expenses"), receiptPayload);
      showSuccess(
        `Účtenka načtena: ${parsedReceipt.merchant ? `${parsedReceipt.merchant} – ` : ""}${parsedReceipt.note} (${formatNumber(parsedReceipt.amountCZK)} Kč)`
      );
    } catch (err) {
      console.error("Chyba při skenování účtenky:", err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Nepodařilo se zpracovat účtenku pomocí AI."
      );
    } finally {
      setIsReceiptScanning(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Odeslání AI vstupu
  const handleAISubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInputText.trim() || aiLoading) return;

    setAiLoading(true);
    setErrorMessage(null);

    try {
      const parsedExpense = await parseAIExpense(aiInputText);
      const payload = currentLocation
        ? { ...parsedExpense, location: currentLocation }
        : parsedExpense;
      await addDoc(collection(db, "expenses"), payload);
      setAiInputText("");
      showSuccess(`Uloženo: ${parsedExpense.note} (${formatNumber(parsedExpense.amountCZK)} Kč)`);
    } catch (error) {
      console.error("Chyba při zpracování AI výdaje:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Nepodařilo se zpracovat výdaj pomocí AI."
      );
    } finally {
      setAiLoading(false);
    }
  };

  // Zahájení nahrávání audia přes navigator.mediaDevices.getUserMedia
  const startRecording = async () => {
    try {
      setErrorMessage(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorMessage("Váš prohlížeč nepodporuje nahrávání zvuku.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      let mimeType = "audio/webm";
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          mimeType = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/webm")) {
          mimeType = "audio/webm";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
          mimeType = "audio/ogg";
        }
      }

      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        // Zastavení všech stop pro okamžité uvolnění mikrofonu
        stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

        if (audioBlob.size === 0) {
          setIsRecording(false);
          setIsAudioProcessing(false);
          return;
        }

        setIsAudioProcessing(true);
        setErrorMessage(null);

        try {
          const reader = new FileReader();
          reader.onloadend = async () => {
            try {
              const base64Audio = reader.result as string;
              const parsedAudio = await parseAudioExpense(
                base64Audio,
                recorder.mimeType || "audio/webm"
              );

              const payload = currentLocation
                ? { ...parsedAudio, location: currentLocation }
                : parsedAudio;

              await addDoc(collection(db, "expenses"), payload);
              showSuccess(
                `Hlasový výdaj uložen: ${parsedAudio.note} (${formatNumber(parsedAudio.amountCZK)} Kč)`
              );
            } catch (error) {
              console.error("Chyba při zpracování hlasového výdaje:", error);
              setErrorMessage(
                error instanceof Error
                  ? error.message
                  : "Nepodařilo se zpracovat hlasový záznam."
              );
            } finally {
              setIsAudioProcessing(false);
              setIsRecording(false);
            }
          };

          reader.onerror = () => {
            setErrorMessage("Chyba při čtení audio dat.");
            setIsAudioProcessing(false);
            setIsRecording(false);
          };

          reader.readAsDataURL(audioBlob);
        } catch (error) {
          console.error("Chyba při převodu audia:", error);
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Nepodařilo se zpracovat audio."
          );
          setIsAudioProcessing(false);
          setIsRecording(false);
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Chyba přístupu k mikrofonu:", err);
      setErrorMessage(
        "Nepodařilo se získat přístup k mikrofonu. Povolte prosím mikrofon v prohlížeči."
      );
      setIsRecording(false);
      setIsAudioProcessing(false);
    }
  };

  // Ukončení nahrávání
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  // Přepínač nahrávání
  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
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
      const rate = EXCHANGE_RATES[currency] ?? 1;
      const calculatedCZK = Math.round(numericAmount * rate * 100) / 100;

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

        {/* OBSAH PODLE VYBRANÉ ZÁLOŽKY */}
        {activeTab === "entries" && (
          /* ČISTÝ FEED VÝDAJŮ SESKUPENÝCH PODLE DNŮ */
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
                  Použij spodní AI lištu pro rychlý záznam nebo klikni na + pro ruční zadání.
                </p>
              </div>
            ) : (
              groupedExpenses.map((group) => (
                <section key={group.dateKey} className="flex flex-col gap-1.5">
                  {/* Hlavička dne: Datum vlevo ('Dnes • 11. října'), celková částka za den vpravo */}
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold text-slate-500 tracking-wide">
                      {group.label}
                    </span>
                    <span className="text-xs font-black text-slate-800 tracking-tight">
                      {formatNumber(group.totalCZK)} Kč
                    </span>
                  </div>

                  {/* Karta se záznamy daného dne */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                    {group.items.map((expense) => {
                      const meta = getCategoryMeta(expense.category);
                      const IconComp = meta.icon;

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
                              className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${meta.circleBg}`}
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
                                  {meta.label}
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
        )}

        {/* ZÁLOŽKA STATS */}
        {activeTab === "stats" && (
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-bold text-slate-700 px-1">Přehled podle kategorií</h2>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col gap-3">
              {categoryStats.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Žádná data pro statistiku</p>
              ) : (
                categoryStats.map(([categoryName, data]) => {
                  const meta = getCategoryMeta(categoryName);
                  const IconComp = meta.icon;
                  const percent = totalCZK > 0 ? Math.round((data.totalCZK / totalCZK) * 100) : 0;
                  return (
                    <div key={categoryName} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className={`h-6 w-6 rounded-full flex items-center justify-center ${meta.circleBg}`}>
                            <IconComp className="h-3.5 w-3.5" />
                          </div>
                          <span className="font-semibold text-slate-800">{categoryName}</span>
                          <span className="text-slate-400 text-[11px]">({data.count}×)</span>
                        </div>
                        <div className="font-bold text-slate-900">
                          {formatNumber(data.totalCZK)} Kč <span className="text-slate-400 font-normal">({percent}%)</span>
                        </div>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-rose-500 rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ZÁLOŽKA MAP */}
        {activeTab === "map" && (
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-bold text-slate-700 px-1">Cestovní trasa & Lokace</h2>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col gap-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-150/70">
                <MapPin className="h-5 w-5 text-rose-500 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-slate-900">Trasa Jihovýchodní Asie</div>
                  <div className="text-[11px] text-slate-500">🇹🇭 Thajsko ➔ 🇱🇦 Laos ➔ 🇻🇳 Vietnam</div>
                </div>
              </div>
              <div className="flex flex-col divide-y divide-slate-100">
                {expenses.filter(e => e.merchant).slice(0, 8).map((e) => (
                  <div key={e.id} className="py-2.5 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 truncate">{e.merchant}</span>
                    <span className="font-bold text-slate-900 shrink-0">{formatNumber(e.amountCZK)} Kč</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ZÁLOŽKA SEARCH */}
        {activeTab === "search" && (
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Hledat výdaj, podnik, kategorii..."
                className="w-full bg-white rounded-2xl border border-slate-200 pl-10 pr-4 py-2.5 text-xs text-slate-900 shadow-xs focus:outline-none focus:border-rose-500"
              />
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-100 overflow-hidden">
              {searchResults.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">Nenalezen žádný odpovídající výdaj</p>
              ) : (
                searchResults.map((exp) => (
                  <div
                    key={exp.id}
                    onClick={() => handleOpenEdit(exp)}
                    className="p-3 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{exp.note}</div>
                      <div className="text-[11px] text-slate-400">
                        {exp.category} {exp.merchant ? `• ${exp.merchant}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="font-bold text-slate-900">{formatNumber(exp.amountCZK)} Kč</div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(exp.id);
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* Skrytý input pro nahrání / vyfocení účtenky */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleReceiptUpload}
        className="hidden"
      />

      {/* SPODNÍ FIXOVANÁ SEKCE (FLOATING AI BAR + SPODNÍ NAVIGACE, z-index 50) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
        {/* Plovoucí bílý pilulkový input s ikonou ✨, fotoaparátem a tlačítkem + */}
        <div className="max-w-md mx-auto px-4 pb-2.5 pointer-events-auto sm:max-w-lg">
          <div className="flex items-center gap-2">
            <form
              onSubmit={handleAISubmit}
              className={`flex-1 flex items-center bg-white shadow-xl shadow-slate-300/40 border rounded-full pl-3.5 pr-1.5 py-1.5 gap-1.5 transition-all ${
                isRecording
                  ? "border-red-400 ring-2 ring-red-500/20"
                  : "border-slate-200/90 focus-within:ring-2 focus-within:ring-rose-500/20 focus-within:border-rose-400"
              }`}
            >
              {isRecording ? (
                <div className="flex-1 flex items-center gap-2 min-w-0 pl-1">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-red-600 animate-pulse truncate">
                    Nahrávám...
                  </span>
                </div>
              ) : isAudioProcessing ? (
                <div className="flex-1 flex items-center gap-2 min-w-0 pl-1 text-rose-600 text-xs sm:text-sm font-medium">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0 text-rose-500" />
                  <span className="truncate">Gemini přepisuje...</span>
                </div>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-rose-500 shrink-0 animate-pulse" />
                  <input
                    type="text"
                    disabled={aiLoading || isReceiptScanning || isAudioProcessing}
                    value={aiInputText}
                    onChange={(e) => setAiInputText(e.target.value)}
                    placeholder={
                      isReceiptScanning
                        ? "Skenuji účtenku..."
                        : "Zadejte výdaj... (např. 150k oběd)"
                    }
                    className="w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none disabled:opacity-50 min-w-0"
                  />
                </>
              )}

              {/* Tlačítko fotoaparátu pro nahrání/vyfocení účtenky */}
              {!isRecording && !isAudioProcessing && (
                <button
                  type="button"
                  disabled={aiLoading || isReceiptScanning}
                  onClick={() => fileInputRef.current?.click()}
                  className="shrink-0 h-9 w-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors active:scale-95 disabled:opacity-50 cursor-pointer"
                  title="Vyfotit nebo nahrát účtenku"
                >
                  {isReceiptScanning ? (
                    <Loader2 className="h-4 w-4 animate-spin text-rose-500" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </button>
              )}

              {/* Tlačítko mikrofonu pro nahrávání hlasového výdaje */}
              <button
                type="button"
                disabled={aiLoading || isReceiptScanning || isAudioProcessing}
                onClick={handleToggleRecording}
                className={`shrink-0 h-9 w-9 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
                  isRecording
                    ? "bg-red-500 hover:bg-red-600 text-white animate-pulse shadow-md shadow-red-500/30"
                    : isAudioProcessing
                    ? "bg-rose-50 text-rose-500 cursor-not-allowed"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900"
                }`}
                title={
                  isRecording
                    ? "Zastavit a analyzovat nahrávku"
                    : "Nahrát hlasový výdaj"
                }
              >
                {isAudioProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin text-rose-500" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </button>

              {/* Růžové tlačítko pro AI odeslání textu */}
              {!isRecording && !isAudioProcessing && (
                <button
                  type="submit"
                  disabled={aiLoading || isReceiptScanning || !aiInputText.trim()}
                  className="shrink-0 h-9 px-3.5 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-semibold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Odeslat do AI"
                >
                  {aiLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">AI</span>
                    </>
                  )}
                </button>
              )}
            </form>

            {/* Kulaté tlačítko + pro otevření ručního formuláře */}
            <button
              type="button"
              onClick={handleOpenCreate}
              className="h-12 w-12 rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-xl shadow-slate-900/25 flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer"
              title="Přidat nový výdaj ručně"
            >
              <Plus className="h-6 w-6 stroke-[2.3]" />
            </button>
          </div>
        </div>

        {/* Spodní elegantní navigace: Entries, Stats, Map, Search */}
        <nav className="bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-lg pointer-events-auto">
          <div className="max-w-md mx-auto sm:max-w-lg px-6 py-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setActiveTab("entries")}
              className={`flex flex-col items-center gap-0.5 transition-colors ${
                activeTab === "entries" ? "text-rose-600 font-bold" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <ReceiptText className="h-5 w-5" />
              <span className="text-[10px]">Entries</span>
            </button>

            <Link
              href="/stats"
              className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-rose-600 transition-colors"
            >
              <BarChart3 className="h-5 w-5" />
              <span className="text-[10px]">Stats</span>
            </Link>

            <button
              type="button"
              onClick={() => setActiveTab("map")}
              className={`flex flex-col items-center gap-0.5 transition-colors ${
                activeTab === "map" ? "text-rose-600 font-bold" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Map className="h-5 w-5" />
              <span className="text-[10px]">Map</span>
            </button>

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
              {/* Výběr kategorie s lucide ikonami */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Kategorie
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {CATEGORY_DEFINITIONS.map((cat) => {
                    const IconComp = cat.icon;
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
              <div className="grid grid-cols-5 gap-2">
                <div className="col-span-3">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Částka *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      required
                      placeholder="Např. 80"
                      value={amountOriginal}
                      onChange={(e) => setAmountOriginal(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-base font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:bg-white"
                    />
                    {previewAmountCZK > 0 && (
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
